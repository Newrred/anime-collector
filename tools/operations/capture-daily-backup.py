#!/usr/bin/env python3
"""Local production backup capture; read-only, no upload/schedule/deletion.
Run in WSL. Raw output stays in ignored operator-only staging. stdout is counts.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import select
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / '.cache/operations-private'
PSQL = '/usr/lib/postgresql/16/bin/psql'
DUMP = '/opt/moemoa-pg17/root/usr/lib/postgresql/17/bin/pg_dump'
INVENTORY = """select coalesce(jsonb_agg(jsonb_build_object(
 'bucket',bucket_id,'name',name,'id',id,'version',to_jsonb(o)->>'version',
 'updatedAt',updated_at,'bytes',(metadata->>'size')::bigint,'etag',metadata->>'eTag')
 order by bucket_id,name),'[]'::jsonb) from storage.objects o;"""
ROLES = """select jsonb_build_object(
 'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls) order by rolname) from pg_roles where left(rolname,3)<>'pg_'),
 'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'member',u.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)),'[]') from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member));"""

def connection():
 spec=importlib.util.spec_from_file_location('retention',ROOT/'tools/operations/inspect-retention.py')
 mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 env=mod.connection('production')
 env['PGOPTIONS']='-c default_transaction_read_only=on -c statement_timeout=600000 -c lock_timeout=5000'
 return env

def query(env, text, snapshot=None):
 begin='begin isolation level repeatable read read only;'
 if snapshot: begin+="set transaction snapshot '"+snapshot+"';"
 p=subprocess.run([PSQL,'-X','-qAt','-v','ON_ERROR_STOP=1'],input=begin+text+'commit;',env=env,text=True,capture_output=True,timeout=45)
 if p.returncode: raise ValueError('QUERY_FAILED')
 return json.loads(p.stdout.strip())

def validate_inventory(rows):
 seen=set()
 for row in rows:
  if row['bucket'] not in ('catalog-covers-preview','memory-private-representations','memory-public-representations'): raise ValueError('UNKNOWN_BUCKET')
  if type(row['bytes']) is not int or not 0<=row['bytes']<=20000000: raise ValueError('OBJECT_BOUND')
  key=(row['bucket'],row['name'])
  if key in seen or not isinstance(row['name'],str) or any(p in ('','.','..') for p in row['name'].split('/')): raise ValueError('OBJECT_IDENTITY')
  seen.add(key)
 if len(rows)>9000 or sum(r['bytes'] for r in rows)>1200000000: raise ValueError('BACKUP_BOUND')
 return rows

def capture(run_id, mode):
 if not re.fullmatch('[a-zA-Z0-9-]{1,60}',run_id): raise ValueError('RUN_ID')
 out=BASE/('daily-backup-'+run_id)
 env=connection()
 if mode=='verify':
  before=json.loads((out/'storage-inventory.json').read_text())
  after=validate_inventory(query(env,INVENTORY))
  if before!=after: raise ValueError('STORAGE_CHANGED')
  (out/'storage-verified.json').write_text(json.dumps({'sameInventory':True}))
  return {'mode':'verify','readOnly':True,'storageUnchanged':True,'objects':len(after)}
 out.mkdir(mode=0o700,exist_ok=False)
 (out/'INCOMPLETE').write_text('Capture in progress; not ready for serving or upload')
 keeper=None
 try:
  keeper=subprocess.Popen([PSQL,'-X','-qAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=env,text=True,bufsize=1)
  keeper.stdin.write('begin isolation level repeatable read read only; select pg_export_snapshot();'+chr(10));keeper.stdin.flush()
  if not select.select([keeper.stdout],[],[],30)[0]: raise ValueError('SNAPSHOT_TIMEOUT')
  snapshot=keeper.stdout.readline().strip()
  if not re.fullmatch('[A-Fa-f0-9]+-[A-Fa-f0-9]+-[0-9]+',snapshot): raise ValueError('SNAPSHOT_INVALID')
  inventory=validate_inventory(query(env,INVENTORY,snapshot))
  journal_sql=(ROOT/'tools/private-images/capture-recovery-journal.sql').read_text()
  journal_sql=journal_sql[journal_sql.index('select jsonb_build_object('):journal_sql.rindex('commit;')]
  public_sql=(ROOT/'tools/operations/capture-public-recovery-state.sql').read_text()
  public_sql=public_sql[public_sql.index('select jsonb_build_object('):].strip().rstrip(';')
  paired=query(env,"select jsonb_build_object('private', ("+journal_sql.strip().rstrip(';')+"), 'public', ("+public_sql+"));",snapshot)
  journal=paired['private'];public_state=paired['public']
  roles=query(env,ROLES,snapshot)
  meta=query(env,"select jsonb_build_object('capturedAt',transaction_timestamp(),'databaseVersion',current_setting('server_version'),'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'tables',(select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')),'publicSettingsPresent',to_regclass('private.memory_publication_settings') is not null);",snapshot)
  for name,value in [('storage-inventory.json',inventory),('latest-journal.json',journal),('latest-public-state.json',public_state),('roles.json',roles),('database-context.json',meta)]:
   (out/name).write_text(json.dumps(value))
  if mode=='capture':
   result=subprocess.run([DUMP,'--format=custom','--no-tablespaces','--snapshot='+snapshot,'--file='+str(out/'database.dump')],env=env,capture_output=True,timeout=600)
   if result.returncode: raise ValueError('DUMP_FAILED')
  keeper.stdin.write('rollback;'+chr(10));keeper.stdin.close();keeper.wait(timeout=15)
  if keeper.returncode: raise ValueError('SNAPSHOT_CLOSED_EARLY')
  summary={'readOnly':True,'mode':mode,'capturedAt':meta['capturedAt'],'sameDatabaseSnapshot':True,'publicRecoveryStateCaptured':True,'tables':meta['tables'],'migrations':len(meta['migrations']),'publicSettingsPresent':meta['publicSettingsPresent'],'objects':len(inventory),'bytes':sum(r['bytes'] for r in inventory),'databaseDumpCreated':mode=='capture'}
  if mode=='capture':
   with (out/'database.dump').open('rb') as f: summary['dumpSha256']=hashlib.file_digest(f,'sha256').hexdigest()
   summary['dumpBytes']=(out/'database.dump').stat().st_size
  (out/'capture-summary.json').write_text(json.dumps(summary))
  return summary
 finally:
  if keeper and keeper.poll() is None:
   keeper.terminate()
   try: keeper.wait(timeout=5)
   except subprocess.TimeoutExpired: keeper.kill();keeper.wait()

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run-id',required=True);p.add_argument('--mode',choices=['inspect','capture','verify'],default='inspect');a=p.parse_args()
 try: print(json.dumps(capture(a.run_id,a.mode)))
 except Exception: print(json.dumps({'error':'BACKUP_CAPTURE_FAILED','mode':a.mode,'ready':False}));raise SystemExit(1)
