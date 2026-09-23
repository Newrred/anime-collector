import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import sharp from "sharp";
import { processPublicImage,imageHash,PublicImageError,INPUT_LIMIT } from "../../src/server/publicImages/processImage.js";
import { createPublicImageHandler,cleanupPublicImages } from "../../src/server/publicImages/handler.js";
import { prepareSelectedPublicImage } from "../../src/features/memory/application/preparePublicImage.js";
import { publicImageUrl,publicDesignStyle } from "../../src/features/memory/domain/publicVisual.js";

const ID="11111111-1111-4111-8111-111111111111", PUB="22222222-2222-4222-8222-222222222222";
const source=await sharp({create:{width:20,height:30,channels:3,background:"#ab3290"}}).png().toBuffer();
function harness({enabled=true,failThumb=false,ambiguousComplete=false,revokeDuringRead=false}={}) {
  const objects=new Map(); const state={ready:false,published:false,revoked:false,failed:false,reservations:0};
  const reference=(variant)=>({path:`${ID}/${variant}.webp`,hash:imageHash(objects.get(`${ID}/${variant}.webp`))});
  const user={async rpc(name,args) {
    if(name==="reserve_memory_public_asset") {
      state.reservations++;
      if(state.ready) return {id:ID,state:"READY"};
      return {id:ID,prefix:ID,state:"PREPARING",sourceHash:imageHash(source)};
    }
    if(name==="resolve_memory_image_preview") return state.ready ? reference(args.p_variant) : null;
    throw new Error("unknown user RPC");
  }};
  const backend={
    async user(token) { if(token!=="test-token") throw new PublicImageError("AUTH_REQUIRED",401); return user; },
    async rpc(name,args) {
      if(name==="complete_memory_public_asset") { state.ready=true; if(ambiguousComplete) throw new Error("lost response"); return null; }
      if(name==="fail_memory_public_asset") { if(!state.ready) state.failed=true; return null; }
      if(name==="resolve_memory_public_image") return state.ready && state.published && !state.revoked && args.p_publication_id===PUB && args.p_asset_id===ID ? reference(args.p_variant) : null;
      if(name==="claim_memory_image_cleanup") return state.failed ? [{id:ID,prefix:ID}] : [];
      if(name==="complete_memory_image_cleanup") {state.failed=false; return null;}
      throw new Error("unknown service RPC");
    },
    async put(path,bytes) { if(failThumb && path.endsWith("thumb.webp")) throw new Error("storage secret detail"); objects.set(path,Buffer.from(bytes)); },
    async get(path) { if(revokeDuringRead) state.revoked=true; return objects.get(path); },
    async remove(paths) { for(const path of paths) objects.delete(path); },
  };
  const handler=createPublicImageHandler({enabled,createBackend:()=>backend,allowedOrigins:["https://example.test"]});
  return {backend,handler,state,objects};
}
async function withServer(h,fn) {
  const server=createServer(h.handler); await new Promise(r=>server.listen(0,"127.0.0.1",r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(r=>server.close(r)); }
}
const headers={"Content-Type":"application/octet-stream",Authorization:"Bearer test-token","X-Moemoa-Asset":ID,
 "X-Moemoa-Version":"1","X-Moemoa-Operation":PUB,"X-Moemoa-Consent":"TEST_ONLY"};
const post=(base,bytes=source,extra={})=>fetch(`${base}/api/public-image`,{method:"POST",headers:{...headers,...extra},body:bytes});
const getUrl=(base,variant="thumb")=>base+publicImageUrl(PUB,ID,variant);

test("image decode generates bounded, rotated WebP derivatives with private metadata removed",async()=>{
  const original=await sharp({create:{width:60,height:100,channels:3,background:"red"}})
    .withMetadata({orientation:6}).withExif({IFD0:{Artist:"private-owner",ImageDescription:"private-place"}}).jpeg().toBuffer();
  const before=imageHash(original), result=await processPublicImage(original);
  assert.equal(imageHash(original),before);
  for(const bytes of [result.full,result.thumb]) {
    const meta=await sharp(bytes).metadata(); assert.equal(meta.format,"webp"); assert.equal(meta.exif,undefined); assert.equal(meta.xmp,undefined); assert.equal(meta.icc,undefined);
  }
  assert.equal(result.width,100); assert.equal(result.height,60);
});

test("image pipeline accepts actual PNG, JPEG and WebP regardless of client MIME claims",async()=>{
  for(const format of ["png","jpeg","webp"]) {
    const bytes=await sharp(source).toFormat(format).toBuffer();
    assert.ok((await processPublicImage(bytes)).full.length>0);
  }
});

test("image pipeline rejects executable, truncated, oversized and animated inputs",async()=>{
  for(const data of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"),Buffer.from("<html>evil</html>"),Buffer.from("GIF89a")]) {
    await assert.rejects(processPublicImage(data),{code:"IMAGE_FORMAT_UNSUPPORTED"});
  }
  await assert.rejects(processPublicImage(Buffer.from([0xff,0xd8,0xff,1])),{code:"IMAGE_DECODE_FAILED"});
  await assert.rejects(processPublicImage(Buffer.alloc(INPUT_LIMIT+1)),{code:"IMAGE_SIZE_LIMIT"});
  const apng=Buffer.concat([source.subarray(0,8),Buffer.from([0,0,0,0]),Buffer.from("acTL"),Buffer.alloc(4)]);
  await assert.rejects(processPublicImage(apng),{code:"IMAGE_FORMAT_UNSUPPORTED"});
});

test("image dimension bomb is rejected before derivative generation",async()=>{
  const large=await sharp({create:{width:5100,height:5100,channels:3,background:"white"}}).png().toBuffer();
  await assert.rejects(processPublicImage(large),{code:"IMAGE_DECODE_FAILED"});
});

test("HTTP explicit upload stays private until publish, supports owner preview and rechecks both sizes",async()=>{
  const h=harness(); await withServer(h,async base=>{
    let res=await post(base); assert.equal(res.status,200); assert.deepEqual(await res.json(),{id:ID,state:"READY"});
    assert.equal((await fetch(getUrl(base))).status,404);
    res=await fetch(`${base}/api/public-image?asset=${ID}&preview=1`,{headers:{Authorization:"Bearer test-token"}}); assert.equal(res.status,200);
    h.state.published=true;
    for(const variant of ["full","thumb"]) {
      res=await fetch(getUrl(base,variant)); assert.equal(res.status,200); assert.match(res.headers.get("cache-control"),/no-store/);
      assert.equal(res.headers.get("vercel-cdn-cache-control"),"no-store"); assert.equal(res.headers.get("content-type"),"image/webp");
      assert.equal((await sharp(Buffer.from(await res.arrayBuffer())).metadata()).format,"webp");
    }
    h.state.revoked=true;
    assert.equal((await fetch(getUrl(base,"full"))).status,404); assert.equal((await fetch(getUrl(base))).status,404);
  });
});

test("HTTP rejects missing auth, disabled service, disallowed origin, guessed publication and source mismatch",async()=>{
  const h=harness(); await withServer(h,async base=>{
    assert.equal((await post(base,source,{Authorization:""})).status,401);
    assert.equal(h.state.reservations,0);
    assert.equal((await post(base,source,{Origin:"https://evil.test"})).status,403);
    const mismatch=await post(base,Buffer.from("other private file")); assert.equal((await mismatch.json()).error,"SOURCE_IMAGE_MISMATCH"); assert.equal(h.objects.size,0);
  });
  await withServer(harness({enabled:false}),async base=>{ assert.equal((await post(base)).status,503); });
});

test("HTTP revocation during storage download prevents late image response",async()=>{
  const h=harness({revokeDuringRead:true}); await withServer(h,async base=>{
    await post(base); h.state.published=true;
    assert.equal((await fetch(getUrl(base))).status,404);
  });
});

test("failed thumbnail leaves no published image and cleanup can retry safely",async()=>{
  const h=harness({failThumb:true}); await withServer(h,async base=>{
    const res=await post(base); assert.equal(res.status,503); assert.doesNotMatch(await res.text(),/secret/);
    assert.equal(h.state.ready,false); assert.equal(h.objects.size,1);
    assert.deepEqual(await cleanupPublicImages(h.backend),{deleted:1,failed:0}); assert.equal(h.objects.size,0);
    assert.deepEqual(await cleanupPublicImages(h.backend),{deleted:0,failed:0});
  });
});

test("lost completion response never deletes committed derivatives; same operation retries ready",async()=>{
  const h=harness({ambiguousComplete:true}); await withServer(h,async base=>{
    assert.equal((await post(base)).status,503); assert.equal(h.state.ready,true); assert.equal(h.objects.size,2);
    assert.deepEqual(await cleanupPublicImages(h.backend),{deleted:0,failed:0});
    assert.equal((await post(base)).status,200); assert.equal(h.objects.size,2);
  });
});

test("client image preparation requires explicit consent and actual original, with no preview fallback",async()=>{
  let reads=0,calls=0;
  const input={sourceAssetId:ID,sourceVersion:1,operationId:PUB,accessToken:"token",policyRevision:"TEST",consented:false,
    readOriginal:async()=>{reads++;return new Blob([source]);},fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({id:ID,state:"READY"})};}};
  await assert.rejects(prepareSelectedPublicImage(input),{code:"IMAGE_CONSENT_REQUIRED"}); assert.equal(reads,0);
  await assert.rejects(prepareSelectedPublicImage({...input,consented:true,readOriginal:async()=>null}),{code:"ORIGINAL_IMAGE_UNAVAILABLE"}); assert.equal(calls,0);
  await assert.rejects(prepareSelectedPublicImage({...input,consented:true,readOriginal:async()=>{throw new Error("private device path");}}),{message:"ORIGINAL_IMAGE_UNAVAILABLE"});
  assert.deepEqual(await prepareSelectedPublicImage({...input,consented:true}),{id:ID,state:"READY"}); assert.equal(calls,1);
  await assert.rejects(prepareSelectedPublicImage({...input,consented:true,signal:AbortSignal.abort()}),{code:"REQUEST_ABORTED"}); assert.equal(calls,1);
});

test("public design and image URL use bounded render values and gateway IDs only",()=>{
  assert.deepEqual(publicDesignStyle({type:"SYSTEM_DESIGN",rendererVersion:1,patternToken:"fffe0000"}),{"--design-hue":255,"--design-angle":"74deg"});
  assert.throws(()=>publicDesignStyle({type:"SYSTEM_DESIGN",rendererVersion:2,patternToken:"fffe0000"}));
  assert.throws(()=>publicImageUrl(PUB,"file:///private"));
  assert.throws(()=>publicImageUrl(PUB,ID,"../original"));
});


test("cleanup storage failure retains retry eligibility and never records false deletion",async()=>{
  let finished=0,attempts=0;
  const backend={rpc:async(name)=>name==="claim_memory_image_cleanup" ? [{id:ID,prefix:ID}] : finished++,
    remove:async()=>{ if(attempts++===0) throw new Error("temporary failure"); }};
  assert.deepEqual(await cleanupPublicImages(backend),{deleted:0,failed:1}); assert.equal(finished,0);
  assert.deepEqual(await cleanupPublicImages(backend),{deleted:1,failed:0}); assert.equal(finished,1);
});

test("HTTP rejects unknown placement and unsupported image variants without bytes",async()=>{
  const h=harness(); await withServer(h,async base=>{
    await post(base); h.state.published=true;
    assert.equal((await fetch(base+publicImageUrl(ID,ID))).status,404);
    assert.equal((await fetch(`${getUrl(base)}&variant=original`)).status,400);
    assert.equal((await fetch(`${base}/api/public-image?publication=${PUB}&asset=${ID}&variant=original`)).status,400);
  });
});
