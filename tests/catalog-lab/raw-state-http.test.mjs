import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
