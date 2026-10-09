#!/usr/bin/env python3
"""Fixed production additive budget release. Default inspect; --apply committed SQL.

No publishing, signup, image deletion, private quota, or paid-plan changes.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
VERSION = '20261010103000'
RELEASE = 'MOEMOA_PUBLIC_GLOBAL_BUDGET_PROD_20261010_01'
REL = f'supabase/migrations/{VERSION}_memory_public_global_storage_budget.sql'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('connection', ROOT/'tools/operations/inspect-retention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if args.apply:
        raw = subprocess.check_output(['git','-C',str(ROOT),'show',f'HEAD:{REL}'],stderr=subprocess.DEVNULL)
        source = raw.decode().replace('\r\n','\n')
        if (ROOT/REL).read_text() != source:
            raise ValueError('UNCOMMITTED_SOURCE')
        runner = Path(__file__).relative_to(ROOT).as_posix()
        if subprocess.check_output(['git','-C',str(ROOT),'show',f'HEAD:{runner}'],stderr=subprocess.DEVNULL).decode().replace('\r\n','\n') != Path(__file__).read_text():
            raise ValueError('UNCOMMITTED_RUNNER')
        sha = subprocess.check_output(['git','-C',str(ROOT),'rev-parse','HEAD'],text=True).strip()
        digest = hashlib.sha256(raw).hexdigest()
        sql = """begin; set local lock_timeout='5s'; set local statement_timeout='30s';
select pg_advisory_xact_lock(20261010,104);
lock table supabase_migrations.schema_migrations in exclusive mode;
lock table private.memory_public_assets in share row exclusive mode;
lock table private.memory_publication_settings in share mode;
do $$begin
 if to_regclass('private.memory_public_storage_policy') is not null
 or (select count(*) from supabase_migrations.schema_migrations)<>33
 or not exists(select 1 from supabase_migrations.schema_migrations where version='20261009143000')
 then raise exception 'BASELINE_CHANGED'; end if;
 if exists(select 1 from private.memory_publication_settings where reads_enabled or writes_enabled)
 or exists(select 1 from private.memory_public_assets)
 or exists(select 1 from storage.objects where bucket_id='memory-public-derivatives')
 then raise exception 'EXPECTED_PUBLIC_EMPTY_DISABLED'; end if;
 if coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id not in ('memory-private-representations','memory-public-derivatives')),0)
  + (select physical_bytes from private.memory_private_media_policy where id) + 20971520 > 980000000
 then raise exception 'FREE_STORAGE_MARGIN_CHANGED'; end if;
end$$;
""" + source
        sql += "\nupdate private.memory_public_storage_policy set enabled=true,max_reserved_bytes=20971520 where singleton;\n"
        sql += f"insert into supabase_migrations.schema_migrations(version,name,statements) values('{VERSION}','memory_public_global_storage_budget',ARRAY[$budget$-- release {RELEASE}; source {sha}; sha256 {digest}\n{source}$budget$]);\ncommit;"
    else:
        sql = """begin read only;
select jsonb_build_object('policy',(select to_jsonb(p) from private.memory_public_storage_policy p where singleton),
 'migrationRecorded',exists(select 1 from supabase_migrations.schema_migrations where version='20261010103000'),
 'triggerEnabled',exists(select 1 from pg_trigger where tgrelid='private.memory_public_assets'::regclass and tgname='memory_public_storage_budget' and tgenabled='O'),
 'publicOff',(select not reads_enabled and not writes_enabled from private.memory_publication_settings where singleton),
 'privateGlobalBytes',(select physical_bytes from private.memory_private_media_policy where id),
 'reservedPublicBytes',(select coalesce(sum(reserved_bytes),0) from private.memory_public_assets where state<>'DELETED'));
rollback;"""
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=sql,
                            env=module.connection('production'),capture_output=True,text=True,timeout=45)
    if result.returncode:
        raise ValueError('BUDGET_RELEASE_FAILED_OR_UNCERTAIN')
    evidence = {'release':RELEASE,'mode':'APPLIED' if args.apply else 'INSPECT','target':'okchpyagfucpzpyrfgol'}
    if args.apply:
        evidence.update(sourceCommit=sha,sourceSha256=digest)
    else:
        evidence['checks'] = [json.loads(x) for x in result.stdout.splitlines() if x.startswith('{')]
    out = ROOT/'.cache/operations-private/production-public-signup'/('budget-applied.json' if args.apply else 'budget-inspect.json')
    out.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('BUDGET_RELEASE_FAILED_OR_UNCERTAIN; inspect before retry; details withheld')
        raise SystemExit(1)
