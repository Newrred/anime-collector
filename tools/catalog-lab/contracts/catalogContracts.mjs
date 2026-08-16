import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CATALOG_LAB_USER_AGENT = 'MOEMOA-Catalog-Lab/0.1 (personal local test; https://github.com/Newrred/anime-collector)';
export const SOURCE_EXECUTION_SCOPES = Object.freeze([
  'TARGET_ROSTER_ONLY',
  'LOCAL_TEST_MAX_100',
  'LOCAL_SAMPLE_MAX_100',
]);

const VALIDATED_REGISTRY_ENTRIES = new WeakSet();
const APPROVED_SOURCE_POLICIES = Object.freeze({
  legacy_aliases: Object.freeze({
    sourceRole: 'crosscheck_only', executionScope: 'TARGET_ROSTER_ONLY',
    allowedMethod: 'local_file', catalogPromotion: 'PROHIBITED', redistributionStatus: 'PROHIBITED', minIntervalMs: 0,
  }),
  anilist: Object.freeze({
    sourceRole: 'crosscheck_only', executionScope: 'LOCAL_TEST_MAX_100',
    allowedMethod: 'api', catalogPromotion: 'PROHIBITED', redistributionStatus: 'PROHIBITED', minIntervalMs: 800,
  }),
  wikidata: Object.freeze({
    sourceRole: 'direct_import', executionScope: 'LOCAL_SAMPLE_MAX_100',
    allowedMethod: 'api', catalogPromotion: 'FIELD_REVIEW_REQUIRED', redistributionStatus: 'CC0', minIntervalMs: 1000,
  }),
  anilife_public: Object.freeze({
    sourceRole: 'crosscheck_only', executionScope: 'LOCAL_TEST_MAX_100',
    allowedMethod: 'public_sitemap_and_html', catalogPromotion: 'PROHIBITED', redistributionStatus: 'PROHIBITED', minIntervalMs: 1500,
  }),
});
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
      || entry.minIntervalMs < 0 || entry.maxConcurrency !== 1 || entry.status !== 'approved') {
      throw registryInvalidError();
    }
    const policy = APPROVED_SOURCE_POLICIES[entry.sourceId];
    if (!policy || !SOURCE_EXECUTION_SCOPES.includes(entry.executionScope)
      || Object.entries(policy).some(([field, value]) => entry[field] !== value)) {
      throw registryInvalidError();
    }
    if (entry.sourceId === 'anilife_public' && (!Array.isArray(entry.blockedPaths)
      || entry.blockedPaths.length !== ANILIFE_BLOCKED_PATHS.length
      || entry.blockedPaths.some((path, index) => path !== ANILIFE_BLOCKED_PATHS[index]))) {
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
    ...(entry.blockedPaths ? { blockedPaths: Object.freeze([...entry.blockedPaths]) } : {}),
  }));
  validated.forEach((entry) => VALIDATED_REGISTRY_ENTRIES.add(entry));
  return Object.freeze(validated);
}

/**
 * Prevents a source adapter from exceeding its explicitly approved sample scope.
 *
 * @param {{sourceId?: string, status?: string, executionScope?: string}} registryEntry
 * @param {number} targetCount
 */
export function assertSourceExecution(registryEntry, targetCount) {
  if (!registryEntry || !VALIDATED_REGISTRY_ENTRIES.has(registryEntry)) {
    const error = new Error('Catalog source is not registered for execution');
    error.code = 'SOURCE_NOT_REGISTERED';
    throw error;
  }
  if (!Number.isInteger(targetCount) || targetCount < 1) {
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
    || registryEntry.executionScope === 'LOCAL_SAMPLE_MAX_100') && targetCount > 100) {
    const error = new Error('Catalog source execution scope exceeds 100 targets');
    error.code = 'SOURCE_SCOPE_EXCEEDED';
    throw error;
  }
}
