#!/usr/bin/env python3
"""Approved test-only card-sharing release. Default: read-only inspection.
--rehearse rolls back the exact migration; --apply commits it. No config/data writes.
No production target, credentials or row contents in output. Inspect after any failure.
"""
import argparse, hashlib, json, os, subprocess, sys
from pathlib import Path
from urllib.parse import unquote, urlsplit
ROOT = Path(__file__).resolve().parents[2]
REF = 'nmgkhknponvzcwliajyk'
VERSION = '20261011120000'
RELEASE = 'MOEMOA_SIMPLE_CARD_SHARING_TEST_20261011_01'
DIGEST = 'e153fe7f4d57d44a94dcb30e1dfd5be973bd40e583baf8b65b11a0c40b5b5259'
TABLES = ['public.memory_cards','public.memory_visual_assets','public.memory_boards','public.memory_board_cards',
 'private.memory_publications','private.memory_public_cards','private.memory_public_assets',
 'private.memory_public_image_rights','private.memory_representation_public_rights','private.memory_moderators',
 'private.memory_publication_settings','private.memory_resource_usage','private.simple_signup_policy']
def main():
    p=argparse.ArgumentParser(description=__doc__)
    m=p.add_mutually_exclusive_group();m.add_argument('--rehearse',action='store_true');m.add_argument('--apply',action='store_true')
    args=p.parse_args()
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

    raw=(ROOT/'supabase/migrations/20261011120000_simple_card_sharing.sql').read_bytes()
    if hashlib.sha256(raw).hexdigest()!=DIGEST: raise ValueError('APPROVED_CANDIDATE_CHANGED')
    inspect="""
select jsonb_build_object('migrationPresent',exists(select 1 from supabase_migrations.schema_migrations where version='20261011120000'),
 'releaseRecorded',exists(select 1 from supabase_migrations.schema_migrations where version='20261011120000' and array_to_string(statements,E'\n') like '%MOEMOA_SIMPLE_CARD_SHARING_TEST_20261011_01%'),
 'statusRpc',to_regprocedure('public.get_memory_card_sharing(uuid)') is not null,
 'privacyRpc',to_regprocedure('public.make_memory_card_private(uuid)') is not null,
 'legacyPublishedSnapshots',(select count(*) from private.memory_publications where published_snapshot is not null and (general_consent_hash is null or general_consent_hash<>encode(sha256(convert_to(published_snapshot::text,'UTF8')),'hex'))),
 'publicSettings',(select to_jsonb(s) from private.memory_publication_settings s),
 'prepareArgs',(select proargnames from pg_proc where oid='public.prepare_memory_publication(uuid,bigint,jsonb)'::regprocedure),
 'publishArgs',(select proargnames from pg_proc where oid='public.publish_memory_publication(uuid,bigint,text,text,uuid)'::regprocedure));
"""
    sql=["begin; set local lock_timeout='5s'; set local statement_timeout='30s';"]
    if args.apply or args.rehearse:
        sql += ["select pg_advisory_xact_lock(20261011,120000);", """do $$begin
if exists(select 1 from supabase_migrations.schema_migrations where version='20261011120000') or to_regprocedure('public.make_memory_card_private(uuid)') is not null then raise exception 'ALREADY_PRESENT';end if;
if not exists(select 1 from supabase_migrations.schema_migrations where version='20261010160000') then raise exception 'PREREQUISITE_MISSING';end if;
if not exists(select 1 from private.memory_publication_settings where singleton and policy_revision='TEST_ONLY_PHONE_WEB_20260927_01' and general_publication_policy_revision='TEST_ONLY_PHONE_WEB_20260927_01' and reads_enabled and writes_enabled and images_enabled and follows_enabled and reports_enabled and minihomes_enabled and asset_limit=10 and asset_bytes_limit=41943040 and report_daily_limit=10 and not signup_declaration_required) then raise exception 'SETTINGS_CHANGED';end if;
if exists(select 1 from private.memory_publications where published_snapshot is not null and (general_consent_hash is null or general_consent_hash<>encode(sha256(convert_to(published_snapshot::text,'UTF8')),'hex'))) then raise exception 'LEGACY_SNAPSHOT_REQUIRES_REVIEW';end if;
end$$;""",'create temp table preservation(table_name text primary key,fingerprint text,n bigint) on commit drop;']
        for table in TABLES:
            sql.append(f"insert into preservation select '{table}',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')),count(*) from {table} t;")
        source=raw.decode('utf-8-sig');sql.append(source)
        for table in TABLES:
            sql.append(f"do $$begin if (select fingerprint from preservation where table_name='{table}') is distinct from (select md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from {table} t) then raise exception 'PRESERVATION_CHANGED';end if;end$$;")
        sql.append(f"insert into supabase_migrations.schema_migrations(version,name,statements) values('{VERSION}','simple_card_sharing',ARRAY[$candidate$-- release {RELEASE}; sha256 {DIGEST}\n{source}$candidate$]);")
        sql.append("select jsonb_build_object('preservedTables',count(*),'counts',jsonb_object_agg(table_name,n)) from preservation;")
    sql.append(inspect)
    sql.append("""do $$begin
if to_regprocedure('public.make_memory_card_private(uuid)') is not null then
 if has_function_privilege('anon','public.make_memory_card_private(uuid)','EXECUTE') or has_function_privilege('anon','public.get_memory_card_sharing(uuid)','EXECUTE')
 or not has_function_privilege('authenticated','public.make_memory_card_private(uuid)','EXECUTE')
 or has_function_privilege('authenticated','private.prepare_memory_publication_before_card_privacy_lock(uuid,bigint,jsonb)','EXECUTE')
 or has_function_privilege('service_role','private.publish_memory_publication_before_card_privacy_lock(uuid,bigint,text,text,uuid)','EXECUTE') then raise exception 'UNEXPECTED_PRIVILEGE';end if;
end if;end$$;""")
    sql.append("notify pgrst, 'reload schema';commit;" if args.apply else 'rollback;')
    result=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input='\n'.join(sql),env=env,capture_output=True,text=True,timeout=90)
    if result.returncode:
        # Print only our bounded error marker; never SQL context or row contents.
        allowed=['ALREADY_PRESENT','PREREQUISITE_MISSING','SETTINGS_CHANGED','LEGACY_SNAPSHOT_REQUIRES_REVIEW','PRESERVATION_CHANGED','UNEXPECTED_PRIVILEGE']
        reason=next((v for v in allowed if v in result.stderr),'DATABASE_ERROR_DETAILS_WITHHELD')
        print(json.dumps({'result':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY','reason':reason}));return result.returncode
    checks=[json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]
    print(json.dumps({'target':REF,'release':RELEASE,'sha256':DIGEST,'mode':'APPLIED' if args.apply else 'REHEARSED_ROLLED_BACK' if args.rehearse else 'READ_ONLY','checks':checks}))
    return 0
if __name__=='__main__':sys.exit(main())
