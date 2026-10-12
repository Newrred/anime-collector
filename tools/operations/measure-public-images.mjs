import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createPublicImageHandler} from '../../src/server/publicImages/handler.js';
import {imageHash} from '../../src/server/publicImages/processImage.js';
import sharp from 'sharp';
import {processPublicImage,OUTPUT_LIMIT} from '../../src/server/publicImages/processImage.js';
// Deterministic synthetic pixels only: no user images, disk image output or upload.
const rows=[];let current,charges=0;const asset='11111111-1111-4111-8111-111111111111',publication='22222222-2222-4222-8222-222222222222';
const handler=createPublicImageHandler({enabled:true,createBackend:()=>({rpc:async(name,args)=>{if(name==='authorize_memory_image_delivery'){assert.equal(args.p_bytes,OUTPUT_LIMIT);charges++;return null;}return{path:asset+'/'+args.p_variant+'.webp',hash:imageHash(current[args.p_variant])};},get:async path=>current[path.endsWith('/full.webp')?'full':'thumb']})});
const server=createServer(handler);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
try {
for(const kind of ['gradient','geometric','noise']){
 const width=1600,height=1000,raw=Buffer.alloc(width*height*3);let seed=7;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<3;c++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  raw[(y*width+x)*3+c]=kind==='gradient'?Math.round((c===0?x/width:c===1?y/height:.5)*255):kind==='geometric'?(((x>>5)+(y>>5)+c)%5)*50:seed>>>24;
 }
 const input=await sharp(raw,{raw:{width,height,channels:3}}).jpeg({quality:90}).toBuffer();
 const out=await processPublicImage(input);
 current=out;const http={};
 for(const variant of ['full','thumb']){
 const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/public-image?asset='+asset+'&publication='+publication+'&variant='+variant);
 assert.equal(r.status,200);assert.equal(r.headers.get('cdn-cache-control'),'no-store');const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.equals(out[variant]));assert.equal(Number(r.headers.get('content-length')),bytes.length);http[variant]=bytes.length;
 }
 rows.push({fixture:kind,httpPayloadBytes:http,inputBytes:input.length,fullBytes:out.full.length,thumbBytes:out.thumb.length,storedBytes:out.full.length+out.thumb.length,twentyFullVisitBytes:out.full.length*20,twentyThumbVisitBytes:out.thumb.length*20,thumbAndFullVisitBytes:out.thumb.length*20+out.full.length,reservedBudgetPerGet:OUTPUT_LIMIT});
}
} finally {await new Promise(resolve=>server.close(resolve));}
assert.equal(charges,6);
console.log(JSON.stringify({httpRequests:charges,kind:'local synthetic actual encoder output; not hosted traffic or real-user distribution',rows},null,2));
