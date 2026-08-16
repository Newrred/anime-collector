import { lstat, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';

const SENTINEL = Object.freeze({ kind: 'MOEMOA_CATALOG_LAB', schemaVersion: 1 });
const WORKSPACE_HANDLES = new WeakMap();

function normalizeForComparison(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

function isWithin(root, candidate) {
  const normalizedRoot = normalizeForComparison(root);
  const normalizedCandidate = normalizeForComparison(candidate);
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}${sep}`);
}

function insideRepositoryError() {
  const error = new Error('Catalog workspace must be outside the repository');
  error.code = 'CATALOG_WORKSPACE_INSIDE_REPOSITORY';
  return error;
}

function pathEscapeError() {
  const error = new Error('Catalog workspace path must stay inside the workspace');
  error.code = 'CATALOG_WORKSPACE_PATH_ESCAPE';
  return error;
}

function resolveExistingAncestor(candidate) {
  const suffix = [];
  let current = candidate;
  while (true) {
    try {
      return resolve(realpathSync(current), ...suffix);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(current);
      if (parent === current) throw error;
      suffix.unshift(basename(current));
      current = parent;
    }
  }
}

function createContainedResolver(root) {
  return (...parts) => {
    if (parts.some((part) => isAbsolute(part))) throw pathEscapeError();
    const candidate = resolve(root, ...parts);
    if (!isWithin(root, candidate) || !isWithin(root, resolveExistingAncestor(candidate))) {
      throw pathEscapeError();
    }
    return candidate;
  };
}

export async function openCatalogWorkspace({ repoRoot, workspaceRoot = process.env.MOEMOA_CATALOG_LAB_DIR, create = false }) {
  const repo = resolve(repoRoot);
  if (!workspaceRoot) {
    const error = new Error('Catalog workspace path is required');
    error.code = 'CATALOG_WORKSPACE_REQUIRED';
    throw error;
  }
  const requestedRoot = resolve(workspaceRoot);
  if (isWithin(repo, requestedRoot)) throw insideRepositoryError();
  const canonicalRepo = await realpath(repo);
  if (isWithin(canonicalRepo, resolveExistingAncestor(requestedRoot))) throw insideRepositoryError();
  if (create) await mkdir(requestedRoot, { recursive: true });
  let root;
  try {
    root = await realpath(requestedRoot);
  } catch {
    const error = new Error('Catalog workspace sentinel is invalid');
    error.code = 'CATALOG_WORKSPACE_SENTINEL_INVALID';
    throw error;
  }
  if (isWithin(canonicalRepo, root)) throw insideRepositoryError();
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
  const handle = Object.freeze({ root, resolve: createContainedResolver(root) });
  WORKSPACE_HANDLES.set(handle, Object.freeze({ root, canonicalRepo }));
  return handle;
}

/** Rechecks the branded TEST_ONLY workspace immediately before an external mutation. */
export async function assertCatalogWorkspaceMutation(workspace, parts) {
  const trusted = WORKSPACE_HANDLES.get(workspace);
  if (!trusted || !Array.isArray(parts) || parts.some((part) => typeof part !== 'string' || !part || isAbsolute(part))) {
    const error = new Error('Catalog workspace handle is not authenticated');
    error.code = 'CATALOG_WORKSPACE_UNTRUSTED';
    throw error;
  }
  const canonicalRoot = await realpath(trusted.root).catch(() => null);
  if (!canonicalRoot || canonicalRoot !== trusted.root || isWithin(trusted.canonicalRepo, canonicalRoot)) {
    throw insideRepositoryError();
  }
  let sentinel;
  try { sentinel = JSON.parse(await readFile(join(canonicalRoot, 'TEST_ONLY.json'), 'utf8')); } catch { sentinel = null; }
  if (!sentinel || sentinel.kind !== SENTINEL.kind || sentinel.schemaVersion !== SENTINEL.schemaVersion) {
    const error = new Error('Catalog workspace sentinel is invalid');
    error.code = 'CATALOG_WORKSPACE_SENTINEL_INVALID';
    throw error;
  }
  let current = canonicalRoot;
  for (const part of parts) {
    current = join(current, part);
    const entry = await lstat(current).catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (entry?.isSymbolicLink()) {
      const error = new Error('Catalog workspace mutation path contains a symbolic link');
      error.code = 'CATALOG_WORKSPACE_SYMLINK_FORBIDDEN';
      throw error;
    }
  }
  return workspace.resolve(...parts);
}
