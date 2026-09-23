import { mkdir, readFile } from 'node:fs/promises';

import { atomicWriteJson } from '../lib/atomic-json.mjs';
import { sha256, stableStringify } from '../lib/hash.mjs';
import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';

export const ANILIFE_SEASON_CAPTURE_SCHEMA_VERSION = 1;
export const ANILIFE_SEASON_DISCOVERY_SCHEMA_VERSION = 1;
export const INCREMENT_REVIEW_SCHEMA_VERSION = 1;

const CONTENT_ID = /^[1-9]\d*$/u;
const PROFILE = /^increment-(\d{4})-(0[1-9]|1[0-2])$/u;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CAPTURE_ITEM_KEYS = Object.freeze([
  'contentId', 'episodeLabel', 'format', 'genres', 'koTitle', 'publicPageUrl', 'year',
]);
const DISCOVERY_STATES = Object.freeze([
  'EXISTING_BOUND', 'AMBIGUOUS_BINDING', 'LIKELY_EXISTING_TITLE',
  'AMBIGUOUS_EXISTING_TITLE', 'POSSIBLE_EXISTING_TITLE_VARIANT', 'NEW_CANDIDATE',
]);
const DISCOVERY_CANDIDATE_KEYS = Object.freeze([
  ...CAPTURE_ITEM_KEYS, 'aliases', 'anilistId', 'decision', 'discoveryState',
  'reviewedAt', 'reviewedBy', 'suggestedAniListIds',
]);

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  return isPlainRecord(value)
    && stableStringify(Object.keys(value).sort()) === stableStringify([...keys].sort());
}

function boundedText(value, maximum = 500) {
  return typeof value === 'string' && value.trim() && value.length <= maximum ? value.trim() : null;
}

function exactIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  try {
    return new Date(value).toISOString() === value;
  } catch {
    return false;
  }
}

function exactDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validProfile(profile, year, asOfDate) {
  const match = typeof profile === 'string' ? profile.match(PROFILE) : null;
  return Boolean(match && Number(match[1]) === year && match[2] === asOfDate.slice(5, 7));
}

function configuredOrigin(sourceConfig) {
  if (sourceConfig === undefined) return null;
  try {
    const parsed = new URL(sourceConfig?.baseUrl);
    return sourceConfig?.sourceId === 'anilife_public' && parsed.protocol === 'https:'
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
      && parsed.pathname === '/' && parsed.origin === sourceConfig.baseUrl ? parsed.origin : null;
  } catch {
    return null;
  }
}

function originFromSeasonUrl(value, year) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && !parsed.search && !parsed.hash && parsed.pathname === `/season/${year}` ? parsed.origin : null;
  } catch {
    return null;
  }
}

function contentUrl(contentId, origin) {
  return `${origin}/content/${contentId}`;
}

function validContentUrl(value, contentId, origin = null) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && !parsed.search && !parsed.hash && parsed.pathname === `/content/${contentId}`
      && (origin === null || parsed.origin === origin);
  } catch {
    return false;
  }
}

function normalizeExactTitle(value) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('und');
}

function normalizeLooseTitle(value) {
  return normalizeExactTitle(value).replace(/[\p{P}\p{S}\p{Z}]+/gu, '');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => Number(left) - Number(right));
}

function indexAliases(aliases, normalizer) {
  const index = new Map();
  for (const row of aliases) {
    const anilistId = String(row.anilistId);
    for (const title of [row.ko, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
      if (typeof title !== 'string' || !title.trim()) continue;
      const key = normalizer(title);
      const values = index.get(key) ?? [];
      values.push(anilistId);
      index.set(key, uniqueSorted(values));
    }
  }
  return index;
}

function reverseBindings(bindings) {
  const result = new Map();
  if (!isPlainRecord(bindings)) return result;
  for (const [targetKey, binding] of Object.entries(bindings)) {
    const anilistId = targetKey.match(/^ANILIST:([1-9]\d*)$/u)?.[1];
    if (!anilistId || !isPlainRecord(binding) || !CONTENT_ID.test(binding.contentId ?? '')) continue;
    const current = result.get(binding.contentId) ?? [];
    current.push(anilistId);
    result.set(binding.contentId, uniqueSorted(current));
  }
  return result;
}

function candidateState({ boundIds, exactIds, looseIds }) {
  if (boundIds.length === 1) return 'EXISTING_BOUND';
  if (boundIds.length > 1) return 'AMBIGUOUS_BINDING';
  if (exactIds.length === 1) return 'LIKELY_EXISTING_TITLE';
  if (exactIds.length > 1) return 'AMBIGUOUS_EXISTING_TITLE';
  if (looseIds.length === 1) return 'POSSIBLE_EXISTING_TITLE_VARIANT';
  if (looseIds.length > 1) return 'AMBIGUOUS_EXISTING_TITLE';
  return 'NEW_CANDIDATE';
}

function validateAliases(aliases) {
  return Array.isArray(aliases) && aliases.every((row) => isPlainRecord(row)
    && CONTENT_ID.test(String(row.anilistId ?? ''))
    && typeof row.ko === 'string' && row.ko.trim()
    && Array.isArray(row.aliases) && row.aliases.every((title) => typeof title === 'string'));
}

function validatedItem(item, year, origin) {
  if (!exactKeys(item, CAPTURE_ITEM_KEYS)
    || !CONTENT_ID.test(item.contentId ?? '')
    || !boundedText(item.koTitle)
    || item.year !== year
    || (item.format !== null && !boundedText(item.format, 40))
    || (item.episodeLabel !== null && !boundedText(item.episodeLabel, 40))
    || !Array.isArray(item.genres) || item.genres.length > 32
    || item.genres.some((genre) => !boundedText(genre, 100))
    || item.publicPageUrl !== contentUrl(item.contentId, origin)) {
    throw typedError('ANILIFE_SEASON_CAPTURE_INVALID', 'AniLife season capture item is invalid');
  }
  return Object.freeze({
    contentId: item.contentId,
    koTitle: item.koTitle.normalize('NFKC').trim().replace(/\s+/gu, ' '),
    format: item.format,
    episodeLabel: item.episodeLabel,
    genres: Object.freeze([...new Set(item.genres.map((genre) => genre.trim()))]),
    year,
    publicPageUrl: item.publicPageUrl,
  });
}

/** Validates a browser-captured public year index without accepting playback or API data. */
export function validateAniLifeSeasonCapture(input, { sourceConfig } = {}) {
  let capture;
  try {
    capture = structuredClone(input);
  } catch {
    throw typedError('ANILIFE_SEASON_CAPTURE_INVALID', 'AniLife season capture is not JSON-safe');
  }
  const captureOrigin = originFromSeasonUrl(capture?.sourceUrl, capture?.year);
  const requiredOrigin = configuredOrigin(sourceConfig);
  if (!exactKeys(capture, [
    'capturedAt', 'declaredTotal', 'items', 'pageCount', 'schemaVersion', 'sourceId', 'sourceUrl', 'year',
  ])
    || capture.schemaVersion !== ANILIFE_SEASON_CAPTURE_SCHEMA_VERSION
    || capture.sourceId !== 'anilife_public'
    || !Number.isInteger(capture.year) || capture.year < 1900 || capture.year > 2100
    || captureOrigin === null || (sourceConfig !== undefined && requiredOrigin === null)
    || (requiredOrigin !== null && captureOrigin !== requiredOrigin)
    || !exactIsoTimestamp(capture.capturedAt)
    || !Number.isInteger(capture.pageCount) || capture.pageCount < 1 || capture.pageCount > 100
    || !Number.isInteger(capture.declaredTotal) || capture.declaredTotal < 1 || capture.declaredTotal > 5000
    || !Array.isArray(capture.items) || capture.items.length !== capture.declaredTotal) {
    throw typedError('ANILIFE_SEASON_CAPTURE_INVALID', 'AniLife season capture header is invalid');
  }
  const items = capture.items.map((item) => validatedItem(item, capture.year, captureOrigin));
  if (new Set(items.map((item) => item.contentId)).size !== items.length) {
    throw typedError('ANILIFE_SEASON_CAPTURE_DUPLICATE', 'AniLife season capture has duplicate content ids');
  }
  return Object.freeze({ ...capture, items: Object.freeze(items) });
}

/** Produces a conservative title/binding diff. Title equality never auto-approves a new identity. */
export function buildAniLifeSeasonDiff({ capture, aliases, bindings = {}, sourceConfig } = {}) {
  const validated = validateAniLifeSeasonCapture(capture, { sourceConfig });
  if (!validateAliases(aliases)) {
    throw typedError('ANILIFE_SEASON_ALIASES_INVALID', 'Aliases roster is invalid');
  }
  const exactIndex = indexAliases(aliases, normalizeExactTitle);
  const looseIndex = indexAliases(aliases, normalizeLooseTitle);
  const boundIndex = reverseBindings(bindings);
  const candidates = validated.items.map((item) => {
    const boundIds = boundIndex.get(item.contentId) ?? [];
    const exactIds = exactIndex.get(normalizeExactTitle(item.koTitle)) ?? [];
    const looseIds = looseIndex.get(normalizeLooseTitle(item.koTitle)) ?? [];
    const suggestedAniListIds = uniqueSorted([...boundIds, ...exactIds, ...looseIds]);
    const state = candidateState({ boundIds, exactIds, looseIds });
    return Object.freeze({
      ...item,
      discoveryState: state,
      suggestedAniListIds: Object.freeze(suggestedAniListIds),
      decision: state === 'EXISTING_BOUND' ? 'CONFIRMED_EXISTING' : 'PENDING_REVIEW',
      anilistId: state === 'EXISTING_BOUND' ? boundIds[0] : null,
      aliases: Object.freeze([]),
      reviewedAt: null,
      reviewedBy: null,
    });
  });
  const counts = Object.freeze(candidates.reduce((result, candidate) => ({
    ...result,
    [candidate.discoveryState]: (result[candidate.discoveryState] ?? 0) + 1,
  }), {}));
  const core = {
    schemaVersion: ANILIFE_SEASON_DISCOVERY_SCHEMA_VERSION,
    sourceId: validated.sourceId,
    sourceUrl: validated.sourceUrl,
    year: validated.year,
    capturedAt: validated.capturedAt,
    pageCount: validated.pageCount,
    declaredTotal: validated.declaredTotal,
    candidateCount: candidates.length,
    counts,
    candidates: Object.freeze(candidates),
  };
  return Object.freeze({ ...core, contentHash: sha256(core) });
}

function mergeReviewRows(prior, candidates, sourceHash) {
  const priorRows = new Map((prior?.sourceHash === sourceHash && Array.isArray(prior?.rows) ? prior.rows : [])
    .filter((row) => isPlainRecord(row) && CONTENT_ID.test(row.contentId ?? ''))
    .map((row) => [row.contentId, row]));
  return candidates.map((candidate) => {
    const previous = priorRows.get(candidate.contentId);
    const unchangedTitle = previous?.ko === candidate.koTitle;
    return {
      contentId: candidate.contentId,
      ko: candidate.koTitle,
      format: candidate.format,
      episodeLabel: candidate.episodeLabel,
      genres: [...candidate.genres],
      year: candidate.year,
      publicPageUrl: candidate.publicPageUrl,
      discoveryState: candidate.discoveryState,
      suggestedAniListIds: [...candidate.suggestedAniListIds],
      decision: unchangedTitle ? previous.decision : candidate.decision,
      anilistId: unchangedTitle ? previous.anilistId : candidate.anilistId,
      aliases: unchangedTitle && Array.isArray(previous.aliases) ? previous.aliases : [],
      reviewedAt: unchangedTitle ? previous.reviewedAt : null,
      reviewedBy: unchangedTitle ? previous.reviewedBy : null,
    };
  });
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

/** Writes content-addressed discovery evidence and a separately editable review queue. */
export async function writeAniLifeSeasonDiscovery({
  workspace, capture, aliases, bindings = {}, profile, asOfDate, sourceConfig,
} = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  if (!exactDate(asOfDate) || !validProfile(profile, capture?.year, asOfDate)) {
    throw typedError('INCREMENT_PROFILE_INVALID', 'Increment profile must match the capture year and as-of month');
  }
  const diff = buildAniLifeSeasonDiff({ capture, aliases, bindings, sourceConfig });
  const directoryParts = ['discovery', 'anilife', `season-${diff.year}`];
  const directory = await assertCatalogWorkspaceMutation(workspace, directoryParts);
  await mkdir(directory, { recursive: true });
  const revisionPath = workspace.resolve(...directoryParts, `${diff.contentHash}.json`);
  const currentRevision = await readJson(revisionPath);
  if (currentRevision && stableStringify(currentRevision) !== stableStringify(diff)) {
    throw typedError('ANILIFE_DISCOVERY_COLLISION', 'Discovery hash maps to different content');
  }
  if (!currentRevision) await atomicWriteJson(revisionPath, diff);
  await atomicWriteJson(workspace.resolve(...directoryParts, 'current.json'), {
    year: diff.year,
    contentHash: diff.contentHash,
  });

  const reviewPath = await assertCatalogWorkspaceMutation(workspace, ['reviews', `${profile}.json`]);
  await mkdir(workspace.resolve('reviews'), { recursive: true });
  const prior = await readJson(reviewPath);
  const review = {
    schemaVersion: INCREMENT_REVIEW_SCHEMA_VERSION,
    profile,
    sourceId: diff.sourceId,
    sourceHash: diff.contentHash,
    year: diff.year,
    asOfDate,
    capturedAt: diff.capturedAt,
    summary: diff.counts,
    rows: mergeReviewRows(prior, diff.candidates, diff.contentHash),
  };
  await atomicWriteJson(reviewPath, review);
  return Object.freeze({ diff, review: Object.freeze(structuredClone(review)), revisionPath, reviewPath });
}

export function validateIncrementReview(input, { profile } = {}) {
  let review;
  try {
    review = structuredClone(input);
  } catch {
    throw typedError('INCREMENT_REVIEW_INVALID', 'Increment review is not JSON-safe');
  }
  if (!isPlainRecord(review) || review.schemaVersion !== INCREMENT_REVIEW_SCHEMA_VERSION
    || review.profile !== profile || !PROFILE.test(profile ?? '')
    || !CONTENT_ID.test(String(review.year)) || !exactDate(review.asOfDate)
    || !validProfile(profile, review.year, review.asOfDate)
    || review.sourceId !== 'anilife_public' || !/^[a-f0-9]{64}$/u.test(review.sourceHash ?? '')
    || !exactIsoTimestamp(review.capturedAt) || !isPlainRecord(review.summary)
    || !Array.isArray(review.rows) || review.rows.length < 1 || review.rows.length > 5000) {
    throw typedError('INCREMENT_REVIEW_INVALID', 'Increment review header is invalid');
  }
  if (new Set(review.rows.map((row) => row?.contentId)).size !== review.rows.length) {
    throw typedError('INCREMENT_REVIEW_INVALID', 'Increment review contains duplicate content ids');
  }
  for (const row of review.rows) {
    const approved = row?.decision === 'APPROVED_NEW';
    const reviewed = exactIsoTimestamp(row?.reviewedAt) && Boolean(boundedText(row?.reviewedBy, 200));
    const optionalAniListId = row?.anilistId === null || CONTENT_ID.test(String(row?.anilistId ?? ''));
    if (!isPlainRecord(row) || !CONTENT_ID.test(row.contentId ?? '') || !boundedText(row.ko)
      || row.year !== review.year || !validContentUrl(row.publicPageUrl, row.contentId)
      || !['CONFIRMED_EXISTING', 'PENDING_REVIEW', 'APPROVED_NEW', 'REJECTED'].includes(row.decision)
      || !Array.isArray(row.suggestedAniListIds)
      || row.suggestedAniListIds.some((id) => !CONTENT_ID.test(String(id)))
      || !Array.isArray(row.aliases) || row.aliases.some((title) => !boundedText(title))
      || !optionalAniListId || (approved ? !reviewed : row.reviewedAt !== null || row.reviewedBy !== null)) {
      throw typedError('INCREMENT_REVIEW_INVALID', 'Increment review row is invalid');
    }
  }
  return Object.freeze(review);
}

function validateStoredDiscovery(input) {
  let discovery;
  try {
    discovery = structuredClone(input);
  } catch {
    throw typedError('ANILIFE_DISCOVERY_INVALID', 'AniLife discovery is not JSON-safe');
  }
  const discoveryOrigin = originFromSeasonUrl(discovery?.sourceUrl, discovery?.year);
  if (!exactKeys(discovery, [
    'candidateCount', 'candidates', 'capturedAt', 'contentHash', 'counts', 'declaredTotal',
    'pageCount', 'schemaVersion', 'sourceId', 'sourceUrl', 'year',
  ]) || discovery.schemaVersion !== ANILIFE_SEASON_DISCOVERY_SCHEMA_VERSION
    || discovery.sourceId !== 'anilife_public'
    || discoveryOrigin === null
    || !exactIsoTimestamp(discovery.capturedAt)
    || !Number.isInteger(discovery.candidateCount) || discovery.candidateCount < 1
    || discovery.declaredTotal !== discovery.candidateCount
    || !Array.isArray(discovery.candidates) || discovery.candidates.length !== discovery.candidateCount
    || !isPlainRecord(discovery.counts) || !/^[a-f0-9]{64}$/u.test(discovery.contentHash ?? '')) {
    throw typedError('ANILIFE_DISCOVERY_INVALID', 'AniLife discovery header is invalid');
  }
  for (const candidate of discovery.candidates) {
    if (!exactKeys(candidate, DISCOVERY_CANDIDATE_KEYS) || !CONTENT_ID.test(candidate.contentId ?? '')
      || !boundedText(candidate.koTitle) || candidate.year !== discovery.year
      || candidate.publicPageUrl !== contentUrl(candidate.contentId, discoveryOrigin)
      || !DISCOVERY_STATES.includes(candidate.discoveryState)
      || !Array.isArray(candidate.suggestedAniListIds)
      || candidate.suggestedAniListIds.some((id) => !CONTENT_ID.test(String(id)))
      || !Array.isArray(candidate.aliases) || candidate.aliases.length !== 0
      || !['CONFIRMED_EXISTING', 'PENDING_REVIEW'].includes(candidate.decision)
      || candidate.reviewedAt !== null || candidate.reviewedBy !== null) {
      throw typedError('ANILIFE_DISCOVERY_INVALID', 'AniLife discovery candidate is invalid');
    }
    validatedItem(Object.fromEntries(CAPTURE_ITEM_KEYS.map((key) => [key, candidate[key]])), discovery.year, discoveryOrigin);
  }
  const counts = discovery.candidates.reduce((result, candidate) => ({
    ...result,
    [candidate.discoveryState]: (result[candidate.discoveryState] ?? 0) + 1,
  }), {});
  if (stableStringify(counts) !== stableStringify(discovery.counts)) {
    throw typedError('ANILIFE_DISCOVERY_INVALID', 'AniLife discovery counts are invalid');
  }
  const { contentHash, ...core } = discovery;
  if (sha256(core) !== contentHash) {
    throw typedError('ANILIFE_DISCOVERY_INVALID', 'AniLife discovery content hash is invalid');
  }
  return Object.freeze(discovery);
}

/** Proves that editable decisions still refer to the immutable discovery revision. */
export function validateIncrementReviewAgainstDiscovery(reviewInput, discoveryInput, { profile } = {}) {
  const review = validateIncrementReview(reviewInput, { profile });
  const discovery = validateStoredDiscovery(discoveryInput);
  if (review.sourceHash !== discovery.contentHash || review.sourceId !== discovery.sourceId
    || review.year !== discovery.year || review.capturedAt !== discovery.capturedAt
    || review.rows.length !== discovery.candidates.length) {
    throw typedError('INCREMENT_REVIEW_EVIDENCE_INVALID', 'Increment review does not match discovery evidence');
  }
  const candidates = new Map(discovery.candidates.map((candidate) => [candidate.contentId, candidate]));
  for (const row of review.rows) {
    const candidate = candidates.get(row.contentId);
    if (!candidate || row.ko !== candidate.koTitle || row.format !== candidate.format
      || row.episodeLabel !== candidate.episodeLabel || row.year !== candidate.year
      || row.publicPageUrl !== candidate.publicPageUrl || row.discoveryState !== candidate.discoveryState
      || stableStringify(row.genres) !== stableStringify(candidate.genres)
      || stableStringify(row.suggestedAniListIds) !== stableStringify(candidate.suggestedAniListIds)) {
      throw typedError('INCREMENT_REVIEW_EVIDENCE_INVALID', 'Increment review row drifted from discovery evidence');
    }
  }
  return review;
}

/** Bulk-accepts only conservative NEW_CANDIDATE rows for local TEST_ONLY evaluation. */
export async function approveAniLifeNewCandidates({
  workspace, profile, reviewedBy, clock = { now: () => new Date().toISOString() },
} = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  if (!PROFILE.test(profile ?? '') || !boundedText(reviewedBy, 200)
    || !clock || typeof clock.now !== 'function') {
    throw typedError('INCREMENT_REVIEW_APPROVAL_INVALID', 'Increment candidate approval input is invalid');
  }
  const reviewPath = workspace.resolve('reviews', `${profile}.json`);
  const review = await readJson(reviewPath);
  const discovery = review ? await readJson(workspace.resolve(
    'discovery', 'anilife', `season-${review.year}`, `${review.sourceHash}.json`,
  )) : null;
  validateIncrementReviewAgainstDiscovery(review, discovery, { profile });
  const reviewedAt = clock.now();
  if (!exactIsoTimestamp(reviewedAt)) {
    throw typedError('INCREMENT_REVIEW_APPROVAL_INVALID', 'Increment candidate approval time is invalid');
  }
  let approvedCount = 0;
  const next = {
    ...review,
    rows: review.rows.map((row) => {
      if (row.discoveryState !== 'NEW_CANDIDATE' || row.decision !== 'PENDING_REVIEW') return row;
      approvedCount += 1;
      return {
        ...row, decision: 'APPROVED_NEW', anilistId: null, reviewedAt, reviewedBy: reviewedBy.trim(),
      };
    }),
  };
  if (approvedCount < 1) {
    throw typedError('INCREMENT_REVIEW_APPROVAL_EMPTY', 'No new candidates are awaiting approval');
  }
  validateIncrementReviewAgainstDiscovery(next, discovery, { profile });
  await atomicWriteJson(reviewPath, next);
  return Object.freeze({ approvedCount, reviewedAt, review: Object.freeze(structuredClone(next)) });
}
