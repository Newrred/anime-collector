import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  COVER_MIME,
  createPinnedCoverTransport,
  decodeCoverWithChromium,
  downloadCoverCandidate,
  getApprovedCoverSourcePolicy,
  inspectImageBytes,
  selectCanonicalCover,
  storeValidatedCover,
} from '../../tools/catalog-lab/pipeline/covers.mjs';
import {
  jpegBytes, pngBytes, truncatedPngBytes, webpBytes, webpVp8xBytes,
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
function transportFor(bytes = pngBytes, mime = 'image/png') {
  return createPinnedCoverTransport({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async ({ url, address }) => ({ url, connectedAddress: address, redirected: false, headers: new Headers({ 'content-type': mime }), body: new Response(bytes).body }),
  });
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

  await assert.rejects(downloadCoverCandidate({ candidate: candidate({ sourceUrl: 'file:///tmp/cover.png' }), policy, transport: transportFor() }),
    { code: 'IMAGE_URL_INVALID' });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate({ identity: { status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS' } }), policy, transport: transportFor() }),
    { code: 'COVER_IDENTITY_NOT_EXACT' });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor(pngBytes, 'text/html') }), { code: 'IMAGE_MIME_UNSUPPORTED' });
});

test('validated cover storage is immutable, checksum-deduplicated, and contains no image failure side effect', async () => {
  await withWorkspace(async (workspace) => {
    const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor() });
    await assert.rejects(storeValidatedCover({ record: sniffed, workspace, animeId }), { code: 'COVER_RECORD_UNTRUSTED' });
    const decoded = await decodeCoverWithChromium({ record: sniffed });
    const first = await storeValidatedCover({ record: decoded, workspace, animeId });
    const second = await storeValidatedCover({ record: decoded, workspace, animeId });
    assert.equal(second.localRef, first.localRef);
    assert.equal(second.created, false);
    assert.equal(first.rightsStatus, 'TEST_ONLY_UNKNOWN');
    assert.equal(first.distributionStatus, 'PROHIBITED');
    assert.equal(first.validationStatus, 'DECODED');
    assert.match(first.localRef, /^images\/covers\/anime-11111111-1111-4111-8111-111111111111\/[a-f0-9]{64}\.png$/u);
    assert.deepEqual(new Uint8Array(await readFile(workspace.resolve(...first.localRef.split('/')))), pngBytes);
    await assert.rejects(storeValidatedCover({ record: decoded, workspace, animeId: '../outside' }),
      { code: 'COVER_ANIME_ID_INVALID' });

    const textRecord = Object.freeze({ title: 'Synthetic title', description: 'must remain intact' });
    await assert.rejects(downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor(truncatedPngBytes), textRecord }), { code: 'IMAGE_TRUNCATED' });
    assert.deepEqual(textRecord, { title: 'Synthetic title', description: 'must remain intact' });
  });
});

test('Chromium decodes a structurally valid synthetic cover without adding an image dependency', async () => {
  const sniffed = await downloadCoverCandidate({ candidate: candidate(), policy, transport: transportFor() });
  const decoded = await decodeCoverWithChromium({ record: sniffed });
  assert.equal(decoded.validationStatus, 'DECODED');
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

test('cover pipeline requires an approved HTTPS origin, pinned public resolution, decode, and one authenticated record', async () => {
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
  const decoded = await decodeCoverWithChromium({ record: downloaded });
  await withWorkspace(async (workspace) => {
    const stored = await storeValidatedCover({ record: decoded, workspace, animeId });
    assert.equal(stored.validationStatus, 'DECODED');
    assert.match(stored.checksum, /^[a-f0-9]{64}$/u);
    assert.equal(selectCanonicalCover([stored]), stored);
  });
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
