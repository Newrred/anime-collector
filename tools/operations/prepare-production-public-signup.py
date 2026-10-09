#!/usr/bin/env python3
"""Install the reviewed additive Public/signup schema, DEFAULT OFF, in production.

WSL Python. No flags, Auth Hook, Google keys, public posts or account grants.
Default rehearses one transaction and rolls back. --apply requires committed
source and an exact expected ledger; repeated application fails closed.
Credentials and database rows/errors are never printed. No destructive down SQL.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
REF = 'okchpyagfucpzpyrfgol'
RELEASE = 'MOEMOA_PUBLIC_SIGNUP_SCHEMA_PROD_20261010_01'
BASELINE = ['20260819021327','20260819021408','20260902054107','20260902054119',
 '20260902054132','20260902055512','20260902055852','20260903141500','20260907193000',
 '20260925152858','20260925152859','20261005090000','20261007093000','20261008090000',
 '20261008093000','20261009090000']
VERSIONS = ['20260923090000','20260923093000','20260923182210','20260923183940',
 '20260923192300','20260923213901','20260924115258','20260924121214','20260924193626',
 '20260924194059','20260924195510','20260925164126','20260926140122','20260927042334',
 '20260927044435','20261009130000','20261009143000']
TABLES = ['auth.users','public.memory_cards','public.memory_visual_assets','public.memory_boards',
 'public.memory_board_cards','public.memory_private_titles','private.memory_private_media',
 'private.memory_private_media_policy','private.memory_publication_delete_fences']


def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], stderr=subprocess.DEVNULL)


def build():
    commit = git('rev-parse', 'HEAD').decode().strip()
    manifest = []
    sql = ["begin; set local lock_timeout='5s'; set local statement_timeout='60s';",
           'select pg_advisory_xact_lock(20261010,101);',
           'lock table supabase_migrations.schema_migrations in exclusive mode;',
           "do $$begin if (select array_agg(version::text order by version) from supabase_migrations.schema_migrations) "
           + "is distinct from ARRAY[" + ','.join("'"+x+"'" for x in BASELINE) + "]::text[] then raise exception 'BASELINE_CHANGED'; end if; "
           "if to_regclass('private.memory_publications') is not null or to_regclass('private.simple_signup_policy') is not null "
           "or to_regprocedure('public.retire_memory_card_publications(uuid)') is null then raise exception 'BASELINE_CHANGED'; end if; end$$;",
           'lock table ' + ','.join(TABLES) + ' in share mode;',
           "create temp table preserved_functions on commit drop as select oid,pg_get_functiondef(oid) definition from pg_proc "
           "where pronamespace='public'::regnamespace and proname in ('push_memory_changes','pull_memory_changes');"]
    for i, table in enumerate(TABLES):
        sql.append(f'create temp table preserved_{i} on commit drop as select to_jsonb(t) value from {table} t;')
    for version in VERSIONS:
        matches = list((ROOT/'supabase/migrations').glob(version+'_*.sql'))
        if len(matches) != 1:
            raise ValueError('SOURCE_AMBIGUOUS')
        path = matches[0]
        rel = path.relative_to(ROOT).as_posix()
        raw = git('show', f'HEAD:{rel}')
        source = raw.decode('utf-8-sig').replace('\r\n', '\n')
        if path.read_text(encoding='utf-8-sig') != source:
            raise ValueError('UNCOMMITTED_MIGRATION')
        if re.search(r'^(begin|commit|rollback)\s*;', source, re.M | re.I):
            raise ValueError('NESTED_TRANSACTION')
        applied = source
        adaptations = []
        if version == '20260923182210':
            for before, after in [
                ('create table private.memory_publication_delete_fences (', 'create table if not exists private.memory_publication_delete_fences ('),
                ('create function public.retire_memory_card_publications(', 'create or replace function public.retire_memory_card_publications('),
            ]:
                if applied.count(before) != 1:
                    raise ValueError('ADAPTATION_MISMATCH')
                applied = applied.replace(before, after)
                adaptations.append({'before': before, 'after': after})
        digest = hashlib.sha256(raw).hexdigest()
        applied_hash = hashlib.sha256(applied.encode()).hexdigest()
        manifest.append(dict(file=rel, sourceSha256=digest, appliedSha256=applied_hash, adaptations=adaptations))
        sql.append(applied)
        name = path.stem.split('_',1)[1]
        tag = '$moemoa_release_source$'
        if tag in applied:
            raise ValueError('SOURCE_DELIMITER')
        sql.append("insert into supabase_migrations.schema_migrations(version,name,statements) values("
                   f"'{version}','{name}',ARRAY[{tag}-- release {RELEASE}; source {commit}; sha256 {digest}; applied {applied_hash}\n{applied}{tag}]);")
    for i, table in enumerate(TABLES):
        sql.append(f"do $$begin if exists((select value from preserved_{i} except all select to_jsonb(t) from {table} t) "
                   f"union all (select to_jsonb(t) from {table} t except all select value from preserved_{i})) "
                   f"then raise exception 'PRESERVATION_{i}'; end if; end$$;")
    sql.append("""do $$begin
 if exists(select 1 from preserved_functions f where f.definition<>pg_get_functiondef(f.oid)) then raise exception 'SYNC_CHANGED'; end if;
 if exists(select 1 from private.memory_publication_settings where reads_enabled or writes_enabled)
 or exists(select 1 from private.simple_signup_policy where enabled or admission_enabled) then raise exception 'EXPECTED_OFF'; end if;
 if exists(select 1 from private.memory_publications) or exists(select 1 from private.memory_minihomes)
 or exists(select 1 from private.simple_signup_declarations) then raise exception 'EXPECTED_EMPTY'; end if;
 if has_function_privilege('anon','public.retire_memory_card_publications(uuid)','EXECUTE')
 or has_function_privilege('anon','public.issue_simple_signup_admission(text,text,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.consume_simple_signup_handoff(text)','EXECUTE')
 or has_function_privilege('service_role','public.check_simple_signup_admission(jsonb)','EXECUTE')
 then raise exception 'EXCESS_PRIVILEGE'; end if;
 if not has_function_privilege('authenticated','public.retire_memory_card_publications(uuid)','EXECUTE')
 or not has_function_privilege('supabase_auth_admin','public.check_simple_signup_admission(jsonb)','EXECUTE')
 then raise exception 'MISSING_PRIVILEGE'; end if;
 if not exists(select 1 from pg_trigger where tgname='apply_simple_signup_admission' and tgrelid='auth.users'::regclass)
 or not exists(select 1 from pg_trigger where tgname='memory_visual_assets_normalize_json_null') then raise exception 'MISSING_TRIGGER'; end if;
end$$;
select jsonb_build_object('preservedTables',10,'syncFunctionsUnchanged',true,'publicOff',true,'signupOff',true,
 'newPublications',0,'newMinihomes',0,'newSignupReceipts',0,'permissionsChecked',true);
""")
    return commit, manifest, '\n'.join(sql)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args()
    commit, manifest, sql = build()
    if args.apply:
        rel = Path(__file__).resolve().relative_to(ROOT).as_posix()
        if git('show',f'HEAD:{rel}').decode().replace('\r\n','\n') != Path(__file__).read_text():
            raise ValueError('INSTALLER_MUST_BE_COMMITTED')
    spec = importlib.util.spec_from_file_location('retention', ROOT/'tools/operations/inspect-retention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if args.inspect:
        sql = """begin read only; set local statement_timeout='15s';
select jsonb_build_object('migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'publicOff',(select not reads_enabled and not writes_enabled from private.memory_publication_settings where singleton),
 'signupOff',(select not enabled and not admission_enabled from private.simple_signup_policy where singleton),
 'publications',(select count(*) from private.memory_publications),
 'minihomes',(select count(*) from private.memory_minihomes),
 'signupReceipts',(select count(*) from private.simple_signup_declarations)); rollback;"""
    else:
        sql += "\nnotify pgrst, 'reload schema';\ncommit;" if args.apply else '\nrollback;'
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],
                            input=sql, env=module.connection('production'), capture_output=True, text=True, timeout=180)
    if result.returncode:
        # Emit only our fixed guard labels / SQLSTATE, never a raw DB error.
        labels = re.findall(r'BASELINE_CHANGED|PRESERVATION_\d+|SYNC_CHANGED|EXPECTED_OFF|EXPECTED_EMPTY|EXCESS_PRIVILEGE|MISSING_PRIVILEGE|MISSING_TRIGGER',result.stderr)
        print(json.dumps({'release':RELEASE,'status':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY','guards':labels}))
        return 1
    rows = [json.loads(x) for x in result.stdout.splitlines() if x.startswith('{')]
    evidence = dict(release=RELEASE, target=REF, sourceCommit=commit,
                    mode='INSPECT' if args.inspect else ('APPLIED_DEFAULT_OFF' if args.apply else 'REHEARSED_ROLLED_BACK'),
                    migrations=manifest, checks=rows)
    out = ROOT/'.cache/operations-private/production-public-signup'
    out.mkdir(parents=True,exist_ok=True)
    (out/(evidence['mode'].lower()+'.json')).write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps({k:v for k,v in evidence.items() if k!='migrations'}))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        print('PREPARATION_FAILED_OR_UNCERTAIN; inspect before retry; sensitive details withheld')
        raise SystemExit(1)
