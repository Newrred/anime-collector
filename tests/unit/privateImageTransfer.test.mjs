import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateImageTransfer } from '../../src/features/memory/application/createPrivateImageTransfer.js';
import { blobHash, optimizePrivateImage } from '../../src/features/memory/application/optimizePrivateImage.js';
import { pngBytes } from '../catalog-lab/fixtures/cover-valid-images.mjs';

async function fixture() {
  const original = new Blob([pngBytes], { type: 'image/png' });
  const copy = new Blob(['optimized'], { type: 'image/webp' });
  const state = { user: 'A', version: 1, records: new Map(), posts: [], ready: false, broken: false, optimized: 0, deleteBody: { state: 'DELETING' } };
  const ready = { state: 'READY', sourceVersion: 1, mainHash: await blobHash(copy), mainBytes: copy.size };
  const policy = { revision: 'test-only', mainMaxBytes: 1_000_000, transportBodyMaxBytes: 1_500_000, quotaBytes: 50_000_000, usedBytes: 0 };
  const options = { ownerId: 'account:A', assetId: 'asset', sourceVersion: 1,
    getSession: async () => ({ access_token: state.user, user: { id: state.user } }), getOwner: async () => ({ id: `account:${state.user}` }),
    getAsset: async () => ({ id: 'asset', ownerId: 'account:A', localRef: 'original', checksumSha256: await blobHash(original), sync: { remoteVersion: state.version, syncState: 'SYNCED' } }),
    readOriginal: async () => original,
    journal: { get: async key => state.records.get(key), putIfAbsent: async value => { if (!state.records.has(value.key)) state.records.set(value.key, value); return state.records.get(value.key); }, remove: async (key, op) => { if (state.records.get(key)?.operationId === op) state.records.delete(key); } },
    optimize: async () => { state.optimized++; return copy; }, uuid: () => 'stable-operation',
    fetchImpl: async (url, init) => {
      if (init.method === 'POST') { state.posts.push(init); if (state.broken) throw new Error('lost response'); state.ready = true; return Response.json(ready); }
      if (init.method === 'DELETE') { if (state.broken) throw new Error('lost response'); return Response.json(state.deleteBody); }
      if (url.includes('policy=1')) return Response.json({ ...policy, representation: state.ready ? ready : null });
      return new Response(copy, { headers: { 'Content-Type': 'image/webp' } });
    },
  };
  return { state, original, copy, options, ready, controller: () => createPrivateImageTransfer(options) };
}

test('private transfer requires explicit consent and matching original before upload', async () => {
  const f = await fixture();
  await assert.rejects(f.controller().upload({ consented: false }), { code: 'IMAGE_CONSENT_REQUIRED' });
  f.options.readOriginal = async () => new Blob(['other']);
  await assert.rejects(f.controller().upload({ consented: true }), { code: 'SOURCE_IMAGE_MISMATCH' });
  assert.equal(f.state.optimized, 0); assert.equal(f.state.posts.length, 0);
});

test('lost upload response retains exact bytes and operation across controller recreation', async () => {
  const f = await fixture(); f.state.broken = true;
  await assert.rejects(f.controller().upload({ consented: true }), { code: 'PRIVATE_IMAGE_REQUEST_FAILED' });
  assert.equal(f.state.records.size, 1); f.state.broken = false;
  await f.controller().upload({ consented: true });
  assert.equal(f.state.optimized, 1); assert.equal(f.state.posts.length, 2);
  assert.equal(f.state.posts[0].body, f.state.posts[1].body);
  assert.equal(f.state.posts[0].headers['X-Moemoa-Operation'], f.state.posts[1].headers['X-Moemoa-Operation']);
  assert.equal(f.state.records.size, 0);
  assert.equal(await blobHash(f.original), await blobHash(new Blob([pngBytes])));
});

test('account change while optimizing or receiving response cannot commit A result', async () => {
  const f = await fixture(); f.options.optimize = async () => { f.state.user = 'B'; return f.copy; };
  await assert.rejects(f.controller().upload({ consented: true }), { code: 'AUTH_REQUIRED' });
  assert.equal(f.state.posts.length, 0); assert.equal(f.state.records.size, 0);
  const g = await fixture(), fetch = g.options.fetchImpl;
  g.options.fetchImpl = async (url, init) => { const r = await fetch(url, init); if (init.method === 'POST') g.state.user = 'B'; return r; };
  await assert.rejects(g.controller().upload({ consented: true }), { code: 'AUTH_REQUIRED' });
  assert.equal(g.state.records.size, 1);
});

test('source replacement while optimizing stops old upload', async () => {
  const f = await fixture(); f.options.optimize = async () => { f.state.version++; return f.copy; };
  await assert.rejects(f.controller().upload({ consented: true }), { code: 'PRIVATE_IMAGE_SOURCE_CHANGED' });
  assert.equal(f.state.posts.length, 0);
});

test('cancel preserves uncertain operation until server acknowledges retired state', async () => {
  const f = await fixture(); f.state.broken = true;
  await assert.rejects(f.controller().upload({ consented: true }));
  await assert.rejects(f.controller().cancel()); assert.equal(f.state.records.size, 1);
  f.state.broken = false; f.state.deleteBody = {};
  await assert.rejects(f.controller().cancel()); assert.equal(f.state.records.size, 1);
  f.state.deleteBody = { state: 'DELETING' };
  await f.controller().cancel(); assert.equal(f.state.records.size, 0);
});

test('private read validates actual bytes against ready manifest and rejects corruption', async () => {
  const f = await fixture(); f.state.ready = true;
  assert.equal(await blobHash(await f.controller().read()), f.ready.mainHash);
  const fetch = f.options.fetchImpl;
  f.options.fetchImpl = (url, init) => url.includes('policy=1') ? fetch(url, init) : new Response('corrupted', { headers: { 'Content-Type': 'image/webp' } });
  await assert.rejects(f.controller().read(), { code: 'PRIVATE_IMAGE_REQUEST_FAILED' });
});

test('optimizer bounds attempts and size, closes decoded image, and preserves original', async () => {
  const f = await fixture(), attempts = []; let closed = 0;
  const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob: (done, mime, quality) => { attempts.push(quality); done(new Blob(['too large'], { type: mime })); } };
  await assert.rejects(optimizePrivateImage(f.original, { mainMaxBytes: 1, transportBodyMaxBytes: 1 }, { decode: async () => ({ width: 2400, height: 1200, close: () => closed++ }), canvas: () => canvas }), { code: 'IMAGE_SIZE_LIMIT' });
  assert.deepEqual(attempts, [.85, .75, .65]); assert.equal(closed, 1);
  assert.equal(canvas.width, 1600); assert.equal(canvas.height, 800);
  assert.deepEqual(new Uint8Array(await f.original.arrayBuffer()), pngBytes);
});

test('thumbnail read uses thumbnail hash and bound, and refuses corrupt thumbnail without main fallback', async () => {
  const f = await fixture(); f.state.ready = true;
  const thumb = new Blob(['thumb'], { type: 'image/webp' });
  f.ready.thumbnailHash = await blobHash(thumb); f.ready.thumbnailBytes = thumb.size;
  const fetch = f.options.fetchImpl; const reads = [];
  f.options.fetchImpl = (url, init) => {
    if (url.includes('policy=1')) return fetch(url, init);
    reads.push(url); return Promise.resolve(new Response(thumb, { headers: { 'Content-Type': 'image/webp' } }));
  };
  assert.equal(await blobHash(await f.controller().read(undefined, 'thumb')), f.ready.thumbnailHash);
  assert.match(reads[0], /variant=thumb/);
  f.ready.thumbnailHash = 'a'.repeat(64);
  await assert.rejects(f.controller().read(undefined, 'thumb'), { code: 'PRIVATE_IMAGE_REQUEST_FAILED' });
  assert.equal(reads.length, 2);
  f.ready.thumbnailBytes = 120001;
  await assert.rejects(f.controller().read(undefined, 'thumb'), { code: 'PRIVATE_IMAGE_REQUEST_FAILED' });
  assert.equal(reads.length, 2);
});
