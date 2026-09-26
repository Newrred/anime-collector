import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createPublicImageHandler} from '../../src/server/publicImages/handler.js';
import {resolveViewerImage} from '../../src/server/publicImages/supabaseImageBackend.js';
import {imageHash} from '../../src/server/publicImages/processImage.js';
const U='88888888-8888-4888-8888-888888888888',S='33333333-3333-4333-8333-333333333333';
const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';

test('authenticated image HTTP binds verified identity and denies revocation after Storage',async()=>{
 const bytes=Buffer.from('synthetic-image-bytes');
 let reads=0,checks=0,revoked=false,revokeInGet=false,rejectAuth=false;
 const service={auth:{
  getClaims:async token=>({data:{claims:token==='synthetic-token'?{sub:U,session_id:S,role:'authenticated',exp:Math.floor(Date.now()/1000)+300}:null}}),
  getUser:async()=>({data:{user:rejectAuth?null:{id:U,is_anonymous:false}}}),
 },rpc:async(name,args)=>{
  assert.equal(name,'resolve_memory_viewer_image');assert.equal(args.p_viewer,U);assert.equal(args.p_session,S);
  assert.equal(args.p_asset_id,A);assert.equal(args.p_publication_id,P);assert.equal(args.p_variant,'full');
  assert.ok(Number.isSafeInteger(args.p_expires));checks++;
  return {data:revoked?null:{path:`${A}/full.webp`,hash:imageHash(bytes)}};
 }};
 const backend={viewerImage:(token,args)=>resolveViewerImage(service,token,args),
  rpc:async name=>{assert.ok(['authorize_memory_image_delivery','resolve_memory_public_image'].includes(name));return null;},
  get:async()=>{reads++;if(revokeInGet)revoked=true;return bytes;}};
 const handler=createPublicImageHandler({enabled:true,authenticatedViewersEnabled:true,createBackend:()=>backend});
 const server=createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
 const url=`http://127.0.0.1:${server.address().port}/api/public-image?publication=${P}&asset=${A}&variant=full`;
 try {
  let response=await fetch(url,{headers:{Authorization:'Bearer synthetic-token'}});
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
  assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('vary'),/Authorization/);
  assert.equal(checks,2);assert.equal(reads,1);
  revokeInGet=true;
  response=await fetch(url,{headers:{Authorization:'Bearer synthetic-token'}});
  assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'NOT_FOUND'});assert.equal(checks,4);
  rejectAuth=true;
  response=await fetch(url,{headers:{Authorization:'Bearer synthetic-token'}});
  assert.equal(response.status,401);assert.equal(reads,2);
  response=await fetch(url,{headers:{Authorization:'bad'}});assert.equal(response.status,401);
  response=await fetch(`${url}&viewer=${U}`,{headers:{Authorization:'Bearer synthetic-token'}});assert.equal(response.status,400);
  response=await fetch(url);assert.equal(response.status,404);assert.equal(reads,2);
 } finally {await new Promise(resolve=>server.close(resolve));}
});

test('public viewer auth cannot be supplied through resolver arguments',async()=>{
 const service={auth:{getClaims:async()=>({data:{claims:null}}),getUser:async()=>({data:{user:{id:U}}})},
 rpc:()=>{throw new Error('RPC must not run');}};
 await assert.rejects(resolveViewerImage(service,'forged',{p_viewer:U,p_session:S}),{code:'AUTH_REQUIRED',status:401});
});
