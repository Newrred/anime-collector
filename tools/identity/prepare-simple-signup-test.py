#!/usr/bin/env python3
"""Install only the two default-off signup migrations in the fixed TEST project.

Run in WSL. Default is a transaction rehearsal (ROLLBACK); --apply commits.
Credentials stay in the ignored test env file and child environment, never argv.
No Auth hook, Google, Public, or production setting is changed.
"""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
REF = "nmgkhknponvzcwliajyk"
FILES = ["20261009130000_simple_signup_declarations.sql", "20261009143000_simple_signup_admission.sql"]
RELEASE = "MOEMOA_SIMPLE_SIGNUP_TEST_20261009_01"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    values = {}
    for line in (ROOT / ".env.moemoatest.server.local").read_text(encoding="utf-8-sig").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    url = urlsplit(values["SUPABASE_DB_URL"])
    if not ((url.hostname == f"db.{REF}.supabase.co" and url.username == "postgres") or
            (url.hostname and url.hostname.endswith(".pooler.supabase.com") and url.username == f"postgres.{REF}")):
        raise ValueError("TEST_TARGET_REQUIRED")
    env = os.environ.copy()
    env.update(PGHOST=url.hostname, PGPORT=str(url.port or 5432), PGUSER=unquote(url.username),
               PGPASSWORD=unquote(url.password or ""), PGDATABASE=url.path.lstrip("/"),
               PGSSLMODE="verify-full", PGSSLROOTCERT=str(ROOT / ".cache/operations-private/supabase-ca.crt"),
               PGCONNECT_TIMEOUT="15")
    sql = ["begin; set local lock_timeout='5s'; set local statement_timeout='30s';",
           "select pg_advisory_xact_lock(20261009,143000);",
           "do $$begin if to_regclass('private.simple_signup_policy') is not null or "
           "exists(select 1 from supabase_migrations.schema_migrations where version in ('20261009130000','20261009143000')) "
           "then raise exception 'ALREADY_PRESENT_INSPECT_BEFORE_REAPPLY'; end if; end$$;"]
    evidence = []
    for filename in FILES:
        raw = (ROOT / "supabase/migrations" / filename).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        source = raw.decode("utf-8-sig")
        version, name = filename.removesuffix(".sql").split("_", 1)
        sql.append(source)
        sql.append("insert into supabase_migrations.schema_migrations(version,name,statements) values(" +
                   f"'{version}','{name}',ARRAY[$moemoa$-- release {RELEASE}; sha256 {digest}\n{source}$moemoa$]);")
        evidence.append({"version": version, "sha256": digest})
    sql.append("""
do $$begin
 if (select enabled or admission_enabled from private.simple_signup_policy where singleton) then
  raise exception 'EXPECTED_DISABLED'; end if;
 if has_function_privilege('anon','public.issue_simple_signup_admission(text,text,jsonb)','EXECUTE') or
    has_function_privilege('authenticated','public.consume_simple_signup_handoff(text)','EXECUTE') or
    has_function_privilege('service_role','public.check_simple_signup_admission(jsonb)','EXECUTE') then
  raise exception 'EXCESS_PRIVILEGE'; end if;
 if not has_function_privilege('supabase_auth_admin','public.check_simple_signup_admission(jsonb)','EXECUTE') then
  raise exception 'HOOK_PERMISSION_MISSING'; end if;
 if not exists(select 1 from pg_trigger where tgname='apply_simple_signup_admission' and tgrelid='auth.users'::regclass) then
  raise exception 'TRIGGER_MISSING'; end if;
 if exists(select 1 from private.simple_signup_declarations) or exists(select 1 from private.simple_signup_admissions)
 or exists(select 1 from private.simple_signup_handoffs) then raise exception 'EXPECTED_EMPTY'; end if;
end$$;
select 'PASS: default-off policy, service-only RPCs, hook grant, trigger, empty signup tables';
""")
    sql.append("notify pgrst, 'reload schema';" if args.apply else "")
    sql.append("commit;" if args.apply else "rollback;")
    result = subprocess.run(["/usr/lib/postgresql/16/bin/psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
                            input="\n".join(sql), env=env, capture_output=True, text=True)
    if result.returncode:
        # Do not echo server errors: a future error could include credential/row data.
        print("TEST_MIGRATION_FAILED_OR_UNCERTAIN; inspect migration history before retry; error details withheld")
        return result.returncode
    import json
    print(json.dumps({"release": RELEASE, "target": REF, "mode": "APPLIED_DEFAULT_OFF" if args.apply else "REHEARSED_ROLLED_BACK",
                      "migrations": evidence, "checks": result.stdout.strip()}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
