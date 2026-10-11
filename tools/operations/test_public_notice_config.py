#!/usr/bin/env python3
"""Disposable configuration-only PostgreSQL fixture. No hosted URL/credentials."""
import json, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BIN=Path('/usr/lib/postgresql/16/bin')
def main():
 with tempfile.TemporaryDirectory(prefix='moemoa-public-notice-') as directory:
  work=Path(directory); started=False
  def command(name,*args):
   r=subprocess.run([str(BIN/name),*map(str,args)],capture_output=True,text=True,timeout=30)
   if r.returncode: raise RuntimeError(r.stderr)
   return r.stdout.strip()
  try:
   command('initdb','-D',work/'data','-A','trust','--no-locale','-E','UTF8')
   command('pg_ctl','-D',work/'data','-l',work/'server.log','-o',f"-k {work} -p 55457 -c listen_addresses=''",'start'); started=True
   psql=[str(BIN/'psql'),'-h',str(work),'-p','55457','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
   def sql(text):
    r=subprocess.run(psql,input=text,capture_output=True,text=True,timeout=30)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()
   def candidate(apply=False,restore=False,error=None):
    r=subprocess.run(psql+['-v',f'apply_public_notice={str(apply).lower()}','-v',f'restore_public_notice={str(restore).lower()}','-f',str(ROOT/'tools/operations/public-notice-test-config.sql')],capture_output=True,text=True,timeout=30)
    if error:
     assert r.returncode and error in r.stderr, 'Expected '+error
    else: assert r.returncode==0,r.stderr
   def snapshot(): return json.loads(sql('select to_jsonb(s) from private.memory_publication_settings s'))
   sql((ROOT/'tools/operations/public-notice-test-fixture.sql').read_text()); baseline=snapshot()
   candidate(); assert snapshot()==baseline; print('PASS default dry-run preserves baseline')
   candidate(apply=True); applied=snapshot(); expected=baseline|dict(policy_revision='MOEMOA_PUBLIC_GENERAL_20261011_01',content_policy_revision='MOEMOA_PUBLIC_GENERAL_20261011_01',general_publication_policy_revision='MOEMOA_PUBLIC_GENERAL_20261011_01',signup_declaration_required=True)
   assert applied==expected; print('PASS exact four fields applied; all other settings preserved')
   candidate(restore=True); assert snapshot()==applied; print('PASS restore dry-run preserves candidate')
   candidate(apply=True,restore=True); assert snapshot()==baseline; print('PASS exact full baseline restored')
   candidate(apply=True,restore=True,error='NOTICE_CONFIG_DRIFT'); print('PASS wrong restore baseline refused')
   sql('update private.memory_publication_settings set asset_limit=11'); candidate(apply=True,error='NOTICE_CONFIG_DRIFT'); print('PASS changed asset limit refused')
   sql('update private.memory_publication_settings set asset_limit=10;update private.simple_signup_policy set enabled=false'); candidate(apply=True,error='NOTICE_DEPENDENCY_CHANGED'); print('PASS disabled signup dependency refused')
   sql('update private.simple_signup_policy set enabled=true'); candidate(apply=True)
   sql('update private.memory_publication_settings set writes_enabled=false'); candidate(apply=True,restore=True,error='NOTICE_CONFIG_DRIFT'); assert snapshot()['writes_enabled'] is False; print('PASS restore preserves changed kill switch')
   print('CONFIGURATION_FIXTURE_ONLY: 8 PASS; remote mutation=0')
  finally:
   if started: command('pg_ctl','-D',work/'data','-m','immediate','stop')
if __name__=='__main__': main()
