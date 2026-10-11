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

import { publicSnapshot } from './publicCapacity.fixture.mjs';
test('public capacity is opt-in, aggregate-only, authenticated, and fails closed on incomplete data',async()=>{
 const calls=[];
 const backend={rpc:async name=>{calls.push(name);return name==='observe_memory_public_image_capacity'?publicSnapshot({privatePath:'never-log'}):{observedAt:new Date().toISOString(),storedBytes:0,reservedBytes:0,globalReadBytes:0};}};
 const opts={enabled:true,secret,publicCapacityEnabled:true,createBackend:()=>backend};
 const r=await call(opts);assert.equal(r.status,200);assert.deepEqual(calls,['observe_memory_private_image_capacity','observe_memory_public_image_capacity']);assert.equal(JSON.stringify(r.body).includes('never-log'),false);
 calls.length=0;assert.equal((await call(opts,{headers:{}})).status,401);assert.deepEqual(calls,[]);
 backend.rpc=async name=>name==='observe_memory_public_image_capacity'?{}:{observedAt:new Date().toISOString(),storedBytes:0,reservedBytes:0,globalReadBytes:0};
 assert.equal((await call(opts)).status,503);
});
