#!/usr/bin/env python3
"""Fixed production target, committed operator/expiry preparation only. No flags."""
import importlib.util
import json
from pathlib import Path
import subprocess
import hashlib

ROOT = Path(__file__).resolve().parents[2]
REL = 'tools/operations/prepare-production-public-operator.sql'


def main():
    raw = subprocess.check_output(['git','-C',str(ROOT),'show',f'HEAD:{REL}'],stderr=subprocess.DEVNULL)
    source = raw.decode().replace('\r\n','\n')
    if (ROOT/REL).read_text() != source:
        raise ValueError('UNCOMMITTED_SOURCE')
    spec = importlib.util.spec_from_file_location('retention',ROOT/'tools/operations/inspect-retention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],
                            input=source,env=module.connection('production'),capture_output=True,text=True,timeout=60)
    if result.returncode:
        raise ValueError('DATABASE_PREPARATION_FAILED')
    evidence = {'release':'MOEMOA_PUBLIC_OPERATOR_PROD_20261010_01','target':'okchpyagfucpzpyrfgol',
                'sourceSha256':hashlib.sha256(raw).hexdigest(),
                'checks':[json.loads(x) for x in result.stdout.splitlines() if x.startswith('{')]}
    out = ROOT/'.cache/operations-private/production-public-signup/operator.json'
    out.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('OPERATOR_PREPARATION_FAILED_OR_UNCERTAIN; inspect before retry; details withheld')
        raise SystemExit(1)
