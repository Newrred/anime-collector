#!/usr/bin/env python3
"""Read-only aggregate snapshot, using the candidate RPC's exact SELECT. No apply mode."""
import argparse, importlib.util, json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def inspect(target):
 spec=importlib.util.spec_from_file_location('connection',ROOT/'tools/operations/inspect-retention.py')
 module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
 probe=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],
  input="begin read only; select jsonb_build_object('missingTables',coalesce(jsonb_agg(t) filter(where to_regclass(t) is null),'[]')) from unnest(array['private.memory_public_storage_policy','private.memory_private_media','private.memory_resource_usage']) t; rollback;",
  env=module.connection(target),capture_output=True,text=True,timeout=30)
 if probe.returncode: raise ValueError('CAPACITY_QUERY_FAILED')
 missing=json.loads(next(x for x in probe.stdout.splitlines() if x.startswith('{')))['missingTables']
 if missing: return {'target':target,'readOnly':True,'missingTables':missing}
 sql=(ROOT/'supabase/migrations/20261011160000_memory_public_capacity_observation.sql').read_text()
 query=sql.split('-- CAPACITY_SELECT_BEGIN')[1].split('-- CAPACITY_SELECT_END')[0]
 result=subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],
  input="begin read only; set local statement_timeout='15s';\n"+query+';\nrollback;',
  env=module.connection(target),capture_output=True,text=True,timeout=30)
 if result.returncode: raise ValueError('CAPACITY_QUERY_FAILED')
 rows=[json.loads(x) for x in result.stdout.splitlines() if x.startswith('{')]
 if len(rows)!=1: raise ValueError('CAPACITY_RESULT_INVALID')
 return {'target':target,'readOnly':True,'snapshot':rows[0]}
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--target',choices=['test','production'],required=True)
 args=parser.parse_args()
 try: print(json.dumps(inspect(args.target)))
 except Exception: print(json.dumps({'target':args.target,'readOnly':True,'error':'CAPACITY_INSPECTION_FAILED'}));raise SystemExit(1)
