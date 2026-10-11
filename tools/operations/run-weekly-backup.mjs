// Explicit manual candidate. No scheduler registration or remote deletion.
import {mkdtemp,mkdir,writeFile,readFile,lstat,statfs,rm} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {refreshDriveToken,createDriveBackupClient,preparedArtifact} from './drive-backup.mjs';
import {descriptor,createWeeklyStateStore,nextIntent,nextCommit,nextAbandoned} from './weekly-backup-state.mjs';
import {restoreIncrementalBackup,manifestFingerprint} from './incremental-backup.mjs';
import {prepare} from './prepare-daily-backup.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const REQUIRED=['MOEMOA_BACKUP_DRIVE_CLIENT_ID','MOEMOA_BACKUP_DRIVE_CLIENT_SECRET','MOEMOA_BACKUP_DRIVE_REFRESH_TOKEN','MOEMOA_BACKUP_DRIVE_FOLDER_ID','SUPABASE_URL','SUPABASE_DB_URL','SUPABASE_SERVICE_ROLE_KEY','MOEMOA_BACKUP_CA_PEM','MOEMOA_BACKUP_RECOVERY_KEY'];
const SAFE_ERRORS=new Set(["WEEKLY_RECOVERY_TARGET_MISMATCH","DRIVE_ARTIFACT_INVALID","DRIVE_CREDENTIALS_MISSING","DRIVE_DOWNLOAD_FAILED","DRIVE_DOWNLOAD_HASH","DRIVE_DOWNLOAD_LIMIT","DRIVE_DOWNLOAD_WRITE","DRIVE_ID_CONFLICT","DRIVE_ID_INVALID","DRIVE_JOURNAL_INVALID","DRIVE_JOURNAL_MISMATCH","DRIVE_LOCAL_CHANGED","DRIVE_LOCAL_MISMATCH","DRIVE_PACKAGE_UNVERIFIED","DRIVE_PRIVATE_FOLDER_REQUIRED","DRIVE_REMOTE_NOT_VERIFIED","DRIVE_REQUEST_UNCERTAIN","DRIVE_RESPONSE_INVALID","DRIVE_RESPONSE_LIMIT","DRIVE_SCOPE_UNVERIFIED","DRIVE_SESSION_INVALID","DRIVE_TOKEN_MISSING","DRIVE_UPLOAD_UNCERTAIN","WEEKLY_CHAIN_LIMIT_REQUIRES_NEW_BASELINE","WEEKLY_CHILD_FAILED","WEEKLY_CHILD_INVALID","WEEKLY_CLEANUP_PATH","WEEKLY_CONFIG_INVALID","WEEKLY_DISK_BOUND","WEEKLY_EXPLICIT_RUN_REQUIRED","WEEKLY_FOLDER_MISMATCH","WEEKLY_GIT_TARGET_INVALID","WEEKLY_PACKAGE_ID","WEEKLY_PARENT_INVALID","WEEKLY_RUN_ID","WEEKLY_RUN_ID_REUSED","WEEKLY_STATE_FORK","WEEKLY_STATE_HEAD_CHANGED","WEEKLY_STATE_HTTP_FAILED","WEEKLY_STATE_INVALID","WEEKLY_STORAGE_CHANGED"]);
const SAFE_STAGES=new Set(['AUTH','STATE_READ','PARENT_RESTORE','BUILD_DELTA','RESERVE_ID','SAVE_INTENT','UPLOAD_ARCHIVE','SAVE_COMMIT','VERIFY_PENDING','ABANDON_MISSING']);
export function backupFailureSummary(error){
 const code=typeof error?.message==='string'&& (SAFE_ERRORS.has(error.message)||/^DRIVE_HTTP_[1-5][0-9]{2}$/.test(error.message))?error.message:'WEEKLY_OPERATION_FAILED';
 return {status:'WEEKLY_BACKUP_INCOMPLETE',error:code,stage:SAFE_STAGES.has(error?.backupStage)?error.backupStage:'UNKNOWN',safeToServe:false};
}
async function phase(stage,fn){try{return await fn();}catch(error){const wrapped=new Error(backupFailureSummary(error).error);wrapped.backupStage=SAFE_STAGES.has(error?.backupStage)?error.backupStage:stage;throw wrapped;}}
export async function inspectWeeklyState({store,drive}){
 const head=await phase('STATE_READ',()=>store.load());
 if(head.record?.type!=='intent')return {status:'WEEKLY_STATE_READY',chainLength:head.chain.length,pending:false,remoteWrites:0,databaseReads:0,storageBodyReads:0};
 const pending=head.record.pending;
 const metadata=await phase('VERIFY_PENDING',()=>drive.getMetadata(pending.fileId));
 if(metadata)await phase('VERIFY_PENDING',()=>drive.verifyArtifact(pending,pending.fileId));
 return {status:metadata?'WEEKLY_PENDING_ARCHIVE_VERIFIED':'WEEKLY_PENDING_ARCHIVE_MISSING',sequence:head.record.sequence,chainLength:head.chain.length,pending:true,archiveBytes:pending.bytes,remoteWrites:0,databaseReads:0,storageBodyReads:0};
}
export function weeklyPreflight(env){return {status:'WEEKLY_RUNNER_CANDIDATE',missing:REQUIRED.filter(n=>!env[n]),enabled:env.MOEMOA_BACKUP_RUN_ENABLED==='true',networkRequests:0,cronInstalled:false,retentionDeletion:false};}
export async function hydrateParents({chain,drive,staging,key,keyFile,python}){
 const previous=[];
 for(let i=0;i<chain.length;i++){
  const d=descriptor(chain[i]),archive=join(staging,'parent-'+i+'.zip'),output=join(staging,'parent-'+i);
  await drive.download({artifact:d,fileId:d.fileId,path:archive});
  const report=await python(['tools/operations/unpack-weekly-parent.py','--archive',archive,'--key-file',keyFile,'--output',output,'--project',d.context.project,'--release',d.context.release,'--sha256',d.sha256,'--manifest-sha256',d.manifestSha256]);
  if(report.status!=='PARENT_ZIP_AUTHENTICATED'||report.requiresParentArchives!==(i>0))throw Error('WEEKLY_PARENT_INVALID');
  previous.push({source:join(output,'encrypted'),context:d.context,manifestSha256:d.manifestSha256});
 }
 const cachePath=join(staging,'verified-cache');await restoreIncrementalBackup({chain:previous,output:cachePath,key});
 await writeFile(join(cachePath,'VERIFIED_BYTES_ONLY.json'),JSON.stringify({allSha256AndLengthsMatch:true,safeToServe:false}),{flag:'wx',mode:0o600});
 return {previous,cachePath};
}
export async function executeWeekly({store,drive,runId,staging,hydrate,build,recoverMissingRunId}){
 if(!/^[a-zA-Z0-9-]{1,60}$/.test(runId))throw Error('WEEKLY_RUN_ID');
 let head=await phase('STATE_READ',()=>store.load());
 if(recoverMissingRunId!==undefined){
  if(head.record?.type!=='intent'||head.record.runId!==recoverMissingRunId)throw Error('WEEKLY_RECOVERY_TARGET_MISMATCH');
  const exists=await phase('VERIFY_PENDING',()=>drive.getMetadata(head.record.pending.fileId));
  if(!exists)head=await phase('ABANDON_MISSING',()=>store.append(nextAbandoned(head),head.hash));
 }
 // A prior upload can have completed before its response/commit was lost.
 // Otherwise stop: do not create a second upload or advance past uncertain state.
 if(head.record?.type==='intent'){
  await phase('VERIFY_PENDING',()=>drive.verifyArtifact(head.record.pending,head.record.pending.fileId));
  await phase('SAVE_COMMIT',()=>store.append(nextCommit(head),head.hash));
  return {status:'WEEKLY_PENDING_UPLOAD_COMMITTED',newCapture:false,uploadedThisRun:false,safeToServe:false};
 }
 if(head.chain.length>=16)throw Error('WEEKLY_CHAIN_LIMIT_REQUIRES_NEW_BASELINE');
 if(head.chain.some(d=>d.context.release==='MOEMOA_DAILY_BACKUP_'+runId))throw Error('WEEKLY_RUN_ID_REUSED');
 const parents=await phase('PARENT_RESTORE',()=>hydrate(head.chain));
 const packageResult=await phase('BUILD_DELTA',()=>build(parents)),artifact=packageResult.artifact;
 if(artifact.name!=='moemoa-production-'+runId+'.encrypted.zip')throw Error('WEEKLY_PACKAGE_ID');
 const fileId=await phase('RESERVE_ID',()=>drive.reserveId());
 const pending=descriptor({...artifact,fileId,manifestSha256:packageResult.manifestSha256,context:{project:'okchpyagfucpzpyrfgol',release:'MOEMOA_DAILY_BACKUP_'+runId}});
 head=await phase('SAVE_INTENT',()=>store.append(nextIntent(head,pending,runId),head.hash));
 const journalPath=join(staging,'drive-upload-journal.local.json');
 await writeFile(journalPath,JSON.stringify({artifact:{folderId:artifact.folderId,name:artifact.name,bytes:artifact.bytes,sha256:artifact.sha256},fileId}),{flag:'wx',mode:0o600});
 await phase('UPLOAD_ARCHIVE',()=>drive.upload({artifact,journalPath}));
 await phase('SAVE_COMMIT',()=>store.append(nextCommit(head),head.hash));
 return {status:'WEEKLY_INCREMENTAL_COMMITTED',archiveBytes:artifact.bytes,chainLength:head.chain.length+1,safeToServe:false,oldCopiesDeleted:0};
}
async function pythonCommand(args,env){
 return new Promise((yes,no)=>execFile('python3',['-B',...args],{cwd:root,env,windowsHide:true,timeout:1800000,maxBuffer:8192},(error,stdout)=>{if(error)return no(Error('WEEKLY_CHILD_FAILED'));try{yes(JSON.parse(stdout));}catch{no(Error('WEEKLY_CHILD_INVALID'));}}));
}
export async function main(args,env=process.env){
 if(args.length===1&&args[0]==='--preflight')return weeklyPreflight(env);
 if(args.length!==1||!['--run','--inspect-state'].includes(args[0])||env.MOEMOA_BACKUP_RUN_ENABLED!=='true')throw Error('WEEKLY_EXPLICIT_RUN_REQUIRED');
 if(process.platform!=='linux'||weeklyPreflight(env).missing.length||env.SUPABASE_URL!=='https://okchpyagfucpzpyrfgol.supabase.co'||!/^[a-fA-F0-9]{64}$/.test(env.MOEMOA_BACKUP_RECOVERY_KEY))throw Error('WEEKLY_CONFIG_INVALID');
 if(env.GITHUB_ACTIONS==='true'&&(env.GITHUB_REF!=='refs/heads/master'||env.GITHUB_REPOSITORY!=='Newrred/anime-collector'))throw Error('WEEKLY_GIT_TARGET_INVALID');
 const baseline=descriptor(JSON.parse(await readFile(resolve(root,'tools/operations/weekly-backup.baseline.json'),'utf8')));
 if(env.MOEMOA_BACKUP_DRIVE_FOLDER_ID!==baseline.folderId)throw Error('WEEKLY_FOLDER_MISMATCH');
 const staging=await mkdtemp(join(tmpdir(),'moemoa-weekly-')),key=Buffer.from(env.MOEMOA_BACKUP_RECOVERY_KEY,'hex');
 const keyFile=join(staging,'recovery.key'),caFile=join(staging,'ca.pem');
 await writeFile(keyFile,key.toString('hex'),{mode:0o600,flag:'wx'});await writeFile(caFile,env.MOEMOA_BACKUP_CA_PEM,{mode:0o600,flag:'wx'});
 const childEnv={PATH:env.PATH,HOME:env.HOME,LANG:'C.UTF-8',MOEMOA_BACKUP_PORTABLE:'true',MOEMOA_BACKUP_WORK_ROOT:staging,MOEMOA_BACKUP_KEY_FILE:keyFile,MOEMOA_BACKUP_CA_FILE:caFile,SUPABASE_DB_URL:env.SUPABASE_DB_URL};
 const python=args=>pythonCommand(args,childEnv);
 try{
  const token=await phase('AUTH',()=>refreshDriveToken({clientId:env.MOEMOA_BACKUP_DRIVE_CLIENT_ID,clientSecret:env.MOEMOA_BACKUP_DRIVE_CLIENT_SECRET,refreshToken:env.MOEMOA_BACKUP_DRIVE_REFRESH_TOKEN}));
  const drive=createDriveBackupClient(token),store=createWeeklyStateStore({token,key,baseline});
  if(args[0]==='--inspect-state')return await inspectWeeklyState({store,drive});
  const recoverMissingRunId=env.MOEMOA_BACKUP_RECOVER_MISSING_RUN_ID||undefined;
  if(recoverMissingRunId&&!/^[a-zA-Z0-9-]{1,60}$/.test(recoverMissingRunId))throw Error('WEEKLY_RECOVERY_TARGET_MISMATCH');
  const runId=new Date().toISOString().replace(/[^0-9]/g,'');
  return await executeWeekly({store,drive,runId,staging,recoverMissingRunId,
   hydrate:async chain=>{const disk=await statfs(staging);if(disk.bavail*disk.bsize<chain.reduce((n,d)=>n+d.bytes,0)*6+2000000000)throw Error('WEEKLY_DISK_BOUND');return hydrateParents({chain,drive,staging,key,keyFile,python});},
   build:async({previous,cachePath})=>{
    await python(['tools/operations/capture-daily-backup.py','--run-id',runId,'--mode','capture']);
    await prepare(runId,'incremental',previous,{workRoot:staging,keyFile,cachePath,storageEnv:{SUPABASE_URL:env.SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY},verifyRemote:async id=>{const r=await python(['tools/operations/capture-daily-backup.py','--run-id',id,'--mode','verify']);if(r.storageUnchanged!==true)throw Error('WEEKLY_STORAGE_CHANGED');}});
    await python(['tools/operations/package-daily-backup.py','--run-id',runId]);
    const work=join(staging,'daily-backup-'+runId);return {artifact:await preparedArtifact(work,baseline.folderId),manifestSha256:await manifestFingerprint(join(work,'encrypted'))};
   }});
 }finally{key.fill(0);if(dirname(staging)!==resolve(tmpdir())||!basename(staging).startsWith('moemoa-weekly-'))throw Error('WEEKLY_CLEANUP_PATH');await rm(staging,{recursive:true,force:true});
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await main(process.argv.slice(2))));}
 catch(e){console.error(JSON.stringify(backupFailureSummary(e)));process.exitCode=1;}
}
