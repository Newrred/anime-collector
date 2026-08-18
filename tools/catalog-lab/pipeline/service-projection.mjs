import { sha256, stableStringify } from '../lib/hash.mjs';
import {
  SEMANTIC_AUTOMATION_OVERRIDES, SEMANTIC_AUTOMATION_POLICY_VERSION,
} from '../config/semantic-review-overrides.mjs';

export const SERVICE_PROJECTION_SCHEMA_VERSION = 1;
export const SERVICE_PROJECTION_POLICY_VERSION = 'SERVICE_PROJECTION_V2_AUTOMATED_REVIEW';

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

function titleComparisonKey(value) {
  return value.normalize('NFKC').toLocaleLowerCase('und')
    .replace(/^\s*(?:\[[^\]]+\]|\([^)]*\)|극장판)\s*/gu, '')
    .replace(/[\p{P}\p{S}\p{Z}]+/gu, '');
}

function editDistance(left, right) {
  const a = [...left];
  const b = [...right];
  let prior = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= a.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= b.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        prior[rightIndex] + 1,
        prior[rightIndex - 1] + Number(a[leftIndex - 1] !== b[rightIndex - 1]),
      );
    }
    prior = current;
  }
  return prior[b.length];
}

function isHighConfidenceKoreanAlias(preferred, candidate) {
  const preferredKey = titleComparisonKey(preferred.value);
  const candidateKey = titleComparisonKey(candidate.value);
  if (!preferredKey || !candidateKey) return false;
  if (preferredKey === candidateKey) return true;
  const minimumLength = Math.min([...preferredKey].length, [...candidateKey].length);
  const maximumLength = Math.max([...preferredKey].length, [...candidateKey].length);
  if (minimumLength >= 4
    && (preferredKey.includes(candidateKey) || candidateKey.includes(preferredKey))
    && minimumLength / maximumLength >= 0.7) return true;
  return minimumLength >= 4 && 1 - (editDistance(preferredKey, candidateKey) / maximumLength) >= 0.75;
}

function hasUnbalancedPairs(value) {
  const pairs = [['(', ')'], ['[', ']'], ['{', '}'], ['（', '）'], ['「', '」'], ['『', '』']];
  return pairs.some(([open, close]) => [...value].filter((character) => character === open).length
    !== [...value].filter((character) => character === close).length);
}

function isSuspiciousLegacyTitle(title, canonicalTitles, forcedFallback) {
  if (forcedFallback) return true;
  const value = title.value.trim();
  if (!/[\p{L}\p{N}]/u.test(value) || hasUnbalancedPairs(value) || /[:[(（]$/u.test(value)) return true;
  const compactLength = [...value.replace(/\s+/gu, '')].length;
  const hasLongerFallback = canonicalTitles.some((candidate) => candidate.locale !== 'ko'
    && [...candidate.value.replace(/\s+/gu, '')].length >= compactLength * 2);
  return compactLength <= 4 && /(?:의|와|과|및)$/u.test(value) && hasLongerFallback;
}

function titleProjection(target, canonical) {
  const seedKorean = Array.isArray(target.seedTitles)
    ? target.seedTitles.map(normalizedTitle).filter((title) => title?.locale === 'ko') : [];
  if (target.seedSource !== 'legacy_aliases' || seedKorean.length !== 1) {
    throw typedError('SERVICE_PROJECTION_TITLE_BASELINE_INVALID', 'One legacy Korean title is required');
  }
  const canonicalTitles = uniqueBy(
    canonicalValues(canonical.titles).map(normalizedTitle).filter(Boolean),
    (title) => stableStringify([title.locale, title.value]),
  );
  const legacyTitle = seedKorean[0];
  const forcedFallback = SEMANTIC_AUTOMATION_OVERRIDES.titleFallbacks[target.targetKey];
  const suspiciousLegacyTitle = isSuspiciousLegacyTitle(legacyTitle, canonicalTitles, forcedFallback);
  const fallbackTitle = [...canonicalTitles].filter((title) => title.locale !== 'ko').sort(titleOrder)[0] ?? null;
  const preferredTitle = suspiciousLegacyTitle ? fallbackTitle : legacyTitle;
  const sourceKoreanTitles = canonicalTitles
    .filter((title) => title.locale === 'ko' && title.value !== legacyTitle.value);
  const autoAcceptedTitleAliases = suspiciousLegacyTitle ? [] : sourceKoreanTitles
    .filter((title) => isHighConfidenceKoreanAlias(legacyTitle, title))
    .map(({ locale, value }) => ({ locale, value }))
    .sort(titleOrder);
  const searchTitles = uniqueBy([
    ...(preferredTitle ? [preferredTitle] : []),
    ...autoAcceptedTitleAliases,
    ...canonicalTitles.filter((title) => title.locale !== 'ko'),
  ], (title) => stableStringify([title.locale, title.value])).sort(titleOrder);
  if (preferredTitle) searchTitles.sort((left, right) => (
    left.locale === preferredTitle.locale && left.value === preferredTitle.value ? -1
      : right.locale === preferredTitle.locale && right.value === preferredTitle.value ? 1
        : titleOrder(left, right)
  ));
  const quarantinedTitles = [
    ...(suspiciousLegacyTitle ? [{
      ...legacyTitle, reasonCode: 'SUSPICIOUS_LEGACY_KOREAN_TITLE',
    }] : []),
    ...sourceKoreanTitles
      .filter((title) => !autoAcceptedTitleAliases.some((accepted) => accepted.value === title.value))
      .map((title) => ({ ...title, reasonCode: 'LOW_CONFIDENCE_SOURCE_KOREAN_TITLE' })),
  ]
    .sort((left, right) => left.value.localeCompare(right.value));
  return {
    preferredTitle, searchTitles, autoAcceptedTitleAliases, quarantinedTitles,
    usedFallback: suspiciousLegacyTitle && Boolean(fallbackTitle),
    fallbackReasonCode: forcedFallback?.reasonCode ?? (suspiciousLegacyTitle ? 'LEGACY_TITLE_SHAPE_ANOMALY' : null),
  };
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

const AUXILIARY_OFFICIAL_HOST = /(?:^|\.)(?:ani\.gamer\.com\.tw|crunchyroll\.com|funimation\.com|netflix\.com|amazon\.[a-z.]+|sonypictures\.com|tv-tokyo\.co\.jp|tbs\.co\.jp|asahi\.co\.jp)$/u;

function titleBrandRank(url, canonical) {
  const titleKeys = canonicalValues(canonical.titles)
    .filter((title) => title?.locale !== 'ko' && typeof title?.value === 'string')
    .map((title) => title.value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/gu, ''))
    .filter(Boolean);
  const hostTokens = url.hostname.toLowerCase().split(/[.-]+/u)
    .filter((token) => token.length >= 4 && !['www', 'anime', 'official'].includes(token));
  return hostTokens.some((token) => titleKeys.some((title) => title.includes(token))) ? -50 : 0;
}

function officialLinkOrder(canonical, left, right) {
  const auxiliaryRank = (url) => (AUXILIARY_OFFICIAL_HOST.test(url.hostname) || /(?:stream|watch)/u.test(url.hostname) ? 100 : 0)
    + (url.hostname.startsWith('en.') ? 10 : 0);
  const localeRank = (url) => ({ en: 0, und: 1, ja: 2 }[inferredLocale(url)] ?? 3);
  const depth = (url) => url.pathname.split('/').filter(Boolean).length;
  return auxiliaryRank(left) - auxiliaryRank(right)
    || titleBrandRank(left, canonical) - titleBrandRank(right, canonical)
    || localeRank(left) - localeRank(right)
    || Number(right.protocol === 'https:') - Number(left.protocol === 'https:')
    || depth(right) - depth(left)
    || left.href.localeCompare(right.href);
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
  const primary = [...deduplicated].sort((left, right) => officialLinkOrder(canonical, left, right))[0] ?? null;
  const officialLinks = deduplicated.map((url) => ({
    url: url.href,
    host: url.hostname,
    locale: inferredLocale(url),
    role: url.href === primary?.href ? 'PRIMARY_OFFICIAL' : 'SECONDARY_OFFICIAL',
    selectionState: url.href === primary?.href ? 'AUTO_PRIMARY'
      : autoEquivalent ? 'AUTO_EQUIVALENT' : 'AUTO_SECONDARY',
  })).sort((left, right) => left.url.localeCompare(right.url));
  return {
    officialLinks,
    primaryOfficialSiteUrl: primary?.href ?? null,
    autoSelectedFromMultiple: officialLinks.length > 1 && !autoEquivalent,
  };
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
  const qualityWarnings = [];
  if (!titles.preferredTitle) reviewItems.push({
    field: 'preferredTitle', reasonCode: 'PREFERRED_TITLE_REQUIRED', candidateCount: 0,
  });
  if (titles.autoAcceptedTitleAliases.length > 0) qualityWarnings.push({
    field: 'titles', reasonCode: 'KOREAN_TITLE_ALIASES_AUTO_ACCEPTED',
    candidateCount: titles.autoAcceptedTitleAliases.length,
  });
  if (titles.quarantinedTitles.length > 0) qualityWarnings.push({
    field: 'titles', reasonCode: 'KOREAN_TITLE_CANDIDATES_QUARANTINED',
    candidateCount: titles.quarantinedTitles.length,
  });
  if (titles.usedFallback) qualityWarnings.push({
    field: 'preferredTitle', reasonCode: 'PREFERRED_TITLE_FALLBACK_USED', candidateCount: 1,
    detailCode: titles.fallbackReasonCode,
  });
  if (links.autoSelectedFromMultiple) qualityWarnings.push({
    field: 'officialLinks', reasonCode: 'OFFICIAL_LINK_AUTO_SELECTED',
    candidateCount: links.officialLinks.length,
  });
  const tiers = fieldTiers({ canonical, preferredTitle: titles.preferredTitle, cover, ...links });
  const core = {
    schemaVersion: SERVICE_PROJECTION_SCHEMA_VERSION,
    policyVersion: SERVICE_PROJECTION_POLICY_VERSION,
    semanticAutomationPolicyVersion: SEMANTIC_AUTOMATION_POLICY_VERSION,
    targetKey: target.targetKey,
    animeId: target.moemoaAnimeId,
    canonicalHash: canonical.revision.contentHash,
    preferredTitle: titles.preferredTitle,
    searchTitles: titles.searchTitles,
    autoAcceptedTitleAliases: titles.autoAcceptedTitleAliases,
    quarantinedTitles: titles.quarantinedTitles,
    officialLinks: links.officialLinks,
    primaryOfficialSiteUrl: links.primaryOfficialSiteUrl,
    fieldTiers: tiers,
    reviewItems,
    qualityWarnings,
    readiness: readiness(tiers, reviewItems),
  };
  return frozen({ ...core, projectionHash: sha256(core) });
}
