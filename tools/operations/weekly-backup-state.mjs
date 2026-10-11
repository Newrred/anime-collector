import {createDriveBackupClient} from './drive-backup.mjs';
// Append-only encrypted checkpoint ledger. No overwrite/delete/share operations.
import {createCipheriv,createDecipheriv,randomBytes,createHash} from 'node:crypto';
export const PROJECT='okchpyagfucpzpyrfgol';
const FORMAT='moemoa-weekly-state-v1',API='https://www.googleapis.com';
const id=s=>typeof s==='string'&&/^[-_a-zA-Z0-9]{10,200}$/.test(s);
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const fail=()=>{throw Error('WEEKLY_STATE_INVALID');};
export const fingerprint=b=>createHash('sha256').update(b).digest('hex');
export function descriptor(d){
 if(!d||!id(d.fileId)||!id(d.folderId)||!hash(d.sha256)||!hash(d.manifestSha256)||!Number.isSafeInteger(d.bytes)||d.bytes<1||d.bytes>1300000000||d.context?.project!==PROJECT||!/^MOEMOA_DAILY_BACKUP_[a-zA-Z0-9-]{1,60}$/.test(d.context?.release)||d.name!=='moemoa-production-'+d.context.release.slice(20)+'.encrypted.zip')fail();
 return {fileId:d.fileId,folderId:d.folderId,name:d.name,bytes:d.bytes,sha256:d.sha256,manifestSha256:d.manifestSha256,context:{project:PROJECT,release:d.context.release}};
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function checked(r,folderId){
 if(!r||r.format!==FORMAT||r.project!==PROJECT||!Number.isInteger(r.sequence)||r.sequence<1||r.sequence>30||!['intent','commit','abandoned'].includes(r.type)||!hash(r.previous)||!/^[-a-zA-Z0-9]{1,60}$/.test(r.runId)||!Array.isArray(r.chain)||r.chain.length<1||r.chain.length>16)fail();
 const chain=r.chain.map(descriptor);if(chain.some(d=>d.folderId!==folderId)||new Set(chain.map(d=>d.fileId)).size!==chain.length||new Set(chain.map(d=>d.manifestSha256)).size!==chain.length||new Set(chain.map(d=>d.context.release)).size!==chain.length)fail();
 const pending=r.type!=='commit'?descriptor(r.pending):null;
 if(pending&&pending.context.release!=='MOEMOA_DAILY_BACKUP_'+r.runId)fail();
 if(r.type==='commit'&&r.pending!==null||pending&&(chain.length>=16||pending.folderId!==folderId||chain.some(d=>d.fileId===pending.fileId||d.manifestSha256===pending.manifestSha256||d.context.release===pending.context.release)))fail();
 return {format:FORMAT,project:PROJECT,sequence:r.sequence,type:r.type,previous:r.previous,runId:r.runId,chain,pending};
}
export function initialHead(baseline){const d=descriptor(baseline);return {hash:fingerprint(Buffer.from(JSON.stringify(d))),record:null,chain:[d]};}
export function nextIntent(head,pending,runId){if(head.record?.type==='intent')fail();return checked({format:FORMAT,project:PROJECT,sequence:(head.record?.sequence??0)+1,type:'intent',previous:head.hash,runId,chain:head.chain,pending},head.chain[0].folderId);}
export function nextCommit(head){if(head.record?.type!=='intent')fail();return checked({...head.record,sequence:head.record.sequence+1,type:'commit',previous:head.hash,chain:[...head.chain,head.record.pending],pending:null},head.chain[0].folderId);}
export function nextAbandoned(head){if(head.record?.type!=='intent')fail();return checked({...head.record,type:'abandoned',sequence:head.record.sequence+1,previous:head.hash},head.chain[0].folderId);}
export function sealState(record,key,folderId){
 const r=checked(record,folderId);if(!Buffer.isBuffer(key)||key.length!==32)fail();
 const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);c.setAAD(Buffer.from(JSON.stringify([FORMAT,PROJECT,folderId])));
 return Buffer.concat([iv,c.update(Buffer.from(JSON.stringify(r))),c.final(),c.getAuthTag()]);
}
export function openState(bytes,key,folderId){
 if(!Buffer.isBuffer(bytes)||bytes.length<28||bytes.length>65536)fail();
 try{const d=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAAD(Buffer.from(JSON.stringify([FORMAT,PROJECT,folderId])));d.setAuthTag(bytes.subarray(-16));return checked(JSON.parse(Buffer.concat([d.update(bytes.subarray(12,-16)),d.final()])),folderId);}catch{fail();}
}
export function resolveLedger(records,baseline){
 let head=initialHead(baseline);
 const ordered=[...records].sort((a,b)=>a.record.sequence-b.record.sequence);
 for(const item of ordered){const r=checked(item.record,baseline.folderId);if(!hash(item.hash)||r.sequence!==(head.record?.sequence??0)+1||r.previous!==head.hash)fail();
  const expected=r.type==='intent'?nextIntent(head,r.pending,r.runId):r.type==='abandoned'?nextAbandoned(head):nextCommit(head);
  if(!same(r,expected))fail();head={hash:item.hash,record:r,chain:r.chain};
 }
 return head;
}
export function createWeeklyStateStore({token,key,baseline,request=fetch}){
 const pin=descriptor(baseline),headers={Authorization:'Bearer '+token};
 const privateFile=f=>f&&f.ownedByMe===true&&f.trashed===false&&f.parents?.length===1&&f.parents[0]===pin.folderId&&f.permissions?.length===1&&f.permissions[0].type==='user'&&f.permissions[0].role==='owner';
 async function req(url,o={}){try{const r=await request(url,{...o,headers:{...headers,...o.headers},redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error();return r;}catch{throw Error('WEEKLY_STATE_HTTP_FAILED');}}
 async function bytes(r,max){if(!r.body)fail();const reader=r.body.getReader(),chunks=[];let n=0;try{while(true){const v=await reader.read();if(v.done)break;n+=v.value.length;if(n>max)fail();chunks.push(v.value);}return Buffer.concat(chunks);}finally{await reader.cancel().catch(()=>{});}}
 async function obj(url,o){return JSON.parse((await bytes(await req(url,o),65536)).toString('utf8'));}
 async function read(idValue){
  if(!id(idValue))fail();const m=await obj(API+'/drive/v3/files/'+idValue+'?fields=id,name,size,sha256Checksum,parents,ownedByMe,trashed,permissions(type,role),appProperties');
  if(!privateFile(m)||m.appProperties?.moemoaBackupState!=='v1'||!hash(m.sha256Checksum)||!/^[0-9]+$/.test(m.size)||Number(m.size)>65536)fail();
  const b=await bytes(await req(API+'/drive/v3/files/'+idValue+'?alt=media'),65536);if(b.length!==Number(m.size)||fingerprint(b)!==m.sha256Checksum)fail();
  return {record:openState(b,key,pin.folderId),hash:fingerprint(b)};
 }
 async function load(){
  await createDriveBackupClient(token,request).checkFolder(pin.folderId);
  const q="'"+pin.folderId+"' in parents and trashed = false and appProperties has { key='moemoaBackupState' and value='v1' }";
  const listing=await obj(API+'/drive/v3/files?'+new URLSearchParams({q,spaces:'drive',pageSize:'100',fields:'files(id),nextPageToken'}));
  if(listing.nextPageToken||!Array.isArray(listing.files)||listing.files.length>30)fail();
  const records=[];for(const f of listing.files)records.push(await read(f.id));return resolveLedger(records,pin);
 }
 return {load,
  async append(record,expectedHash){
   const current=await load();if(current.hash!==expectedHash)throw Error('WEEKLY_STATE_HEAD_CHANGED');
   const r=checked(record,pin.folderId),encrypted=sealState(r,key,pin.folderId);if(r.previous!==current.hash||!same(r,r.type==='intent'?nextIntent(current,r.pending,r.runId):r.type==='abandoned'?nextAbandoned(current):nextCommit(current)))fail();
   const generated=await obj(API+'/drive/v3/files/generateIds?count=1&space=drive&type=files');if(generated.ids?.length!==1||!id(generated.ids[0]))fail();
   const fileId=generated.ids[0],boundary='moemoa-'+randomBytes(16).toString('hex');
   const meta={id:fileId,name:'moemoa-weekly-state-'+r.sequence+'-'+r.runId+'.enc',parents:[pin.folderId],mimeType:'application/octet-stream',appProperties:{moemoaBackupState:'v1'}};
   const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: application/octet-stream\r\n\r\n'),encrypted,Buffer.from('\r\n--'+boundary+'--\r\n')]);
   await req(API+'/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
   const stored=await read(fileId);if(stored.hash!==fingerprint(encrypted))fail();const head=await load();if(head.hash!==stored.hash)throw Error('WEEKLY_STATE_FORK');return head;
  }
 };
}
