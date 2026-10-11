import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createEncryptedBackup} from '../../tools/private-images/encrypted-backup.mjs';
import {manifestFingerprint} from '../../tools/operations/incremental-backup.mjs';
import {prepare} from '../../tools/operations/prepare-daily-backup.mjs';
import {preparedArtifact} from '../../tools/operations/drive-backup.mjs';
import {initialHead,nextIntent,sealState,openState,fingerprint,resolveLedger} from '../../tools/operations/weekly-backup-state.mjs';
import {hydrateParents,executeWeekly,weeklyPreflight,main,backupFailureSummary,inspectWeeklyState} from '../../tools/operations/run-weekly-backup.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url)),project='okchpyagfucpzpyrfgol',folderId='synthetic-folder-01';
const posix=p=>process.platform==='win32'?'/mnt/'+p[0].toLowerCase()+p.slice(2).replaceAll('\\','/'):p;
const digest=(b,kind='sha256')=>createHash(kind).update(b).digest('hex');
const invoke=async args=>new Promise((yes,no)=>execFile(process.platform==='win32'?'wsl.exe':'python3',process.platform==='win32'?['--','python3','-B',...args]:['-B',...args],{cwd:repo,windowsHide:true,timeout:60000,maxBuffer:6000},(e,out,err)=>e?no(Error('SYNTHETIC_CHILD_FAILED '+err)):yes(JSON.parse(out))));
const packageScript="import sys,json,importlib.util;from pathlib import Path;s=importlib.util.spec_from_file_location('p',Path(sys.argv[1])/'tools/operations/package-daily-backup.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.package(sys.argv[2],work_root=sys.argv[3],key_file=sys.argv[4])))";
async function pack(temp,keyFile,id){return invoke(['-c',packageScript,posix(repo),id,posix(temp),posix(keyFile)]);}
async function fixture(t){
 const temp=await mkdtemp(join(tmpdir(),'moemoa-weekly-test-'));t.after(()=>rm(temp,{recursive:true,force:true}));
 const key=Buffer.alloc(32,23),keyFile=join(temp,'synthetic.key');await writeFile(keyFile,key.toString('hex'),{mode:0o600});
 const body=Buffer.alloc(128000,7),removed=Buffer.from('removed private synthetic image'),work=join(temp,'daily-backup-base');await mkdir(work);await mkdir(join(work,'objects'));
 const object=(b,n,bucket)=>({bucket,name:n+'.webp',bytes:b.length,etag:digest(b,'md5'),sha256:digest(b),file:'objects/'+n.padStart(5,'0')+'.bin'});
 const cover=object(body,'0','catalog-covers-preview'),deleted=object(removed,'1','memory-private-representations');
 await writeFile(join(work,cover.file),body);await writeFile(join(work,deleted.file),removed);await writeFile(join(work,'database.dump'),'synthetic earlier database');await writeFile(join(work,'storage-download-result.json'),JSON.stringify({complete:true,objects:[cover,deleted]}));
 const context={project,release:'MOEMOA_DAILY_BACKUP_base'},files=[cover.file,deleted.file,'database.dump','storage-download-result.json'].map(name=>({name,path:join(work,name)}));
 const encrypted=join(work,'encrypted'),encryption=await createEncryptedBackup({files,output:encrypted,key,context});await writeFile(join(work,'READY_LOCAL_ONLY.json'),JSON.stringify({status:'LOCAL_ENCRYPTED_BYTES_VERIFIED',context,encryption}));const summary=await pack(temp,keyFile,'base');
 const baseline={fileId:'synthetic-base-0001',folderId,name:'moemoa-production-base.encrypted.zip',bytes:summary.bytes,sha256:summary.sha256,manifestSha256:await manifestFingerprint(encrypted),context};
 const archives=new Map([[baseline.fileId,join(work,baseline.name)]]),ledger=[];let uploads=0,rechecks=0;
 const store={load:async()=>resolveLedger(ledger.map(x=>({record:openState(x,key,folderId),hash:fingerprint(x)})),baseline),append:async(r,hash)=>{assert.equal((await store.load()).hash,hash);ledger.push(sealState(r,key,folderId));return store.load();}};
 const drive={reserveId:async()=> 'synthetic-new-00001',download:async({artifact,fileId,path})=>{const bytes=await readFile(archives.get(fileId));assert.equal(bytes.length,artifact.bytes);assert.equal(digest(bytes),artifact.sha256);await writeFile(path,bytes,{flag:'wx'});},verifyArtifact:async(a,id)=>{if(!archives.has(id))throw Error('DRIVE_REMOTE_NOT_VERIFIED');assert.equal(digest(await readFile(archives.get(id))),a.sha256);},upload:async({artifact,journalPath})=>{const id=JSON.parse(await readFile(journalPath,'utf8')).fileId;assert.equal((await store.load()).record.pending.fileId,id);await copyFile(artifact.path,join(temp,'uploaded.zip'));archives.set(id,join(temp,'uploaded.zip'));uploads++;}};
 const python=async args=>{const converted=args.map((x,i)=>i===0?posix(join(repo,x)):i>0&&['--archive','--key-file','--output'].includes(args[i-1])?posix(x):x);return invoke(converted);};
 const hydrate=staging=>chain=>hydrateParents({chain,drive,staging,key,keyFile,python});
 const build=async({previous,cachePath})=>{
  const w=join(temp,'daily-backup-delta');await mkdir(w);const db=Buffer.from('synthetic latest DB without deleted image');
  const capture={publicRecoveryStateCaptured:true,capturedAt:new Date().toISOString(),sameDatabaseSnapshot:true,objects:1,databaseDumpCreated:true,dumpBytes:db.length,dumpSha256:digest(db)};
  const shared={snapshot:'synthetic-snapshot',capturedAt:capture.capturedAt};
  for(const [name,value] of Object.entries({'storage-inventory.json':[cover],'capture-summary.json':capture,'latest-journal.json':{format:'moemoa-private-recovery-journal-v1',...shared},'latest-public-state.json':{format:'moemoa-public-recovery-state-v1',...shared},'roles.json':{},'database-context.json':{}}))await writeFile(join(w,name),JSON.stringify(value));
  await writeFile(join(w,'database.dump'),db);
  const report=await prepare('delta','incremental',previous,{workRoot:temp,keyFile,cachePath,verifyRemote:async()=>{rechecks++;}});assert.equal(report.newDownloadBytes,0);assert.equal(report.downloadsPerformed,0);assert.equal(report.cacheVerified,1);
  const summary=await pack(temp,keyFile,'delta');assert.ok(summary.bytes<15000);return {artifact:await preparedArtifact(w,folderId),manifestSha256:await manifestFingerprint(join(w,'encrypted'))};
 };
 return {temp,key,keyFile,baseline,store,drive,hydrate,build,archives,ledger,uploads:()=>uploads,rechecks:()=>rechecks,cover,body,python};
}
test('real encrypted parent→portable prepare→small delta; restart after upload commits once and excludes deleted image',async t=>{
 const f=await fixture(t),stage=join(f.temp,'runner-one');await mkdir(stage);let loseCommit=true;
 const store={...f.store,append:async(r,h)=>{if(r.type==='commit'&&loseCommit){loseCommit=false;throw Error('SIMULATED_RUNNER_LOSS');}return f.store.append(r,h);}};
 await assert.rejects(executeWeekly({store,drive:f.drive,runId:'delta',staging:stage,hydrate:f.hydrate(stage),build:f.build}),e=>e.message==='WEEKLY_OPERATION_FAILED'&&e.backupStage==='SAVE_COMMIT');assert.equal(f.uploads(),1);assert.equal(f.rechecks(),2);assert.equal((await f.store.load()).record.type,'intent');
 const second=join(f.temp,'runner-two');await mkdir(second);const resumed=await executeWeekly({store:f.store,drive:f.drive,runId:'retry',staging:second,hydrate:()=>assert.fail('no parent redownload on completed upload'),build:()=>assert.fail('no recapture')});assert.equal(resumed.status,'WEEKLY_PENDING_UPLOAD_COMMITTED');assert.equal(f.uploads(),1);
 const head=await f.store.load(),restored=await f.hydrate(second)(head.chain);assert.deepEqual(await readFile(join(restored.cachePath,'payload',f.cover.file)),f.body);await assert.rejects(readFile(join(restored.cachePath,'payload/objects/00001.bin')));assert.equal((await readFile(join(restored.cachePath,'payload/database.dump'),'utf8')),'synthetic latest DB without deleted image');
});
test('incomplete upload intent stops subsequent runner before new capture/allocation',async()=>{
 const base={fileId:'synthetic-base-0001',folderId,name:'moemoa-production-base.encrypted.zip',bytes:1,sha256:'1'.repeat(64),manifestSha256:'2'.repeat(64),context:{project,release:'MOEMOA_DAILY_BACKUP_base'}};
 const pending={...base,fileId:'synthetic-new-00001',name:'moemoa-production-delta.encrypted.zip',manifestSha256:'3'.repeat(64),context:{project,release:'MOEMOA_DAILY_BACKUP_delta'}};const h=initialHead(base),r=nextIntent(h,pending,'delta');
 await assert.rejects(executeWeekly({store:{load:async()=>({hash:'4'.repeat(64),record:r,chain:[base]}),append:()=>assert.fail()},drive:{verifyArtifact:async()=>{throw Error('DRIVE_REMOTE_NOT_VERIFIED');}},runId:'retry',staging:'unused',hydrate:()=>assert.fail(),build:()=>assert.fail()}),/REMOTE_NOT_VERIFIED/);
});
test('preflight and ordinary CLI invocation perform no network or secret transfer',async()=>{const p=weeklyPreflight({});assert.equal(p.enabled,false);assert.equal(p.networkRequests,0);assert.equal(p.cronInstalled,false);assert.equal(p.missing.length,9);await assert.rejects(main(['--run'],{}),/EXPLICIT_RUN/);});

test('parent ZIP with a wrong pinned manifest is rejected before it can seed cache',async t=>{const f=await fixture(t),stage=join(f.temp,'bad-parent');await mkdir(stage);await assert.rejects(hydrateParents({chain:[{...f.baseline,manifestSha256:'0'.repeat(64)}],drive:f.drive,staging:stage,key:f.key,keyFile:f.keyFile,python:f.python}),/SYNTHETIC_CHILD_FAILED/);await assert.rejects(readFile(join(stage,'verified-cache/VERIFIED_BYTES_ONLY.json')));});

test('diagnostics disclose fixed codes and stages only, never raw request or key material',()=>{
 assert.deepEqual(backupFailureSummary(Object.assign(new Error('DRIVE_HTTP_403'),{backupStage:'UPLOAD_ARCHIVE'})),{status:'WEEKLY_BACKUP_INCOMPLETE',error:'DRIVE_HTTP_403',stage:'UPLOAD_ARCHIVE',safeToServe:false});
 for(const message of ['https://secret.example/?token=private','WEEKLY_SECRET_CREDENTIAL','DRIVE_SECRET_CREDENTIAL']){const report=backupFailureSummary(Object.assign(new Error(message),{backupStage:'PRIVATE_USER_NOTE'}));assert.equal(report.error,'WEEKLY_OPERATION_FAILED');assert.equal(report.stage,'UNKNOWN');assert.ok(!JSON.stringify(report).includes(message));}
});
test('inspection authenticates state and reports missing pending ZIP without new capture or writes',async()=>{
 const calls=[],head={record:{type:'intent',sequence:1,pending:{fileId:'synthetic-pending-1',bytes:123}},chain:[{}]};
 const store={load:async()=>{calls.push('load');return head;},append:()=>assert.fail('read only')};
 const drive={getMetadata:async id=>{calls.push(id);return null;},upload:()=>assert.fail('read only'),reserveId:()=>assert.fail('read only')};
 const report=await inspectWeeklyState({store,drive});assert.equal(report.status,'WEEKLY_PENDING_ARCHIVE_MISSING');assert.equal(report.archiveBytes,123);assert.equal(report.remoteWrites,0);assert.deepEqual(calls,['load','synthetic-pending-1']);
});
test('inspection verifies a completed pending ZIP, rejects a mismatch, and never commits it',async()=>{
 const store={load:async()=>({record:{type:'intent',sequence:1,pending:{fileId:'synthetic-pending-1',bytes:123}},chain:[{}]}),append:()=>assert.fail('read only')};let valid=true,verified=0;
 const drive={getMetadata:async()=>({}),verifyArtifact:async()=>{verified++;if(!valid)throw Error('DRIVE_REMOTE_NOT_VERIFIED');}};
 assert.equal((await inspectWeeklyState({store,drive})).status,'WEEKLY_PENDING_ARCHIVE_VERIFIED');valid=false;await assert.rejects(inspectWeeklyState({store,drive}),e=>e.message==='DRIVE_REMOTE_NOT_VERIFIED'&&e.backupStage==='VERIFY_PENDING');assert.equal(verified,2);
});

function pendingScenario(){const base={fileId:'synthetic-base-0001',folderId,name:'moemoa-production-base.encrypted.zip',bytes:1,sha256:'1'.repeat(64),manifestSha256:'2'.repeat(64),context:{project,release:'MOEMOA_DAILY_BACKUP_base'}},pending={...base,fileId:'synthetic-missing-001',name:'moemoa-production-failed.encrypted.zip',manifestSha256:'3'.repeat(64),context:{project,release:'MOEMOA_DAILY_BACKUP_failed'}};const first=initialHead(base);return {head:{hash:'4'.repeat(64),record:nextIntent(first,pending,'failed'),chain:[base]},base};}
test('explicit matching missing run appends abandoned before new capture; never deletes old state',async()=>{const {head,base}=pendingScenario(),events=[];const store={load:async()=>head,append:async(record,hash)=>{events.push(record.type);assert.equal(hash,head.hash);assert.equal(record.pending.fileId,head.record.pending.fileId);return {hash:'5'.repeat(64),record,chain:record.chain};}};await assert.rejects(executeWeekly({store,drive:{getMetadata:async()=>null},runId:'retry',recoverMissingRunId:'failed',staging:'unused',hydrate:async chain=>{assert.deepEqual(chain,[base]);events.push('hydrate');throw Error('LOCAL_STOP_BEFORE_CAPTURE');},build:()=>assert.fail()}),e=>e.backupStage==='PARENT_RESTORE');assert.deepEqual(events,['abandoned','hydrate']);});
test('wrong recovery run ID, uncertain lookup and mismatched archive never abandon or capture',async()=>{for(const mode of ['wrong','http','mismatch']){const {head}=pendingScenario(),store={load:async()=>head,append:()=>assert.fail('no state write')};const drive={getMetadata:async()=>{if(mode==='http')throw Error('DRIVE_HTTP_403');return {};},verifyArtifact:async()=>{throw Error('DRIVE_REMOTE_NOT_VERIFIED');}};await assert.rejects(executeWeekly({store,drive,runId:'retry',recoverMissingRunId:mode==='wrong'?'foreign':'failed',staging:'unused',hydrate:()=>assert.fail('no recapture'),build:()=>assert.fail()}),e=>['WEEKLY_RECOVERY_TARGET_MISMATCH','DRIVE_HTTP_403','DRIVE_REMOTE_NOT_VERIFIED'].includes(e.message));}});
test('explicit recovery of an existing verified archive commits it without recapture',async()=>{const {head}=pendingScenario();let writes=0;const store={load:async()=>head,append:async record=>{assert.equal(record.type,'commit');writes++;}};const result=await executeWeekly({store,drive:{getMetadata:async()=>({}),verifyArtifact:async()=>{}},runId:'retry',recoverMissingRunId:'failed',staging:'unused',hydrate:()=>assert.fail(),build:()=>assert.fail()});assert.equal(result.status,'WEEKLY_PENDING_UPLOAD_COMMITTED');assert.equal(writes,1);});
