import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareCatalogUpload, uploadCover } from '../../tools/catalog-preview/uploader.mjs';
import { createHash } from 'node:crypto';

const config={url:'https://fixture.supabase.co',authHeaders:{apikey:'synthetic'}};
const release={releaseId:'fixture-a',releaseHash:'a'.repeat(64),targetCount:2,peoplePageCount:0,profile:'fixture',schemaVersion:2,policyVersion:'fixture'};
test('existing cover retry checks exact bytes, not only Content-Length',async()=>{
  const bytes=Buffer.from('synthetic cover');
  const asset={bucket_id:'fixture',object_path:'fixture.png',mime_type:'image/png',byte_size:bytes.length,checksum:createHash('sha256').update(bytes).digest('hex')};
  for (const body of [bytes,Buffer.alloc(bytes.length),Buffer.alloc(bytes.length+1)]) {
    const fetchImpl=async(url,options)=>options.method==='POST'?new Response(null,{status:409}):new Response(body);
    if(body===bytes) await uploadCover(config,asset,bytes,fetchImpl);
    else await assert.rejects(uploadCover(config,asset,bytes,fetchImpl),{code:'CATALOG_PREVIEW_COVER_UPLOAD_FAILED'});
  }
});
for (const status of ['STAGING','ACTIVE','RETIRED']) {
  test(`resuming ${status} release never overwrites its state`,async()=>{
    const requests=[];
    const fetchImpl=async(url,options)=>{
      requests.push({url,options});
      if (options.method==='POST') return new Response(null,{status:201});
      return Response.json(url.includes('catalog_active_release')?[{release_id:'fixture-old'}]:[
        {release_hash:release.releaseHash,target_count:2,people_page_count:0,status},
      ]);
    };
    assert.deepEqual(await prepareCatalogUpload(config,release,fetchImpl),{expectedActiveReleaseId:'fixture-old',status});
    const post=requests.find(r=>r.options.method==='POST');
    assert.equal(post.options.headers.Prefer,'resolution=ignore-duplicates,return=minimal');
  });
}
test('changed immutable release and failed state read cannot be activated',async()=>{
  for (const mode of ['hash','count','network']) {
    const fetchImpl=async(url,options)=>{
      if (mode==='network') throw new Error('private remote detail');
      if (options.method==='POST') return new Response(null,{status:201});
      if(url.includes('catalog_active_release')) return Response.json([]);
      return Response.json([{release_hash:mode==='hash'?'b'.repeat(64):release.releaseHash,
        target_count:mode==='count'?3:2,people_page_count:0,status:'STAGING'}]);
    };
    await assert.rejects(prepareCatalogUpload(config,release,fetchImpl),{code:mode==='network'?'CATALOG_PREVIEW_STATE_FAILED':'CATALOG_PREVIEW_RELEASE_CONFLICT'});
  }
});
