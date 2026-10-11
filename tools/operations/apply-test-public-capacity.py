#!/usr/bin/env python3
"""Exact approved test-only capacity migrations. Default inspect is read-only."""
import argparse,hashlib,importlib.util,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
RELEASE='MOEMOA_PUBLIC_CAPACITY_TEST_20261011_01'
FILES={'20261010103000_memory_public_global_storage_budget.sql':'88275a716ae0e0f9da24bee8000c73eed757797b25eb93bf4923bffb8f7e571d','20261011160000_memory_public_capacity_observation.sql':'45c8f7951e9a08d8d7ac8e97674a2fe484d29d7d711c036828856f9165db6601'}
spec=importlib.util.spec_from_file_location('retention',ROOT/'tools/operations/inspect-retention.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
TABLES=['public.memory_cards','public.memory_visual_assets','public.memory_boards','public.memory_board_cards','private.memory_public_assets','private.memory_publications','private.memory_minihomes','private.memory_relationships','private.memory_publication_settings','private.memory_resource_policies','private.memory_resource_usage','storage.objects']
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 try:
  sources=[]
  for name,digest in FILES.items():
   source=(ROOT/'supabase/migrations'/name).read_text()
   if hashlib.sha256(source.encode()).hexdigest()!=digest:raise ValueError('CANDIDATE_CHANGED')
   sources.append((name,digest,source))
  sql=['begin;',"set local statement_timeout='30s'; set local lock_timeout='5s';"] if args.apply else ['begin read only;']
  if args.apply:
   sql += ["select pg_advisory_xact_lock(20261011,160001);", "do $$begin if to_regclass('private.memory_public_storage_policy') is not null or to_regprocedure('public.observe_memory_public_image_capacity()') is not null or exists(select 1 from supabase_migrations.schema_migrations where version in ('20261010103000','20261011160000')) then raise exception 'ALREADY_PRESENT_INSPECT_FIRST';end if;end$$;",'create temporary table capacity_before(name text,hash text);']
   for table in TABLES:
    sql += ['lock table '+table+' in share mode;',"insert into capacity_before select '"+table+"',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from "+table+' t;']
   for name,digest,source in sources:
    version,title=name.removesuffix('.sql').split('_',1)
    sql += [source,"insert into supabase_migrations.schema_migrations(version,name,statements) values ('"+version+"','"+title+"',array[$candidate$-- release "+RELEASE+'; sha256 '+digest+'\n'+source+'$candidate$]);']
   for table in TABLES:
    sql += ["do $$begin if (select hash from capacity_before where name='"+table+"') is distinct from (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from "+table+" t) then raise exception 'EXISTING_DATA_CHANGED';end if;end$$;"]
   sql += ["notify pgrst, 'reload schema';"]
  sql += ["select jsonb_build_object('migrationCount',(select count(*) from supabase_migrations.schema_migrations where version in ('20261010103000','20261011160000') and array_to_string(statements,E'\n') like '%"+RELEASE+"%'),'storagePolicyExists',to_regclass('private.memory_public_storage_policy') is not null,'observationExists',to_regprocedure('public.observe_memory_public_image_capacity()') is not null);",'commit;' if args.apply else 'rollback;']
  r=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input='\n'.join(sql),env=module.connection('test'),capture_output=True,text=True,timeout=60)
  if r.returncode:raise ValueError('FAILED_OR_UNCERTAIN')
  print(json.dumps({'release':RELEASE,'target':'test','applied':args.apply,'preservedTables':len(TABLES) if args.apply else None,'state':[json.loads(x) for x in r.stdout.splitlines() if x.startswith('{')]}))
 except Exception:print(json.dumps({'release':RELEASE,'error':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY'}));return 1
 return 0
if __name__=='__main__':raise SystemExit(main())
