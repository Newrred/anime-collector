#!/usr/bin/env python3
"""Package verified encrypted files only; verify the resulting ZIP locally.
No Drive upload, scheduling, original/key copy or retention deletion.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import zipfile
ROOT=Path(__file__).resolve().parents[2]

def package(run_id):
 if not re.fullmatch('[a-zA-Z0-9-]{1,60}',run_id):raise ValueError()
 work=ROOT/('.cache/operations-private/daily-backup-'+run_id)
 ready=json.loads((work/'READY_LOCAL_ONLY.json').read_text())
 if ready['status']!='LOCAL_ENCRYPTED_BYTES_VERIFIED' or ready['context']!={'project':'okchpyagfucpzpyrfgol','release':'MOEMOA_DAILY_BACKUP_'+run_id}:raise ValueError()
 source=work/'encrypted/payload';files=sorted(source.iterdir())
 if any(not p.is_file() or p.is_symlink() or not (p.name=='manifest.enc' or re.fullmatch('[a-f0-9-]{36}',p.name)) for p in files):raise ValueError()
 if len(files)!=ready['encryption']['files']+1 or not (source/'manifest.enc').is_file():raise ValueError()
 archive=work/('moemoa-production-'+run_id+'.encrypted.zip')
 with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_STORED,allowZip64=True) as z:
  for p in files:z.write(p,'payload/'+p.name)
  z.writestr('context.json',json.dumps(ready['context']))
 spec=importlib.util.spec_from_file_location('verify',ROOT/'tools/operations/verify-external-backup.py')
 mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
 checksum=mod.digest(archive)
 result=mod.verify(archive,Path('/mnt/c/Users/hongs/.moemoa/recovery-keys/moemoa-production-20261009.key'),work/'zip-verification',ready['context']['project'],ready['context']['release'],checksum)
 summary={'status':'LOCAL_ZIP_AUTHENTICATED','bytes':archive.stat().st_size,'sha256':checksum,'files':ready['encryption']['files'],'uploadPerformed':False,'externalRetrievalVerified':False,'scheduleEnabled':False,'retentionDeleted':0}
 (work/'archive-summary.json').write_text(json.dumps(summary))
 return summary

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--run-id',required=True);a=p.parse_args()
 try:print(json.dumps(package(a.run_id)))
 except Exception:print(json.dumps({'error':'LOCAL_BACKUP_PACKAGE_FAILED','readyForUpload':False}));raise SystemExit(1)
