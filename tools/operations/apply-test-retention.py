#!/usr/bin/env python3
"""Apply only the user-approved ebdff44 retention candidate to moemoa-test.

Default inspect is read-only. No production target or arbitrary SQL argument.
Results are aggregate-only; errors never echo connection strings or DB output.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
RELEASE = 'MOEMOA_RETENTION_RESPONSE_TEST_20261010_01'
# SHA256 of the approved Git blob with LF line endings (Windows checkout-safe).
APPROVED_SHA256 = 'f562bdf6206c0215dd3f095c7f1689147920529bb8a339df16f1b343e3c95674'
spec = importlib.util.spec_from_file_location('retention', Path(__file__).with_name('inspect-retention.py'))
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


def fingerprint(sql):
    body = sql.split('as $$', 1)[1].split('$$;', 1)[0]
    return hashlib.md5(re.sub(r'\s', '', body).encode()).hexdigest()


def sql_for(action):
    candidate = (ROOT / 'tools/operations/retention-response-candidate.sql').read_text(encoding='utf-8')
    if hashlib.sha256(candidate.encode()).hexdigest() != APPROVED_SHA256:
        raise ValueError('UNAPPROVED_CANDIDATE')
    old = (ROOT / 'supabase/migrations/20260902055512_memory_user_retention.sql').read_text(encoding='utf-8')
    old_hash, new_hash = fingerprint(old), fingerprint(candidate)
    fn_hash = "(select md5(regexp_replace(prosrc,'\\s','','g')) from pg_proc where oid='public.purge_expired_memory_tombstones(timestamptz)'::regprocedure)"
    totals = """jsonb_build_object('cards',(select count(*) from public.memory_cards),
      'boards',(select count(*) from public.memory_boards),
      'assets',(select count(*) from public.memory_visual_assets),
      'memberships',(select count(*) from public.memory_board_cards),
      'privateTitles',(select count(*) from public.memory_private_titles),
      'operations',(select count(*) from public.sync_operations))"""
    sql = ["begin" + (' read only;' if action == 'inspect' else ';'),
           "set local statement_timeout='30s'; set local lock_timeout='5s';"]
    if action == 'apply':
        sql += ["select pg_advisory_xact_lock(20261010,3);",
                f"do $$begin if {fn_hash} not in ('{old_hash}','{new_hash}') then raise exception 'BASELINE_MISMATCH'; end if; end$$;",
                "select jsonb_build_object('phase','before','totals'," + totals + ');', candidate,
                "select jsonb_build_object('phase','cleanup','result',public.purge_expired_memory_tombstones(now()));"]
    sql += [f"""select jsonb_build_object('phase','state','originalFunction',{fn_hash}='{old_hash}',
      'approvedFunction',{fn_hash}='{new_hash}','totals',""" + totals + """,
      'serviceOnly',not has_function_privilege('anon','public.purge_expired_memory_tombstones(timestamptz)','EXECUTE')
       and not has_function_privilege('authenticated','public.purge_expired_memory_tombstones(timestamptz)','EXECUTE')
       and has_function_privilege('service_role','public.purge_expired_memory_tombstones(timestamptz)','EXECUTE'));
      """, 'rollback;' if action == 'inspect' else 'commit;']
    return '\n'.join(sql)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', nargs='?', choices=['inspect', 'apply'], default='inspect')
    args = parser.parse_args()
    try:
        sql = sql_for(args.action)
        result = subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],
            input=sql, env=retention.connection('test'), text=True, capture_output=True, timeout=45)
        if result.returncode:
            raise RuntimeError('QUERY_FAILED')
        state = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
        print(json.dumps({'release':RELEASE,'target':'test','action':args.action,'state':state}))
        return 0
    except Exception:
        print(json.dumps({'release':RELEASE,'target':'test','error':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY'}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
