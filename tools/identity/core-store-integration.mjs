import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { completeIdentityEvidence } from '../../src/server/identity/completeIdentityEvidence.js';
import { createIdentityStore } from '../../src/server/identity/supabaseIdentityStore.js';
const [socket,psql] = process.argv.slice(2);
assert.match(socket??'',/^\/tmp\/moemoa-identity-test\.[A-Za-z0-9]+$/);
assert.match(psql??'',/^\/usr\/lib\/postgresql\/\d+\/bin\/psql$/);
const quote=value=>`'${(typeof value==='object'?JSON.stringify(value):String(value)).replaceAll("'","''")}'`;
function query(sql) {
 const r=spawnSync('wsl.exe',['-u','postgres','-e',psql,'-h',socket,'-p','55439','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:15000,windowsHide:true});
 if(r.error)throw r.error;
 if(r.status!==0)throw new Error(r.stderr.match(/ERROR:\s+([A-Z_]+)/)?.[1]??'SQL_FAILED');
 return r.stdout.trim();
}
const allowed=new Set(['issue_memory_identity_request','get_memory_identity_request','get_memory_identity_policy','complete_memory_identity_request']);
const store=createIdentityStore({async rpc(name,args){
 assert.ok(allowed.has(name));for(const key of Object.keys(args))assert.match(key,/^p_[a-z_]+$/);
 try{return {data:JSON.parse(query(`set role service_role; select coalesce(public.${name}(${Object.entries(args).map(([k,v])=>`${k}=>${quote(v)}`).join(',')}),'null'::jsonb);`)),error:null};}
 catch(error){return {data:null,error:{message:error.message}};}
}});
const userId='11111111-1111-4111-8111-111111111111',sessionId='33333333-3333-4333-8333-333333333333',otherSession='44444444-4444-4444-8444-444444444444';
query(`update private.memory_identity_policies set daily_limit=10; insert into auth.sessions values(${quote(otherSession)},${quote(userId)},null);`);
const context={userId,sessionId,purpose:'ADULT_IDENTITY'};
const request=await store.issue(context);
assert.equal(request.userId,userId);assert.equal((await store.load({...context,requestId:request.id})).providerRequestId,request.providerRequestId);
let lookups=0;
const provider={async lookup(value){lookups++;return {...value,status:'VERIFIED'};}};
const input={session:{userId,sessionId},requestId:request.id,purpose:context.purpose};
await assert.rejects(completeIdentityEvidence({...input,session:{userId,sessionId:otherSession}},{store,provider}),{code:'VERIFICATION_NOT_FOUND'});
assert.equal(lookups,0);
console.log('PASS: real store rejects another session before provider lookup');
const receipt=await completeIdentityEvidence(input,{store,provider});
assert.equal(receipt.status,'IDENTITY_EVIDENCE_RECORDED');
assert.equal(query(`select status||':'||revision from private.memory_identity_requests where id=${quote(request.id)}`),'RECORDED:1');
console.log('PASS: server core and real store complete exact issued request');
await assert.rejects(completeIdentityEvidence(input,{store,provider}),{code:'VERIFICATION_NOT_PENDING'});
console.log('PASS: core reload observes consumed request and prevents replay');
const guardian=await store.issue({...context,purpose:'GUARDIAN_IDENTITY'});
await assert.rejects(completeIdentityEvidence({...input,requestId:guardian.id,purpose:'GUARDIAN_IDENTITY'},{store,provider:{async lookup(value){
 query("update private.memory_identity_policies set revision='CHANGED' where purpose='GUARDIAN_IDENTITY'");return {...value,status:'VERIFIED'};
}}}),{code:'VERIFICATION_POLICY_CHANGED'});
assert.equal(query(`select status from private.memory_identity_requests where id=${quote(guardian.id)}`),'PENDING');
console.log('PASS: database policy change during provider lookup prevents evidence recording');
const {runIdentityHttpDatabase}=await import('./http-store-integration.mjs');
await runIdentityHttpDatabase({store,query,userId,sessionId});
