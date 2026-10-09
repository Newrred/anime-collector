import {validateDeclaration} from '../../features/auth/simpleSignup.js';
import {resolveWebOAuthNext} from '../../features/auth/webOAuth.js';
import {createSealer,createGoogleVerifier,randomToken,hash,same,reject} from './security.js';

const FLOW='__Host-moemoa-signup',HANDOFF='__Host-moemoa-signup-session';
function cookie(req,name) {
  const matches=String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(name+'='));
  if(matches.length!==1)reject('SIGNUP_DETAILS_EXPIRED');
  return matches[0].slice(name.length+1);
}
const setCookie=(name,value,maxAge)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const clearCookies=()=>[setCookie(FLOW,'',0),setCookie(HANDOFF,'',0)];
function send(res,status,data) {res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
function redirect(res,path) {res.statusCode=303;res.setHeader('Location',path);res.end();}
async function jsonBody(req) {
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))reject('INVALID_REQUEST');
  if(Number(req.headers['content-length']||0)>4096)reject('INVALID_REQUEST');
  let raw=req.body;
  if(raw===undefined){const chunks=[];let length=0;for await(const c of req){length+=c.length;if(length>4096)reject('INVALID_REQUEST');chunks.push(c);}raw=Buffer.concat(chunks).toString();}
  if(typeof raw==='string'){if(Buffer.byteLength(raw)>4096)reject('INVALID_REQUEST');try{raw=JSON.parse(raw);}catch{reject('INVALID_REQUEST');}}
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Buffer.byteLength(JSON.stringify(raw))>4096)reject('INVALID_REQUEST');
  return raw;
}

export function createSignupHandler({enabled=false,origin,clientId,clientSecret,cookieKey,preview=false,allowedEmailHashes,createBackend,fetchImpl=fetch,now=Date.now,verifyGoogle}) {
  let verifier;
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff');
    const action=new URL(req.url,'https://local.invalid').searchParams.get('action');
    try {
      if(!enabled)return send(res,404,{error:'SIGNUP_DISABLED'});
      const allowlist=String(allowedEmailHashes||'').split(',').map(x=>x.trim()).filter(Boolean);
      if((preview && !allowlist.length)||allowlist.some(x=>!/^([a-f0-9]{64})$/.test(x)))reject();
      const site=new URL(origin);
      if(site.protocol!=='https:'||site.origin!==origin||!clientId||!clientSecret)reject();
      const sealer=createSealer(cookieKey),backend=createBackend();
      if(action==='start'||action==='session') {
        if(req.method!=='POST')return send(res,405,{error:'METHOD_NOT_ALLOWED'});
        if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')reject('INVALID_REQUEST');
        const body=await jsonBody(req);
        if(action==='session') {
          const key=cookie(req,HANDOFF);
          if(!/^[\w-]{43}$/.test(key))reject('SIGNUP_DETAILS_EXPIRED');
          const cipher=await backend.consumeHandoff(hash(key));
          if(!cipher)reject('SIGNUP_DETAILS_EXPIRED');
          const result=sealer.open(cipher,`session:${hash(key)}`);
          if(result.expiresAt<=now())reject('SIGNUP_DETAILS_EXPIRED');
          res.setHeader('Set-Cookie',clearCookies());return send(res,200,result);
        }
        const policy=await backend.policy();
        if(policy.serverAdmission!==true)reject();
        const d=validateDeclaration(body.declaration,policy,now());
        const state=randomToken(),nonce=randomToken();
        const next=resolveWebOAuthNext({rawNext:body.next,origin});
        const sealed=sealer.seal({state,nonce,declaration:d,next,expiresAt:now()+600000},'flow');
        const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.search=new URLSearchParams({client_id:clientId,redirect_uri:`${origin}/api/signup?action=callback`,response_type:'code',
          scope:'openid email profile',state,nonce:hash(nonce),prompt:'select_account'}).toString();
        res.setHeader('Set-Cookie',[setCookie(FLOW,sealed,600),setCookie(HANDOFF,'',0)]);
        return send(res,200,{url:url.toString()});
      }
      if(action!=='callback'||req.method!=='GET')return send(res,404,{error:'NOT_FOUND'});
      const q=new URL(req.url,origin).searchParams,flow=sealer.open(cookie(req,FLOW),'flow');
      if(flow.expiresAt<=now()||q.getAll('state').length!==1||!same(flow.state,q.get('state')))reject('SIGNUP_DETAILS_EXPIRED');
      if(q.has('error'))reject('GOOGLE_CANCELLED');
      if(q.getAll('code').length!==1||!q.get('code')||q.get('code').length>4096)reject('INVALID_REQUEST');
      const policy=await backend.policy();
      if(policy.serverAdmission!==true)reject();
      const d=validateDeclaration(flow.declaration,policy,now());
      const response=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
        headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:q.get('code'),client_id:clientId,
          client_secret:clientSecret,redirect_uri:`${origin}/api/signup?action=callback`,grant_type:'authorization_code'})});
      if(!response.ok)reject('GOOGLE_SIGNIN_FAILED');
      const tokens=await response.json();
      verifier ||= verifyGoogle || createGoogleVerifier({clientId,fetchImpl,now});
      const identity=await verifier(tokens.id_token,flow.nonce,tokens.access_token);
      if(allowlist.length && !allowlist.includes(identity.emailHash))reject();
      const admission=await backend.admit(identity,d);
      let signed;
      try {
        signed=await backend.signIn(tokens.id_token,flow.nonce,tokens.access_token);
        await backend.finalize(admission,signed.userId);
      } catch(error) {
        // The Auth response may be lost after account creation. Keep that account
        // and its transactional receipt, but release this attempt for a fresh login.
        try {await backend.abandon(admission);}catch{/* Expiry remains the fallback. */}
        throw error;
      }
      const key=randomToken(),expiresAt=now()+120000;
      await backend.storeHandoff(hash(key),sealer.seal({session:signed.session,next:flow.next,expiresAt},`session:${hash(key)}`));
      res.setHeader('Set-Cookie',[setCookie(FLOW,'',0),setCookie(HANDOFF,key,120)]);
      return redirect(res,'/auth/complete/');
    } catch(error) {
      // Never echo provider bodies, codes, tokens, cookies, account data or stack traces.
      const safe=['SIGNUP_DETAILS_EXPIRED','COUNTRY_NOT_READY','SIGNUP_POLICY_CHANGED','BELOW_MINIMUM_AGE','GOOGLE_CANCELLED','INVALID_REQUEST'];
      const code=safe.includes(error?.code)?error.code:'SIGNUP_SERVICE_UNAVAILABLE';
      if(action==='callback') {res.setHeader('Set-Cookie',clearCookies());return redirect(res,`/auth/complete/?error=${code}`);}
      return send(res,code==='INVALID_REQUEST'?400:503,{error:code});
    }
  };
}
