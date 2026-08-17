import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  COVER_MIME,
  createCoverStorageTestHarness,
  createChromiumLifecycleTestHarness,
  createConcreteCoverTransportTestHarness,
  createPinnedCoverTransport,
  decodeCoverWithChromium,
  downloadCoverCandidate,
  getApprovedCoverSourcePolicy,
  inspectImageBytes,
  selectCanonicalCover,
  storeValidatedCover,
} from '../../tools/catalog-lab/pipeline/covers.mjs';
import {
  jpegBytes, nonSquareJpegBytes, pngBytes, truncatedPngBytes, webpBytes, webpVp8xBytes,
} from './fixtures/cover-valid-images.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const animeId = 'anime:11111111-1111-4111-8111-111111111111';

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-catalog-covers-'));
  try {
    return await run(await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function candidate(overrides = {}) {
  return {
    identity: { status: 'MATCHED', confidenceClass: 'EXACT_ID' },
    sourceId: 'anilist',
    sourceUrl: 'https://s4.anilist.co/cover.png',
    sourceRecordId: 'a'.repeat(64),
    retrievedAt: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
}

const policy = getApprovedCoverSourcePolicy('anilist');

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function immediateRetryTimers(delays = []) {
  let nextHandle = 0;
  const active = new Set();
  return {
    setTimeout(callback, milliseconds) {
      delays.push(milliseconds);
      const handle = ++nextHandle;
      active.add(handle);
      queueMicrotask(() => {
        if (!active.delete(handle)) return;
        callback();
      });
      return handle;
    },
    clearTimeout(handle) { active.delete(handle); },
  };
}

function forbiddenRetryTimers(message) {
  return {
    setTimeout() { assert.fail(message); },
    clearTimeout() {},
  };
}

function scriptedHttps(steps, calls = []) {
  let index = 0;
  return (options, onResponse) => {
    const request = new EventEmitter();
    let response;
    let destroyed = false;
    calls.push({ options, request, get response() { return response; } });
    request.destroy = (error) => {
      if (destroyed) return request;
      destroyed = true;
      response?.destroy();
      if (error) queueMicrotask(() => request.emit('error', error));
      return request;
    };
    request.end = () => {
      const step = steps[Math.min(index, steps.length - 1)];
      index += 1;
      queueMicrotask(() => step({
        options,
        request,
        fail(error) { request.emit('error', error); },
        respond({ status = 200, headers = { 'content-type': 'image/png' }, remoteAddress = options.hostname, bytes = pngBytes, keepOpen = false } = {}) {
          response = new PassThrough();
          response.statusCode = status;
          response.headers = headers;
          response.socket = { remoteAddress };
          onResponse(response);
          if (bytes?.byteLength) response.write(bytes);
          if (!keepOpen) response.end();
          return response;
        },
      }));
    };
    options.signal?.addEventListener('abort', () => request.destroy(options.signal.reason), { once: true });
    return request;
  };
}

function transportFor(bytes = pngBytes, mime = 'image/png') {
  return createPinnedCoverTransport({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async ({ url, address }) => ({ url, connectedAddress: address, redirected: false, headers: new Headers({ 'content-type': mime }), body: new Response(bytes).body }),
  });
}

function observeDecodeWithChromium(record) {
  return createChromiumLifecycleTestHarness({ loadChromium: () => import('@playwright/test') })
    .run({ record, timeoutMs: 5_000, cleanupTimeoutMs: 250 });
}

test('inspectImageBytes recognizes only bounded JPEG, PNG, and WebP structures', () => {
  assert.deepEqual(inspectImageBytes({ declaredMime: COVER_MIME.PNG, bytes: pngBytes }), {
    mimeType: COVER_MIME.PNG, extension: 'png', width: 1, height: 1, byteSize: pngBytes.byteLength,
  });
  assert.deepEqual(inspectImageBytes({ declaredMime: COVER_MIME.JPEG, bytes: jpegBytes }), {
    mimeType: COVER_MIME.JPEG, extension: 'jpg', width: 1, height: 1, byteSize: jpegBytes.byteLength,
  });
  assert.deepEqual(inspectImageBytes({ declaredMime: COVER_MIME.WEBP, bytes: webpBytes }), {
    mimeType: COVER_MIME.WEBP, extension: 'webp', width: 1, height: 1, byteSize: webpBytes.byteLength,
  });
  assert.deepEqual(inspectImageBytes({ declaredMime: COVER_MIME.WEBP, bytes: webpVp8xBytes }), {
    mimeType: COVER_MIME.WEBP, extension: 'webp', width: 2, height: 3, byteSize: webpVp8xBytes.byteLength,
  });
});

test('inspectImageBytes preserves non-square JPEG SOF width and height', () => {
  assert.deepEqual(inspectImageBytes({ declaredMime: COVER_MIME.JPEG, bytes: nonSquareJpegBytes }), {
    mimeType: COVER_MIME.JPEG, extension: 'jpg', width: 2, height: 3, byteSize: nonSquareJpegBytes.byteLength,
  });
});

test('cover validation rejects spoofed MIME, truncation, unsafe pixels, and unsafe MIME', () => {
  assert.throws(() => inspectImageBytes({ declaredMime: COVER_MIME.JPEG, bytes: pngBytes }),
    { code: 'IMAGE_MIME_SIGNATURE_MISMATCH' });
  assert.throws(() => inspectImageBytes({ declaredMime: COVER_MIME.PNG, bytes: truncatedPngBytes }),
    { code: 'IMAGE_TRUNCATED' });
  const oversized = new Uint8Array(pngBytes);
  oversized.set([0x7f, 0xff, 0xff, 0xff], 16);
  assert.throws(() => inspectImageBytes({ declaredMime: COVER_MIME.PNG, bytes: oversized }),
    { code: 'IMAGE_DIMENSIONS_INVALID' });
  assert.throws(() => inspectImageBytes({ declaredMime: 'text/html', bytes: pngBytes }),
    { code: 'IMAGE_MIME_UNSUPPORTED' });
});

test('cover download applies exact URL, redirect, MIME, content-length, and stream bounds', async () => {
  const result = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor(), maxBytes: 4096 });
  assert.equal(result.mimeType, COVER_MIME.PNG);
  assert.equal(result.validationStatus, 'SNIFFED');
  assert.equal(result.rightsStatus, 'TEST_ONLY_UNKNOWN');
  assert.equal(result.distributionStatus, 'PROHIBITED');

  await assert.rejects(downloadCoverCandidate({ candidate: candidate({ sourceUrl: 'file:///tmp/cover.png' }), policy, transport: transportFor() }),
    { code: 'IMAGE_URL_INVALID' });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate({ identity: { status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS' } }), policy, transport: transportFor() }),
    { code: 'COVER_IDENTITY_NOT_EXACT' });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor(pngBytes, 'text/html') }), { code: 'IMAGE_MIME_UNSUPPORTED' });
});

test('trusted external workspace stores and deduplicates validated fixture covers on every platform', async () => {
  await withWorkspace(async (workspace) => {
    const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor() });
    await assert.rejects(storeValidatedCover({ record: sniffed, workspace, animeId }), { code: 'COVER_RECORD_UNTRUSTED' });
    const storage = createCoverStorageTestHarness();
    const first = await storage.storeFixture({ bytes: pngBytes, declaredMime: 'image/png', workspace, animeId });
    const second = await storage.storeFixture({ bytes: pngBytes, declaredMime: 'image/png', workspace, animeId });
    assert.equal(first.created, true);
    assert.equal(second.localRef, first.localRef);
    assert.equal(second.created, false);
    assert.deepEqual(Object.keys(first).sort(), ['byteSize', 'checksum', 'created', 'localRef']);
    assert.equal(selectCanonicalCover([first]), null);
    assert.match(first.localRef, /^images\/covers\/anime-11111111-1111-4111-8111-111111111111\/[a-f0-9]{64}\.png$/u);
    assert.deepEqual(new Uint8Array(await readFile(workspace.resolve(...first.localRef.split('/')))), pngBytes);
    await assert.rejects(storage.storeFixture({ bytes: pngBytes, declaredMime: 'image/png', workspace, animeId: '../outside' }),
      { code: 'COVER_ANIME_ID_INVALID' });

    const textRecord = Object.freeze({ title: 'Synthetic title', description: 'must remain intact' });
    await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor(truncatedPngBytes), textRecord }), { code: 'IMAGE_TRUNCATED' });
    assert.deepEqual(textRecord, { title: 'Synthetic title', description: 'must remain intact' });
  });
});

test('Chromium decodes a structurally valid synthetic cover without adding an image dependency', async () => {
  const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor() });
  const observation = await observeDecodeWithChromium(sniffed);
  assert.deepEqual(observation, { ok: true, dimensions: { width: 1, height: 1 } });
  assert.equal(sniffed.validationStatus, 'SNIFFED');
});

test('Chromium lifecycle observation decodes real synthetic JPEG, PNG, and WebP bytes with exact dimensions', async () => {
  for (const [bytes, mimeType] of [[jpegBytes, 'image/jpeg'], [pngBytes, 'image/png'], [webpBytes, 'image/webp']]) {
    const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor(bytes, mimeType) });
    const observation = await observeDecodeWithChromium(sniffed);
    assert.deepEqual(observation, { ok: true, dimensions: { width: 1, height: 1 } }, mimeType);
    assert.equal(sniffed.validationStatus, 'SNIFFED', mimeType);
  }
});

test('non-square JPEG structural dimensions agree with Chromium decode', async () => {
  const sniffed = await downloadCoverCandidate({
    candidate: candidate(), policy, transport: transportFor(nonSquareJpegBytes, COVER_MIME.JPEG),
  });
  const observation = await observeDecodeWithChromium(sniffed);
  assert.deepEqual(observation, { ok: true, dimensions: { width: 2, height: 3 } });
  assert.deepEqual({ width: sniffed.width, height: sniffed.height }, observation.dimensions);
});

test('canonical cover selection is deterministic: exact identity, decoded state, area, source ID', () => {
  const selected = selectCanonicalCover([
    { ...candidate({ sourceId: 'zeta', identity: { status: 'MATCHED', confidenceClass: 'EXACT_RULE' } }), validationStatus: 'DECODED', width: 900, height: 900 },
    { ...candidate({ sourceId: 'beta' }), validationStatus: 'STRUCTURE_VALID', width: 9999, height: 9999 },
    { ...candidate({ sourceId: 'alpha' }), validationStatus: 'DECODED', width: 800, height: 800 },
    { ...candidate({ sourceId: 'beta' }), validationStatus: 'DECODED', width: 800, height: 800 },
  ]);
  assert.equal(selected, null);
});

test('injected cover pipeline requires an approved HTTPS origin and pinned public resolution without production promotion', async () => {
  const policy = getApprovedCoverSourcePolicy('anilist');
  const transport = createPinnedCoverTransport({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async ({ url, address }) => ({
      url, connectedAddress: address, redirected: false,
      headers: new Headers({ 'content-type': 'image/png' }), body: new Response(pngBytes).body,
    }),
  });
  const downloaded = await downloadCoverCandidate({
    candidate: candidate({ sourceUrl: 'https://s4.anilist.co/cover.png' }), policy, transport,
  });
  assert.equal(downloaded.validationStatus, 'SNIFFED');
  assert.equal(selectCanonicalCover([downloaded]), null);
  const observation = await observeDecodeWithChromium(downloaded);
  assert.deepEqual(observation, { ok: true, dimensions: { width: 1, height: 1 } });
  assert.equal(selectCanonicalCover([observation]), null);
});

test('both injected transport factories are excluded from production decode, storage, and selection on every platform', async () => {
  const injectedTransports = [
    transportFor(),
    createConcreteCoverTransportTestHarness({
      resolve: async () => [{ address: '8.8.8.8', family: 4 }],
      httpsRequest: scriptedHttps([({ respond }) => respond()]),
    }),
  ];
  for (const transport of injectedTransports) {
    const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport });
    assert.doesNotMatch(JSON.stringify(sniffed), /production|concrete|transport|trust/iu);
    await assert.rejects(decodeCoverWithChromium({ record: sniffed }),
      { code: 'COVER_RECORD_UNTRUSTED' });
    let workspaceAccesses = 0;
    const workspace = new Proxy({}, {
      get() { workspaceAccesses += 1; throw new Error('untrusted transport reached workspace access'); },
    });
    await assert.rejects(storeValidatedCover({ record: sniffed, workspace, animeId }),
      { code: 'COVER_RECORD_UNTRUSTED' });
    assert.equal(workspaceAccesses, 0);
    assert.equal(selectCanonicalCover([sniffed]), null);
  }
});

test('pinned transport refuses private, mapped, alternate numeric, and rebinding DNS answers', async () => {
  const policy = getApprovedCoverSourcePolicy('anilist');
  for (const address of ['127.0.0.1', '::1', '::ffff:10.0.0.1']) {
    const transport = createPinnedCoverTransport({
      resolve: async () => [{ address, family: address.includes(':') ? 6 : 4 }], request: async () => null,
    });
    await assert.rejects(downloadCoverCandidate({
      candidate: candidate({ sourceUrl: 'https://s4.anilist.co/cover.png' }), policy, transport,
    }), { code: 'IMAGE_ADDRESS_FORBIDDEN' });
  }
  const rebinding = createPinnedCoverTransport({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }], request: async () => null,
  });
  await assert.rejects(downloadCoverCandidate({
    candidate: candidate({ sourceUrl: 'https://s4.anilist.co/cover.png' }), policy, transport: rebinding,
  }), { code: 'IMAGE_ADDRESS_FORBIDDEN' });
});

test('cover download rejects every non-global address encoding and non-success response', async () => {
  for (const address of ['::ffff:7f00:1', '0:0:0:0:0:0:0:1', 'ff02::1', '2001:db8::1', '198.51.100.7', '203.0.113.44']) {
    const transport = createPinnedCoverTransport({ resolve: async () => [{ address, family: 6 }], request: async () => null });
    await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport }), { code: 'IMAGE_ADDRESS_FORBIDDEN' });
  }
  const statusTransport = createPinnedCoverTransport({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async ({ url, address }) => ({ status: 404, url, connectedAddress: address, redirected: false, headers: new Headers({ 'content-type': 'image/png' }), body: new Response(pngBytes).body }),
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: statusTransport }), { code: 'IMAGE_HTTP_STATUS_INVALID' });
});

test('IPv6 cover pins allow only allocated global unicast after current special-purpose exclusions', async () => {
  const allowed = [
    '2000::1',
    '2001:1::1',
    '2001:1::2',
    '2001:1::3',
    '2001:3::1',
    '2001:4:112::1',
    '2001:20::1',
    '2001:30::1',
    '2001:200::1',
    '2001:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:db7:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:db9::1',
    '2003::1',
    '3fff:1000::1',
    '3fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    '64:ff9b::808:808',
    '::ffff:8.8.8.8',
  ];
  for (const address of allowed) {
    const transport = createPinnedCoverTransport({
      resolve: async () => [{ address, family: 6 }],
      request: async ({ url }) => ({
        url, connectedAddress: address, redirected: false,
        headers: new Headers({ 'content-type': 'image/png' }), body: new Response(pngBytes).body,
      }),
    });
    const record = await downloadCoverCandidate({ candidate: candidate(), policy, transport });
    assert.equal(record.validationStatus, 'SNIFFED', address);
  }

  const forbidden = [
    '1fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    '4000::1',
    '5f00::1',
    '64:ff9b::a00:1',
    '64:ff9b:1::808:808',
    '100::1',
    '100:0:0:1::1',
    '2001::1',
    '2001:1::4',
    '2001:1ff:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:2::1',
    '2001:10::1',
    '2001:1f:ffff:ffff:ffff:ffff:ffff:ffff',
    '2001:db8::1',
    '2002:808:808::1',
    '2002:7f00:1::1',
    '3fff::1',
    '3fff:fff:ffff:ffff:ffff:ffff:ffff:ffff',
    '::ffff:10.0.0.1',
  ];
  for (const address of forbidden) {
    const transport = createPinnedCoverTransport({
      resolve: async () => [{ address, family: 6 }],
      request: async () => assert.fail(`request reached for ${address}`),
    });
    await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport }),
      { code: 'IMAGE_ADDRESS_FORBIDDEN' }, address);
  }
});

test('concrete image transport retries DNS, reset, 429, and 5xx only four total attempts', async () => {
  const sleeps = [];
  let dnsAttempts = 0;
  const dnsTransport = createConcreteCoverTransportTestHarness({
    resolve: async () => {
      dnsAttempts += 1;
      if (dnsAttempts < 4) throw Object.assign(new Error('temporary DNS failure'), { code: 'EAI_AGAIN' });
      return [{ address: '8.8.8.8', family: 4 }];
    },
    httpsRequest: scriptedHttps([({ respond }) => respond()]),
    retryTimers: immediateRetryTimers(), random: () => 0,
  });
  const dnsRecord = await downloadCoverCandidate({ candidate: candidate(), policy, transport: dnsTransport });
  assert.equal(dnsRecord.validationStatus, 'SNIFFED');
  assert.equal(dnsAttempts, 4);

  const calls = [];
  const transport = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([
      ({ fail }) => fail(Object.assign(new Error('reset'), { code: 'ECONNRESET' })),
      ({ respond }) => respond({ status: 429, headers: { 'retry-after': '2' }, keepOpen: true, bytes: null }),
      ({ respond }) => respond({ status: 503, keepOpen: true, bytes: null }),
      ({ respond }) => respond(),
    ], calls),
    retryTimers: immediateRetryTimers(sleeps), random: () => 0,
  });
  const record = await downloadCoverCandidate({ candidate: candidate(), policy, transport });
  assert.equal(record.validationStatus, 'SNIFFED');
  assert.equal(calls.length, 4);
  assert.deepEqual(sleeps, [500, 2000, 2000]);
  assert.equal(calls[1].response.destroyed, true);
  assert.equal(calls[2].response.destroyed, true);
});

test('concrete image transport rejects an in-range Retry-After that cannot fit the overall deadline', async () => {
  const calls = [];
  const legacySleeps = [];
  const transport = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([
      ({ respond }) => respond({ status: 429, headers: { 'retry-after': '2' }, keepOpen: true, bytes: null }),
      ({ respond }) => respond(),
    ], calls),
    sleep: async (milliseconds) => legacySleeps.push(milliseconds),
    retryTimers: forbiddenRetryTimers('over-budget retry must not schedule a timer'),
    overallTimeoutMs: 25,
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport }),
    { code: 'IMAGE_TIMEOUT' });
  assert.equal(calls.length, 1);
  assert.deepEqual(legacySleeps, []);
});

test('concrete image transport rejects valid oversized Retry-After values without a retry timer', async () => {
  for (const retryAfter of ['2147484', '9007199254741', 'Fri, 31 Dec 9999 23:59:59 GMT']) {
    const calls = [];
    const scheduled = [];
    let nextHandle = 0;
    const active = new Set();
    const transport = createConcreteCoverTransportTestHarness({
      resolve: async () => [{ address: '8.8.8.8', family: 4 }],
      httpsRequest: scriptedHttps([
        ({ respond }) => respond({ status: 429, headers: { 'retry-after': retryAfter }, keepOpen: true, bytes: null }),
        ({ respond }) => respond(),
      ], calls),
      retryTimers: {
        setTimeout(callback, milliseconds) {
          scheduled.push(milliseconds);
          const handle = ++nextHandle;
          active.add(handle);
          queueMicrotask(() => {
            if (!active.delete(handle)) return;
            callback();
          });
          return handle;
        },
        clearTimeout(handle) { active.delete(handle); },
      },
      random: () => 0,
      now: () => Date.parse('Mon, 17 Aug 2026 00:00:00 GMT'),
    });
    await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport }),
      { code: 'IMAGE_TIMEOUT' }, retryAfter);
    assert.equal(calls.length, 1, retryAfter);
    assert.deepEqual(scheduled, [], retryAfter);
    assert.equal(active.size, 0, retryAfter);
  }
});

test('concrete image transport aborts during backoff with no retry or timer leak', async () => {
  const calls = [];
  const operation = new AbortController();
  const scheduled = [];
  const active = new Set();
  let nextHandle = 0;
  const transport = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([
      ({ respond }) => respond({ status: 503, keepOpen: true, bytes: null }),
      ({ respond }) => respond(),
    ], calls),
    sleep: async () => {},
    operationSignal: operation.signal,
    retryTimers: {
      setTimeout(_callback, milliseconds) {
        scheduled.push(milliseconds);
        const handle = ++nextHandle;
        active.add(handle);
        queueMicrotask(() => operation.abort(Object.assign(new Error('test overall timeout'), { code: 'IMAGE_TIMEOUT' })));
        return handle;
      },
      clearTimeout(handle) { active.delete(handle); },
    },
    random: () => 0,
    overallTimeoutMs: 1_000,
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport }),
    { code: 'IMAGE_TIMEOUT' });
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.deepEqual(scheduled, [500]);
  assert.equal(active.size, 0);
});

test('concrete image transport destroys permanent statuses without retry and caps retryable statuses', async () => {
  const permanentCalls = [];
  const permanent = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([({ respond }) => respond({ status: 404, keepOpen: true, bytes: null })], permanentCalls),
    retryTimers: forbiddenRetryTimers('permanent response must not sleep'),
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: permanent }),
    { code: 'IMAGE_HTTP_STATUS_INVALID', status: 404 });
  assert.equal(permanentCalls.length, 1);
  assert.equal(permanentCalls[0].response.destroyed, true);

  const retryCalls = [];
  const exhausted = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([({ respond }) => respond({ status: 500, keepOpen: true, bytes: null })], retryCalls),
    retryTimers: immediateRetryTimers(), random: () => 0,
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: exhausted }),
    { code: 'IMAGE_RETRY_EXHAUSTED', status: 500 });
  assert.equal(retryCalls.length, 4);
  assert.equal(retryCalls.every(({ response }) => response.destroyed), true);
});

test('concrete image transport keeps SNI, Host, DNS pin, and actual remote-address checks', async () => {
  const calls = [];
  const pinned = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([({ respond }) => respond()], calls),
  });
  await downloadCoverCandidate({ candidate: candidate(), policy, transport: pinned });
  const options = calls[0].options;
  assert.equal(options.hostname, '8.8.8.8');
  assert.equal(options.servername, 's4.anilist.co');
  assert.equal(options.headers.host, 's4.anilist.co');
  await new Promise((resolve, reject) => options.lookup('ignored', {}, (error, address, family) => {
    try { assert.equal(error, null); assert.equal(address, '8.8.8.8'); assert.equal(family, 4); resolve(); } catch (failure) { reject(failure); }
  }));

  const mismatchCalls = [];
  const mismatch = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([({ respond }) => respond({ remoteAddress: '1.1.1.1' })], mismatchCalls),
    retryTimers: forbiddenRetryTimers('pin mismatch must not retry'),
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: mismatch }),
    { code: 'IMAGE_ADDRESS_MISMATCH' });
  assert.equal(mismatchCalls.length, 1);
});

test('concrete image transport deadlines cover never-resolving DNS and slow-drip body EOF', async () => {
  let dnsAttempts = 0;
  const neverDns = createConcreteCoverTransportTestHarness({
    resolve: async () => { dnsAttempts += 1; return new Promise(() => {}); },
    httpsRequest: assert.fail,
    retryTimers: immediateRetryTimers(), attemptTimeoutMs: 10, overallTimeoutMs: 100,
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: neverDns }),
    { code: 'IMAGE_TIMEOUT' });
  assert.equal(dnsAttempts, 1);

  const headerCalls = [];
  const neverHeaders = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([() => {}], headerCalls),
    retryTimers: immediateRetryTimers(), attemptTimeoutMs: 10, overallTimeoutMs: 100,
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: neverHeaders }),
    { code: 'IMAGE_TIMEOUT' });
  assert.equal(headerCalls.length, 1);

  const dripCalls = [];
  const slowDrip = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([({ respond }) => {
      const response = respond({ bytes: null, keepOpen: true });
      const interval = setInterval(() => response.write(Uint8Array.of(0)), 5);
      response.once('close', () => clearInterval(interval));
    }], dripCalls),
    retryTimers: immediateRetryTimers(), attemptTimeoutMs: 100, overallTimeoutMs: 25,
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: slowDrip }),
    { code: 'IMAGE_TIMEOUT' });
  assert.equal(dripCalls[0].response.destroyed, true);
});

test('Chromium operation deadline covers never and late import, launch, page, and evaluate acquisition', async () => {
  const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor() });

  const neverImport = createChromiumLifecycleTestHarness({ loadChromium: async () => new Promise(() => {}) });
  await assert.rejects(neverImport.run({ record: sniffed, timeoutMs: 10, cleanupTimeoutMs: 5 }),
    { code: 'IMAGE_DECODE_TIMEOUT' });

  const lateImport = deferred();
  const lateImportHarness = createChromiumLifecycleTestHarness({ loadChromium: () => lateImport.promise });
  const lateImportResult = lateImportHarness.run({ record: sniffed, timeoutMs: 10, cleanupTimeoutMs: 5 });
  await assert.rejects(lateImportResult, { code: 'IMAGE_DECODE_TIMEOUT' });
  lateImport.resolve({ chromium: { launch: () => assert.fail('launch must not begin after the operation deadline') } });

  const lateBrowser = deferred();
  let lateBrowserCloses = 0;
  let launchTimeout;
  const lateLaunchHarness = createChromiumLifecycleTestHarness({
    loadChromium: async () => ({ chromium: { launch: (options) => { launchTimeout = options.timeout; return lateBrowser.promise; } } }),
  });
  const lateLaunchResult = lateLaunchHarness.run({ record: sniffed, timeoutMs: 10, cleanupTimeoutMs: 5 });
  await assert.rejects(lateLaunchResult, { code: 'IMAGE_DECODE_TIMEOUT' });
  lateBrowser.resolve({ close: async () => { lateBrowserCloses += 1; } });
  await delay(15);
  assert.equal(lateBrowserCloses, 1);
  assert.equal(Number.isInteger(launchTimeout) && launchTimeout >= 1 && launchTimeout <= 10, true);

  const latePage = deferred();
  let latePageCloses = 0;
  let pageBrowserCloses = 0;
  const latePageHarness = createChromiumLifecycleTestHarness({
    loadChromium: async () => ({ chromium: { launch: async () => ({
      newPage: () => latePage.promise,
      close: async () => { pageBrowserCloses += 1; },
    }) } }),
  });
  await assert.rejects(latePageHarness.run({ record: sniffed, timeoutMs: 10, cleanupTimeoutMs: 5 }),
    { code: 'IMAGE_DECODE_TIMEOUT' });
  latePage.resolve({ close: async () => { latePageCloses += 1; } });
  await delay(15);
  assert.equal(latePageCloses, 1);
  assert.equal(pageBrowserCloses, 1);

  let evaluatePageCloses = 0;
  let evaluateBrowserCloses = 0;
  const neverEvaluate = createChromiumLifecycleTestHarness({
    loadChromium: async () => ({ chromium: { launch: async () => ({
      newPage: async () => ({ evaluate: async () => new Promise(() => {}), close: async () => { evaluatePageCloses += 1; } }),
      close: async () => { evaluateBrowserCloses += 1; },
    }) } }),
  });
  await assert.rejects(neverEvaluate.run({ record: sniffed, timeoutMs: 10, cleanupTimeoutMs: 5 }),
    { code: 'IMAGE_DECODE_TIMEOUT' });
  assert.equal(evaluatePageCloses, 1);
  assert.equal(evaluateBrowserCloses, 1);
});

test('Chromium bounded cleanup preserves crash or mismatch as the primary failure', async () => {
  const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor() });
  let browserCloseAttempts = 0;
  let contextCloseAttempts = 0;
  const crashHarness = createChromiumLifecycleTestHarness({
    loadChromium: async () => ({ chromium: { launch: async () => ({
      newPage: async () => ({
        evaluate: async () => { throw new Error('browser crashed'); },
        close: async () => new Promise(() => {}),
        context: () => ({ close: async () => { contextCloseAttempts += 1; throw new Error('context cleanup failed'); } }),
      }),
      close: async () => { browserCloseAttempts += 1; return new Promise(() => {}); },
    }) } }),
  });
  const startedAt = Date.now();
  await assert.rejects(crashHarness.run({ record: sniffed, timeoutMs: 100, cleanupTimeoutMs: 5 }),
    { code: 'IMAGE_DECODE_FAILED' });
  assert.equal(contextCloseAttempts, 1);
  assert.equal(browserCloseAttempts, 1);
  assert.equal(Date.now() - startedAt < 100, true);

  const mismatchHarness = createChromiumLifecycleTestHarness({
    loadChromium: async () => ({ chromium: { launch: async () => ({
      newPage: async () => ({ evaluate: async () => ({ ok: true, dimensions: { width: 2, height: 1 } }), close: async () => {} }),
      close: async () => {},
    }) } }),
  });
  await assert.rejects(mismatchHarness.run({ record: sniffed, timeoutMs: 100, cleanupTimeoutMs: 5 }),
    { code: 'IMAGE_DECODE_FAILED' });
  assert.equal(sniffed.validationStatus, 'SNIFFED');
  assert.equal(selectCanonicalCover([sniffed]), null);
});

test('trusted-local cover persistence rejects a forged workspace before filesystem access', async () => {
  const storage = createCoverStorageTestHarness();
  let accesses = 0;
  const workspace = new Proxy({}, {
    get() { accesses += 1; throw new Error('forged workspace reached path access'); },
  });
  await assert.rejects(storage.storeFixture({ bytes: pngBytes, declaredMime: 'image/png', workspace, animeId }),
    { code: 'CATALOG_WORKSPACE_UNTRUSTED' });
  assert.equal(accesses, 0);
});

test('cover storage handles concurrent dedupe and rejects corrupt, oversized, or symlink collisions', { skip: process.platform === 'win32' }, async (t) => {
  await withWorkspace(async (workspace) => {
    const storage = createCoverStorageTestHarness();
    const storeFixture = () => storage.storeFixture({ bytes: pngBytes, declaredMime: 'image/png', workspace, animeId });
    const writes = await Promise.all(Array.from({ length: 6 }, storeFixture));
    assert.equal(writes.filter(({ created }) => created).length, 1);
    assert.equal(new Set(writes.map(({ localRef }) => localRef)).size, 1);

    const destination = workspace.resolve(...writes[0].localRef.split('/'));
    await writeFile(destination, Uint8Array.of(0, 1, 2));
    await assert.rejects(storeFixture(),
      { code: 'COVER_STORE_COLLISION' });

    await writeFile(destination, new Uint8Array((8 * 1024 * 1024) + 1));
    await assert.rejects(storeFixture(),
      { code: 'COVER_STORE_COLLISION' });

    await rm(destination, { force: true });
    const target = workspace.resolve('images', 'covers', 'symlink-target.png');
    await writeFile(target, pngBytes);
    try {
      await symlink(target, destination, 'file');
    } catch (error) {
      if (error?.code === 'EPERM') {
        t.diagnostic('Windows denied a file symlink; exercising the no-follow guard with a directory junction');
        const coversDirectory = workspace.resolve('images', 'covers');
        const junctionTarget = workspace.resolve('junction-target');
        await rm(coversDirectory, { recursive: true, force: true });
        await mkdir(junctionTarget);
        await symlink(junctionTarget, coversDirectory, 'junction');
        await assert.rejects(storeFixture(),
          { code: 'CATALOG_WORKSPACE_SYMLINK_FORBIDDEN' });
        return;
      }
      throw error;
    }
    await assert.rejects(storeFixture(),
      { code: 'COVER_STORE_COLLISION' });
  });
});

test('cover body overflow cancels the stream and permanent MIME failure is never retried', async () => {
  let cancelled = false;
  const overflowing = createPinnedCoverTransport({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async ({ url, address }) => ({
      url, connectedAddress: address, redirected: false,
      headers: new Headers({ 'content-type': 'image/png' }),
      body: new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(5)); },
        cancel() { cancelled = true; },
      }),
    }),
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: overflowing, maxBytes: 4 }),
    { code: 'IMAGE_RESPONSE_TOO_LARGE' });
  assert.equal(cancelled, true);

  const calls = [];
  const permanentMime = createConcreteCoverTransportTestHarness({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    httpsRequest: scriptedHttps([({ respond }) => respond({ headers: { 'content-type': 'text/html' } })], calls),
    retryTimers: forbiddenRetryTimers('permanent MIME failure must not retry'),
  });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: permanentMime }),
    { code: 'IMAGE_MIME_UNSUPPORTED' });
  assert.equal(calls.length, 1);

});
