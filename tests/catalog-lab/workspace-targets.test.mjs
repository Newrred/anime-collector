import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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

test('workspace rejects a path inside the git worktree', async () => {
  await assert.rejects(
    openCatalogWorkspace({ repoRoot, workspaceRoot: join(repoRoot, '.cache', 'catalog') }),
    { code: 'CATALOG_WORKSPACE_INSIDE_REPOSITORY' },
  );
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
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
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
  assert.doesNotThrow(() => assertSourceExecution(
    registry.find((entry) => entry.sourceId === 'anilist'), 100,
  ));
  assert.throws(() => assertSourceExecution(
    registry.find((entry) => entry.sourceId === 'anilife_public'), 101,
  ), { code: 'SOURCE_SCOPE_EXCEEDED' });
});

test('logical ids never become raw Windows path segments', () => {
  assert.equal(toPathKey('ANILIST:1'), 'anilist-1');
  assert.equal(toPathKey('anime:11111111-1111-4111-8111-111111111111'),
    'anime-11111111-1111-4111-8111-111111111111');
});
