import { readReleaseDbRows, readReleaseManifest, validateServiceProjectionV2Release } from './export-v2.mjs';

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
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
  if (permission !== 'approved_metadata_only') {
    throw typedError('CATALOG_PREVIEW_PERMISSION_REQUIRED', 'Cloud metadata permission gate is not approved');
  }
  return Object.freeze({ url, serviceKey, projectRef: actualRef });
}

function headers(config, prefer = '') {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
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
/** Uploads a validated immutable release; disabled unless allowUpload and the rights/environment gates agree. */
export async function uploadCatalogPreview({
  workspace,
  profile = 'full3998',
  allowUpload = false,
  env = process.env,
  fetchImpl = globalThis.fetch,
  batchSize = 100,
} = {}) {
  const validation = await validateServiceProjectionV2Release({ workspace, profile });
  const release = await readReleaseManifest({ workspace, profile });
  if (!allowUpload) return Object.freeze({ ...validation, mode: 'DRY_RUN', uploaded: false });
  if (typeof fetchImpl !== 'function' || !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) {
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

  const counts = { assets: 0, search: 0, details: 0, people: 0 };
  for (let index = 0; index < release.entries.length; index += batchSize) {
    const slice = release.entries.slice(index, index + batchSize);
    const bundles = await Promise.all(slice.map((entry) => readReleaseDbRows({
      workspace, releaseId: release.releaseId, entry,
    })));
    const assets = bundles.map((row) => row.asset);
    const search = bundles.map((row) => row.search);
    const details = bundles.map((row) => row.detail);
    const people = bundles.flatMap((row) => row.people);
    await upsert(config, 'catalog_assets', assets, 'release_id,asset_id', fetchImpl);
    await upsert(config, 'catalog_anime_search', search, 'release_id,anime_id', fetchImpl);
    await upsert(config, 'catalog_anime_details', details, 'release_id,anime_id', fetchImpl);
    await upsert(config, 'catalog_anime_people', people, 'release_id,anime_id,page', fetchImpl);
    counts.assets += assets.length;
    counts.search += search.length;
    counts.details += details.length;
    counts.people += people.length;
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
