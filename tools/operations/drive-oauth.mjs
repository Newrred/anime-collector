// One-shot operator setup. No credentials are logged or written to disk.
import {createServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {DRIVE_SCOPE} from './drive-backup.mjs';
export const DRIVE_REDIRECT='http://127.0.0.1:4387/oauth/callback';
const bad=code=>{throw Error(code);};
export function createDriveAuthorization({client,expectedClientId,request=fetch,now=Date.now,pickerFileIds=[]}){
 if(!client||client.client_id!==expectedClientId||!expectedClientId?.endsWith('.apps.googleusercontent.com')||!client.client_secret||!client.redirect_uris?.includes(DRIVE_REDIRECT))bad('DRIVE_CLIENT_INVALID');
 if(!Array.isArray(pickerFileIds)||pickerFileIds.length>8||pickerFileIds.some(id=>!/^[-_a-zA-Z0-9]{10,200}$/.test(id)))bad('DRIVE_PICKER_IDS_INVALID');
 const secret=client.client_secret;
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 const expires=now()+15*60*1000;
 let status='WAITING',result;
 const authorization=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 authorization.search=new URLSearchParams({client_id:expectedClientId,redirect_uri:DRIVE_REDIRECT,response_type:'code',scope:DRIVE_SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'false',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 if(pickerFileIds.length){authorization.searchParams.set('trigger_onepick','true');authorization.searchParams.set('allow_multiple','true');authorization.searchParams.set('allow_folder_selection','true');authorization.searchParams.set('file_ids',pickerFileIds.join(','));}
 return {
  authorizationUrl:authorization.href,
  status:()=>status,
  takeResult(){if(status!=='AUTHORIZED'||!result)bad('DRIVE_AUTH_NOT_READY');const r=result;result=undefined;status='CONSUMED';return r;},
  async accept(url){
   if(status!=='WAITING')bad('DRIVE_CALLBACK_REUSED');
   if(now()>expires){status='EXPIRED';bad('DRIVE_CALLBACK_EXPIRED');}
   const u=new URL(url,DRIVE_REDIRECT);
   if(u.origin!==new URL(DRIVE_REDIRECT).origin||u.pathname!=='/oauth/callback')bad('DRIVE_CALLBACK_INVALID');
   const s=u.searchParams.getAll('state');
   if(s.length!==1||Buffer.byteLength(s[0])!==Buffer.byteLength(state)||!timingSafeEqual(Buffer.from(s[0]),Buffer.from(state)))bad('DRIVE_STATE_INVALID');
   if(u.searchParams.has('error')){status='DENIED';bad('DRIVE_CONSENT_DENIED');}
   const codes=u.searchParams.getAll('code');
   if(codes.length!==1||!codes[0]||codes[0].length>4096)bad('DRIVE_CODE_INVALID');
   const picked=u.searchParams.get('picked_file_ids')?.split(',').filter(Boolean)??[];
   if(pickerFileIds.length&&(new Set(picked).size!==pickerFileIds.length||picked.length!==pickerFileIds.length||picked.some(id=>!pickerFileIds.includes(id))))bad('DRIVE_PICKER_SELECTION_INCOMPLETE');
   status='EXCHANGING';
   try{
    const response=await request('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:expectedClientId,client_secret:secret,code:codes[0],code_verifier:verifier,redirect_uri:DRIVE_REDIRECT,grant_type:'authorization_code'})});
    if(!response.ok)bad('DRIVE_TOKEN_HTTP_'+response.status);
    const text=await response.text();if(text.length>32768)bad('DRIVE_TOKEN_LIMIT');
    const data=JSON.parse(text);
    if(data.scope!==DRIVE_SCOPE||data.token_type?.toLowerCase()!=='bearer'||typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token)bad('DRIVE_TOKEN_SCOPE_OR_REFRESH_INVALID');
    result={clientId:expectedClientId,clientSecret:secret,accessToken:data.access_token,refreshToken:data.refresh_token,refreshTokenExpiresIn:data.refresh_token_expires_in??null,pickedFileIds:picked};status='AUTHORIZED';
   }catch{status='FAILED';bad('DRIVE_TOKEN_EXCHANGE_FAILED');}
  }
 };
}
export async function listenDriveAuthorization(session){
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.headers.host!=='127.0.0.1:4387'||req.method!=='GET'||(req.url?.length??0)>8192){res.writeHead(400);res.end('INVALID_REQUEST');return;}
  const u=new URL(req.url,DRIVE_REDIRECT);
  if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="ko"><title>MOEMOA 백업 전용 Drive 연결</title><h1>MOEMOA 백업 전용 Drive 연결</h1><p>선택한 백업 파일만 접근하는 Google 권한입니다. 파일 업로드와 자동 실행은 켜지지 않습니다.</p><p><a href="'+session.authorizationUrl.replaceAll('&','&amp;')+'">Google 권한 확인으로 이동</a></p></html>');return;}
  if(u.pathname==='/done'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><html lang="ko"><title>MOEMOA Drive 연결 결과</title><h1>연결 결과: '+session.status()+'</h1><p>인증정보는 이 화면에 표시하지 않습니다. Codex로 돌아가 주세요.</p></html>');return;}
  if(u.pathname!=='/oauth/callback'){res.writeHead(404);res.end();return;}
  try{await session.accept(u.href);res.writeHead(303,{Location:'/done'});res.end();}catch{res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});res.end('DRIVE_AUTH_CALLBACK_REJECTED');}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(4387,'127.0.0.1',resolve);});
 return server;
}
