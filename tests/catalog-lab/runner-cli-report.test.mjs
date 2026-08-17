import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CLI_EXIT, runCli } from '../../tools/catalog-lab/cli.mjs';
import { buildQualityReport, renderQualityReportMarkdown } from '../../tools/catalog-lab/reports/quality-report.mjs';
import { loadSourceRegistry } from '../../tools/catalog-lab/contracts/catalogContracts.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { createCatalogArtifactStore } from '../../tools/catalog-lab/pipeline/artifact-store.mjs';
import { runCatalogPipeline } from '../../tools/catalog-lab/pipeline/runner.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fixedNow = '2026-08-17T00:00:00.000Z';

function target(index) {
  return Object.freeze({
    targetKey: `ANILIST:${index}`,
    moemoaAnimeId: `anime:22222222-2222-4222-8222-${String(index).padStart(12, '0')}`,
    seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: String(index) }]),
    seedTitles: Object.freeze([{ locale: 'und', value: `Golden test ${index}` }]),
    targetStatus: 'ACTIVE',
    createdAt: fixedNow,
  });
}

function anilistEnvelope(row) {
  const id = Number(row.seedExternalIds[0].value);
  return Object.freeze({
    sourceId: 'anilist', targetKey: row.targetKey, sourceEntityId: String(id), responseStatus: 200,
    fetchedAt: fixedNow, requestFingerprint: `fixture:${id}`, parserVersion: 'fixture-v1',
    payload: {
      id, idMal: null, title: { romaji: `Golden test ${id}`, english: null, native: null }, synonyms: [],
      format: 'TV', status: 'FINISHED', startDate: { year: 2000, month: 1, day: 1 },
      endDate: { year: null, month: null, day: null }, season: 'WINTER', seasonYear: 2000,
      episodes: 1, source: 'ORIGINAL', genres: ['Action'],
      coverImage: { extraLarge: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${id}.jpg` },
      studios: { nodes: [] }, relations: { edges: [] }, externalLinks: [], characters: [],
    },
  });
}

function fixtureAdapter() {
  return Object.freeze({
    async *collect({ targets }) {
      for (const row of targets) yield anilistEnvelope(row);
    },
  });
}

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-report-'));
  try {
    return await run(workspaceRoot, await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function silentDependencies(workspaceRoot) {
  return {
    repoRoot,
    workspaceRoot,
    stdout: { write() {} },
    stderr: { write() {} },
    clock: { now: () => fixedNow },
    uuid: (() => { let index = 0; return () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`; })(),
  };
}

async function seedGoldenWorkspace(workspace) {
  const targets = Array.from({ length: 10 }, (_, index) => target(index + 1));
  const registry = await loadSourceRegistry({ repoRoot });
  await createCatalogArtifactStore({ workspace }).writeManifest('golden', targets);
  await runCatalogPipeline({
    workspace, targets, registry, adapters: { anilist: fixtureAdapter() }, bindings: {},
    selectedSources: ['anilist'], allowNetwork: true, clock: { now: () => fixedNow },
    httpFactory: () => ({ async request() { return new Response('{}'); } }),
    coverPipeline: async ({ target: row }) => ({
      status: 'STORED', sourceId: 'anilist', sourceRecordId: '0'.repeat(64), checksum: 'a'.repeat(64),
      byteSize: 12, width: 1, height: 1, localRef: `images/covers/${row.moemoaAnimeId}/fixture.png`, created: false,
    }),
  });
  return targets;
}

function runSubprocess(args, env = {}) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, args, { cwd: repoRoot, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error && error.code !== 64) return reject(error);
      resolve({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}

test('subprocess CLI rejects collection without an exact golden network gate', async () => {
  const result = await runSubprocess(['tools/catalog-lab/cli.mjs', 'collect', '--profile', 'sample100', '--sources', 'anilist', '--allow-network']);
  assert.equal(result.code, CLI_EXIT.USAGE_OR_SAFETY);
  assert.match(result.stderr, /CLI_USAGE_OR_SAFETY/);
});

test('CLI refuses collection without exact network permission or with a non-golden profile', async () => {
  assert.equal(await runCli(['collect', '--profile', 'golden'], silentDependencies()), CLI_EXIT.USAGE_OR_SAFETY);
  assert.equal(await runCli([
    'collect', '--profile', 'sample100', '--sources', 'anilist', '--allow-network',
  ], silentDependencies()), CLI_EXIT.USAGE_OR_SAFETY);
});

test('init and targets create only an external sentinel, stable ID map, and ten-target manifest', async () => {
  await withWorkspace(async (workspaceRoot) => {
    const deps = silentDependencies(workspaceRoot);
    assert.equal(await runCli(['init'], deps), CLI_EXIT.OK);
    assert.equal(await runCli(['targets', '--profile', 'golden'], deps), CLI_EXIT.OK);
    const manifest = JSON.parse(await readFile(join(workspaceRoot, 'manifests', 'golden.json'), 'utf8'));
    const idMap = JSON.parse(await readFile(join(workspaceRoot, 'state', 'id-map.json'), 'utf8'));
    assert.equal(manifest.length, 10);
    assert.equal(new Set(manifest.map((row) => row.moemoaAnimeId)).size, 10);
    assert.equal(Object.keys(idMap).length, 10);
    assert.equal(await runCli(['targets', '--profile', 'golden'], deps), CLI_EXIT.OK);
    assert.deepEqual(JSON.parse(await readFile(join(workspaceRoot, 'manifests', 'golden.json'), 'utf8')), manifest);
  });
});

test('bind-anilife stores only a manifest target and numeric reviewed public content id', async () => {
  await withWorkspace(async (workspaceRoot) => {
    const deps = silentDependencies(workspaceRoot);
    await runCli(['init'], deps);
    await runCli(['targets', '--profile', 'golden'], deps);
    assert.equal(await runCli(['bind-anilife', '--anilist-id', '1', '--content-id', '123'], deps), CLI_EXIT.OK);
    const bindings = JSON.parse(await readFile(join(workspaceRoot, 'bindings', 'anilife.json'), 'utf8'));
    assert.deepEqual(bindings['ANILIST:1'], { contentId: '123', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' });
    assert.equal(await runCli(['bind-anilife', '--anilist-id', '../1', '--content-id', 'https://evil.test/x'], deps), CLI_EXIT.USAGE_OR_SAFETY);
  });
});

test('quality report exposes ten target/source/field/cover states and no raw payload', async () => {
  await withWorkspace(async (_workspaceRoot, workspace) => {
    const targets = await seedGoldenWorkspace(workspace);
    const report = await buildQualityReport({ workspace, profile: 'golden' });
    assert.equal(report.targetCount, 10);
    assert.equal(report.targets.length, 10);
    assert.equal(JSON.stringify(report).includes('rawPayloadRef'), false);
    assert.equal(JSON.stringify(report).includes('payload'), false);
    assert.equal(JSON.stringify(report).includes(workspace.root), false);
    assert.equal(report.targets.every((row) => row.sources.anilist && row.cover.status === 'STORED'), true);
    assert.equal(report.targets.every((row) => row.fieldStates.titles === 'VALUE'), true);
    assert.match(renderQualityReportMarkdown(report), /Golden test 1/);
  });
});

test('guard reports only relative leaking paths in tracked and explicit build roots', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-guard-'));
  try {
    const tracked = join(fixtureRoot, 'tracked.json');
    const buildRoot = join(fixtureRoot, 'dist');
    const image = join(buildRoot, 'leaked-cover.png');
    await writeFile(tracked, '{"rawPayloadRef":"SECRET_PAYLOAD_DO_NOT_ECHO"}\n');
    await mkdir(buildRoot, { recursive: true });
    await writeFile(join(buildRoot, 'TEST_ONLY.json'), '{"kind":"MOEMOA_CATALOG_LAB"}\n');
    await writeFile(image, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const output = [];
    const code = await runCli(['guard'], {
      repoRoot: fixtureRoot,
      trackedFiles: async () => [tracked],
      buildRoots: [buildRoot],
      stdout: { write(value) { output.push(value); } }, stderr: { write(value) { output.push(value); } },
    });
    const rendered = output.join('');
    assert.equal(code, CLI_EXIT.QUALITY_GATE_FAILED);
    assert.match(rendered, /tracked\.json/);
    assert.match(rendered, /dist[\\/]TEST_ONLY\.json/);
    assert.match(rendered, /dist[\\/]leaked-cover\.png/);
    assert.equal(rendered.includes('SECRET_PAYLOAD_DO_NOT_ECHO'), false);
    assert.equal(rendered.includes(fixtureRoot), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
