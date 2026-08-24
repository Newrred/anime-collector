import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';

export const VISUAL_BASELINE_MANIFEST_PATH = 'tests/visual/visual-baseline-manifest.json';
export const VISUAL_BASELINE_ASSET_CLASS = 'TEST_UI_SCREENSHOT';

const SNAPSHOT_PATH = /^tests\/visual\/[^/]+-snapshots\/[A-Za-z0-9._-]+\.png$/u;
const SNAPSHOT_DIRECTORY = /^tests\/visual\/[^/]+-snapshots(?:\/|$)/u;
const SCENARIO = /^[a-z0-9][a-z0-9._-]{0,119}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_BASELINE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BASELINE_BYTES = 64 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MAX_PIXELS = 16 * 1024 * 1024;
const ENTRY_KEYS = Object.freeze([
  'assetClass', 'byteSize', 'height', 'path', 'scenario', 'sha256', 'width',
]);

function toRelativePath(repoRoot, path) {
  const value = relative(repoRoot, path).replaceAll('\\', '/');
  return value && value !== '..' && !value.startsWith('../') ? value : null;
}

function manifestPath(repoRoot) {
  return resolve(repoRoot, ...VISUAL_BASELINE_MANIFEST_PATH.split('/'));
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function inspectVisualBaselinePng(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION
    || width * height > MAX_PIXELS) return null;
  return Object.freeze({ width, height });
}

function validEntryShape(entry) {
  return hasExactKeys(entry, ENTRY_KEYS)
    && entry.assetClass === VISUAL_BASELINE_ASSET_CLASS
    && typeof entry.path === 'string'
    && entry.path.length <= 300
    && SNAPSHOT_PATH.test(entry.path)
    && typeof entry.scenario === 'string'
    && SCENARIO.test(entry.scenario)
    && typeof entry.sha256 === 'string'
    && SHA256.test(entry.sha256)
    && Number.isSafeInteger(entry.byteSize)
    && entry.byteSize > 0
    && entry.byteSize <= MAX_BASELINE_BYTES
    && Number.isSafeInteger(entry.width)
    && entry.width > 0
    && entry.width <= MAX_DIMENSION
    && Number.isSafeInteger(entry.height)
    && entry.height > 0
    && entry.height <= MAX_DIMENSION
    && entry.width * entry.height <= MAX_PIXELS;
}

async function hasSymlinkComponent(repoRoot, relativePath) {
  let current = repoRoot;
  for (const segment of relativePath.split('/')) {
    current = resolve(current, segment);
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) return true;
  }
  return false;
}

async function snapshotInventory(repoRoot) {
  const root = resolve(repoRoot, 'tests', 'visual');
  const found = [];
  const walk = async (directory) => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      const rel = toRelativePath(repoRoot, path);
      if (!rel) continue;
      if (entry.isSymbolicLink()) {
        if (SNAPSHOT_DIRECTORY.test(rel)) found.push(rel);
        continue;
      }
      if (entry.isDirectory()) {
        const segments = rel.split('/');
        const snapshotIndex = segments.findIndex((segment) => segment.endsWith('-snapshots'));
        if (SNAPSHOT_DIRECTORY.test(rel) && snapshotIndex >= 0 && segments.length > snapshotIndex + 1) {
          found.push(rel);
          continue;
        }
        await walk(path);
        continue;
      }
      if (entry.isFile() && SNAPSHOT_DIRECTORY.test(rel)) found.push(rel);
    }
  };
  await walk(root);
  return found.sort();
}

function invalidResult(violations) {
  return Object.freeze({ approvedPaths: new Set(), violations: [...new Set(violations)].sort() });
}

function policyError() {
  const error = new Error('Visual baseline files do not satisfy the reviewed manifest policy');
  error.code = 'VISUAL_BASELINE_POLICY_INVALID';
  return error;
}

export async function buildVisualBaselineManifest({ repoRoot }) {
  const inventory = await snapshotInventory(repoRoot);
  const entries = [];
  const scenarios = new Set();
  let totalBytes = 0;
  for (const path of inventory) {
    if (!SNAPSHOT_PATH.test(path)) throw policyError();
    let bytes;
    try {
      if (await hasSymlinkComponent(repoRoot, path)) throw policyError();
      bytes = await readFile(resolve(repoRoot, ...path.split('/')));
    } catch (error) {
      if (error?.code === 'VISUAL_BASELINE_POLICY_INVALID') throw error;
      throw policyError();
    }
    const dimensions = inspectVisualBaselinePng(bytes);
    const scenario = basename(path, '.png');
    const scenarioKey = scenario.toLocaleLowerCase('en-US');
    if (!dimensions || bytes.byteLength > MAX_BASELINE_BYTES || !SCENARIO.test(scenario)
      || scenarios.has(scenarioKey)) throw policyError();
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_TOTAL_BASELINE_BYTES) throw policyError();
    scenarios.add(scenarioKey);
    entries.push({
      path,
      assetClass: VISUAL_BASELINE_ASSET_CLASS,
      scenario,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      byteSize: bytes.byteLength,
      width: dimensions.width,
      height: dimensions.height,
    });
  }
  return Object.freeze({
    schemaVersion: 1,
    entries: Object.freeze(entries.map((entry) => Object.freeze(entry))),
  });
}

export async function inspectVisualBaselinePolicy({ repoRoot }) {
  const inventory = await snapshotInventory(repoRoot);
  let manifestBytes;
  try {
    if (await hasSymlinkComponent(repoRoot, VISUAL_BASELINE_MANIFEST_PATH)) {
      return invalidResult([VISUAL_BASELINE_MANIFEST_PATH, ...inventory]);
    }
    manifestBytes = await readFile(manifestPath(repoRoot));
  } catch (error) {
    if (error?.code === 'ENOENT' && inventory.length === 0) {
      return Object.freeze({ approvedPaths: new Set(), violations: [] });
    }
    return invalidResult(inventory.length > 0 ? inventory : [VISUAL_BASELINE_MANIFEST_PATH]);
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch {
    return invalidResult([VISUAL_BASELINE_MANIFEST_PATH, ...inventory]);
  }
  if (!hasExactKeys(manifest, ['entries', 'schemaVersion'])
    || manifest.schemaVersion !== 1 || !Array.isArray(manifest.entries)) {
    return invalidResult([VISUAL_BASELINE_MANIFEST_PATH, ...inventory]);
  }

  const violations = [];
  const pathKeys = new Set();
  const scenarioKeys = new Set();
  const approved = new Set();
  let totalBytes = 0;
  for (const entry of manifest.entries) {
    if (!validEntryShape(entry)) {
      violations.push(VISUAL_BASELINE_MANIFEST_PATH);
      continue;
    }
    const pathKey = entry.path.toLocaleLowerCase('en-US');
    const scenarioKey = entry.scenario.toLocaleLowerCase('en-US');
    if (pathKeys.has(pathKey) || scenarioKeys.has(scenarioKey)) {
      violations.push(VISUAL_BASELINE_MANIFEST_PATH);
      continue;
    }
    pathKeys.add(pathKey);
    scenarioKeys.add(scenarioKey);
    totalBytes += entry.byteSize;
    if (totalBytes > MAX_TOTAL_BASELINE_BYTES) {
      violations.push(VISUAL_BASELINE_MANIFEST_PATH);
      continue;
    }

    let bytes;
    try {
      if (await hasSymlinkComponent(repoRoot, entry.path)) {
        violations.push(entry.path);
        continue;
      }
      bytes = await readFile(resolve(repoRoot, ...entry.path.split('/')));
    } catch {
      violations.push(entry.path);
      continue;
    }
    const dimensions = inspectVisualBaselinePng(bytes);
    const checksum = createHash('sha256').update(bytes).digest('hex');
    if (!dimensions || bytes.byteLength !== entry.byteSize || checksum !== entry.sha256
      || dimensions.width !== entry.width || dimensions.height !== entry.height) {
      violations.push(entry.path);
      continue;
    }
    approved.add(entry.path);
  }

  const inventoryKeys = new Set(inventory.map((path) => path.toLocaleLowerCase('en-US')));
  for (const path of inventory) {
    if (!pathKeys.has(path.toLocaleLowerCase('en-US'))) violations.push(path);
  }
  for (const path of pathKeys) {
    if (!inventoryKeys.has(path)) violations.push(VISUAL_BASELINE_MANIFEST_PATH);
  }
  if (approved.size !== manifest.entries.length) violations.push(VISUAL_BASELINE_MANIFEST_PATH);

  return violations.length > 0
    ? invalidResult(violations)
    : Object.freeze({ approvedPaths: approved, violations: [] });
}
