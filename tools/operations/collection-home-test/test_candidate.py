#!/usr/bin/env python3
"""Ephemeral PostgreSQL rehearsal. No remote URL, keys or real account data."""
import json, subprocess, tempfile, sys
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
BIN=Path('/usr/lib/postgresql/16/bin')
TARGET='nmgkhknponvzcwliajyk'
OWNER='collection-owner@example.invalid'

def main():
 with tempfile.TemporaryDirectory(prefix='moemoa-collection-candidate-') as directory:
  work=Path(directory); started=False; passed=0
  def command(name,*args):
   r=subprocess.run([str(BIN/name),*map(str,args)],capture_output=True,text=True,timeout=60)
   if r.returncode: raise RuntimeError(r.stderr)
   return r.stdout.strip()
  try:
   command('initdb','-D',work/'data','-A','trust','--no-locale','-E','UTF8')
   command('pg_ctl','-D',work/'data','-l',work/'server.log','-o',f"-k {work} -p 55458 -c listen_addresses=''",'start'); started=True
   psql=[str(BIN/'psql'),'-h',str(work),'-p','55458','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
   def sql(text):
    r=subprocess.run(psql,input=text,capture_output=True,text=True,timeout=60)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()
   def file(path,*variables,error=None):
    args=psql[:]
    for item in variables: args+=['-v',item]
    r=subprocess.run(args+['-f',str(path)],capture_output=True,text=True,timeout=60)
    if error: assert r.returncode and error in r.stderr, (error,r.stderr)
    else: assert r.returncode==0,r.stderr
   def ok(label):
    nonlocal passed
    passed+=1; print('PASS '+label,flush=True)
   def snapshot(): return json.loads(sql('select to_jsonb(s) from private.memory_publication_settings s'))
   file(ROOT/'tools/publication-boundary/bootstrap.sql')
   for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')):
    if migration.name=='20260902055512_memory_user_retention.sql': continue
    file(migration)
   # The real target's non-secret settings baseline is fixed in config.sql.
   sql("update private.memory_publication_settings set reads_enabled=true,writes_enabled=true,images_enabled=true,minihomes_enabled=true,follows_enabled=true,reports_enabled=true,asset_limit=10,asset_bytes_limit=41943040,report_daily_limit=10,policy_revision='TEST_ONLY_PHONE_WEB_20260927_01',content_policy_revision='TEST_ONLY_PHONE_WEB_20260927_01',general_publication_policy_revision='TEST_ONLY_PHONE_WEB_20260927_01';")
   sql("insert into auth.users(id,email) values('13131313-1313-4131-8131-131313131313','"+OWNER+"');update private.simple_signup_policy set enabled=true,admission_enabled=true,policy_version='simple-signup-2026-10-10-test',terms_version='terms-2026-10-10-test',privacy_version='privacy-2026-10-10-test';")
   baseline=snapshot()
   variables=[f'target_project={TARGET}',f'owner_email={OWNER}']
   fixture=lambda *more,error=None:file(HERE/'fixture.sql',*variables,*more,error=error)
   config=lambda *more,error=None:file(HERE/'config.sql',f'target_project={TARGET}',*more,error=error)
   file(HERE/'fixture.sql',f'owner_email={OWNER}','target_project=production',error='TEST_TARGET_REQUIRED');ok('wrong target marker refused')
   fixture();assert sql('select count(*) from public.catalog_releases')=='0' and sql('select count(*) from public.user_title_sync_entities')=='0';ok('fixture defaults to rollback without data changes')
   sql("insert into public.user_title_sync_entities(user_id,entity_kind,entity_key,payload,last_request_id) values('13131313-1313-4131-8131-131313131313','bookshelf','default','{\"shelves\":[]}',gen_random_uuid());")
   fixture('apply_collection_fixture=true',error='TEST_SHELF_ALREADY_EXISTS');assert sql('select count(*) from public.catalog_releases')=='0';ok('existing owner shelf blocks fixture atomically')
   sql('delete from public.user_title_sync_entities') # synthetic ephemeral fixture only
   fixture('apply_collection_fixture=true');assert sql('select count(*) from public.memory_cards')=='0' and sql('select count(*) from public.user_title_sync_entities')=='2';ok('one title and shelf created without fake Memory')
   src=json.loads((HERE/'catalog-source.json').read_text())
   got=json.loads(sql('select to_jsonb(c) from public.catalog_cover_revisions c'))
   expected=src['cover'].copy()
   for field in ('created_at','permission_verified_at'):
    assert datetime.fromisoformat(got[field])==datetime.fromisoformat(expected[field]);got.pop(field);expected.pop(field)
   assert got==expected;ok('immutable cover ID, checksum, source and permission metadata preserved')
   assert sql('select count(*) from public.catalog_anime_search')=='1' and sql('select count(*) from public.catalog_anime_details')=='1' and sql('select count(*) from public.catalog_anime_people')=='1';ok('catalog sample bounded to one title and one people page')
   fixture('apply_collection_fixture=true',error='TEST_CATALOG_NOT_EMPTY');ok('repeat seed refuses existing catalog instead of overwriting')
   config();assert snapshot()==baseline;ok('configuration defaults to rollback')
   config('apply_collection_config=true');applied=snapshot()
   assert applied==baseline|dict(collection_home_enabled=True,signup_declaration_required=True,policy_revision='MOEMOA_PUBLIC_GENERAL_20261011_01',content_policy_revision='MOEMOA_PUBLIC_GENERAL_20261011_01',general_publication_policy_revision='MOEMOA_PUBLIC_GENERAL_20261011_01');ok('only five approved settings change')
   choices=json.loads(sql("begin;select set_config('request.jwt.claim.sub','13131313-1313-4131-8131-131313131313',true);select public.list_memory_minihome_shelves();rollback;").splitlines()[-1])
   assert choices['enabled'] and len(choices['shelves'])==1 and len(choices['shelves'][0]['titles'])==1;ok('actual owner RPC yields one approved Memory0 title')
   config('restore_collection_config=true');assert snapshot()==applied;ok('restore defaults to rollback')
   sql('update private.memory_publication_settings set writes_enabled=false')
   config('apply_collection_config=true','restore_collection_config=true',error='COLLECTION_CONFIG_DRIFT');assert snapshot()['writes_enabled'] is False;ok('restore refuses to overwrite changed kill switch')
   sql('update private.memory_publication_settings set writes_enabled=true')
   config('apply_collection_config=true','restore_collection_config=true');assert snapshot()==baseline;ok('exact previous settings restored')
   assert sql('select count(*) from public.user_title_sync_entities')=='2' and sql('select count(*) from public.catalog_cover_revisions')=='1';ok('restore keeps original test source and copied cover')
   config('apply_collection_config=true','restore_collection_config=true',error='COLLECTION_CONFIG_DRIFT');ok('wrong restore state refused')
   sql('update private.simple_signup_policy set enabled=false')
   config('apply_collection_config=true',error='COLLECTION_DEPENDENCY_CHANGED');ok('disabled signup dependency refuses activation')
   sql('update private.simple_signup_policy set enabled=true')
   if len(sys.argv)>1:
    rendered=Path(sys.argv[1]).read_text()
   else:
    r=subprocess.run(['node',str(HERE/'render-sql.mjs'),'config'],capture_output=True,text=True,timeout=30)
    assert r.returncode==0,r.stderr;rendered=r.stdout
   sql(rendered);assert snapshot()==baseline;ok('SQL API renderer executes a default rollback, no psql directives')
   print(f'LOCAL_CANDIDATE_REHEARSAL: {passed} PASS; remote writes=0',flush=True)
  finally:
   if started: command('pg_ctl','-D',work/'data','-m','immediate','stop')
if __name__=='__main__': main()
