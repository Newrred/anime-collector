import { readFile, writeFile } from 'node:fs/promises';

// Public catalog only. No administrator token, account table, or external provider.
const url = process.env.PUBLIC_CATALOG_SUPABASE_URL;
const key = process.env.PUBLIC_CATALOG_SUPABASE_ANON_KEY;
const baselinePath = new URL('../tools/catalog-lab/config/production-baseline.json', import.meta.url);
const args = process.argv.slice(2);
const failures = [];
const startedAt = new Date().toISOString();
let report;
async function read(path, options = {}) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options, headers: { apikey: key, 'Content-Type': 'application/json', ...options.headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`CATALOG_HTTP_${response.status}`);
  return response.json();
}
try {
  if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)
    || args.some((arg) => !['--snapshot'].includes(arg))) throw new Error('CONFIG_INVALID');
  const active = await read('catalog_active_release?select=release_id');
  if (active.length !== 1) throw new Error('ACTIVE_RELEASE_INVALID');
  const releaseId = active[0].release_id;
  const rows = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const page = await read(`catalog_anime_search?select=anime_id&release_id=eq.${encodeURIComponent(releaseId)}&order=anime_id&limit=1000&offset=${offset}`);
    rows.push(...page);
    if (page.length < 1000) break;
    if (offset === 19000) throw new Error('CATALOG_BOUND_EXCEEDED');
  }
  const animeIds = rows.map((row) => row.anime_id);
  if (!animeIds.length || new Set(animeIds).size !== animeIds.length) throw new Error('CATALOG_IDENTITIES_INVALID');
  let baseline;
  try { baseline = JSON.parse(await readFile(baselinePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT' || !args.includes('--snapshot')) throw error; }
  const current = new Set(animeIds);
  const missing = baseline?.animeIds.filter((id) => !current.has(id)) || [];
  if (missing.length) failures.push({ code: 'CATALOG_IDENTITIES_MISSING', count: missing.length });
  for (const [query, id] of [
    ['니세코이', 'anime:06115e96-7efa-404b-8233-6f92c8238818'],
    ['5등분', 'anime:e8700a7d-79bb-4bed-ab38-0ee029e12c10'],
  ]) {
    const result = await read('rpc/search_catalog_anime', { method: 'POST', body: JSON.stringify({ search_query: query, result_limit: 12 }) });
    if (!result.some((row) => row.anime_id === id)) failures.push({ code: 'SEASON_SEARCH_REGRESSION', animeId: id });
  }
  // Rotate a small bounded sample; this is health monitoring, not a full asset audit.
  const start = Math.floor(Date.now() / 86400000) * 12 % animeIds.length;
  let sampled = 0;
  for (let index = 0; index < Math.min(12, animeIds.length); index++) {
    const id = animeIds[(start + index) % animeIds.length];
    const filter = `release_id=eq.${encodeURIComponent(releaseId)}&anime_id=eq.${encodeURIComponent(id)}`;
    const [details, assets] = await Promise.all([
      read(`catalog_anime_details?select=anime_id&${filter}`),
      read(`catalog_assets?select=bucket_id,object_path&${filter}`),
    ]);
    if (details.length !== 1 || assets.length !== 1) { failures.push({ code: 'DETAIL_ASSET_MISSING', animeId: id }); continue; }
    const asset = assets[0];
    const response = await fetch(`${url}/storage/v1/object/public/${encodeURIComponent(asset.bucket_id)}/${asset.object_path.split('/').map(encodeURIComponent).join('/')}`, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) failures.push({ code: 'COVER_UNAVAILABLE', animeId: id });
    sampled++;
  }
  const latest = await read('catalog_active_release?select=release_id');
  if (latest[0]?.release_id !== releaseId) failures.push({ code: 'RELEASE_CHANGED_DURING_CHECK' });
  if (args.includes('--snapshot') && !failures.length) await writeFile(baselinePath, `${JSON.stringify({ releaseId, verifiedAt: new Date().toISOString(), animeIds }, null, 2)}\n`);
  report = { ok: failures.length === 0, releaseId, titleCount: animeIds.length, sampledCovers: sampled, failures };
  if (failures.length) process.exitCode = 1;
} catch (error) {
  // Never print headers, provider responses, or account data.
  const code = /^(?:CATALOG|ACTIVE|CONFIG)_[A-Z0-9_]+$/.test(error.message) ? error.message : 'CATALOG_HEALTH_FAILED';
  report = { ok: false, failures: [{ code }] };
  process.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({ ...report, startedAt, checkedAt: new Date().toISOString() }, null, 2)}\n`);
