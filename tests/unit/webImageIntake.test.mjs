import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { inspectWebImage, createWebImageIntake } from '../../src/features/memory/adapters/platform/webImageIntake.js';
import { jpegBytes, pngBytes, webpBytes, webpVp8xBytes } from '../catalog-lab/fixtures/cover-valid-images.mjs';

test('Web intake recognizes real static JPEG/PNG/WebP and rejects spoofed MIME', () => {
  for (const [bytes, mime] of [[jpegBytes, 'image/jpeg'], [pngBytes, 'image/png'], [webpBytes, 'image/webp'], [webpVp8xBytes, 'image/webp']]) {
    assert.equal(inspectWebImage(bytes, mime).mimeType, mime);
    assert.throws(() => inspectWebImage(bytes, 'image/svg+xml'), { code: 'UNSUPPORTED_IMAGE_TYPE' });
  }
});

test('Web intake bounds bytes/pixels before decode and rejects animated/truncated inputs', () => {
  assert.throws(() => inspectWebImage(new Uint8Array(20_000_001)), { code: 'IMAGE_TOO_LARGE' });
  const huge = new Uint8Array(pngBytes);
  new DataView(huge.buffer).setUint32(16, 24_000_001);
  assert.throws(() => inspectWebImage(huge), { code: 'IMAGE_TOO_COMPLEX' });
  assert.throws(() => inspectWebImage(pngBytes.slice(0, 24)), { code: 'IMAGE_DECODE_FAILED' });
  const animated = new Uint8Array(webpVp8xBytes); animated[20] |= 2;
  assert.throws(() => inspectWebImage(animated), { code: 'UNSUPPORTED_IMAGE_TYPE' });
  const apng = new Uint8Array(pngBytes); apng.set(new TextEncoder().encode('acTL'), 37);
  assert.throws(() => inspectWebImage(apng), { code: 'UNSUPPORTED_IMAGE_TYPE' });
  assert.throws(() => inspectWebImage(new TextEncoder().encode('<svg/>')), { code: 'UNSUPPORTED_IMAGE_TYPE' });
});

test('Web intake preserves exact original bytes/hash; cancelled or failed decode writes nothing', async () => {
  const tickets = [];
  let selected = null, closes = 0;
  const intake = createWebImageIntake({
    store: { putTicket: async record => tickets.push(record) }, crypto: webcrypto,
    select: async () => selected,
    decode: async () => ({ width: 1, height: 1, close: () => closes++ }),
    canvas: () => ({ getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,AA==' }),
  });
  assert.equal((await intake.pick()).cancelled, true);
  assert.equal(tickets.length, 0);
  selected = new Blob([pngBytes], { type: 'image/png' });
  const picked = await intake.pick();
  assert.equal(picked.ticket.localOnly, true);
  assert.equal(closes, 1);
  assert.deepEqual(new Uint8Array(await tickets[0].blob.arrayBuffer()), pngBytes);
  assert.equal(tickets[0].hash, createHash('sha256').update(pngBytes).digest('hex'));
  const broken = createWebImageIntake({ select: async () => selected, store: { putTicket: () => assert.fail('must not write') }, decode: async () => { throw new Error('decode'); } });
  await assert.rejects(broken.pick(), { code: 'IMAGE_DECODE_FAILED' });
});

test('Web promotion refuses mismatched operations and arbitrary local paths', async () => {
  const intake = createWebImageIntake({ store: { promote: async () => ({ ticketId: 't1', operationId: 'op1' }), get: () => assert.fail('invalid path read') } });
  await assert.rejects(intake.promoteTicket({ ticketId: 't1', assetId: 'a1', operationId: 'op2' }), { code: 'INVALID_MEDIA_PROMOTION' });
  await assert.rejects(intake.promoteTicket({ ticketId: '../t', assetId: 'a1', operationId: 'op1' }), { code: 'INVALID_MEDIA_PROMOTION' });
  assert.equal(await intake.getOriginal('https://other/image'), null);
});
