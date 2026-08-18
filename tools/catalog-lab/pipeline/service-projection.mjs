import { sha256, stableStringify } from '../lib/hash.mjs';
import {
  SEMANTIC_REVIEW_OVERRIDES, SEMANTIC_REVIEW_POLICY_VERSION,
} from '../config/semantic-review-overrides.mjs';

export const SERVICE_PROJECTION_SCHEMA_VERSION = 1;
export const SERVICE_PROJECTION_POLICY_VERSION = 'SERVICE_PROJECTION_V1';

export const SERVICE_FIELD_TIERS = Object.freeze({
  required: Object.freeze(['externalIds', 'preferredTitle', 'format', 'status', 'cover']),
  recommended: Object.freeze(['episodeCount', 'sourceMaterialType', 'studios', 'sourceGenres']),
  optional: Object.freeze([
    'officialLinks', 'coreGenres', 'characters', 'castings', 'relations',
    'season', 'startDate', 'endDate',
  ]),
});

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function snapshot(value) {
  try {
    return structuredClone(value);
  } catch {
    throw typedError('SERVICE_PROJECTION_INPUT_INVALID', 'Service projection input must be JSON-safe');
  }
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function frozen(value) {
  return deepFreeze(snapshot(value));
}

function validateCanonical(target, canonical) {
  if (!target || typeof target !== 'object' || typeof target.targetKey !== 'string'
    || typeof target.moemoaAnimeId !== 'string' || !canonical || typeof canonical !== 'object'
    || canonical.id !== target.moemoaAnimeId || canonical.revision?.algorithm !== 'SHA-256'
    || typeof canonical.revision?.contentHash !== 'string') {
    throw typedError('SERVICE_PROJECTION_INPUT_INVALID', 'Target and canonical identity must match');
  }
  const { revision: _revision, ...core } = canonical;
  if (!/^[a-f0-9]{64}$/u.test(canonical.revision.contentHash)
    || canonical.revision.contentHash !== sha256(core)) {
    throw typedError('SERVICE_PROJECTION_CANONICAL_INVALID', 'Canonical revision integrity is invalid');
  }
}

function normalizedTitle(value) {
  if (!value || typeof value !== 'object' || typeof value.locale !== 'string'
    || typeof value.value !== 'string') return null;
  const title = value.value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  return title ? { locale: value.locale, value: title } : null;
}

function canonicalValues(field) {
  if (field?.state === 'VALUE') return Array.isArray(field.value) ? field.value : [field.value];
  if (field?.state === 'CONFLICTED' && Array.isArray(field.values)) return field.values;
  return [];
}

function uniqueBy(values, keyOf) {
  const rows = new Map();
  for (const value of values) {
    const key = keyOf(value);
    if (!rows.has(key)) rows.set(key, value);
  }
  return [...rows.values()];
}

const TITLE_LOCALE_ORDER = Object.freeze(['ko', 'en', 'ja-Latn', 'ja', 'und']);

function titleOrder(left, right) {
  const leftRank = TITLE_LOCALE_ORDER.indexOf(left.locale);
  const rightRank = TITLE_LOCALE_ORDER.indexOf(right.locale);
  return (leftRank < 0 ? Number.MAX_SAFE_INTEGER : leftRank)
    - (rightRank < 0 ? Number.MAX_SAFE_INTEGER : rightRank)
    || left.value.localeCompare(right.value);
}

function titleProjection(target, canonical) {
  const seedKorean = Array.isArray(target.seedTitles)
    ? target.seedTitles.map(normalizedTitle).filter((title) => title?.locale === 'ko') : [];
  if (target.seedSource !== 'legacy_aliases' || seedKorean.length !== 1) {
    throw typedError('SERVICE_PROJECTION_TITLE_BASELINE_INVALID', 'One legacy Korean title is required');
  }
  const preferredTitle = seedKorean[0];
  const canonicalTitles = uniqueBy(
    canonicalValues(canonical.titles).map(normalizedTitle).filter(Boolean),
    (title) => stableStringify([title.locale, title.value]),
  );
  const searchTitles = uniqueBy([
    preferredTitle,
    ...canonicalTitles.filter((title) => title.locale !== 'ko'),
  ], (title) => stableStringify([title.locale, title.value])).sort(titleOrder);
  searchTitles.sort((left, right) => (
    left.locale === preferredTitle.locale && left.value === preferredTitle.value ? -1
      : right.locale === preferredTitle.locale && right.value === preferredTitle.value ? 1
        : titleOrder(left, right)
  ));
  const quarantinedTitles = canonicalTitles
    .filter((title) => title.locale === 'ko' && title.value !== preferredTitle.value)
    .map((title) => ({ ...title, reasonCode: 'SOURCE_KOREAN_TITLE_REVIEW_REQUIRED' }))
    .sort((left, right) => left.value.localeCompare(right.value));
  return { preferredTitle, searchTitles, quarantinedTitles };
}

function normalizedOfficialUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }
    return url;
  } catch {
    return null;
  }
}

function inferredLocale(url) {
  const firstSegment = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  if (['en', 'eng', 'english'].includes(firstSegment) || url.hostname.startsWith('en.')) return 'en';
  if (['ja', 'jp', 'jpn', 'japanese'].includes(firstSegment) || url.hostname.startsWith('ja.')) return 'ja';
  return 'und';
}

function equivalencePath(url) {
  const segments = url.pathname.split('/').filter(Boolean);
  if (['en', 'eng', 'english', 'ja', 'jp', 'jpn', 'japanese'].includes(segments[0]?.toLowerCase())) {
    segments.shift();
  }
  return `/${segments.join('/')}`.replace(/\/$/u, '') || '/';
}

function officialLinksProjection(canonical) {
  const candidates = canonicalValues(canonical.officialSiteUrl)
    .map(normalizedOfficialUrl).filter(Boolean);
  const exactGroups = new Map();
  for (const url of candidates) {
    const key = `${url.hostname}${url.pathname.replace(/\/$/u, '') || '/'}${url.search}`;
    const existing = exactGroups.get(key);
    if (!existing || (existing.protocol === 'http:' && url.protocol === 'https:')) exactGroups.set(key, url);
  }
  const deduplicated = [...exactGroups.values()];
  const equivalenceKeys = new Set(deduplicated.map((url) => (
    `${url.hostname}${equivalencePath(url)}${url.search}`
  )));
  const autoEquivalent = deduplicated.length > 0 && equivalenceKeys.size === 1;
  const reviewState = autoEquivalent ? 'AUTO_EQUIVALENT' : 'PENDING_REVIEW';
  const officialLinks = deduplicated.map((url) => ({
    url: url.href,
    host: url.hostname,
    locale: inferredLocale(url),
    role: 'OFFICIAL_CANDIDATE',
    reviewState,
  })).sort((left, right) => left.url.localeCompare(right.url));
  const primaryOfficialSiteUrl = autoEquivalent
    ? [...officialLinks].sort((left, right) => {
      const localeRank = (locale) => ({ en: 0, und: 1, ja: 2 }[locale] ?? 3);
      return localeRank(left.locale) - localeRank(right.locale)
        || Number(right.url.startsWith('https:')) - Number(left.url.startsWith('https:'))
        || left.url.localeCompare(right.url);
    })[0]?.url ?? null
    : null;
  return { officialLinks, primaryOfficialSiteUrl, needsReview: officialLinks.length > 1 && !autoEquivalent };
}

function fieldState(canonical, fieldPath) {
  return typeof canonical[fieldPath]?.state === 'string' ? canonical[fieldPath].state : 'NOT_FETCHED';
}

function fieldTiers({ canonical, preferredTitle, cover, officialLinks, primaryOfficialSiteUrl }) {
  const states = {
    externalIds: fieldState(canonical, 'externalIds'),
    preferredTitle: preferredTitle ? 'VALUE' : 'SOURCE_NOT_AVAILABLE',
    format: fieldState(canonical, 'format'),
    status: fieldState(canonical, 'status'),
    cover: cover?.status === 'STORED' && typeof cover.checksum === 'string' ? 'VALUE' : 'SOURCE_NOT_AVAILABLE',
    episodeCount: fieldState(canonical, 'episodeCount'),
    sourceMaterialType: fieldState(canonical, 'sourceMaterialType'),
    studios: fieldState(canonical, 'studios'),
    sourceGenres: fieldState(canonical, 'sourceGenres'),
    officialLinks: officialLinks.length === 0
      ? fieldState(canonical, 'officialSiteUrl')
      : primaryOfficialSiteUrl ? 'VALUE' : 'PENDING_REVIEW',
    coreGenres: fieldState(canonical, 'coreGenres'),
    characters: fieldState(canonical, 'characters'),
    castings: fieldState(canonical, 'castings'),
    relations: fieldState(canonical, 'relations'),
    season: fieldState(canonical, 'season'),
    startDate: fieldState(canonical, 'startDate'),
    endDate: fieldState(canonical, 'endDate'),
  };
  return Object.fromEntries(Object.entries(SERVICE_FIELD_TIERS).map(([tier, fields]) => [
    tier, Object.fromEntries(fields.map((field) => [field, states[field]])),
  ]));
}

function readiness(fieldTierStates, reviewItems) {
  const missing = (tier) => Object.entries(fieldTierStates[tier])
    .filter(([, state]) => state !== 'VALUE').map(([field]) => field).sort();
  const requiredBlockers = missing('required');
  const recommendedGaps = missing('recommended');
  const optionalGaps = missing('optional');
  const status = requiredBlockers.length > 0 ? 'BLOCKED'
    : reviewItems.length > 0 ? 'READY_WITH_REVIEW'
      : recommendedGaps.length > 0 ? 'READY_WITH_GAPS' : 'READY';
  return { status, requiredBlockers, recommendedGaps, optionalGaps };
}

/** Builds a deterministic service-safe view without deleting source evidence from canonical data. */
export function buildServiceProjection(input = {}) {
  const target = snapshot(input.target);
  const canonical = snapshot(input.canonical);
  const cover = snapshot(input.cover ?? null);
  validateCanonical(target, canonical);
  const titles = titleProjection(target, canonical);
  const links = officialLinksProjection(canonical);
  const reviewItems = [];
  if (titles.quarantinedTitles.length > 0) reviewItems.push({
    field: 'titles', reasonCode: 'KOREAN_TITLE_CANDIDATES_QUARANTINED',
    candidateCount: titles.quarantinedTitles.length,
  });
  if (links.needsReview) reviewItems.push({
    field: 'officialLinks', reasonCode: 'OFFICIAL_LINK_SELECTION_REQUIRED',
    candidateCount: links.officialLinks.length,
  });
  const manualTitleReview = SEMANTIC_REVIEW_OVERRIDES.titleReviews[target.targetKey];
  if (manualTitleReview) reviewItems.push({
    field: 'preferredTitle', reasonCode: manualTitleReview.reasonCode, candidateCount: 1,
  });
  const tiers = fieldTiers({ canonical, preferredTitle: titles.preferredTitle, cover, ...links });
  const core = {
    schemaVersion: SERVICE_PROJECTION_SCHEMA_VERSION,
    policyVersion: SERVICE_PROJECTION_POLICY_VERSION,
    semanticReviewPolicyVersion: SEMANTIC_REVIEW_POLICY_VERSION,
    targetKey: target.targetKey,
    animeId: target.moemoaAnimeId,
    canonicalHash: canonical.revision.contentHash,
    preferredTitle: titles.preferredTitle,
    searchTitles: titles.searchTitles,
    quarantinedTitles: titles.quarantinedTitles,
    officialLinks: links.officialLinks,
    primaryOfficialSiteUrl: links.primaryOfficialSiteUrl,
    fieldTiers: tiers,
    reviewItems,
    readiness: readiness(tiers, reviewItems),
  };
  return frozen({ ...core, projectionHash: sha256(core) });
}
