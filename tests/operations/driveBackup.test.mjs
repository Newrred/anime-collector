import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {refreshDriveToken,createDriveBackupClient,DRIVE_SCOPE,preparedArtifact} from '../../tools/operations/drive-backup.mjs';
const folderId='synthetic-folder-01',fileId='synthetic-file-0001';
const perms=[{type:'user',role:'owner'}];
const folder=()=>({id:folderId,mimeType:'application/vnd.google-apps.folder',ownedByMe:true,trashed:false,permissions:perms,capabilities:{canAddChildren:true}});
const response=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers});
async function fixture(t,size=10){
 const root=await mkdtemp(join(tmpdir(),'moemoa-drive-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const body=Buffer.alloc(size,3),name='moemoa-production-synthetic.encrypted.zip',path=join(root,name);await writeFile(path,body);
 const artifact={path,name,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex'),folderId};
 const journalPath=join(root,'upload-journal.json'),calls=[];let remote=null,puts=0;
 const meta=()=>({id:fileId,name,mimeType:'application/zip',parents:[folderId],size:String(body.length),sha256Checksum:artifact.sha256,ownedByMe:true,trashed:false,permissions:perms});
 const mock=async(url,options)=>{
  calls.push({url,method:options.method||'GET'});assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-token');
  if(url.includes('/files/'+folderId))return response(folder());
  if(url.includes('generateIds'))return response({ids:[fileId]});
  if(url.includes('/files/'+fileId))return remote?response(remote):response({},404);
  if(options.method==='POST')return response({},200,{location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=synthetic-session'});
  if(options.method==='PUT'){
   puts++;const range=options.headers['Content-Range'].match(new RegExp('^bytes ([0-9]+)-([0-9]+)/([0-9]+)$'));assert.ok(range);
   assert.deepEqual(options.body,body.subarray(Number(range[1]),Number(range[2])+1));
   if(Number(range[2])+1<body.length)return response({},308,{range:'bytes=0-'+range[2]});
   remote=meta();return response(remote);
  }
  throw Error('UNEXPECTED_REQUEST');
 };
 return {root,artifact,journalPath,calls,mock,meta,setRemote:v=>remote=v,puts:()=>puts};
}
test('refresh requires dedicated exact drive.file scope and fixed token endpoint',async()=>{
 const token=await refreshDriveToken({clientId:'id',clientSecret:'secret',refreshToken:'refresh'},async(url,o)=>{assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(o.redirect,'error');assert.equal(o.body.get('grant_type'),'refresh_token');return response({access_token:'token',token_type:'Bearer',scope:DRIVE_SCOPE});});assert.equal(token,'token');
});
test('broader or missing scope is not silently accepted',async()=>{
 for(const scope of [undefined,'https://www.googleapis.com/auth/drive'])await assert.rejects(refreshDriveToken({clientId:'id',clientSecret:'secret',refreshToken:'refresh'},async()=>response({access_token:'token',token_type:'Bearer',scope})),/SCOPE/);
});
test('upload verifies private folder, ciphertext checksum and remote result; repeat reuses same ID',async t=>{
 const f=await fixture(t),client=createDriveBackupClient('synthetic-token',f.mock);
 const a=await client.upload(f);assert.equal(a.status,'REMOTE_METADATA_SHA256_VERIFIED');assert.equal(a.externalDownloadVerified,false);assert.equal(f.puts(),1);
 await client.upload(f);assert.equal(f.puts(),1);assert.equal(f.calls.filter(c=>c.url.includes('generateIds')).length,1);
 const journal=await readFile(f.journalPath,'utf8');assert.ok(!journal.includes('synthetic-token'));assert.equal(JSON.parse(journal).fileId,fileId);
 assert.ok(f.calls.every(c=>!['DELETE','PATCH'].includes(c.method)));
});
test('large upload is bounded into 8MiB chunks with acknowledged ranges',async t=>{
 const f=await fixture(t,8*1024*1024+2);await createDriveBackupClient('synthetic-token',f.mock).upload(f);assert.equal(f.puts(),2);
});
test('response lost after completed upload leaves journal and recovers without duplicate',async t=>{
 const f=await fixture(t);let first=true;
 const client=createDriveBackupClient('synthetic-token',async(u,o)=>{const r=await f.mock(u,o);if(o.method==='PUT'&&first){first=false;throw Error('secret URL must not leak');}return r;});
 await assert.rejects(client.upload(f),/^Error: DRIVE_REQUEST_UNCERTAIN$/);await client.upload(f);assert.equal(f.puts(),1);
});
test('shared folder rejected before ID allocation or content transfer',async t=>{
 const f=await fixture(t);await assert.rejects(createDriveBackupClient('synthetic-token',async(u,o)=>u.includes('/files/'+folderId)?response({...folder(),permissions:[...perms,{type:'anyone',role:'reader'}]}):f.mock(u,o)).upload(f),/PRIVATE_FOLDER/);assert.equal(f.puts(),0);assert.equal(f.calls.length,0);
});
test('foreign resumable URL never receives credential or bytes',async t=>{
 const f=await fixture(t),seen=[];
 await assert.rejects(createDriveBackupClient('synthetic-token',async(u,o)=>{seen.push(u);return o.method==='POST'?response({},200,{location:'https://evil.example/upload?upload_id=x'}):f.mock(u,o);}).upload(f),/SESSION_INVALID/);assert.ok(seen.every(u=>!u.includes('evil.example')));assert.equal(f.puts(),0);
});
test('local mismatch stops before any request',async t=>{
 const f=await fixture(t);f.artifact.sha256='0'.repeat(64);await assert.rejects(createDriveBackupClient('synthetic-token',f.mock).upload(f),/LOCAL_MISMATCH/);assert.equal(f.calls.length,0);
});
test('existing different remote file is never overwritten',async t=>{
 const f=await fixture(t);f.setRemote({...f.meta(),sha256Checksum:'0'.repeat(64)});await assert.rejects(createDriveBackupClient('synthetic-token',f.mock).upload(f),/ID_CONFLICT/);assert.equal(f.puts(),0);
});
test('journal from another artifact cannot be reused',async t=>{
 const f=await fixture(t);await writeFile(f.journalPath,JSON.stringify({artifact:{},fileId}));await assert.rejects(createDriveBackupClient('synthetic-token',f.mock).upload(f),/JOURNAL_MISMATCH/);assert.equal(f.puts(),0);
});
test('remote hash missing after transfer remains unverified',async t=>{
 const f=await fixture(t);await assert.rejects(createDriveBackupClient('synthetic-token',async(u,o)=>{const r=await f.mock(u,o);if(o.method==='PUT')f.setRemote({...f.meta(),sha256Checksum:undefined});return r;}).upload(f),/REMOTE_NOT_VERIFIED/);
});
test('raw folder without authenticated package proof cannot become upload artifact',async t=>{
 const f=await fixture(t);await assert.rejects(preparedArtifact(f.root,folderId));assert.equal(f.calls.length,0);
});

import {connectionPreflight,main} from '../../tools/operations/run-drive-backup.mjs';
test('preflight is offline and disabled by default; invocation cannot upload accidentally',async()=>{const result=connectionPreflight({});assert.equal(result.missing.length,4);assert.equal(result.uploadEnabled,false);assert.equal(result.weeklyScheduleEnabled,false);assert.equal(result.networkRequests,0);await assert.rejects(main(['--upload','unused'],{}),/EXPLICIT_UPLOAD/);});

test('parent download accepts browser ZIP MIME and verifies streamed bytes',async t=>{const f=await fixture(t);f.setRemote({...f.meta(),mimeType:'application/x-zip-compressed'});const client=createDriveBackupClient('synthetic-token',async(u,o)=>u.endsWith('?alt=media')?new Response(await readFile(f.artifact.path)):f.mock(u,o));const out=join(f.root,'download.zip');await client.download({artifact:f.artifact,fileId,path:out});assert.deepEqual(await readFile(out),await readFile(f.artifact.path));});
test('corrupt or oversized parent stream is rejected and never treated as verified',async t=>{const f=await fixture(t);f.setRemote(f.meta());for(const body of [Buffer.alloc(f.artifact.bytes,9),Buffer.alloc(f.artifact.bytes+1,3)]){const client=createDriveBackupClient('synthetic-token',async(u,o)=>u.endsWith('?alt=media')?new Response(body):f.mock(u,o));await assert.rejects(client.download({artifact:f.artifact,fileId,path:join(f.root,'bad-'+body.length+'.zip')}),/DOWNLOAD_(HASH|LIMIT)/);}});
