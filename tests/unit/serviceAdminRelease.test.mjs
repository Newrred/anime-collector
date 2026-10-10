import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,basename} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildRelease,committedSources,MIGRATIONS,TARGETS} from '../../tools/operations/build-service-admin-release.mjs';

const root=fileURLToPath(new URL('../..',import.meta.url));
const sources=new Map(MIGRATIONS.map(file=>[file,readFileSync(join(root,file),'utf8')]));
const input={target:'test',action:'schema',mode:'rollback',expectedPrivateRevision:'TEST_ONLY_PHONE_WEB_20260927_01',commit:'a'.repeat(40),sources};

test('service admin release generator is fixed-target, local-only and rollback by default',()=>{
 const {sql,manifest}=buildRelease({...input,mode:undefined});
 assert.equal(manifest.mode,'rollback');assert.equal(manifest.remoteExecution,false);
 assert.equal(manifest.target,TARGETS.test);assert.match(sql,/rollback;\s*$/);
 assert.match(sql,/PRIVATE_POLICY_TARGET_MISMATCH/);assert.match(sql,/PROJECT_TARGET_MISMATCH/);
 assert.match(sql,/dashboard URL \+ observed policy\/release markers/);
 assert.throws(()=>buildRelease({...input,target:'other'}),/FIXED_TARGET/);
 assert.throws(()=>buildRelease({...input,expectedPrivateRevision:'production'}),/TEST_POLICY_MARKER/);
 assert.throws(()=>buildRelease({...input,target:'production'}),/PRODUCTION_POLICY_MARKER/);
 assert.throws(()=>buildRelease({...input,expectedPrivateRevision:''}),/OBSERVED_PRIVATE_REVISION/);
});
test('service admin schema wraps migrations with canonical ledger and runtime definition checks',()=>{
 const {sql,manifest}=buildRelease(input);
 assert.equal(manifest.migrations.length,2);
 assert.ok(manifest.migrations.every(row=>/^[a-f0-9]{64}$/.test(row.sha256)));
 for(const code of ['EXISTING_MIGRATION_LEDGER_MISMATCH','MIGRATION_FUNCTION_MISMATCH','MIGRATION_FUNCTION_ACL_MISMATCH','ADMIN_TABLE_RLS_MISMATCH','ADMIN_TABLE_ACL_MISMATCH','ADMIN_TRIGGER_MISMATCH'])assert.ok(sql.includes(code));
 assert.match(sql,/p\.proargnames is not distinct from/);
 assert.match(sql,/replace\(p\.prosrc,chr\(13\)\|\|chr\(10\),chr\(10\)\)/);
 assert.match(sql,/replace\(\$body\$/);
 assert.match(sql,/is distinct from replace\(\$migration_source\$/);
 assert.doesNotMatch(sql,/insert into private\.memory_service_operators\(user_id,enabled\) values\(selected/);
 assert.doesNotMatch(sql,/update private\.simple_signup_policy set enabled=true/);
});
test('service admin release preservation stays inside transaction and outputs booleans only',()=>{
 const {sql}=buildRelease(input);
 assert.match(sql,/lock table supabase_migrations\.schema_migrations in exclusive mode/);
 assert.match(sql,/create temp table service_admin_preserved/);
 assert.match(sql,/EXISTING_ROWS_CHANGED/);assert.match(sql,/SYNC_FUNCTION_CHANGED/);
 const final=sql.slice(sql.lastIndexOf("select jsonb_build_object('release'"));
 assert.match(final,/'allRowsUnchanged',true/);
 assert.doesNotMatch(final,/r\.digest|row_hash|to_jsonb\(x\)|godburgundy|selected/);
});
test('operator grant is separate, exact confirmed Google account and production moderator-bound',()=>{
 const {sql}=buildRelease({...input,target:'production',action:'operator',mode:'apply',expectedPrivateRevision:'PRIVATE_PROD_01'});
 assert.match(sql,/EXACT_CONFIRMED_GOOGLE_OPERATOR_REQUIRED/);
 assert.match(sql,/email_verified/);assert.match(sql,/auth\.identities/);assert.match(sql,/provider='google'/);
 assert.match(sql,/u\.email_confirmed_at is not null/);
 assert.match(sql,/EXISTING_MODERATOR_REQUIRED/);assert.match(sql,/OTHER_SERVICE_OPERATOR_PRESENT/);
 assert.match(sql,/PRODUCTION_RELEASE_MARKER_REQUIRED/);assert.match(sql,/ADMIN_MIGRATION_REQUIRED/);
 assert.doesNotMatch(sql,/execute \$migration_source\$/);
 assert.match(sql,/notify pgrst, 'reload schema';\ncommit;\s*$/);
});
test('inspect SQL is read-only and contains no source row, secret or key retrieval',()=>{
 const {sql}=buildRelease({...input,action:'inspect',expectedPrivateRevision:undefined});
 assert.match(sql,/begin isolation level repeatable read read only/);
 assert.match(sql,/existingOperatorAccounts/);assert.match(sql,/selectedAccountIsModerator/);
 assert.doesNotMatch(sql,/insert into|update |delete from|jwt_secret|cipher|key_hash|access_token/i);
 assert.match(sql,/rollback;\s*$/);
});
test('release rejects malformed source manifest and unexpected transaction boundary',()=>{
 assert.throws(()=>buildRelease({...input,commit:'short'}),/SOURCE_COMMIT/);
 assert.throws(()=>buildRelease({...input,sources:new Map()}),/MISSING_SOURCE/);
 const changed=new Map(sources);changed.set(MIGRATIONS[0],'begin;\n'+changed.get(MIGRATIONS[0]));
 assert.throws(()=>buildRelease({...input,sources:changed}),/INVALID_MIGRATION/);
});
test('source loader accepts only committed generator/migrations, normalizing CRLF alone',()=>{
 const directory=mkdtempSync(join(tmpdir(),'moemoa-admin-release-'));
 const fixture=new Map([['tools/operations/build-service-admin-release.mjs','// fixture\n'],...sources]);
 const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'ignore'});
 try{
  git('init','-q');git('config','core.autocrlf','false');
  for(const [file,source] of fixture){const path=join(directory,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,source.replace(/\r\n/g,'\n'));}
  git('add','.');git('-c','user.name=Local Fixture','-c','user.email=fixture@example.test','commit','-qm','fixture');
  assert.match(committedSources(directory).commit,/^[a-f0-9]{40}$/);
  const path=join(directory,MIGRATIONS[0]);writeFileSync(path,readFileSync(path,'utf8').replace(/\n/g,'\r\n'));
  assert.equal(committedSources(directory).sources.size,3);
  writeFileSync(path,readFileSync(path,'utf8')+'-- unexpected edit\n');
  assert.throws(()=>committedSources(directory),/UNCOMMITTED_RELEASE_SOURCE/);
 }finally{
  assert.equal(dirname(resolve(directory)),resolve(tmpdir()));assert.ok(basename(directory).startsWith('moemoa-admin-release-'));
  rmSync(directory,{recursive:true,force:true});
 }
});
