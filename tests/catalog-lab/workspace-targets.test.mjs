import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadSourceRegistry, assertSourceExecution } from '../../tools/catalog-lab/contracts/catalogContracts.mjs';
import { toPathKey } from '../../tools/catalog-lab/lib/path-key.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { buildTargetManifest } from '../../tools/catalog-lab/pipeline/targets.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const aliases = JSON.parse(await readFile(join(repoRoot, 'src', 'data', 'aliases.json'), 'utf8'));
const rows = aliases.map((row) => ({
  anilistId: String(row.anilistId),
  ko: row.ko,
  aliases: row.aliases,
}));
const goldenIds = ['1', '121', '5114', '7902', '21519', '227', '120377', '112151', '129874', '131681'];
const clock = { now: () => '2026-08-17T00:00:00.000Z' };
const uuid = (() => {
  let index = 0;
  return () => `11111111-1111-4111-8111-${String(++index).padStart(12, '0')}`;
})();

async function pathExists(path) {
  return stat(path).then(() => true, () => false);
}

test('workspace rejects a path inside the git worktree', async () => {
  await assert.rejects(
    openCatalogWorkspace({ repoRoot, workspaceRoot: join(repoRoot, '.cache', 'catalog') }),
    { code: 'CATALOG_WORKSPACE_INSIDE_REPOSITORY' },
  );
});

test('workspace rejects case-variant and junction paths into the git worktree', async () => {
  await assert.rejects(
    openCatalogWorkspace({ repoRoot: repoRoot.toUpperCase(), workspaceRoot: join(repoRoot, '.cache', 'catalog') }),
    { code: 'CATALOG_WORKSPACE_INSIDE_REPOSITORY' },
  );

  const outsideRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-junction-'));
  const junctionRoot = join(outsideRoot, 'into-repository');
  try {
    await symlink(repoRoot, junctionRoot, 'junction');
    await assert.rejects(
      openCatalogWorkspace({ repoRoot, workspaceRoot: junctionRoot }),
      { code: 'CATALOG_WORKSPACE_INSIDE_REPOSITORY' },
    );
  } finally {
    await unlink(junctionRoot).catch(() => {});
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test('workspace rejects a new child through a junction before creating repository files', async () => {
  const syntheticRepoRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-synthetic-repo-'));
  const outsideRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-junction-'));
  const junctionRoot = join(outsideRoot, 'into-repository');
  const repositoryChild = join(syntheticRepoRoot, 'catalog-lab-write-guard');
  try {
    await symlink(syntheticRepoRoot, junctionRoot, 'junction');
    await assert.rejects(
      openCatalogWorkspace({
        repoRoot: syntheticRepoRoot,
        workspaceRoot: join(junctionRoot, 'catalog-lab-write-guard'),
        create: true,
      }),
      { code: 'CATALOG_WORKSPACE_INSIDE_REPOSITORY' },
    );
    assert.equal(await pathExists(repositoryChild), false);
    assert.equal(await pathExists(join(repositoryChild, 'TEST_ONLY.json')), false);
  } finally {
    await unlink(junctionRoot).catch(() => {});
    await rm(outsideRoot, { recursive: true, force: true });
    await rm(syntheticRepoRoot, { recursive: true, force: true });
  }
});

test('workspace creates and validates the catalog sentinel outside the repository', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-lab-'));
  try {
    const workspace = await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true });
    assert.equal(workspace.root, workspaceRoot);
    assert.deepEqual(JSON.parse(await readFile(join(workspaceRoot, 'TEST_ONLY.json'), 'utf8')), {
      kind: 'MOEMOA_CATALOG_LAB',
      schemaVersion: 1,
    });
    assert.throws(() => workspace.resolve('..', 'outside-workspace'), {
      code: 'CATALOG_WORKSPACE_PATH_ESCAPE',
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('golden manifest does not require sample100 capacity', async () => {
  const goldenOnlyRows = rows.filter((row) => goldenIds.includes(row.anilistId));
  const manifest = await buildTargetManifest({
    profile: 'golden', rows: goldenOnlyRows, idMapStore: new Map(), clock, uuid,
  });

  assert.deepEqual(manifest.map((row) => row.seedExternalIds[0].value), goldenIds);
});

test('golden manifest uses the approved ten ids and stable internal ids', async () => {
  const idMapStore = new Map();
  const first = await buildTargetManifest({ profile: 'golden', rows, idMapStore, clock, uuid });
  const second = await buildTargetManifest({ profile: 'golden', rows, idMapStore, clock, uuid });

  assert.deepEqual(first.map((row) => row.seedExternalIds[0].value), goldenIds);
  assert.deepEqual(second, first);
  assert.equal(new Set(first.map((row) => row.moemoaAnimeId)).size, 10);
});

test('sample100 includes golden targets plus ninety deterministic unique selections', async () => {
  const manifest = await buildTargetManifest({
    profile: 'sample100', rows, idMapStore: new Map(), clock, uuid,
  });

  assert.equal(manifest.length, 100);
  assert.deepEqual(manifest.slice(0, 10).map((row) => row.seedExternalIds[0].value), goldenIds);
  assert.equal(new Set(manifest.map((row) => row.seedExternalIds[0].value)).size, 100);
});

test('registry exposes four approved sources and blocks over-scope execution', async () => {
  const registry = await loadSourceRegistry({ repoRoot });
  assert.equal(registry.length, 4);
  assert.deepEqual(registry.map((entry) => entry.executionScope), [
    'TARGET_ROSTER_ONLY', 'LOCAL_TEST_MAX_100', 'LOCAL_SAMPLE_MAX_100', 'LOCAL_TEST_MAX_100',
  ]);
  assert.deepEqual(registry.find((entry) => entry.sourceId === 'anilife_public').blockedPaths,
    ['/api/', '/archive', '/history', '/settings', '/login', '/notifications']);
  assert.doesNotThrow(() => assertSourceExecution(
    registry.find((entry) => entry.sourceId === 'anilist'), 100,
  ));
  assert.throws(() => assertSourceExecution(
    registry.find((entry) => entry.sourceId === 'anilife_public'), 101,
  ), { code: 'SOURCE_SCOPE_EXCEEDED' });
  assert.throws(() => assertSourceExecution({
    sourceId: 'unregistered', status: 'approved', executionScope: 'LOCAL_TEST_MAX_100',
  }, 1), { code: 'SOURCE_NOT_REGISTERED' });
});

test('registry rejects entries missing required policy fields', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-registry-'));
  const registryFile = join(fixtureRoot, 'tools', 'catalog-lab', 'config', 'source-registry.json');
  try {
    await mkdir(dirname(registryFile), { recursive: true });
    await writeFile(registryFile, JSON.stringify([{
      sourceId: 'anilist',
      status: 'approved',
      executionScope: 'LOCAL_TEST_MAX_100',
    }]));
    await assert.rejects(loadSourceRegistry({ repoRoot: fixtureRoot }), {
      code: 'SOURCE_REGISTRY_INVALID',
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('registry rejects source-specific blocked-path policy drift', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-registry-'));
  const registryFile = join(fixtureRoot, 'tools', 'catalog-lab', 'config', 'source-registry.json');
  try {
    const registry = JSON.parse(await readFile(
      join(repoRoot, 'tools', 'catalog-lab', 'config', 'source-registry.json'), 'utf8',
    ));
    registry.find((entry) => entry.sourceId === 'anilife_public').blockedPaths = ['/api/'];
    await mkdir(dirname(registryFile), { recursive: true });
    await writeFile(registryFile, JSON.stringify(registry));
    await assert.rejects(loadSourceRegistry({ repoRoot: fixtureRoot }), {
      code: 'SOURCE_REGISTRY_INVALID',
    });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('registry rejects allowed path and field policy drift for every source', async () => {
  const sourceIds = ['legacy_aliases', 'anilist', 'wikidata', 'anilife_public'];
  for (const sourceId of sourceIds) {
    for (const field of ['allowedPaths', 'allowedFields']) {
      const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-registry-'));
      const registryFile = join(fixtureRoot, 'tools', 'catalog-lab', 'config', 'source-registry.json');
      try {
        const registry = JSON.parse(await readFile(
          join(repoRoot, 'tools', 'catalog-lab', 'config', 'source-registry.json'), 'utf8',
        ));
        registry.find((entry) => entry.sourceId === sourceId)[field].push(`unexpected-${field}`);
        await mkdir(dirname(registryFile), { recursive: true });
        await writeFile(registryFile, JSON.stringify(registry));
        await assert.rejects(loadSourceRegistry({ repoRoot: fixtureRoot }), {
          code: 'SOURCE_REGISTRY_INVALID',
        });
      } finally {
        await rm(fixtureRoot, { recursive: true, force: true });
      }
    }
  }
});

test('logical ids never become raw Windows path segments', () => {
  assert.equal(toPathKey('ANILIST:1'), 'anilist-1');
  assert.equal(toPathKey('anime:11111111-1111-4111-8111-111111111111'),
    'anime-11111111-1111-4111-8111-111111111111');
});
