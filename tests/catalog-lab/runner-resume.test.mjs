import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadSourceRegistry } from '../../tools/catalog-lab/contracts/catalogContracts.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { buildCanonicalRevision } from '../../tools/catalog-lab/pipeline/canonical.mjs';
import { buildFieldClaims } from '../../tools/catalog-lab/pipeline/claims.mjs';
import { normalizeSourceRecord } from '../../tools/catalog-lab/pipeline/normalize.mjs';
import { storeSourceEnvelope } from '../../tools/catalog-lab/pipeline/raw-store.mjs';
import { createCatalogArtifactStore } from '../../tools/catalog-lab/pipeline/artifact-store.mjs';
import { createRateLimitedHttpClient, runCatalogPipeline } from '../../tools/catalog-lab/pipeline/runner.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const clock = Object.freeze({ now: () => '2026-08-17T00:00:00.000Z' });

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-runner-'));
  try {
    return await run(await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function target(index = 1) {
  return Object.freeze({
    targetKey: `ANILIST:${index}`,
    moemoaAnimeId: `anime:11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
    seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: String(index) }]),
    seedTitles: Object.freeze([{ locale: 'und', value: `Test title ${index}` }]),
    releaseYear: 2000,
    episodeCount: 1,
  });
}

function anilistPayload(id) {
  return {
    id, idMal: null, title: { romaji: `Test title ${id}`, english: null, native: null }, synonyms: [],
    format: 'TV', status: 'FINISHED', startDate: { year: 2000, month: null, day: null },
    endDate: { year: null, month: null, day: null }, season: null, seasonYear: null,
    episodes: 1, source: null, genres: [], coverImage: {}, studios: { nodes: [] },
    relations: { edges: [] }, externalLinks: [], characters: [],
  };
}

function wikidataPayload(id) {
  return {
    externalIds: {}, labels: {}, aliases: {}, sitelinks: {},
    claims: { P8729: [{ mainsnak: { snaktype: 'value', datavalue: { value: String(id), type: 'string' } } }] },
  };
}

function envelope(sourceId, row) {
  const id = row.seedExternalIds[0].value;
  return {
    sourceId,
    targetKey: row.targetKey,
    sourceEntityId: sourceId === 'anilist' ? id : `Q${id}`,
    responseStatus: 200,
    fetchedAt: clock.now(),
    requestFingerprint: `${sourceId}:fixture:${id}`,
    parserVersion: `${sourceId}-fixture-v1`,
    payload: sourceId === 'anilist' ? anilistPayload(Number(id)) : wikidataPayload(Number(id)),
  };
}

function adapterFor(sourceId, { failure } = {}) {
  return Object.freeze({
    async *collect({ targets }) {
      if (failure) throw failure;
      for (const row of targets) yield envelope(sourceId, row);
    },
  });
}

async function fixtureInput(workspace, { wikidataFailure, refresh = false } = {}) {
  return {
    workspace,
    targets: Array.from({ length: 10 }, (_, index) => target(index + 1)),
    registry: await loadSourceRegistry({ repoRoot }),
    adapters: {
      anilist: adapterFor('anilist'),
      wikidata: adapterFor('wikidata', { failure: wikidataFailure }),
    },
    bindings: {},
    selectedSources: ['anilist', 'wikidata'],
    allowNetwork: true,
    refresh,
    clock,
    httpFactory: () => ({ async request() { return new Response('{}'); } }),
    coverPipeline: async ({ target: row }) => ({
      status: 'STORED', sourceId: 'anilist', localRef: `images/covers/${row.moemoaAnimeId}/fixture.png`,
      byteSize: 12, created: false,
    }),
  };
}

test('artifact store persists one stable target manifest and immutable canonical current pointer', async () => {
  await withWorkspace(async (workspace) => {
    const row = target();
    const sourceEnvelope = envelope('anilist', row);
    const storedSource = await storeSourceEnvelope({ workspace, envelope: sourceEnvelope });
    const sourceRecord = JSON.parse(await (await import('node:fs/promises')).readFile(storedSource.path, 'utf8'));
    const normalizedRecord = normalizeSourceRecord(sourceRecord);
    const claims = buildFieldClaims({ target: row, normalizedRecords: [normalizedRecord] });
    const canonical = buildCanonicalRevision({
      target: row, sourceRecords: [sourceRecord], normalizedRecords: [normalizedRecord], fieldClaims: claims,
    });
    const store = createCatalogArtifactStore({ workspace });

    await store.writeManifest('golden', [row]);
    assert.deepEqual(await store.readManifest('golden'), [row]);
    const written = await store.writeCanonical({
      target: row, sourceRecords: [sourceRecord], normalizedRecords: [normalizedRecord], claims, canonical,
    });
    assert.equal((await store.readCurrent(row.moemoaAnimeId)).contentHash, canonical.revision.contentHash);
    assert.equal(written.created, true);
    assert.equal((await store.writeCanonical({
      target: row, sourceRecords: [sourceRecord], normalizedRecords: [normalizedRecord], claims, canonical,
    })).created, false);
  });
});

test('rate-limited source client spaces serialized request starts by the registry minimum', async () => {
  let time = 0;
  const starts = [];
  const client = createRateLimitedHttpClient({
    http: { async request() { starts.push(time); return new Response('{}'); } },
    minIntervalMs: 800,
    now: () => time,
    sleep: async (milliseconds) => { time += milliseconds; },
  });
  await client.request({ url: 'https://example.test/1' });
  await client.request({ url: 'https://example.test/2' });
  assert.deepEqual(starts, [0, 800]);
});

test('runner resumes completed source-target stages without duplicate records or images', async () => {
  await withWorkspace(async (workspace) => {
    const first = await runCatalogPipeline(await fixtureInput(workspace));
    const second = await runCatalogPipeline(await fixtureInput(workspace));
    assert.deepEqual(second.counts, first.counts);
    assert.equal(second.canonicalHash, first.canonicalHash);
    assert.equal(second.growth.sourceRecords, 0);
    assert.equal(second.growth.claims, 0);
    assert.equal(second.growth.canonicalRevisions, 0);
    assert.equal(second.growth.images, 0);
  });
});

test('one source failure is classified and does not erase another source or the last canonical revision', async () => {
  await withWorkspace(async (workspace) => {
    const first = await runCatalogPipeline(await fixtureInput(workspace));
    const failure = Object.assign(new Error('down'), { code: 'SOURCE_RETRY_EXHAUSTED', recoverable: true });
    const second = await runCatalogPipeline(await fixtureInput(workspace, { wikidataFailure: failure, refresh: true }));
    assert.equal(second.targets[0].sources.wikidata.stage, 'FAILED_RETRYABLE');
    assert.equal(second.targets[0].sources.anilist.stage, 'COMPLETED');
    assert.equal(second.targets[0].currentCanonicalHash, first.canonicalHash);
  });
});

test('runner rejects network omission, target overflow, unregistered sources, and forged workspaces before adapters run', async () => {
  await withWorkspace(async (workspace) => {
    const valid = await fixtureInput(workspace);
    await assert.rejects(runCatalogPipeline({ ...valid, allowNetwork: false }), { code: 'CATALOG_NETWORK_PERMISSION_REQUIRED' });
    await assert.rejects(runCatalogPipeline({ ...valid, targets: [...valid.targets, target(11)] }), { code: 'SOURCE_SCOPE_EXCEEDED' });
    await assert.rejects(runCatalogPipeline({ ...valid, selectedSources: ['unregistered'] }), { code: 'SOURCE_NOT_REGISTERED' });
  });
  await assert.rejects(runCatalogPipeline({
    workspace: {}, targets: [], registry: [], adapters: {}, bindings: {}, selectedSources: [], allowNetwork: false,
  }), { code: 'CATALOG_WORKSPACE_UNTRUSTED' });
});
