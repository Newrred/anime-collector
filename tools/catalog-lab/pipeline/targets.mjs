import { readFile } from 'node:fs/promises';

const goldenTargetsUrl = new URL('../config/golden-targets.json', import.meta.url);

export const TARGET_PROFILE_COUNTS = Object.freeze({ golden: 10, sample100: 100, full3998: 3998 });

async function loadGoldenIds() {
  return JSON.parse(await readFile(goldenTargetsUrl, 'utf8'));
}

function getStoredId(idMapStore, key) {
  return typeof idMapStore.get === 'function' ? idMapStore.get(key) : idMapStore[key];
}

function storeId(idMapStore, key, value) {
  if (typeof idMapStore.set === 'function') idMapStore.set(key, value);
  else idMapStore[key] = value;
}

function findGoldenRows(rows, goldenIds) {
  const goldenRows = goldenIds.map((id) => rows.find((row) => String(row.anilistId) === id));
  if (goldenRows.some((row) => !row)) {
    const error = new Error('Approved golden target is missing from the aliases roster');
    error.code = 'GOLDEN_TARGET_MISSING';
    throw error;
  }
  return goldenRows;
}

function selectSampleRows(rows, goldenIds) {
  const goldenSet = new Set(goldenIds);
  const goldenRows = findGoldenRows(rows, goldenIds);
  const remaining = rows
    .filter((row) => !goldenSet.has(String(row.anilistId)))
    .sort((left, right) => Number(left.anilistId) - Number(right.anilistId));
  if (remaining.length < 90) {
    const error = new Error('Aliases roster cannot supply a 100-target sample');
    error.code = 'TARGET_SAMPLE_UNAVAILABLE';
    throw error;
  }
  const selected = Array.from({ length: 90 }, (_, index) => (
    remaining[Math.floor((index * (remaining.length - 1)) / 89)]
  ));
  return [...goldenRows, ...selected];
}

function selectFullRows(rows) {
  if (!Array.isArray(rows) || rows.length !== TARGET_PROFILE_COUNTS.full3998) return null;
  const ids = rows.map((row) => String(row?.anilistId ?? ''));
  if (new Set(ids).size !== TARGET_PROFILE_COUNTS.full3998
    || ids.some((id) => !/^[1-9]\d*$/u.test(id))
    || rows.some((row) => typeof row?.ko !== 'string' || !row.ko.trim())) return null;
  return rows;
}

async function rowsForProfile(profile, rows) {
  const goldenIds = await loadGoldenIds();
  const selectedRows = profile === 'golden'
    ? findGoldenRows(rows, goldenIds)
    : profile === 'sample100'
      ? selectSampleRows(rows, goldenIds)
      : profile === 'full3998'
        ? selectFullRows(rows)
        : null;
  if (!selectedRows || selectedRows.length !== TARGET_PROFILE_COUNTS[profile]) {
    const error = new Error('Catalog target profile is invalid');
    error.code = 'TARGET_PROFILE_INVALID';
    throw error;
  }
  return selectedRows;
}

/** Returns the exact deterministic AniList ID order approved for a target profile. */
export async function targetIdsForProfile({ profile, rows }) {
  return Object.freeze((await rowsForProfile(profile, rows)).map((row) => String(row.anilistId)));
}

function toTargetRecord(row, { idMapStore, clock, uuid }) {
  const anilistId = String(row.anilistId);
  const targetKey = `ANILIST:${anilistId}`;
  let moemoaAnimeId = getStoredId(idMapStore, targetKey);
  if (!moemoaAnimeId) {
    moemoaAnimeId = `anime:${uuid()}`;
    storeId(idMapStore, targetKey, moemoaAnimeId);
  }
  const seedTitles = [
    ...(row.ko ? [{ locale: 'ko', value: row.ko }] : []),
    ...(Array.isArray(row.aliases) ? row.aliases.filter(Boolean).map((value) => ({ locale: 'und', value })) : []),
  ];
  return Object.freeze({
    targetKey,
    moemoaAnimeId,
    seedSource: 'legacy_aliases',
    seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: anilistId }]),
    seedTitles: Object.freeze(seedTitles),
    targetStatus: 'ACTIVE',
    createdAt: clock.now(),
  });
}

/**
 * Builds a deterministic local-only target manifest from read-only legacy aliases.
 *
 * @param {{profile: 'golden'|'sample100'|'full3998', rows: Array<Record<string, unknown>>, idMapStore: Map<string, string>|Record<string, string>, clock: {now(): string}, uuid: () => string}} input
 */
export async function buildTargetManifest({ profile, rows, idMapStore, clock, uuid }) {
  const selectedRows = await rowsForProfile(profile, rows);
  return Object.freeze(selectedRows.map((row) => toTargetRecord(row, { idMapStore, clock, uuid })));
}
