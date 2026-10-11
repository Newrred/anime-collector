// Local encrypted deltas. No network, scheduling, retention deletion or serving.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, writeFile, readdir, copyFile, rename, rm, rmdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { createEncryptedBackup, restoreEncryptedBackup } from '../private-images/encrypted-backup.mjs';
const FORMAT='moemoa-incremental-backup-v1';
const INDEX='incremental-snapshot.json';
export const MAX_BACKUP_CHAIN=16;
const fail=()=>{throw Error('INCREMENTAL_BACKUP_INVALID');};
const hash=b=>createHash('sha256').update(b).digest('hex');
function name(s){
 if(typeof s!=='string'||s.length>240||!s.split('/').every(p=>/^[a-zA-Z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..'&&!p.endsWith('.')&&!/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)))fail();
 return s;
}
async function measure(path){
 const before=await lstat(path);if(!before.isFile()||before.isSymbolicLink())fail();
 const h=createHash('sha256');let bytes=0;
 for await(const b of createReadStream(path)){bytes+=b.length;h.update(b);}
 const after=await lstat(path);if(bytes!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ino!==before.ino)fail();
 return {bytes,hash:h.digest('hex')};
}
export async function manifestFingerprint(source){
 const p=resolve(source,'payload/manifest.enc'),s=await lstat(p);
 if(!s.isFile()||s.isSymbolicLink()||s.size>16*1024*1024)fail();
 return hash(await readFile(p));
}
function identity(d){
 if(!d||typeof d.source!=='string'||!d.source||!d.context||!/^[a-z]{20}$/.test(d.context.project)||!/^[-\w.]{1,100}$/.test(d.context.release)||!/^[a-f0-9]{64}$/.test(d.manifestSha256))fail();
 return {context:{project:d.context.project,release:d.context.release},manifestSha256:d.manifestSha256};
}
function validateRows(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>9999)fail();
 const seen=new Set();let bytes=0;
 for(const r of rows){
  name(r.name);if(r.name.toLowerCase()===INDEX||seen.has(r.name.toLowerCase())||!/^[a-f0-9]{64}$/.test(r.hash)||!Number.isSafeInteger(r.bytes)||r.bytes<0)fail();
  seen.add(r.name.toLowerCase());bytes+=r.bytes;
 }
 if(bytes>1200000000)fail();
 for(const n of seen)for(let i=n.indexOf('/');i!==-1;i=n.indexOf('/',i+1))if(seen.has(n.slice(0,i)))fail();
}
async function listFiles(folder,prefix=''){
 const files=[];
 for(const e of await readdir(folder,{withFileTypes:true})){
  const n=prefix+e.name;name(n);if(e.isSymbolicLink())fail();
  if(e.isDirectory())files.push(...await listFiles(resolve(folder,e.name),n+'/'));
  else if(e.isFile())files.push({name:n,path:resolve(folder,e.name),...await measure(resolve(folder,e.name))});
  else fail();
 }
 return files;
}
async function withWorkspace(output,action){
 const absolute=resolve(output);
 try{await lstat(absolute);throw Error('BACKUP_TARGET_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
 const work=resolve(dirname(absolute),'.incremental-work-'+randomUUID());
 if(!work.startsWith(dirname(absolute)+sep))fail();
 await mkdir(work,{mode:0o700});
 try{return await action(work,absolute);}finally{await rm(work,{recursive:true,force:true});}
}
async function resolveChain(chain,key,work){
 if(!Array.isArray(chain)||!chain.length||chain.length>MAX_BACKUP_CHAIN)fail();
 let current=new Map(),previous=null;const seen=new Set();
 for(let i=0;i<chain.length;i++){
  const descriptor=chain[i],id=identity(descriptor);
  if(seen.has(id.manifestSha256)||previous&&previous.context.project!==id.context.project||await manifestFingerprint(descriptor.source)!==id.manifestSha256)fail();
  seen.add(id.manifestSha256);
  const out=resolve(work,'part-'+i);
  await restoreEncryptedBackup({source:descriptor.source,output:out,key,context:id.context});
  if(await manifestFingerprint(descriptor.source)!==id.manifestSha256)fail();
  const files=await listFiles(resolve(out,'payload')),local=new Map(files.map(f=>[f.name,f]));
  const index=local.get(INDEX);
  if(i===0){
   if(index)fail();validateRows(files);current=local;
  }else{
   if(!index||index.bytes>16*1024*1024)fail();
   const snapshot=JSON.parse(await readFile(index.path,'utf8'));
   if(snapshot.format!==FORMAT||JSON.stringify(snapshot.parent)!==JSON.stringify(previous))fail();
   validateRows(snapshot.files);
   const next=new Map(),used=new Set([INDEX]);
   for(const row of snapshot.files){
    if(!['parent','current'].includes(row.from))fail();
    const ref=row.from==='parent'?current.get(name(row.ref)):local.get(row.name);
    if(!ref||ref.bytes!==row.bytes||ref.hash!==row.hash)fail();
    if(row.from==='current')used.add(row.name);
    next.set(row.name,{name:row.name,path:ref.path,bytes:row.bytes,hash:row.hash});
   }
   if(local.size!==used.size||[...local.keys()].some(n=>!used.has(n)))fail();
   current=next;
  }
  previous=id;
 }
 return {files:[...current.values()],parent:previous};
}
export async function createIncrementalBackup({files,previous,output,key,context}){
 if(!Array.isArray(files)||!files.length||files.length>9999||!Array.isArray(previous)||previous.length>=MAX_BACKUP_CHAIN)fail();
 if(!context||previous.some(d=>d.context?.project!==context.project||d.context?.release===context.release))fail();
 return withWorkspace(output,async(work,destination)=>{
  const base=await resolveChain(previous,key,work),byHash=new Map();
  for(const f of base.files)if(/^objects\/[0-9]{5}[.]bin$/.test(f.name))byHash.set(f.hash+':'+f.bytes,f);
  const rows=[],stored=[];let reusedBytes=0;
  const stage=resolve(work,'inputs');await mkdir(stage,{mode:0o700});
  for(const f of files){
   name(f.name);const actual=await measure(f.path);
   const prior=/^objects\/[0-9]{5}[.]bin$/.test(f.name)?byHash.get(actual.hash+':'+actual.bytes):null;
   if(prior){rows.push({name:f.name,...actual,from:'parent',ref:prior.name});reusedBytes+=actual.bytes;}
   else{
    const p=resolve(stage,String(stored.length));await copyFile(f.path,p,1);
    const copied=await measure(p);if(copied.bytes!==actual.bytes||copied.hash!==actual.hash)fail();
    stored.push({name:f.name,path:p});rows.push({name:f.name,...actual,from:'current'});
   }
  }
  validateRows(rows);
  const index=resolve(work,INDEX);await writeFile(index,JSON.stringify({format:FORMAT,parent:base.parent,files:rows}),{flag:'wx',mode:0o600});
  const encryption=await createEncryptedBackup({files:[...stored,{name:INDEX,path:index}],output:destination,key,context});
  return {status:'LOCAL_INCREMENTAL_ENCRYPTED',files:rows.length,storedFiles:stored.length,reusedFiles:rows.length-stored.length,reusedBytes,encryption,manifestSha256:await manifestFingerprint(destination),requiredArchives:previous.map(identity),safeToServe:false};
 });
}
export async function restoreIncrementalBackup({chain,output,key}){
 return withWorkspace(output,async(work,destination)=>{
  const resolved=await resolveChain(chain,key,work),stage=resolve(work,'assembled');await mkdir(stage,{mode:0o700});
  for(const f of resolved.files){
   const p=resolve(stage,f.name);if(!p.startsWith(stage+sep))fail();
   await mkdir(dirname(p),{recursive:true,mode:0o700});await copyFile(f.path,p,1);
   const actual=await measure(p);if(actual.bytes!==f.bytes||actual.hash!==f.hash)fail();
  }
  await mkdir(destination,{mode:0o700});
  try{await rename(stage,resolve(destination,'payload'));}catch(e){await rmdir(destination).catch(()=>{});throw e;}
  return {status:'LOCAL_INCREMENTAL_BYTES_VERIFIED',files:resolved.files.length,bytes:resolved.files.reduce((n,f)=>n+f.bytes,0),requiredArchives:chain.map(identity),safeToServe:false};
 });
}
