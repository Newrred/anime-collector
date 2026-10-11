#!/usr/bin/env python3
"""Exact test-only capacity migration candidates; apply only after scope approval. Default inspect is read-only."""
import argparse,hashlib,importlib.util,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
RELEASE='MOEMOA_PUBLIC_CAPACITY_TEST_20261011_01'
FILES={'20261010103000_memory_public_global_storage_budget.sql':'88275a716ae0e0f9da24bee8000c73eed757797b25eb93bf4923bffb8f7e571d','20261011160000_memory_public_capacity_observation.sql':'45c8f7951e9a08d8d7ac8e97674a2fe484d29d7d711c036828856f9165db6601'}
OBSERVATION_RELEASE='MOEMOA_OBSERVATION_CONNECTION_TEST_20261011_01'
OBSERVATION_FILES={'20261008090000_private_image_observation.sql':'dc9f9c4657a404a0150fa5d3d1ac9abd5c81f914d81fb9e53de3c7c6ff7e7779'}
spec=importlib.util.spec_from_file_location('retention',ROOT/'tools/operations/inspect-retention.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
TABLES=['public.memory_cards','public.memory_visual_assets','public.memory_boards','public.memory_board_cards','private.memory_public_assets','private.memory_publications','private.memory_minihomes','private.memory_relationships','private.memory_publication_settings','private.memory_resource_policies','private.memory_resource_usage','storage.objects']
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--apply',action='store_true');parser.add_argument('--observation-dependency',action='store_true');args=parser.parse_args()
 release=OBSERVATION_RELEASE if args.observation_dependency else RELEASE
 files=OBSERVATION_FILES if args.observation_dependency else FILES
 tables=TABLES+['private.memory_private_media_policy','private.memory_private_media','private.memory_private_media_meter'] if args.observation_dependency else TABLES
 versions=','.join("'"+name.split('_',1)[0]+"'" for name in files)
 try:
  sources=[]
  for name,digest in files.items():
   source=(ROOT/'supabase/migrations'/name).read_text()
   if hashlib.sha256(source.encode()).hexdigest()!=digest:raise ValueError('CANDIDATE_CHANGED')
   sources.append((name,digest,source))
  sql=['begin;',"set local statement_timeout='30s'; set local lock_timeout='5s';"] if args.apply else ['begin read only;']
  if args.apply:
   guard="to_regprocedure('public.observe_memory_private_image_capacity()') is not null" if args.observation_dependency else "to_regclass('private.memory_public_storage_policy') is not null or to_regprocedure('public.observe_memory_public_image_capacity()') is not null"
   sql += ["select pg_advisory_xact_lock(20261011,160001);", "do $$begin if "+guard+" or exists(select 1 from supabase_migrations.schema_migrations where version in ("+versions+")) then raise exception 'ALREADY_PRESENT_INSPECT_FIRST';end if;end$$;",'create temporary table capacity_before(name text,hash text);']
   for table in tables:
    sql += ['lock table '+table+' in share mode;',"insert into capacity_before select '"+table+"',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from "+table+' t;']
   for name,digest,source in sources:
    version,title=name.removesuffix('.sql').split('_',1)
    sql += [source,"insert into supabase_migrations.schema_migrations(version,name,statements) values ('"+version+"','"+title+"',array[$candidate$-- release "+release+'; sha256 '+digest+'\n'+source+'$candidate$]);']
   for table in tables:
    sql += ["do $$begin if (select hash from capacity_before where name='"+table+"') is distinct from (select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from "+table+" t) then raise exception 'EXISTING_DATA_CHANGED';end if;end$$;"]
   sql += ["notify pgrst, 'reload schema';"]
  if args.observation_dependency:
   sql += ["select jsonb_build_object('privatePolicy',(select jsonb_build_object('enabled',enabled,'approved',approved,'paused',paused,'observedAt',observed_at,'physicalBytes',physical_bytes,'readLimitBytes',global_read_bytes_per_month) from private.memory_private_media_policy where id),'publicObservationExists',to_regprocedure('public.observe_memory_public_image_capacity()') is not null);"]
  sql += ["select jsonb_build_object('migrationCount',(select count(*) from supabase_migrations.schema_migrations where version in ("+versions+") and array_to_string(statements,E'\n') like '%"+release+"%'),'privateObservationExists',to_regprocedure('public.observe_memory_private_image_capacity()') is not null,'storagePolicyExists',to_regclass('private.memory_public_storage_policy') is not null,'observationExists',to_regprocedure('public.observe_memory_public_image_capacity()') is not null);",'commit;' if args.apply else 'rollback;']
  r=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input='\n'.join(sql),env=module.connection('test'),capture_output=True,text=True,timeout=60)
  if r.returncode:raise ValueError('FAILED_OR_UNCERTAIN')
  print(json.dumps({'release':release,'target':'test','applied':args.apply,'preservedTables':len(tables) if args.apply else None,'state':[json.loads(x) for x in r.stdout.splitlines() if x.startswith('{')]}))
 except Exception:print(json.dumps({'release':release,'error':'FAILED_OR_UNCERTAIN_INSPECT_BEFORE_RETRY'}));return 1
 return 0
if __name__=='__main__':raise SystemExit(main())
