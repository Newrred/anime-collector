import test from 'node:test';
import assert from 'node:assert/strict';
import {createSimpleCardSharing,cardSharingBoardId} from '../../src/features/memory/application/simpleCardSharing.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sync=()=>({syncState:'SYNCED',remoteVersion:1});
function harness(){
 const calls=[];let failPublish=false,extra=false,decodeHook=async()=>{};
 const bundle={card:{id:id(2),ownerId:'account:'+id(1),sync:sync()},asset:{id:id(3),imageType:'SYSTEM_DESIGN',sync:sync()},title:{displayTitle:'Shared memory'}};
 let detail={board:{id:id(5),ownerId:bundle.card.ownerId,sync:sync()},items:[{bundle,membership:{sync:sync()}}]};
 const services={policyRevision:'test',getSession:async()=>({user:{id:id(1)},access_token:'synthetic'}),gateway:{
  get:async()=>null,
  prepare:async input=>{calls.push(['prepare',input]);return {id:id(7),revision:1,reviewHash:'a'.repeat(64),policyRevision:'test',snapshot:{schemaVersion:1,title:input.title,description:'',cards:[{id:id(8),title:'Shared memory',visual:{type:'SYSTEM_DESIGN',rendererVersion:1,patternToken:'aabbccdd'},...(extra?{note:'private'}:{})}]}};},
  publish:async input=>{calls.push(['publish',input]);if(failPublish)throw Object.assign(new Error(),{code:'PUBLICATION_REQUEST_FAILED'});return {id:id(7),revision:2,state:'PUBLISHED'};},
  makeCardPrivate:async card=>{calls.push(['private',card]);return {published:false};}
 }};
 const runtime={getBoard:async()=>detail,createBoard:async input=>{calls.push(['board',input]);detail={board:{...input,ownerId:bundle.card.ownerId,sync:sync()},items:[]};},addCardToBoard:async()=>{detail.items.push({bundle,membership:{sync:sync()}});calls.push(['membership']);}};
 const driver=createSimpleCardSharing({cardId:bundle.card.id,ownerId:bundle.card.ownerId,runtime,services,syncBoard:async()=>{},decodeReview:async()=>decodeHook(),boardIdFor:async()=>id(5)});
 const input={visible:true,consented:true,source:{key:'design'},bundle,rightsBasis:'USER_ORIGINAL'};
 return {driver,calls,bundle,input,services,fail:value=>failPublish=value,extra:()=>extra=true,missing:()=>detail=null,decode:fn=>decodeHook=fn};
}
test('simple sharing requires explicit consent before creating or preparing anything',async()=>{const h=harness();await assert.rejects(h.driver.save({...h.input,consented:false}),{code:'REVIEW_REQUIRED'});assert.equal(h.calls.length,0);});
test('one save publishes exactly title and image; no notes or other cards',async()=>{const h=harness();assert.equal((await h.driver.save(h.input)).published,true);assert.deepEqual(h.calls[0][1].cards,[{cardId:h.bundle.card.id,fields:[]}]);assert.equal(h.calls.filter(c=>c[0]==='publish').length,1);});
test('unknown publish outcome retries same operation and review without preparing again',async()=>{const h=harness();h.fail(true);await assert.rejects(h.driver.save(h.input));assert.equal(h.driver.hasPendingPublish(),true);h.fail(false);await h.driver.save(h.input);const p=h.calls.filter(c=>c[0]==='publish');assert.deepEqual(p[0],p[1]);assert.equal(h.calls.filter(c=>c[0]==='prepare').length,1);});
test('unselected private fields in server preview stop publication',async()=>{const h=harness();h.extra();await assert.rejects(h.driver.save(h.input),{code:'PREVIEW_CHANGED'});assert.equal(h.calls.filter(c=>c[0]==='publish').length,0);});
test('source changed while loading final image cannot publish under old consent',async()=>{const h=harness();h.decode(async()=>{h.bundle.card.sync.remoteVersion++;});await assert.rejects(h.driver.save(h.input),{code:'PREVIEW_CHANGED'});assert.equal(h.calls.filter(c=>c[0]==='publish').length,0);});
test('private uses reversible withdrawal without requiring a new publication consent',async()=>{const h=harness();await h.driver.save({visible:false});assert.deepEqual(h.calls,[['private',id(2)]]);});
test('pending publish cannot be silently replaced by a private action',async()=>{const h=harness();h.fail(true);await assert.rejects(h.driver.save(h.input));await assert.rejects(h.driver.save({visible:false}),{code:'PUBLICATION_REQUEST_FAILED'});assert.equal(h.calls.filter(c=>c[0]==='private').length,0);});
test('single-card Board is created once after explicit save',async()=>{const h=harness();h.missing();await h.driver.save(h.input);await h.driver.save(h.input);assert.equal(h.calls.filter(c=>c[0]==='board').length,1);assert.equal(h.calls.filter(c=>c[0]==='membership').length,1);});
test('unmount during review prevents publication',async()=>{const h=harness();h.decode(async()=>h.driver.dispose());await assert.rejects(h.driver.save(h.input),{code:'AUTH_REQUIRED'});assert.equal(h.calls.filter(c=>c[0]==='publish').length,0);});
test('sharing Board ID is stable and valid across devices',async()=>{assert.equal(await cardSharingBoardId(id(2)),await cardSharingBoardId(id(2)));assert.notEqual(await cardSharingBoardId(id(2)),await cardSharingBoardId(id(3)));assert.match(await cardSharingBoardId(id(2)),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);});
