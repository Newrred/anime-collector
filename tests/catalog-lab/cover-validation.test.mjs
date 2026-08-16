import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  COVER_MIME,
  decodeCoverWithChromium,
  downloadCoverCandidate,
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
    sourceUrl: 'https://covers.example.test/cover.png',
    sourceRecordId: 'a'.repeat(64),
    retrievedAt: '2026-08-17T00:00:00.000Z',
    ...overrides,
  };
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
  const requests = [];
  const http = {
    async request(request) {
      requests.push(request);
      return new Response(pngBytes, { headers: { 'content-type': 'image/png', 'content-length': String(pngBytes.byteLength) } });
    },
  };
  const result = await downloadCoverCandidate({ candidate: candidate(), http, maxBytes: 4096 });
  assert.equal(result.inspection.mimeType, COVER_MIME.PNG);
  assert.deepEqual(requests, [{
    url: 'https://covers.example.test/cover.png', kind: 'IMAGE', init: { redirect: 'error' },
  }]);

  await assert.rejects(downloadCoverCandidate({ candidate: candidate({ sourceUrl: 'file:///tmp/cover.png' }), http }),
    { code: 'IMAGE_URL_INVALID' });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate({ identity: { status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS' } }), http }),
    { code: 'COVER_IDENTITY_NOT_EXACT' });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), http: {
    request: async () => new Response(pngBytes, { headers: { 'content-type': 'image/png', 'content-length': '9999' } }),
  }, maxBytes: 64 }), { code: 'IMAGE_RESPONSE_TOO_LARGE' });
  await assert.rejects(downloadCoverCandidate({ candidate: candidate(), http: {
    request: async () => new Response(pngBytes, { headers: { 'content-type': 'text/html' } }),
  } }), { code: 'IMAGE_MIME_UNSUPPORTED' });
});

test('validated cover storage is immutable, checksum-deduplicated, and contains no image failure side effect', async () => {
  await withWorkspace(async (workspace) => {
    const first = await storeValidatedCover({ bytes: pngBytes, workspace, animeId, candidate: candidate() });
    const second = await storeValidatedCover({ bytes: pngBytes, workspace, animeId, candidate: candidate() });
    assert.equal(second.localRef, first.localRef);
    assert.equal(second.created, false);
    assert.equal(first.rightsStatus, 'TEST_ONLY_UNKNOWN');
    assert.equal(first.distributionStatus, 'PROHIBITED');
    assert.equal(first.validationStatus, 'STRUCTURE_VALID');
    assert.match(first.localRef, /^images\/covers\/anime-11111111-1111-4111-8111-111111111111\/[a-f0-9]{64}\.png$/u);
    assert.deepEqual(new Uint8Array(await readFile(workspace.resolve(...first.localRef.split('/')))), pngBytes);
    await assert.rejects(storeValidatedCover({ bytes: pngBytes, workspace, animeId: '../outside', candidate: candidate() }),
      { code: 'COVER_ANIME_ID_INVALID' });

    const textRecord = Object.freeze({ title: 'Synthetic title', description: 'must remain intact' });
    await assert.rejects(downloadCoverCandidate({ candidate: candidate(), http: {
      request: async () => new Response(truncatedPngBytes, { headers: { 'content-type': 'image/png' } }),
    }, textRecord }), { code: 'IMAGE_TRUNCATED' });
    assert.deepEqual(textRecord, { title: 'Synthetic title', description: 'must remain intact' });
  });
});

test('Chromium decodes a structurally valid synthetic cover without adding an image dependency', async () => {
  const inspected = inspectImageBytes({ declaredMime: COVER_MIME.PNG, bytes: pngBytes });
  const decoded = await decodeCoverWithChromium({ bytes: pngBytes, inspection: inspected });
  assert.equal(decoded.validationStatus, 'DECODED');
});

test('canonical cover selection is deterministic: exact identity, decoded state, area, source ID', () => {
  const selected = selectCanonicalCover([
    { ...candidate({ sourceId: 'zeta', identity: { status: 'MATCHED', confidenceClass: 'EXACT_RULE' } }), validationStatus: 'DECODED', width: 900, height: 900 },
    { ...candidate({ sourceId: 'beta' }), validationStatus: 'STRUCTURE_VALID', width: 9999, height: 9999 },
    { ...candidate({ sourceId: 'alpha' }), validationStatus: 'DECODED', width: 800, height: 800 },
    { ...candidate({ sourceId: 'beta' }), validationStatus: 'DECODED', width: 800, height: 800 },
  ]);
  assert.equal(selected.sourceId, 'alpha');
  assert.equal(selected.validationStatus, 'DECODED');
  assert.equal(selected.rightsStatus, 'TEST_ONLY_UNKNOWN');
  assert.equal(selected.distributionStatus, 'PROHIBITED');
});
