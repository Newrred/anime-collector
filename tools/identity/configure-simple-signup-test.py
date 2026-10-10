#!/usr/bin/env python3
"""Inspect/prepare/stage documents/enable/disable ONLY moemoa-test, using verified TLS.

Enable only after the test Preview allowlist, Google callback and Auth hook are
verified. Disable preserves accounts/receipts and the expiry cleanup schedule.
No credentials or row contents are printed. Run with WSL Python.
The documents action stages the fixed 10/10 test tuple with signup DISABLED.
Save its previousPolicy output for rollback; do not use it as launch approval.
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
    parser.add_argument('action', choices=['inspect', 'prepare', 'documents', 'enable', 'disable'])
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
    if args.action == 'documents':
        sql.append("""do $$begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261010170000')
 then raise exception 'RECEIPT_MIGRATION_REQUIRED'; end if;
 if not exists(select 1 from private.simple_signup_policy where singleton and
  ((policy_version='simple-signup-2026-10-09' and terms_version='terms-2026-10-09-draft' and privacy_version='privacy-2026-10-09-draft') or
   (policy_version='simple-signup-2026-10-10-test' and terms_version='terms-2026-10-10-test' and privacy_version='privacy-2026-10-10-test')))
 then raise exception 'UNEXPECTED_EXISTING_POLICY'; end if;
end$$;
select jsonb_build_object('previousPolicy',public.get_simple_signup_policy());
update private.simple_signup_policy set enabled=false,admission_enabled=false,
 policy_version='simple-signup-2026-10-10-test',terms_version='terms-2026-10-10-test',
 privacy_version='privacy-2026-10-10-test' where singleton;""")
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
    release = 'MOEMOA_SIGNUP_TEST_DOCUMENTS_20261010_03' if args.action == 'documents' else RELEASE
    print(json.dumps(dict(release=release, target=REF, action=args.action, state=state), ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
