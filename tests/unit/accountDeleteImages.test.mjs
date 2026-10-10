import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPrivateImageHandler, cleanupPrivateImages } from '../../src/server/privateImages/handler.js';
import { PrivateImageError } from '../../src/server/privateImages/processImage.js';
import { createPublicImageHandler, cleanupPublicImages } from '../../src/server/publicImages/handler.js';
import { PublicImageError } from '../../src/server/publicImages/processImage.js';

const owner = '11111111-1111-4111-8111-111111111111';
const asset = '22222222-2222-4222-8222-222222222222';
const operation = '33333333-3333-4333-8333-333333333333';
const representation = '44444444-4444-4444-8444-444444444444';
const publication = '55555555-5555-4555-8555-555555555555';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const input = Buffer.from('synthetic-source-no-private-image');
const main = Buffer.from('synthetic-optimized-main');
const thumb = Buffer.from('synthetic-optimized-thumbnail');
const privateOutput = { inputHash: hash(input), mainHash: hash(main), thumbHash: hash(thumb), main, thumb, width: 10, height: 10 };
const publicOutput = { fullHash: hash(main), thumbHash: hash(thumb), full: main, thumb, width: 10, height: 10 };

async function request(handler, method, url, headers = {}) {
  const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = value; } };
  await handler({ method, url, body: method === 'POST' ? input : undefined, headers: {
    authorization: 'Bearer already-issued-synthetic-token', 'content-type': 'application/octet-stream',
    'x-moemoa-asset': asset, 'x-moemoa-version': '1', 'x-moemoa-operation': operation,
    'x-moemoa-consent': 'SYNTHETIC_POLICY', ...headers,
  } }, response);
  return response;
}

// These tests exercise the real HTTP handlers with explicit lifecycle fixtures.
// Database triggers/FKs are tested separately in tools/private-images/account-delete-contract.sql.
// No hosted Auth, Storage service, real image, or user account is contacted/deleted.
function privateFixture({ deleteDuringPut = false, deleteDuringGet = false } = {}) {
  const objects = new Map();
  const state = { ownerExists: true, media: null, cleanupDue: false, removals: 0 };
  const retireAccount = () => {
    state.ownerExists = false;
    if (state.media) state.media.state = 'DELETING';
  };
  const requireSource = () => {
    if (!state.ownerExists) throw new PrivateImageError('NOT_FOUND', 404);
  };
  const user = { id: owner, async rpc(name, args) {
    requireSource();
    if (name === 'get_memory_private_image_policy') return { revision: 'SYNTHETIC_POLICY' };
    if (name === 'authorize_memory_private_image_attempt') return;
    if (name === 'read_memory_private_image') {
      if (state.media?.state !== 'READY') throw new PrivateImageError('NOT_FOUND', 404);
      const bytes = args.p_variant === 'main' ? main : thumb;
      return { id: representation, hash: hash(bytes), bytes: bytes.length };
    }
    throw new Error('unexpected user RPC');
  } };
  const backend = {
    async user() {
      if (!state.ownerExists) throw new PrivateImageError('AUTH_REQUIRED', 401);
      return user;
    },
    async rpc(name) {
      if (name === 'reserve_memory_private_image') {
        requireSource();
        state.media = { id: representation, state: 'PREPARING', source_version: 1 };
        return { ...state.media };
      }
      if (name === 'complete_memory_private_image') {
        requireSource();
        if (state.media.state !== 'PREPARING') throw new PrivateImageError('PRIVATE_IMAGE_RETIRED', 409);
        state.media.state = 'READY';
        return;
      }
      if (name === 'claim_memory_private_image_cleanup') return state.cleanupDue && state.media?.state === 'DELETING' ? [{ id: representation }] : [];
      if (name === 'complete_memory_private_image_cleanup') { state.media.state = 'DELETED'; return; }
      throw new Error('unexpected service RPC');
    },
    async put(path, bytes) {
      objects.set(path, bytes);
      if (deleteDuringPut && path.endsWith('main.webp')) retireAccount();
    },
    async get(path) {
      const bytes = objects.get(path);
      if (deleteDuringGet) retireAccount();
      return bytes;
    },
    async remove(paths) { state.removals++; for (const path of paths) objects.delete(path); },
  };
  const handler = createPrivateImageHandler({ enabled: true, createBackend: () => backend, transform: async () => privateOutput });
  return { handler, backend, objects, state, retireAccount };
}

test('private upload overlapping simulated account deletion cannot confirm READY; manifest survives until due cleanup', async () => {
  const h = privateFixture({ deleteDuringPut: true });
  const res = await request(h.handler, 'POST', '/api/private-image');
  assert.equal(res.statusCode, 404);
  assert.deepEqual(JSON.parse(res.body), { error: 'NOT_FOUND' });
  assert.equal(h.state.media.state, 'DELETING');
  assert.equal(h.objects.size, 2, 'already-started writes may finish, but cannot be read or finalized');
  assert.deepEqual(await cleanupPrivateImages(h.backend), { deleted: 0, failed: 0 });
  assert.equal(h.objects.size, 2, 'cleanup preserves the fixture writer deadline');
  const stale = await request(h.handler, 'POST', '/api/private-image');
  assert.equal(stale.statusCode, 401);
  h.state.cleanupDue = true;
  assert.deepEqual(await cleanupPrivateImages(h.backend), { deleted: 1, failed: 0 });
  assert.equal(h.state.media.state, 'DELETED');
  assert.equal(h.objects.size, 0);
});

test('private image read overlapping simulated account deletion rechecks before returning bytes', async () => {
  const h = privateFixture({ deleteDuringGet: true });
  assert.equal((await request(h.handler, 'POST', '/api/private-image')).statusCode, 200);
  const res = await request(h.handler, 'GET', `/api/private-image?asset=${asset}&version=1&variant=main`);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(JSON.parse(res.body), { error: 'NOT_FOUND' });
  assert.equal(res.headers['Content-Type'], 'application/json');
  assert(!Buffer.isBuffer(res.body));
  assert.equal((await request(h.handler, 'GET', `/api/private-image?asset=${asset}&version=1`)).statusCode, 401);
});

function publicFixture({ deleteDuringPut = false, deleteDuringGet = false } = {}) {
  const objects = new Map();
  const state = { ownerExists: true, publicationExists: false, mediaState: 'PREPARING' };
  const retireAccount = () => { state.ownerExists = false; state.publicationExists = false; };
  const resolve = () => state.ownerExists && state.publicationExists && state.mediaState === 'READY'
    ? { path: `${representation}/full.webp`, hash: hash(main) } : null;
  const user = { async rpc(name) {
    if (name === 'reserve_memory_public_asset') {
      if (!state.ownerExists) throw new PublicImageError('AUTH_REQUIRED', 401);
      return { id: representation, prefix: representation, state: 'PREPARING', sourceHash: hash(input) };
    }
    if (name === 'authorize_memory_image_attempt') return;
    // The SQL operation ledger is retained after account deletion; it contains no image bytes.
    if (name === 'get_memory_public_asset_operation') return { id: representation, state: state.mediaState, reservationReleased: state.mediaState === 'DELETED' };
    if (name === 'resolve_memory_image_preview') return resolve();
    throw new Error('unexpected user RPC');
  } };
  const backend = {
    async user() { if (!state.ownerExists) throw new PublicImageError('AUTH_REQUIRED', 401); return user; },
    async rpc(name) {
      if (name === 'complete_memory_public_asset') {
        if (!state.ownerExists) throw new PublicImageError('IMAGE_RIGHTS_REQUIRED', 409);
        state.mediaState = 'READY'; return;
      }
      if (name === 'fail_memory_public_asset') { if (state.mediaState === 'PREPARING') state.mediaState = 'FAILED'; return; }
      if (name === 'claim_memory_failed_image_cleanup') {
        if (state.mediaState !== 'FAILED') return null;
        state.mediaState = 'DELETING'; return { id: representation, prefix: representation };
      }
      if (name === 'complete_memory_image_cleanup') { state.mediaState = 'DELETED'; return; }
      if (name === 'claim_memory_image_cleanup') return ['FAILED', 'DELETING'].includes(state.mediaState) ? [{ id: representation, prefix: representation }] : [];
      if (name === 'resolve_memory_public_image') return resolve();
      if (name === 'authorize_memory_image_delivery') return;
      throw new Error('unexpected service RPC');
    },
    async put(path, bytes) { objects.set(path, bytes); if (deleteDuringPut && path.endsWith('full.webp')) retireAccount(); },
    async get(path) { const bytes = objects.get(path); if (deleteDuringGet) retireAccount(); return bytes; },
    async remove(paths) { for (const path of paths) objects.delete(path); },
  };
  const handler = createPublicImageHandler({ enabled: true, createBackend: () => backend, transform: async () => publicOutput });
  return { handler, backend, objects, state };
}

test('public upload overlapping simulated owner deletion cannot confirm or publish and cleans confirmed failed bytes', async () => {
  const h = publicFixture({ deleteDuringPut: true });
  const res = await request(h.handler, 'POST', '/api/public-image');
  assert.equal(res.statusCode, 409);
  assert.equal(JSON.parse(res.body).error, 'IMAGE_RIGHTS_REQUIRED');
  assert.equal(h.state.mediaState, 'DELETED');
  assert.equal(h.objects.size, 0);
  assert.equal((await request(h.handler, 'POST', '/api/public-image')).statusCode, 401);
  assert.deepEqual(await cleanupPublicImages(h.backend), { deleted: 0, failed: 0 });
});

test('public image delivery re-resolves a publication removed by simulated owner deletion', async () => {
  const h = publicFixture({ deleteDuringGet: true });
  assert.equal((await request(h.handler, 'POST', '/api/public-image')).statusCode, 200);
  h.state.publicationExists = true;
  const url = `/api/public-image?asset=${representation}&publication=${publication}&variant=full`;
  const res = await request(h.handler, 'GET', url, { authorization: undefined });
  assert.equal(res.statusCode, 404);
  assert.deepEqual(JSON.parse(res.body), { error: 'NOT_FOUND' });
  assert(!Buffer.isBuffer(res.body));
  assert.equal((await request(h.handler, 'GET', url, { authorization: undefined })).statusCode, 404);
});
