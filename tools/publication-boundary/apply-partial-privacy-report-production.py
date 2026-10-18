#!/usr/bin/env python3
"""Exact DF-01 production candidate. Default: read-only metadata inspection.

Run --apply --expected-commit <full SHA> only after exact production approval.
Only the report function and its release ledger change; no report RPC or user rows.
The observed definition is saved before DDL. An uncertain result requires inspection,
never a blind retry. Release locks do not serialize unrelated, non-cooperating DDL.
"""
import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REF = 'okchpyagfucpzpyrfgol'
VERSION = '20261018090000'
CANDIDATE = 'a6a63b687a8f29d748ffa8047a17e6d9f5826ee6'
DIGEST = '145ecdefac5dfc0435e4ef16fc1e3b6ae1354e1e128152c7d7e0af1ce1c51161'
BASELINE_BODY_DIGEST = '724a91fd4fdb97591b449cc55dedbf20b85746023e17f1840312bb6af00b8cf1'
BASELINE_METADATA_DIGEST = 'aa36896ae2bf60eec8d36749267a86ae5b42f9538664ee2758448b75d49b565d'
BASELINE_SETTINGS_DIGEST = '5bb899d6667f4fd86fd435abea263480'
RELEASE = 'MOEMOA_DF01_REPORT_PROD_20261019_01'
SIGNATURE = 'public.submit_memory_report(text,uuid,text,uuid,text)'
MIGRATION = ROOT / 'supabase/migrations/20261018090000_memory_report_partial_privacy.sql'
CONNECTION_HELPER = ROOT / 'tools/operations/inspect-retention.py'
RUNNER = Path(__file__).resolve()


def sha(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def check(condition, reason):
    if not condition:
        raise ValueError(reason)


def literal(text):
    check('$df01_value$' not in text, 'UNEXPECTED_LITERAL')
    return '$df01_value$' + text + '$df01_value$'


def body(source):
    return source.split('as $$', 1)[1].rsplit('$$;', 1)[0]


def sources():
    candidate = MIGRATION.read_text(encoding='utf-8')
    check(sha(candidate) == DIGEST, 'APPROVED_CANDIDATE_CHANGED')
    old = (ROOT / 'supabase/migrations/20260923213901_memory_moderation.sql').read_text(encoding='utf-8')
    start = old.index('create function public.submit_memory_report(')
    old = old[start:old.index('end $$;', start) + len('end $$;')]
    check(sha(body(old)) == BASELINE_BODY_DIGEST, 'BASELINE_SOURCE_CHANGED')
    return candidate, body(old), body(candidate)


def verify_git_source(expected_commit):
    check(bool(expected_commit and re.fullmatch('[0-9a-f]{40}', expected_commit)), 'EXPECTED_COMMIT_REQUIRED')
    def git(*args):
        result = subprocess.run(['git', '-C', str(ROOT), *args], capture_output=True, timeout=15)
        check(result.returncode == 0, 'GIT_SOURCE_UNAVAILABLE')
        return result.stdout
    check(git('rev-parse', 'HEAD').decode().strip() == expected_commit, 'HEAD_MISMATCH')
    for path in (MIGRATION, RUNNER, CONNECTION_HELPER):
        rel = path.relative_to(ROOT).as_posix()
        committed = git('show', f'{expected_commit}:{rel}').replace(b'\r\n', b'\n')
        check(path.read_bytes().replace(b'\r\n', b'\n') == committed, 'UNCOMMITTED_RELEASE_SOURCE')
    return expected_commit


def connection():
    spec = importlib.util.spec_from_file_location('retention_connection', CONNECTION_HELPER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    check(module.TARGETS.get('production') == REF, 'TARGET_MISMATCH')
    env = module.connection('production')
    host, user = env.get('PGHOST', ''), env.get('PGUSER', '')
    check(((host == f'db.{REF}.supabase.co' and user == 'postgres') or
           (host.endswith('.pooler.supabase.com') and user == f'postgres.{REF}')) and
          env.get('PGDATABASE') == 'postgres' and env.get('PGSSLMODE') == 'verify-full' and
          env.get('PGSSLROOTCERT') == str(ROOT / '.cache/operations-private/supabase-ca.crt'), 'TARGET_MISMATCH')
    env['PGAPPNAME'] = 'moemoa-df01-production-migration'
    return env


def run(sql, env):
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
                            input=sql, env=env, capture_output=True, text=True, timeout=65)
    if result.returncode:
        allowed = ['DF01_BASELINE_CHANGED', 'DF01_DEFINITION_MISMATCH', 'DF01_METADATA_CHANGED',
                   'DF01_SETTINGS_CHANGED', 'DF01_OTHER_FUNCTIONS_CHANGED', 'DF01_HISTORY_CHANGED']
        raise RuntimeError(next((x for x in allowed if x in result.stderr), 'DATABASE_ERROR_DETAILS_WITHHELD'))
    return [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]


# Ignore only the parser's source location for the unchanged default expression.
METADATA_SQL = "(to_jsonb(p)-'prosrc'-'prosqlbody'-'proargdefaults') || jsonb_build_object('argumentDefaults',pg_get_expr(p.proargdefaults,0))"
FUNCTION_QUERY = f"""select jsonb_build_object(
 'body',p.prosrc,'definition',pg_get_functiondef(p.oid),
 'metadata',{METADATA_SQL},
 'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
 'public',exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0))
 from pg_proc p where p.oid=to_regprocedure('{SIGNATURE}')"""
SETTINGS_QUERY = "select md5(to_jsonb(s)::text) from private.memory_publication_settings s where singleton"
OTHER_QUERY = f"""select md5(coalesce(string_agg(md5(to_jsonb(p)::text),'' order by p.oid),''))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','private') and p.oid<>'{SIGNATURE}'::regprocedure"""
HISTORY_QUERY = f"""select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by version),''))
 from supabase_migrations.schema_migrations s where version<>'{VERSION}'"""
SNAPSHOT = f"""select jsonb_build_object('at',now(),'function',({FUNCTION_QUERY}),
 'settingsHash',({SETTINGS_QUERY}),'otherFunctionsHash',({OTHER_QUERY}),'historyHash',({HISTORY_QUERY}),
 'prerequisites',(
 exists(select 1 from supabase_migrations.schema_migrations where version='20260923213901' and name='memory_moderation')
 and exists(select 1 from supabase_migrations.schema_migrations where version='20261011120000' and name='simple_card_sharing')),
 'ledger',(select jsonb_build_object('version',version,'name',name,'statements',statements)
 from supabase_migrations.schema_migrations where version='{VERSION}'));"""


def snapshot(env):
    rows = run("begin read only; set local statement_timeout='20s'; set local lock_timeout='3s';\n" + SNAPSHOT + '\nrollback;', env)
    check(len(rows) == 1 and rows[0]['function'], 'SNAPSHOT_INVALID')
    return rows[0]


def fingerprints(state):
    return {'functionBodySha256': sha(state['function']['body'].replace('\r\n', '\n')),
            'metadataSha256': sha(json.dumps(state['function']['metadata'], sort_keys=True)),
            **{key: state[key] for key in ('settingsHash', 'otherFunctionsHash', 'historyHash')}}


def release_ledger(source, source_commit):
    check(bool(source_commit and re.fullmatch('[0-9a-f]{40}', source_commit)), 'LEDGER_SOURCE_COMMIT_INVALID')
    return {'version': VERSION, 'name': 'memory_report_partial_privacy', 'statements': [
        f'-- release {RELEASE}; candidate {CANDIDATE}; sourceCommit {source_commit}; sha256 {DIGEST}\n{source}']}


def ledger_commit(ledger):
    if not ledger:
        return None
    statements = ledger.get('statements')
    check(isinstance(statements, list) and len(statements) == 1 and isinstance(statements[0], str), 'BASELINE_OR_LEDGER_MISMATCH')
    match = re.fullmatch(r'-- release ' + RELEASE + r'; candidate ' + CANDIDATE +
                        r'; sourceCommit ([0-9a-f]{40}); sha256 ' + DIGEST, statements[0].split('\n', 1)[0])
    check(match is not None, 'BASELINE_OR_LEDGER_MISMATCH')
    return match.group(1)


def apply_sql(source, old_body, new_body, before, ledger):
    meta_json = literal(json.dumps(before['function']['metadata'])) + '::jsonb'
    return '\n'.join([
        "begin; set local lock_timeout='5s'; set local statement_timeout='30s';",
        'select pg_advisory_xact_lock(20261019,90000);',
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
        'commit;'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--expected-commit', help='Exact full Git SHA authorized for this production release')
    args = parser.parse_args()
    if args.expected_commit:
        check(bool(re.fullmatch('[0-9a-f]{40}', args.expected_commit)), 'EXPECTED_COMMIT_REQUIRED')
    source_commit = verify_git_source(args.expected_commit) if args.apply else args.expected_commit
    source, old_body, new_body = sources()
    env = connection()
    before = snapshot(env)
    fn, before_hashes = before['function'], fingerprints(before)
    meta = fn['metadata']
    check(before['prerequisites'], 'PREREQUISITE_MISSING')
    check(fn['authenticated'] and not fn['anon'] and not fn['public'], 'ACL_BASELINE_UNEXPECTED')
    check(meta['prosecdef'] and meta['proconfig'] == ['search_path=""'] and
          meta['proargnames'] == ['p_kind','p_target','p_category','p_operation','p_note'] and
          meta['pronargdefaults'] == 1 and meta['argumentDefaults'] == "''::text" and
          before_hashes['metadataSha256'] == BASELINE_METADATA_DIGEST, 'METADATA_BASELINE_UNEXPECTED')
    check(before['settingsHash'] == BASELINE_SETTINGS_DIGEST, 'SETTINGS_BASELINE_UNEXPECTED')
    recorded_commit = ledger_commit(before['ledger'])
    if recorded_commit and source_commit:
        check(recorded_commit == source_commit, 'LEDGER_SOURCE_COMMIT_MISMATCH')
    source_commit = source_commit or recorded_commit
    ledger = release_ledger(source, source_commit) if source_commit else None
    is_old = fn['body'].replace('\r\n','\n') == old_body and before['ledger'] is None
    is_new = fn['body'] == new_body and ledger is not None and before['ledger'] == ledger
    check(is_old or is_new, 'BASELINE_OR_LEDGER_MISMATCH')
    result = {'target':REF,'candidate':CANDIDATE,'sourceCommit':source_commit,'migration':VERSION,
              'sha256':DIGEST,'release':RELEASE,'mode':'READ_ONLY',
              'state':'BASELINE_MATCH' if is_old else 'CANDIDATE_PRESENT',
              'observedAt':before['at'],'before':before_hashes,
              'prerequisitesMatch':True,'authenticatedGranted':True,'anonymousAndPublicDenied':True}
    if not args.apply or is_new:
        print(json.dumps(result))
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    rollback = ROOT / f'.cache/df01-production-{stamp}-rollback.sql'
    rollback.parent.mkdir(exist_ok=True)
    with rollback.open('x', encoding='utf-8', newline='\n') as output:
        output.write(fn['definition'] + '\n')
    rollback_metadata = rollback.with_suffix('.json')
    with rollback_metadata.open('x', encoding='utf-8', newline='\n') as output:
        json.dump({'target':REF,'sourceCommit':source_commit,'release':RELEASE,'observedAt':before['at'],
                   'metadata':meta,'fingerprints':before_hashes,'definitionSha256':sha(fn['definition']+'\n')}, output, indent=2)
        output.write('\n')
    result['rollback'] = {'path':str(rollback.relative_to(ROOT)), 'sha256':sha(fn['definition']+'\n'),
                          'metadataPath':str(rollback_metadata.relative_to(ROOT))}
    verify_git_source(source_commit)
    run(apply_sql(source, old_body, new_body, before, ledger), env)
    after = snapshot(env)
    check(after['function']['body'] == new_body and after['ledger'] == ledger, 'COMMITTED_STATE_MISMATCH')
    check(after['function']['metadata'] == meta, 'COMMITTED_METADATA_MISMATCH')
    for key in ['settingsHash','otherFunctionsHash','historyHash']:
        check(after[key] == before[key], 'COMMITTED_PRESERVATION_MISMATCH')
    result.update(mode='APPLIED_AND_READ_BACK',state='CANDIDATE_PRESENT',observedAt=after['at'],
                  after=fingerprints(after),exactDefinition=True,metadataPreserved=True,
                  settingsPreserved=True,otherFunctionsPreserved=True,otherMigrationHistoryPreserved=True,
                  userDataWrites=False)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        reasons = {'APPROVED_CANDIDATE_CHANGED','BASELINE_SOURCE_CHANGED','UNEXPECTED_LITERAL',
                   'EXPECTED_COMMIT_REQUIRED','GIT_SOURCE_UNAVAILABLE','HEAD_MISMATCH','UNCOMMITTED_RELEASE_SOURCE',
                   'TARGET_MISMATCH','PREREQUISITE_MISSING','ACL_BASELINE_UNEXPECTED',
                   'METADATA_BASELINE_UNEXPECTED','SETTINGS_BASELINE_UNEXPECTED','BASELINE_OR_LEDGER_MISMATCH',
                   'LEDGER_SOURCE_COMMIT_INVALID','LEDGER_SOURCE_COMMIT_MISMATCH','SNAPSHOT_INVALID',
                   'DF01_BASELINE_CHANGED','DF01_DEFINITION_MISMATCH','DF01_METADATA_CHANGED',
                   'DF01_SETTINGS_CHANGED','DF01_OTHER_FUNCTIONS_CHANGED','DF01_HISTORY_CHANGED',
                   'COMMITTED_STATE_MISMATCH','COMMITTED_METADATA_MISMATCH','COMMITTED_PRESERVATION_MISMATCH',
                   'DATABASE_ERROR_DETAILS_WITHHELD'}
        print(json.dumps({'target':REF,'status':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY',
                          'reason':str(error) if str(error) in reasons else 'OPERATION_FAILED_DETAILS_WITHHELD'}))
        raise SystemExit(1)
