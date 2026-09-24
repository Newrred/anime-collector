import test from "node:test";
import assert from "node:assert/strict";
import { createMinihomeController } from "../../src/features/memory/application/createMinihomeController.js";
import { minihomeSnapshot, minihomeLink } from "../../src/features/memory/domain/minihomeView.js";
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const snapshot={nickname:"Name",bio:"Intro",entries:[{publicationId:id(2),snapshot:{schemaVersion:1,title:"Board",description:"",cards:[{id:id(3),title:"Memory",visual:{type:"SYSTEM_DESIGN",rendererVersion:1,patternToken:"aabbccdd"}}]}}]};
const preview={id:id(1),revision:1,reviewHash:"a".repeat(64),policyRevision:"TEST",snapshot};
function harness(overrides={}) {
 let session={user:{id:id(9)}}; const calls=[];
 const gateway={getHome:async()=>null,listHomeBoards:async()=>({boards:[],next:null}),prepareHome:async()=>preview,
 publishHome:async(value)=>{calls.push(value);return {id:id(1),revision:2,published:true};},...overrides};
 const controller=createMinihomeController({userId:id(9),gateway,getSession:async()=>session,uuid:()=>id(8)});
 return {controller,calls,gateway,session:(next)=>{session=next;}};
}
test("mini-home public DTO strips account/private extras and rejects duplicate entries",()=>{
 assert.deepEqual(minihomeSnapshot({...snapshot,email:"private",entries:snapshot.entries.map(e=>({...e,ownerId:"private"}))}),snapshot);
 assert.throws(()=>minihomeSnapshot({...snapshot,entries:[...snapshot.entries,...snapshot.entries]}));
 assert.throws(()=>minihomeLink("../../private"));
});
test("mini-home requires fresh consent and all visuals, retries preserve operation",async()=>{
 const h=harness();await h.controller.prepare({});
 await h.controller.publish({consented:false,visualsReady:true});assert.equal(h.calls.length,0);
 const publish=h.gateway.publishHome;h.gateway.publishHome=async(value)=>{h.calls.push(value);throw new Error("offline");};
 await h.controller.publish({consented:true,visualsReady:true});h.gateway.publishHome=publish;
 await h.controller.publish({consented:true,visualsReady:true});assert.deepEqual(h.calls[0],h.calls[1]);
 assert.equal(h.controller.getSnapshot().phase,"published");
});
test("cancelled or account-switched late preview never becomes publishable",async()=>{
 for(const swapped of [false,true]){
  let resolve;const h=harness({prepareHome:()=>new Promise(r=>{resolve=r;})});const pending=h.controller.prepare({});
  while(!resolve)await new Promise(r=>setImmediate(r));
  if(swapped)h.session({user:{id:id(7)}});else h.controller.cancel();
  resolve(preview);await pending;assert.equal(h.controller.getSnapshot().review,null);
 }
});
test("stale preview rejection clears review and private transition uses latest revision",async()=>{
 const h=harness({publishHome:async()=>{throw Object.assign(new Error(),{code:"PREVIEW_CHANGED"});}});
 await h.controller.prepare({});await h.controller.publish({consented:true,visualsReady:true});
 assert.equal(h.controller.getSnapshot().review,null);
 h.gateway.getHome=async()=>({id:id(1),revision:8,published:true});
 h.gateway.revokeHome=async(revision)=>{assert.equal(revision,8);return {id:id(1),revision:9,published:false};};
 await h.controller.revoke();assert.equal(h.controller.getSnapshot().phase,"revoked");
});
test("choice pagination appends public DTOs and recovered draft never becomes consented",async()=>{
 const board={id:id(2),...snapshot.entries[0].snapshot};
 const h=harness({getHome:async()=>({id:id(1),revision:5,published:true,preview}),listHomeBoards:async(after)=>({boards:[{...board,id:after?id(5):id(2)}],next:after?null:id(2)})});
 await h.controller.load();assert.equal(h.controller.getSnapshot().review,null);
 await h.controller.more();assert.deepEqual(h.controller.getSnapshot().boards.map(b=>b.id),[id(2),id(5)]);
 await h.controller.publish({consented:true,visualsReady:true});assert.equal(h.calls.length,0);
});
