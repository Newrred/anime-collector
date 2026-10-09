#!/usr/bin/env python3
"""Fixed production target, committed operator/expiry preparation only. No flags."""
import importlib.util
import json
from pathlib import Path
import subprocess
import hashlib
import re
import argparse

ROOT = Path(__file__).resolve().parents[2]
REL = 'tools/operations/prepare-production-public-operator.sql'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--expiry-only',action='store_true')
    args = parser.parse_args()
    rel = 'tools/operations/prepare-production-signup-expiry.sql' if args.expiry_only else REL
    raw = subprocess.check_output(['git','-C',str(ROOT),'show',f'HEAD:{rel}'],stderr=subprocess.DEVNULL)
    source = raw.decode().replace('\r\n','\n')
    if (ROOT/rel).read_text() != source:
        raise ValueError('UNCOMMITTED_SOURCE')
    spec = importlib.util.spec_from_file_location('retention',ROOT/'tools/operations/inspect-retention.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1'],
                            input=source,env=module.connection('production'),capture_output=True,text=True,timeout=60)
    if result.returncode:
        guards = re.findall(r'SCHEMA_REQUIRED|EXACT_OPERATOR_REQUIRED|OTHER_OPERATOR_PRESENT|EXPECTED_DISABLED|EXISTING_JOB_DIFFERS',result.stderr)
        print(json.dumps({'guards':guards}))
        raise ValueError('DATABASE_PREPARATION_FAILED')
    evidence = {'release':'MOEMOA_SIGNUP_EXPIRY_PROD_20261010_01' if args.expiry_only else 'MOEMOA_PUBLIC_OPERATOR_PROD_20261010_01','target':'okchpyagfucpzpyrfgol',
                'sourceSha256':hashlib.sha256(raw).hexdigest(),
                'checks':[json.loads(x) for x in result.stdout.splitlines() if x.startswith('{')]}
    out = ROOT/'.cache/operations-private/production-public-signup'/('expiry.json' if args.expiry_only else 'operator.json')
    out.write_text(json.dumps(evidence,indent=2)+'\n')
    print(json.dumps(evidence))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('OPERATOR_PREPARATION_FAILED_OR_UNCERTAIN; inspect before retry; details withheld')
        raise SystemExit(1)
