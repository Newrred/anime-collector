#!/usr/bin/env python3
"""Exact approved DF-01 function migration, moemoa-test only. Default is read-only.

No report RPC, user rows, flags, production option or deployment. --apply saves
the verified old function locally, commits DDL + ledger atomically, then checks
through a separate connection. Any uncertain result requires inspection first.
"""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REF = 'nmgkhknponvzcwliajyk'
VERSION = '20261018090000'
CANDIDATE = 'a6a63b687a8f29d748ffa8047a17e6d9f5826ee6'
DIGEST = '145ecdefac5dfc0435e4ef16fc1e3b6ae1354e1e128152c7d7e0af1ce1c51161'
BASELINE_BODY_DIGEST = '724a91fd4fdb97591b449cc55dedbf20b85746023e17f1840312bb6af00b8cf1'
RELEASE = 'MOEMOA_DF01_REPORT_TEST_20261018_01'
SIGNATURE = 'public.submit_memory_report(text,uuid,text,uuid,text)'
MIGRATION = ROOT / 'supabase/migrations/20261018090000_memory_report_partial_privacy.sql'


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def literal(text):
    if '$df01_value$' in text:
        raise ValueError('UNEXPECTED_LITERAL')
    return '$df01_value$' + text + '$df01_value$'


def body(source):
    return source.split('as $$', 1)[1].rsplit('$$;', 1)[0]


def sources():
    candidate = MIGRATION.read_text(encoding='utf-8')
    if sha(candidate) != DIGEST:
        raise ValueError('APPROVED_CANDIDATE_CHANGED')
    old = (ROOT / 'supabase/migrations/20260923213901_memory_moderation.sql').read_text(encoding='utf-8')
    start = old.index('create function public.submit_memory_report(')
    old = old[start:old.index('end $$;', start) + len('end $$;')]
    if sha(body(old)) != BASELINE_BODY_DIGEST:
        raise ValueError('BASELINE_SOURCE_CHANGED')
    return candidate, body(old), body(candidate)


def connection():
    spec = importlib.util.spec_from_file_location('retention_connection', ROOT / 'tools/operations/inspect-retention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # Existing target allowlist validates scheme/host/user/database, then verify-full TLS.
    env = module.connection('test')
    env['PGAPPNAME'] = 'moemoa-df01-test-migration'
    return env


def run(sql, env):
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                            input=sql, env=env, capture_output=True, text=True, timeout=65)
    if result.returncode:
        allowed = ['DF01_BASELINE_CHANGED', 'DF01_DEFINITION_MISMATCH', 'DF01_METADATA_CHANGED',
                   'DF01_SETTINGS_CHANGED', 'DF01_OTHER_FUNCTIONS_CHANGED', 'DF01_HISTORY_CHANGED']
        raise RuntimeError(next((x for x in allowed if x in result.stderr), 'DATABASE_ERROR_DETAILS_WITHHELD'))
    return [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]


# pg_node_tree includes the SQL character offset of a default expression. Compare
# its deparsed value rather than treating a moved, unchanged default as new data.
METADATA_SQL = "(to_jsonb(p)-'prosrc'-'prosqlbody'-'proargdefaults') || jsonb_build_object('argumentDefaults',pg_get_expr(p.proargdefaults,0))"
FUNCTION_QUERY = f"""select jsonb_build_object(
 'body',p.prosrc,'definition',pg_get_functiondef(p.oid),
 'metadata',{METADATA_SQL},
 'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
 'public',exists(select 1 from aclexplode(p.proacl) a where a.grantee=0))
 from pg_proc p where p.oid=to_regprocedure('{SIGNATURE}')"""
SETTINGS_QUERY = "select md5(to_jsonb(s)::text) from private.memory_publication_settings s where singleton"
OTHER_QUERY = f"""select md5(coalesce(string_agg(md5(to_jsonb(p)::text),'' order by p.oid),''))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.oid<>'{SIGNATURE}'::regprocedure"""
HISTORY_QUERY = f"""select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by version),''))
 from supabase_migrations.schema_migrations s where version<>'{VERSION}'"""
SNAPSHOT = f"""select jsonb_build_object('at',now(),'function',({FUNCTION_QUERY}),
 'settingsHash',({SETTINGS_QUERY}),'otherFunctionsHash',({OTHER_QUERY}),'historyHash',({HISTORY_QUERY}),
 -- Older hosted applies used their execution timestamp; allow only the observed
 -- exact version/name alias, while the function body must still match exactly.
 'prerequisites',(
 exists(select 1 from supabase_migrations.schema_migrations where
  (version='20260923213901' and name in ('memory_moderation','20260923213901_memory_moderation'))
  or (version='20260924141324' and name='20260923213901_memory_moderation'))
 and exists(select 1 from supabase_migrations.schema_migrations where version='20261011120000' and name='simple_card_sharing')),
 'ledger',(select jsonb_build_object('version',version,'name',name,'statements',statements)
 from supabase_migrations.schema_migrations where version='{VERSION}'));"""


def snapshot(env):
    rows = run("begin read only; set local statement_timeout='20s'; set local lock_timeout='3s';\n" + SNAPSHOT + '\nrollback;', env)
    if len(rows) != 1 or not rows[0]['function']:
        raise ValueError('SNAPSHOT_INVALID')
    return rows[0]


def check(condition, reason):
    if not condition:
        raise ValueError(reason)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    source, old_body, new_body = sources()
    env = connection()
    before = snapshot(env)
    fn = before['function']
    meta = fn['metadata']
    check(before['prerequisites'], 'PREREQUISITE_MISSING')
    check(fn['authenticated'] and not fn['anon'] and not fn['public'], 'ACL_BASELINE_UNEXPECTED')
    check(meta['prosecdef'] and meta['proconfig'] == ['search_path=""'] and
          meta['proargnames'] == ['p_kind','p_target','p_category','p_operation','p_note'] and
          meta['pronargdefaults'] == 1 and meta['argumentDefaults'] == "''::text", 'METADATA_BASELINE_UNEXPECTED')
    ledger = {'version':VERSION,'name':'memory_report_partial_privacy',
              'statements':[f'-- release {RELEASE}; candidate {CANDIDATE}; sha256 {DIGEST}\n{source}']}
    is_old = fn['body'].replace('\r\n','\n') == old_body and before['ledger'] is None
    is_new = fn['body'] == new_body and before['ledger'] == ledger
    check(is_old or is_new, 'BASELINE_OR_LEDGER_MISMATCH')
    result = {'target':REF,'candidate':CANDIDATE,'migration':VERSION,'sha256':DIGEST,'release':RELEASE,
              'mode':'READ_ONLY','state':'BASELINE_MATCH' if is_old else 'CANDIDATE_PRESENT',
              'observedAt':before['at'],'functionBodySha256':sha(fn['body']),
              'metadataSha256':sha(json.dumps(meta,sort_keys=True)),
              'prerequisitesMatch':True,'authenticatedGranted':True,'anonymousAndPublicDenied':True,'settingsHash':before['settingsHash']}
    if not args.apply or is_new:
        print(json.dumps(result))
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    rollback = ROOT / f'.cache/df01-test-{stamp}-rollback.sql'
    with rollback.open('x',encoding='utf-8',newline='\n') as output:
        output.write(fn['definition'] + '\n')
    result['rollback'] = {'path':str(rollback.relative_to(ROOT)),'sha256':sha(fn['definition']+'\n')}
    meta_json = literal(json.dumps(meta)) + '::jsonb'
    sql = ["begin; set local lock_timeout='5s'; set local statement_timeout='30s';",
           'select pg_advisory_xact_lock(20261018,90000);',
           'lock table supabase_migrations.schema_migrations in share row exclusive mode;',
           f"""do $guard$ begin
if exists(select 1 from supabase_migrations.schema_migrations where version='{VERSION}')
 or (select replace(prosrc,E'\\r\\n',E'\\n') from pg_proc where oid='{SIGNATURE}'::regprocedure) is distinct from {literal(old_body)}
 or (select {METADATA_SQL} from pg_proc p where oid='{SIGNATURE}'::regprocedure) is distinct from {meta_json}
 then raise exception 'DF01_BASELINE_CHANGED'; end if;
end $guard$;""", source,
           f"""do $guard$ begin
if (select prosrc from pg_proc where oid='{SIGNATURE}'::regprocedure) is distinct from {literal(new_body)} then raise exception 'DF01_DEFINITION_MISMATCH'; end if;
if (select {METADATA_SQL} from pg_proc p where oid='{SIGNATURE}'::regprocedure) is distinct from {meta_json} then raise exception 'DF01_METADATA_CHANGED'; end if;
if ({SETTINGS_QUERY}) is distinct from {literal(before['settingsHash'])} then raise exception 'DF01_SETTINGS_CHANGED'; end if;
if ({OTHER_QUERY}) is distinct from {literal(before['otherFunctionsHash'])} then raise exception 'DF01_OTHER_FUNCTIONS_CHANGED'; end if;
if ({HISTORY_QUERY}) is distinct from {literal(before['historyHash'])} then raise exception 'DF01_HISTORY_CHANGED'; end if;
end $guard$;""",
           f"insert into supabase_migrations.schema_migrations(version,name,statements) values('{VERSION}','{ledger['name']}',ARRAY[{literal(ledger['statements'][0])}]);",
           'commit;']
    run('\n'.join(sql), env)
    # A second DB connection proves committed state rather than uncommitted output.
    after = snapshot(env)
    check(after['function']['body'] == new_body and after['ledger'] == ledger, 'COMMITTED_STATE_MISMATCH')
    check(after['function']['metadata'] == meta, 'COMMITTED_METADATA_MISMATCH')
    for key in ['settingsHash','otherFunctionsHash','historyHash']:
        check(after[key] == before[key], 'COMMITTED_PRESERVATION_MISMATCH')
    result.update(mode='APPLIED_AND_READ_BACK',state='CANDIDATE_PRESENT',observedAt=after['at'],
                  functionBodySha256=sha(new_body),previousFunctionBodySha256=sha(old_body),
                  exactDefinition=True,metadataPreserved=True,settingsPreserved=True,
                  otherFunctionsPreserved=True,otherMigrationHistoryPreserved=True,
                  userDataWrites=False,productionTouched=False)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Never show psql context, URL/env, arbitrary exception text or row contents.
        reasons = {'APPROVED_CANDIDATE_CHANGED','BASELINE_SOURCE_CHANGED','UNEXPECTED_LITERAL',
                   'TARGET_MISMATCH','PREREQUISITE_MISSING','ACL_BASELINE_UNEXPECTED',
                   'METADATA_BASELINE_UNEXPECTED','BASELINE_OR_LEDGER_MISMATCH','SNAPSHOT_INVALID',
                   'DF01_BASELINE_CHANGED','DF01_DEFINITION_MISMATCH','DF01_METADATA_CHANGED',
                   'DF01_SETTINGS_CHANGED','DF01_OTHER_FUNCTIONS_CHANGED','DF01_HISTORY_CHANGED',
                   'COMMITTED_STATE_MISMATCH','COMMITTED_METADATA_MISMATCH','COMMITTED_PRESERVATION_MISMATCH',
                   'DATABASE_ERROR_DETAILS_WITHHELD'}
        reason = str(error) if str(error) in reasons else 'OPERATION_FAILED_DETAILS_WITHHELD'
        print(json.dumps({'target':REF,'status':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY','reason':reason}))
        raise SystemExit(1)
