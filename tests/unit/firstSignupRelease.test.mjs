import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildRelease,committedSources,MIGRATIONS,SELF,TARGETS,COUNTRIES} from '../../tools/identity/build-first-signup-release.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const sources=new Map(MIGRATIONS.map(file=>[file,readFileSync(join(root,file),'utf8')]));
const input={target:'test',action:'stage',expectedPrivateRevision:'TEST_ONLY_PHONE_WEB_20260927_01',expectedRevision:'b'.repeat(64),commit:'a'.repeat(40),sources};

test('first signup release is fixed-target, revision-bound, local-only and rehearsal by default',()=>{
 const {sql,manifest}=buildRelease(input);
 assert.equal(manifest.mode,'rollback');assert.equal(manifest.remoteExecution,false);assert.equal(manifest.target,TARGETS.test);
 assert.deepEqual(manifest.countries,COUNTRIES);assert.match(sql,/rollback;\s*$/);
 for(const args of [{target:'other'},{expectedRevision:''},{expectedPrivateRevision:'other'},{commit:'short'},{action:'anything'}])assert.throws(()=>buildRelease({...input,...args}));
 assert.match(sql,/SIGNUP_REVISION_CONFLICT/);assert.match(sql,/PRIVATE_POLICY_TARGET_MISMATCH/);assert.match(sql,/PROJECT_TARGET_MISMATCH/);
});
test('stage preserves country rows, keeps signup closed, enforces admission and cannot grant initial resume',()=>{
 const {sql}=buildRelease(input);
 assert.match(sql,/update private\.simple_signup_countries set enabled=country in \('KR','US','TH'\)/);
 assert.match(sql,/set enabled=false,admission_enabled=true,policy_version='simple-signup-2026-10-10'/);
 assert.match(sql,/FIRST_RELEASE_REQUIRES_PAUSED_UNACTIVATED_STATE/);
 assert.doesNotMatch(sql,/delete from private\.simple_signup_countries|update private\.memory_signup_runtime_control set active_bundle_id/);
 assert.match(sql,/source_commit,migration_sha256,before_revision,after_revision/);
});
test('activation is first-time reviewed stage only; explicit rollback pause retains admission',()=>{
 const active=buildRelease({...input,action:'activate',mode:'apply'}).sql;
 assert.match(active,/REVIEWED_STAGE_REQUIRED/);assert.match(active,/FIRST_ACTIVATION_ONLY/);assert.match(active,/RELEASE_ALREADY_APPLIED_REVIEW_CURRENT_STATE/);
 assert.match(active,/set active_bundle_id='MOEMOA_KR_US_TH_PRIVATE_20261010_01',first_activated_at=clock_timestamp\(\)/);
 assert.match(active,/set enabled=true,admission_enabled=true/);assert.match(active,/commit;\s*$/);
 const pause=buildRelease({...input,action:'pause',mode:'apply'}).sql;
 assert.match(pause,/set enabled=false,admission_enabled=true/);assert.doesNotMatch(pause,/set active_bundle_id|set admission_enabled=false/);
});
test('test-only additive schema mode preserves policy state even when test signup is open',()=>{
 const sql=buildRelease({...input,action:'schema',mode:'apply'}).sql;
 assert.match(sql,/MIGRATION_CHANGED_SIGNUP_STATE/);assert.match(sql,/execute \$source\$/);
 assert.doesNotMatch(sql.slice(sql.lastIndexOf('do $unchanged$')),/update private\.simple_signup_policy set|insert into private\.simple_signup_rollout_events\(/);
 assert.throws(()=>buildRelease({...input,target:'production',action:'schema'}),/SCHEMA_ONLY_TEST_TARGET/);
});
test('readback is read-only and verifies source, function body, ACL, trigger and country defaults',()=>{
 const sql=buildRelease({...input,action:'readback',expectedRevision:undefined}).sql;
 assert.match(sql,/begin isolation level repeatable read read only/);
 for(const code of ['EXISTING_MIGRATION_LEDGER_MISMATCH','LIVE_FUNCTION_MISMATCH','LIVE_FUNCTION_ACL_MISMATCH','AUTH_ADMISSION_TRIGGER_MISMATCH','COUNTRY_DEFAULT_MISMATCH','IMMUTABLE_TRIGGER_MISMATCH'])assert.ok(sql.includes(code));
 assert.doesNotMatch(sql,/execute \$source\$|insert into supabase_migrations\.schema_migrations/);
 assert.match(sql,/replace\(p\.prosrc,chr\(13\)\|\|chr\(10\),chr\(10\)\)=replace\(\$body\$/);
 const inspect=buildRelease({...input,action:'inspect',expectedRevision:undefined,expectedPrivateRevision:undefined}).sql;
 assert.doesNotMatch(inspect,/insert into|update |delete from|jwt_secret|cipher|access_token/i);
});
test('preservation excludes only intentional policy/country flags and never outputs row hashes',()=>{
 const sql=buildRelease(input).sql;
 for(const code of ['PRESERVED_ROWS_CHANGED','HISTORICAL_COUNTRY_ROWS_CHANGED','SYNC_FUNCTION_CHANGED'])assert.ok(sql.includes(code));
 const final=sql.slice(sql.lastIndexOf("select jsonb_build_object('preservedFullTables'"));
 assert.match(final,/'historicalCountryRowsAndAgesUnchanged',true/);assert.match(final,/'publicAndRolesUnchanged',true/);
 assert.doesNotMatch(final,/row_hash|digest|to_jsonb\(x\)|email|user_id/);
 const prod=buildRelease({...input,target:'production',expectedPrivateRevision:'MOEMOA_PRIVATE_20261008_01'}).sql;
 assert.match(prod,/PRODUCTION_RELEASE_MARKER_REQUIRED/);assert.match(prod,/PUBLIC_MUST_REMAIN_OFF/);
});
test('malformed source or transaction envelope is rejected before SQL generation',()=>{
 assert.throws(()=>buildRelease({...input,sources:new Map()}),/MISSING_SOURCE/);
 const changed=new Map(sources);changed.set(MIGRATIONS[2],'begin;\n'+changed.get(MIGRATIONS[2]));
 assert.throws(()=>buildRelease({...input,sources:changed}),/INVALID_MIGRATION/);
});
test('cleanup readback exposes exact schedule status without run messages or commands',()=>{
 const sql=buildRelease({...input,action:'inspect'}).sql;
 assert.match(sql,/to_regclass\('cron.job'\) is not null/);
 assert.match(sql,/schedule='17 \* \* \* \*' and active/);
 assert.match(sql,/'latestRunStatus',latest/);assert.doesNotMatch(sql,/return_message|cron\.schedule\(|cron\.unschedule\(/);
 assert.match(sql,/"available":false,"configured":null/);
});
test('release CLI source loader accepts committed sources only, normalizing CRLF alone',()=>{
 const directory=mkdtempSync(join(tmpdir(),'moemoa-first-signup-'));
 const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'ignore'});
 try{
  git('init','-q');git('config','core.autocrlf','false');
  for(const [file,source] of new Map([[SELF,'// local fixture\n'],...sources])){
   const path=join(directory,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source.replace(/\r\n/g,'\n'));
  }
  git('add','.');git('-c','user.name=Local Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture');
  assert.match(committedSources(directory).commit,/^[a-f0-9]{40}$/);
  const path=join(directory,MIGRATIONS[2]);writeFileSync(path,readFileSync(path,'utf8').replace(/\n/g,'\r\n'));
  assert.equal(committedSources(directory).sources.size,4);
  writeFileSync(path,readFileSync(path,'utf8')+'-- unexpected change\n');assert.throws(()=>committedSources(directory),/UNCOMMITTED_RELEASE_SOURCE/);
 }finally{
  assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('moemoa-first-signup-'));
  rmSync(directory,{recursive:true,force:true});
 }
});
