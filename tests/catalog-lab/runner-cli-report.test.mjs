import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CLI_EXIT, runCli } from '../../tools/catalog-lab/cli.mjs';
import { buildQualityReport, renderQualityReportMarkdown, writeQualityReport } from '../../tools/catalog-lab/reports/quality-report.mjs';
import { loadSourceRegistry } from '../../tools/catalog-lab/contracts/catalogContracts.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { createCatalogArtifactStore } from '../../tools/catalog-lab/pipeline/artifact-store.mjs';
import { runCatalogPipeline } from '../../tools/catalog-lab/pipeline/runner.mjs';
import { buildTargetManifest } from '../../tools/catalog-lab/pipeline/targets.mjs';
import { toPathKey } from '../../tools/catalog-lab/lib/path-key.mjs';
import { pngBytes } from './fixtures/cover-valid-images.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const fixedNow = '2026-08-17T00:00:00.000Z';
const goldenIds = [1, 121, 5114, 7902, 21519, 227, 120377, 112151, 129874, 131681];

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
  const idMap = Object.fromEntries(goldenIds.map((id) => [
    `ANILIST:${id}`, target(id).moemoaAnimeId,
  ]));
  const aliases = JSON.parse(await readFile(join(repoRoot, 'src', 'data', 'aliases.json'), 'utf8'));
  const targets = await buildTargetManifest({
    profile: 'golden', rows: aliases, idMapStore: idMap,
    clock: { now: () => fixedNow }, uuid: () => { throw new Error('stable id map is required'); },
  });
  const registry = await loadSourceRegistry({ repoRoot });
  const checksum = createHash('sha256').update(pngBytes).digest('hex');
  for (const row of targets) {
    const directory = workspace.resolve('images', 'covers', toPathKey(row.moemoaAnimeId));
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, `${checksum}.png`), pngBytes);
  }
  const store = createCatalogArtifactStore({ workspace });
  await store.writeIdMap(idMap);
  await store.writeManifest('golden', targets);
  await runCatalogPipeline({
    workspace, targets, registry, adapters: { anilist: fixtureAdapter() }, bindings: {},
    selectedSources: ['anilist'], allowNetwork: true, clock: { now: () => fixedNow },
    httpFactory: () => ({ async request() { return new Response('{}'); } }),
    coverPipeline: async ({ target: row }) => ({
      status: 'STORED', sourceId: 'anilist', sourceRecordId: '0'.repeat(64), checksum,
      byteSize: pngBytes.byteLength, width: 1, height: 1,
      localRef: `images/covers/${toPathKey(row.moemoaAnimeId)}/${checksum}.png`, created: false,
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

test('subprocess CLI rejects collection without an authenticated external workspace', async () => {
  const result = await runSubprocess(['tools/catalog-lab/cli.mjs', 'collect', '--profile', 'sample100', '--sources', 'anilist', '--allow-network']);
  assert.equal(result.code, CLI_EXIT.USAGE_OR_SAFETY);
  assert.match(result.stderr, /CATALOG_WORKSPACE_REQUIRED/);
});

test('CLI refuses collection without exact network permission or with an unknown profile', async () => {
  assert.equal(await runCli(['collect', '--profile', 'golden'], silentDependencies()), CLI_EXIT.USAGE_OR_SAFETY);
  assert.equal(await runCli([
    'collect', '--profile', 'sample101', '--sources', 'anilist', '--allow-network',
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

test('init and targets use the default UUID generator to create the golden ten manifest', async () => {
  await withWorkspace(async (workspaceRoot) => {
    const output = [];
    const deps = {
      repoRoot,
      workspaceRoot,
      stdout: { write(value) { output.push(value); } },
      stderr: { write(value) { output.push(value); } },
      clock: { now: () => fixedNow },
    };
    assert.equal(await runCli(['init'], deps), CLI_EXIT.OK);
    assert.equal(await runCli(['targets', '--profile', 'golden'], deps), CLI_EXIT.OK);
    const manifest = JSON.parse(await readFile(join(workspaceRoot, 'manifests', 'golden.json'), 'utf8'));
    assert.equal(manifest.length, 10);
    assert.equal(manifest.every((row) => /^anime:[0-9a-f-]{36}$/u.test(row.moemoaAnimeId)), true);
    assert.equal(output.some((value) => value.includes('Catalog command rejected')), false);
  });
});

test('sample100 creates the deterministic approved 100-target manifest and profile report', async () => {
  await withWorkspace(async (workspaceRoot, workspace) => {
    const deps = silentDependencies(workspaceRoot);
    assert.equal(await runCli(['init'], deps), CLI_EXIT.OK);
    assert.equal(await runCli(['targets', '--profile', 'sample100'], deps), CLI_EXIT.OK);
    const manifest = JSON.parse(await readFile(join(workspaceRoot, 'manifests', 'sample100.json'), 'utf8'));
    const idMap = JSON.parse(await readFile(join(workspaceRoot, 'state', 'id-map.json'), 'utf8'));
    assert.equal(manifest.length, 100);
    assert.deepEqual(manifest.slice(0, 10).map((row) => Number(row.seedExternalIds[0].value)), goldenIds);
    assert.equal(new Set(manifest.map((row) => row.targetKey)).size, 100);
    assert.equal(new Set(manifest.map((row) => row.moemoaAnimeId)).size, 100);
    assert.equal(manifest.every((row) => row.seedTitles.filter((title) => title.locale === 'ko').length === 1), true);
    assert.equal(Object.keys(idMap).length, 100);
    assert.equal(await runCli(['targets', '--profile', 'sample100'], deps), CLI_EXIT.OK);
    assert.deepEqual(JSON.parse(await readFile(join(workspaceRoot, 'manifests', 'sample100.json'), 'utf8')), manifest);

    const report = await buildQualityReport({ workspace, profile: 'sample100' });
    assert.equal(report.profile, 'sample100');
    assert.equal(report.targetCount, 100);
    assert.equal(report.gate.passed, false);
    assert.match(renderQualityReportMarkdown(report), /Sample 100 Catalog Quality Report/);
  });
});

test('sample100 collection accepts exactly 100 targets and stores a profile-isolated run snapshot', async () => {
  await withWorkspace(async (workspaceRoot) => {
    const deps = {
      ...silentDependencies(workspaceRoot),
      adapters: {
        anilist: Object.freeze({
          async *collect() {
            const error = new Error('synthetic permanent source failure');
            error.code = 'SYNTHETIC_SOURCE_FAILURE';
            throw error;
          },
        }),
      },
      httpFactory: () => ({ async request() { throw new Error('network must not be reached'); } }),
      coverPipeline: async () => ({ status: 'FAILED', errorCode: 'NO_COVER_CANDIDATE' }),
    };
    assert.equal(await runCli(['init'], deps), CLI_EXIT.OK);
    assert.equal(await runCli(['targets', '--profile', 'sample100'], deps), CLI_EXIT.OK);
    assert.equal(await runCli([
      'collect', '--profile', 'sample100', '--sources', 'anilist', '--allow-network',
    ], deps), CLI_EXIT.OK);
    const snapshot = JSON.parse(await readFile(join(workspaceRoot, 'runs', 'sample100', 'current.json'), 'utf8'));
    assert.equal(snapshot.profile, 'sample100');
    assert.equal(snapshot.counts.targets, 100);
    assert.equal(snapshot.targets.length, 100);
    await assert.rejects(readFile(join(workspaceRoot, 'runs', 'golden', 'current.json'), 'utf8'), { code: 'ENOENT' });
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
    assert.equal(report.serviceGate.passed, true);
    assert.equal(report.serviceTotals.targetsWithReview, 0);
    assert.equal(report.serviceTotals.officialLinksPendingReview, 0);
    assert.equal(report.targets.every((row) => row.serviceReadiness !== 'BLOCKED'), true);
    assert.equal(report.targets.every((row) => row.preferredTitle?.locale === 'ko'), true);
    assert.equal(report.targets.every((row) => row.fieldTiers.required.cover === 'VALUE'), true);
    const markdown = renderQualityReportMarkdown(report);
    assert.match(markdown, /카우보이 비밥/);
    assert.match(markdown, /프리크리/);
  });
});

test('rebuild command reuses local sources and covers while writing deterministic service projections', async () => {
  await withWorkspace(async (workspaceRoot, workspace) => {
    const targets = await seedGoldenWorkspace(workspace);
    const collectionSnapshotBefore = await readFile(workspace.resolve('runs', 'golden', 'current.json'), 'utf8');
    const output = [];
    const deps = {
      ...silentDependencies(workspaceRoot),
      stdout: { write(value) { output.push(value); } },
      stderr: { write(value) { output.push(value); } },
      adapters: new Proxy({}, { get() { throw new Error('rebuild must not read adapters'); } }),
      httpFactory() { throw new Error('rebuild must not create an HTTP client'); },
    };

    assert.equal(await runCli(['rebuild', '--profile', 'golden'], deps), CLI_EXIT.OK);
    assert.equal(await runCli(['rebuild', '--profile', 'golden'], deps), CLI_EXIT.OK);
    assert.equal(await runCli(['rebuild', '--profile', 'golden', '--allow-network'], deps), CLI_EXIT.USAGE_OR_SAFETY);
    assert.equal(await readFile(workspace.resolve('runs', 'golden', 'current.json'), 'utf8'), collectionSnapshotBefore);
    const snapshot = JSON.parse(await readFile(workspace.resolve('runs', 'golden', 'rebuild-current.json'), 'utf8'));
    assert.equal(snapshot.networkRequests, 0);
    assert.equal(snapshot.counts.serviceProjections, 10);
    assert.equal(snapshot.growth.sourceRecords, 0);
    assert.equal(snapshot.growth.images, 0);
    const projection = await createCatalogArtifactStore({ workspace }).readServiceProjection(targets[0]);
    assert.equal(projection.preferredTitle.locale, 'ko');
    assert.match(output.join(''), /Offline rebuild: 10 targets; network requests: 0/);
  });
});

test('validate and report block missing or inconsistent current canonical and cover artifacts', async () => {
  await withWorkspace(async (workspaceRoot, workspace) => {
    await seedGoldenWorkspace(workspace);
    const deps = silentDependencies(workspaceRoot);
    assert.equal(await runCli(['validate'], deps), CLI_EXIT.OK);
    const first = target(1);
    await writeFile(workspace.resolve('current', `${toPathKey(first.moemoaAnimeId)}.json`), JSON.stringify({
      animeId: first.moemoaAnimeId, contentHash: 'not-a-hash',
    }));
    assert.equal(await runCli(['validate'], deps), CLI_EXIT.QUALITY_GATE_FAILED);
    assert.equal(await runCli(['report'], deps), CLI_EXIT.QUALITY_GATE_FAILED);
  });
  await withWorkspace(async (workspaceRoot, workspace) => {
    await seedGoldenWorkspace(workspace);
    const first = target(1);
    const pointerPath = workspace.resolve('current', `${toPathKey(first.moemoaAnimeId)}.json`);
    const current = JSON.parse(await readFile(pointerPath, 'utf8'));
    await writeFile(pointerPath, JSON.stringify({ ...current, animeId: 'anime:foreign-pointer' }));
    assert.equal((await buildQualityReport({ workspace, profile: 'golden' })).gate.passed, false);
    assert.equal(await runCli(['validate'], silentDependencies(workspaceRoot)), CLI_EXIT.QUALITY_GATE_FAILED);
    assert.equal(await runCli(['report'], silentDependencies(workspaceRoot)), CLI_EXIT.QUALITY_GATE_FAILED);
  });
  await withWorkspace(async (workspaceRoot, workspace) => {
    await seedGoldenWorkspace(workspace);
    const first = target(1);
    const localKey = ['local', 'Ref'].join('');
    await writeFile(workspace.resolve('covers', `${toPathKey(first.moemoaAnimeId)}.json`), JSON.stringify({
      status: 'STORED', checksum: 'a'.repeat(64), byteSize: 1, width: 1, height: 1,
      [localKey]: 'https://source.example/cover.png',
    }));
    const report = await buildQualityReport({ workspace, profile: 'golden' });
    assert.equal(report.gate.passed, false);
    assert.equal(report.targets[0].cover.localRef, null);
    assert.equal(JSON.stringify(report).includes('https://source.example/cover.png'), false);
    assert.equal(await runCli(['validate'], silentDependencies(workspaceRoot)), CLI_EXIT.QUALITY_GATE_FAILED);
  });
});

test('direct report builders block a manifest whose stable ID map is corrupted', async () => {
  await withWorkspace(async (_workspaceRoot, workspace) => {
    const targets = await seedGoldenWorkspace(workspace);
    const mapPath = workspace.resolve('state', 'id-map.json');
    const idMap = JSON.parse(await readFile(mapPath, 'utf8'));
    idMap[targets[0].targetKey] = 'anime:wrong-stable-id';
    await writeFile(mapPath, JSON.stringify(idMap));
    const report = await buildQualityReport({ workspace, profile: 'golden' });
    assert.equal(report.gate.passed, false);
    assert.equal(report.gate.blockers.includes('MANIFEST_INVALID'), true);
    assert.equal((await writeQualityReport({ workspace, profile: 'golden' })).gate.passed, false);
  });
});

test('targets rejects a pre-existing manifest that is not the approved stable golden ten', async () => {
  await withWorkspace(async (workspaceRoot) => {
    const deps = silentDependencies(workspaceRoot);
    assert.equal(await runCli(['init'], deps), CLI_EXIT.OK);
    assert.equal(await runCli(['targets'], deps), CLI_EXIT.OK);
    const manifestPath = join(workspaceRoot, 'manifests', 'golden.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const intactManifest = structuredClone(manifest);
    manifest[0].targetKey = 'ANILIST:999999';
    await writeFile(manifestPath, JSON.stringify(manifest));
    assert.equal(await runCli(['targets'], deps), CLI_EXIT.USAGE_OR_SAFETY);

    await writeFile(manifestPath, JSON.stringify(intactManifest));
    const idMapPath = join(workspaceRoot, 'state', 'id-map.json');
    const idMap = JSON.parse(await readFile(idMapPath, 'utf8'));
    idMap[intactManifest[0].targetKey] = 'anime:wrong-stable-id';
    await writeFile(idMapPath, JSON.stringify(idMap));
    assert.equal(await runCli(['targets'], deps), CLI_EXIT.USAGE_OR_SAFETY);
  });
});

test('guard reports only relative leaking paths in tracked and explicit build roots', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-guard-'));
  try {
    const tracked = join(fixtureRoot, 'tracked.json');
    const buildRoot = join(fixtureRoot, 'dist');
    const image = join(buildRoot, 'leaked-cover.png');
    const rawKey = ['rawPayload', 'Ref'].join('');
    await writeFile(tracked, `{"${rawKey}":"SECRET_PAYLOAD_DO_NOT_ECHO"}\n`);
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

test('guard finds nested, NDJSON, HTML, and over-two-megabyte raw keys without exposing content', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-guard-text-'));
  try {
    const buildRoot = join(fixtureRoot, 'dist');
    await mkdir(buildRoot, { recursive: true });
    const rawKey = ['rawPayload', 'Ref'].join('');
    const localKey = ['local', 'Ref'].join('');
    const cases = {
      'nested.js': `window.catalog = { nested: { ${rawKey}: "SECRET_JS" } };`,
      'comma-raw.js': `const record = { sourceId: "anilist", ${rawKey}: "raw/anilist/SECRET_COMMA.json" };`,
      'page.html': `<script>const row = { "${rawKey}": "SECRET_HTML" };</script>`,
      'records.ndjson': `{"ok":true}\n{"${rawKey}":"SECRET_NDJSON"}\n`,
      'large.txt': `${'x'.repeat((2 * 1024 * 1024) + 8)} "${rawKey}":"SECRET_LARGE"`,
      'unquoted-localref.js': `const record = { ${localKey}: "https://source.example/cover.jpg" };`,
      'controlled-localref.js': `const record = { ${localKey}: "images/covers/anime-safe/cover.png" };`,
    };
    await Promise.all(Object.entries(cases).map(([name, value]) => writeFile(join(buildRoot, name), value)));
    const output = [];
    const code = await runCli(['guard'], {
      repoRoot: fixtureRoot, trackedFiles: async () => [], buildRoots: [buildRoot],
      stdout: { write(value) { output.push(value); } }, stderr: { write(value) { output.push(value); } },
    });
    const rendered = output.join('');
    assert.equal(code, CLI_EXIT.QUALITY_GATE_FAILED);
    for (const name of Object.keys(cases)) assert.match(rendered, new RegExp(`dist[\\\\/]${name.replace('.', '\\.')}`));
    assert.equal(/SECRET_(?:JS|COMMA|HTML|NDJSON|LARGE)/u.test(rendered), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('guard blocks a build artifact that spreads a public record before a raw payload reference', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-guard-build-spread-'));
  try {
    const buildRoot = join(fixtureRoot, 'dist');
    const artifact = join(buildRoot, 'spread-record.js');
    const rawKey = ['rawPayload', 'Ref'].join('');
    await mkdir(buildRoot, { recursive: true });
    await writeFile(artifact, `const record = { ...publicRecord, ${rawKey}: "raw/anilist/SECRET_SPREAD.json" };\n`);
    const output = [];
    const code = await runCli(['guard'], {
      repoRoot: fixtureRoot, trackedFiles: async () => [], buildRoots: [buildRoot],
      stdout: { write(value) { output.push(value); } }, stderr: { write(value) { output.push(value); } },
    });
    const rendered = output.join('');
    assert.equal(code, CLI_EXIT.QUALITY_GATE_FAILED);
    assert.match(rendered, /dist[\\/]spread-record\.js/);
    assert.equal(rendered.includes('SECRET_SPREAD'), false);
    assert.equal(rendered.includes(fixtureRoot), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('guard blocks a build artifact with an ellipsis string before a raw payload reference', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-guard-build-ellipsis-'));
  try {
    const buildRoot = join(fixtureRoot, 'dist');
    const artifact = join(buildRoot, 'ellipsis-record.js');
    const rawKey = ['rawPayload', 'Ref'].join('');
    await mkdir(buildRoot, { recursive: true });
    await writeFile(artifact, `const record = { note: "...", ${rawKey}: "raw/anilist/SECRET_ELLIPSIS.json" };\n`);
    const output = [];
    const code = await runCli(['guard'], {
      repoRoot: fixtureRoot, trackedFiles: async () => [], buildRoots: [buildRoot],
      stdout: { write(value) { output.push(value); } }, stderr: { write(value) { output.push(value); } },
    });
    const rendered = output.join('');
    assert.equal(code, CLI_EXIT.QUALITY_GATE_FAILED);
    assert.match(rendered, /dist[\\/]ellipsis-record\.js/);
    assert.equal(rendered.includes('SECRET_ELLIPSIS'), false);
    assert.equal(rendered.includes(fixtureRoot), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('guard scans tracked Markdown and test source structures but not a prose marker word', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-guard-tracked-'));
  try {
    const docs = join(fixtureRoot, 'docs');
    const tests = join(fixtureRoot, 'tests');
    await mkdir(docs, { recursive: true });
    await mkdir(tests, { recursive: true });
    const markdownLeak = join(docs, 'leak.md');
    const testLeak = join(tests, 'leak.test.mjs');
    const prose = join(docs, 'prose.md');
    const rawKey = ['rawPayload', 'Ref'].join('');
    await writeFile(markdownLeak, `{"${rawKey}":"SECRET_MARKDOWN"}\n`);
    await writeFile(testLeak, `const record = { ${rawKey}: "SECRET_TEST" };\n`);
    await writeFile(prose, `This prose documents the ${rawKey} field without a serialized record.\n`);
    const output = [];
    const code = await runCli(['guard'], {
      repoRoot: fixtureRoot, trackedFiles: async () => [markdownLeak, testLeak, prose], buildRoots: [],
      stdout: { write(value) { output.push(value); } }, stderr: { write(value) { output.push(value); } },
    });
    const rendered = output.join('');
    assert.equal(code, CLI_EXIT.QUALITY_GATE_FAILED);
    assert.match(rendered, /docs[\\/]leak\.md/);
    assert.match(rendered, /tests[\\/]leak\.test\.mjs/);
    assert.equal(rendered.includes('prose.md'), false);
    assert.equal(/SECRET_(?:MARKDOWN|TEST)/u.test(rendered), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test('guard allows tracked fixture source that assembles a raw field at runtime', async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'moemoa-cli-guard-spread-'));
  try {
    const source = join(fixtureRoot, 'tests', 'fixture.test.mjs');
    await mkdir(dirname(source), { recursive: true });
    await writeFile(source, [
      `const rawKey = ['rawPayload', 'Ref'].join('');`,
      `const fixture = { ...validRecord, [rawKey]: ['raw/anilist/', 'fixture.json'].join('') };`,
      '',
    ].join('\n'));
    const output = [];
    const code = await runCli(['guard'], {
      repoRoot: fixtureRoot, trackedFiles: async () => [source], buildRoots: [],
      stdout: { write(value) { output.push(value); } }, stderr: { write(value) { output.push(value); } },
    });
    assert.equal(code, CLI_EXIT.OK);
    assert.equal(output.join('').includes('fixture.test.mjs'), false);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
