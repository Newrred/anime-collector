import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../catalog-lab/lib/hash.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputRoot = resolve(process.env.MOEMOA_CHARACTER_AUDIT_DIR || resolve(repoRoot, '..', '.moemoa-character-audit-2026-10-08'));
const rel = relative(repoRoot, outputRoot);
if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('Release artifacts must stay outside Git');
const env = Object.fromEntries((await readFile(resolve(repoRoot, '.env.production'), 'utf8')).split(/\r?\n/u)
  .filter((line) => /^[A-Z][A-Z0-9_]*=/u.test(line)).map((line) => {
    const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/gu, '')];
  }));
const base = env.PUBLIC_CATALOG_SUPABASE_URL?.replace(/\/+$/u, '');
const key = process.env.MOEMOA_SUPABASE_SERVICE_ROLE_KEY;
if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/u.test(base) || !key) throw new Error('Admin read configuration is unavailable');
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const tables = ['catalog_assets', 'catalog_anime_search', 'catalog_anime_details', 'catalog_anime_people'];
const json = async (name) => JSON.parse(await readFile(resolve(outputRoot, name), 'utf8'));
const save = async (name, data) => writeFile(resolve(outputRoot, name), `${JSON.stringify(data, null, 2)}\n`);

async function request(tablePath, { method = 'GET', body, extraHeaders = {} } = {}) {
  const response = await fetch(`${base}/rest/v1/${tablePath}`, {
    method, headers: { ...headers, ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`${method} ${tablePath.split('?')[0]} failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}

async function releaseRows(table, releaseId) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const part = await request(`${table}?release_id=eq.${encodeURIComponent(releaseId)}&select=*&order=anime_id${table.endsWith('people') ? ',page' : ''}&limit=500&offset=${offset}`);
    if (!Array.isArray(part)) throw new Error('Invalid release rows');
    rows.push(...part); if (part.length < 500) return rows;
  }
}

function peopleFromSource(source) {
  const byCharacter = new Map();
  for (const edge of source.envelope.payload.characters) {
    const id = Number(edge?.node?.id);
    const name = String(edge?.node?.name?.full || edge?.node?.name?.native || '').normalize('NFKC').trim();
    if (!Number.isSafeInteger(id) || id < 1 || !name || !['MAIN', 'SUPPORTING'].includes(edge.role)) continue;
    const characterId = `anilist:${id}`;
    if (byCharacter.has(characterId)) continue;
    const localizedNames = [];
    const native = String(edge.node.name.native || '').normalize('NFKC').trim();
    if (native) localizedNames.push({ locale: 'ja', value: native });
    for (const alternative of edge.node.name.alternative ?? []) {
      const value = String(alternative || '').normalize('NFKC').trim();
      if (value && !localizedNames.some((row) => row.value === value)) localizedNames.push({ locale: 'und', value });
    }
    const castings = [];
    for (const actor of edge.voiceActors ?? []) {
      const creditedName = String(actor?.name?.native || actor?.name?.full || '').normalize('NFKC').trim();
      if (actor?.language !== 'JAPANESE' || !Number.isSafeInteger(actor.id) || actor.id < 1 || !creditedName) continue;
      const personId = `anilist:${actor.id}`;
      if (!castings.some((row) => row.personId === personId)) castings.push({ personId, creditedName, language: 'ja', roleType: edge.role });
    }
    byCharacter.set(characterId, { characterId, canonicalName: name, role: edge.role, localizedNames, castings });
  }
  const rank = { MAIN: 0, SUPPORTING: 1 };
  return [...byCharacter.values()].sort((a, b) => rank[a.role] - rank[b.role]
    || a.canonicalName.localeCompare(b.canonicalName) || a.characterId.localeCompare(b.characterId));
}

function hashed(value) { return { ...value, rowHash: sha256(value) }; }
function normalizedTitle(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('und').replace(/[^\p{L}\p{N}]/gu, '');
}

async function snapshot() {
  await mkdir(outputRoot, { recursive: true });
  const pointer = (await request('catalog_active_release?select=*'))?.[0];
  if (!pointer?.release_id) throw new Error('No active catalog');
  const release = (await request(`catalog_releases?id=eq.${encodeURIComponent(pointer.release_id)}&select=*`))?.[0];
  if (!release || release.status !== 'ACTIVE') throw new Error('Active catalog metadata is invalid');
  const data = {};
  for (const table of tables) data[table] = await releaseRows(table, release.id);
  if (data.catalog_anime_search.length !== release.target_count
    || data.catalog_anime_details.length !== release.target_count
    || data.catalog_assets.length !== release.target_count
    || data.catalog_anime_people.length !== release.people_page_count) throw new Error('Active catalog rows are incomplete');
  const record = { projectOrigin: base, pointer, release, data };
  await save('release-before.json', record);
  console.log(JSON.stringify({ release: release.id, titles: release.target_count, peoplePages: release.people_page_count }));
}

async function prepare() {
  const before = await json('release-before.json');
  const audit = await json('missing-characters.json');
  if (before.projectOrigin !== base || audit.counts.titles !== before.release.target_count) throw new Error('Catalog audit/snapshot mismatch');
  const active = (await request('catalog_active_release?select=release_id'))?.[0]?.release_id;
  if (active !== before.release.id) throw new Error('Active release changed during preparation');
  const data = structuredClone(before.data);
  const details = new Map(data.catalog_anime_details.map((row) => [row.anime_id, row]));
  const search = new Map(data.catalog_anime_search.map((row) => [row.anime_id, row]));
  const peopleIds = new Set(data.catalog_anime_people.map((row) => row.anime_id));
  const sourceEvidence = [];
  const affected = [];
  for (const row of audit.missing.filter((entry) => entry.status === 'BOUND_UNIQUE')) {
    const path = resolve(outputRoot, 'source-records', `${row.animeId.replace(':', '-')}.json`);
    const source = JSON.parse(await readFile(path, 'utf8'));
    const { contentHash, ...sourceCore } = source;
    if (sha256(sourceCore) !== contentHash || source.animeId !== row.animeId || source.anilistId !== row.anilistId
      || source.envelope?.payload?.id !== row.anilistId || peopleIds.has(row.animeId)) throw new Error(`Source binding/immutability failed: ${row.animeId}`);
    const detail = details.get(row.animeId), title = search.get(row.animeId);
    if (!detail || title?.anilist_id !== row.anilistId || !detail.payload.externalIds.some((entry) => entry.provider === 'anilist' && entry.externalId === String(row.anilistId))) {
      throw new Error(`Catalog binding changed: ${row.animeId}`);
    }
    const knownTitles = [title.preferred_title, ...(title.search_aliases ?? []).map((entry) => entry.value)]
      .map(normalizedTitle).filter(Boolean);
    const sourceTitles = Object.values(source.envelope.payload.title ?? {}).map(normalizedTitle).filter(Boolean);
    if (!sourceTitles.some((value) => knownTitles.includes(value))) throw new Error(`Source title does not match the catalog binding: ${row.animeId}`);
    const entries = peopleFromSource(source);
    if (entries.some((entry) => entry.canonicalName.length > 240 || entry.characterId.length > 160
      || entry.localizedNames.length > 32 || entry.castings.length > 32
      || entry.castings.some((casting) => casting.creditedName.length > 240))) {
      throw new Error(`Character field bounds require review: ${row.animeId}`);
    }
    sourceEvidence.push({ animeId: row.animeId, anilistId: row.anilistId, contentHash, fetchedAt: source.envelope.fetchedAt, characters: entries.length });
    if (!entries.length) continue;
    const pageSize = 30;
    for (let index = 0; index < entries.length; index += pageSize) {
      const payload = hashed({ schemaVersion: 2, policyVersion: detail.payload.policyVersion,
        animeId: row.animeId, page: Math.floor(index / pageSize) + 1, pageSize,
        totalCount: entries.length, entries: entries.slice(index, index + pageSize) });
      data.catalog_anime_people.push({ release_id: null, anime_id: row.animeId, page: payload.page, payload, row_hash: payload.rowHash });
    }
    const payloadCore = { ...detail.payload, people: { characterCount: entries.length,
      castingCount: entries.reduce((total, entry) => total + entry.castings.length, 0),
      pageCount: Math.ceil(entries.length / pageSize), pageSize,
      featuredCharacterIds: entries.slice(0, 8).map((entry) => entry.characterId) } };
    delete payloadCore.rowHash;
    detail.payload = hashed(payloadCore); detail.row_hash = detail.payload.rowHash;
    affected.push({ animeId: row.animeId, anilistId: row.anilistId, title: row.title,
      characters: entries.length, sourceHash: contentHash });
  }
  if (sourceEvidence.length !== audit.counts.boundUnique) throw new Error('Not all bounded source records were reviewed');
  const releaseHash = sha256({ baseReleaseHash: before.release.release_hash, sourceEvidence, affected,
    policyVersion: 'CATALOG_CHARACTER_BACKFILL_2026_10_08' });
  const releaseId = `catalog-people-${releaseHash.slice(0, 24)}`;
  for (const table of tables) {
    for (const row of data[table]) row.release_id = releaseId;
    data[table].sort((a, b) => a.anime_id.localeCompare(b.anime_id) || (a.page ?? 0) - (b.page ?? 0));
  }
  const affectedIds = new Set(affected.map((row) => row.animeId));
  const contentOnly = (rows) => rows.map(({ release_id: ignored, ...row }) => row);
  for (const table of tables) {
    const prior = before.data[table].filter((row) => table !== 'catalog_anime_details' || !affectedIds.has(row.anime_id));
    const next = data[table].filter((row) => table !== 'catalog_anime_details' || !affectedIds.has(row.anime_id))
      .filter((row) => table !== 'catalog_anime_people' || !affectedIds.has(row.anime_id));
    if (sha256(contentOnly(prior)) !== sha256(contentOnly(next))) throw new Error(`Existing ${table} rows changed unexpectedly`);
  }
  const release = { id: releaseId, profile: before.release.profile, schema_version: 2,
    policy_version: 'CATALOG_CHARACTER_BACKFILL_2026_10_08', release_hash: releaseHash,
    target_count: before.release.target_count, people_page_count: data.catalog_anime_people.length, status: 'STAGING' };
  const prepared = { projectOrigin: base, baseRelease: before.release, release, data, sourceEvidence,
    affected, zeroCharacters: sourceEvidence.filter((entry) => entry.characters === 0).map((entry) => entry.animeId) };
  await save('release-prepared.json', prepared);
  await save('release-review.json', { baseReleaseId: before.release.id, candidateReleaseId: releaseId,
    source: 'AniList', permissionRecord: 'ANILIST-PROD-01', boundCandidates: sourceEvidence.length,
    enrichedTitles: affected.length, zeroCharacterTitles: prepared.zeroCharacters.length,
    bindingRequiredTitles: audit.counts.bindingRequired, beforePeoplePages: before.release.people_page_count,
    afterPeoplePages: release.people_page_count, existingSearchAndCoverRowsPreserved: true,
    sourceEvidenceHash: sha256(sourceEvidence), affected });
  console.log(JSON.stringify({ releaseId, affected: affected.length, zeroCharacters: prepared.zeroCharacters.length,
    peoplePages: release.people_page_count, unchangedTitles: before.release.target_count - affected.length }));
}

async function stage() {
  const prepared = await json('release-prepared.json');
  if (prepared.projectOrigin !== base || (await request('catalog_active_release?select=release_id'))?.[0]?.release_id !== prepared.baseRelease.id) {
    throw new Error('Active catalog changed before staging');
  }
  await request('catalog_releases', { method: 'POST', body: prepared.release,
    extraHeaders: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
  for (const table of tables) {
    for (let index = 0; index < prepared.data[table].length; index += 100) {
      await request(table, { method: 'POST', body: prepared.data[table].slice(index, index + 100),
        extraHeaders: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
    }
    const actual = await releaseRows(table, prepared.release.id);
    if (sha256(actual) !== sha256(prepared.data[table])) throw new Error(`Staged ${table} data mismatch`);
    console.log(`${table}: ${actual.length} rows verified`);
  }
  await save('release-staged.json', { releaseId: prepared.release.id, releaseHash: prepared.release.release_hash, at: new Date().toISOString() });
}

async function transitionRelease({ requestedRelease, expectedActiveId, restoreRetired = false }) {
  const active = (await request('catalog_active_release?select=release_id'))?.[0]?.release_id;
  if (active === requestedRelease.id) {
    const row = (await request(`catalog_releases?id=eq.${encodeURIComponent(requestedRelease.id)}&select=status`))?.[0];
    if (row?.status === 'ACTIVE') return;
  }
  if (active !== expectedActiveId) throw new Error('Active catalog changed before transition');
  try {
    await request('rpc/activate_catalog_release_checked', { method: 'POST', body: {
      requested_release_id: requestedRelease.id, requested_release_hash: requestedRelease.release_hash,
      expected_active_release_id: expectedActiveId,
    } });
  } catch (error) {
    if (!String(error.message).includes('404') || !String(error.message).includes('PGRST202')) throw error;
    // Older production databases expose only the original transition function.
    if ((await request('catalog_active_release?select=release_id'))?.[0]?.release_id !== expectedActiveId) {
      throw new Error('Active catalog changed before legacy transition');
    }
    if (restoreRetired) {
      const before = await json('release-before.json');
      for (const table of tables) {
        if (sha256(await releaseRows(table, requestedRelease.id)) !== sha256(before.data[table])) {
          throw new Error(`Rollback ${table} data mismatch`);
        }
      }
      const restored = await request(`catalog_releases?id=eq.${encodeURIComponent(requestedRelease.id)}&status=eq.RETIRED`, {
        method: 'PATCH', body: { status: 'STAGING' }, extraHeaders: { Prefer: 'return=representation' },
      });
      if (restored?.length !== 1) throw new Error('Rollback release could not be staged');
    }
    await request('rpc/activate_catalog_release', { method: 'POST', body: {
      requested_release_id: requestedRelease.id, requested_release_hash: requestedRelease.release_hash,
    } });
  }
}

async function activate() {
  const prepared = await json('release-prepared.json'), staged = await json('release-staged.json');
  if (staged.releaseId !== prepared.release.id || staged.releaseHash !== prepared.release.release_hash) throw new Error('Staged release evidence mismatch');
  await transitionRelease({ requestedRelease: prepared.release, expectedActiveId: prepared.baseRelease.id });
  if ((await request('catalog_active_release?select=release_id'))?.[0]?.release_id !== prepared.release.id) throw new Error('Activation could not be confirmed');
  await save('release-activated.json', { releaseId: prepared.release.id, at: new Date().toISOString() });
  console.log(`Activated ${prepared.release.id}`);
}

async function rollback() {
  const prepared = await json('release-prepared.json');
  if ((await request('catalog_active_release?select=release_id'))?.[0]?.release_id !== prepared.release.id) {
    throw new Error('The candidate release is not active');
  }
  await transitionRelease({ requestedRelease: prepared.baseRelease, expectedActiveId: prepared.release.id, restoreRetired: true });
  if ((await request('catalog_active_release?select=release_id'))?.[0]?.release_id !== prepared.baseRelease.id) {
    throw new Error('Rollback could not be confirmed');
  }
  await save('release-rollback.json', { restoredReleaseId: prepared.baseRelease.id, at: new Date().toISOString() });
  console.log(`Restored ${prepared.baseRelease.id}`);
}

const mode = process.argv[2];
if (mode === 'snapshot') await snapshot();
else if (mode === 'prepare') await prepare();
else if (mode === 'stage' && process.argv.includes('--approved')) await stage();
else if (mode === 'activate' && process.argv.includes('--approved')) await activate();
else if (mode === 'rollback' && process.argv.includes('--approved')) await rollback();
else throw new Error('Usage: character-backfill-release.mjs snapshot|prepare|stage --approved|activate --approved|rollback --approved');
