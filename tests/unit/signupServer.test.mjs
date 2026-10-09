import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSealer,createGoogleVerifier,hash} from '../../src/server/signup/security.js';
import {createSignupHandler} from '../../src/server/signup/handler.js';

const time=Date.parse('2026-10-09T10:00:00Z'),key='11'.repeat(32),origin='https://signup.example.test';
const policy={enabled:true,serverAdmission:true,version:'simple-signup-2026-10-09',termsVersion:'terms-2026-10-09-draft',privacyVersion:'privacy-2026-10-09-draft',countries:[{country:'KR',minimumAge:14}]};
const declaration={version:1,country:'KR',age:14,declaredOn:'2026-10-09',createdAt:time,accepted:true,policyVersion:policy.version,termsVersion:policy.termsVersion,privacyVersion:policy.privacyVersion};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'key1',alg:'RS256',use:'sig'};
const claims={iss:'https://accounts.google.com',aud:'client',sub:'12345',email:'fixture@example.test',email_verified:true,iat:time/1000,exp:time/1000+300,nonce:hash('nonce')};
function jwt(payload=claims,header={alg:'RS256',kid:'key1'}) {
 const body=[header,payload].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
 return body+'.'+sign('RSA-SHA256',Buffer.from(body),privateKey).toString('base64url');
}
test('authenticated encryption binds purpose and rejects altered bytes and keys',()=>{
 const box=createSealer(key),sealed=box.seal({state:'secret'},'flow');assert.deepEqual(box.open(sealed,'flow'),{state:'secret'});
 assert.throws(()=>box.open(sealed,'session'));assert.throws(()=>createSealer('22'.repeat(32)).open(sealed,'flow'));
 assert.throws(()=>box.open(sealed.slice(0,30)+'A'+sealed.slice(31),'flow'));assert.throws(()=>createSealer('weak'));
});
test('Google verification checks cryptographic signature, nonce, issuer, audience, time and verified identity',async()=>{
 let loads=0;
 const verify=createGoogleVerifier({clientId:'client',now:()=>time,fetchImpl:async url=>{assert.equal(url,'https://www.googleapis.com/oauth2/v3/certs');loads++;return {ok:true,json:async()=>({keys:[jwk]})};}});
 assert.deepEqual(await verify(jwt(),'nonce'),{subject:'12345',emailHash:hash('fixture@example.test')});
 for(const change of [{aud:'other'},{azp:'other'},{iss:'https://attacker.test'},{exp:time/1000},{iat:time/1000+90},{iat:time/1000-601},
  {nonce:hash('different')},{email_verified:false},{sub:''},{at_hash:'forged'},{aud:['client','other']}])await assert.rejects(verify(jwt({...claims,...change}),'nonce'));
 await assert.rejects(verify(jwt(claims,{alg:'HS256',kid:'key1'}),'nonce'));
 const forged=jwt().split('.');forged[1]=Buffer.from(JSON.stringify({...claims,sub:'999'})).toString('base64url');await assert.rejects(verify(forged.join('.'),'nonce'));
 assert.equal(loads,1);
});
function harness(overrides={}) {
 const calls=[],handoffs=new Map();
 const backend={policy:async()=>policy,admit:async()=>{calls.push('admit');return 'admission';},signIn:async()=>{calls.push('signIn');return {userId:'owner',session:{access_token:'private-access',refresh_token:'private-refresh'}};},
 finalize:async()=>{calls.push('finalize');return true;},storeHandoff:async(k,v)=>{calls.push('handoff');handoffs.set(k,v);},consumeHandoff:async k=>{const result=handoffs.get(k);handoffs.delete(k);return result;},...overrides.backend};
 const handler=createSignupHandler({enabled:true,origin,clientId:'client',clientSecret:'server-secret',cookieKey:key,now:()=>time,createBackend:()=>backend,
  fetchImpl:async()=>{calls.push('exchange');return {ok:true,json:async()=>({id_token:'google-token',access_token:'google-access'})};},
  verifyGoogle:async()=>{calls.push('verify');return {subject:'12345',emailHash:hash('fixture@example.test')};},...overrides});
 async function request(action,{method='POST',body={},cookies='',headers={}}={}) {
  const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(b=''){this.body=b;}};
  await handler({url:'/api/signup?action='+action,method,body,headers:{origin,'content-type':'application/json',cookie:cookies,...headers}},res);return res;
 }
 return {request,calls,handoffs};
}
async function start(h) {
 const r=await h.request('start',{body:{declaration,next:'/terms/'}});assert.equal(r.statusCode,200);
 return {cookie:r.headers['Set-Cookie'][0].split(';')[0],state:new URL(JSON.parse(r.body).url).searchParams.get('state'),response:r};
}
test('same-tab flow admits only after verified Google and delivers encrypted one-use session with no tokens in URLs',async()=>{
 const h=harness(),s=await start(h);
 assert.match(s.response.headers['Set-Cookie'][0],/HttpOnly; Secure; SameSite=Lax/);
 assert(!s.response.body.includes('2000-'));assert(!s.cookie.includes('"country":"KR"'));
 const r=await h.request('callback&code=provider-code&state='+s.state,{method:'GET',cookies:s.cookie});
 assert.equal(r.headers.Location,'/auth/complete/');assert.deepEqual(h.calls,['exchange','verify','admit','signIn','finalize','handoff']);
 assert(!JSON.stringify(r).includes('private-access'));assert(![...h.handoffs.values()][0].includes('private-refresh'));
 const cookies=r.headers['Set-Cookie'][1].split(';')[0];
 const complete=await h.request('session',{cookies});assert.equal(JSON.parse(complete.body).session.access_token,'private-access');
 assert.equal(complete.headers['Cache-Control'],'no-store, max-age=0');
 const replay=await h.request('session',{cookies});assert.equal(replay.statusCode,503);assert(!replay.body.includes('private-refresh'));
});
test('CSRF, duplicate state, missing cookie and changed policy stop before OAuth exchange/admission',async()=>{
 const h=harness(),s=await start(h);
 assert.equal((await h.request('start',{body:{declaration},headers:{origin:'https://evil.test'}})).statusCode,400);
 assert.equal((await h.request('start',{body:{declaration:{...declaration,age:13}}})).statusCode,503);
 assert.equal((await h.request('start',{body:{declaration},headers:{'content-type':'text/plain'}})).statusCode,400);
 for(const [q,c] of [['state=wrong',s.cookie],[`state=${s.state}&state=${s.state}`,s.cookie],[`state=${s.state}`,'']]) {
  const r=await h.request(`callback&code=c&${q}`,{method:'GET',cookies:c});assert.match(r.headers.Location,/error=/);
 }
 assert.deepEqual(h.calls,[]);
 const blocked=harness({backend:{policy:async()=>({...policy,serverAdmission:false})}});
 assert.equal((await blocked.request('start',{body:{declaration}})).statusCode,503);
 let clock=time;const expired=harness({now:()=>clock}),se=await start(expired);clock+=600001;
 const er=await expired.request(`callback&state=${se.state}&code=c`,{method:'GET',cookies:se.cookie});
 assert.match(er.headers.Location,/SIGNUP_DETAILS_EXPIRED/);assert.deepEqual(expired.calls,[]);
 const changed=harness({backend:{policy:async()=>({...policy,version:'new-policy'})}});
 const stale=await changed.request(`callback&state=${s.state}&code=c`,{method:'GET',cookies:s.cookie});
 assert.match(stale.headers.Location,/SIGNUP_POLICY_CHANGED/);assert.deepEqual(changed.calls,[]);
});
test('provider cancel, forged identity and backend failures never expose provider payload or issue a handoff',async()=>{
 const h=harness(),s=await start(h);
 const cancel=await h.request(`callback&state=${s.state}&error=access_denied&error_description=private-detail`,{method:'GET',cookies:s.cookie});
 assert.equal(cancel.headers.Location,'/auth/complete/?error=GOOGLE_CANCELLED');assert.deepEqual(h.calls,[]);
 const invalid=harness({verifyGoogle:async()=>{throw new Error('private-token');}}),si=await start(invalid);
 const r=await invalid.request(`callback&state=${si.state}&code=c`,{method:'GET',cookies:si.cookie});
 assert(!JSON.stringify(r).includes('private-token'));assert(!invalid.calls.includes('admit'));assert.equal(invalid.handoffs.size,0);
 const disabled=harness({enabled:false});assert.equal((await disabled.request('start')).statusCode,404);
});
test('ambiguous Auth failure releases only its admission for retry; no handoff is issued',async()=>{
 let abandoned;
 const h=harness({backend:{signIn:async()=>{throw new Error('provider response lost');},abandon:async id=>{abandoned=id;}}}),s=await start(h);
 const r=await h.request(`callback&state=${s.state}&code=c`,{method:'GET',cookies:s.cookie});
 assert.equal(abandoned,'admission');assert.equal(h.handoffs.size,0);assert(!JSON.stringify(r).includes('provider response lost'));
});


test('Preview fails closed without valid account allowlist and rejects other verified Google users before Auth',async()=>{
 for(const allowedEmailHashes of [undefined,'','invalid']) {
  const h=harness({preview:true,allowedEmailHashes});
  assert.equal((await h.request('start',{body:{declaration}})).statusCode,503);
  assert.deepEqual(h.calls,[]);
 }
 const blocked=harness({preview:true,allowedEmailHashes:hash('other@example.test')});
 const s=await start(blocked);
 const r=await blocked.request(`callback&code=c&state=${s.state}`,{method:'GET',cookies:s.cookie});
 assert.match(r.headers.Location,/SIGNUP_SERVICE_UNAVAILABLE/);
 assert.deepEqual(blocked.calls,['exchange','verify']);
 const permitted=harness({preview:true,allowedEmailHashes:hash('fixture@example.test')});
 const a=await start(permitted);
 const ok=await permitted.request(`callback&code=c&state=${a.state}`,{method:'GET',cookies:a.cookie});
 assert.equal(ok.headers.Location,'/auth/complete/');
 assert(permitted.calls.includes('signIn'));
});


test('failure diagnostics expose only fixed phase/action and cannot alter the safe response',async()=>{
 const events=[];const h=harness({observe:e=>events.push(e),backend:{policy:async()=>{throw new Error('private server body');}}});
 const result=await h.request('start',{body:{declaration}});
 assert.equal(result.statusCode,503);
 assert.deepEqual(events,[{phase:'policy-read',action:'start'}]);
 assert(!JSON.stringify(result).includes('private server body'));
 const broken=harness({observe:()=>{throw new Error('logger failed');}});
 assert.equal((await broken.request('start',{headers:{origin:'https://other.test'}})).statusCode,400);
});

test('start tolerates bounded client clock lead without carrying a future timestamp into admission',async()=>{
 for(const lead of [1,1000,60000]) {
  let received;
  const h=harness({backend:{admit:async(_identity,d)=>{received=d;return 'admission';}}});
  const r=await h.request('start',{body:{declaration:{...declaration,createdAt:time+lead}}});
  assert.equal(r.statusCode,200,`client clock lead ${lead}ms`);
  const flow=createSealer(key).open(r.headers['Set-Cookie'][0].split(';')[0].split('=')[1],'flow');
  assert.equal(flow.declaration.createdAt,time);
  assert.equal(flow.expiresAt,time+600000);
  const callback=await h.request(`callback&code=c&state=${flow.state}`,{method:'GET',cookies:r.headers['Set-Cookie'][0].split(';')[0]});
  assert.equal(callback.headers.Location,'/auth/complete/');
  assert.equal(received.createdAt,time);
 }
});

test('clock tolerance preserves stale, excessive future, invalid, age, agreement and policy rejection',async()=>{
 for(const patch of [{createdAt:time+60001},{createdAt:time-1800000},{createdAt:NaN},{createdAt:Infinity},
  {createdAt:String(time)},{createdAt:time+0.5},{createdAt:time+1000,age:13},
  {createdAt:time+1000,accepted:false},{createdAt:time+1000,policyVersion:'old'}]) {
  const h=harness();
  const r=await h.request('start',{body:{declaration:{...declaration,...patch}}});
  assert.equal(r.statusCode,503);assert.equal(r.headers['Set-Cookie'],undefined);assert.deepEqual(h.calls,[]);
 }
 const h=harness();
 const r=await h.request('start',{body:{declaration:{...declaration,createdAt:time-1799999}}});
 assert.equal(r.statusCode,200);
 const flow=createSealer(key).open(r.headers['Set-Cookie'][0].split(';')[0].split('=')[1],'flow');
 assert.equal(flow.declaration.createdAt,time-1799999);
});
