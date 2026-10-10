import test from 'node:test';
import assert from 'node:assert/strict';
import {ageOnDate,createDeclaration,validateDeclaration,signupAvailability,readPendingSignup,writePendingSignup,clearPendingSignup,recordPendingSignup,PENDING_SIGNUP_KEY,PENDING_SIGNUP_TTL,TERMS_VERSION,PRIVACY_VERSION,SIGNUP_POLICY_VERSION} from '../../src/features/auth/simpleSignup.js';
import {resolveWebOAuthNext} from '../../src/features/auth/webOAuth.js';
import {resolveSignupDocuments,needsAgeProcessingConsent,TEST_SIGNUP_POLICY_VERSION,TEST_TERMS_VERSION,TEST_PRIVACY_VERSION} from '../../src/features/auth/signupDocuments.js';
const now=new Date(2026,9,9,12).getTime();
// Synthetic policy fixtures, not enabled countries or a legal eligibility table.
// FR15/DE16 exercise injected exceptions; GDPR consent ages are not signup rules.
const policy={enabled:true,version:SIGNUP_POLICY_VERSION,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION,countries:[{country:'KR',minimumAge:14},{country:'PH',minimumAge:13},{country:'TH',minimumAge:13},{country:'FR',minimumAge:15},{country:'DE',minimumAge:16}]};
const thirteenPlusCountries=['PH','TH','US','GB','FR','DE'];
const thirteenPlusPolicy={...policy,countries:[{country:'KR',minimumAge:14},...thirteenPlusCountries.map(country=>({country,minimumAge:13}))]};
const create=(overrides={})=>createDeclaration({country:'KR',birthDate:'2012-10-09',accepted:true,...overrides},policy,now);
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};

test('new test documents need an exact supported tuple and explicit test mode; old receipts keep their meaning',()=>{
 const candidate={...policy,version:TEST_SIGNUP_POLICY_VERSION,termsVersion:TEST_TERMS_VERSION,privacyVersion:TEST_PRIVACY_VERSION};
 assert.equal(signupAvailability('PH',candidate),'SIGNUP_POLICY_CHANGED');
 assert.equal(signupAvailability('PH',candidate,{allowTestDocuments:true}),null);
 const input={country:'PH',birthDate:'2013-10-09',accepted:true};
 assert.throws(()=>createDeclaration(input,candidate,now),{code:'SIGNUP_POLICY_CHANGED'});
 const declaration=createDeclaration(input,candidate,now,{allowTestDocuments:true});
 assert.equal(declaration.termsVersion,TEST_TERMS_VERSION);
 assert.equal(declaration.privacyVersion,TEST_PRIVACY_VERSION);
 assert.throws(()=>validateDeclaration({...declaration,privacyVersion:PRIVACY_VERSION},candidate,now,{allowTestDocuments:true}),{code:'SIGNUP_POLICY_CHANGED'});
 for(const change of [{version:'unknown'},{privacyVersion:PRIVACY_VERSION},{termsVersion:'https://evil.test/'}]) {
  assert.equal(resolveSignupDocuments({...candidate,...change},{allowTestDocuments:true}),null);
 }
 assert.equal(needsAgeProcessingConsent('PH',resolveSignupDocuments(policy)),false);
 const docs=resolveSignupDocuments(candidate,{allowTestDocuments:true});
 assert.equal(needsAgeProcessingConsent('PH',docs),true);
 assert.equal(needsAgeProcessingConsent('KR',docs),false);
 assert.equal(create().termsVersion,TERMS_VERSION);
});

test('direct receipt continuation keeps the same test document tuple and account pin',async()=>{
 const candidate={...policy,version:TEST_SIGNUP_POLICY_VERSION,termsVersion:TEST_TERMS_VERSION,privacyVersion:TEST_PRIVACY_VERSION};
 const declaration=createDeclaration({country:'PH',birthDate:'2013-10-09',accepted:true},candidate,now,{allowTestDocuments:true});
 const s=storage();writePendingSignup(s,declaration);let received;
 const client={auth:{getUser:async()=>({data:{user:{id:'fixture-a'}}})},rpc:async(name,args)=>{
  if(name==='get_simple_signup_policy')return {data:candidate};received=args;return {data:{recorded:true}};
 }};
 await assert.rejects(recordPendingSignup(client,s,now,'fixture-a'),{code:'SIGNUP_POLICY_CHANGED'});
 await recordPendingSignup(client,s,now,'fixture-a',{allowTestDocuments:true});
 assert.equal(received.p_terms_version,TEST_TERMS_VERSION);assert.equal(received.p_privacy_version,TEST_PRIVACY_VERSION);
 assert.equal(received.p_accept_terms,true);assert.equal(readPendingSignup(s,now),null);
});
test('DOB boundaries use calendar age, including leap days',()=>{
 assert.equal(ageOnDate('2012-10-09','2026-10-09'),14);
 assert.equal(ageOnDate('2012-10-10','2026-10-09'),13);
 assert.equal(ageOnDate('2012-02-29','2026-02-28'),13);
 assert.equal(ageOnDate('2012-02-29','2026-03-01'),14);
 for(const d of ['2012-02-30','2011-02-29','2027-01-01','12-01-01','2012-13-01','1900-01-01','2012-10-09junk'])assert.throws(()=>ageOnDate(d,'2026-10-09'));
});
test('synthetic 13-plus policy is obeyed without inferring signup ages from GDPR consent ages',()=>{
 for(const country of thirteenPlusCountries) {
  assert.equal(signupAvailability(country,thirteenPlusPolicy),null);
  const declaration=createDeclaration({country,birthDate:'2013-10-09',accepted:true},thirteenPlusPolicy,now);
  assert.equal(declaration.age,13,country);
  assert.equal(declaration.country,country);
  assert.throws(()=>createDeclaration({country,birthDate:'2014-10-09',accepted:true},thirteenPlusPolicy,now),{code:'BELOW_MINIMUM_AGE'});
  assert.throws(()=>validateDeclaration({...declaration,age:12},thirteenPlusPolicy,now),{code:'BELOW_MINIMUM_AGE'});
 }
 assert.equal(createDeclaration({country:'KR',birthDate:'2012-10-09',accepted:true},thirteenPlusPolicy,now).age,14);
 assert.throws(()=>createDeclaration({country:'KR',birthDate:'2013-10-09',accepted:true},thirteenPlusPolicy,now),{code:'BELOW_MINIMUM_AGE'});
});
test('synthetic higher regional exceptions are enforced only when supplied by policy',()=>{
 assert.equal(create().age,14);
 assert.throws(()=>create({birthDate:'2012-10-10'}),{code:'BELOW_MINIMUM_AGE'});
 for(const [country,year] of [['FR',2011],['DE',2010]]) {
  assert.equal(create({country,birthDate:`${year}-10-09`}).country,country);
  assert.throws(()=>create({country,birthDate:`${year}-10-10`}),{code:'BELOW_MINIMUM_AGE'});
  assert.throws(()=>create({country,birthDate:'2013-10-09'}),{code:'BELOW_MINIMUM_AGE'});
 }
});
test('a supported country missing from the synthetic policy never inherits a 13-plus fallback',()=>{
 const missingCountryPolicy={...thirteenPlusPolicy,countries:thirteenPlusPolicy.countries.filter(row=>row.country!=='FR')};
 assert.equal(signupAvailability('FR',missingCountryPolicy),'COUNTRY_NOT_READY');
 assert.throws(()=>createDeclaration({country:'FR',birthDate:'2000-10-09',accepted:true},missingCountryPolicy,now),{code:'COUNTRY_NOT_READY'});
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
