import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CATALOG_LAB_USER_AGENT = 'MOEMOA-Catalog-Lab/0.1 (permissioned catalog processing; https://github.com/Newrred/anime-collector)';
export const SOURCE_EXECUTION_SCOPES = Object.freeze([
  'TARGET_ROSTER_ONLY',
  'LOCAL_TEST_MAX_100',
  'LOCAL_SAMPLE_MAX_100',
  'LOCAL_TEST_FULL_ROSTER_BATCHED',
]);

const ANILIFE_FIELD_PROMOTION = Object.freeze({
  externalIds: 'FIELD_REVIEW_REQUIRED',
  titles: 'FIELD_REVIEW_REQUIRED',
  format: 'FIELD_REVIEW_REQUIRED',
  status: 'FIELD_REVIEW_REQUIRED',
  season: 'PROHIBITED',
  startDate: 'FIELD_REVIEW_REQUIRED',
  endDate: 'PROHIBITED',
  episodeCount: 'FIELD_REVIEW_REQUIRED',
  sourceMaterialType: 'PROHIBITED',
  officialSiteUrl: 'PROHIBITED',
  studios: 'PROHIBITED',
  relations: 'PROHIBITED',
  sourceGenres: 'PROHIBITED',
  coreGenres: 'PROHIBITED',
  characters: 'PROHIBITED',
  castings: 'PROHIBITED',
  cover: 'FIELD_REVIEW_REQUIRED',
});

const VALIDATED_REGISTRY_ENTRIES = new WeakSet();
const APPROVED_SOURCE_POLICIES = Object.freeze({
  legacy_aliases: Object.freeze({
    sourceRole: 'seed_baseline', executionScope: 'TARGET_ROSTER_ONLY',
    allowedMethod: 'local_file', catalogPromotion: 'PROHIBITED', redistributionStatus: 'PROHIBITED', minIntervalMs: 0,
    allowedPaths: Object.freeze(['src/data/aliases.json']),
    allowedFields: Object.freeze(['anilistId', 'ko', 'aliases']),
  }),
  anilist: Object.freeze({
    sourceRole: 'direct_import', executionScope: 'LOCAL_TEST_FULL_ROSTER_BATCHED',
    allowedMethod: 'api', catalogPromotion: 'FIELD_REVIEW_REQUIRED',
    commercialUseStatus: 'USER_ATTESTED_PRODUCTION_DEPLOYMENT_PERMISSION',
    persistentStorageStatus: 'USER_ATTESTED_PRODUCTION_DEPLOYMENT_PERMISSION',
    redistributionStatus: 'USER_ATTESTED_PRODUCTION_DEPLOYMENT_PERMISSION',
    minIntervalMs: 2500, maxIntervalMs: 10000,
    allowedPaths: Object.freeze(['/']),
    allowedFields: Object.freeze(['media', 'relations', 'characters', 'staff', 'coverImage']),
    permissionBasis: 'USER_ATTESTED_ANILIST_PRODUCTION_PERMISSION',
    permissionRecordedAt: '2026-09-03T16:28:23+09:00',
    permissionScope: 'PRODUCTION_STORAGE_DISPLAY_AND_DEPLOYMENT',
    permissionEvidenceLocation: 'USER_HELD_OUTSIDE_REPOSITORY',
  }),
  wikidata: Object.freeze({
    sourceRole: 'direct_import', executionScope: 'LOCAL_SAMPLE_MAX_100',
    allowedMethod: 'api', catalogPromotion: 'FIELD_REVIEW_REQUIRED', redistributionStatus: 'CC0', minIntervalMs: 1000,
    allowedPaths: Object.freeze(['/w/api.php']),
    allowedEndpoints: Object.freeze([
      Object.freeze({ origin: 'https://query.wikidata.org', path: '/sparql', minIntervalMs: 1000 }),
      Object.freeze({ origin: 'https://www.wikidata.org', path: '/w/api.php', minIntervalMs: 1000 }),
    ]),
    allowedFields: Object.freeze(['P8729', 'labels', 'aliases', 'claims', 'sitelinks']),
  }),
  anilife_public: Object.freeze({
    sourceRole: 'crosscheck_only', executionScope: 'LOCAL_TEST_MAX_100',
    allowedMethod: 'public_sitemap_and_html', catalogPromotion: 'FIELD_REVIEW_REQUIRED',
    commercialUseStatus: 'USER_ATTESTED_UNRESTRICTED_PERMISSION',
    persistentStorageStatus: 'USER_ATTESTED_UNRESTRICTED_PERMISSION',
    redistributionStatus: 'USER_ATTESTED_UNRESTRICTED_PERMISSION', minIntervalMs: 1500,
    allowedPaths: Object.freeze(['/sitemap.xml', '/content/{numericId}']),
    allowedFields: Object.freeze(['title', 'description', 'year', 'format', 'status', 'episodeCount', 'coverMetadata']),
    fieldPromotion: ANILIFE_FIELD_PROMOTION,
    permissionBasis: 'USER_ATTESTED_ANILIFE_REDISTRIBUTION_PERMISSION',
    permissionRecordedAt: '2026-09-03T14:07:15+09:00',
    permissionScope: 'UNRESTRICTED_DATA_AND_COVER_PRODUCTION_USE',
    permissionEvidenceLocation: 'USER_HELD_OUTSIDE_REPOSITORY',
  }),
});
/** Portable promotion-only projection, including the local reviewed-increment seed. */
export const SOURCE_PROMOTION_POLICY = Object.freeze({
  ...Object.fromEntries(Object.entries(APPROVED_SOURCE_POLICIES).map(([sourceId, policy]) => [
    sourceId, policy.catalogPromotion,
  ])),
  reviewed_increment: 'PROHIBITED',
});
export const SOURCE_DISTRIBUTION_POLICY = Object.freeze({
  legacy_aliases: 'PROHIBITED',
  anilist: 'PERMISSIONED',
  wikidata: 'CC0',
  anilife_public: 'PERMISSIONED',
  reviewed_increment: 'PROHIBITED',
});
export const SOURCE_FIELD_PROMOTION_POLICY = Object.freeze({
  anilife_public: ANILIFE_FIELD_PROMOTION,
});

export function sourcePromotionForField(sourceId, fieldPath) {
  const sourcePolicy = SOURCE_PROMOTION_POLICY[sourceId];
  if (!sourcePolicy) return null;
  return SOURCE_FIELD_PROMOTION_POLICY[sourceId]?.[fieldPath] ?? sourcePolicy;
}
const ANILIFE_BLOCKED_PATHS = Object.freeze([
  '/api/', '/archive', '/history', '/settings', '/login', '/notifications',
]);
const REQUIRED_STRING_FIELDS = Object.freeze([
  'sourceId', 'sourceName', 'baseUrl', 'sourceRole', 'status', 'executionScope', 'allowedMethod',
  'catalogPromotion', 'commercialUseStatus', 'persistentStorageStatus', 'redistributionStatus',
  'termsUrl', 'robotsUrl', 'robotsReviewedAt', 'termsReviewedAt', 'reviewedBy', 'userAgent', 'notes',
]);

function registryInvalidError() {
  const error = new Error('Catalog source registry is invalid');
  error.code = 'SOURCE_REGISTRY_INVALID';
  return error;
}

function matchesStringList(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function matchesEndpointList(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((endpoint, index) => endpoint && typeof endpoint === 'object'
      && Object.keys(endpoint).length === 3
      && endpoint.origin === expected[index].origin
      && endpoint.path === expected[index].path
      && endpoint.minIntervalMs === expected[index].minIntervalMs);
}

function exactHttpsOrigin(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && !parsed.search && !parsed.hash && parsed.pathname === '/' && parsed.origin === value;
  } catch {
    return false;
  }
}

function exactCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function matchesStringRecord(actual, expected) {
  return actual && typeof actual === 'object' && !Array.isArray(actual)
    && Object.keys(actual).length === Object.keys(expected).length
    && Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function validAniLifeRuntimePolicy(entry) {
  if (!exactHttpsOrigin(entry.baseUrl)
    || !Array.isArray(entry.coverOrigins) || entry.coverOrigins.length < 1
    || new Set(entry.coverOrigins).size !== entry.coverOrigins.length
    || entry.coverOrigins.some((origin) => !exactHttpsOrigin(origin))
    || entry.originReviewedUrl !== entry.baseUrl
    || !exactCalendarDate(entry.originReviewedAt)
    || !['REVIEWED', 'UNAVAILABLE_REVIEW_REQUIRED'].includes(entry.robotsReviewStatus)
    || !['REUSE_GRANT_RECORDED', 'NO_REUSE_GRANT_FOUND'].includes(entry.termsReviewStatus)
    || !matchesStringRecord(entry.fieldPromotion, ANILIFE_FIELD_PROMOTION)) return false;
  try {
    return new URL(entry.termsUrl).origin === entry.baseUrl
      && entry.robotsUrl === `${entry.baseUrl}/robots.txt`
      && entry.evidenceUrls.includes(`${entry.baseUrl}/sitemap.xml`)
      && entry.evidenceUrls.includes(`${entry.baseUrl}/robots.txt`);
  } catch {
    return false;
  }
}

function validateRegistry(registry) {
  if (!Array.isArray(registry) || registry.length !== Object.keys(APPROVED_SOURCE_POLICIES).length) {
    throw registryInvalidError();
  }
  const sourceIds = new Set();
  for (const entry of registry) {
    if (!entry || typeof entry !== 'object' || sourceIds.has(entry.sourceId)) throw registryInvalidError();
    sourceIds.add(entry.sourceId);
    if (REQUIRED_STRING_FIELDS.some((field) => typeof entry[field] !== 'string' || !entry[field])) {
      throw registryInvalidError();
    }
    if (!Array.isArray(entry.allowedPaths) || !Array.isArray(entry.allowedFields)
      || !Array.isArray(entry.evidenceUrls) || !Number.isInteger(entry.minIntervalMs)
      || entry.minIntervalMs < 0
      || ('maxIntervalMs' in entry && (!Number.isInteger(entry.maxIntervalMs)
        || entry.maxIntervalMs < entry.minIntervalMs))
      || entry.maxConcurrency !== 1 || entry.status !== 'approved') {
      throw registryInvalidError();
    }
    const policy = APPROVED_SOURCE_POLICIES[entry.sourceId];
    if (!policy || !SOURCE_EXECUTION_SCOPES.includes(entry.executionScope)
      || Object.entries(policy).some(([field, value]) => !Array.isArray(value)
        && (value === null || typeof value !== 'object') && entry[field] !== value)
      || !matchesStringList(entry.allowedPaths, policy.allowedPaths)
      || !matchesStringList(entry.allowedFields, policy.allowedFields)
      || (policy.fieldPromotion && !matchesStringRecord(entry.fieldPromotion, policy.fieldPromotion))
      || (policy.allowedEndpoints
        ? !matchesEndpointList(entry.allowedEndpoints, policy.allowedEndpoints)
        : 'allowedEndpoints' in entry)) {
      throw registryInvalidError();
    }
    if (entry.sourceId === 'anilife_public' && (!Array.isArray(entry.blockedPaths)
      || entry.blockedPaths.length !== ANILIFE_BLOCKED_PATHS.length
      || entry.blockedPaths.some((path, index) => path !== ANILIFE_BLOCKED_PATHS[index])
      || !validAniLifeRuntimePolicy(entry))) {
      throw registryInvalidError();
    }
  }
  if (sourceIds.size !== Object.keys(APPROVED_SOURCE_POLICIES).length) throw registryInvalidError();
}

/**
 * Loads the approved local-only source registry without making a network request.
 *
 * @param {{repoRoot: string}} input
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function loadSourceRegistry({ repoRoot }) {
  const file = join(repoRoot, 'tools', 'catalog-lab', 'config', 'source-registry.json');
  let registry;
  try {
    registry = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw registryInvalidError();
  }
  validateRegistry(registry);
  const validated = registry.map((entry) => Object.freeze({
    ...entry,
    allowedPaths: Object.freeze([...entry.allowedPaths]),
    allowedFields: Object.freeze([...entry.allowedFields]),
    evidenceUrls: Object.freeze([...entry.evidenceUrls]),
    ...(entry.allowedEndpoints ? {
      allowedEndpoints: Object.freeze(entry.allowedEndpoints.map((endpoint) => Object.freeze({ ...endpoint }))),
    } : {}),
    ...(entry.blockedPaths ? { blockedPaths: Object.freeze([...entry.blockedPaths]) } : {}),
    ...(entry.coverOrigins ? { coverOrigins: Object.freeze([...entry.coverOrigins]) } : {}),
    ...(entry.fieldPromotion ? { fieldPromotion: Object.freeze({ ...entry.fieldPromotion }) } : {}),
  }));
  validated.forEach((entry) => VALIDATED_REGISTRY_ENTRIES.add(entry));
  return Object.freeze(validated);
}

/** Returns only a registry entry produced by loadSourceRegistry(). */
export function requireValidatedSourceRegistryEntry(entry, sourceId) {
  if (!entry || !VALIDATED_REGISTRY_ENTRIES.has(entry) || entry.sourceId !== sourceId) {
    throw registryInvalidError();
  }
  return entry;
}

/**
 * Prevents a source adapter from exceeding its explicitly approved sample scope.
 *
 * @param {{sourceId?: string, status?: string, executionScope?: string}} registryEntry
 * @param {number} targetCount
 * @param {{profileTargetCount?: number}} options
 */
export function assertSourceExecution(registryEntry, targetCount, { profileTargetCount = targetCount } = {}) {
  if (!registryEntry || !VALIDATED_REGISTRY_ENTRIES.has(registryEntry)) {
    const error = new Error('Catalog source is not registered for execution');
    error.code = 'SOURCE_NOT_REGISTERED';
    throw error;
  }
  if (!Number.isInteger(targetCount) || targetCount < 1
    || !Number.isInteger(profileTargetCount) || profileTargetCount < targetCount) {
    const error = new Error('Catalog target count must be a positive integer');
    error.code = 'SOURCE_TARGET_COUNT_INVALID';
    throw error;
  }
  if (!SOURCE_EXECUTION_SCOPES.includes(registryEntry.executionScope)) {
    const error = new Error('Catalog source execution scope is invalid');
    error.code = 'SOURCE_EXECUTION_SCOPE_INVALID';
    throw error;
  }
  if ((registryEntry.executionScope === 'LOCAL_TEST_MAX_100'
    || registryEntry.executionScope === 'LOCAL_SAMPLE_MAX_100') && profileTargetCount > 100) {
    const error = new Error('Catalog source execution scope exceeds 100 targets');
    error.code = 'SOURCE_SCOPE_EXCEEDED';
    throw error;
  }
  if (registryEntry.executionScope === 'LOCAL_TEST_FULL_ROSTER_BATCHED'
    && (targetCount > 100 || profileTargetCount > 3998)) {
    const error = new Error('Catalog source execution scope exceeds its approved full-roster batch');
    error.code = 'SOURCE_SCOPE_EXCEEDED';
    throw error;
  }
}

/**
 * Rejects a network destination unless it is an exact endpoint approved by the source policy.
 * This guard is independent of query parameters, which are validated by each source adapter.
 */
export function assertSourceEndpoint(sourceId, url) {
  const policy = APPROVED_SOURCE_POLICIES[sourceId];
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    parsed = null;
  }
  if (!policy?.allowedEndpoints || !parsed || parsed.username || parsed.password
    || !policy.allowedEndpoints.some((endpoint) => (
      endpoint.origin === parsed.origin && endpoint.path === parsed.pathname
    ))) {
    const error = new Error('Catalog source endpoint is not approved');
    error.code = 'SOURCE_ENDPOINT_FORBIDDEN';
    throw error;
  }
}
