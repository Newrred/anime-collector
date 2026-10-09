import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateCleanupHandler } from '../../src/server/privateImages/cleanupHandler.js';
import { cleanupPublicImages } from '../../src/server/publicImages/handler.js';
import { runPrivateMaintenance } from '../../scripts/private-image-maintenance.mjs';

test('public cleanup shares authorization and does not finalize failed object deletion', async () => {
  let accessed = 0;
  const calls = [];
  const backend = { rpc: async name => { calls.push(name); return [{id:'job',prefix:'prefix'}]; },
    remove: async () => { throw new Error('private-path-never-logged'); } };
  const handler = createPrivateCleanupHandler({enabled:true,secret:'s'.repeat(32),cleanup:cleanupPublicImages,
    createBackend:() => { accessed++; return backend; }});
  let body;
  const res = { setHeader(){},end(value){body=JSON.parse(value);} };
  await handler({method:'GET',headers:{}},res);
  assert.equal(res.statusCode,401); assert.equal(accessed,0);
  await handler({method:'GET',headers:{authorization:`Bearer ${'s'.repeat(32)}`}},res);
  assert.equal(res.statusCode,503); assert.deepEqual(body,{deleted:0,failed:1});
  assert.deepEqual(calls,['claim_memory_image_cleanup']);
});

test('public cleanup failure still permits private capacity observation; default and manual remain off', async () => {
  for (const enabled of [false,true]) {
    for (const manual of [false,true]) {
      const paths = [];
      const result = await runPrivateMaintenance({CLEANUP_ORIGIN:'https://example.test',CLEANUP_SECRET:'s'.repeat(32),
        PUBLIC_CLEANUP_ENABLED:String(enabled),OBSERVE_ONLY:String(manual)},async url => {
        paths.push(url.pathname);
        if (url.pathname === '/api/public-image-cleanup') return {ok:false,status:503};
        return {ok:true,json:async()=>url.pathname.endsWith('cleanup')?{deleted:0,failed:0}:
          {observedAt:new Date().toISOString(),storedBytes:0,reservedBytes:0,globalReadBytes:0}};
      });
      assert.equal(paths.includes('/api/public-image-cleanup'),enabled&&!manual);
      assert.equal(paths.at(-1),'/api/private-image-observe');
      assert.equal(result.publicCleanupFailed,enabled&&!manual);
      assert.equal(result.alerts.includes('PUBLIC_CLEANUP_FAILED'),enabled&&!manual);
    }
  }
});
