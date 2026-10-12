import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import sharp from 'sharp';
import { downloadSizedImage } from '../../src/server/publicImages/boundedDownload.js';
import { createPublicImageHandler } from '../../src/server/publicImages/handler.js';
import { imageHash, OUTPUT_LIMIT, PublicImageError } from '../../src/server/publicImages/processImage.js';

const ID='11111111-1111-4111-8111-111111111111', PUB='22222222-2222-4222-8222-222222222222';
const path=ID+'/full.webp';
const image=await sharp({create:{width:24,height:30,channels:3,background:'#dc0068'}}).webp().toBuffer();
const baseArgs={url:'https://storage.invalid',key:'synthetic-key',path,bytes:image.length};
const headers={'content-length':String(image.length)};
async function listen(handler, fn) {
 const server=createServer(handler);
 for(let attempt=0;;attempt++) {
  try {await new Promise((ok,fail)=>{server.once('error',fail);server.listen(25000+Math.floor(Math.random()*25000),'127.0.0.1',()=>{server.removeListener('error',fail);ok();});});break;}
  catch(e){if(!['EADDRINUSE','EACCES'].includes(e.code)||attempt>=15)throw e;}
 }
 try {return await fn('http://127.0.0.1:'+server.address().port);} finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
}

test('bounded Storage GET accepts exact 200/206 and requests only the reserved range',async()=>{
 for(const status of [200,206]) {
  const bytes=await downloadSizedImage({...baseArgs,fetchImpl:async(url,init)=>{
   assert.equal(url,'https://storage.invalid/storage/v1/object/memory-public-derivatives/'+path);
   assert.equal(init.headers.Range,'bytes=0-'+(image.length-1));
   assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
   return new Response(image,{status,headers:{...headers,...(status===206?{'content-range':'bytes 0-'+(image.length-1)+'/'+image.length}:{})}});
  }});assert.deepEqual(bytes,image);
 }
});

test('bounded Storage rejects bad length, larger range total, encoding, redirects and provider errors',async()=>{
 for(const [status,h] of [[200,{}],[200,{'content-length':'0'}],[200,{'content-length':String(image.length+1)}],
  [206,{...headers,'content-range':'bytes 0-'+(image.length-1)+'/'+(image.length+10)}],
  [206,headers],[200,{...headers,'content-encoding':'gzip'}],[302,headers],[500,headers]]) {
  let cancelled=false;
  const body=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(downloadSizedImage({...baseArgs,fetchImpl:async()=>new Response(body,{status,headers:h})}),{code:'IMAGE_STORAGE_FAILED'});
  assert.equal(cancelled,true);
 }
});

test('bounded stream aborts oversized/chunked and truncated bodies despite a valid header',async()=>{
 for(const oversized of [true,false]) {
  let cancelled=false; let index=0;
  const stream=new ReadableStream({pull(controller){
   if(index++===0)controller.enqueue(image.subarray(0,image.length-1));
   else if(oversized)controller.enqueue(new Uint8Array(8));else controller.close();
  },cancel(){cancelled=true;}});
  await assert.rejects(downloadSizedImage({...baseArgs,fetchImpl:async()=>new Response(stream,{headers})}),{code:'IMAGE_STORAGE_FAILED'});
  if(oversized)assert.equal(cancelled,true);
 }
});

test('invalid persisted byte sizes and unsafe paths do not fetch',async()=>{
 let calls=0;
 for(const override of [{bytes:0},{bytes:null},{bytes:'20'},{bytes:OUTPUT_LIMIT+1},{path:'../private.webp'}])
  await assert.rejects(downloadSizedImage({...baseArgs,...override,fetchImpl:async()=>{calls++;}}),{code:'IMAGE_STORAGE_FAILED'});
 assert.equal(calls,0);
});

function fixture({sized=true,revoke=false,limited=false,corrupt=false,invalidSize=false,mode='public'}={}) {
 const state={resolves:0,charges:[],reads:0};
 const resolve=()=>{state.resolves++;return revoke&&state.resolves>1?null:{path,hash:imageHash(image)};};
 const rpc=async(name,args)=>{
  if(name.startsWith('resolve_'))return resolve();
  state.charges.push({name,args});if(limited)throw new PublicImageError('RATE_LIMITED',429);
  if(name==='authorize_memory_sized_image_delivery'){assert.equal(args.p_path,path);assert.equal(args.p_hash,imageHash(image));return invalidSize?null:image.length;}
  assert.equal(args.p_bytes,OUTPUT_LIMIT);return null;
 };
 const backend={rpc,user:async()=>({rpc}),viewerImage:async()=>resolve(),get:async()=>{state.reads++;return image;},getSized:async(p,n)=>{
  state.reads++;assert.equal(p,path);assert.equal(n,image.length);return corrupt?Buffer.alloc(image.length):image;
 }};
 const handler=createPublicImageHandler({enabled:true,sizedDeliveryEnabled:sized,moderationPreviewsEnabled:true,authenticatedViewersEnabled:mode==='viewer',createBackend:()=>backend});
 const query=mode==='preview'?'preview=1':mode==='review'?'review='+PUB:'publication='+PUB;
 const url='/api/public-image?'+query+'&asset='+ID+'&variant=full';
 const requestHeaders={Authorization:'Bearer synthetic-token',...(mode==='review'?{'x-moemoa-review-hash':'a'.repeat(64),'x-moemoa-review-policy':'SYNTHETIC','x-moemoa-review-revision':'1'}:{})};
 return {handler,backend,state,url,requestHeaders};
}

test('all four authorized image paths reserve exact bytes and retain no-store',async()=>{
 for(const mode of ['public','preview','review','viewer']) {
  const f=fixture({mode});await listen(f.handler,async base=>{
   const r=await fetch(base+f.url,{headers:f.requestHeaders});assert.equal(r.status,200);
   assert.deepEqual(Buffer.from(await r.arrayBuffer()),image);assert.match(r.headers.get('cache-control'),/no-store/);
  });assert.equal(f.state.resolves,2);assert.equal(f.state.charges[0].name,'authorize_memory_sized_image_delivery');
 }
});

test('quota and malformed reservation stop before Storage; hash/withdrawal suppress image bytes',async()=>{
 for(const [config,status,reads] of [[{limited:true},429,0],[{invalidSize:true},503,0],[{corrupt:true},503,1],[{revoke:true},404,1]]) {
  const f=fixture(config);await listen(f.handler,async base=>{const r=await fetch(base+f.url);assert.equal(r.status,status);assert.match(r.headers.get('content-type'),/json/);});
  assert.equal(f.state.reads,reads);assert.equal(f.state.charges.length,1);
 }
});

test('flag off preserves maximum reservation without calling sized download',async()=>{
 const f=fixture({sized:false});f.backend.getSized=async()=>{throw Error('must not call');};
 await listen(f.handler,async base=>assert.equal((await fetch(base+f.url)).status,200));
 assert.equal(f.state.charges[0].name,'authorize_memory_image_delivery');
});

test('real local Storage HTTP range → handler → visitor retains exact bytes and image dimensions',async()=>{
 const f=fixture();let downloads=0;
 await listen((req,res)=>{
  downloads++;assert.equal(req.headers.range,'bytes=0-'+(image.length-1));
  res.writeHead(206,{'Content-Length':image.length,'Content-Range':'bytes 0-'+(image.length-1)+'/'+image.length});res.end(image);
 },async storage=>{
  f.backend.getSized=(p,n)=>downloadSizedImage({url:storage,key:'synthetic-key',path:p,bytes:n});
  await listen(f.handler,async base=>{const r=await fetch(base+f.url);assert.equal(r.status,200);const body=Buffer.from(await r.arrayBuffer());
   const metadata=await sharp(body).metadata();assert.equal(metadata.width,24);assert.equal(metadata.height,30);assert.deepEqual(body,image);
  });
 });assert.equal(downloads,1);assert.equal(f.state.charges.length,1);
});


test('retirement before reservation is 404 and Storage failure never falls back or refunds',async()=>{
 const retired=fixture();const rpc=retired.backend.rpc;
 retired.backend.rpc=async(name,args)=>{if(name==='authorize_memory_sized_image_delivery')throw new PublicImageError('NOT_FOUND',409);return rpc(name,args);};
 await listen(retired.handler,async base=>assert.equal((await fetch(base+retired.url)).status,404));
 assert.equal(retired.state.reads,0);
 const failed=fixture();failed.backend.getSized=async()=>{throw new Error('synthetic provider secret');};
 failed.backend.get=async()=>{throw Error('fallback must not run');};
 await listen(failed.handler,async base=>{const r=await fetch(base+failed.url);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'IMAGE_SERVICE_FAILED'});});
 assert.equal(failed.state.charges.length,1);assert.equal(failed.state.resolves,1);
});
