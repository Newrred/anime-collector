import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const CATALOG_LAB_USER_AGENT = 'MOEMOA-Catalog-Lab/0.1 (personal local test; https://github.com/Newrred/anime-collector)';
export const SOURCE_EXECUTION_SCOPES = Object.freeze([
  'TARGET_ROSTER_ONLY',
  'LOCAL_TEST_MAX_100',
  'LOCAL_SAMPLE_MAX_100',
]);

/**
 * Loads the approved local-only source registry without making a network request.
 *
 * @param {{repoRoot: string}} input
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function loadSourceRegistry({ repoRoot }) {
  const file = join(repoRoot, 'tools', 'catalog-lab', 'config', 'source-registry.json');
  const registry = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(registry)) {
    const error = new Error('Catalog source registry must be an array');
    error.code = 'SOURCE_REGISTRY_INVALID';
    throw error;
  }
  return Object.freeze(registry.map((entry) => Object.freeze({ ...entry })));
}

/**
 * Prevents a source adapter from exceeding its explicitly approved sample scope.
 *
 * @param {{sourceId?: string, status?: string, executionScope?: string}} registryEntry
 * @param {number} targetCount
 */
export function assertSourceExecution(registryEntry, targetCount) {
  if (!registryEntry || registryEntry.status !== 'approved') {
    const error = new Error('Catalog source is not approved for execution');
    error.code = 'SOURCE_NOT_APPROVED';
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
