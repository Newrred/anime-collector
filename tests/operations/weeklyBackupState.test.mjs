import test from 'node:test';
import assert from 'node:assert/strict';
import {descriptor,initialHead,nextIntent,nextCommit,resolveLedger,sealState,openState,fingerprint,createWeeklyStateStore} from '../../tools/operations/weekly-backup-state.mjs';
const key=Buffer.alloc(32,9),folderId='synthetic-folder-01';
export const archive=n=>({fileId:'synthetic-archive-'+n,folderId,name:'moemoa-production-'+n+'.encrypted.zip',bytes:100,sha256:n.toString(16).padStart(64,'0'),manifestSha256:n.toString(16).padStart(64,'0'),context:{project:'okchpyagfucpzpyrfgol',release:'MOEMOA_DAILY_BACKUP_'+n}});
function item(record){const bytes=sealState(record,key,folderId);return {record:openState(bytes,key,folderId),hash:fingerprint(bytes)};}
test('intent and commit keep immutable parent identities across new runners',()=>{const base=archive(1),h=initialHead(base),intent=item(nextIntent(h,archive(2),'2'));const pending=resolveLedger([intent],base);assert.equal(pending.record.pending.fileId,archive(2).fileId);const commit=item(nextCommit(pending));const loaded=resolveLedger([commit,intent],base);assert.equal(loaded.chain.length,2);assert.equal(loaded.record.pending,null);});
test('wrong key, folder binding and modified ciphertext cannot become state',()=>{const r=nextIntent(initialHead(archive(1)),archive(2),'2'),b=sealState(r,key,folderId);assert.throws(()=>openState(b,Buffer.alloc(32,1),folderId));assert.throws(()=>openState(b,key,'different-folder-01'));b[15]^=1;assert.throws(()=>openState(b,key,folderId));});
test('forked sequence, missing intent and substituted baseline fail closed',()=>{const base=archive(1),intent=item(nextIntent(initialHead(base),archive(2),'2')),pending=resolveLedger([intent],base),commit=item(nextCommit(pending));assert.throws(()=>resolveLedger([intent,intent],base));assert.throws(()=>resolveLedger([commit],base));assert.throws(()=>resolveLedger([intent],archive(3)));assert.throws(()=>resolveLedger([{...intent,record:{...intent.record,previous:'a'.repeat(64)}}],base));});
test('commit cannot rewrite parents or change pending archive; run identity preserved',()=>{const base=archive(1),intent=item(nextIntent(initialHead(base),archive(2),'2')),head=resolveLedger([intent],base);for(const changed of [{chain:[base,archive(3)]},{runId:'3'},{sequence:4}])assert.throws(()=>resolveLedger([intent,item({...nextCommit(head),...changed})],base));});
test('descriptor rejects wrong project, unsafe name and nonbounded bytes',()=>{for(const change of [{bytes:0},{bytes:1300000001},{name:'../private.zip'},{context:{project:'wrong',release:'MOEMOA_DAILY_BACKUP_1'}}])assert.throws(()=>descriptor({...archive(1),...change}));});
test('ledger rejects repeated archive and chain limit before new intent',()=>{assert.throws(()=>nextIntent(initialHead(archive(1)),archive(1),'1'));const h={...initialHead(archive(1)),chain:Array.from({length:16},(_,i)=>archive(i+1))};assert.throws(()=>nextIntent(h,archive(2),'2'));});
export function stateMock(){
 const files=new Map(),calls=[];let next=0,shared=false;
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
 const request=async(url,o)=>{calls.push({url,method:o.method??'GET'});assert.equal(o.redirect,'error');const u=new URL(url);
  if(u.pathname.endsWith('/files/'+folderId))return response({id:folderId,mimeType:'application/vnd.google-apps.folder',ownedByMe:true,trashed:false,permissions:shared?[{type:'anyone',role:'reader'}]:[{type:'user',role:'owner'}],capabilities:{canAddChildren:true}});
  if(u.pathname.endsWith('/generateIds'))return response({ids:['synthetic-state-'+(++next)]});
  if(u.pathname==='/drive/v3/files')return response({files:[...files.keys()].map(id=>({id}))});
  if(u.pathname==='/upload/drive/v3/files'){
   const boundary=o.headers['Content-Type'].split('boundary=')[1],parts=o.body.toString('latin1').split('--'+boundary),meta=JSON.parse(parts[1].split('\r\n\r\n')[1].slice(0,-2));const body=Buffer.from(parts[2].split('\r\n\r\n')[1].slice(0,-2),'latin1');files.set(meta.id,{meta,body});return response({id:meta.id});
  }
  const id=u.pathname.split('/').at(-1),f=files.get(id);if(!f)return response({},404);
  if(u.searchParams.get('alt')==='media')return new Response(f.body);
  return response({...f.meta,size:String(f.body.length),sha256Checksum:fingerprint(f.body),ownedByMe:true,trashed:false,permissions:[{type:'user',role:'owner'}]});
 };
 return {request,files,calls,setShared:()=>shared=true};
}
test('real encrypted state store appends and reloads without plaintext or mutation APIs',async()=>{const m=stateMock(),base=archive(1),s=createWeeklyStateStore({token:'synthetic',key,baseline:base,request:m.request}),first=await s.load();const intent=await s.append(nextIntent(first,archive(2),'2'),first.hash);const committed=await s.append(nextCommit(intent),intent.hash);assert.deepEqual((await s.load()).chain,committed.chain);assert.equal(m.files.size,2);assert.ok([...m.files.values()].every(f=>!f.body.includes(Buffer.from('synthetic-archive'))));assert.ok(m.calls.every(c=>!['PATCH','DELETE'].includes(c.method)));await assert.rejects(s.append(nextIntent(committed,archive(3),'3'),first.hash),/HEAD_CHANGED/);});
test('shared destination stops before any checkpoint data is transmitted',async()=>{const m=stateMock();m.setShared();const s=createWeeklyStateStore({token:'synthetic',key,baseline:archive(1),request:m.request});await assert.rejects(s.load(),/PRIVATE_FOLDER/);assert.equal(m.files.size,0);assert.equal(m.calls.filter(c=>c.method==='POST').length,0);});
