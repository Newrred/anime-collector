import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicationViewer} from '../../src/features/memory/application/createPublicationViewer.js';
const A={user:{id:'A'},access_token:'token-A'},B={user:{id:'B'},access_token:'token-B'};
test('viewer routes anonymous and authenticated reads and rejects a changed account response',async()=>{
 let session=null,authenticated=0,anonymous=0,swap=false;
 const viewer=createPublicationViewer({getSession:async()=>session,
  getGateway:async()=>({read:async()=>{authenticated++;if(swap)session=B;return {title:'private-to-A'};}}),
  anonymousReader:{read:async()=>{anonymous++;return {title:'general'};}}});
 assert.deepEqual(await viewer.reader.read('id'),{title:'general'});
 session=A;assert.deepEqual(await viewer.reader.read('id'),{title:'private-to-A'});
 swap=true;await assert.rejects(viewer.reader.read('id'),/VIEWER_CHANGED/);
 assert.equal(anonymous,1);assert.equal(authenticated,2);
});
test('image bytes use header authorization and are discarded after logout or abort',async()=>{
 let session=A,after=()=>{};
 const controller=new AbortController();
 const viewer=createPublicationViewer({getSession:async()=>session,fetchImpl:async(url,options)=>{
  assert.ok(!url.includes('token-A'));assert.equal(options.headers.Authorization,'Bearer token-A');
  assert.equal(options.cache,'no-store');after();
  return new Response('image',{headers:{'content-type':'image/webp'}});
 }});
 assert.equal((await viewer.readImage('p','a')).size,5);
 after=()=>{session=null;};await assert.rejects(viewer.readImage('p','a'),/VIEWER_CHANGED/);
 session=A;after=()=>controller.abort();await assert.rejects(viewer.readImage('p','a',controller.signal),/VIEWER_CHANGED/);
});
test('viewer subscription catches registration race, ignores duplicate session and cleans up',async()=>{
 let session=A,listener,removed=false,changes=0;
 const viewer=createPublicationViewer({getSession:async()=>session,subscribeSession:async callback=>{
  listener=callback;session=B;return()=>{removed=true;};
 }});
 const unsubscribe=await viewer.subscribeViewer(()=>changes++);
 assert.equal(changes,1);listener(B);assert.equal(changes,1);
 listener(null);assert.equal(changes,2);unsubscribe();assert.equal(removed,true);
});
