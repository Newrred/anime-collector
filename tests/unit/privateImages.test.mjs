import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import sharp from 'sharp';
import { createPrivateImageHandler, cleanupPrivateImages } from '../../src/server/privateImages/handler.js';
import { PrivateImageError, processPrivateImage, hash } from '../../src/server/privateImages/processImage.js';
import { pngBytes, webpVp8xBytes } from '../catalog-lab/fixtures/cover-valid-images.mjs';

const A='11111111-1111-4111-8111-111111111111', ASSET='aaaaaaaa-aaaa-4aaa-8aaa-000000000001', OP='ffffffff-ffff-4fff-8fff-000000000001', ID='eeeeeeee-eeee-4eee-8eee-000000000001';
const policy={revision:'TEST_ONLY',mainMaxBytes:1000000,thumbnailMaxBytes:120000};
const headers={Authorization:'Bearer A','Content-Type':'application/octet-stream','X-Moemoa-Asset':ASSET,'X-Moemoa-Version':'1','X-Moemoa-Operation':OP,'X-Moemoa-Consent':'TEST_ONLY'};
const source=Buffer.from(pngBytes);
const url=`/api/private-image?asset=${ASSET}&version=1`;
function harness({enabled=true, loseCompletion=false, failThumb=false, revokeDuringRead=false, corruptRead=false}={}) {
  const objects=new Map(); const state={record:null,reservations:0,removals:0,reads:0,charged:0,retired:false};
  const backend={
    async user(token) {
      if(!['A','B'].includes(token)) throw new PrivateImageError('AUTH_REQUIRED',401);
      return {id: token==='A'?A:'22222222-2222-4222-8222-222222222222',async rpc(name,args){
        if(token!=='A') throw new PrivateImageError('NOT_FOUND',404);
        if(name==='get_memory_private_image_policy') return policy;
        if(name==='authorize_memory_private_image_attempt') return;
        if(name==='read_memory_private_image') {
          if(state.retired || state.record?.state!=='READY') throw new PrivateImageError('NOT_FOUND',404);
          if(args.p_charge) state.charged++;
          return {id:ID,bytes:state.record[`${args.p_variant}_bytes`],hash:state.record[`${args.p_variant}_hash`]};
        }
        if(name==='cancel_memory_private_image') {state.retired=true;state.record.state='DELETING';return;}
        throw new Error('unexpected user rpc');
      }};
    },
    async rpc(name,args){
      if(name==='reserve_memory_private_image') {
        if(args.p_owner!==A) throw new PrivateImageError('NOT_FOUND',404);
        if(state.record) {
          if(state.record.input_hash!==args.p_input_hash) throw new PrivateImageError('OPERATION_MISMATCH',409);
          return state.record;
        }
        state.reservations++;
        state.record={id:ID,state:'PREPARING',source_version:1,pipeline:'private-webp-v1',input_hash:args.p_input_hash,
          main_hash:args.p_main_hash,thumb_hash:args.p_thumb_hash,main_bytes:args.p_main_bytes,thumb_bytes:args.p_thumb_bytes,width:args.p_width,height:args.p_height};
        return state.record;
      }
      if(name==='complete_memory_private_image') {state.record.state='READY';if(loseCompletion) throw new Error('untrusted service detail');return;}
      if(name==='claim_memory_private_image_cleanup') return state.retired?[{id:ID}]:[];
      if(name==='complete_memory_private_image_cleanup') {state.record.state='DELETED';return;}
      throw new Error('unexpected service rpc');
    },
    async put(path,bytes){if(failThumb&&path.endsWith('/thumb.webp')) throw new Error('storage secret');objects.set(path,bytes);},
    async get(path){state.reads++;if(revokeDuringRead) state.retired=true;return corruptRead?Buffer.from('corrupt'):objects.get(path);},
    async remove(paths){state.removals++;for(const path of paths) objects.delete(path);},
  };
  return {backend,state,objects,handler:createPrivateImageHandler({enabled,createBackend:()=>backend,allowedOrigins:['https://example.test']})};
}
async function withServer(h,fn){
  const server=createServer(h.handler);
  for(let attempt=0;;attempt++) {
    try {await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(20000+Math.floor(Math.random()*30000),'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});break;}
    catch(e){if(e.code!=='EADDRINUSE'||attempt>=15)throw e;}
  }
  try {await fn(`http://127.0.0.1:${server.address().port}`);} finally {await new Promise(resolve=>server.close(resolve));}
}
const post=(base,bytes=source,extra={})=>fetch(base+'/api/private-image',{method:'POST',headers:{...headers,...extra},body:bytes});

test('private processor validates pixels/animation/magic and hashes real stripped bytes',async()=>{
  const bytes=await sharp({create:{width:100,height:200,channels:4,background:'#f880'}}).png().withExif({IFD0:{Artist:'synthetic-private-fixture'}}).toBuffer();
  const original=Buffer.from(bytes),out=await processPrivateImage(bytes,policy);
  assert.deepEqual(bytes,original);assert.equal(out.inputHash,hash(bytes));assert.equal(out.mainHash,hash(out.main));assert.notEqual(out.mainHash,out.inputHash);
  assert.equal((await sharp(out.main).metadata()).exif,undefined);assert.equal((await sharp(out.main).metadata()).format,'webp');
  const animation=Buffer.from(webpVp8xBytes);animation[20]|=2;
  for(const invalid of [Buffer.from('<svg/>'),animation]) await assert.rejects(processPrivateImage(invalid,policy),{code:'IMAGE_FORMAT_UNSUPPORTED'});
  const huge=await sharp({create:{width:1601,height:1,channels:3,background:'red'}}).png().toBuffer();
  await assert.rejects(processPrivateImage(huge,policy),{code:'IMAGE_SIZE_LIMIT'});
  await assert.rejects(processPrivateImage(Buffer.alloc(1500001),policy),{code:'IMAGE_SIZE_LIMIT'});
  await assert.rejects(processPrivateImage(source,{...policy,mainMaxBytes:1}),{code:'IMAGE_SIZE_LIMIT'});
});

test('private HTTP stores measured renditions, reads authenticated bytes without cache, denies B/anon',async()=>{
  const h=harness();await withServer(h,async base=>{
    const result=await post(base);assert.equal(result.status,200);const dto=await result.json();assert.equal(dto.state,'READY');assert.equal(dto.mainHash,hash(h.objects.get(`${ID}/main.webp`)));
    assert.equal(dto.owner_id,undefined);assert.equal(dto.path,undefined);assert.equal(h.state.record.input_hash,hash(source));
    const read=await fetch(base+url,{headers:{Authorization:'Bearer A'}});assert.equal(read.status,200);assert.match(read.headers.get('cache-control'),/private, no-store/);assert.equal(read.headers.get('cdn-cache-control'),'no-store');
    assert.equal(hash(Buffer.from(await read.arrayBuffer())),dto.mainHash);assert.equal(h.state.charged,1);
    for(const token of ['B',null]) {const denied=await fetch(base+url,{headers:token?{Authorization:`Bearer ${token}`}:{}});assert.equal(denied.status,token?404:401);}
    assert.equal(h.state.reads,1);
  });
});

test('private HTTP rejects stale consent and malformed body before any storage reservation',async()=>{
  const h=harness();await withServer(h,async base=>{
    assert.equal((await post(base,source,{'X-Moemoa-Consent':'OLD'})).status,409);
    assert.equal((await post(base,Buffer.from('<svg/>'))).status,400);
    assert.equal((await post(base,Buffer.alloc(1500001))).status,413);
    assert.equal((await post(base,source,{Origin:'https://other.test'})).status,403);
    assert.equal(h.state.reservations,0);assert.equal(h.objects.size,0);
  });
});

test('ambiguous completion preserves files/quota and same operation returns READY without another reservation',async()=>{
  const h=harness({loseCompletion:true});await withServer(h,async base=>{
    const first=await post(base);assert.equal(first.status,503);assert.deepEqual(await first.json(),{error:'PRIVATE_IMAGE_SERVICE_FAILED'});
    assert.equal(h.state.record.state,'READY');assert.equal(h.objects.size,2);assert.equal(h.state.removals,0);
    assert.equal((await (await post(base)).json()).state,'READY');assert.equal(h.state.reservations,1);
  });
});

test('partial upload retains reservation; explicit cancellation blocks read and confirmed cleanup removes files',async()=>{
  const h=harness({failThumb:true});await withServer(h,async base=>{
    assert.equal((await post(base)).status,503);assert.equal(h.state.record.state,'PREPARING');assert.equal(h.objects.size,1);assert.equal(h.state.removals,0);
    assert.equal((await fetch(base+'/api/private-image',{method:'DELETE',headers})).status,200);
    assert.equal((await fetch(base+url,{headers})).status,404);
    assert.deepEqual(await cleanupPrivateImages(h.backend),{deleted:1,failed:0});assert.equal(h.objects.size,0);assert.equal(h.state.record.state,'DELETED');
  });
});

test('private read revalidates revocation after storage fetch and rejects corrupted bytes',async()=>{
  for(const opts of [{revokeDuringRead:true},{corruptRead:true}]) {
    const h=harness(opts);await withServer(h,async base=>{
      await post(base);const read=await fetch(base+url,{headers});assert.equal(read.status,opts.revokeDuringRead?404:503);
      assert.match(read.headers.get('content-type'),/json/);
    });
  }
});

test('private API is disabled by default without contacting backend',async()=>{
  const h={handler:createPrivateImageHandler({createBackend:()=>assert.fail('disabled must not contact backend')})};
  await withServer(h,async base=>assert.equal((await post(base)).status,503));
});
