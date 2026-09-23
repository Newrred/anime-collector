import { readFile } from 'node:fs/promises';

import {
  validateIncrementReview, validateIncrementReviewAgainstDiscovery,
} from '../discovery/anilife-season.mjs';

const goldenTargetsUrl = new URL('../config/golden-targets.json', import.meta.url);

export const TARGET_PROFILE_COUNTS = Object.freeze({ golden: 10, sample100: 100, full3998: 3998 });
export const MAX_INCREMENT_TARGETS = 500;

const INCREMENT_PROFILE = /^increment-\d{4}-(?:0[1-9]|1[0-2])$/u;

export function isIncrementProfile(profile) {
  return typeof profile === 'string' && INCREMENT_PROFILE.test(profile);
}

export function isCatalogProfile(profile) {
  return Boolean(TARGET_PROFILE_COUNTS[profile]) || isIncrementProfile(profile);
}

export function expectedTargetCount(profile, manifest) {
  if (TARGET_PROFILE_COUNTS[profile]) return TARGET_PROFILE_COUNTS[profile];
  if (!isIncrementProfile(profile) || !Array.isArray(manifest)
    || manifest.length < 1 || manifest.length > MAX_INCREMENT_TARGETS) return null;
  return manifest.length;
}

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

function incrementTargetKey(row) {
  return row.anilistId === null ? `ANILIFE:${row.contentId}` : `ANILIST:${row.anilistId}`;
}

function incrementTarget(row, { idMapStore, uuid }) {
  const anilistId = row.anilistId === null ? null : String(row.anilistId);
  const targetKey = incrementTargetKey(row);
  let moemoaAnimeId = getStoredId(idMapStore, targetKey);
  if (!moemoaAnimeId) {
    moemoaAnimeId = `anime:${uuid()}`;
    storeId(idMapStore, targetKey, moemoaAnimeId);
  }
  return Object.freeze({
    targetKey,
    moemoaAnimeId,
    seedSource: 'reviewed_increment',
    seedExternalIds: Object.freeze([
      { sourceId: 'anilife_public', value: row.contentId },
      ...(anilistId ? [{ sourceId: 'anilist', value: anilistId }] : []),
    ]),
    seedTitles: Object.freeze([
      { locale: 'ko', value: row.ko },
      ...row.aliases.map((value) => ({ locale: 'und', value })),
    ]),
    incrementEvidence: Object.freeze({
      sourceId: 'anilife_public',
      contentId: row.contentId,
      sourceHash: row.sourceHash,
      capturedAt: row.capturedAt,
      format: row.format,
      episodeLabel: row.episodeLabel,
      genres: Object.freeze([...row.genres]),
      year: row.year,
      publicPageUrl: row.publicPageUrl,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
    }),
    seedReleaseYear: row.year,
    seedEpisodeCount: /^([1-9]\d*)화$/u.test(row.episodeLabel ?? '')
      ? Number(row.episodeLabel.slice(0, -1)) : null,
    identityState: anilistId ? 'EXACT_ANILIST_ID' : 'SOURCE_REVIEWED',
    targetStatus: 'ACTIVE',
    createdAt: row.reviewedAt,
  });
}

/** Builds a bounded increment only from rows explicitly approved with an AniList id. */
export function buildIncrementalTargetManifest({
  profile, review, discovery, existingRows, idMapStore, uuid,
}) {
  const validated = validateIncrementReviewAgainstDiscovery(review, discovery, { profile });
  if (!Array.isArray(existingRows) || !idMapStore || typeof uuid !== 'function') {
    const error = new Error('Increment target inputs are invalid');
    error.code = 'INCREMENT_TARGET_INVALID';
    throw error;
  }
  const existingIds = new Set(existingRows.map((row) => String(row?.anilistId ?? '')));
  const approved = validated.rows.filter((row) => row.decision === 'APPROVED_NEW')
    .map((row) => ({
      ...row, anilistId: row.anilistId === null ? null : String(row.anilistId),
      sourceHash: validated.sourceHash, capturedAt: validated.capturedAt,
    }))
    .sort((left, right) => incrementTargetKey(left).localeCompare(incrementTargetKey(right)));
  if (approved.length < 1 || approved.length > MAX_INCREMENT_TARGETS
    || new Set(approved.map(incrementTargetKey)).size !== approved.length
    || new Set(approved.map((row) => row.contentId)).size !== approved.length
    || approved.some((row) => row.anilistId !== null && existingIds.has(row.anilistId))) {
    const error = new Error('Approved increment rows are empty, duplicated, or already present');
    error.code = 'INCREMENT_TARGET_INVALID';
    throw error;
  }
  return Object.freeze(approved.map((row) => incrementTarget(row, { idMapStore, uuid })));
}

export function incrementManifestMatchesReview({ profile, review, manifest, idMap }) {
  try {
    const validated = validateIncrementReview(review, { profile });
    const approved = validated.rows.filter((row) => row.decision === 'APPROVED_NEW')
      .map((row) => ({
        ...row, anilistId: row.anilistId === null ? null : String(row.anilistId),
        sourceHash: validated.sourceHash, capturedAt: validated.capturedAt,
      }))
      .sort((left, right) => incrementTargetKey(left).localeCompare(incrementTargetKey(right)));
    if (!Array.isArray(manifest) || approved.length < 1 || approved.length !== manifest.length
      || approved.length > MAX_INCREMENT_TARGETS || !idMap || typeof idMap !== 'object'
      || Array.isArray(idMap)) return false;
    return approved.every((row, index) => {
      const target = manifest[index];
      return target?.targetKey === incrementTargetKey(row)
        && target.moemoaAnimeId === idMap[target.targetKey]
        && target.seedSource === 'reviewed_increment'
        && target.identityState === (row.anilistId ? 'EXACT_ANILIST_ID' : 'SOURCE_REVIEWED')
        && target.targetStatus === 'ACTIVE'
        && target.createdAt === row.reviewedAt
        && JSON.stringify(target.seedExternalIds) === JSON.stringify([
          { sourceId: 'anilife_public', value: row.contentId },
          ...(row.anilistId ? [{ sourceId: 'anilist', value: row.anilistId }] : []),
        ])
        && JSON.stringify(target.seedTitles) === JSON.stringify([
          { locale: 'ko', value: row.ko },
          ...row.aliases.map((value) => ({ locale: 'und', value })),
        ])
        && JSON.stringify(target.incrementEvidence) === JSON.stringify({
          sourceId: 'anilife_public', contentId: row.contentId, sourceHash: validated.sourceHash,
          capturedAt: validated.capturedAt, format: row.format, episodeLabel: row.episodeLabel,
          genres: row.genres, year: row.year, publicPageUrl: row.publicPageUrl,
          reviewedAt: row.reviewedAt, reviewedBy: row.reviewedBy,
        });
    });
  } catch {
    return false;
  }
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
