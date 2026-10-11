#!/usr/bin/env python3
"""Authenticate a pinned ZIP, retain encrypted chain source in fresh staging only."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import shutil
import zipfile
ROOT=Path(__file__).resolve().parents[2]
def unpack(archive,key_file,output,project,release,sha256,manifest_sha256):
 spec=importlib.util.spec_from_file_location('verify',ROOT/'tools/operations/verify-external-backup.py')
 verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
 if not re.fullmatch('[a-f0-9]{64}',manifest_sha256):raise ValueError('MANIFEST_PIN')
 output=Path(output);output.mkdir(mode=0o700,exist_ok=False)
 report=verify.verify(Path(archive),Path(key_file),output/'verified',project,release,sha256)
 with zipfile.ZipFile(archive) as z:
  names=[i.filename for i in z.infolist() if not i.is_dir()]
  payload=[n for n in names if re.fullmatch(r'payload/(manifest[.]enc|[a-f0-9-]{36})',n)]
  if len(payload)!=report['authenticatedFiles']+1 or set(names)-set(payload)-{'context.json','README.txt'}:raise ValueError('ENCRYPTED_SOURCE_NAMES')
  import hashlib
  if hashlib.sha256(z.read('payload/manifest.enc')).hexdigest()!=manifest_sha256:raise ValueError('MANIFEST_PIN')
  destination=output/'encrypted/payload';destination.mkdir(mode=0o700,parents=True)
  for name in payload:
   with z.open(name) as source,(destination/Path(name).name).open('xb') as target:shutil.copyfileobj(source,target,1024*1024)
 # This freshly created private subdirectory is no longer needed; inputs and archive remain.
 shutil.rmtree(output/'verified')
 return {'status':'PARENT_ZIP_AUTHENTICATED','requiresParentArchives':report['requiresParentArchives'],'safeToServe':False}
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 for n in ['archive','key-file','output','project','release','sha256','manifest-sha256']:p.add_argument('--'+n,required=True)
 a=p.parse_args()
 try:print(json.dumps(unpack(a.archive,a.key_file,a.output,a.project,a.release,a.sha256,a.manifest_sha256)))
 except Exception:print(json.dumps({'error':'WEEKLY_PARENT_REJECTED','safeToServe':False}));raise SystemExit(1)
