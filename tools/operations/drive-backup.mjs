// Explicitly invoked transport only. No scheduler, delete, overwrite or permission mutation API.
import {createHash} from 'node:crypto';
import {lstat,open,readFile,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
const API='https://www.googleapis.com';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
const ID=/^[a-zA-Z0-9_-]{10,200}$/;
const HASH=/^[a-f0-9]{64}$/;
const failure=code=>{throw Error(code);};
async function call(request,url,options={}){
 try{return await request(url,{...options,redirect:'error',signal:AbortSignal.timeout(120000)});}catch{failure('DRIVE_REQUEST_UNCERTAIN');}
}
async function json(response){
 if(!response.ok)failure('DRIVE_HTTP_'+response.status);
 const body=await response.text();if(body.length>65536)failure('DRIVE_RESPONSE_LIMIT');
 try{return JSON.parse(body);}catch{failure('DRIVE_RESPONSE_INVALID');}
}
export async function refreshDriveToken(credentials,request=fetch){
 if(!credentials||!['clientId','clientSecret','refreshToken'].every(k=>typeof credentials[k]==='string'&&credentials[k].length>0))failure('DRIVE_CREDENTIALS_MISSING');
 const value=await json(await call(request,'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:credentials.clientId,client_secret:credentials.clientSecret,refresh_token:credentials.refreshToken,grant_type:'refresh_token'})}));
 if(typeof value.access_token!=='string'||!value.access_token||value.token_type?.toLowerCase()!=='bearer'||value.scope!==DRIVE_SCOPE)failure('DRIVE_SCOPE_UNVERIFIED');
 return value.access_token;
}
function privateOwned(file){return file.ownedByMe===true&&file.trashed===false&&Array.isArray(file.permissions)&&file.permissions.length===1&&file.permissions[0].type==='user'&&file.permissions[0].role==='owner';}
export function createDriveBackupClient(token,request=fetch){
 if(typeof token!=='string'||!token)failure('DRIVE_TOKEN_MISSING');
 const headers={Authorization:'Bearer '+token};
 const fields='id,name,mimeType,parents,size,sha256Checksum,trashed,ownedByMe,permissions(type,role),capabilities(canAddChildren)';
 const get=async id=>{
  if(!ID.test(id))failure('DRIVE_ID_INVALID');
  const r=await call(request,API+'/drive/v3/files/'+id+'?fields='+encodeURIComponent(fields),{headers});
  if(r.status===404)return null;return json(r);
 };
 const folder=async id=>{const f=await get(id);if(!f||f.id!==id||f.mimeType!=='application/vnd.google-apps.folder'||!privateOwned(f)||f.capabilities?.canAddChildren!==true)failure('DRIVE_PRIVATE_FOLDER_REQUIRED');return f;};
 const matches=(f,a,id)=>f&&f.id===id&&f.name===a.name&&privateOwned(f)&&['application/zip','application/x-zip-compressed'].includes(f.mimeType)&&Array.isArray(f.parents)&&f.parents.length===1&&f.parents[0]===a.folderId&&String(f.size)===String(a.bytes)&&f.sha256Checksum===a.sha256;
 const verify=async(a,id)=>{const f=await get(id);if(!matches(f,a,id))failure('DRIVE_REMOTE_NOT_VERIFIED');return {status:'REMOTE_METADATA_SHA256_VERIFIED',fileId:id,bytes:a.bytes,sha256:a.sha256,externalDownloadVerified:false};};
 return {checkFolder:folder, getMetadata:get, verifyArtifact:verify,
  async reserveId(){const d=await json(await call(request,API+'/drive/v3/files/generateIds?count=1&space=drive&type=files',{headers}));if(d.ids?.length!==1||!ID.test(d.ids[0]))failure('DRIVE_ID_INVALID');return d.ids[0];},
  async download({artifact:a,fileId,path}){
   if(!a||!ID.test(a.folderId)||!HASH.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>1300000000)failure('DRIVE_ARTIFACT_INVALID');
   await folder(a.folderId);await verify(a,fileId);
   const r=await call(request,API+'/drive/v3/files/'+fileId+'?alt=media',{headers});
   if(!r.ok||!r.body){await r.body?.cancel();failure('DRIVE_DOWNLOAD_FAILED');}
   const h=await open(path,'wx',0o600),reader=r.body.getReader(),sha=createHash('sha256');let bytes=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>a.bytes)failure('DRIVE_DOWNLOAD_LIMIT');sha.update(value);let offset=0;while(offset<value.length){const w=await h.write(value,offset,value.length-offset);if(!w.bytesWritten)failure('DRIVE_DOWNLOAD_WRITE');offset+=w.bytesWritten;}}
    if(bytes!==a.bytes||sha.digest('hex')!==a.sha256)failure('DRIVE_DOWNLOAD_HASH');
   }finally{await reader.cancel().catch(()=>{});await h.close();}
   await verify(a,fileId);return {status:'DOWNLOADED_SHA256_VERIFIED',bytes};
  },
  async upload({artifact,journalPath}){
   const a=artifact;
   if(!a||!ID.test(a.folderId)||!HASH.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>1300000000||!/^moemoa-[a-zA-Z0-9-]+[.]encrypted[.]zip$/.test(a.name)||basename(a.path)!==a.name)failure('DRIVE_ARTIFACT_INVALID');
   const s=await lstat(a.path);if(!s.isFile()||s.isSymbolicLink()||s.size!==a.bytes)failure('DRIVE_LOCAL_MISMATCH');
   const handle=await open(a.path,'r');
   try{
    const stat=await handle.stat();if(stat.ino!==s.ino||stat.dev!==s.dev)failure('DRIVE_LOCAL_MISMATCH');
    const hash=createHash('sha256');for await(const b of handle.createReadStream({autoClose:false}))hash.update(b);
    if(hash.digest('hex')!==a.sha256)failure('DRIVE_LOCAL_MISMATCH');
    await folder(a.folderId);
    const pin={folderId:a.folderId,name:a.name,bytes:a.bytes,sha256:a.sha256};let id;
    try{
     const st=await lstat(journalPath);if(!st.isFile()||st.isSymbolicLink()||st.size>4096)failure('DRIVE_JOURNAL_INVALID');
     const prior=JSON.parse(await readFile(journalPath,'utf8'));
     if(JSON.stringify(prior.artifact)!==JSON.stringify(pin)||!ID.test(prior.fileId))failure('DRIVE_JOURNAL_MISMATCH');id=prior.fileId;
    }catch(e){if(e.code!=='ENOENT')throw e;}
    if(!id){
     const generated=await json(await call(request,API+'/drive/v3/files/generateIds?count=1&space=drive&type=files',{headers}));
     if(!Array.isArray(generated.ids)||generated.ids.length!==1||!ID.test(generated.ids[0]))failure('DRIVE_ID_INVALID');id=generated.ids[0];
     await writeFile(journalPath,JSON.stringify({artifact:pin,fileId:id}),{flag:'wx',mode:0o600});
    }
    const found=await get(id);
    if(found){if(!matches(found,a,id))failure('DRIVE_ID_CONFLICT');return await verify(a,id);}
    const start=await call(request,API+'/upload/drive/v3/files?uploadType=resumable',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Upload-Content-Type':'application/zip','X-Upload-Content-Length':String(a.bytes)},body:JSON.stringify({id,name:a.name,parents:[a.folderId],mimeType:'application/zip'})});
    if(start.status===409)return await verify(a,id);
    if(!start.ok)failure('DRIVE_HTTP_'+start.status);
    let session;try{session=new URL(start.headers.get('location'));}catch{failure('DRIVE_SESSION_INVALID');}
    if(session.origin!==API||session.pathname!=='/upload/drive/v3/files'||session.username||session.password||session.hash||!session.searchParams.get('upload_id'))failure('DRIVE_SESSION_INVALID');
    const chunkSize=8*1024*1024;
    for(let offset=0;offset<a.bytes;){
     const length=Math.min(chunkSize,a.bytes-offset),body=Buffer.alloc(length);let filled=0;
     while(filled<length){const {bytesRead}=await handle.read(body,filled,length-filled,offset+filled);if(!bytesRead)failure('DRIVE_LOCAL_MISMATCH');filled+=bytesRead;}
     const end=offset+length-1;
     const response=await call(request,session.href,{method:'PUT',headers:{...headers,'Content-Type':'application/zip','Content-Length':String(length),'Content-Range':'bytes '+offset+'-'+end+'/'+a.bytes},body});
     if(response.status>=400)failure('DRIVE_HTTP_'+response.status);
     if(end+1<a.bytes){if(response.status!==308||response.headers.get('range')!=='bytes=0-'+end)failure('DRIVE_UPLOAD_UNCERTAIN');}
     else if(!response.ok)failure('DRIVE_HTTP_'+response.status);
     offset=end+1;
    }
    const after=await handle.stat();if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)failure('DRIVE_LOCAL_CHANGED');
    await folder(a.folderId);return await verify(a,id);
   }finally{await handle.close();}
  }
 };
}
// Only a package verified by the existing encryption/ZIP tool can become an artifact.
export async function preparedArtifact(work,folderId){
 const summary=JSON.parse(await readFile(resolve(work,'archive-summary.json'),'utf8'));
 const ready=JSON.parse(await readFile(resolve(work,'READY_LOCAL_ONLY.json'),'utf8'));
 const context=ready.context;
 if(context?.project!=='okchpyagfucpzpyrfgol'||typeof context.release!=='string'||!context.release.startsWith('MOEMOA_DAILY_BACKUP_')||!HASH.test(summary.sha256)||!ID.test(folderId))failure('DRIVE_PACKAGE_UNVERIFIED');
 const incremental=summary.status==='LOCAL_INCREMENTAL_ZIP_AUTHENTICATED';
 if(!incremental&&summary.status!=='LOCAL_ZIP_AUTHENTICATED'||ready.status!==(incremental?'LOCAL_INCREMENTAL_BYTES_VERIFIED':'LOCAL_ENCRYPTED_BYTES_VERIFIED')||summary.files!==ready.encryption?.files)failure('DRIVE_PACKAGE_UNVERIFIED');
 const runId=context.release.slice('MOEMOA_DAILY_BACKUP_'.length);if(!/^[a-zA-Z0-9-]{1,60}$/.test(runId))failure('DRIVE_PACKAGE_UNVERIFIED');
 const proof=JSON.parse(await readFile(resolve(work,'zip-verification/VERIFIED_BYTES_ONLY.json'),'utf8'));
 if(proof.archiveSha256Matched!==true||proof.allSha256AndLengthsMatch!==true||proof.safeToServe!==false||incremental&&(proof.requiresParentArchives!==true||ready.localByteVerification?.status!=='LOCAL_INCREMENTAL_BYTES_VERIFIED'))failure('DRIVE_PACKAGE_UNVERIFIED');
 const name='moemoa-production-'+runId+'.encrypted.zip';
 return {path:resolve(work,name),name,bytes:summary.bytes,sha256:summary.sha256,folderId};
}
