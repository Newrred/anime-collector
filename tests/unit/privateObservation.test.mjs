import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateObservationHandler } from '../../src/server/privateImages/observationHandler.js';

const secret = 'synthetic-test-secret-32-characters';
async function call(options, request = {}) {
  let body;
  const res = { setHeader() {}, end(value) { body = JSON.parse(value); } };
  await createPrivateObservationHandler(options)({ method: 'GET', headers: { authorization: `Bearer ${secret}` }, ...request }, res);
  return { status: res.statusCode, body };
}

test('capacity observation remains closed until enabled and authenticated', async () => {
  const noBackend = () => { throw Error('backend must stay closed'); };
  assert.equal((await call({ secret, createBackend: noBackend })).status, 503);
  assert.equal((await call({ enabled: true, secret, createBackend: noBackend }, { method: 'POST' })).status, 405);
  assert.equal((await call({ enabled: true, secret, createBackend: noBackend }, { headers: { authorization: 'Bearer wrong' } })).status, 401);
});

test('capacity observation exposes only aggregate results and fails closed', async () => {
  const names = [];
  const backend = { rpc: async name => { names.push(name); return {
    observedAt: '2026-10-08T00:00:00.000Z', storedBytes: 1200, reservedBytes: 1300,
    globalReadBytes: 1400, revision: 'internal-policy', ownerId: 'private-owner',
  }; } };
  const result = await call({ enabled: true, secret, createBackend: () => backend });
  assert.equal(result.status, 200);
  assert.deepEqual(names, ['observe_memory_private_image_capacity']);
  assert.deepEqual(result.body, { observedAt: '2026-10-08T00:00:00.000Z', storedBytes: 1200,
    reservedBytes: 1300, globalReadBytes: 1400 });
  assert.deepEqual((await call({ enabled: true, secret, createBackend: () => ({ rpc: async () => { throw Error('private details'); } }) })).body,
    { error: 'OBSERVATION_FAILED' });
});
