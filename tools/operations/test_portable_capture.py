import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
class Keeper:
 def __init__(self):self.stdin=io.StringIO();self.stdout=io.StringIO('AAAA-BBBB-1\n');self.returncode=None
 def wait(self,timeout):self.returncode=0;return 0
 def poll(self):return self.returncode
class PortableCaptureTests(unittest.TestCase):
 def test_linux_capture_pins_project_tls_readonly_and_same_snapshot(self):
  with tempfile.TemporaryDirectory(prefix='moemoa-capture-synthetic-') as temp:
   ca=Path(temp)/'ca.pem';ca.write_text('synthetic CA')
   env={'MOEMOA_BACKUP_PORTABLE':'true','MOEMOA_BACKUP_WORK_ROOT':temp,'MOEMOA_BACKUP_CA_FILE':str(ca),'SUPABASE_DB_URL':'postgresql://postgres:synthetic@db.okchpyagfucpzpyrfgol.supabase.co:5432/postgres'}
   with patch.dict(os.environ,env):
    spec=importlib.util.spec_from_file_location('portable',ROOT/'tools/operations/capture-daily-backup.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    seen=[]
    def command(args,**kw):
     seen.append((args,kw));e=kw['env'];self.assertEqual(e['PGSSLMODE'],'verify-full');self.assertEqual(e['PGSSLROOTCERT'],str(ca));self.assertIn('default_transaction_read_only=on',e['PGOPTIONS'])
     if args[0]=='pg_dump':
      self.assertIn('--snapshot=AAAA-BBBB-1',args);Path(next(x[7:] for x in args if x.startswith('--file='))).write_bytes(b'SYNTHETIC-DUMP');return SimpleNamespace(returncode=0)
     self.assertEqual(args[0],'psql');sql=kw['input'];self.assertIn("set transaction snapshot 'AAAA-BBBB-1'",sql)
     if 'storage.objects' in sql:value=[]
     elif "'private'," in sql:value={'private':{'snapshot':'AAAA-BBBB-1'},'public':{'snapshot':'AAAA-BBBB-1'}}
     elif "'roles'" in sql:value={'roles':[],'memberships':[]}
     else:value={'capturedAt':'2026-10-11T00:00:00Z','tables':99,'migrations':['1'],'publicSettingsPresent':True}
     return SimpleNamespace(returncode=0,stdout=json.dumps(value))
    with patch.object(m.subprocess,'run',command),patch.object(m.subprocess,'Popen',return_value=Keeper()),patch.object(m.select,'select',return_value=([1],[],[])):
     result=m.capture('synthetic','capture');self.assertEqual(result['tables'],99);self.assertTrue(result['sameDatabaseSnapshot']);self.assertTrue(result['databaseDumpCreated']);self.assertEqual(len(seen),5)
 def test_inventory_rejects_foreign_bucket_and_path(self):
  spec=importlib.util.spec_from_file_location('capture_local',ROOT/'tools/operations/capture-daily-backup.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  for row in [{'bucket':'unknown','name':'x','bytes':1},{'bucket':'catalog-covers-preview','name':'../x','bytes':1}]:
   with self.assertRaises(ValueError):m.validate_inventory([row])
if __name__=='__main__':unittest.main()
