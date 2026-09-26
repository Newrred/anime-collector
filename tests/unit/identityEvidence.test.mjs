import test from 'node:test';
import assert from 'node:assert/strict';
import { completeIdentityEvidence, IdentityEvidenceError } from '../../src/server/identity/completeIdentityEvidence.js';
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', ID='33333333-3333-4333-8333-333333333333';
function setup() {
  const state={time:100,lookups:0,records:0,policy:'p1',session:true};
  const request={id:ID,userId:A,sessionId:ID,purpose:'ADULT_IDENTITY',revision:0,status:'PENDING',expiresAt:200,provider:'synthetic',channel:'c1',policyRevision:'p1',providerRequestId:'server-issued-random-id'};
  const result={status:'VERIFIED',id:request.providerRequestId,provider:'synthetic',channel:'c1',name:'must not escape',birthDate:'2000-01-01',ci:'never-persist'};
  const input={session:{userId:A,sessionId:ID},requestId:ID,purpose:'ADULT_IDENTITY'};
  const deps={now:()=>state.time,store:{load:async()=>({...request}),currentPolicy:async()=>({enabled:true,revision:state.policy,provider:'synthetic',channel:'c1'}),recordAtomically:async expected=>{
    if (!state.session || state.time>=request.expiresAt || state.policy!==expected.policyRevision || request.status!=='PENDING' || request.revision!==expected.revision) throw new IdentityEvidenceError('VERIFICATION_COMMIT_REJECTED');
    assert.deepEqual(Object.keys(expected).sort(),['channel','expiresAt','policyRevision','provider','providerRequestId','purpose','requestId','revision','sessionId','userId'].sort());
    request.status='RECORDED';state.records++;return {requestId:ID,status:'RECORDED'};
  }},provider:{lookup:async()=>{state.lookups++;return result;}}};
  return {state,request,result,input,deps,run:()=>completeIdentityEvidence(input,deps)};
}
test('verified identity receipt contains no personal facts or access grant and cannot replay',async()=>{
  const x=setup();assert.deepEqual(await x.run(),{requestId:ID,purpose:'ADULT_IDENTITY',status:'IDENTITY_EVIDENCE_RECORDED'});
  await assert.rejects(x.run(),{code:'VERIFICATION_NOT_PENDING'});assert.equal(x.state.records,1);
});
test('other account, wrong purpose and expired request never reach provider',async()=>{
  for (const [change,code] of [[x=>x.input.session.userId=B,'VERIFICATION_NOT_FOUND'],[x=>x.input.purpose='GUARDIAN_IDENTITY','VERIFICATION_PURPOSE_MISMATCH'],[x=>x.state.time=200,'VERIFICATION_EXPIRED']]) {
    const x=setup();change(x);await assert.rejects(x.run(),{code});assert.equal(x.state.lookups,0);
  }
});
test('provider request and channel mismatch never record',async()=>{
  for(const key of ['id','channel','provider','status']) {const x=setup();x.result[key]='wrong';await assert.rejects(x.run(),{code:'VERIFICATION_RESULT_MISMATCH'});assert.equal(x.state.records,0);}
});
test('same user in another session is rejected before provider lookup',async()=>{
  const x=setup();x.input.session.sessionId=B;await assert.rejects(x.run(),{code:'VERIFICATION_NOT_FOUND'});assert.equal(x.state.lookups,0);
});
test('provider exception is sanitized',async()=>{
  const x=setup();x.deps.provider.lookup=async()=>{throw new Error('raw personal data');};await assert.rejects(x.run(),{code:'VERIFICATION_PROVIDER_UNAVAILABLE'});
});
test('expiry, policy change and logout during provider lookup prevent recording',async()=>{
  for(const change of [x=>x.state.time=200,x=>x.state.policy='p2',x=>x.state.session=false]) {
    const x=setup();x.deps.provider.lookup=async()=>{change(x);return x.result;};await assert.rejects(x.run());assert.equal(x.state.records,0);
  }
});
test('concurrent completion consumes one request using atomic store contract',async()=>{
  const x=setup();const results=await Promise.allSettled([x.run(),x.run()]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(x.state.records,1);
});
