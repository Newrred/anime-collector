import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';

import { sha256 } from '../catalog-lab/lib/hash.mjs';
import { toPathKey } from '../catalog-lab/lib/path-key.mjs';
import { assertCatalogWorkspaceMutation } from '../catalog-lab/lib/workspace.mjs';
import { inspectImageBytes } from '../catalog-lab/pipeline/covers.mjs';

const MAX_PROJECTION_BYTES = 256 * 1024;
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ANILIST_TARGET = /^ANILIST:([1-9]\d{0,11})$/u;
const HASH = /^[a-f0-9]{64}$/u;
const COVER_REF = /^images\/covers\/([a-z0-9-]+)\/([a-f0-9]{64})\.(jpg|png|webp)$/u;
const PROJECTION_KEYS = Object.freeze([
  'animeId', 'autoAcceptedTitleAliases', 'canonicalHash', 'fieldTiers', 'officialLinks',
  'policyVersion', 'preferredTitle', 'primaryOfficialSiteUrl', 'projectionHash',
  'qualityWarnings', 'quarantinedTitles', 'readiness', 'reviewItems', 'schemaVersion',
  'searchTitles', 'semanticAutomationPolicyVersion', 'targetKey',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function normalizedText(value, maxLength = 240) {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return text && [...text].length <= maxLength ? text : null;
}

function normalizedSearchText(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase('und')
    .replace(/[\p{P}\p{S}\p{Z}]+/gu, '');
}

function validatedTitle(value) {
  if (!hasExactKeys(value, ['locale', 'value'])) return null;
  const locale = normalizedText(value.locale, 20);
  const title = normalizedText(value.value);
  return locale && title ? Object.freeze({ locale, value: title }) : null;
}

async function readBoundedJson(workspace, parts, maxBytes) {
  try {
    const path = await assertCatalogWorkspaceMutation(workspace, parts);
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > maxBytes) return null;
    const bytes = await readFile(path);
    if (bytes.byteLength !== info.size || bytes.byteLength > maxBytes) return null;
    const parsed = JSON.parse(bytes.toString('utf8'));
    return { parsed, info };
  } catch {
    return null;
  }
}

function validatedManifest(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10_000) return null;
  const targets = [];
  const keys = new Set();
  const animeIds = new Set();
  for (const row of value) {
    const targetMatch = typeof row?.targetKey === 'string' ? ANILIST_TARGET.exec(row.targetKey) : null;
    if (!targetMatch || typeof row?.moemoaAnimeId !== 'string' || !ANIME_ID.test(row.moemoaAnimeId)
      || keys.has(row.targetKey) || animeIds.has(row.moemoaAnimeId)) return null;
    keys.add(row.targetKey);
    animeIds.add(row.moemoaAnimeId);
    targets.push(Object.freeze({
      targetKey: row.targetKey,
      animeId: row.moemoaAnimeId,
      externalId: targetMatch[1],
      fileName: `${toPathKey(row.moemoaAnimeId)}.json`,
    }));
  }
  return Object.freeze(targets);
}

function validatedProjection(value, target) {
  if (!hasExactKeys(value, PROJECTION_KEYS) || value.schemaVersion !== 1
    || typeof value.policyVersion !== 'string' || !value.policyVersion
    || typeof value.semanticAutomationPolicyVersion !== 'string' || !value.semanticAutomationPolicyVersion
    || value.targetKey !== target.targetKey || value.animeId !== target.animeId
    || !HASH.test(value.canonicalHash ?? '') || !HASH.test(value.projectionHash ?? '')) return null;
  const { projectionHash, ...core } = value;
  if (sha256(core) !== projectionHash) return null;

  const preferredTitle = validatedTitle(value.preferredTitle);
  if (!preferredTitle || !Array.isArray(value.searchTitles) || value.searchTitles.length < 1
    || value.searchTitles.length > 128) return null;
  const searchTitles = value.searchTitles.map(validatedTitle);
  if (searchTitles.some((title) => title === null)) return null;
  const readiness = value.readiness?.status;
  if (!['BLOCKED', 'READY_WITH_REVIEW', 'READY_WITH_GAPS', 'READY'].includes(readiness)) return null;

  const seen = new Set([preferredTitle.value.toLocaleLowerCase('und')]);
  const aliases = [];
  for (const title of searchTitles) {
    const key = title.value.toLocaleLowerCase('und');
    if (seen.has(key)) continue;
    seen.add(key);
    if (aliases.length < 24) aliases.push(title.value);
  }
  const searchableTitles = [preferredTitle.value, ...searchTitles.map((title) => title.value)];
  return Object.freeze({
    candidate: Object.freeze({
      kind: 'ANIME_REF',
      displayTitle: preferredTitle.value,
      aliases: Object.freeze(aliases),
      genres: Object.freeze([]),
      sourceBinding: Object.freeze({ provider: 'ANILIST', externalId: target.externalId }),
      verificationState: 'PROVIDER_CANDIDATE',
      catalogSource: 'LOCAL_TEST_SERVICE_PROJECTION',
      readiness,
    }),
    searchableTitles: Object.freeze(searchableTitles),
  });
}

function projectionScore(searchableTitles, query) {
  let score = 0;
  for (const title of searchableTitles) {
    const normalized = normalizedSearchText(title);
    if (normalized === query) score = Math.max(score, 3);
    else if (normalized.startsWith(query)) score = Math.max(score, 2);
    else if (normalized.includes(query)) score = Math.max(score, 1);
  }
  return score;
}

function validCoverObservation(value, target) {
  if (!isPlainObject(value) || value.status !== 'STORED' || !HASH.test(value.checksum ?? '')
    || !HASH.test(value.sourceRecordId ?? '') || typeof value.sourceId !== 'string'
    || !Number.isSafeInteger(value.byteSize) || value.byteSize < 1 || value.byteSize > MAX_COVER_BYTES
    || !Number.isSafeInteger(value.width) || value.width < 1 || value.width > 4096
    || !Number.isSafeInteger(value.height) || value.height < 1 || value.height > 4096
    || value.width * value.height > 12_000_000 || typeof value.created !== 'boolean') return null;
  const refMatch = typeof value.localRef === 'string' ? COVER_REF.exec(value.localRef) : null;
  if (!refMatch || refMatch[1] !== toPathKey(target.animeId) || refMatch[2] !== value.checksum) return null;
  return Object.freeze({
    ...value,
    parts: Object.freeze(value.localRef.split('/')),
    extension: refMatch[3],
    target,
  });
}

/**
 * Builds a bounded, read-only development view over the branded external TEST_ONLY catalog.
 * Source records, URLs, hashes, local paths, and mutable workspace handles never enter its DTOs.
 */
export function createDevelopmentCatalogReadModel({
  workspace,
  profile = 'full3998',
  refreshTtlMs = 2_000,
  now = Date.now,
} = {}) {
  if (!workspace || typeof workspace.resolve !== 'function' || typeof profile !== 'string'
    || !/^[a-z0-9]+$/u.test(profile) || !Number.isSafeInteger(refreshTtlMs) || refreshTtlMs < 0
    || typeof now !== 'function') throw new TypeError('Development catalog reader configuration is invalid');

  let targets = null;
  let targetByFile = null;
  let targetByExternalId = null;
  let fileCache = new Map();
  let indexed = [];
  let refreshedAt = Number.NEGATIVE_INFINITY;
  let refreshPromise = null;

  async function loadTargets() {
    if (targets) return targets;
    const manifest = await readBoundedJson(workspace, ['manifests', `${profile}.json`], 4 * 1024 * 1024);
    targets = validatedManifest(manifest?.parsed);
    if (!targets) throw new Error('Development catalog manifest is unavailable');
    targetByFile = new Map(targets.map((target) => [target.fileName, target]));
    targetByExternalId = new Map(targets.map((target) => [target.externalId, target]));
    return targets;
  }

  async function performRefresh() {
    await loadTargets();
    const directoryPath = await assertCatalogWorkspaceMutation(workspace, ['service-projections']);
    const directoryInfo = await lstat(directoryPath).catch(() => null);
    if (!directoryInfo?.isDirectory() || directoryInfo.isSymbolicLink()) {
      fileCache = new Map();
      indexed = [];
      return;
    }
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const nextCache = new Map();
    for (const entry of entries) {
      const target = targetByFile.get(entry.name);
      if (!target || !entry.isFile() || entry.isSymbolicLink()) continue;
      const path = workspace.resolve('service-projections', entry.name);
      const info = await lstat(path).catch(() => null);
      if (!info?.isFile() || info.isSymbolicLink() || info.size > MAX_PROJECTION_BYTES) continue;
      const fingerprint = `${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
      const prior = fileCache.get(entry.name);
      if (prior?.fingerprint === fingerprint) {
        nextCache.set(entry.name, prior);
        continue;
      }
      const artifact = await readBoundedJson(workspace, ['service-projections', entry.name], MAX_PROJECTION_BYTES);
      nextCache.set(entry.name, Object.freeze({
        fingerprint,
        projection: validatedProjection(artifact?.parsed, target),
      }));
    }
    fileCache = nextCache;
    indexed = [...fileCache.entries()].flatMap(([fileName, cached]) => {
      if (!cached.projection) return [];
      return [{ ...cached.projection, target: targetByFile.get(fileName) }];
    });
  }

  async function refresh() {
    const currentTime = now();
    if (currentTime - refreshedAt < refreshTtlMs) return;
    if (!refreshPromise) {
      refreshPromise = performRefresh()
        .then(() => { refreshedAt = now(); })
        .finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
  }

  async function readObservation(target) {
    const artifact = await readBoundedJson(
      workspace, ['covers', `${toPathKey(target.animeId)}.json`], 32 * 1024,
    );
    return validCoverObservation(artifact?.parsed, target);
  }

  async function search(query, { limit = 8 } = {}) {
    const normalizedQuery = normalizedSearchText(query);
    if ([...normalizedQuery].length < 2) return [];
    const safeLimit = Math.max(1, Math.min(12, Number(limit) || 8));
    await refresh();
    const matched = indexed.flatMap((row) => {
      const score = projectionScore(row.searchableTitles, normalizedQuery);
      return score ? [{ row, score }] : [];
    }).sort((left, right) => right.score - left.score
      || Number(left.row.target.externalId) - Number(right.row.target.externalId))
      .slice(0, safeLimit);
    return Promise.all(matched.map(async ({ row }) => {
      const observation = await readObservation(row.target);
      return structuredClone({
        ...row.candidate,
        coverPreviewUrl: observation
          ? `/__moemoa-dev/catalog/cover/${row.target.externalId}` : null,
      });
    }));
  }

  async function readCover(anilistId) {
    if (!/^[1-9]\d{0,11}$/u.test(String(anilistId))) return null;
    await refresh();
    const target = targetByExternalId.get(String(anilistId));
    if (!target || !indexed.some((row) => row.target === target)) return null;
    const observation = await readObservation(target);
    if (!observation) return null;
    try {
      const imagePath = await assertCatalogWorkspaceMutation(workspace, observation.parts);
      const info = await lstat(imagePath);
      if (!info.isFile() || info.isSymbolicLink() || info.size !== observation.byteSize
        || info.size > MAX_COVER_BYTES) return null;
      const bytes = await readFile(imagePath);
      if (bytes.byteLength !== observation.byteSize
        || createHash('sha256').update(bytes).digest('hex') !== observation.checksum) return null;
      const inspected = inspectImageBytes({ bytes });
      if (inspected.byteSize !== observation.byteSize || inspected.width !== observation.width
        || inspected.height !== observation.height || inspected.extension !== observation.extension) return null;
      return Object.freeze({ bytes: new Uint8Array(bytes), mimeType: inspected.mimeType });
    } catch {
      return null;
    }
  }

  return Object.freeze({ search, readCover });
}
