import { readFile } from 'node:fs/promises';

import { atomicWriteJson } from '../lib/atomic-json.mjs';
import { sha256, stableStringify } from '../lib/hash.mjs';
import { toPathKey } from '../lib/path-key.mjs';
import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';
import { buildCanonicalRevision } from './canonical.mjs';

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function snapshot(value) {
  try {
    return structuredClone(value);
  } catch {
    throw typedError('CATALOG_ARTIFACT_INVALID', 'Catalog artifact must be JSON-safe');
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeImmutableJson(workspace, parts, value) {
  const expected = snapshot(value);
  const path = await assertCatalogWorkspaceMutation(workspace, parts);
  const current = await readJson(path);
  if (current !== null) {
    if (stableStringify(current) !== stableStringify(expected)) {
      throw typedError('CATALOG_ARTIFACT_COLLISION', 'Content-addressed artifact already contains different content');
    }
    return Object.freeze({ created: false, path });
  }
  await atomicWriteJson(path, expected);
  return Object.freeze({ created: true, path });
}

function targetPath(target) {
  if (!target || typeof target.moemoaAnimeId !== 'string' || !toPathKey(target.moemoaAnimeId)) {
    throw typedError('CATALOG_ARTIFACT_INVALID', 'Target has no safe MOEMOA anime id');
  }
  return toPathKey(target.moemoaAnimeId);
}

function sourcePath(record) {
  if (!record || typeof record.sourceId !== 'string' || typeof record.targetKey !== 'string'
    || typeof record.sourceRecordId !== 'string' || !/^[a-f0-9]{64}$/u.test(record.sourceRecordId)) {
    throw typedError('CATALOG_ARTIFACT_INVALID', 'Normalized record has no safe source identity');
  }
  return ['normalized', toPathKey(record.sourceId), toPathKey(record.targetKey), `${record.sourceRecordId}.json`];
}

function canonicalInput({ target, sourceRecords, normalizedRecords, claims }) {
  return buildCanonicalRevision({
    target,
    sourceRecords,
    normalizedRecords,
    fieldClaims: claims,
  });
}

/** Trusted-local persistence for immutable catalog stages and small mutable pointers. */
export function createCatalogArtifactStore({ workspace }) {
  async function readIdMap() {
    await assertCatalogWorkspaceMutation(workspace, []);
    return readJson(workspace.resolve('state', 'id-map.json'));
  }

  async function writeIdMap(value) {
    await assertCatalogWorkspaceMutation(workspace, []);
    const path = workspace.resolve('state', 'id-map.json');
    await atomicWriteJson(path, snapshot(value));
    return Object.freeze({ path });
  }

  async function readManifest(profile) {
    await assertCatalogWorkspaceMutation(workspace, []);
    return readJson(workspace.resolve('manifests', `${toPathKey(profile)}.json`));
  }

  async function writeManifest(profile, manifest) {
    const parts = ['manifests', `${toPathKey(profile)}.json`];
    return writeImmutableJson(workspace, parts, manifest);
  }

  async function readAniLifeBindings() {
    await assertCatalogWorkspaceMutation(workspace, []);
    return (await readJson(workspace.resolve('bindings', 'anilife.json'))) ?? {};
  }

  async function writeAniLifeBinding(targetKeyOrInput, maybeBinding) {
    const targetKey = typeof targetKeyOrInput === 'string' ? targetKeyOrInput : targetKeyOrInput?.targetKey;
    const binding = typeof targetKeyOrInput === 'string' ? maybeBinding : targetKeyOrInput?.binding;
    if (typeof targetKey !== 'string' || !targetKey || !binding || typeof binding !== 'object'
      || !/^[1-9]\d*$/u.test(binding.contentId) || binding.evidence !== 'MANUAL_PUBLIC_PAGE_REVIEW') {
      throw typedError('CATALOG_ARTIFACT_INVALID', 'AniLife binding is invalid');
    }
    const parts = ['bindings', 'anilife.json'];
    const path = await assertCatalogWorkspaceMutation(workspace, parts);
    const current = (await readJson(path)) ?? {};
    const next = { ...current, [targetKey]: { contentId: binding.contentId, evidence: binding.evidence } };
    await atomicWriteJson(path, next);
    return Object.freeze({ path, binding: Object.freeze(next[targetKey]) });
  }

  async function readSourceRecord({ sourceId, targetKey, sourceRecordId }) {
    await assertCatalogWorkspaceMutation(workspace, []);
    if (!['anilist', 'wikidata', 'anilife_public'].includes(sourceId)
      || typeof targetKey !== 'string' || !/^ANILIST:[1-9]\d*$/u.test(targetKey)
      || typeof sourceRecordId !== 'string' || !/^[a-f0-9]{64}$/u.test(sourceRecordId)) {
      throw typedError('CATALOG_ARTIFACT_INVALID', 'Source record path segments are invalid');
    }
    return readJson(workspace.resolve('raw', toPathKey(sourceId), toPathKey(targetKey), `${sourceRecordId}.json`));
  }

  async function writeNormalized(input) {
    const normalized = input?.normalized ?? input;
    return writeImmutableJson(workspace, sourcePath(normalized), normalized);
  }

  async function writeCurrent(target, contentHash) {
    const animePath = targetPath(target);
    if (typeof contentHash !== 'string' || !/^[a-f0-9]{64}$/u.test(contentHash)) {
      throw typedError('CATALOG_ARTIFACT_INVALID', 'Canonical pointer hash is invalid');
    }
    const pointerPath = await assertCatalogWorkspaceMutation(workspace, ['current', `${animePath}.json`]);
    await atomicWriteJson(pointerPath, {
      animeId: target.moemoaAnimeId,
      contentHash,
    });
    return Object.freeze({ path: pointerPath, contentHash });
  }

  async function writeCanonical({ target, sourceRecords, normalizedRecords, claims, canonical, updateCurrent = true }) {
    const rebuilt = canonicalInput({ target, sourceRecords, normalizedRecords, claims });
    if (stableStringify(rebuilt) !== stableStringify(canonical)) {
      throw typedError('CATALOG_ARTIFACT_CANONICAL_MISMATCH', 'Canonical revision does not match authenticated inputs');
    }
    const animePath = targetPath(target);
    const normalizedWrites = await Promise.all(normalizedRecords.map((record) => writeNormalized(record)));
    const claimWrites = await Promise.all(claims.map((claim) => writeImmutableJson(
      workspace, ['claims', animePath, `${claim.claimId}.json`], claim,
    )));
    const revisionWrite = await writeImmutableJson(
      workspace, ['canonical', animePath, `${canonical.revision.contentHash}.json`], canonical,
    );
    if (updateCurrent) await writeCurrent(target, canonical.revision.contentHash);
    return Object.freeze({
      created: revisionWrite.created,
      contentHash: canonical.revision.contentHash,
      normalizedCreated: normalizedWrites.filter((row) => row.created).length,
      claimsCreated: claimWrites.filter((row) => row.created).length,
      path: revisionWrite.path,
    });
  }

  async function readCurrent(moemoaAnimeId) {
    await assertCatalogWorkspaceMutation(workspace, []);
    return readJson(workspace.resolve('current', `${toPathKey(moemoaAnimeId)}.json`));
  }

  async function readCanonical(target, contentHash) {
    await assertCatalogWorkspaceMutation(workspace, []);
    const animePath = targetPath(target);
    if (typeof contentHash !== 'string' || !/^[a-f0-9]{64}$/u.test(contentHash)) {
      throw typedError('CATALOG_ARTIFACT_INVALID', 'Canonical revision hash is invalid');
    }
    return readJson(workspace.resolve('canonical', animePath, `${contentHash}.json`));
  }

  async function readServiceProjection(target) {
    await assertCatalogWorkspaceMutation(workspace, []);
    return readJson(workspace.resolve('service-projections', `${targetPath(target)}.json`));
  }

  async function writeServiceProjection(target, projection) {
    const animePath = targetPath(target);
    if (!projection || typeof projection !== 'object' || projection.animeId !== target.moemoaAnimeId
      || projection.targetKey !== target.targetKey || typeof projection.projectionHash !== 'string'
      || !/^[a-f0-9]{64}$/u.test(projection.projectionHash)) {
      throw typedError('CATALOG_ARTIFACT_INVALID', 'Service projection identity is invalid');
    }
    const expected = snapshot(projection);
    const { projectionHash, ...core } = expected;
    if (sha256(core) !== projectionHash) {
      throw typedError('CATALOG_ARTIFACT_INVALID', 'Service projection integrity is invalid');
    }
    const path = await assertCatalogWorkspaceMutation(workspace, ['service-projections', `${animePath}.json`]);
    const prior = await readJson(path);
    await atomicWriteJson(path, expected);
    return Object.freeze({
      path,
      created: prior === null,
      changed: prior === null || stableStringify(prior) !== stableStringify(expected),
      projection: expected,
    });
  }

  async function writeCoverObservation(target, observation) {
    const animePath = targetPath(target);
    const path = await assertCatalogWorkspaceMutation(workspace, ['covers', `${animePath}.json`]);
    if (arguments.length === 1) return readJson(path);
    await atomicWriteJson(path, snapshot(observation));
    return Object.freeze({ path, observation: snapshot(observation) });
  }

  async function readRunSnapshot(profile = 'golden') {
    await assertCatalogWorkspaceMutation(workspace, []);
    return readJson(workspace.resolve('runs', toPathKey(profile), 'current.json'));
  }

  async function writeRunSnapshot(profile, snapshotValue) {
    const parts = ['runs', toPathKey(profile), 'current.json'];
    const path = await assertCatalogWorkspaceMutation(workspace, parts);
    await atomicWriteJson(path, snapshot(snapshotValue));
    return Object.freeze({ path });
  }

  async function readRebuildSnapshot(profile = 'golden') {
    await assertCatalogWorkspaceMutation(workspace, []);
    return readJson(workspace.resolve('runs', toPathKey(profile), 'rebuild-current.json'));
  }

  async function writeRebuildSnapshot(profile, snapshotValue) {
    const parts = ['runs', toPathKey(profile), 'rebuild-current.json'];
    const path = await assertCatalogWorkspaceMutation(workspace, parts);
    await atomicWriteJson(path, snapshot(snapshotValue));
    return Object.freeze({ path });
  }

  return Object.freeze({
    readIdMap, writeIdMap,
    readManifest, writeManifest,
    readAniLifeBindings, writeAniLifeBinding,
    readSourceRecord,
    writeNormalized,
    writeCanonical, readCanonical, readCurrent, writeCurrent,
    readServiceProjection, writeServiceProjection,
    writeCoverObservation,
    readRunSnapshot, writeRunSnapshot,
    readRebuildSnapshot, writeRebuildSnapshot,
  });
}
