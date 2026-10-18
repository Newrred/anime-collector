#!/usr/bin/env python3
"""DF-02 candidate: inspect by default; exact approved Git SHA required for DDL.

Only function definition and migration ledger change. Never invokes purge.
The existing daily job will subsequently scrub absent-owner-entity bodies.
Function rollback cannot restore any bodies subsequently scrubbed by that job.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[2]
VERSION='20261019090000'
RELEASE='MOEMOA_DF02_RETENTION_RESPONSE_PROD_20261019_01'
MIGRATION=ROOT/'supabase/migrations/20261019090000_memory_retention_response_cleanup.sql'
SIGNATURE='public.purge_expired_memory_tombstones(timestamptz)'
BASELINE='1685c42612f6214296cf06258ab37e919244fbf11e5977701ce71f1e49a5ef9a'
METADATA='5c24cef493b342844aeeaef5a02468c8b2b86de072feb3ba2d017eb57818d8ae'
spec=importlib.util.spec_from_file_location('df02_inspect',Path(__file__).with_name('inspect-retention-response.py'))
inspect_tool=importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspect_tool)


def require(condition):
    if not condition:
        raise ValueError('SOURCE_OR_BASELINE_MISMATCH')


def verify_source(commit):
    require(bool(commit and re.fullmatch('[0-9a-f]{40}',commit)))
    def git(*args):
        result=subprocess.run(['git','-C',str(ROOT),*args],capture_output=True,timeout=15)
        require(result.returncode==0)
        return result.stdout
    require(git('rev-parse','HEAD').decode().strip()==commit)
    for path in [MIGRATION,Path(__file__).resolve(),ROOT/'tools/operations/inspect-retention-response.py',ROOT/'tools/operations/inspect-retention.py',ROOT/'tools/operations/retention-response-candidate.sql',ROOT/'supabase/migrations/20260902055512_memory_user_retention.sql']:
        committed=git('show',commit+':'+path.relative_to(ROOT).as_posix()).replace(b'\r\n',b'\n')
        require(path.read_bytes().replace(b'\r\n',b'\n')==committed)
    old=(ROOT/'tools/operations/retention-response-candidate.sql').read_text(encoding='utf-8')
    source=MIGRATION.read_text(encoding='utf-8')
    require(source[source.index('create or replace'):]==old[old.index('create or replace'):])
    return source


def literal(value):
    require('$df02_value$' not in value)
    return '$df02_value$'+value+'$df02_value$'


def apply_sql(source,commit):
    old=inspect_tool.source_body(ROOT/'supabase/migrations/20260902055512_memory_user_retention.sql')
    old_md5=hashlib.md5(re.sub(r'\s','',old).encode()).hexdigest()
    new=source.split('as $$',1)[1].split('$$;',1)[0]
    ledger=f'-- release {RELEASE}; sourceCommit {commit}; sha256 {hashlib.sha256(source.encode()).hexdigest()}\n'+source
    return f"""begin;
set local statement_timeout='30s'; set local lock_timeout='5s';
select pg_advisory_xact_lock(20261019,90001);
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $guard$ begin
if exists(select 1 from supabase_migrations.schema_migrations where version='{VERSION}')
 or (select md5(regexp_replace(prosrc,'\\s','','g')) from pg_proc where oid='{SIGNATURE}'::regprocedure) is distinct from '{old_md5}'
 or not exists(select 1 from pg_proc p where p.oid='{SIGNATURE}'::regprocedure
 and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef and p.proconfig=ARRAY['search_path=""']
 and p.proacl::text='{{postgres=X/postgres,service_role=X/postgres}}'
 and pg_get_function_arguments(p.oid)='p_now timestamp with time zone DEFAULT now()'
 and pg_get_function_result(p.oid)='jsonb')
 or not exists(select 1 from cron.job where jobname='moemoa-memory-retention-daily'
 and active and schedule='15 3 * * *' and command='select public.purge_expired_memory_tombstones(now())')
 then raise exception 'DF02_BASELINE_CHANGED'; end if;
end $guard$;
{source}
do $guard$ begin
if (select prosrc from pg_proc where oid='{SIGNATURE}'::regprocedure) is distinct from {literal(new)}
 or (select proacl::text from pg_proc where oid='{SIGNATURE}'::regprocedure) is distinct from '{{postgres=X/postgres,service_role=X/postgres}}'
 then raise exception 'DF02_RESULT_MISMATCH'; end if;
end $guard$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values('{VERSION}','memory_retention_response_cleanup',ARRAY[{literal(ledger)}]);
commit;"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--expected-commit')
    args=parser.parse_args()
    try:
        source=verify_source(args.expected_commit) if args.apply else None
        before=inspect_tool.inspect('production')
        if not args.apply:
            print(json.dumps({'release':RELEASE,'mode':'READ_ONLY','state':before}))
            return 0
        require(before['bodyFingerprint']==BASELINE and before['metadataSha256']==METADATA)
        require(before['baseMigrationPresent'] and not before['candidateMigrationPresent'])
        require(before['impact']['unknownEntityTypeBodies']==0)
        env=inspect_tool.retention.connection('production')
        result=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=apply_sql(source,args.expected_commit),env=env,capture_output=True,text=True,timeout=45)
        require(result.returncode==0)
        after=inspect_tool.inspect('production')
        require(after['approvedTestFunction'] and after['candidateMigrationPresent'] and after['metadataSha256']==METADATA)
        require({k:after['job'][k] for k in ['active','schedule','expectedCommand']}=={k:before['job'][k] for k in ['active','schedule','expectedCommand']})
        print(json.dumps({'release':RELEASE,'sourceCommit':args.expected_commit,'mode':'APPLIED_AND_INDEPENDENTLY_READ_BACK','manualPurge':False,'before':before,'after':after}))
        return 0
    except Exception:
        print(json.dumps({'release':RELEASE,'error':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY'}))
        return 1


if __name__=='__main__':
    raise SystemExit(main())
