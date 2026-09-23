import { readFile } from 'node:fs/promises';

import { CATALOG_LAB_USER_AGENT } from '../contracts/catalogContracts.mjs';
import { sha256, stableStringify } from '../lib/hash.mjs';
import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';
import { createHttpClient } from '../lib/http.mjs';
import { createRateLimitedHttpClient } from '../pipeline/runner.mjs';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
const ANILIST_COVER_ORIGIN = 'https://s4.anilist.co';
const BINDING_SCHEMA_VERSION = 1;
const MATCH_POLICY_VERSION = 'ANILIST_INCREMENT_MATCH_V2';
const PAGE_SIZE = 50;
const MAX_YEAR_PAGES = 20;
const SEARCH_BATCH_SIZE = 8;
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const COVER_WIDTH = 32;
const COVER_HEIGHT = 48;

const MEDIA_FIELDS = `
  id idMal title { romaji english native } synonyms
  format status season seasonYear startDate { year month day } episodes
  coverImage { extraLarge large medium }
`;

const YEAR_QUERY = `
query IncrementYearCandidates($page: Int!, $seasonYear: Int!) {
  Page(page: $page, perPage: 50) {
    media(type: ANIME, seasonYear: $seasonYear, sort: [START_DATE, ID]) { ${MEDIA_FIELDS} }
  }
}`;

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function snapshot(value) {
  try {
    return structuredClone(value);
  } catch {
    throw typedError('ANILIST_MATCH_INPUT_INVALID', 'AniList match input must be JSON-safe');
  }
}

function normalizedTitle(value) {
  return typeof value === 'string' ? value.normalize('NFKC').toLocaleLowerCase('und')
    .replace(/[\p{P}\p{S}\p{Z}]+/gu, '') : '';
}

function candidateTitles(candidate) {
  return [candidate.title?.romaji, candidate.title?.english, candidate.title?.native, ...(candidate.synonyms ?? [])]
    .filter((value) => typeof value === 'string' && value.trim());
}

function normalizedFormat(value) {
  return ({
    TV: 'TV', TVSeries: 'TV', TV_SHORT: 'TV', MOVIE: 'MOVIE', Movie: 'MOVIE',
    OVA: 'OVA', ONA: 'ONA', SPECIAL: 'SPECIAL', Special: 'SPECIAL',
  })[value]
    ?? value ?? null;
}

function formatCompatible(targetFormat, candidateFormat) {
  const target = normalizedFormat(targetFormat);
  const candidate = normalizedFormat(candidateFormat);
  if (!target || !candidate) return true;
  if (target === candidate) return true;
  if (target === 'TV' && candidate === 'ONA') return true;
  return target === 'OVA' && ['ONA', 'SPECIAL'].includes(candidate);
}

function candidateYear(candidate) {
  const values = [candidate.startDate?.year, candidate.seasonYear]
    .filter((value) => Number.isInteger(value));
  return values[0] ?? null;
}

function safeCandidate(input) {
  if (!input || !Number.isSafeInteger(input.id) || input.id < 1 || !input.title
    || !Array.isArray(input.synonyms) || !input.coverImage) return null;
  const coverUrl = input.coverImage.medium ?? input.coverImage.large ?? input.coverImage.extraLarge;
  return {
    id: input.id,
    idMal: Number.isSafeInteger(input.idMal) ? input.idMal : null,
    title: {
      romaji: typeof input.title.romaji === 'string' ? input.title.romaji : null,
      english: typeof input.title.english === 'string' ? input.title.english : null,
      native: typeof input.title.native === 'string' ? input.title.native : null,
    },
    synonyms: input.synonyms.filter((value) => typeof value === 'string'),
    format: typeof input.format === 'string' ? input.format : null,
    status: typeof input.status === 'string' ? input.status : null,
    season: typeof input.season === 'string' ? input.season : null,
    seasonYear: Number.isInteger(input.seasonYear) ? input.seasonYear : null,
    startDate: {
      year: Number.isInteger(input.startDate?.year) ? input.startDate.year : null,
      month: Number.isInteger(input.startDate?.month) ? input.startDate.month : null,
      day: Number.isInteger(input.startDate?.day) ? input.startDate.day : null,
    },
    episodes: Number.isSafeInteger(input.episodes) ? input.episodes : null,
    coverUrl: typeof coverUrl === 'string' ? coverUrl : null,
  };
}

function exactCoverUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.origin === ANILIST_COVER_ORIGIN && parsed.protocol === 'https:'
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
      && parsed.pathname.startsWith('/file/anilistcdn/media/anime/cover/');
  } catch {
    return false;
  }
}

async function graphql(http, query, variables) {
  const response = await http.request({
    url: ANILIST_ENDPOINT,
    kind: 'DATA',
    init: {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': CATALOG_LAB_USER_AGENT },
      body: JSON.stringify({ query, variables }),
    },
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw typedError('SOURCE_SCHEMA_DRIFT', 'AniList candidate response is not JSON');
  }
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    throw typedError('SOURCE_SCHEMA_DRIFT', 'AniList candidate query returned GraphQL errors');
  }
  return body?.data;
}

async function yearCandidates(http, year, onProgress) {
  const candidates = new Map();
  let requestCount = 0;
  for (let page = 1; page <= MAX_YEAR_PAGES; page += 1) {
    const data = await graphql(http, YEAR_QUERY, { page, seasonYear: year });
    requestCount += 1;
    const rows = data?.Page?.media;
    if (!Array.isArray(rows)) throw typedError('SOURCE_SCHEMA_DRIFT', 'AniList year page is invalid');
    if (rows.length === 0) break;
    for (const row of rows) {
      const candidate = safeCandidate(row);
      if (candidate) candidates.set(candidate.id, candidate);
    }
    await onProgress({ phase: 'YEAR_PAGES', completed: page, candidates: candidates.size });
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_YEAR_PAGES) {
      throw typedError('ANILIST_MATCH_SCOPE_EXCEEDED', 'AniList year candidates exceeded the safe page limit');
    }
  }
  return { candidates, requestCount };
}

function searchQuery(size) {
  const variables = Array.from({ length: size }, (_, index) => `$s${index}: String`).join(', ');
  const pages = Array.from({ length: size }, (_, index) => `
    q${index}: Page(page: 1, perPage: 5) {
      media(type: ANIME, search: $s${index}) { ${MEDIA_FIELDS} }
    }
  `).join('\n');
  return `query IncrementTitleCandidates(${variables}) { ${pages} }`;
}

async function titleSearchCandidates(http, targets, candidateMap, onProgress) {
  const byTarget = new Map();
  let requestCount = 0;
  for (let offset = 0; offset < targets.length; offset += SEARCH_BATCH_SIZE) {
    const batch = targets.slice(offset, offset + SEARCH_BATCH_SIZE);
    const variables = Object.fromEntries(batch.map((target, index) => [
      `s${index}`, target.seedTitles.find((title) => title.locale === 'ko')?.value,
    ]));
    const data = await graphql(http, searchQuery(batch.length), variables);
    requestCount += 1;
    batch.forEach((target, index) => {
      const ids = [];
      const rows = data?.[`q${index}`]?.media;
      if (!Array.isArray(rows)) throw typedError('SOURCE_SCHEMA_DRIFT', 'AniList title search page is invalid');
      for (const row of rows) {
        const candidate = safeCandidate(row);
        if (!candidate) continue;
        candidateMap.set(candidate.id, candidate);
        ids.push(candidate.id);
      }
      byTarget.set(target.targetKey, ids);
    });
    await onProgress({
      phase: 'TITLE_SEARCH', completed: Math.min(offset + batch.length, targets.length),
      total: targets.length, candidates: candidateMap.size,
    });
  }
  return { byTarget, requestCount };
}

async function imageFingerprint(sharp, input) {
  const { data, info } = await sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 })
    .resize(COVER_WIDTH, COVER_HEIGHT, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || data.length !== COVER_WIDTH * COVER_HEIGHT * 3) {
    throw typedError('ANILIST_MATCH_COVER_INVALID', 'Cover fingerprint has an unexpected pixel shape');
  }
  return data;
}

function meanAbsoluteError(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length) return null;
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += Math.abs(left[index] - right[index]);
  return Number((sum / left.length).toFixed(4));
}

async function fetchCoverFingerprint({ fetchImpl, sharp, candidate }) {
  if (!exactCoverUrl(candidate.coverUrl)) return null;
  const response = await fetchImpl(candidate.coverUrl, {
    method: 'GET', redirect: 'error', headers: { 'user-agent': CATALOG_LAB_USER_AGENT },
  });
  if (!response.ok || response.url !== candidate.coverUrl
    || !/^image\/(?:jpeg|png|webp)(?:;|$)/iu.test(response.headers.get('content-type') ?? '')) return null;
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/u.test(length) || Number(length) > MAX_COVER_BYTES)) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1 || bytes.length > MAX_COVER_BYTES) return null;
  return imageFingerprint(sharp, bytes).catch(() => null);
}

async function targetFingerprint({ workspace, store, target, sharp }) {
  const observation = await store.writeCoverObservation(target);
  if (observation?.status !== 'STORED' || typeof observation.localRef !== 'string'
    || !/^images\/covers\/anime-[a-f0-9-]+\/[a-f0-9]{64}\.(?:jpg|png|webp)$/u.test(observation.localRef)) return null;
  const path = workspace.resolve(...observation.localRef.split('/'));
  return imageFingerprint(sharp, await readFile(path)).catch(() => null);
}

function evidenceFor(target, candidate, difference, margin, exactTitle) {
  const targetYear = Number.isInteger(target.seedReleaseYear) ? target.seedReleaseYear : null;
  const targetFormat = target.incrementEvidence?.format ?? null;
  const targetEpisodes = Number.isSafeInteger(target.seedEpisodeCount) ? target.seedEpisodeCount : null;
  const year = candidateYear(candidate);
  return {
    targetTitle: target.seedTitles.find((title) => title.locale === 'ko')?.value ?? null,
    targetYear,
    targetFormat,
    targetEpisodeCount: targetEpisodes,
    candidateTitle: candidate.title.romaji ?? candidate.title.english ?? candidate.title.native,
    candidateYear: year,
    candidateFormat: candidate.format,
    candidateEpisodeCount: candidate.episodes,
    titleExact: exactTitle,
    yearMatches: targetYear === null || year === null || targetYear === year,
    formatCompatible: formatCompatible(targetFormat, candidate.format),
    episodeCompatible: targetEpisodes === null || candidate.episodes === null || targetEpisodes === candidate.episodes,
    coverMeanAbsoluteError: difference,
    coverDifferenceMargin: margin,
  };
}

function candidateDecision(target, candidates, fingerprints, targetPixels, searchIds) {
  const targetKey = normalizedTitle(target.seedTitles.find((title) => title.locale === 'ko')?.value);
  const evaluated = candidates.map((candidate) => {
    const exactTitle = candidateTitles(candidate).some((title) => normalizedTitle(title) === targetKey);
    const difference = meanAbsoluteError(targetPixels, fingerprints.get(candidate.id));
    return { candidate, exactTitle, difference, fromSearch: searchIds.includes(candidate.id) };
  });
  const coverRanked = evaluated.filter((row) => row.difference !== null)
    .sort((left, right) => left.difference - right.difference || left.candidate.id - right.candidate.id);
  const bestCover = coverRanked[0] ?? null;
  const secondCover = coverRanked[1] ?? null;
  const coverMargin = bestCover && secondCover
    ? Number((secondCover.difference - bestCover.difference).toFixed(4)) : null;
  const exact = evaluated.filter((row) => row.exactTitle).sort((left, right) => (
    Number(right.fromSearch) - Number(left.fromSearch)
    || (left.difference ?? Number.MAX_SAFE_INTEGER) - (right.difference ?? Number.MAX_SAFE_INTEGER)
    || left.candidate.id - right.candidate.id
  ));

  if (exact.length === 1) {
    const row = exact[0];
    const evidence = evidenceFor(
      target, row.candidate, row.difference,
      row.candidate.id === bestCover?.candidate.id ? coverMargin : null, true,
    );
    if (evidence.yearMatches && evidence.formatCompatible && evidence.episodeCompatible) {
      return { candidate: row.candidate, decision: 'APPROVED', ruleId: 'EXACT_TITLE_METADATA_V1', evidence };
    }
  }

  if (bestCover) {
    const evidence = evidenceFor(target, bestCover.candidate, bestCover.difference, coverMargin, bestCover.exactTitle);
    const uniqueCover = coverMargin === null || coverMargin >= 4;
    const strongCover = bestCover.difference <= 12;
    const exactCover = bestCover.difference <= 8;
    if (uniqueCover && evidence.formatCompatible
      && ((strongCover && evidence.yearMatches) || (exactCover && bestCover.exactTitle))) {
      return {
        candidate: bestCover.candidate,
        decision: 'APPROVED',
        ruleId: evidence.yearMatches ? 'COVER_YEAR_FORMAT_V2' : 'EXACT_TITLE_COVER_FORMAT_V2',
        evidence,
      };
    }
    return {
      candidate: bestCover.candidate,
      decision: 'PENDING_REVIEW',
      ruleId: 'COVER_OR_METADATA_INSUFFICIENT_V1',
      evidence,
    };
  }

  const fallback = exact[0] ?? evaluated.find((row) => row.fromSearch) ?? null;
  return {
    candidate: fallback?.candidate ?? null,
    decision: 'PENDING_REVIEW',
    ruleId: fallback ? 'TITLE_OR_SEARCH_AMBIGUOUS_V1' : 'NO_ANILIST_CANDIDATE_V1',
    evidence: fallback ? evidenceFor(target, fallback.candidate, null, null, fallback.exactTitle) : null,
  };
}

function finalBindingDocument({ profile, generatedAt, rows }) {
  const bindings = rows.filter((row) => row.decision === 'APPROVED').map((row) => ({
    targetKey: row.targetKey,
    moemoaAnimeId: row.moemoaAnimeId,
    anilistId: row.anilistId,
    ruleId: row.ruleId,
    evidenceHash: row.evidenceHash,
  })).sort((left, right) => left.targetKey.localeCompare(right.targetKey));
  const core = {
    schemaVersion: BINDING_SCHEMA_VERSION,
    policyVersion: MATCH_POLICY_VERSION,
    profile,
    generatedAt,
    sourceId: 'anilist',
    bindings,
  };
  return Object.freeze({ ...core, contentHash: sha256(core) });
}

export function validateAniListBindingDocument(input, { profile, targets } = {}) {
  const document = snapshot(input);
  if (!document || document.schemaVersion !== BINDING_SCHEMA_VERSION
    || document.policyVersion !== MATCH_POLICY_VERSION || document.profile !== profile
    || document.sourceId !== 'anilist' || !Array.isArray(document.bindings)
    || typeof document.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(document.generatedAt)
    || typeof document.contentHash !== 'string') {
    throw typedError('ANILIST_BINDING_INVALID', 'AniList binding document is invalid');
  }
  const { contentHash, ...core } = document;
  if (contentHash !== sha256(core)) throw typedError('ANILIST_BINDING_INVALID', 'AniList binding hash is invalid');
  const targetMap = new Map((targets ?? []).map((target) => [target.targetKey, target]));
  const targetKeys = new Set();
  const ids = new Set();
  for (const binding of document.bindings) {
    const target = targetMap.get(binding?.targetKey);
    if (!target || target.moemoaAnimeId !== binding.moemoaAnimeId
      || !Number.isSafeInteger(binding.anilistId) || binding.anilistId < 1
      || typeof binding.ruleId !== 'string' || !binding.ruleId
      || !/^[a-f0-9]{64}$/u.test(binding.evidenceHash ?? '')
      || targetKeys.has(binding.targetKey) || ids.has(binding.anilistId)) {
      throw typedError('ANILIST_BINDING_INVALID', 'AniList binding identity is invalid or duplicated');
    }
    targetKeys.add(binding.targetKey);
    ids.add(binding.anilistId);
  }
  return Object.freeze(document);
}

export function applyApprovedAniListBindings({ profile, targets, document }) {
  if (!document) return Object.freeze(targets.map((target) => Object.freeze(snapshot(target))));
  const validated = validateAniListBindingDocument(document, { profile, targets });
  const byTarget = new Map(validated.bindings.map((binding) => [binding.targetKey, binding]));
  return Object.freeze(targets.map((input) => {
    const target = snapshot(input);
    const binding = byTarget.get(target.targetKey);
    if (!binding) return Object.freeze(target);
    const existing = target.seedExternalIds.filter((entry) => entry.sourceId === 'anilist');
    if (existing.length > 0 && existing.some((entry) => String(entry.value) !== String(binding.anilistId))) {
      throw typedError('ANILIST_BINDING_INVALID', 'AniList binding conflicts with the target manifest');
    }
    return Object.freeze({
      ...target,
      seedExternalIds: Object.freeze([
        ...target.seedExternalIds.filter((entry) => entry.sourceId !== 'anilist'),
        { sourceId: 'anilist', value: String(binding.anilistId) },
      ]),
    });
  }));
}

/** Matches an increment profile without changing its target keys or MOEMOA IDs. */
export async function runAniListIncrementMatching({
  workspace, profile, targets, registryEntry, store, existingAniListIds = [],
  fetchImpl = globalThis.fetch, clock = { now: () => new Date().toISOString() },
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  random = Math.random, onProgress = async () => {},
} = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  if (!/^increment-\d{4}-(?:0[1-9]|1[0-2])$/u.test(profile ?? '')
    || !Array.isArray(targets) || targets.length < 1 || !registryEntry
    || registryEntry.sourceId !== 'anilist' || registryEntry.catalogPromotion !== 'FIELD_REVIEW_REQUIRED'
    || typeof fetchImpl !== 'function' || typeof onProgress !== 'function') {
    throw typedError('ANILIST_MATCH_INPUT_INVALID', 'AniList increment match input is invalid');
  }
  const years = new Set(targets.map((target) => target.seedReleaseYear));
  if (years.size !== 1 || !Number.isInteger([...years][0])) {
    throw typedError('ANILIST_MATCH_INPUT_INVALID', 'Increment targets must share one reviewed year');
  }
  const year = [...years][0];
  const baseHttp = createHttpClient({ fetchImpl, sleep, random });
  const http = createRateLimitedHttpClient({
    http: baseHttp,
    minIntervalMs: registryEntry.minIntervalMs,
    maxIntervalMs: registryEntry.maxIntervalMs ?? registryEntry.minIntervalMs,
    sleep,
    random,
  });
  const yearResult = await yearCandidates(http, year, onProgress);
  const searchResult = await titleSearchCandidates(http, targets, yearResult.candidates, onProgress);
  const candidates = [...yearResult.candidates.values()].sort((left, right) => left.id - right.id);
  const sharpModule = await import('sharp').catch(() => null);
  if (!sharpModule?.default) throw typedError('ANILIST_MATCH_IMAGE_TOOL_UNAVAILABLE', 'Sharp is required for cover matching');
  const targetFingerprints = new Map();
  for (let index = 0; index < targets.length; index += 1) {
    targetFingerprints.set(targets[index].targetKey, await targetFingerprint({
      workspace, store, target: targets[index], sharp: sharpModule.default,
    }));
    if ((index + 1) % 25 === 0 || index + 1 === targets.length) {
      await onProgress({ phase: 'TARGET_COVERS', completed: index + 1, total: targets.length });
    }
  }
  const candidateFingerprints = new Map();
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    candidateFingerprints.set(candidate.id, await fetchCoverFingerprint({
      fetchImpl, sharp: sharpModule.default, candidate,
    }));
    if ((index + 1) % 25 === 0 || index + 1 === candidates.length) {
      await onProgress({ phase: 'CANDIDATE_COVERS', completed: index + 1, total: candidates.length });
    }
  }

  const existing = new Set(existingAniListIds.map(Number).filter(Number.isSafeInteger));
  let rows = targets.map((target) => {
    const match = candidateDecision(
      target, candidates, candidateFingerprints, targetFingerprints.get(target.targetKey),
      searchResult.byTarget.get(target.targetKey) ?? [],
    );
    let decision = match.decision;
    let ruleId = match.ruleId;
    if (match.candidate && existing.has(match.candidate.id)) {
      decision = 'PENDING_REVIEW';
      ruleId = 'EXISTING_CATALOG_DUPLICATE_V1';
    }
    const evidence = match.evidence;
    return {
      targetKey: target.targetKey,
      moemoaAnimeId: target.moemoaAnimeId,
      anilistId: match.candidate?.id ?? null,
      decision,
      ruleId,
      evidence,
      evidenceHash: sha256({ targetKey: target.targetKey, anilistId: match.candidate?.id ?? null, ruleId, evidence }),
    };
  });
  const approvedRows = rows.filter((row) => row.decision === 'APPROVED' && row.anilistId !== null);
  const duplicateIds = new Set([...new Map(approvedRows.map((row) => [
    row.anilistId, approvedRows.filter((candidate) => candidate.anilistId === row.anilistId).length,
  ])).entries()].filter(([, count]) => count > 1).map(([id]) => id));
  rows = rows.map((row) => duplicateIds.has(row.anilistId) ? {
    ...row,
    decision: 'PENDING_REVIEW',
    ruleId: 'DUPLICATE_INCREMENT_BINDING_V1',
    evidenceHash: sha256({
      targetKey: row.targetKey, anilistId: row.anilistId,
      ruleId: 'DUPLICATE_INCREMENT_BINDING_V1', evidence: row.evidence,
    }),
  } : row).sort((left, right) => left.targetKey.localeCompare(right.targetKey));

  const generatedAt = clock.now();
  const counts = rows.reduce((result, row) => ({
    ...result,
    [row.decision]: (result[row.decision] ?? 0) + 1,
  }), {});
  const reportCore = {
    schemaVersion: BINDING_SCHEMA_VERSION,
    policyVersion: MATCH_POLICY_VERSION,
    profile,
    generatedAt,
    sourceId: 'anilist',
    candidateCount: candidates.length,
    requestCount: yearResult.requestCount + searchResult.requestCount,
    counts,
    rows,
  };
  const report = Object.freeze({ ...reportCore, contentHash: sha256(reportCore) });
  const bindings = finalBindingDocument({ profile, generatedAt, rows });
  validateAniListBindingDocument(bindings, { profile, targets });
  await store.writeAniListMatchReport(profile, report);
  await store.writeAniListBindings(profile, bindings);
  return Object.freeze({ report, bindings });
}

export { MATCH_POLICY_VERSION, YEAR_QUERY, formatCompatible, meanAbsoluteError };
