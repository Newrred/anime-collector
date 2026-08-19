import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { atomicWriteJson } from '../catalog-lab/lib/atomic-json.mjs';
import { sha256, stableStringify } from '../catalog-lab/lib/hash.mjs';
import { toPathKey } from '../catalog-lab/lib/path-key.mjs';
import { assertCatalogWorkspaceMutation } from '../catalog-lab/lib/workspace.mjs';
import {
  SERVICE_PROJECTION_V2_POLICY_VERSION,
  SERVICE_PROJECTION_V2_SCHEMA_VERSION,
  buildServiceProjectionV2,
  validateServiceProjectionV2Bundle,
} from '../catalog-lab/pipeline/service-projection-v2.mjs';

const HASH = /^[a-f0-9]{64}$/u;

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function readJson(path, maximumBytes = 8 * 1024 * 1024) {
  const bytes = await readFile(path);
  if (bytes.byteLength < 2 || bytes.byteLength > maximumBytes) {
    throw typedError('CATALOG_PREVIEW_ARTIFACT_INVALID', 'Artifact size is outside the allowed boundary');
  }
  try { return JSON.parse(bytes.toString('utf8')); } catch {
    throw typedError('CATALOG_PREVIEW_ARTIFACT_INVALID', 'Artifact JSON is invalid');
  }
}

async function safePath(workspace, parts) {
  return assertCatalogWorkspaceMutation(workspace, parts);
}

async function writeDeterministicJson(workspace, parts, value) {
  const path = await safePath(workspace, parts);
  await mkdir(dirname(path), { recursive: true });
  let existing = null;
  try { existing = await readJson(path, 16 * 1024 * 1024); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing !== null) {
    if (stableStringify(existing) !== stableStringify(value)) {
      throw typedError('CATALOG_PREVIEW_ARTIFACT_COLLISION', 'Existing release artifact differs');
    }
    return path;
  }
  await atomicWriteJson(path, value);
  return path;
}

function manifestTargets(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10_000) {
    throw typedError('CATALOG_PREVIEW_MANIFEST_INVALID', 'Target manifest is invalid');
  }
  const animeIds = new Set();
  const targetKeys = new Set();
  return value.map((row) => {
    if (typeof row?.targetKey !== 'string' || typeof row?.moemoaAnimeId !== 'string'
      || animeIds.has(row.moemoaAnimeId) || targetKeys.has(row.targetKey)) {
      throw typedError('CATALOG_PREVIEW_MANIFEST_INVALID', 'Target identities must be unique');
    }
    animeIds.add(row.moemoaAnimeId);
    targetKeys.add(row.targetKey);
    return row;
  });
}

async function loadTargetInputs(workspace, target) {
  const key = toPathKey(target.moemoaAnimeId);
  const current = await readJson(await safePath(workspace, ['current', `${key}.json`]), 16 * 1024);
  if (current?.animeId !== target.moemoaAnimeId || !HASH.test(current?.contentHash ?? '')) {
    throw typedError('CATALOG_PREVIEW_CURRENT_INVALID', 'Canonical current pointer is invalid');
  }
  const canonical = await readJson(
    await safePath(workspace, ['canonical', key, `${current.contentHash}.json`]), 4 * 1024 * 1024,
  );
  const serviceProjection = await readJson(
    await safePath(workspace, ['service-projections', `${key}.json`]), 512 * 1024,
  );
  return { key, current, canonical, serviceProjection };
}

export function buildCatalogDbRows(releaseId, bundle) {
  if (typeof releaseId !== 'string' || !releaseId || !validateServiceProjectionV2Bundle(bundle)) {
    throw typedError('CATALOG_PREVIEW_BUNDLE_INVALID', 'Validated v2 bundle is required');
  }
  const search = bundle.search;
  const searchText = [search.preferredTitle, ...search.searchAliases.map((row) => row.value)]
    .join(' ').normalize('NFKC').toLocaleLowerCase('und');
  return Object.freeze({
    asset: Object.freeze({
      release_id: releaseId, asset_id: bundle.asset.assetId, anime_id: bundle.animeId,
      kind: bundle.asset.kind, availability: bundle.asset.availability,
      rights_basis: bundle.asset.rightsBasis, row_hash: bundle.asset.rowHash,
    }),
    search: Object.freeze({
      release_id: releaseId, anime_id: bundle.animeId,
      anilist_id: search.anilistId === null ? null : Number(search.anilistId),
      preferred_title: search.preferredTitle, preferred_locale: search.preferredLocale,
      search_aliases: search.searchAliases, search_text: searchText,
      format: search.format, status: search.status, episode_count: search.episodeCount,
      source_material_type: search.sourceMaterialType, release_year: search.releaseYear,
      season: search.season, studios: search.studios, genres: search.genres,
      readiness: search.readiness, cover_asset_id: search.coverAssetId, row_hash: search.rowHash,
    }),
    detail: Object.freeze({
      release_id: releaseId, anime_id: bundle.animeId,
      payload: bundle.detail, row_hash: bundle.detail.rowHash,
    }),
    people: Object.freeze(bundle.people.map((page) => Object.freeze({
      release_id: releaseId, anime_id: bundle.animeId, page: page.page,
      payload: page, row_hash: page.rowHash,
    }))),
  });
}

/** Builds an immutable release under the external TEST_ONLY workspace without network access. */
export async function exportServiceProjectionV2({ workspace, profile = 'full3998', peoplePageSize = 30 } = {}) {
  if (!workspace || !/^[a-z0-9]+$/u.test(profile)) {
    throw typedError('CATALOG_PREVIEW_CONFIG_INVALID', 'Workspace and profile are required');
  }
  const manifest = manifestTargets(await readJson(
    await safePath(workspace, ['manifests', `${profile}.json`]), 8 * 1024 * 1024,
  ));
  const descriptors = [];
  for (const target of manifest) {
    const input = await loadTargetInputs(workspace, target);
    descriptors.push({
      animeId: target.moemoaAnimeId,
      targetKey: target.targetKey,
      canonicalHash: input.current.contentHash,
      projectionHash: input.serviceProjection.projectionHash,
    });
  }
  const releaseHash = sha256({
    profile,
    schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
    policyVersion: SERVICE_PROJECTION_V2_POLICY_VERSION,
    descriptors,
  });
  const releaseId = `catalog-v2-${releaseHash.slice(0, 24)}`;
  const base = ['service-projections-v2', 'releases', releaseId];
  const entries = [];
  let peoplePageCount = 0;

  for (let index = 0; index < manifest.length; index += 1) {
    const target = manifest[index];
    const input = await loadTargetInputs(workspace, target);
    const bundle = buildServiceProjectionV2({ target, ...input, peoplePageSize });
    const db = buildCatalogDbRows(releaseId, bundle);
    const key = input.key;
    await writeDeterministicJson(workspace, [...base, 'search', `${key}.json`], bundle.search);
    await writeDeterministicJson(workspace, [...base, 'details', `${key}.json`], bundle.detail);
    await writeDeterministicJson(workspace, [...base, 'assets', `${key}.json`], bundle.asset);
    await writeDeterministicJson(workspace, [...base, 'db', `${key}.json`], db);
    for (const page of bundle.people) {
      await writeDeterministicJson(
        workspace,
        [...base, 'people', key, `page-${String(page.page).padStart(3, '0')}.json`],
        page,
      );
    }
    peoplePageCount += bundle.people.length;
    entries.push({
      animeId: bundle.animeId,
      key,
      searchHash: bundle.search.rowHash,
      detailHash: bundle.detail.rowHash,
      assetHash: bundle.asset.rowHash,
      peopleHashes: bundle.people.map((page) => page.rowHash),
      bundleHash: bundle.bundleHash,
    });
  }

  const releaseCore = {
    schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
    policyVersion: SERVICE_PROJECTION_V2_POLICY_VERSION,
    releaseId,
    releaseHash,
    profile,
    targetCount: manifest.length,
    peoplePageCount,
    entries,
  };
  const release = { ...releaseCore, manifestHash: sha256(releaseCore) };
  await writeDeterministicJson(workspace, [...base, 'release.json'], release);
  await atomicWriteJson(
    await safePath(workspace, ['service-projections-v2', `current-${profile}.json`]),
    { releaseId, releaseHash, manifestHash: release.manifestHash },
  );
  return Object.freeze({ releaseId, releaseHash, targetCount: manifest.length, peoplePageCount });
}

export async function validateServiceProjectionV2Release({ workspace, profile = 'full3998' } = {}) {
  const pointer = await readJson(
    await safePath(workspace, ['service-projections-v2', `current-${profile}.json`]), 16 * 1024,
  );
  if (typeof pointer?.releaseId !== 'string' || !HASH.test(pointer?.releaseHash ?? '')
    || !HASH.test(pointer?.manifestHash ?? '')) {
    throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'Release pointer is invalid');
  }
  const base = ['service-projections-v2', 'releases', pointer.releaseId];
  const release = await readJson(await safePath(workspace, [...base, 'release.json']), 8 * 1024 * 1024);
  const { manifestHash, ...core } = release;
  if (sha256(core) !== manifestHash || manifestHash !== pointer.manifestHash
    || release.releaseId !== pointer.releaseId || release.releaseHash !== pointer.releaseHash
    || release.targetCount !== release.entries?.length) {
    throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'Release manifest integrity is invalid');
  }
  let peoplePageCount = 0;
  const animeIds = new Set();
  for (const entry of release.entries) {
    if (animeIds.has(entry.animeId)) throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'Duplicate anime identity');
    animeIds.add(entry.animeId);
    const search = await readJson(await safePath(workspace, [...base, 'search', `${entry.key}.json`]), 512 * 1024);
    const detail = await readJson(await safePath(workspace, [...base, 'details', `${entry.key}.json`]), 2 * 1024 * 1024);
    const asset = await readJson(await safePath(workspace, [...base, 'assets', `${entry.key}.json`]), 64 * 1024);
    const db = await readJson(await safePath(workspace, [...base, 'db', `${entry.key}.json`]), 3 * 1024 * 1024);
    if (search.rowHash !== entry.searchHash || detail.rowHash !== entry.detailHash
      || asset.rowHash !== entry.assetHash || search.animeId !== entry.animeId
      || detail.animeId !== entry.animeId || asset.animeId !== entry.animeId
      || db.search.row_hash !== search.rowHash || db.detail.row_hash !== detail.rowHash
      || db.asset.row_hash !== asset.rowHash || db.people.length !== entry.peopleHashes.length) {
      throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'Release row binding is invalid');
    }
    const people = [];
    for (let index = 0; index < entry.peopleHashes.length; index += 1) {
      const page = await readJson(await safePath(workspace, [
        ...base, 'people', entry.key, `page-${String(index + 1).padStart(3, '0')}.json`,
      ]), 2 * 1024 * 1024);
      if (page.rowHash !== entry.peopleHashes[index] || db.people[index]?.row_hash !== page.rowHash) {
        throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'People page binding is invalid');
      }
      people.push(page);
    }
    const bundle = {
      schemaVersion: SERVICE_PROJECTION_V2_SCHEMA_VERSION,
      animeId: entry.animeId,
      search,
      detail,
      people,
      asset,
      bundleHash: entry.bundleHash,
    };
    if (!validateServiceProjectionV2Bundle(bundle)
      || stableStringify(buildCatalogDbRows(release.releaseId, bundle)) !== stableStringify(db)) {
      throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'Release bundle or database rows are invalid');
    }
    peoplePageCount += entry.peopleHashes.length;
  }
  if (peoplePageCount !== release.peoplePageCount) {
    throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'People page count is invalid');
  }
  return Object.freeze({
    releaseId: release.releaseId,
    releaseHash: release.releaseHash,
    targetCount: release.targetCount,
    peoplePageCount,
  });
}

export async function readReleaseDbRows({ workspace, releaseId, entry } = {}) {
  if (typeof releaseId !== 'string' || !entry?.key) throw typedError('CATALOG_PREVIEW_RELEASE_INVALID', 'Release entry is invalid');
  return readJson(await safePath(workspace, [
    'service-projections-v2', 'releases', releaseId, 'db', `${entry.key}.json`,
  ]), 3 * 1024 * 1024);
}

export async function readReleaseManifest({ workspace, profile = 'full3998' } = {}) {
  const pointer = await readJson(await safePath(workspace, [
    'service-projections-v2', `current-${profile}.json`,
  ]), 16 * 1024);
  return readJson(await safePath(workspace, [
    'service-projections-v2', 'releases', pointer.releaseId, 'release.json',
  ]), 8 * 1024 * 1024);
}
