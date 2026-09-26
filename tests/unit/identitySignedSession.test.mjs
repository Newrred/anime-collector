import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { generateKeyPairSync, sign, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticateIdentitySession } from '../../src/server/identity/authenticateIdentitySession.js';

test('identity session uses SDK signature verification against a local JWKS endpoint', async () => {
  const userId=randomUUID(), sessionId=randomUUID(), kid=randomUUID();
  const trusted=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const attacker=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const jwk={...trusted.publicKey.export({format:'jwk'}),kid,alg:'ES256',use:'sig'};
  let user={id:userId,is_anonymous:false}, rejectUser=false, jwksReads=0, userReads=0;
  const server=createServer((req,res)=>{
    res.setHeader('content-type','application/json');
    if(req.url==='/auth/v1/.well-known/jwks.json') {
      jwksReads++;res.end(JSON.stringify({keys:[jwk]}));return;
    }
    if(req.url==='/auth/v1/user') {
      userReads++;
      // Deliberately accepts even tampered tokens: signature rejection must come from the SDK.
      res.statusCode=rejectUser?401:200;
      res.end(JSON.stringify(rejectUser?{code:'bad_jwt',message:'Rejected fixture'}:user));return;
    }
    res.statusCode=404;res.end('{}');
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}`;
  const client=createClient(url,'synthetic-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:randomUUID()}});
  const claims={iss:`${url}/auth/v1`,aud:'authenticated',sub:userId,session_id:sessionId,role:'authenticated',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300};
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=(payload=claims,key=trusted.privateKey)=>{
    const input=`${encode({alg:'ES256',typ:'JWT',kid})}.${encode(payload)}`;
    return `${input}.${sign('sha256',Buffer.from(input),{key,dsaEncoding:'ieee-p1363'}).toString('base64url')}`;
  };
  try {
    const valid=token();
    assert.deepEqual(await authenticateIdentitySession(client.auth,valid),{userId,sessionId});
    assert.equal(jwksReads,1);assert.equal(userReads,1);
    await assert.rejects(authenticateIdentitySession(client.auth,token(claims,attacker.privateKey)),{code:'AUTH_REQUIRED'});
    const parts=valid.split('.');parts[1]=encode({...claims,session_id:randomUUID()});
    await assert.rejects(authenticateIdentitySession(client.auth,parts.join('.')),{code:'AUTH_REQUIRED'});
    await assert.rejects(authenticateIdentitySession(client.auth,token({...claims,exp:Math.floor(Date.now()/1000)-60})),{code:'AUTH_REQUIRED'});
    user={...user,id:randomUUID()};
    await assert.rejects(authenticateIdentitySession(client.auth,valid),{code:'AUTH_REQUIRED'});
    user={id:userId,is_anonymous:true};
    await assert.rejects(authenticateIdentitySession(client.auth,valid),{code:'AUTH_REQUIRED'});
    user={id:userId,is_anonymous:false};rejectUser=true;
    await assert.rejects(authenticateIdentitySession(client.auth,valid),{code:'AUTH_REQUIRED'});
    assert.equal(jwksReads,1,'cached key must not bypass live user rejection');
  } finally {
    client.auth.stopAutoRefresh();
    await new Promise(resolve=>server.close(resolve));
  }
});
