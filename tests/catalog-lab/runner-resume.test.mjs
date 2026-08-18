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
import { createStateStore } from '../../tools/catalog-lab/pipeline/state-store.mjs';
import { createCatalogArtifactStore } from '../../tools/catalog-lab/pipeline/artifact-store.mjs';
import {
  createDefaultCoverPipeline, createRateLimitedHttpClient, rebuildCatalogProfile, runCatalogPipeline,
} from '../../tools/catalog-lab/pipeline/runner.mjs';

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
    seedSource: 'legacy_aliases',
    seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: String(index) }]),
    seedTitles: Object.freeze([
      { locale: 'ko', value: `테스트 제목 ${index}` },
      { locale: 'und', value: `Test title ${index}` },
    ]),
    targetStatus: 'ACTIVE',
    createdAt: clock.now(),
    releaseYear: 2000,
    episodeCount: 1,
  });
}

function anilistPayload(id) {
  return {
    id, idMal: null, title: { romaji: `Test title ${id}`, english: null, native: null }, synonyms: [],
    format: 'TV', status: 'FINISHED', startDate: { year: 2000, month: null, day: null },
    endDate: { year: null, month: null, day: null }, season: null, seasonYear: null,
    episodes: 1, source: null, genres: [],
    coverImage: { extraLarge: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${id}.jpg` },
    studios: { nodes: [] },
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

async function fixtureInput(workspace, { wikidataFailure, refresh = false, coverPipeline } = {}) {
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
    coverPipeline: coverPipeline ?? (async ({ target: row }) => ({
      status: 'STORED', sourceId: 'anilist', localRef: `images/covers/${row.moemoaAnimeId}/fixture.png`,
      checksum: 'a'.repeat(64), byteSize: 12, width: 1, height: 1, created: false,
    })),
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

test('rate-limited source client slows future starts for server limits and exhausted reset windows', async () => {
  let time = 0;
  const starts = [];
  const responses = [
    new Response('{}', {
      headers: {
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': '1',
      },
    }),
    new Response('{}', {
      headers: {
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '10',
      },
    }),
    new Response('{}'),
  ];
  const client = createRateLimitedHttpClient({
    http: { async request() { starts.push(time); return responses.shift(); } },
    minIntervalMs: 2500,
    now: () => time,
    sleep: async (milliseconds) => { time += milliseconds; },
  });

  await client.request({ url: 'https://example.test/1' });
  await client.request({ url: 'https://example.test/2' });
  await client.request({ url: 'https://example.test/3' });

  assert.deepEqual(starts, [0, 3000, 10_000]);
});

test('full3998 runner accepts only an approved full-roster source and a batch of at most 100', async () => {
  await withWorkspace(async (workspace) => {
    const input = await fixtureInput(workspace);
    const accepted = await runCatalogPipeline({
      ...input,
      profile: 'full3998',
      approvedTargetCount: 3998,
      persistSnapshot: false,
      selectedSources: ['anilist'],
    });
    assert.equal(accepted.counts.targets, 10);

    await assert.rejects(runCatalogPipeline({
      ...input,
      profile: 'full3998',
      approvedTargetCount: 3998,
      persistSnapshot: false,
      selectedSources: ['wikidata'],
    }), { code: 'SOURCE_SCOPE_EXCEEDED' });

    await assert.rejects(runCatalogPipeline({
      ...input,
      profile: 'full3998',
      approvedTargetCount: 3999,
      persistSnapshot: false,
      selectedSources: ['anilist'],
    }), { code: 'SOURCE_SCOPE_EXCEEDED' });
  });
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

test('offline rebuild derives deterministic service projections without network or raw and cover growth', async () => {
  await withWorkspace(async (workspace) => {
    const input = await fixtureInput(workspace);
    const collected = await runCatalogPipeline(input);
    const store = createCatalogArtifactStore({ workspace });
    const currentBefore = await Promise.all(input.targets.map((row) => store.readCurrent(row.moemoaAnimeId)));
    const coversBefore = await Promise.all(input.targets.map((row) => store.writeCoverObservation(row)));

    const first = await rebuildCatalogProfile({
      workspace, profile: 'golden', targets: input.targets, clock,
    });
    const second = await rebuildCatalogProfile({
      workspace, profile: 'golden', targets: input.targets, clock,
    });

    assert.equal(first.networkRequests, 0);
    assert.equal(first.counts.targets, 10);
    assert.equal(first.counts.serviceProjections, 10);
    assert.equal(first.counts.reusedCovers, 10);
    assert.equal(first.growth.sourceRecords, 0);
    assert.equal(first.growth.images, 0);
    assert.equal(second.growth.claims, 0);
    assert.equal(second.growth.canonicalRevisions, 0);
    assert.equal(second.growth.sourceRecords, 0);
    assert.equal(second.growth.images, 0);
    assert.deepEqual(await Promise.all(input.targets.map((row) => store.readCurrent(row.moemoaAnimeId))), currentBefore);
    assert.deepEqual(await Promise.all(input.targets.map((row) => store.writeCoverObservation(row))), coversBefore);
    assert.equal((await store.readServiceProjection(input.targets[0])).canonicalHash, collected.targets[0].currentCanonicalHash);
    assert.equal((await store.readRebuildSnapshot('golden')).counts.serviceProjections, 10);
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

test('resume rebuilds current after an interrupted completed source checkpoint', async () => {
  await withWorkspace(async (workspace) => {
    const input = await fixtureInput(workspace);
    const row = input.targets[0];
    const persisted = await storeSourceEnvelope({ workspace, envelope: envelope('anilist', row) });
    await createStateStore({ workspace }).write({
      sourceId: 'anilist', targetKey: row.targetKey,
      state: { stage: 'COMPLETED', sourceRecordId: persisted.sourceRecordId },
    });
    input.selectedSources = ['anilist'];
    const result = await runCatalogPipeline(input);
    assert.ok(result.targets[0].currentCanonicalHash);
  });
});

test('artifact store rejects a changed golden manifest after its first immutable write', async () => {
  await withWorkspace(async (workspace) => {
    const store = createCatalogArtifactStore({ workspace });
    await store.writeManifest('golden', [target(1)]);
    await assert.rejects(store.writeManifest('golden', [target(2)]), { code: 'CATALOG_ARTIFACT_COLLISION' });
    assert.deepEqual(await store.readManifest('golden'), [target(1)]);
  });
});

test('cover failures preserve text canonical and write a finite classified snapshot', async () => {
  await withWorkspace(async (workspace) => {
    const failure = Object.assign(new Error('cover pipeline rejected'), { code: 'IMAGE_DECODE_FAILED' });
    const result = await runCatalogPipeline(await fixtureInput(workspace, {
      refresh: true,
      coverPipeline: async () => { throw failure; },
    }));
    assert.ok(result.targets.every((row) => row.currentCanonicalHash));
    assert.ok(result.targets.every((row) => row.cover.status === 'FAILED'));
    assert.ok(result.targets.every((row) => row.cover.errorCode === 'IMAGE_DECODE_FAILED'));
    assert.ok(result.targets.every((row) => row.sources.anilist.stage === 'CLAIMS_BUILT'));
  });
});

test('runner snapshots selected and retained source checkpoints with the declared intermediate stages', async () => {
  await withWorkspace(async (workspace) => {
    const firstInput = await fixtureInput(workspace);
    firstInput.selectedSources = ['anilist'];
    const first = await runCatalogPipeline(firstInput);
    const secondInput = await fixtureInput(workspace, { refresh: true });
    secondInput.selectedSources = ['wikidata'];
    const second = await runCatalogPipeline(secondInput);
    const sourceStates = second.targets[0].sources;
    assert.equal(sourceStates.anilist.stage, 'COMPLETED');
    assert.ok(sourceStates.anilist.sourceRecordId, JSON.stringify(sourceStates.anilist));
    assert.equal(second.targets[0].currentCanonicalHash, first.targets[0].currentCanonicalHash);
  });
});

test('artifact store rejects unsafe source-record path segments', async () => {
  await withWorkspace(async (workspace) => {
    const store = createCatalogArtifactStore({ workspace });
    await assert.rejects(store.readSourceRecord({
      sourceId: '../anilist', targetKey: 'ANILIST:1', sourceRecordId: '../escape',
    }), { code: 'CATALOG_ARTIFACT_INVALID' });
  });
});

test('default cover pipeline refuses retained unselected source before any client or transport request', async () => {
  await withWorkspace(async (workspace) => {
    const initial = await fixtureInput(workspace, {
      coverPipeline: async () => { throw Object.assign(new Error('defer cover'), { code: 'IMAGE_DECODE_FAILED' }); },
    });
    initial.selectedSources = ['anilist'];
    const first = await runCatalogPipeline(initial);
    let requests = 0;
    const refresh = await fixtureInput(workspace, { refresh: true });
    refresh.selectedSources = ['wikidata'];
    refresh.coverPipeline = createDefaultCoverPipeline();
    refresh.httpFactory = () => ({ async request() { requests += 1; throw new Error('unexpected request'); } });
    const second = await runCatalogPipeline(refresh);

    assert.equal(requests, 0);
    assert.equal(second.targets[0].cover.status, 'FAILED');
    assert.equal(second.targets[0].cover.errorCode, 'COVER_SOURCE_NOT_SELECTED');
    assert.equal(second.targets[0].sources.wikidata.stage, 'FAILED_PERMANENT');
    assert.equal(second.targets[0].currentCanonicalHash, first.targets[0].currentCanonicalHash);
  });
});
