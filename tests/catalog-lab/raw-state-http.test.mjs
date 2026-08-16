import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { sha256, stableStringify } from '../../tools/catalog-lab/lib/hash.mjs';
import { createHttpClient } from '../../tools/catalog-lab/lib/http.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { storeSourceEnvelope } from '../../tools/catalog-lab/pipeline/raw-store.mjs';
import { createStateStore } from '../../tools/catalog-lab/pipeline/state-store.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-raw-state-'));
  try {
    return await run(await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function createEnvelope(payload = { id: 1, title: { native: 'Test title' } }) {
  return {
    sourceId: 'anilist',
    targetKey: 'ANILIST:1',
    sourceEntityId: '1',
    responseStatus: 200,
    fetchedAt: '2026-08-17T00:00:00.000Z',
    requestFingerprint: 'graphql:media:1',
    parserVersion: 'anilist-v1',
    payload,
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

test('stable serialization gives equivalent object key order the same SHA-256 hash', () => {
  assert.equal(stableStringify({ b: 2, a: { d: 4, c: 3 } }), '{"a":{"c":3,"d":4},"b":2}');
  assert.equal(sha256({ a: 1, b: 2 }), sha256({ b: 2, a: 1 }));
});

test('same envelope is stored once and changed content creates a new immutable revision', async () => {
  await withWorkspace(async (workspace) => {
    const first = await storeSourceEnvelope({ workspace, envelope: createEnvelope() });
    const second = await storeSourceEnvelope({ workspace, envelope: createEnvelope() });
    const refresh = await storeSourceEnvelope({
      workspace,
      envelope: createEnvelope({ id: 1, title: { native: 'Changed test title' } }),
    });

    assert.equal(second.sourceRecordId, first.sourceRecordId);
    assert.equal(second.created, false);
    assert.notEqual(refresh.sourceRecordId, first.sourceRecordId);
    assert.equal(refresh.created, true);

    const firstRecord = JSON.parse(await readFile(first.path, 'utf8'));
    assert.deepEqual(firstRecord.payload, { id: 1, title: { native: 'Test title' } });
    assert.equal(firstRecord.targetKey, 'ANILIST:1');
  });
});

test('a corrupt content-addressed raw record is quarantined before a complete immutable revision is published', async () => {
  await withWorkspace(async (workspace) => {
    const envelope = createEnvelope();
    const { fetchedAt, ...identity } = envelope;
    const sourceRecordId = sha256(identity);
    const directory = workspace.resolve('raw', 'anilist', 'anilist-1');
    const path = workspace.resolve('raw', 'anilist', 'anilist-1', `${sourceRecordId}.json`);
    await mkdir(directory, { recursive: true });
    await writeFile(path, '{"sourceRecordId":"partial"', 'utf8');

    const result = await storeSourceEnvelope({ workspace, envelope });
    const record = JSON.parse(await readFile(path, 'utf8'));

    assert.equal(result.created, true);
    assert.equal(record.sourceRecordId, sourceRecordId);
    assert.equal(record.payloadHash, sha256(envelope.payload));
    assert.deepEqual(record.payload, envelope.payload);
    assert.equal((await readdir(directory)).some((name) => name.includes('.corrupt.')), true);
  });
});

test('competing corrupt-record repair never quarantines a valid publication', { timeout: 1000 }, async () => {
  await withWorkspace(async (workspace) => {
    const firstEnvelope = createEnvelope();
    const secondEnvelope = { ...createEnvelope(), fetchedAt: '2026-08-17T00:01:00.000Z' };
    const { fetchedAt, ...identity } = firstEnvelope;
    const sourceRecordId = sha256(identity);
    const directory = workspace.resolve('raw', 'anilist', 'anilist-1');
    const path = workspace.resolve('raw', 'anilist', 'anilist-1', `${sourceRecordId}.json`);
    const firstRepairLocked = deferred();
    const releaseFirstRepair = deferred();
    const secondRepairWaiting = deferred();
    await mkdir(directory, { recursive: true });
    await writeFile(path, '{"sourceRecordId":"partial"', 'utf8');

    const first = storeSourceEnvelope({
      workspace,
      envelope: firstEnvelope,
      onRepairLocked: async () => {
        firstRepairLocked.resolve();
        await releaseFirstRepair.promise;
      },
    });
    await firstRepairLocked.promise;
    const second = storeSourceEnvelope({
      workspace,
      envelope: secondEnvelope,
      onRepairWaiting: async () => secondRepairWaiting.resolve(),
    });
    await secondRepairWaiting.promise;
    releaseFirstRepair.resolve();

    const [firstResult, secondResult] = await Promise.all([first, second]);
    const record = JSON.parse(await readFile(path, 'utf8'));
    const quarantined = (await readdir(directory)).filter((name) => name.includes('.corrupt.'));

    assert.equal(firstResult.created, true);
    assert.equal(secondResult.created, false);
    assert.equal(record.fetchedAt, firstEnvelope.fetchedAt);
    assert.equal(quarantined.length, 1);
    assert.equal((await readdir(directory)).some((name) => name.includes('.repair.lock')), false);
  });
});

test('state writes are atomic and an orphaned temporary file never replaces the checkpoint', async () => {
  await withWorkspace(async (workspace) => {
    const stateStore = createStateStore({ workspace });
    const state = await stateStore.write({
      sourceId: 'anilist', targetKey: 'ANILIST:1', state: { stage: 'FETCHED', attempts: 1 },
    });
    await writeFile(`${state.path}.interrupted.tmp`, JSON.stringify({ stage: 'CORRUPTED' }));

    assert.deepEqual(await stateStore.read({ sourceId: 'anilist', targetKey: 'ANILIST:1' }), {
      sourceId: 'anilist', targetKey: 'ANILIST:1', stage: 'FETCHED', attempts: 1,
    });
    assert.match(state.path, /state[\\/]anilist[\\/]anilist-1\.json$/);
  });
});

test('transient failures retry four times before the fifth attempt is exhausted', async (t) => {
  const sleeps = [];
  const fetchImpl = t.mock.fn(async () => new Response('', { status: 503 }));
  const http = createHttpClient({ fetchImpl, sleep: async (ms) => sleeps.push(ms), random: () => 0 });

  await assert.rejects(http.request({ url: 'https://example.test/data', kind: 'DATA' }), {
    code: 'SOURCE_RETRY_EXHAUSTED',
  });
  assert.equal(fetchImpl.mock.callCount(), 5);
  assert.deepEqual(sleeps, [500, 1000, 2000, 4000]);
});

test('429 honors Retry-After and stops after five retries', async (t) => {
  const sleeps = [];
  const fetchImpl = t.mock.fn(async () => new Response('', {
    status: 429,
    headers: { 'Retry-After': '2' },
  }));
  const http = createHttpClient({ fetchImpl, sleep: async (ms) => sleeps.push(ms), random: () => 0 });

  await assert.rejects(http.request({ url: 'https://example.test/data', kind: 'DATA' }), {
    code: 'SOURCE_RETRY_EXHAUSTED',
  });
  assert.equal(fetchImpl.mock.callCount(), 6);
  assert.deepEqual(sleeps, [2000, 2000, 2000, 2000, 2000]);
});

test('HTTP request forwards the declared RequestInit unchanged', async () => {
  const init = {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
    body: '{"query":"query Media"}',
  };
  let received;
  const http = createHttpClient({
    fetchImpl: async (url, requestInit) => {
      received = { url, requestInit };
      return new Response('{"data":{}}', { status: 200 });
    },
  });

  await http.request({ url: 'https://example.test/graphql', init });
  assert.equal(received.url, 'https://example.test/graphql');
  assert.equal(received.requestInit, init);
});

function cancellableFailure(status, headers = {}) {
  let cancelled = 0;
  return {
    ok: false,
    status,
    headers: new Headers(headers),
    body: { cancel: async () => { cancelled += 1; } },
    get cancelled() { return cancelled; },
  };
}

test('every retried and terminal non-success response body is cancelled', async () => {
  const responses = Array.from({ length: 5 }, () => cancellableFailure(503));
  const retried = [...responses];
  const http = createHttpClient({
    fetchImpl: async () => retried.shift(), sleep: async () => {}, random: () => 0,
  });

  await assert.rejects(http.request({ url: 'https://example.test/retry' }), {
    code: 'SOURCE_RETRY_EXHAUSTED',
  });
  assert.equal(retried.length, 0);
  assert.deepEqual(responses.map((response) => response.cancelled), [1, 1, 1, 1, 1]);

  const terminal = cancellableFailure(404);
  await assert.rejects(createHttpClient({ fetchImpl: async () => terminal }).request({
    url: 'https://example.test/missing',
  }), { code: 'SOURCE_NOT_FOUND' });
  assert.equal(terminal.cancelled, 1);
});

test('Retry-After accepts only delay-seconds or future HTTP dates and otherwise falls back to backoff', async () => {
  const cases = [
    { value: '2', expected: 2000 },
    { value: 'Mon, 17 Aug 2026 00:00:02 GMT', expected: 2000 },
    { value: '-1', expected: 500 },
    { value: 'not a retry date', expected: 500 },
    { value: 'Sun, 16 Aug 2026 23:59:59 GMT', expected: 500 },
  ];
  for (const { value, expected } of cases) {
    const sleeps = [];
    let call = 0;
    const http = createHttpClient({
      fetchImpl: async () => (++call === 1
        ? new Response('', { status: 429, headers: { 'Retry-After': value } })
        : new Response('', { status: 200 })),
      sleep: async (milliseconds) => sleeps.push(milliseconds),
      random: () => 0,
      now: () => Date.parse('Mon, 17 Aug 2026 00:00:00 GMT'),
    });

    await http.request({ url: 'https://example.test/rate-limit' });
    assert.deepEqual(sleeps, [expected], value);
  }
});

test('404 is not retried', async (t) => {
  const fetchImpl = t.mock.fn(async () => new Response('', { status: 404 }));
  const http = createHttpClient({ fetchImpl });

  await assert.rejects(http.request({ url: 'https://example.test/data', kind: 'DATA' }), {
    code: 'SOURCE_NOT_FOUND',
  });
  assert.equal(fetchImpl.mock.callCount(), 1);
});

test('401 and 403 pause the source without retrying', async (t) => {
  for (const status of [401, 403]) {
    const fetchImpl = t.mock.fn(async () => new Response('', { status }));
    const http = createHttpClient({ fetchImpl });

    await assert.rejects(http.request({ url: 'https://example.test/data', kind: 'DATA' }), {
      code: 'SOURCE_PAUSED',
    });
    assert.equal(fetchImpl.mock.callCount(), 1);
  }
});
