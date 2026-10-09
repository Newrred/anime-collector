import {createCipheriv,createDecipheriv,createHash,createPublicKey,randomBytes,timingSafeEqual,verify} from 'node:crypto';

export const reject = (code='SIGNUP_SERVICE_UNAVAILABLE') => { throw Object.assign(new Error(code),{code}); };
export const randomToken = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function same(a,b) {
  return typeof a==='string' && typeof b==='string' && a.length===b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
export function createSealer(secret) {
  if(typeof secret!=='string'||!/^[a-f0-9]{64}$/i.test(secret)) reject();
  const key=Buffer.from(secret,'hex');
  return {
    seal(value,purpose) {
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(Buffer.from(purpose));
      const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
      return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64url');
    },
    open(value,purpose) {
      try {
        if(typeof value!=='string'||value.length>24000||!/^[\w-]+$/.test(value)) reject();
        const bytes=Buffer.from(value,'base64url');
        const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
        decipher.setAAD(Buffer.from(purpose));decipher.setAuthTag(bytes.subarray(12,28));
        return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
      } catch { reject('SIGNUP_DETAILS_EXPIRED'); }
    },
  };
}

// Only Google's fixed JWKS endpoint is consulted; token jku/x5u URLs are never followed.
export function createGoogleVerifier({clientId,fetchImpl=fetch,now=Date.now}) {
  let cache=null,until=0,refresh=null;
  async function keys() {
    if(cache && until>now())return cache;
    if(!refresh)refresh=(async()=>{
      const response=await fetchImpl('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok)reject();
      const data=await response.json();
      if(!Array.isArray(data.keys)||data.keys.length>20)reject();
      cache=data.keys;until=now()+300000;return cache;
    })().finally(()=>{refresh=null;});
    return refresh;
  }
  return async (token,nonce,accessToken) => {
    try {
      if(typeof token!=='string'||token.length>16000)reject();
      const parts=token.split('.');
      if(parts.length!==3||parts.some(x=>!x||!/^[\w-]+$/.test(x)))reject();
      const header=JSON.parse(Buffer.from(parts[0],'base64url').toString());
      if(header.alg!=='RS256'||typeof header.kid!=='string'||header.crit)reject();
      const jwk=(await keys()).find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig')&&(!k.alg||k.alg==='RS256'));
      if(!jwk||!verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))reject();
      const c=JSON.parse(Buffer.from(parts[1],'base64url').toString()), seconds=Math.floor(now()/1000);
      if(!['accounts.google.com','https://accounts.google.com'].includes(c.iss)||c.aud!==clientId||(c.azp&&c.azp!==clientId)
        || !Number.isSafeInteger(c.exp)||c.exp<=seconds||!Number.isSafeInteger(c.iat)||c.iat>seconds+60||c.iat<seconds-600
        || !same(c.nonce,hash(nonce))||c.email_verified!==true||typeof c.sub!=='string'||!/^\d{1,255}$/.test(c.sub)
        ||typeof c.email!=='string'||c.email.length>320||!c.email.includes('@'))reject();
      if(c.at_hash && (!accessToken || !same(c.at_hash,createHash('sha256').update(accessToken).digest().subarray(0,16).toString('base64url'))))reject();
      return {subject:c.sub,emailHash:hash(c.email.trim().toLowerCase())};
    } catch { reject('GOOGLE_IDENTITY_INVALID'); }
  };
}
