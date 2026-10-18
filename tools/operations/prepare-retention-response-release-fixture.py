#!/usr/bin/env python3
"""Emit a synthetic disposable-local-DB contract; never connect to hosted DBs."""
import hashlib
import importlib.util
from pathlib import Path
import re

spec=importlib.util.spec_from_file_location('df02_apply',Path(__file__).with_name('apply-production-retention-response.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
source=module.MIGRATION.read_text(encoding='utf-8')
body=source.split('as $$',1)[1].split('$$;',1)[0]
digest=hashlib.md5(re.sub(r'\s','',body).encode()).hexdigest()
print("""
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
create schema cron;
create table cron.job(jobname text,active boolean,schedule text,command text);
insert into cron.job values('moemoa-memory-retention-daily',true,'15 3 * * *','select public.purge_expired_memory_tombstones(now())');
create temp table df02_original as select oid,prosrc,proacl,proowner,proconfig,pg_get_functiondef(oid) as definition from pg_proc
where oid='public.purge_expired_memory_tombstones(timestamptz)'::regprocedure;
""")
print(module.apply_sql(source,'a'*40))
print(f"""
do $test$ begin
if (select md5(regexp_replace(prosrc,'\\s','','g')) from pg_proc where oid='public.purge_expired_memory_tombstones(timestamptz)'::regprocedure) <> '{digest}'
 or not exists(select 1 from supabase_migrations.schema_migrations where version='{module.VERSION}' and statements[1] like '%sourceCommit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa%')
 then raise exception 'release definition/ledger mismatch'; end if;
raise notice 'PASS: DF02 exact executor SQL installs tested definition and source ledger';
if exists(select 1 from pg_proc p join df02_original o on o.oid=p.oid where p.proacl is distinct from o.proacl or p.proowner<>o.proowner or p.proconfig is distinct from o.proconfig)
 then raise exception 'release metadata changed'; end if;
raise notice 'PASS: DF02 executor preserves OID owner ACL and search path';
end $test$;
""")
print('do $restore$ begin execute (select definition from df02_original); end $restore$;')
print(f"""
delete from supabase_migrations.schema_migrations where version='{module.VERSION}';
do $test$ begin
if not exists(select 1 from pg_proc p join df02_original o on o.oid=p.oid where p.prosrc=o.prosrc and p.proacl is not distinct from o.proacl and p.proowner=o.proowner and p.proconfig is not distinct from o.proconfig)
 then raise exception 'function rollback mismatch'; end if;
raise notice 'PASS: DF02 original function rollback restores definition and permissions';
end $test$;
""")
