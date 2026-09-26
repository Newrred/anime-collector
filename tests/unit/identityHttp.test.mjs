import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createIdentityHandler} from '../../src/server/identity/handler.js';
import {authenticateIdentitySession} from '../../src/server/identity/authenticateIdentitySession.js';
const A='11111111-1111-4111-8111-111111111111',S='22222222-2222-4222-8222-222222222222',R='33333333-3333-4333-8333-333333333333';
async function server(options,run){const s=createServer(createIdentityHandler(options));await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));try{await run(`http://127.0.0.1:${s.address().port}`);}finally{s.closeAllConnections();await new Promise(resolve=>s.close(resolve));}}
const headers={'content-type':'application/json',authorization:'Bearer synthetic-test',origin:'https://allowed.example'};
const request={action:'issue',purpose:'ADULT_IDENTITY'};
test('identity HTTP defaults closed and enforces method, origin, body and bearer before backend',async()=>{
 const createBackend=()=>{throw Error('must not run');};
 await server({createBackend},async url=>assert.equal((await fetch(url)).status,503));
 await server({enabled:true,allowedOrigins:['https://allowed.example'],createBackend},async url=>{
  for(const [init,status] of [[{},405],[{method:'POST',headers:{...headers,origin:'https://other.example'},body:JSON.stringify(request)},403],
   [{method:'POST',headers:{...headers,authorization:''},body:JSON.stringify(request)},401],
   [{method:'POST',headers,body:' '.repeat(1025)},413],
   [{method:'POST',headers,body:JSON.stringify({...request,userId:A})},400],
   [{method:'POST',headers,body:'{broken'},400]])assert.equal((await fetch(url,init)).status,status);
 });
});
test('identity HTTP issues only verified session identity and returns minimal no-store receipt',async()=>{
 let stored;
 await server({enabled:true,allowedOrigins:['https://allowed.example'],createBackend:()=>({authenticate:async()=>({userId:A,sessionId:S}),store:{issue:async args=>{stored=args;return {id:R,...args,status:'PENDING',expiresAt:200,providerRequestId:'not-public',name:'not-public'};}}})},async url=>{
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(request)});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.deepEqual(await r.json(),{requestId:R,purpose:'ADULT_IDENTITY',expiresAt:200});assert.deepEqual(stored,{userId:A,sessionId:S,purpose:'ADULT_IDENTITY'});
 });
});
test('identity auth requires verified claims and matching live user, ignores editable metadata',async()=>{
 const c={sub:A,session_id:S,role:'authenticated',exp:200};const u={id:A,is_anonymous:false,user_metadata:{adult:true}};
 const auth=(claims=c,user=u)=>({getClaims:async()=>({data:{claims}}),getUser:async()=>({data:{user}})});
 assert.deepEqual(await authenticateIdentitySession(auth(),'token',()=>100),{userId:A,sessionId:S});
 for(const [claims,user] of [[{...c,session_id:null},u],[{...c,exp:0},u],[c,{...u,id:R}],[c,{...u,is_anonymous:true}]])await assert.rejects(authenticateIdentitySession(auth(claims,user),'token',()=>100),{code:'AUTH_REQUIRED'});
 await assert.rejects(authenticateIdentitySession({getClaims:async()=>({error:{message:'bad signature'}}),getUser:async()=>({data:{user:u}})},'token'),{code:'AUTH_REQUIRED'});
});
test('identity HTTP sanitizes backend exceptions',async()=>{
 await server({enabled:true,allowedOrigins:['https://allowed.example'],createBackend:()=>{throw Error('private database data');}},async url=>{
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(request)});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'VERIFICATION_UNAVAILABLE'});
 });
});
test('identity HTTP completion invokes core with authenticated session and exposes no access grant',async()=>{
 const record={id:R,userId:A,sessionId:S,purpose:'ADULT_IDENTITY',status:'PENDING',revision:0,expiresAt:200,provider:'synthetic',channel:'c1',policyRevision:'p1',providerRequestId:'server-issued'};
 let commits=0;
 const backend={now:()=>100,authenticate:async()=>({userId:A,sessionId:S}),store:{load:async()=>record,currentPolicy:async()=>({enabled:true,revision:'p1',provider:'synthetic',channel:'c1'}),recordAtomically:async expected=>{
  assert.equal(expected.userId,A);assert.equal(expected.sessionId,S);commits++;record.status='RECORDED';return {requestId:R,status:'RECORDED'};
 }},provider:{lookup:async()=>({status:'VERIFIED',provider:'synthetic',channel:'c1',id:'server-issued',birthDate:'2000-01-01'})}};
 await server({enabled:true,allowedOrigins:['https://allowed.example'],createBackend:()=>backend},async url=>{
  const init={method:'POST',headers,body:JSON.stringify({action:'complete',purpose:'ADULT_IDENTITY',requestId:R})};
  const result=await fetch(url,init);assert.equal(result.status,200);assert.deepEqual(await result.json(),{requestId:R,purpose:'ADULT_IDENTITY',status:'IDENTITY_EVIDENCE_RECORDED'});
  const retry=await fetch(url,init);assert.equal(retry.status,409);assert.equal(commits,1);
 });
});
test('identity status distinguishes pending, expiry, policy change and historical receipt without provider calls',async()=>{
 const r={id:R,userId:A,sessionId:S,purpose:'ADULT_IDENTITY',status:'PENDING',expiresAt:200,provider:'synthetic',channel:'c1',policyRevision:'p1'};
 const policy={enabled:true,revision:'p1',provider:'synthetic',channel:'c1'};let now=100;
 const backend={now:()=>now,authenticate:async()=>({userId:A,sessionId:S}),store:{load:async()=>r,currentPolicy:async()=>policy},provider:{lookup:async()=>assert.fail('status must not call provider')}};
 await server({enabled:true,allowedOrigins:['https://allowed.example'],createBackend:()=>backend},async url=>{
  const status=async()=>{const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({action:'status',purpose:r.purpose,requestId:R})});assert.equal(response.status,200);return response.json();};
  assert.equal((await status()).status,'PENDING');now=200;assert.equal((await status()).status,'EXPIRED');
  now=100;policy.revision='p2';assert.equal((await status()).status,'SUPERSEDED');
  r.status='RECORDED';now=300;assert.deepEqual(await status(),{requestId:R,purpose:'ADULT_IDENTITY',status:'IDENTITY_EVIDENCE_RECORDED'});
 });
});
test('identity status rejects a different owner, session or purpose',async()=>{
 const r={id:R,userId:A,sessionId:S,purpose:'ADULT_IDENTITY',status:'RECORDED',expiresAt:200};
 await server({enabled:true,allowedOrigins:['https://allowed.example'],createBackend:()=>({authenticate:async()=>({userId:A,sessionId:S}),store:{load:async()=>r}})},async url=>{
  for(const [key,value] of [['userId',R],['sessionId',R],['purpose','GUARDIAN_IDENTITY']]) {
   const old=r[key];r[key]=value;
   const response=await fetch(url,{method:'POST',headers,body:JSON.stringify({action:'status',purpose:'ADULT_IDENTITY',requestId:R})});
   assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:'VERIFICATION_NOT_FOUND'});r[key]=old;
  }
 });
});
