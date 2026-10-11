#!/usr/bin/env python3
"""Prepare protected role metadata/current journal for an isolated restore.
Never exports role passwords, connects to a restore DB, or writes production.
"""
import argparse
import re
import importlib.util
import json
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run-id',default='20261011')
args=parser.parse_args()
if not re.fullmatch(r'[a-zA-Z0-9-]{1,60}',args.run_id):raise SystemExit('INVALID_RUN_ID')
OUT=ROOT/('.cache/operations-private/isolated-recovery-'+args.run_id)
spec=importlib.util.spec_from_file_location('retention',ROOT/'tools/operations/inspect-retention.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
try:
    OUT.mkdir(mode=0o700,exist_ok=False)
    env=mod.connection('production')
    env['PGOPTIONS']='-c default_transaction_read_only=on -c statement_timeout=15000'
    sql=(ROOT/'tools/private-images/capture-recovery-journal.sql').read_text()
    sql=sql.replace('commit;',"""select jsonb_build_object(
      'roles',(select jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,'createDb',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypassRls',rolbypassrls) order by rolname) from pg_roles where left(rolname,3)<>'pg_'),
      'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',r.rolname,'member',u.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)),'[]') from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member));
    commit;""")
    r=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],input=sql,env=env,text=True,capture_output=True,timeout=25)
    if r.returncode:raise ValueError()
    rows=[json.loads(line) for line in r.stdout.splitlines() if line.startswith('{')]
    if len(rows)!=2 or rows[0]['format']!='moemoa-private-recovery-journal-v1':raise ValueError()
    for name,row in [('latest-journal.json',rows[0]),('roles.json',rows[1])]:
        with (OUT/name).open('x') as f:json.dump(row,f)
    print(json.dumps({'readOnly':True,'roles':len(rows[1]['roles']),'memberships':len(rows[1]['memberships']),'latestMedia':len(rows[0]['media']),'passwordsExported':False}))
except Exception:
    print(json.dumps({'error':'RECOVERY_CONTEXT_CAPTURE_FAILED'}));raise SystemExit(1)
