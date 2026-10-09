#!/usr/bin/env python3
"""Read-only retention inventory for the two known MOEMOA projects (WSL).

Prints only aggregate counts, schedules and status timestamps. Never executes a
purge, reads content or prints connection details/database error messages.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
TARGETS = {'test': 'nmgkhknponvzcwliajyk', 'production': 'okchpyagfucpzpyrfgol'}
TABLES = ['cron.job', 'cron.job_run_details', 'private.memory_private_media',
          'private.simple_signup_admissions', 'private.simple_signup_handoffs',
          'public.memory_cards', 'public.memory_boards', 'public.memory_board_cards',
          'public.memory_visual_assets', 'public.memory_private_titles', 'public.sync_changes', 'public.sync_operations']


def connection(target):
    filename = '.env.moemoatest.server.local' if target == 'test' else '.env.moemoaprod.server.local'
    values = {}
    for line in (ROOT / filename).read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return connection_parameters(values, target)


def connection_parameters(values, target):
    u = urlsplit(values.get('SUPABASE_DB_URL', ''))
    ref = TARGETS[target]
    host = u.hostname if u.scheme else values.get('SUPABASE_DB_HOST', '')
    user = unquote(u.username or '') if u.scheme else values.get('SUPABASE_DB_USER', '')
    database = u.path.lstrip('/') if u.scheme else values.get('SUPABASE_DB_NAME', '')
    if not ((host == f'db.{ref}.supabase.co' and user == 'postgres') or
            (host and host.endswith('.pooler.supabase.com') and user == f'postgres.{ref}')):
        raise ValueError('TARGET_MISMATCH')
    if (u.scheme and u.scheme not in ('postgres', 'postgresql')) or database != 'postgres':
        raise ValueError('TARGET_MISMATCH')
    env = os.environ.copy()
    env.update(PGHOST=host, PGPORT=str(u.port or 5432) if u.scheme else values.get('SUPABASE_DB_PORT','5432'), PGUSER=user,
               PGPASSWORD=unquote(u.password or '') or values.get('SUPABASE_DB_PASSWORD', ''),
               PGDATABASE='postgres', PGSSLMODE='verify-full', PGCONNECT_TIMEOUT='15',
               PGSSLROOTCERT=str(ROOT / '.cache/operations-private/supabase-ca.crt'))
    return env


def inspect(target):
    env = connection(target)
    def query(sql):
        result = subprocess.run(['/usr/lib/postgresql/16/bin/psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
            input="begin read only; set local statement_timeout='15s'; set local lock_timeout='2s';\n" + sql + '\nrollback;',
            env=env, text=True, capture_output=True, timeout=25)
        if result.returncode:
            raise RuntimeError('RETENTION_QUERY_FAILED')
        rows = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
        if len(rows) != 1:
            raise RuntimeError('RETENTION_RESULT_INVALID')
        return rows[0]
    tables = query('select jsonb_build_object(' + ','.join(
        f"'{name}',to_regclass('{name}') is not null" for name in TABLES) + ');')
    result = {'target': target, 'readOnly': True, 'tables': tables}
    checks = []
    for name in TABLES:
        if tables[name] and name.startswith('public.memory_'):
            checks.append(f"'{name}',(select jsonb_build_object('deletedRows',count(*) filter(where deleted_at is not null),"
                          f"'olderThan30Days',count(*) filter(where deleted_at<now()-interval '30 days')) from {name})")
    if tables['public.sync_changes']:
        checks.append("'syncChangesOlderThan30Days',(select count(*) from public.sync_changes where changed_at<now()-interval '30 days')")
    if tables['public.sync_operations']:
        absent = ' and '.join(
            f"not exists(select 1 from public.{table} e where o.entity_type='{kind}' and e.user_id=o.user_id and e.id=o.entity_id)"
            for kind, table in [('PRIVATE_TITLE', 'memory_private_titles'), ('MEMORY_CARD', 'memory_cards'),
                                ('VISUAL_ASSET', 'memory_visual_assets'), ('MEMORY_BOARD', 'memory_boards'),
                                ('MEMORY_BOARD_CARD', 'memory_board_cards')])
        checks.append("'orphanOperationBodies',(select count(*) from public.sync_operations o where "
                      "o.result_payload ? 'remoteEntity' and o.result_payload->'remoteEntity' is distinct from 'null'::jsonb and " + absent + ')')
    if tables['private.memory_private_media']:
        checks.append("""'privateImages',(select jsonb_build_object(
          'dueForCleanup',count(*) filter(where state='DELETING' and cleanup_after<=now()),
          'over24HoursDue',count(*) filter(where state='DELETING' and cleanup_after<now()-interval '24 hours'),
          'expiredPreparations',count(*) filter(where state='PREPARING' and expires_at<=now()),
          'deletedMetadataRows',count(*) filter(where state='DELETED')) from private.memory_private_media)""")
    for name in ['private.simple_signup_admissions', 'private.simple_signup_handoffs']:
        if tables[name]:
            checks.append(f"'{name}',(select jsonb_build_object('expired',count(*) filter(where expires_at<=now())) from {name})")
    result['observed'] = query("select jsonb_build_object('at',now()," + ','.join(checks) + ');') if checks else {}
    if tables['cron.job']:
        # Names and schedules are public operational metadata; commands can contain secrets, so never return them.
        run = "'latestRun',null"
        if tables['cron.job_run_details']:
            run = """'latestRun',(select jsonb_build_object('status',r.status,'started',r.start_time,'ended',r.end_time)
              from cron.job_run_details r where r.jobid=j.jobid order by r.runid desc limit 1)"""
        result['jobs'] = query("""select jsonb_build_object('knownJobs',coalesce(jsonb_agg(jsonb_build_object(
          'name',j.jobname,'schedule',j.schedule,'active',j.active,""" + run + """)), '[]'))
          from cron.job j where j.jobname in ('moemoa-memory-retention-daily','moemoa-simple-signup-purge');""")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=TARGETS, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args.target), ensure_ascii=False))
        return 0
    except Exception:
        # Includes URL/psql/JSON exceptions: never echo their text or traceback.
        print(json.dumps({'target': args.target, 'readOnly': True, 'error': 'RETENTION_INSPECTION_FAILED'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
