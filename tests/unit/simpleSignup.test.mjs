import test from 'node:test';
import assert from 'node:assert/strict';
import {ageOnDate,createDeclaration,validateDeclaration,readPendingSignup,writePendingSignup,clearPendingSignup,recordPendingSignup,PENDING_SIGNUP_KEY,PENDING_SIGNUP_TTL,TERMS_VERSION,PRIVACY_VERSION,SIGNUP_POLICY_VERSION} from '../../src/features/auth/simpleSignup.js';
import {resolveWebOAuthNext} from '../../src/features/auth/webOAuth.js';
const now=new Date(2026,9,9,12).getTime();
const policy={enabled:true,version:SIGNUP_POLICY_VERSION,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION,countries:[{country:'KR',minimumAge:14},{country:'PH',minimumAge:13},{country:'TH',minimumAge:13},{country:'FR',minimumAge:15},{country:'DE',minimumAge:16}]};
const create=(overrides={})=>createDeclaration({country:'KR',birthDate:'2012-10-09',accepted:true,...overrides},policy,now);
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('DOB boundaries use calendar age, including leap days',()=>{
 assert.equal(ageOnDate('2012-10-09','2026-10-09'),14);
 assert.equal(ageOnDate('2012-10-10','2026-10-09'),13);
 assert.equal(ageOnDate('2012-02-29','2026-02-28'),13);
 assert.equal(ageOnDate('2012-02-29','2026-03-01'),14);
 for(const d of ['2012-02-30','2011-02-29','2027-01-01','12-01-01','2012-13-01','1900-01-01','2012-10-09junk'])assert.throws(()=>ageOnDate(d,'2026-10-09'));
});
test('KR14 PH13 TH13 and injected regional thresholds are enforced',()=>{
 assert.equal(create().age,14);
 assert.throws(()=>create({birthDate:'2012-10-10'}),{code:'BELOW_MINIMUM_AGE'});
 for(const country of ['PH','TH'])assert.equal(create({country,birthDate:'2013-10-09'}).age,13);
 for(const [country,year] of [['FR',2011],['DE',2010]]) {
  assert.equal(create({country,birthDate:`${year}-10-09`}).country,country);
  assert.throws(()=>create({country,birthDate:`${year}-10-10`}),{code:'BELOW_MINIMUM_AGE'});
 }
});
test('unknown country, missing agreement and changed policy stop OAuth',()=>{
 assert.throws(()=>create({country:'ZZ'}));
 assert.throws(()=>create({country:'CH'}),{code:'COUNTRY_NOT_READY'});
 assert.throws(()=>create({accepted:false}),{code:'TERMS_REQUIRED'});
 assert.throws(()=>validateDeclaration(create(),{...policy,version:'new'},now),{code:'SIGNUP_POLICY_CHANGED'});
 assert.throws(()=>validateDeclaration(create(),{...policy,enabled:false},now),{code:'COUNTRY_NOT_READY'});
});
test('pending declaration excludes DOB and expires after 30 minutes',()=>{
 const s=storage(),v=create();writePendingSignup(s,v);
 assert.ok(!s.getItem(PENDING_SIGNUP_KEY).includes('2012-10-09'));
 assert.equal(readPendingSignup(s,now).age,14);
 assert.equal(readPendingSignup(s,now+PENDING_SIGNUP_TTL),null);
 assert.equal(s.getItem(PENDING_SIGNUP_KEY),null);
 assert.throws(()=>validateDeclaration({...v,createdAt:now+1},policy,now));
 assert.throws(()=>validateDeclaration({...v,age:13.5},policy,now));
 assert.throws(()=>writePendingSignup({setItem(){throw Error();}},v),{code:'SIGNUP_STORAGE_UNAVAILABLE'});
});
test('receipt success clears pending; failed write keeps retry data',async()=>{
 const s=storage();writePendingSignup(s,create());let calls=[];
 const auth={getUser:async()=>({data:{user:{id:'fixture-a'}}})};
 const client={auth,rpc:async(name,args)=>{calls.push([name,args]);return {data:name==='get_simple_signup_policy'?policy:{recorded:true},error:null};}};
 assert.equal((await recordPendingSignup(client,s,now)).recorded,true);
 assert.equal(s.getItem(PENDING_SIGNUP_KEY),null);
 assert.equal(calls[1][1].p_declared_age,14);
 assert.ok(!JSON.stringify(calls).includes('2012-10-09'));
 writePendingSignup(s,create());
 await assert.rejects(recordPendingSignup({auth,rpc:async name=>name==='get_simple_signup_policy'?{data:policy}:{error:{message:'raw secret'}}},s,now),{code:'SIGNUP_RECEIPT_FAILED'});
 assert.equal(readPendingSignup(s,now).country,'KR');
 await assert.rejects(recordPendingSignup({...client,auth:{getUser:async()=>({data:{user:{id:'fixture-b'}}})}},s,now),{code:'SIGNUP_ACCOUNT_CHANGED'});
 clearPendingSignup(s);assert.equal(readPendingSignup(s,now),null);
});
test('signup redirects reject recursive, encoded and cross-origin targets',()=>{
 for(const rawNext of ['/auth/start/?next=/auth/start/','/auth/%73tart/','https://evil.test/']) assert.equal(resolveWebOAuthNext({rawNext,origin:'https://moemoa.xyz'}),'/data/');
 assert.equal(resolveWebOAuthNext({rawNext:'/archive/',origin:'https://moemoa.xyz'}),'/archive/');
});
