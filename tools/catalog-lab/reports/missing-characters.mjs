import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../lib/hash.mjs';
import { createHttpClient } from '../lib/http.mjs';
import { createAniListTestAdapter } from '../sources/anilist-test.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const outputRoot = resolve(process.env.MOEMOA_CHARACTER_AUDIT_DIR || resolve(repoRoot, '..', '.moemoa-character-audit-2026-10-08'));
const relativeOutput = relative(repoRoot, outputRoot);
if (!relativeOutput || (!relativeOutput.startsWith('..') && !isAbsolute(relativeOutput))) {
  throw new Error('Character audit must stay outside the repository');
}
const env = Object.fromEntries((await readFile(resolve(repoRoot, '.env.production'), 'utf8')).split(/\r?\n/u)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/u.test(line)).map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
  }));
const base = env.PUBLIC_CATALOG_SUPABASE_URL?.replace(/\/+$/u, '');
const key = env.PUBLIC_CATALOG_SUPABASE_ANON_KEY;
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/u.test(base) || !key) throw new Error('Catalog read configuration is unavailable');
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function readRows(table, select, filter = '') {
  const result = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(`${base}/rest/v1/${table}?select=${select}${filter}`, {
      headers: { ...headers, Range: `${offset}-${offset + 999}` }, signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Catalog ${table} read failed: ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid catalog response');
    result.push(...rows);
    if (rows.length < 1000) return result;
  }
}

async function snapshot() {
  const [titles, firstPages, details] = await Promise.all([
    readRows('catalog_anime_search', 'anime_id,anilist_id,preferred_title'),
    readRows('catalog_anime_people', 'anime_id', '&page=eq.1'),
    readRows('catalog_anime_details', 'anime_id,payload'),
  ]);
  const withPeople = new Set(firstPages.map((row) => row.anime_id));
  const detailsById = new Map(details.map((row) => [row.anime_id, row.payload]));
  const bindings = new Map();
  for (const row of titles) {
    if (!Number.isSafeInteger(row.anilist_id)) continue;
    const list = bindings.get(row.anilist_id) ?? [];
    list.push(row.anime_id); bindings.set(row.anilist_id, list);
  }
  const missing = titles.filter((row) => !withPeople.has(row.anime_id)).map((row) => {
    const detail = detailsById.get(row.anime_id);
    const detailBinding = detail?.externalIds?.find((entry) => entry.provider?.toLowerCase() === 'anilist')?.externalId;
    const eligible = Number.isSafeInteger(row.anilist_id) && row.anilist_id > 0
      && String(row.anilist_id) === String(detailBinding) && bindings.get(row.anilist_id)?.length === 1;
    return {
      animeId: row.anime_id, anilistId: row.anilist_id, title: row.preferred_title,
      status: eligible ? 'BOUND_UNIQUE' : row.anilist_id == null ? 'BINDING_REQUIRED' : 'BINDING_CONFLICT',
    };
  });
  return {
    source: 'anonymous-active-catalog', checkedAt: new Date().toISOString(),
    counts: { titles: titles.length, withPeople: withPeople.size, missing: missing.length,
      boundUnique: missing.filter((row) => row.status === 'BOUND_UNIQUE').length,
      bindingRequired: missing.filter((row) => row.status === 'BINDING_REQUIRED').length,
      bindingConflict: missing.filter((row) => row.status === 'BINDING_CONFLICT').length },
    missing,
  };
}

await mkdir(outputRoot, { recursive: true });
const result = await snapshot();
await writeFile(resolve(outputRoot, 'missing-characters.json'), `${JSON.stringify(result, null, 2)}\n`, { flag: 'w' });
console.log(JSON.stringify({ output: resolve(outputRoot, 'missing-characters.json'), counts: result.counts }, null, 2));

if (process.argv.includes('--collect')) {
  if (!process.argv.includes('--allow-network')) throw new Error('Collection requires --allow-network');
  const limitIndex = process.argv.indexOf('--limit');
  const limit = limitIndex < 0 ? result.counts.boundUnique : Number(process.argv[limitIndex + 1]);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > result.counts.boundUnique) throw new Error('Invalid collection limit');
  const sourceRows = result.missing.filter((row) => row.status === 'BOUND_UNIQUE').slice(0, limit);
  const sourceDirectory = resolve(outputRoot, 'source-records');
  await mkdir(sourceDirectory, { recursive: true });
  let lastRequest = 0;
  const baseHttp = createHttpClient();
  const http = { request: async (input) => {
    const spacing = 2500 + Math.floor(Math.random() * 501);
    const wait = Math.max(0, lastRequest + spacing - Date.now());
    if (wait) await new Promise((done) => setTimeout(done, wait));
    lastRequest = Date.now();
    return baseHttp.request(input);
  } };
  const adapter = createAniListTestAdapter();
  let completed = 0, fetched = 0, characters = 0;
  for (const row of sourceRows) {
    const file = resolve(sourceDirectory, `${row.animeId.replace(':', '-')}.json`);
    let existing = null;
    try { existing = JSON.parse(await readFile(file, 'utf8')); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (existing) {
      const { contentHash, ...core } = existing;
      if (core.animeId !== row.animeId || core.anilistId !== row.anilistId || sha256(core) !== contentHash) {
        throw new Error(`Stored source identity/hash differs for ${row.animeId}`);
      }
      completed += 1; characters += core.envelope.payload.characters.length;
      continue;
    }
    const target = { targetKey: `ANILIST:${row.anilistId}`, moemoaAnimeId: row.animeId,
      seedExternalIds: [{ sourceId: 'anilist', value: String(row.anilistId) }] };
    let envelope;
    for await (const entry of adapter.collect({ targets: [target], http, clock: { now: () => new Date().toISOString() } })) {
      envelope = entry;
    }
    if (Number(envelope?.sourceEntityId) !== row.anilistId || envelope?.payload?.id !== row.anilistId
      || !Array.isArray(envelope.payload.characters)) throw new Error(`Source identity mismatch for ${row.animeId}`);
    const core = { animeId: row.animeId, anilistId: row.anilistId, titleSnapshot: row.title, envelope };
    await writeFile(file, `${JSON.stringify({ ...core, contentHash: sha256(core) }, null, 2)}\n`, { flag: 'wx' });
    completed += 1; fetched += 1; characters += envelope.payload.characters.length;
    if (completed % 10 === 0 || completed === sourceRows.length) {
      console.log(JSON.stringify({ completed, targetCount: sourceRows.length, fetched, characters }));
    }
    if (fetched > 0 && fetched % 100 === 0 && completed < sourceRows.length) {
      const pause = 120000 + Math.floor(Math.random() * 80001);
      console.log(JSON.stringify({ batchPauseSeconds: Math.ceil(pause / 1000) }));
      await new Promise((done) => setTimeout(done, pause));
    }
  }
}
