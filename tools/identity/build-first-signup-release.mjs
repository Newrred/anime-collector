#!/usr/bin/env node
// SQL artifact generation only. No network, credentials, provider settings or deployment.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../..',import.meta.url));
export const SELF='tools/identity/build-first-signup-release.mjs';
export const TARGETS=Object.freeze({test:'nmgkhknponvzcwliajyk',production:'okchpyagfucpzpyrfgol'});
export const MIGRATIONS=Object.freeze([
 'supabase/migrations/20261010170000_simple_signup_receipts.sql',
 'supabase/migrations/20261010180000_service_admin.sql',
 'supabase/migrations/20261010190000_simple_signup_country_activation.sql',
]);
export const COUNTRIES=Object.freeze([{country:'KR',minimumAge:14},{country:'TH',minimumAge:13},{country:'US',minimumAge:13}]);
const BUNDLE='MOEMOA_KR_US_TH_PRIVATE_20261010_01';
const normalize=s=>s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const hash=s=>createHash('sha256').update(s).digest('hex');
const q=s=>`'${String(s).replaceAll("'","''")}'`;
const block=(s,tag)=>{if(s.includes(`$${tag}$`))throw Error('SOURCE_DELIMITER');return `$${tag}$${s}$${tag}$`;};
const PRESERVE=['auth.users','auth.identities','public.user_profiles','public.memory_private_titles',
 'public.memory_cards','public.memory_visual_assets','public.memory_boards','public.memory_board_cards',
 'public.sync_operations','private.memory_private_media','private.memory_private_media_policy',
 'private.memory_public_assets','private.memory_publications','private.memory_minihomes',
 'private.memory_publication_settings','private.memory_publication_delete_fences','private.memory_moderators',
 'private.memory_reports','private.memory_moderation_notices','private.memory_moderation_audit',
 'private.simple_signup_declarations','private.simple_signup_admissions','private.simple_signup_handoffs',
 'storage.objects','private.memory_service_operators','private.memory_service_admin_audit'];

export function committedSources(root=ROOT){
 const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const commit=git('rev-parse','HEAD').trim(),sources=new Map();
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('SOURCE_COMMIT_REQUIRED');
 for(const file of [SELF,...MIGRATIONS]){
  const source=normalize(git('show',`HEAD:${file}`));
  if(source!==normalize(readFileSync(resolve(root,file),'utf8')))throw Error('UNCOMMITTED_RELEASE_SOURCE');
  sources.set(file,source);
 }
 return {commit,sources};
}
function manifestParts(sources){return MIGRATIONS.map(file=>{
 const value=sources?.get(file);if(typeof value!=='string')throw Error('MISSING_SOURCE');
 const source=normalize(value),[,version,name]=file.match(/\/(\d{14})_([a-z_]+)\.sql$/);
 if(/^(begin|commit|rollback)\s*;/im.test(source))throw Error('INVALID_MIGRATION');
 const funcs=[...source.matchAll(/create (?:or replace )?function ([a-z_.]+)\(([^)]*)\) returns (\w+)\s+([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$;/g)].map(([,name,args,returns,header,body])=>{
  const params=args?args.split(',').map(arg=>arg.trim().split(/\s+/)):[];
  return {name,signature:`${name}(${params.map(p=>p[1]).join(',')})`,returns,body,
   language:header.match(/language (\w+)/)?.[1],definer:/security definer/.test(header),
   volatility:/\bstable\b/.test(header)?'s':/\bimmutable\b/.test(header)?'i':'v',
   config:[...header.matchAll(/set ([a-z_]+)='([^']*)'/g)].map(([,key,value])=>`${key}=${value||'""'}`),argNames:params.map(p=>p[0])};
 });
 if(funcs.length!==({'20261010170000':1,'20261010180000':6,'20261010190000':7}[version]))throw Error('FUNCTION_MANIFEST_MISMATCH');
 return {file,source,version,name,sha256:hash(source),funcs};
});}
function ledger(parts,{stage,release,commit}){return parts.map(p=>`do $ledger$ declare installed text; begin
 if exists(select 1 from supabase_migrations.schema_migrations where version=${q(p.version)}) then
  select case when cardinality(statements)=1 and name=${q(p.name)} then statements[1] end into installed
   from supabase_migrations.schema_migrations where version=${q(p.version)};
  installed:=replace(installed,chr(13)||chr(10),chr(10));
  if regexp_replace(installed,'^-- release[^\\n]*\\n','') is distinct from replace(${block(p.source,'source')},chr(13)||chr(10),chr(10))
  then raise exception 'EXISTING_MIGRATION_LEDGER_MISMATCH'; end if;
 else
  ${stage&&p.version==='20261010190000'?`execute ${block(p.source,'source')};
  insert into supabase_migrations.schema_migrations(version,name,statements)
   values(${q(p.version)},${q(p.name)},array[${block(`-- release ${release}; source ${commit}; sha256 ${p.sha256}\n${p.source}`,'ledger_source')}]);`:`raise exception 'REQUIRED_MIGRATION_MISSING';`}
 end if;
end $ledger$;`).join('\n')+'\n';}
function definitions(parts){
 const funcs=new Map(parts.flatMap(p=>p.funcs).map(f=>[f.signature,f]));
 const array=a=>a.length?`array[${a.map(q).join(',')}]::text[]`:'null::text[]';
 const checks=[...funcs.values()].map(f=>{
  let permitted=[];
  if(f.name==='public.get_simple_signup_policy')permitted=['anon','authenticated'];
  else if(f.name==='public.check_simple_signup_admission')permitted=['supabase_auth_admin'];
  else if(/public\.(issue|finish)_simple_signup_admission/.test(f.name))permitted=['service_role'];
  else if(f.name.startsWith('public.'))permitted=['authenticated'];
  // Legacy functions may retain service_role ownership-era grants; never broaden
  // their user-facing boundary. New admin/receipt functions have an exact ACL.
  const roles=['anon','authenticated'];
  if(!['private.apply_simple_signup_admission','public.record_simple_signup_declaration','public.get_simple_signup_policy'].includes(f.name))roles.push('service_role');
  if(f.name==='public.check_simple_signup_admission')roles.push('supabase_auth_admin');
  return `if not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(${q(f.signature)})
   and replace(p.prosrc,chr(13)||chr(10),chr(10))=replace(${block(f.body,'body')},chr(13)||chr(10),chr(10))
   and p.prosecdef=${f.definer} and p.provolatile=${q(f.volatility)} and l.lanname=${q(f.language)}
   and p.prorettype=${q(f.returns)}::regtype and not p.proretset and p.proconfig is not distinct from ${array(f.config)}
   and p.proargnames is not distinct from ${array(f.argNames)}) then raise exception 'LIVE_FUNCTION_MISMATCH'; end if;
  if ${roles.map(r=>`has_function_privilege(${q(r)},${q(f.signature)},'EXECUTE') is distinct from ${permitted.includes(r)}`).join(' or ')}
  then raise exception 'LIVE_FUNCTION_ACL_MISMATCH'; end if;`;
 }).join('\n');
 return `do $definitions$ begin
 ${checks}
 if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='apply_simple_signup_admission'
  and tgfoid='private.apply_simple_signup_admission()'::regprocedure and tgtype=5 and tgenabled='O')
 then raise exception 'AUTH_ADMISSION_TRIGGER_MISMATCH'; end if;
 if not exists(select 1 from pg_attribute a join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
  where a.attrelid='private.simple_signup_countries'::regclass and a.attname='enabled' and a.attnotnull
  and a.atttypid='boolean'::regtype and pg_get_expr(d.adbin,d.adrelid)='false') then raise exception 'COUNTRY_DEFAULT_MISMATCH'; end if;
 if exists(select 1 from (values ('simple_signup_rollout_events'),('memory_signup_release_bundles'),('memory_signup_runtime_control'),('memory_service_operators'),('memory_service_admin_audit')) t(name)
  where not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname=t.name and c.relrowsecurity))
 then raise exception 'PRIVATE_TABLE_RLS_MISMATCH'; end if;
 if exists(select 1 from (values ('simple_signup_rollout_events'),('memory_signup_release_bundles'),('memory_signup_runtime_control'),('memory_service_operators'),('memory_service_admin_audit')) t(name)
  cross join (values ('anon'),('authenticated'),('service_role')) r(name)
  where has_table_privilege(r.name,'private.'||t.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')) then raise exception 'PRIVATE_TABLE_ACL_MISMATCH'; end if;
 if (select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and
  ((tgrelid='private.simple_signup_rollout_events'::regclass and tgname in ('simple_signup_rollout_events_immutable','simple_signup_rollout_events_no_truncate') and tgfoid='private.protect_service_admin_immutable()'::regprocedure)
   or (tgrelid='private.memory_signup_release_bundles'::regclass and tgname in ('memory_signup_release_bundles_immutable','memory_signup_release_bundles_no_truncate') and tgfoid='private.protect_service_admin_immutable()'::regprocedure)
   or (tgrelid='private.memory_service_admin_audit'::regclass and tgname in ('memory_service_admin_audit_immutable','memory_service_admin_audit_no_truncate') and tgfoid='private.protect_service_admin_immutable()'::regprocedure)
   or (tgrelid='private.memory_signup_release_bundles'::regclass and tgname='memory_signup_release_bundle_validate' and tgfoid='private.check_service_admin_bundle()'::regprocedure)))<>7
 then raise exception 'IMMUTABLE_TRIGGER_MISMATCH'; end if;
end $definitions$;
`;
}
function targetGuard(target,revision){return `do $target$ begin
 if current_database()<>'postgres' then raise exception 'DATABASE_TARGET_MISMATCH'; end if;
 if nullif(current_setting('supabase.project_ref',true),'') is not null and current_setting('supabase.project_ref')<>${q(TARGETS[target])}
 then raise exception 'PROJECT_TARGET_MISMATCH'; end if;
 if nullif(current_setting('app.settings.supabase_url',true),'') is not null and rtrim(current_setting('app.settings.supabase_url'),'/')<>${q(`https://${TARGETS[target]}.supabase.co`)}
 then raise exception 'PROJECT_TARGET_MISMATCH'; end if;
 if (select revision from private.memory_private_media_policy where id) is distinct from ${q(revision)} then raise exception 'PRIVATE_POLICY_TARGET_MISMATCH'; end if;
 ${target==='production'?`if not exists(select 1 from supabase_migrations.schema_migrations m,lateral unnest(m.statements) s(statement)
  where m.version='20260923090000' and s.statement like '-- release MOEMOA_PUBLIC_SIGNUP_SCHEMA_PROD_20261010_01;%')
 then raise exception 'PRODUCTION_RELEASE_MARKER_REQUIRED'; end if;
 if not exists(select 1 from private.memory_publication_settings where singleton and not reads_enabled and not writes_enabled)
 then raise exception 'PUBLIC_MUST_REMAIN_OFF'; end if;`:''}
end $target$;
`;}
const digestSql=`select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') row_hash from %s x) q`;
function preservation(){return `create temp table signup_preserved(table_name text primary key,n bigint,digest text) on commit drop;
do $preserve$ declare t text; n bigint; h text; begin
 for t in select v.name from (values ${PRESERVE.map(t=>`(${q(t)})`).join(',')}) v(name) loop
  execute format('lock table %s in share mode',t);
  execute format(${block(digestSql,'digest')},t) into n,h;
  insert into signup_preserved values(t,n,h);
 end loop;
end $preserve$;
lock table private.simple_signup_policy,private.simple_signup_countries,private.memory_signup_runtime_control in exclusive mode;
create temp table signup_countries_before on commit drop as select country,minimum_age from private.simple_signup_countries;
create temp table signup_functions_before on commit drop as select p.oid,pg_get_functiondef(p.oid) definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and p.proname in ('push_memory_changes','pull_memory_changes','apply_memory_card_mutation','apply_board_mutation');
`;}
function preservationCheck(){return `do $preserve$ declare r record; n bigint; h text; begin
 for r in select * from signup_preserved loop
  execute format(${block(digestSql,'digest')},r.table_name) into n,h;
  if n is distinct from r.n or h is distinct from r.digest then raise exception 'PRESERVED_ROWS_CHANGED'; end if;
 end loop;
 if exists((select country,minimum_age from private.simple_signup_countries except select * from signup_countries_before)
  union all (select * from signup_countries_before except select country,minimum_age from private.simple_signup_countries))
 then raise exception 'HISTORICAL_COUNTRY_ROWS_CHANGED'; end if;
 if exists(select 1 from signup_functions_before f where f.definition is distinct from pg_get_functiondef(f.oid)) then raise exception 'SYNC_FUNCTION_CHANGED'; end if;
end $preserve$;
`;}
const cleanupReadback=`do $cleanup$ declare summary jsonb:='{"available":false,"configured":null,"matchingJobs":null,"latestRunStatus":null}'::jsonb; latest text;
begin
 if to_regclass('cron.job') is not null then
  execute $cron$select jsonb_build_object('available',true,'matchingJobs',count(*),
   'configured',count(*)=1 and coalesce(bool_and(command='select public.purge_simple_signup_transients();' and schedule='17 * * * *' and active),false),
   'latestRunStatus',null) from cron.job where jobname='moemoa-simple-signup-purge'$cron$ into summary;
  if to_regclass('cron.job_run_details') is not null then
   execute $cron$select case when d.status in ('succeeded','failed','running','starting','connecting','sending') then d.status else 'unknown' end
    from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname='moemoa-simple-signup-purge'
    order by d.start_time desc nulls last,d.runid desc limit 1$cron$ into latest;
   summary:=summary||jsonb_build_object('latestRunStatus',latest);
  end if;
 end if;
 -- Connection-local result only, not a persistent setting or a worker success claim.
 perform set_config('moemoa.signup_cleanup_readback',summary::text,true);
end $cleanup$;
`;
function status(release,commit,installed=false){return cleanupReadback+`select jsonb_build_object('release',${q(release)},'generatedFromCommit',${q(commit)},
 'state',private.moemoa_admin_signup_state(),
 'countries',(select jsonb_agg(jsonb_build_object('country',c.country,'minimumAge',c.minimum_age,'enabled',coalesce((to_jsonb(c)->>'enabled')::boolean,true)) order by c.country) from private.simple_signup_countries c),
 'countryMigration',exists(select 1 from supabase_migrations.schema_migrations where version='20261010190000'),
 'activeBundle',(select active_bundle_id from private.memory_signup_runtime_control where singleton),
 'firstActivated',(select first_activated_at is not null from private.memory_signup_runtime_control where singleton),
 'accounts',(select count(*) from auth.users),'receipts',(select count(*) from private.simple_signup_declarations),
 'signupCleanup',current_setting('moemoa.signup_cleanup_readback')::jsonb,
 'publicOff',(select not reads_enabled and not writes_enabled from private.memory_publication_settings where singleton)${installed?`,
 'recordedRolloutEvents',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) from
  (select release_id,action,source_commit,migration_sha256,created_at from private.simple_signup_rollout_events order by created_at desc limit 10) e)`:''});
`;}
const preservationSummary=`select jsonb_build_object('preservedFullTables',(select count(*) from signup_preserved),'allPreservedRowsUnchanged',true,
 'historicalCountryRowsAndAgesUnchanged',true,'syncFunctionsUnchanged',true,'publicAndRolesUnchanged',true,'definitionsAndPermissionsMatch',true);
`;
export function buildRelease({target,action='inspect',mode='rollback',expectedPrivateRevision,expectedRevision,commit,sources}){
 if(!Object.hasOwn(TARGETS,target))throw Error('FIXED_TARGET_REQUIRED');
 if(!['inspect','readback','schema','stage','activate','pause'].includes(action)||!['rollback','apply'].includes(mode))throw Error('INVALID_MODE');
 if(action==='schema'&&target!=='test')throw Error('SCHEMA_ONLY_TEST_TARGET');
 if(!/^[a-f0-9]{40}$/.test(commit||''))throw Error('SOURCE_COMMIT_REQUIRED');
 const parts=manifestParts(sources),migration=parts.at(-1),mutating=!['inspect','readback'].includes(action);
 if(mutating&&!/^[a-f0-9]{64}$/.test(expectedRevision||''))throw Error('OBSERVED_SIGNUP_REVISION_REQUIRED');
 if(action!=='inspect'&&expectedPrivateRevision!==({test:'TEST_ONLY_PHONE_WEB_20260927_01',production:'MOEMOA_PRIVATE_20261008_01'}[target]))throw Error('OBSERVED_PRIVATE_REVISION_REQUIRED');
 const release=`MOEMOA_FIRST_SIGNUP_KR_US_TH_${action.toUpperCase()}_${target==='test'?'TEST':'PROD'}_20261010_01`;
 const manifest={release,target:TARGETS[target],sourceCommit:commit,action,mode:mutating?mode:'read-only',remoteExecution:false,
  bundle:BUNDLE,countries:COUNTRIES,migrations:parts.map(({file,version,sha256})=>({file,version,sha256}))};
 let sql=`-- ${release}; source ${commit}. Execute only at dashboard /project/${TARGETS[target]}/sql/.
-- Dashboard URL + observed policy/release markers are the target boundary; no fake JWT setting.
-- Sequence: stage -> verify deployed UI/server flags, Google redirect and Before User Created Hook -> activate.
-- Stage and rollback/pause ALWAYS keep admission=true. Never restore the old unguarded configuration.
begin${mutating?'':' isolation level repeatable read read only'};
set local lock_timeout='5s'; set local statement_timeout='60s';
`;
 if(action==='inspect')return {sql:sql+status(release,commit)+'rollback;\n',manifest};
 sql+=targetGuard(target,expectedPrivateRevision);
 if(!mutating)return {sql:sql+ledger(parts,{stage:false,release,commit})+definitions(parts)+status(release,commit,true)+'rollback;\n',manifest};
 sql+=`select pg_advisory_xact_lock(20261010,190000);
lock table supabase_migrations.schema_migrations in exclusive mode;
`+preservation()+`create temp table signup_release_before on commit drop as select private.moemoa_admin_signup_state()->>'revision' revision;
do $revision$ begin
 if (select revision from signup_release_before) is distinct from ${q(expectedRevision)} then raise exception 'SIGNUP_REVISION_CONFLICT'; end if;
end $revision$;
`+ledger(parts,{stage:['schema','stage'].includes(action),release,commit})+definitions(parts);
 if(action==='schema')return {sql:sql+`do $unchanged$ begin
 if private.moemoa_admin_signup_state()->>'revision' is distinct from (select revision from signup_release_before)
 then raise exception 'MIGRATION_CHANGED_SIGNUP_STATE'; end if;
end $unchanged$;
`+preservationCheck()+preservationSummary+status(release,commit,true)+(mode==='apply'?"notify pgrst, 'reload schema';\ncommit;\n":'rollback;\n'),manifest};
 const countries=q(JSON.stringify(COUNTRIES))+'::jsonb';
 sql+=`do $release$ declare after_token text; begin
 if exists(select 1 from private.simple_signup_rollout_events where release_id=${q(release)}) then raise exception 'RELEASE_ALREADY_APPLIED_REVIEW_CURRENT_STATE'; end if;
 if (select count(*) from private.simple_signup_policy where singleton)<>1 or (select count(*) from private.memory_signup_runtime_control where singleton)<>1
 then raise exception 'SINGLETON_STATE_REQUIRED'; end if;
 ${action==='stage'?`if exists(select 1 from private.simple_signup_policy where enabled) or exists(select 1 from private.memory_signup_runtime_control where active_bundle_id is not null or first_activated_at is not null)
 then raise exception 'FIRST_RELEASE_REQUIRES_PAUSED_UNACTIVATED_STATE'; end if;
 if (select count(*) from private.simple_signup_countries where (country='KR' and minimum_age=14) or (country in ('US','TH') and minimum_age=13))<>3
 then raise exception 'REVIEWED_COUNTRY_AGES_REQUIRED'; end if;
 update private.simple_signup_countries set enabled=country in ('KR','US','TH');
 update private.simple_signup_policy set enabled=false,admission_enabled=true,policy_version='simple-signup-2026-10-10',terms_version='terms-2026-10-10',privacy_version='privacy-2026-10-10' where singleton;
 insert into private.memory_signup_release_bundles(id,policy_version,terms_version,privacy_version,countries,production_ready)
 values(${q(BUNDLE)},'simple-signup-2026-10-10','terms-2026-10-10','privacy-2026-10-10',${countries},true);
 update private.memory_signup_runtime_control set revision=revision+1 where singleton;`:`if not exists(select 1 from private.simple_signup_policy where singleton and admission_enabled and policy_version='simple-signup-2026-10-10'
  and terms_version='terms-2026-10-10' and privacy_version='privacy-2026-10-10')
  or private.moemoa_admin_signup_state()->'signup'->'countries' is distinct from ${countries}
  or not exists(select 1 from private.memory_signup_release_bundles where id=${q(BUNDLE)} and production_ready and policy_version='simple-signup-2026-10-10'
   and terms_version='terms-2026-10-10' and privacy_version='privacy-2026-10-10' and countries=${countries}) then raise exception 'REVIEWED_STAGE_REQUIRED'; end if;
 ${action==='activate'?`if exists(select 1 from private.simple_signup_policy where enabled) or exists(select 1 from private.memory_signup_runtime_control where active_bundle_id is not null or first_activated_at is not null)
  or not exists(select 1 from private.simple_signup_rollout_events where action='STAGE' and release_id=${q(release.replace('_ACTIVATE_','_STAGE_'))}) then raise exception 'FIRST_ACTIVATION_ONLY'; end if;
 update private.memory_signup_runtime_control set active_bundle_id=${q(BUNDLE)},first_activated_at=clock_timestamp(),revision=revision+1 where singleton;
 update private.simple_signup_policy set enabled=true,admission_enabled=true where singleton;`:`update private.simple_signup_policy set enabled=false,admission_enabled=true where singleton;
 update private.memory_signup_runtime_control set revision=revision+1 where singleton;`}`}
 if not exists(select 1 from private.simple_signup_policy where singleton and admission_enabled and enabled=${action==='activate'})
  or private.moemoa_admin_signup_state()->'signup'->'countries' is distinct from ${countries}
  ${action==='activate'?"or (private.moemoa_admin_signup_state()->'signup'->>'readyForResume')::boolean is distinct from true":''}
 then raise exception 'FINAL_ACTIVATION_STATE_MISMATCH'; end if;
 after_token:=private.moemoa_admin_signup_state()->>'revision';
 insert into private.simple_signup_rollout_events(release_id,action,source_commit,migration_sha256,before_revision,after_revision)
  values(${q(release)},${q(action.toUpperCase())},${q(commit)},${q(migration.sha256)},(select revision from signup_release_before),after_token);
end $release$;
`+preservationCheck()+preservationSummary+status(release,commit,true)+(mode==='apply'?"notify pgrst, 'reload schema';\ncommit;\n":'rollback;\n');
 return {sql,manifest};
}
export function main(argv=process.argv.slice(2)){
 const options={};for(const arg of argv){const m=arg.match(/^--(target|action|mode|expected-private-revision|expected-revision)=(.+)$/);if(!m||Object.hasOwn(options,m[1]))throw Error('INVALID_ARGUMENT');options[m[1]]=m[2];}
 const result=buildRelease({...committedSources(),target:options.target,action:options.action,mode:options.mode,
  expectedPrivateRevision:options['expected-private-revision'],expectedRevision:options['expected-revision']});
 const directory=resolve(ROOT,'.cache/first-signup-release');mkdirSync(directory,{recursive:true});
 const stem=`${options.target}-${options.action||'inspect'}-${options.mode||'rollback'}`;
 const sqlPath=resolve(directory,`${stem}.sql`),manifestPath=resolve(directory,`${stem}.json`);
 writeFileSync(sqlPath,result.sql);writeFileSync(manifestPath,JSON.stringify({...result.manifest,sqlSha256:hash(result.sql)},null,2)+'\n');
 process.stdout.write(JSON.stringify({sqlPath,manifestPath,...result.manifest})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{main();}catch(error){
 process.stderr.write(`FIRST_SIGNUP_RELEASE_PREPARATION_FAILED (${/^[A-Z_]+$/.test(error.message)?error.message:'CHECK_COMMITTED_SOURCES'}); no remote execution.\n`);process.exitCode=1;
}}
