#!/usr/bin/env python3
"""Inspect/prepare/enable/disable ONLY moemoa-test signup, using verified TLS.

Enable only after the test Preview allowlist, Google callback and Auth hook are
verified. Disable preserves accounts/receipts and the expiry cleanup schedule.
No credentials or row contents are printed. Run with WSL Python.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
REF = 'nmgkhknponvzcwliajyk'
RELEASE = 'MOEMOA_SIMPLE_SIGNUP_TEST_20261010_02'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['inspect', 'prepare', 'enable', 'disable'])
    args = parser.parse_args()
    values = {}
    for line in (ROOT / '.env.moemoatest.server.local').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    u = urlsplit(values['SUPABASE_DB_URL'])
    if not ((u.hostname == f'db.{REF}.supabase.co' and u.username == 'postgres') or
            (u.hostname and u.hostname.endswith('.pooler.supabase.com') and u.username == f'postgres.{REF}')):
        raise ValueError('TEST_TARGET_REQUIRED')
    env = os.environ.copy()
    env.update(PGHOST=u.hostname, PGPORT=str(u.port or 5432), PGUSER=unquote(u.username),
               PGPASSWORD=unquote(u.password or ''), PGDATABASE=u.path.lstrip('/'),
               PGSSLMODE='verify-full', PGCONNECT_TIMEOUT='15',
               PGSSLROOTCERT=str(ROOT / '.cache/operations-private/supabase-ca.crt'))
    sql = ["begin; set local lock_timeout='5s'; set local statement_timeout='30s';",
           'select pg_advisory_xact_lock(20261010,2);']
    if args.action != 'inspect':
        sql.append("""do $$begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261009143000')
 then raise exception 'MIGRATION_REQUIRED'; end if;
 if exists(select 1 from cron.job where jobname='moemoa-simple-signup-purge' and
 (command<>'select public.purge_simple_signup_transients();' or schedule<>'17 * * * *' or username<>current_user))
 then raise exception 'EXISTING_JOB_DIFFERS'; end if;
end$$;""")
    if args.action == 'prepare':
        sql.append("""select cron.schedule('moemoa-simple-signup-purge','17 * * * *',
 'select public.purge_simple_signup_transients();');""")
    if args.action == 'enable':
        sql.append("""do $$begin
 if not exists(select 1 from cron.job where jobname='moemoa-simple-signup-purge' and active)
 then raise exception 'CLEANUP_REQUIRED'; end if;
end$$;
update private.simple_signup_policy set enabled=true,admission_enabled=true where singleton;""")
    if args.action == 'disable':
        sql.append('update private.simple_signup_policy set enabled=false,admission_enabled=false where singleton;')
    sql.append("""select jsonb_build_object(
 'policy',public.get_simple_signup_policy(),
 'cleanupScheduled',exists(select 1 from cron.job where jobname='moemoa-simple-signup-purge' and active),
 'declarations',(select count(*) from private.simple_signup_declarations),
 'admissions',(select count(*) from private.simple_signup_admissions),
 'handoffs',(select count(*) from private.simple_signup_handoffs),
 'userCount',(select count(*) from auth.users));
commit;""")
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                            input='\n'.join(sql), env=env, text=True, capture_output=True)
    if result.returncode:
        print('FAILED_OR_UNCERTAIN: inspect before retry; database errors withheld')
        return result.returncode
    state = [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    print(json.dumps(dict(release=RELEASE, target=REF, action=args.action, state=state), ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
