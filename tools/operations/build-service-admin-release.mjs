#!/usr/bin/env node
// Generates reviewed SQL only. Never connects to a database, reads credentials,
// activates signup/Public, or grants a role as part of the schema transaction.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const TARGETS=Object.freeze({test:'nmgkhknponvzcwliajyk',production:'okchpyagfucpzpyrfgol'});
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const SELF='tools/operations/build-service-admin-release.mjs';
export const MIGRATIONS=Object.freeze([
 'supabase/migrations/20261010170000_simple_signup_receipts.sql',
 'supabase/migrations/20261010180000_service_admin.sql',
]);
const PRESERVE=['auth.users','auth.identities','public.user_profiles','public.memory_private_titles',
 'public.memory_cards','public.memory_visual_assets','public.memory_boards','public.memory_board_cards',
 'public.sync_operations','private.memory_private_media','private.memory_private_media_policy',
 'private.memory_public_assets','private.memory_publications','private.memory_minihomes',
 'private.memory_publication_settings','private.memory_publication_delete_fences','private.memory_moderators',
 'private.memory_reports','private.memory_moderation_notices','private.memory_moderation_audit',
 'private.simple_signup_policy','private.simple_signup_countries','private.simple_signup_declarations',
 'private.simple_signup_admissions','private.simple_signup_handoffs','storage.objects'];
const normalize=value=>value.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
const hash=value=>createHash('sha256').update(value).digest('hex');
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
function block(value,tag){if(value.includes(`$${tag}$`))throw Error('SOURCE_DELIMITER');return `$${tag}$${value}$${tag}$`;}
function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}

export function committedSources(root=ROOT){
 const commit=git(root,'rev-parse','HEAD').trim();
 if(!/^[a-f0-9]{40}$/.test(commit))throw Error('SOURCE_COMMIT_REQUIRED');
 const sources=new Map();
 for(const file of [SELF,...MIGRATIONS]){
  const source=normalize(git(root,'show',`HEAD:${file}`));
  if(source!==normalize(readFileSync(resolve(root,file),'utf8')))throw Error('UNCOMMITTED_RELEASE_SOURCE');
  sources.set(file,source);
 }
 return {commit,sources};
}

function selected(target){if(!Object.hasOwn(TARGETS,target))throw Error('FIXED_TARGET_REQUIRED');return TARGETS[target];}
const operatorPredicate=`lower(u.email)='godburgundy@gmail.com' and not coalesce(u.is_anonymous,false)
 and u.email_confirmed_at is not null
 and u.raw_user_meta_data->'email_verified'='true'::jsonb
 and exists(select 1 from auth.identities i where i.user_id=u.id and i.provider='google')`;
function inspectSql(target){
 const ref=selected(target);
 return `-- READ ONLY. First confirm dashboard URL /project/${ref}/sql/.
begin isolation level repeatable read read only;
set local statement_timeout='15s';
select jsonb_build_object('target',${quote(ref)},'readOnly',true,
 'projectRefSettingMatches',nullif(current_setting('supabase.project_ref',true),'')=${quote(ref)},
 'projectUrlSettingMatches',nullif(current_setting('app.settings.supabase_url',true),'')=${quote(`https://${ref}.supabase.co`)},
 'privatePolicyRevision',(select revision from private.memory_private_media_policy where id),
 'signup',public.get_simple_signup_policy(),
 'existingOperatorAccounts',(select count(*) from auth.users u where ${operatorPredicate}),
 'selectedAccountIsModerator',exists(select 1 from auth.users u join private.memory_moderators m on m.user_id=u.id and m.enabled where ${operatorPredicate}),
 'receiptMigration',exists(select 1 from supabase_migrations.schema_migrations where version='20261010170000'),
 'adminMigration',exists(select 1 from supabase_migrations.schema_migrations where version='20261010180000'),
 'publicOff',(select not reads_enabled and not writes_enabled from private.memory_publication_settings where singleton));
rollback;
`;
}

function startGuard(target,expectedPrivateRevision){
 const ref=selected(target);
 if(!/^[A-Za-z0-9_-]{1,120}$/.test(expectedPrivateRevision||''))throw Error('OBSERVED_PRIVATE_REVISION_REQUIRED');
 if(target==='test'&&expectedPrivateRevision!=='TEST_ONLY_PHONE_WEB_20260927_01')throw Error('TEST_POLICY_MARKER_REQUIRED');
 if(target==='production'&&/test/i.test(expectedPrivateRevision))throw Error('PRODUCTION_POLICY_MARKER_REQUIRED');
 // Dashboard SQL has no universally guaranteed project-ref setting. Do not set a
 // fake JWT issuer and claim it proves identity. Require the observed policy and
 // existing release marker, plus operator verification of the exact dashboard URL.
 return `-- Execute only after confirming dashboard URL /project/${ref}/sql/.
-- Identity boundary: dashboard URL + observed policy/release markers below.
begin;
set local lock_timeout='5s'; set local statement_timeout='60s';
select pg_advisory_xact_lock(20261010,180000);
lock table supabase_migrations.schema_migrations in exclusive mode;
do $target$
begin
 if current_database()<>'postgres' then raise exception 'DATABASE_TARGET_MISMATCH'; end if;
 if nullif(current_setting('supabase.project_ref',true),'') is not null
  and current_setting('supabase.project_ref')<>${quote(ref)} then raise exception 'PROJECT_TARGET_MISMATCH'; end if;
 if nullif(current_setting('app.settings.supabase_url',true),'') is not null
  and rtrim(current_setting('app.settings.supabase_url'),'/')<>${quote(`https://${ref}.supabase.co`)}
 then raise exception 'PROJECT_TARGET_MISMATCH'; end if;
 if (select revision from private.memory_private_media_policy where id) is distinct from ${quote(expectedPrivateRevision)}
 then raise exception 'PRIVATE_POLICY_TARGET_MISMATCH'; end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261009143000')
 then raise exception 'BASELINE_MIGRATION_REQUIRED'; end if;
 ${target==='production'?`if not exists(select 1 from supabase_migrations.schema_migrations m,lateral unnest(m.statements) s(statement)
  where m.version='20260923090000' and s.statement like '-- release MOEMOA_PUBLIC_SIGNUP_SCHEMA_PROD_20261010_01;%')
 then raise exception 'PRODUCTION_RELEASE_MARKER_REQUIRED'; end if;`:''}
end $target$;
`;
}

function preservation(){
 const rows=PRESERVE.map(table=>`(${quote(table)})`).join(',');
 return `create temp table service_admin_preserved(table_name text primary key,n bigint,digest text) on commit drop;
do $preserve$ declare t text; n bigint; h text;
begin
 for t in select v.name from (values ${rows}) v(name) loop
  execute format('lock table %s in share mode',t);
  execute format($digest$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') row_hash from %s x) q$digest$,t) into n,h;
  insert into service_admin_preserved values(t,n,h);
 end loop;
end $preserve$;
create temp table service_admin_preserved_functions on commit drop as
 select p.oid,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('push_memory_changes','pull_memory_changes','apply_memory_card_mutation','apply_board_mutation');
`;
}
function preservationCheck(){return `do $preserve$ declare r record; n bigint; h text;
begin
 for r in select * from service_admin_preserved loop
  execute format($digest$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex') from (select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex') row_hash from %s x) q$digest$,r.table_name) into n,h;
  if n is distinct from r.n or h is distinct from r.digest then raise exception 'EXISTING_ROWS_CHANGED'; end if;
 end loop;
 if exists(select 1 from service_admin_preserved_functions f where f.definition is distinct from pg_get_functiondef(f.oid))
 then raise exception 'SYNC_FUNCTION_CHANGED'; end if;
end $preserve$;
`;}

function migrationParts(file,source){
 const [,version,name]=file.match(/\/(\d{14})_([a-z_]+)\.sql$/)||[];
 if(!version||/^(begin|commit|rollback)\s*;/im.test(source))throw Error('INVALID_MIGRATION');
 const funcs=[...source.matchAll(/create function ([a-z_.]+)\(([^)]*)\) returns (\w+)\s+([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$;/g)].map(([,name,args,returns,header,body])=>{
  const params=args?args.split(',').map(arg=>arg.trim().split(/\s+/)):[];
  return {name,signature:`${name}(${params.map(p=>p[1]).join(',')})`,returns,body,
   language:header.match(/language (\w+)/)?.[1],definer:/security definer/.test(header),
   volatility:/\bstable\b/.test(header)?'s':/\bimmutable\b/.test(header)?'i':'v',
   config:[...header.matchAll(/set ([a-z_]+)='([^']*)'/g)].map(([,name,value])=>`${name}=${value||'""'}`),
   argNames:params.map(p=>p[0])};
 });
 if(funcs.length!==(version==='20261010170000'?1:6))throw Error('FUNCTION_MANIFEST_MISMATCH');
 return {version,name,funcs,source,sha256:hash(source)};
}

function definitionsCheck(parts){
 const checks=parts.flatMap(p=>p.funcs).map(f=>{
  const config=f.config.length?`array[${f.config.map(quote).join(',')}]::text[]`:'null::text[]';
  const names=f.argNames.length?`array[${f.argNames.map(quote).join(',')}]::text[]`:'null::text[]';
  const publicRpc=f.name.startsWith('public.');
  return `if not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure(${quote(f.signature)})
   and replace(p.prosrc,chr(13)||chr(10),chr(10))=replace(${block(f.body,'body')},chr(13)||chr(10),chr(10))
   and p.prosecdef=${f.definer} and p.provolatile=${quote(f.volatility)} and l.lanname=${quote(f.language)}
   and p.prorettype=${quote(f.returns)}::regtype and not p.proretset and p.proconfig is not distinct from ${config}
   and p.proargnames is not distinct from ${names}) then raise exception 'MIGRATION_FUNCTION_MISMATCH'; end if;
  if has_function_privilege('anon',${quote(f.signature)},'EXECUTE') or has_function_privilege('service_role',${quote(f.signature)},'EXECUTE')
   or has_function_privilege('authenticated',${quote(f.signature)},'EXECUTE') is distinct from ${publicRpc}
  then raise exception 'MIGRATION_FUNCTION_ACL_MISMATCH'; end if;`;
 }).join('\n');
 return `do $definitions$ begin
 ${checks}
 if exists(select 1 from (values ('memory_service_operators'),('memory_signup_release_bundles'),('memory_signup_runtime_control'),('memory_service_admin_audit')) t(name)
  where not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname=t.name and c.relrowsecurity))
 then raise exception 'ADMIN_TABLE_RLS_MISMATCH'; end if;
 if exists(select 1 from (values ('memory_service_operators'),('memory_signup_release_bundles'),('memory_signup_runtime_control'),('memory_service_admin_audit')) t(name)
  cross join (values ('anon'),('authenticated'),('service_role')) r(name)
  where has_table_privilege(r.name,'private.'||t.name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'))
 then raise exception 'ADMIN_TABLE_ACL_MISMATCH'; end if;
 if (select count(*) from pg_trigger where not tgisinternal and tgenabled='O' and
  ((tgrelid='private.memory_service_admin_audit'::regclass and tgname in ('memory_service_admin_audit_immutable','memory_service_admin_audit_no_truncate') and tgfoid='private.protect_service_admin_immutable()'::regprocedure)
   or (tgrelid='private.memory_signup_release_bundles'::regclass and tgname in ('memory_signup_release_bundles_immutable','memory_signup_release_bundles_no_truncate') and tgfoid='private.protect_service_admin_immutable()'::regprocedure)
   or (tgrelid='private.memory_signup_release_bundles'::regclass and tgname='memory_signup_release_bundle_validate' and tgfoid='private.check_service_admin_bundle()'::regprocedure)))<>5
 then raise exception 'ADMIN_TRIGGER_MISMATCH'; end if;
end $definitions$;
`;
}

export function buildRelease({target,action='inspect',mode='rollback',expectedPrivateRevision,commit,sources}){
 const ref=selected(target);
 if(!['inspect','schema','operator'].includes(action)||!['rollback','apply'].includes(mode))throw Error('INVALID_MODE');
 if(!/^[a-f0-9]{40}$/.test(commit||''))throw Error('SOURCE_COMMIT_REQUIRED');
 const parts=MIGRATIONS.map(file=>{const source=sources.get(file);if(typeof source!=='string')throw Error('MISSING_SOURCE');return {file,...migrationParts(file,normalize(source))};});
 const release=`MOEMOA_SERVICE_ADMIN_${action.toUpperCase()}_${target==='test'?'TEST':'PROD'}_20261010_01`;
 const manifest={release,target:ref,sourceCommit:commit,action,mode,
  migrations:parts.map(({file,version,sha256})=>({file,version,sha256})),remoteExecution:false};
 if(action==='inspect')return {sql:inspectSql(target),manifest};
 let sql=startGuard(target,expectedPrivateRevision)+preservation();
 for(const p of parts){
  const sourceLiteral=block(p.source,'migration_source');
  const ledger=block(`-- release ${release}; source ${commit}; sha256 ${p.sha256}\n${p.source}`,'migration_ledger');
  sql+=`do $migration$ declare installed text; begin
 if exists(select 1 from supabase_migrations.schema_migrations where version=${quote(p.version)}) then
  select case when cardinality(statements)=1 and name=${quote(p.name)} then statements[1] end into installed
   from supabase_migrations.schema_migrations where version=${quote(p.version)};
  installed:=replace(installed,chr(13)||chr(10),chr(10));
  if installed is null or regexp_replace(installed,'^-- release[^\\n]*\\n','') is distinct from replace(${sourceLiteral},chr(13)||chr(10),chr(10))
  then raise exception 'EXISTING_MIGRATION_LEDGER_MISMATCH'; end if;
 else
  ${action==='schema'?`execute ${sourceLiteral};
  insert into supabase_migrations.schema_migrations(version,name,statements) values(${quote(p.version)},${quote(p.name)},array[${ledger}]);`:`raise exception 'ADMIN_MIGRATION_REQUIRED';`}
 end if;
end $migration$;\n`;
 }
 sql+=definitionsCheck(parts);
 if(action==='operator')sql+=`do $operator$ declare selected uuid; begin
 if (select count(*) from auth.users u where ${operatorPredicate})<>1 then raise exception 'EXACT_CONFIRMED_GOOGLE_OPERATOR_REQUIRED'; end if;
 select u.id into selected from auth.users u where ${operatorPredicate};
 ${target==='production'?`if not exists(select 1 from private.memory_moderators where user_id=selected and enabled) then raise exception 'EXISTING_MODERATOR_REQUIRED'; end if;`:''}
 if exists(select 1 from private.memory_service_operators where user_id<>selected and enabled) then raise exception 'OTHER_SERVICE_OPERATOR_PRESENT'; end if;
 insert into private.memory_service_operators(user_id,enabled) values(selected,true) on conflict(user_id) do update set enabled=true;
end $operator$;\n`;
 sql+=preservationCheck();
 sql+=`select jsonb_build_object('release',${quote(release)},'target',${quote(ref)},'sourceCommit',${quote(commit)},
 'mode',${quote(mode)},'preservedTables',(select count(*) from service_admin_preserved),'allRowsUnchanged',true,'syncFunctionsUnchanged',true,
 'definitionsAndPermissionsMatch',true,'signupAndPublicUnchanged',true,
 'enabledServiceOperators',(select count(*) from private.memory_service_operators where enabled),
 'signup',public.get_simple_signup_policy(),'migrations',${quote(JSON.stringify(manifest.migrations))}::jsonb);
${mode==='apply'?"notify pgrst, 'reload schema';\ncommit;":'rollback;'}\n`;
 return {sql,manifest};
}

export function main(argv=process.argv.slice(2)){
 const options={};
 for(const arg of argv){const match=arg.match(/^--(target|action|mode|expected-private-revision)=(.+)$/);if(!match||Object.hasOwn(options,match[1]))throw Error('INVALID_ARGUMENT');options[match[1]]=match[2];}
 const source=committedSources();
 const result=buildRelease({target:options.target,action:options.action,mode:options.mode,
  expectedPrivateRevision:options['expected-private-revision'],...source});
 const directory=resolve(ROOT,'.cache/service-admin-release');mkdirSync(directory,{recursive:true});
 const stem=`${options.target}-${options.action||'inspect'}-${options.mode||'rollback'}`;
 const sqlPath=resolve(directory,`${stem}.sql`),manifestPath=resolve(directory,`${stem}.json`);
 writeFileSync(sqlPath,result.sql);writeFileSync(manifestPath,JSON.stringify({...result.manifest,sqlSha256:hash(result.sql)},null,2)+'\n');
 process.stdout.write(JSON.stringify({sqlPath,manifestPath,...result.manifest})+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main();}catch{process.stderr.write('SERVICE_ADMIN_RELEASE_PREPARATION_FAILED; no remote execution; check committed sources and fixed target arguments.\n');process.exitCode=1;}
}
