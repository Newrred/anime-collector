import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateCleanupHandler } from '../../src/server/privateImages/cleanupHandler.js';
const secret = 'synthetic-test-secret-32-characters';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
async function call(options = {}, request = {}) {
  let body; const headers = {};
  const res = { setHeader: (k,v) => { headers[k]=v; }, end: value => { body=JSON.parse(value); } };
  await createPrivateCleanupHandler(options)({ method:'GET',headers:{authorization:`Bearer ${secret}`},...request },res);
  return { status:res.statusCode,body,headers };
}
test('cleanup defaults closed and rejects missing/wrong/short credentials before backend access',async()=>{
  const createBackend=()=>{throw Error('must not access backend');};
  assert.equal((await call({createBackend})).status,503);
  for(const options of [{},{secret:'short'},{secret}]) {
    assert.equal((await call({enabled:true,createBackend,...options},{headers:{authorization:'Bearer wrong'}})).status,401);
  }
  assert.equal((await call({enabled:true,secret,createBackend},{method:'POST'})).status,405);
});
test('authorized cleanup removes only claimed objects then finalizes and exposes only counts',async()=>{
  const events=[];
  const backend={rpc:async(name,args)=>{events.push([name,args]);return name==='claim_memory_private_image_cleanup'?[{id}]:null;},remove:async paths=>events.push(['remove',paths])};
  const r=await call({enabled:true,secret,createBackend:()=>backend});
  assert.equal(r.status,200);assert.deepEqual(r.body,{deleted:1,failed:0});assert.equal(r.headers['Cache-Control'],'no-store');
  assert.deepEqual(events.map(e=>e[0]),['claim_memory_private_image_cleanup','remove','complete_memory_private_image_cleanup']);
  assert.deepEqual(events[1][1],[`${id}/main.webp`,`${id}/thumb.webp`]);
});
test('failed deletion never finalizes quota and partial failures fail the scheduled run',async()=>{
  const calls=[];
  const backend={rpc:async name=>{calls.push(name);return [{id}];},remove:async()=>{throw Error('private object details');}};
  const r=await call({enabled:true,secret,createBackend:()=>backend});
  assert.equal(r.status,503);assert.deepEqual(r.body,{deleted:0,failed:1});assert.deepEqual(calls,['claim_memory_private_image_cleanup']);
  const broken=await call({enabled:true,secret,createBackend:()=>{throw Error('secret');}});
  assert.deepEqual(broken.body,{error:'CLEANUP_FAILED'});
});
