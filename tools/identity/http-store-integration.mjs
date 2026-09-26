import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createIdentityHandler} from '../../src/server/identity/handler.js';
export async function runIdentityHttpDatabase({store,query,userId,sessionId}) {
 let revokeDuringLookup=false,dropCompleteResponse=false,lookups=0;
 const backend={authenticate:async()=>({userId,sessionId}),store,provider:{async lookup(value){
   lookups++;
   if(revokeDuringLookup)query(`delete from auth.sessions where id='${sessionId}'`);
   return {...value,status:'VERIFIED'};
 }}};
 const handler=createIdentityHandler({enabled:true,allowedOrigins:['https://local-test.example'],createBackend:()=>backend});
 const server=createServer((req,res)=>{
   const originalEnd=res.end.bind(res);
   res.end=value=>{
     if(dropCompleteResponse&&String(value).includes('IDENTITY_EVIDENCE_RECORDED')){dropCompleteResponse=false;res.destroy();return res;}
     return originalEnd(value);
   };
   return handler(req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 const post=body=>fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic-session',origin:'https://local-test.example'},body:JSON.stringify(body)});
 try {
   const issue=await post({action:'issue',purpose:'ADULT_IDENTITY'});assert.equal(issue.status,200);
   const issued=await issue.json();assert.deepEqual(Object.keys(issued).sort(),['expiresAt','purpose','requestId']);
   const body={action:'complete',purpose:'ADULT_IDENTITY',requestId:issued.requestId};
   const complete=await post(body);assert.equal(complete.status,200);assert.equal(complete.headers.get('cache-control'),'no-store');
   assert.deepEqual(await complete.json(),{requestId:issued.requestId,purpose:'ADULT_IDENTITY',status:'IDENTITY_EVIDENCE_RECORDED'});
   assert.equal(query(`select status||':'||revision from private.memory_identity_requests where id='${issued.requestId}'`),'RECORDED:1');
   console.log('PASS: loopback HTTP issue and completion persist exact request in real DB');
   const replay=await post(body);assert.equal(replay.status,409);assert.deepEqual(await replay.json(),{error:'VERIFICATION_NOT_PENDING'});
   console.log('PASS: loopback HTTP replay leaves one recorded revision');
   const lostIssue=await post({action:'issue',purpose:'ADULT_IDENTITY'});assert.equal(lostIssue.status,200);const lost=await lostIssue.json();
   dropCompleteResponse=true;
   await assert.rejects(post({...body,requestId:lost.requestId}));
   const afterLostLookups=lookups;
   const recovered=await post({action:'status',purpose:'ADULT_IDENTITY',requestId:lost.requestId});assert.equal(recovered.status,200);
   assert.deepEqual(await recovered.json(),{requestId:lost.requestId,purpose:'ADULT_IDENTITY',status:'IDENTITY_EVIDENCE_RECORDED'});
   assert.equal(lookups,afterLostLookups);
   assert.equal(query(`select status||':'||revision from private.memory_identity_requests where id='${lost.requestId}'`),'RECORDED:1');
   console.log('PASS: dropped successful HTTP response recovers status without provider call or duplicate evidence');
   const second=await post({action:'issue',purpose:'ADULT_IDENTITY'});assert.equal(second.status,200);const pending=await second.json();
   revokeDuringLookup=true;
   const revoked=await post({...body,requestId:pending.requestId});assert.equal(revoked.status,401);assert.deepEqual(await revoked.json(),{error:'AUTH_REQUIRED'});
   assert.equal(query(`select status||':'||revision from private.memory_identity_requests where id='${pending.requestId}'`),'PENDING:0');
   console.log('PASS: real session deletion during lookup rejects HTTP completion without evidence');
 } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
