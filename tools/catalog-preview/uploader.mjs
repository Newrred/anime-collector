import {
  readReleaseDbRows,
  readReleaseManifest,
  readValidatedCoverBytes,
  validateServiceProjectionV2Release,
} from './export-v2.mjs';

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export function createPreviewAdminHeaders(serviceKey) {
  const value = String(serviceKey ?? '').trim();
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/u.test(value)) return Object.freeze({ apikey: value });
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)) {
    return Object.freeze({ apikey: value, Authorization: `Bearer ${value}` });
  }
  throw typedError('CATALOG_PREVIEW_REMOTE_CONFIG_INVALID', 'A Supabase secret or legacy service-role key is required');
}

function previewConfig(env) {
  const environment = String(env.MOEMOA_SUPABASE_ENV ?? '').trim();
  const url = String(env.MOEMOA_SUPABASE_URL ?? '').trim().replace(/\/+$/u, '');
  const serviceKey = String(env.MOEMOA_SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const expectedRef = String(env.MOEMOA_SUPABASE_PREVIEW_PROJECT_REF ?? '').trim();
  const permission = String(env.MOEMOA_CATALOG_CLOUD_PERMISSION ?? '').trim();
  let actualRef = '';
  try {
    const parsed = new URL(url);
    const match = /^([a-z0-9-]+)\.supabase\.co$/u.exec(parsed.hostname);
    if (parsed.protocol === 'https:' && match) actualRef = match[1];
  } catch { /* handled below */ }
  if (environment !== 'preview' || !actualRef || !expectedRef || actualRef !== expectedRef || !serviceKey) {
    throw typedError('CATALOG_PREVIEW_REMOTE_CONFIG_INVALID', 'Exact Preview Supabase configuration is required');
  }
  if (permission !== 'approved_metadata_and_covers_preview') {
    throw typedError('CATALOG_PREVIEW_PERMISSION_REQUIRED', 'Cloud metadata and cover Preview permission gate is not approved');
  }
  return Object.freeze({ url, authHeaders: createPreviewAdminHeaders(serviceKey), projectRef: actualRef });
}

function headers(config, prefer = '') {
  return {
    ...config.authHeaders,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function request(config, path, { body, prefer, fetchImpl, retries = 3 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response;
    try {
      response = await fetchImpl(`${config.url}${path}`, {
        method: 'POST', headers: headers(config, prefer), body: JSON.stringify(body), signal: controller.signal,
      });
    } catch (error) {
      if (attempt >= retries) throw typedError('CATALOG_PREVIEW_UPLOAD_FAILED', 'Preview upload request failed');
      await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
      continue;
    } finally { clearTimeout(timeout); }
    if (response.ok) return;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= retries) {
      throw typedError('CATALOG_PREVIEW_UPLOAD_FAILED', `Preview upload was rejected (${response.status})`);
    }
    const retryAfter = Number(response.headers.get('retry-after'));
    await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter)
      ? Math.min(10_000, Math.max(500, retryAfter * 1000)) : 500 * (2 ** attempt)));
  }
}

async function upsert(config, table, rows, conflict, fetchImpl) {
  if (!rows.length) return;
  await request(config, `/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`, {
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
    fetchImpl,
  });
}

async function readRemoteHashes(config, table, select, releaseId, fetchImpl) {
  const rows = [];
  for (let offset = 0; offset < 10_000; offset += 1_000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response;
    try {
      response = await fetchImpl(`${config.url}/rest/v1/${table}?select=${encodeURIComponent(select)}&release_id=eq.${encodeURIComponent(releaseId)}`, {
        method: 'GET', headers: { ...config.authHeaders, Accept: 'application/json', Range: `${offset}-${offset + 999}`, 'Range-Unit': 'items' }, signal: controller.signal,
      });
    } catch {
      throw typedError('CATALOG_PREVIEW_RESUME_FAILED', 'Preview resume query failed');
    } finally { clearTimeout(timeout); }
    if (!response.ok) throw typedError('CATALOG_PREVIEW_RESUME_FAILED', `Preview resume query was rejected (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page) || page.length > 1_000) throw typedError('CATALOG_PREVIEW_RESUME_FAILED', 'Preview resume response is invalid');
    rows.push(...page);
    if (page.length < 1_000) return rows;
  }
  throw typedError('CATALOG_PREVIEW_RESUME_FAILED', 'Preview resume response exceeds the allowed boundary');
}

async function completedRemoteEntries(config, release, fetchImpl) {
  const [assets, search, details, people] = await Promise.all([
    readRemoteHashes(config, 'catalog_assets', 'anime_id,row_hash', release.releaseId, fetchImpl),
    readRemoteHashes(config, 'catalog_anime_search', 'anime_id,row_hash', release.releaseId, fetchImpl),
    readRemoteHashes(config, 'catalog_anime_details', 'anime_id,row_hash', release.releaseId, fetchImpl),
    readRemoteHashes(config, 'catalog_anime_people', 'anime_id,page,row_hash', release.releaseId, fetchImpl),
  ]);
  const assetHashes = new Map(assets.map((row) => [row.anime_id, row.row_hash]));
  const searchHashes = new Map(search.map((row) => [row.anime_id, row.row_hash]));
  const detailHashes = new Map(details.map((row) => [row.anime_id, row.row_hash]));
  const peopleHashes = new Map();
  for (const row of people) {
    const list = peopleHashes.get(row.anime_id) ?? [];
    list[row.page - 1] = row.row_hash;
    peopleHashes.set(row.anime_id, list);
  }
  return new Set(release.entries.flatMap((entry) => (
    assetHashes.get(entry.animeId) === entry.assetHash
      && searchHashes.get(entry.animeId) === entry.searchHash
      && detailHashes.get(entry.animeId) === entry.detailHash
      && JSON.stringify(peopleHashes.get(entry.animeId) ?? []) === JSON.stringify(entry.peopleHashes)
      ? [entry.animeId] : []
  )));
}

async function uploadCover(config, asset, bytes, fetchImpl) {
  const path = `/storage/v1/object/${asset.bucket_id}/${asset.object_path.split('/').map(encodeURIComponent).join('/')}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let response;
  try {
    response = await fetchImpl(`${config.url}${path}`, {
      method: 'POST',
      headers: {
        ...config.authHeaders,
        'Content-Type': asset.mime_type,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'false',
      },
      body: bytes,
      signal: controller.signal,
    });
  } catch {
    throw typedError('CATALOG_PREVIEW_COVER_UPLOAD_FAILED', 'Preview cover upload request failed');
  } finally { clearTimeout(timeout); }
  if (response.ok) return;
  if (response.status === 400 || response.status === 409) {
    const existing = await fetchImpl(`${config.url}/storage/v1/object/public/${asset.bucket_id}/${asset.object_path
      .split('/').map(encodeURIComponent).join('/')}`, { method: 'HEAD' });
    if (existing.ok && Number(existing.headers.get('content-length')) === asset.byte_size) return;
  }
  throw typedError('CATALOG_PREVIEW_COVER_UPLOAD_FAILED', `Preview cover upload was rejected (${response.status})`);
}

async function eachWithConcurrency(rows, concurrency, callback) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, async () => {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      await callback(rows[index]);
    }
  }));
}
/** Uploads a validated immutable release; disabled unless allowUpload and the rights/environment gates agree. */
export async function uploadCatalogPreview({
  workspace,
  profile = 'full3998',
  allowUpload = false,
  env = process.env,
  fetchImpl = globalThis.fetch,
  batchSize = 100,
  onProgress = () => {},
} = {}) {
  const validation = await validateServiceProjectionV2Release({ workspace, profile });
  const release = await readReleaseManifest({ workspace, profile });
  if (!allowUpload) return Object.freeze({ ...validation, mode: 'DRY_RUN', uploaded: false });
  if (typeof fetchImpl !== 'function' || typeof onProgress !== 'function'
    || !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw typedError('CATALOG_PREVIEW_UPLOAD_CONFIG_INVALID', 'Uploader configuration is invalid');
  }
  const config = previewConfig(env);
  await upsert(config, 'catalog_releases', [{
    id: release.releaseId,
    profile: release.profile,
    schema_version: release.schemaVersion,
    policy_version: release.policyVersion,
    release_hash: release.releaseHash,
    target_count: release.targetCount,
    people_page_count: release.peoplePageCount,
    status: 'STAGING',
  }], 'id', fetchImpl);

  const completed = await completedRemoteEntries(config, release, fetchImpl);
  const pendingEntries = release.entries.filter((entry) => !completed.has(entry.animeId));
  const existingPeople = release.entries.filter((entry) => completed.has(entry.animeId))
    .reduce((sum, entry) => sum + entry.peopleHashes.length, 0);
  const counts = {
    assets: completed.size, coverObjects: completed.size, search: completed.size,
    details: completed.size, people: existingPeople,
  };
  if (completed.size) onProgress(Object.freeze({ completed: completed.size, total: release.entries.length }));
  for (let index = 0; index < pendingEntries.length; index += batchSize) {
    const slice = pendingEntries.slice(index, index + batchSize);
    const bundles = await Promise.all(slice.map((entry) => readReleaseDbRows({
      workspace, releaseId: release.releaseId, entry,
    })));
    const assets = bundles.map((row) => row.asset);
    const search = bundles.map((row) => row.search);
    const details = bundles.map((row) => row.detail);
    const people = bundles.flatMap((row) => row.people);
    await eachWithConcurrency(bundles, 6, async (row) => {
      const bytes = await readValidatedCoverBytes({
        workspace, animeId: row.asset.anime_id, asset: {
          animeId: row.asset.anime_id, checksum: row.asset.checksum,
          byteSize: row.asset.byte_size, width: row.asset.width, height: row.asset.height,
          mimeType: row.asset.mime_type, objectPath: row.asset.object_path,
        },
      });
      await uploadCover(config, row.asset, bytes, fetchImpl);
      counts.coverObjects += 1;
    });
    await upsert(config, 'catalog_assets', assets, 'release_id,asset_id', fetchImpl);
    await upsert(config, 'catalog_anime_search', search, 'release_id,anime_id', fetchImpl);
    await upsert(config, 'catalog_anime_details', details, 'release_id,anime_id', fetchImpl);
    await upsert(config, 'catalog_anime_people', people, 'release_id,anime_id,page', fetchImpl);
    counts.assets += assets.length;
    counts.search += search.length;
    counts.details += details.length;
    counts.people += people.length;
    onProgress(Object.freeze({ completed: Math.min(completed.size + index + slice.length, release.entries.length), total: release.entries.length }));
  }
  await request(config, '/rest/v1/rpc/activate_catalog_release', {
    body: { requested_release_id: release.releaseId, requested_release_hash: release.releaseHash },
    fetchImpl,
  });
  return Object.freeze({
    ...validation,
    mode: 'UPLOAD',
    uploaded: true,
    projectRef: config.projectRef,
    counts: Object.freeze(counts),
  });
}
