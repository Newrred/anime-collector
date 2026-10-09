import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePrivateCapacity, runPrivateMaintenance } from '../../scripts/private-image-maintenance.mjs';

const snapshot = (changes = {}) => ({ observedAt: new Date().toISOString(), storedBytes: 100, reservedBytes: 100, globalReadBytes: 200, ...changes });
test('manual observation never calls deletion endpoint', async () => {
  const calls=[];
  const result=await runPrivateMaintenance({CLEANUP_ORIGIN:'https://example.test',CLEANUP_SECRET:'x'.repeat(32),OBSERVE_ONLY:'true'}, async url => {
    calls.push(url.pathname);
    return {ok:true,json:async()=>snapshot()};
  });
  assert.deepEqual(calls,['/api/private-image-observe']);
  assert.equal(result.cleanupSkipped,true);
  assert.equal(result.cleanupFailed,false);
  assert.equal(result.deleted,null);
});
test('capacity alerts cover reserved storage and monthly reads at threshold', () => {
  assert.deepEqual(evaluatePrivateCapacity(snapshot()).alerts, []);
  assert.deepEqual(evaluatePrivateCapacity(snapshot({ reservedBytes: 80_000_000, globalReadBytes: 400_000_000 })).alerts,
    ['PRIVATE_STORAGE_NEAR_LIMIT', 'PRIVATE_MONTHLY_READ_NEAR_LIMIT']);
});
test('invalid or stale capacity must not report healthy operation', () => {
  for (const patch of [{storedBytes:-1},{reservedBytes:NaN},{globalReadBytes:'3'},{observedAt:'bad'},
    {observedAt:new Date(Date.now()-11*60_000).toISOString()}]) {
    assert.throws(() => evaluatePrivateCapacity(snapshot(patch)), /INVALID_CAPACITY/);
  }
});
test('observation continues after cleanup failure and preserves failure result', async () => {
  const calls=[];
  const result=await runPrivateMaintenance({CLEANUP_ORIGIN:'https://example.test',CLEANUP_SECRET:'x'.repeat(32)}, async url => {
    calls.push(url.pathname);
    if (url.pathname.endsWith('cleanup')) return {ok:false,status:503};
    return {ok:true,json:async()=>snapshot()};
  });
  assert.deepEqual(calls,['/api/private-image-cleanup','/api/private-image-observe']);
  assert.equal(result.cleanupFailed,true);
  assert.equal(result.deleted,null);
});
test('maintenance uses bounded authenticated calls and returns only aggregates', async () => {
  const result=await runPrivateMaintenance({CLEANUP_ORIGIN:'https://example.test',CLEANUP_SECRET:'x'.repeat(32)}, async (url, options) => {
    assert.equal(options.redirect,'error'); assert.ok(options.signal);
    assert.equal(options.headers.Authorization,`Bearer ${'x'.repeat(32)}`);
    return {ok:true,json:async()=>url.pathname.endsWith('cleanup')?{deleted:1,failed:0,privatePath:'never-log'}:{...snapshot(),privatePath:'never-log'}};
  });
  assert.equal(result.deleted,1);
  assert.equal(JSON.stringify(result).includes('never-log'),false);
});
