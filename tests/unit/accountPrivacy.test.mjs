import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchOwnSignupReceipts,requestAccountDeletion,finishDeletedAccountSession,verifyAccountStillExists} from '../../src/features/auth/accountPrivacy.js';
const owner='fixture-owner', session={user:{id:owner},access_token:'private-session-token'};
const client=(patch={})=>({auth:{getSession:async()=>({data:{session}}),...patch}});

test('deletion requires explicit confirmation and pins the current account before sending',async()=>{
 let sent=0;const fetchImpl=async(url,options)=>{
  sent++;assert.equal(url,'/api/account-delete');assert.equal(options.method,'POST');
  assert.equal(options.headers.Authorization,'Bearer private-session-token');
  assert.deepEqual(JSON.parse(options.body),{expectedUserId:owner,confirmed:true});
  return {ok:true,json:async()=>({deleted:true})};
 };
 assert.deepEqual(await requestAccountDeletion(client(),owner,{confirmed:true,fetchImpl}),{deleted:true});
 await assert.rejects(requestAccountDeletion(client(),owner,{fetchImpl}),{code:'CONFIRMATION_REQUIRED'});
 await assert.rejects(requestAccountDeletion(client(),'other',{confirmed:true,fetchImpl}),{code:'ACCOUNT_CHANGED'});
 await assert.rejects(requestAccountDeletion(client({getSession:async()=>({data:{session:{...session,user:{id:owner,is_anonymous:true}}}})}),owner,{confirmed:true,fetchImpl}),{code:'AUTH_REQUIRED'});
 assert.equal(sent,1);
});

test('unknown, ambiguous and provider failures never become deletion success or leak errors',async()=>{
 for(const fetchImpl of [async()=>{throw Error('private provider data');},async()=>({ok:true,json:async()=>({})}),
   async()=>({ok:false,json:async()=>({error:'private provider data'})})]) {
  await assert.rejects(requestAccountDeletion(client(),owner,{confirmed:true,fetchImpl}),{code:'ACCOUNT_DELETE_UNCONFIRMED'});
 }
 await assert.rejects(requestAccountDeletion(client(),owner,{confirmed:true,fetchImpl:async()=>({ok:false,json:async()=>({error:'ACCOUNT_DELETE_DISABLED'})})}),{code:'ACCOUNT_DELETE_DISABLED'});
});

test('receipt reads are own-account scoped before and after RPC and discard unrelated fields',async()=>{
 const c=client();c.rpc=async(name,...args)=>{
  assert.equal(name,'get_my_simple_signup_receipts');assert.equal(args.length,0);
  return {data:{receipts:[{policyVersion:'p',termsVersion:'t',privacyVersion:'n',country:'PH',recordedAt:'2026-10-10',age:13,privateNote:'not for UI'}]}};
 };
 const rows=await fetchOwnSignupReceipts(c,owner);
 assert.deepEqual(rows,[{policyVersion:'p',termsVersion:'t',privacyVersion:'n',country:'PH',recordedAt:'2026-10-10'}]);
 let calls=0;
 const switched={...c,auth:{getSession:async()=>({data:{session:++calls===1?session:{...session,user:{id:'other'}}}})}};
 await assert.rejects(fetchOwnSignupReceipts(switched,owner),{code:'ACCOUNT_CHANGED'});
 await assert.rejects(fetchOwnSignupReceipts({...c,rpc:async()=>({error:{message:'secret'}})},owner),{code:'RECEIPTS_UNAVAILABLE'});
});

test('finishing confirmed deletion signs out only that session, leaves other owners alone and reports logout failure',async()=>{
 const scopes=[];const c=client({signOut:async options=>{scopes.push(options);return {};}});
 assert.deepEqual(await finishDeletedAccountSession(c,owner),{signedOut:true});
 assert.deepEqual(scopes,[{scope:'local'}]);
 assert.deepEqual(await finishDeletedAccountSession(c,'other'),{signedOut:false});
 assert.equal(scopes.length,1);
 assert.deepEqual(await finishDeletedAccountSession(client({getSession:async()=>({data:{session:null}})}),owner),{signedOut:true});
 await assert.rejects(finishDeletedAccountSession(client({signOut:async()=>({error:{message:'provider secret'}})}),owner),{code:'ACCOUNT_LOGOUT_FAILED'});
});

test('resuming after uncertain deletion requires the live owner and rechecks the local session',async()=>{
 const c=client({getUser:async token=>{assert.equal(token,session.access_token);return {data:{user:{id:owner}}};}});
 await verifyAccountStillExists(c,owner);
 await assert.rejects(verifyAccountStillExists(client({getUser:async()=>({error:{message:'not found'}})}),owner),{code:'AUTH_REQUIRED'});
 let reads=0;
 await assert.rejects(verifyAccountStillExists(client({getUser:c.auth.getUser,getSession:async()=>({data:{session:++reads===1?session:{...session,user:{id:'other'}}}})}),owner),{code:'ACCOUNT_CHANGED'});
});
