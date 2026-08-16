import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

const SENTINEL = Object.freeze({ kind: 'MOEMOA_CATALOG_LAB', schemaVersion: 1 });

export async function openCatalogWorkspace({ repoRoot, workspaceRoot = process.env.MOEMOA_CATALOG_LAB_DIR, create = false }) {
  const repo = resolve(repoRoot);
  if (!workspaceRoot) {
    const error = new Error('Catalog workspace path is required');
    error.code = 'CATALOG_WORKSPACE_REQUIRED';
    throw error;
  }
  const root = resolve(workspaceRoot);
  if (root === repo || root.startsWith(`${repo}${sep}`)) {
    const error = new Error('Catalog workspace must be outside the repository');
    error.code = 'CATALOG_WORKSPACE_INSIDE_REPOSITORY';
    throw error;
  }
  if (create) await mkdir(root, { recursive: true });
  const sentinel = join(root, 'TEST_ONLY.json');
  const sentinelExists = await stat(sentinel).then(() => true, () => false);
  if (create && !sentinelExists) {
    await writeFile(sentinel, `${JSON.stringify(SENTINEL)}\n`);
  }
  let parsed;
  try {
    parsed = JSON.parse(await readFile(sentinel, 'utf8'));
  } catch {
    const error = new Error('Catalog workspace sentinel is invalid');
    error.code = 'CATALOG_WORKSPACE_SENTINEL_INVALID';
    throw error;
  }
  if (parsed.kind !== SENTINEL.kind || parsed.schemaVersion !== SENTINEL.schemaVersion) {
    const error = new Error('Catalog workspace sentinel is invalid');
    error.code = 'CATALOG_WORKSPACE_SENTINEL_INVALID';
    throw error;
  }
  return Object.freeze({ root, resolve: (...parts) => join(root, ...parts) });
}
