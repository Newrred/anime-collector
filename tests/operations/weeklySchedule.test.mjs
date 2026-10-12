import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,readFileSync as read,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parse}=require('yaml');
const candidatePath=new URL('../../tools/operations/weekly-backup.schedule.candidate.yml',import.meta.url);
const workflow=parse(readFileSync(candidatePath,'utf8'));
const job=workflow.jobs.backup;
const admission=job.steps.find(step=>step.id==='admission');
test('scheduled backup stays outside installed workflows and retains least-privilege master isolation',()=>{
 assert.deepEqual(workflow.on.schedule,[{cron:'0 18 * * 6'}]);
 assert.equal(workflow.on.workflow_dispatch.inputs.confirm_backup.default,false);
 assert.equal(workflow.on.workflow_dispatch.inputs.inspect_only.default,true);
 assert.deepEqual(workflow.permissions,{contents:'read'});
 assert.match(job.if,/github\.repository == 'Newrred\/anime-collector'/);
 assert.match(job.if,/github\.ref == 'refs\/heads\/master'/);
 assert.match(job.if,/inputs\.confirm_backup/);
 assert.ok(!job.if.includes('vars.'),'environment variables unavailable before environment admission');
 assert.equal(job.environment,'moemoa-backup');
 assert.equal(workflow.concurrency.group,'moemoa-production-backup');
 assert.equal(workflow.concurrency['cancel-in-progress'],false);
 assert.match(job.container.image,/@sha256:[a-f0-9]{64}$/);
 for(const step of job.steps.filter(s=>s!==admission))assert.equal(step.if,"steps.admission.outputs.run_allowed == 'true'");
 assert.ok(!job.steps.some(s=>/upload-artifact|cache@/.test(s.uses||'')));
 const capture=job.steps.find(s=>s.name==='Capture encrypted delta and commit authenticated checkpoint');
 assert.match(capture.env.MOEMOA_BACKUP_RECOVER_MISSING_RUN_ID,/github\.event_name == 'workflow_dispatch'/);
});
const cases=[
 ['unapproved schedule ignores manual gate','schedule','true','','',false,'--inspect-state'],
 ['approved schedule runs with manual gate closed','schedule','false','true','true',true,'--run'],
 ['unapproved manual ignores weekly gate','workflow_dispatch','','true','false',false,'--inspect-state'],
 ['approved manual stays read-only by default','workflow_dispatch','true','','true',true,'--inspect-state'],
 ['approved manual capture uses explicit false inspect','workflow_dispatch','true','','false',true,'--run'],
 ['unknown events fail closed','push','true','true','false',false,'--inspect-state'],
 ['invalid weekly gate fails closed','schedule','true','TRUE','false',false,'--inspect-state'],
];
for(const [name,event,manual,weekly,inspect,allowed,mode] of cases)test(name,()=>{
 const dir=mkdtempSync(join(tmpdir(),'moemoa-schedule-'));
 const output=join(dir,'output');
 try{
  const outputPath=process.platform==='win32'?'/mnt/'+output[0].toLowerCase()+output.slice(2).replaceAll('\\','/'):output;
  const env={...process.env,BACKUP_ENABLED:manual,WEEKLY_ENABLED:weekly,EVENT_NAME:event,INSPECT_ONLY:inspect,GITHUB_OUTPUT:outputPath};
  // Pass only non-secret fixture values; run the exact workflow shell admission.
  const fixtureEnvironment=['BACKUP_ENABLED='+manual,'WEEKLY_ENABLED='+weekly,'EVENT_NAME='+event,'INSPECT_ONLY='+inspect,'GITHUB_OUTPUT='+outputPath];
  const result=process.platform==='win32'?spawnSync('wsl.exe',['-d','Ubuntu','--exec','env',...fixtureEnvironment,'bash','-s'],{input:admission.run,encoding:'utf8'}):spawnSync('bash',['-s'],{env,input:admission.run,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.equal(read(output,'utf8'),`run_allowed=${allowed}\nbackup_mode=${mode}\n`);
 }finally{const path=join(tmpdir(),dir.split(/[\\/]/).pop());assert.equal(path,dir);rmSync(dir,{recursive:true,force:true});}
});
