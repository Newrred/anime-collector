import { completeIdentityEvidence, IdentityEvidenceError } from './completeIdentityEvidence.js';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const codes=new Set(['AUTH_REQUIRED','VERIFICATION_NOT_FOUND','VERIFICATION_EXPIRED','VERIFICATION_PURPOSE_MISMATCH',
  'VERIFICATION_NOT_PENDING','VERIFICATION_POLICY_CHANGED','VERIFICATION_REQUEST_CHANGED','VERIFICATION_RATE_LIMITED',
  'VERIFICATION_PROVIDER_UNAVAILABLE','VERIFICATION_STORE_UNAVAILABLE','VERIFICATION_RESULT_MISMATCH']);
const reject=code=>{throw new IdentityEvidenceError(code);};
async function bodyOf(req) {
  if(Number(req.headers['content-length'])>1024)reject('REQUEST_TOO_LARGE');
  let raw=req.body;
  if(raw===undefined) {
    const chunks=[];let size=0;
    for await(const chunk of req) {size+=Buffer.byteLength(chunk);if(size>1024)reject('REQUEST_TOO_LARGE');chunks.push(Buffer.from(chunk));}
    raw=Buffer.concat(chunks).toString('utf8');
  }
  if(Buffer.isBuffer(raw))raw=raw.toString('utf8');
  if(typeof raw!=='string')raw=JSON.stringify(raw);
  if(!raw||Buffer.byteLength(raw)>1024)reject('REQUEST_TOO_LARGE');
  let value;try{value=JSON.parse(raw);}catch{reject('INVALID_REQUEST');}
  if(!value||typeof value!=='object'||Array.isArray(value))reject('INVALID_REQUEST');
  return value;
}
// No public deployment route until provider and persistent migration are ready.
export function createIdentityHandler({enabled=false,allowedOrigins=[],createBackend}) {
  return async(req,res)=>{
    for(const key of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])res.setHeader(key,'no-store');
    res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
    const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
    try {
      if(!enabled)return send(503,{error:'VERIFICATION_DISABLED'});
      if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'METHOD_NOT_ALLOWED'});}
      if(req.headers.origin&&!allowedOrigins.includes(req.headers.origin))return send(403,{error:'ORIGIN_NOT_ALLOWED'});
      if(req.headers.origin)res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
      if(req.headers['content-type']?.split(';')[0]!=='application/json')return send(415,{error:'INVALID_CONTENT_TYPE'});
      const token=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];
      if(!token||token.length>8192)reject('AUTH_REQUIRED');
      const body=await bodyOf(req);
      if(!['issue','complete','status'].includes(body.action)||!['ADULT_IDENTITY','GUARDIAN_IDENTITY'].includes(body.purpose)
        ||Object.keys(body).some(key=>!(body.action==='issue'?['action','purpose']:['action','purpose','requestId']).includes(key))
        ||(body.action!=='issue'&&!UUID.test(body.requestId||'')))reject('INVALID_REQUEST');
      const backend=createBackend();
      const session=await backend.authenticate(token);
      if(!UUID.test(session?.userId||'')||!UUID.test(session?.sessionId||''))reject('AUTH_REQUIRED');
      if(body.action==='status') {
        const context={...session,purpose:body.purpose,requestId:body.requestId};
        const r=await backend.store.load(context);
        if(!r||r.id!==body.requestId||r.userId!==session.userId||r.sessionId!==session.sessionId||r.purpose!==body.purpose)reject('VERIFICATION_NOT_FOUND');
        if(!['PENDING','RECORDED'].includes(r.status)||!Number.isSafeInteger(r.expiresAt))throw new Error('invalid request state');
        let status='IDENTITY_EVIDENCE_RECORDED';
        if(r.status==='PENDING') {
          const policy=await backend.store.currentPolicy(context);
          status=(backend.now?.()??Date.now())>=r.expiresAt?'EXPIRED'
            :!policy?.enabled||policy.revision!==r.policyRevision||policy.provider!==r.provider||policy.channel!==r.channel?'SUPERSEDED':'PENDING';
        }
        // Historical completion only. Never return an adult/guardian access grant.
        return send(200,{requestId:r.id,purpose:r.purpose,status});
      }
      if(body.action==='issue') {
        const r=await backend.store.issue({...session,purpose:body.purpose});
        if(!r||!UUID.test(r.id||'')||r.userId!==session.userId||r.sessionId!==session.sessionId||r.purpose!==body.purpose||r.status!=='PENDING'||!Number.isSafeInteger(r.expiresAt))throw new Error('invalid store receipt');
        return send(200,{requestId:r.id,purpose:r.purpose,expiresAt:r.expiresAt});
      }
      return send(200,await completeIdentityEvidence({session,requestId:body.requestId,purpose:body.purpose},backend));
    } catch(error) {
      const code=error instanceof IdentityEvidenceError?error.code:null;
      if(code==='REQUEST_TOO_LARGE')return send(413,{error:code});
      if(code==='INVALID_REQUEST')return send(400,{error:code});
      if(code==='AUTH_REQUIRED')return send(401,{error:code});
      if(codes.has(code))return send(code==='VERIFICATION_RATE_LIMITED'?429:code.endsWith('UNAVAILABLE')?503:409,{error:code});
      return send(503,{error:'VERIFICATION_UNAVAILABLE'});
    }
  };
}
