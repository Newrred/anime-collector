#!/usr/bin/env python3
"""Prepare ONLY moemoa-test public signup receipt guard after exact approval.

Default transaction rehearsal rolls back; --apply installs the existing migration
and enables its receipt guard. No country, receipt, role, image or Public feature
flag is changed. Current receipt-less test accounts cannot publish/follow until
THE USER completes the existing declaration. Records, reads, withdrawal, block
and report remain available. Do not run even rehearsal against hosted DB before
approval. --enable-existing resumes the approved guard after a user handoff.
After the test, --restore sets ONLY signup_declaration_required=false; retain
the additive schema and migration history. No production target is supported.
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
FILES = ["20261010160000_publication_signup_connection.sql"]
RELEASE = "MOEMOA_PUBLIC_SIGNUP_TEST_20261011_01"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--restore", action="store_true", help="Commit only the approved test receipt-guard restoration")
    mode.add_argument("--enable-existing", action="store_true", help="Re-enable the already-approved test guard after user handoff")
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
    if args.restore or args.enable_existing:
        statement = """begin; set local lock_timeout='5s'; set local statement_timeout='30s';
select pg_advisory_xact_lock(20261011,160000);
do $$begin
 if not exists(select 1 from supabase_migrations.schema_migrations where version='20261010160000'
 and array_to_string(statements,E'\n') like '%MOEMOA_PUBLIC_SIGNUP_TEST_20261011_01%')
 or md5(pg_get_functiondef('private.require_publication_writer()'::regprocedure))<>'6ccbd32a8d13cc08631a0f7edd83b45c'
 then raise exception 'CANDIDATE_CHANGED_INSPECT_BEFORE_RESTORE'; end if;
end$$;
update private.memory_publication_settings set signup_declaration_required=GUARD_VALUE where singleton;
select jsonb_build_object('signupDeclarationRequired',signup_declaration_required,'publicSettings',to_jsonb(s))
 from private.memory_publication_settings s;
commit;"""
        statement = statement.replace("GUARD_VALUE", "true" if args.enable_existing else "false")
        result = subprocess.run(["/usr/lib/postgresql/16/bin/psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
                                input=statement, env=env, capture_output=True, text=True, timeout=60)
        if result.returncode:
            print("TEST_GUARD_UPDATE_FAILED_OR_UNCERTAIN; inspect before retry; details withheld")
            return result.returncode
        print(result.stdout.strip())
        return 0
    sql = ["begin; set local lock_timeout='5s'; set local statement_timeout='30s';",
           "select pg_advisory_xact_lock(20261011,160000);",
           """do $$begin
 if exists(select 1 from supabase_migrations.schema_migrations where version='20261010160000')
 or exists(select 1 from information_schema.columns where table_schema='private'
 and table_name='memory_publication_settings' and column_name='signup_declaration_required')
 then raise exception 'ALREADY_PRESENT_INSPECT_BEFORE_REAPPLY'; end if;
 if md5(pg_get_functiondef('private.require_publication_writer()'::regprocedure))<>'384f0df9c27f0582cbb479ce4fe8e0d3'
 then raise exception 'WRITER_CHANGED'; end if;
 if not exists(select 1 from private.simple_signup_policy where singleton and enabled and admission_enabled
 and policy_version='simple-signup-2026-10-10-test' and terms_version='terms-2026-10-10-test'
 and privacy_version='privacy-2026-10-10-test') then raise exception 'POLICY_CHANGED'; end if;
 if not exists(select 1 from private.memory_publication_settings where singleton
 and reads_enabled and writes_enabled and images_enabled and follows_enabled and reports_enabled and minihomes_enabled
 and asset_limit=10 and asset_bytes_limit=41943040 and report_daily_limit=10
 and policy_revision='TEST_ONLY_PHONE_WEB_20260927_01'
 and content_policy_revision='TEST_ONLY_PHONE_WEB_20260927_01'
 and general_publication_policy_revision='TEST_ONLY_PHONE_WEB_20260927_01') then raise exception 'SETTINGS_CHANGED'; end if;
end$$;
select jsonb_build_object('previousPublicSettings',to_jsonb(s)) from private.memory_publication_settings s;"""]
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
update private.memory_publication_settings set signup_declaration_required=true where singleton;
do $$begin
 if has_function_privilege('anon','private.require_publication_writer()','EXECUTE') or
    has_function_privilege('authenticated','private.require_publication_writer()','EXECUTE') then
  raise exception 'EXCESS_PRIVILEGE'; end if;
end$$;
select jsonb_build_object('signupDeclarationRequired',signup_declaration_required,
 'policyRevision',policy_revision,'limits',jsonb_build_array(asset_limit,asset_bytes_limit,report_daily_limit))
 from private.memory_publication_settings;
""")
    sql.append("notify pgrst, 'reload schema';" if args.apply else "")
    sql.append("commit;" if args.apply else "rollback;")
    result = subprocess.run(["/usr/lib/postgresql/16/bin/psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
                            input="\n".join(sql), env=env, capture_output=True, text=True, timeout=60)
    if result.returncode:
        # Do not echo server errors: a future error could include credential/row data.
        print("TEST_MIGRATION_FAILED_OR_UNCERTAIN; inspect migration history before retry; error details withheld")
        return result.returncode
    import json
    print(json.dumps({"release": RELEASE, "target": REF, "mode": "APPLIED_TEST_RECEIPT_GUARD" if args.apply else "REHEARSED_ROLLED_BACK",
                      "migrations": evidence, "checks": result.stdout.strip()}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
