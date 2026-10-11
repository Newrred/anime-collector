// Local-only preparation. Bounded new-object GETs; no Drive upload, schedule or deletion.
import { readFile,writeFile,lstat,open,readdir,mkdir } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import { resolve,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { createEncryptedBackup,restoreEncryptedBackup } from '../private-images/encrypted-backup.mjs';
import { createIncrementalBackup,restoreIncrementalBackup } from './incremental-backup.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const originalCache=resolve(root,'.cache/operations-private/20261009-production/quarantine-external-20261010');
const keyFile='C:/Users/hongs/.moemoa/recovery-keys/moemoa-production-20261009.key';
const id=o=>JSON.stringify([o.bucket,o.name]);
const etag=o=>String(o.etag||'').replaceAll('"','').toLowerCase();
export function selectCachedObjects(current,old){
 if(!Array.isArray(current)||!Array.isArray(old)||current.length>9000)throw Error('INVALID_INVENTORY');
 const prior=new Map(),seen=new Set();let plannedBytes=0;
 for(const o of old){if(prior.has(id(o)))throw Error('DUPLICATE_CACHE');prior.set(id(o),o);}
 return current.map((o,index)=>{
  if(!['catalog-covers-preview','memory-private-representations','memory-public-representations'].includes(o.bucket)||typeof o.name!=='string'||!o.name||o.name.split('/').some(x=>!x||x==='.'||x==='..')||!Number.isSafeInteger(o.bytes)||o.bytes<0||o.bytes>20000000||seen.has(id(o)))throw Error('INVALID_OBJECT');
  seen.add(id(o));plannedBytes+=o.bytes;if(plannedBytes>1200000000)throw Error('BACKUP_BOUND');
  const p=prior.get(id(o));
  const eligible=p&&p.bytes===o.bytes&&/^[a-f0-9]{32}$/.test(etag(o))&&etag(p)===etag(o)&&/^[a-f0-9]{64}$/.test(p.sha256)&&new RegExp('^objects/[0-9]{5}[.]bin$').test(p.file);
  return {object:o,index,cached:eligible?p:null};
 });
}

export async function downloadBody(o,file,env,request=fetch){
 if(env.SUPABASE_URL!=='https://okchpyagfucpzpyrfgol.supabase.co'||!env.SUPABASE_SERVICE_ROLE_KEY||!/^[a-f0-9]{32}$/.test(etag(o)))throw Error('DOWNLOAD_CONFIG');
 const url=env.SUPABASE_URL+'/storage/v1/object/authenticated/'+encodeURIComponent(o.bucket)+'/'+o.name.split('/').map(encodeURIComponent).join('/');
 const response=await request(url,{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},redirect:'error',signal:AbortSignal.timeout(90000)});
 if(!response.ok||!response.body){await response.body?.cancel();throw Error('BODY_HTTP');}
 const handle=await open(file,'wx',0o600);const reader=response.body.getReader();let bytes=0;const sha=createHash('sha256'),md5=createHash('md5');
 try{
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>o.bytes||bytes>20000000)throw Error('BODY_LENGTH');sha.update(value);md5.update(value);let offset=0;while(offset<value.length){const written=await handle.write(value,offset,value.length-offset);if(!written.bytesWritten)throw Error('BODY_WRITE');offset+=written.bytesWritten;}}
  if(bytes!==o.bytes||md5.digest('hex')!==etag(o))throw Error('BODY_INTEGRITY');
  return {bytes,sha256:sha.digest('hex')};
 }finally{await reader.cancel().catch(()=>{});await handle.close();}
}
async function selectCache(work){
 let selected=originalCache,latest=0;
 for(const d of await readdir(resolve(root,'.cache/operations-private'),{withFileTypes:true})){
  if(!d.isDirectory()||!/^daily-backup-[a-zA-Z0-9-]+$/.test(d.name))continue;
  const candidate=resolve(root,'.cache/operations-private',d.name);if(candidate===work)continue;
  try{
   const summary=JSON.parse(await readFile(resolve(candidate,'archive-summary.json'),'utf8'));
   const incremental=summary.status==='LOCAL_INCREMENTAL_ZIP_AUTHENTICATED';
   const cache=resolve(candidate,incremental?'verify-quarantine':'zip-verification');
   const captured=JSON.parse(await readFile(resolve(cache,'payload/capture-summary.json'),'utf8'));
   const marker=JSON.parse(await readFile(resolve(cache,'VERIFIED_BYTES_ONLY.json'),'utf8'));
   const time=Date.parse(captured.capturedAt);
   if((summary.status==='LOCAL_ZIP_AUTHENTICATED'||incremental)&&marker.allSha256AndLengthsMatch===true&&time<=Date.now()+60000&&time>latest){selected=cache;latest=time;}
  }catch{/* An incomplete or unrelated directory is never a cache source. */}
 }
 return selected;
}

async function measure(path){
 const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('INVALID_FILE');
 const h=await open(path,'r');try{
  const before=await h.stat();if(before.ino!==s.ino||before.dev!==s.dev)throw Error('FILE_CHANGED');
  const sha=createHash('sha256'),md5=createHash('md5');let bytes=0;
  for await(const b of h.createReadStream({autoClose:false})){sha.update(b);md5.update(b);bytes+=b.length;}
  const after=await h.stat();if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes!==before.size)throw Error('FILE_CHANGED');
  return {sha256:sha.digest('hex'),md5:md5.digest('hex'),bytes};
 }finally{await h.close();}
}
async function verifyRemote(runId){
 const result=await new Promise(resolveResult=>execFile('wsl.exe',['--','python3','-B','/mnt/e/web/anime/tools/operations/capture-daily-backup.py','--run-id',runId,'--mode','verify'],{windowsHide:true,timeout:60000,maxBuffer:2048},(e,stdout)=>resolveResult({e,stdout})));
 if(result.e)throw Error('STORAGE_RECHECK_FAILED');
 if(JSON.parse(result.stdout).storageUnchanged!==true)throw Error('STORAGE_CHANGED');
}
export async function prepare(runId,mode,previous){
 if(!/^[a-zA-Z0-9-]{1,60}$/.test(runId)||!['plan','encrypt','incremental'].includes(mode))throw Error('INVALID_ARGS');
 if(mode==='incremental'&&(!Array.isArray(previous)||!previous.length))throw Error('BASE_CHAIN_REQUIRED');
 const work=resolve(root,'.cache/operations-private/daily-backup-'+runId);
 const previousCache=await selectCache(work);
 const proof=JSON.parse(await readFile(resolve(previousCache,'VERIFIED_BYTES_ONLY.json'),'utf8'));
 if(proof.allSha256AndLengthsMatch!==true)throw Error('UNVERIFIED_CACHE');
 const prior=JSON.parse(await readFile(resolve(previousCache,'payload/storage-download-result.json'),'utf8'));
 if(prior.complete!==true)throw Error('INCOMPLETE_CACHE');
 const inventory=JSON.parse(await readFile(resolve(work,'storage-inventory.json'),'utf8'));
 const capture=JSON.parse(await readFile(resolve(work,'capture-summary.json'),'utf8'));
 const journal=JSON.parse(await readFile(resolve(work,'latest-journal.json'),'utf8'));
 const publicState=JSON.parse(await readFile(resolve(work,'latest-public-state.json'),'utf8'));
 if(capture.publicRecoveryStateCaptured!==true||journal.format!=='moemoa-private-recovery-journal-v1'||publicState.format!=='moemoa-public-recovery-state-v1'||!journal.snapshot||!journal.capturedAt||journal.snapshot!==publicState.snapshot||journal.capturedAt!==publicState.capturedAt)throw Error('PUBLIC_RECOVERY_STATE_MISMATCH');
 const age=Date.now()-Date.parse(capture.capturedAt);
 if(!Number.isFinite(age)||age< -60000||age>3600000||capture.sameDatabaseSnapshot!==true||capture.objects!==inventory.length)throw Error('STALE_CAPTURE');
 const chosen=selectCachedObjects(inventory,prior.objects);const missing=chosen.filter(o=>!o.cached);
 const report={mode,readOnlyProduction:true,objects:chosen.length,bytes:inventory.reduce((n,o)=>n+o.bytes,0),cacheVerified:0,newDownloadObjects:missing.length,newDownloadBytes:missing.reduce((n,o)=>n+o.object.bytes,0),downloadsPerformed:0,externalUploads:0,oldCopiesDeleted:0,scheduleEnabled:false,safeToServe:false};
 const files=[],resultObjects=[];
 for(const row of chosen){if(!row.cached)continue;
  const path=resolve(previousCache,'payload',row.cached.file);
  if(!path.startsWith(resolve(previousCache,'payload')+sep))throw Error('CACHE_PATH');
  const actual=await measure(path);
  if(actual.bytes!==row.object.bytes||actual.sha256!==row.cached.sha256||actual.md5!==etag(row.object))throw Error('CACHE_CORRUPT');
  const file='objects/'+String(row.index).padStart(5,'0')+'.bin';
  files.push({name:file,path});resultObjects.push({...row.object,file,sha256:actual.sha256,validatedExisting:true});report.cacheVerified++;
 }
 if(mode==='encrypt'||mode==='incremental'){
  if(capture.databaseDumpCreated!==true)throw Error('CAPTURE_OR_OBJECTS_MISSING');
  if(report.newDownloadBytes>64000000)throw Error('NEW_DOWNLOAD_BUDGET');
  if(missing.length){
   const env=parseEnv(await readFile(resolve(root,'.env.moemoaprod.server.local'),'utf8'));
   await mkdir(resolve(work,'objects'),{recursive:false,mode:0o700});
   for(const row of missing){
    const file='objects/'+String(row.index).padStart(5,'0')+'.bin',path=resolve(work,file);
    const measured=await downloadBody(row.object,path,env);
    files.push({name:file,path});resultObjects.push({...row.object,file,sha256:measured.sha256,validatedExisting:false});report.downloadsPerformed++;
   }
  }
  const dump=await measure(resolve(work,'database.dump'));
  if(dump.bytes!==capture.dumpBytes||dump.sha256!==capture.dumpSha256)throw Error('DUMP_CHANGED');
  await verifyRemote(runId);
  await writeFile(resolve(work,'storage-download-result.json'),JSON.stringify({complete:true,done:chosen.length,bytes:report.bytes,objects:resultObjects}),{flag:'wx'});
  for(const name of ['database.dump','latest-journal.json','latest-public-state.json','roles.json','database-context.json','storage-inventory.json','capture-summary.json','storage-download-result.json']) files.push({name,path:resolve(work,name)});
  const ks=await lstat(keyFile);if(!ks.isFile()||ks.isSymbolicLink()||ks.size>128)throw Error('KEY_FILE_INVALID');
  const raw=(await readFile(keyFile,'utf8')).trim();if(!/^[a-fA-F0-9]{64}$/.test(raw))throw Error('KEY_FORMAT');
  const key=Buffer.from(raw,'hex');
  const context={project:'okchpyagfucpzpyrfgol',release:'MOEMOA_DAILY_BACKUP_'+runId};
  try{
   if(mode==='incremental'){
    report.incremental=await createIncrementalBackup({files,previous,output:resolve(work,'encrypted'),key,context});
    report.encryption=report.incremental.encryption;
    const chain=[...previous,{source:resolve(work,'encrypted'),context,manifestSha256:report.incremental.manifestSha256}];
    report.localByteVerification=await restoreIncrementalBackup({chain,output:resolve(work,'verify-quarantine'),key});
    await writeFile(resolve(work,'verify-quarantine/VERIFIED_BYTES_ONLY.json'),JSON.stringify({allSha256AndLengthsMatch:true,safeToServe:false,incremental:true}),{flag:'wx',mode:0o600});
    // Paths stay in the private work directory; portable encrypted parent identities are in the delta.
    await writeFile(resolve(work,'incremental-chain.local.json'),JSON.stringify(chain),{flag:'wx',mode:0o600});
   }else{
    report.encryption=await createEncryptedBackup({files,output:resolve(work,'encrypted'),key,context});
    report.localByteVerification=await restoreEncryptedBackup({source:resolve(work,'encrypted'),output:resolve(work,'verify-quarantine'),key,context});
   }
   await verifyRemote(runId);
   report.status=mode==='incremental'?'LOCAL_INCREMENTAL_BYTES_VERIFIED':'LOCAL_ENCRYPTED_BYTES_VERIFIED';report.databaseRestoreThisRun=false;
   await writeFile(resolve(work,'READY_LOCAL_ONLY.json'),JSON.stringify({context,...report}),{flag:'wx'});
  }finally{key.fill(0);}
 }else report.status=missing.length?'NEEDS_BODY_CAPTURE':'CACHE_READY_FOR_CAPTURE';
 await writeFile(resolve(work,mode+'-summary.json'),JSON.stringify(report));return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const incremental=process.argv[3]==='incremental';
  if(process.argv.length!==(incremental?5:4))throw Error('INVALID_ARGS');
  const previous=incremental?JSON.parse(await readFile(process.argv[4],'utf8')):undefined;
  console.log(JSON.stringify(await prepare(process.argv[2],process.argv[3],previous)));
 }
 catch{console.error(JSON.stringify({error:'DAILY_BACKUP_PREPARATION_FAILED',ready:false,serving:false}));process.exitCode=1;}
}
