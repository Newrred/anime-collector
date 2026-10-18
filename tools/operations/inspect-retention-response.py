#!/usr/bin/env python3
"""DF-02 read-only function/impact comparison. No payloads or identifiers output."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SIGNATURE = 'public.purge_expired_memory_tombstones(timestamptz)'
VERSION = '20261019090000'
SPEC = importlib.util.spec_from_file_location('retention', Path(__file__).with_name('inspect-retention.py'))
retention = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(retention)
KINDS = [('PRIVATE_TITLE', 'memory_private_titles'), ('MEMORY_CARD', 'memory_cards'),
         ('VISUAL_ASSET', 'memory_visual_assets'), ('MEMORY_BOARD', 'memory_boards'),
         ('MEMORY_BOARD_CARD', 'memory_board_cards')]


def fingerprint(source):
    return hashlib.sha256(re.sub(r'\s', '', source).encode()).hexdigest()


def source_body(path):
    return path.read_text(encoding='utf-8').split('as $$', 1)[1].split('$$;', 1)[0]


def query_sql():
    absent = ' and '.join(f"not exists(select 1 from public.{table} e where o.entity_type='{kind}' and e.user_id=o.user_id and e.id=o.entity_id)" for kind, table in KINDS)
    exists_deleted = ' or '.join(f"exists(select 1 from public.{table} e where o.entity_type='{kind}' and e.user_id=o.user_id and e.id=o.entity_id and e.deleted_at is not null)" for kind, table in KINDS)
    exists_active = ' or '.join(f"exists(select 1 from public.{table} e where o.entity_type='{kind}' and e.user_id=o.user_id and e.id=o.entity_id and e.deleted_at is null)" for kind, table in KINDS)
    expired = ','.join(f"'{kind}',(select count(*) from public.{table} where deleted_at < now()-interval '30 days')" for kind, table in KINDS)
    return f"""begin read only;
set local statement_timeout='20s'; set local lock_timeout='3s';
select jsonb_build_object('at',now(), 'body',p.prosrc,'definition',pg_get_functiondef(p.oid),
 'metadata',jsonb_build_object('owner',pg_get_userbyid(p.proowner),'securityDefiner',p.prosecdef,
 'config',p.proconfig,'arguments',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),
 'acl',p.proacl::text,'serviceRole',has_function_privilege('service_role',p.oid,'EXECUTE'),
 'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
 'public',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0)),
 'impact',(select jsonb_build_object('bodyRows',count(*),
 'orphanBodies',count(*) filter(where {absent}),
 'deletedEntityBodies',count(*) filter(where {exists_deleted}),
 'activeEntityBodies',count(*) filter(where {exists_active}),
 'unknownEntityTypeBodies',count(*) filter(where entity_type not in ('PRIVATE_TITLE','MEMORY_CARD','VISUAL_ASSET','MEMORY_BOARD','MEMORY_BOARD_CARD')))
 from public.sync_operations o where result_payload ? 'remoteEntity' and result_payload->'remoteEntity' is distinct from 'null'::jsonb),
 'expiredEntities',jsonb_build_object({expired}),
 'entityTypeConstraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.sync_operations'::regclass and conname='sync_operations_entity_type_check'),
 'baseMigrationPresent',exists(select 1 from supabase_migrations.schema_migrations where version='20260902055512'),
 'candidateMigrationPresent',exists(select 1 from supabase_migrations.schema_migrations where version='{VERSION}'),
 'job',(select jsonb_build_object('schedule',j.schedule,'active',j.active,
 'expectedCommand',j.command='select public.purge_expired_memory_tombstones(now())',
 'latestRun',(select jsonb_build_object('status',r.status,'started',r.start_time,'ended',r.end_time)
 from cron.job_run_details r where r.jobid=j.jobid order by r.runid desc limit 1))
 from cron.job j where j.jobname='moemoa-memory-retention-daily'))
from pg_proc p where p.oid=to_regprocedure('{SIGNATURE}');
rollback;"""


def inspect(target):
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],
        input=query_sql(), env=retention.connection(target), capture_output=True, text=True, timeout=35)
    if result.returncode:
        raise RuntimeError('DATABASE_READ_FAILED')
    rows = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    if len(rows) != 1:
        raise RuntimeError('SNAPSHOT_INVALID')
    state = rows[0]
    body = state.pop('body')
    definition = state.pop('definition')
    original = source_body(ROOT / 'supabase/migrations/20260902055512_memory_user_retention.sql')
    candidate = source_body(ROOT / 'tools/operations/retention-response-candidate.sql')
    state.update(target=target,readOnly=True,bodyFingerprint=fingerprint(body),
                 originalFunction=fingerprint(body)==fingerprint(original),
                 approvedTestFunction=fingerprint(body)==fingerprint(candidate))
    state['metadataSha256'] = hashlib.sha256(json.dumps(state['metadata'],sort_keys=True).encode()).hexdigest()
    if target == 'production':
        cache = ROOT / '.cache/operations-private'
        cache.mkdir(parents=True,exist_ok=True)
        digest=hashlib.sha256((definition+';\n').encode()).hexdigest()
        backup=cache / f'df02-production-function-{digest}.sql'
        if not backup.exists():
            backup.write_text(definition+';\n',encoding='utf-8')
        state['rollbackDefinitionSha256'] = digest
        state['rollbackDefinitionFile'] = backup.name
    return state


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=retention.TARGETS,required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args.target)))
        return 0
    except Exception:
        print(json.dumps({'target':args.target,'readOnly':True,'error':'DF02_INSPECTION_FAILED_DETAILS_WITHHELD'}))
        return 1


if __name__=='__main__':
    raise SystemExit(main())
