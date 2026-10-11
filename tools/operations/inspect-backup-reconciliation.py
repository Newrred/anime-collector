#!/usr/bin/env python3
"""Read-only production/backup private-media reconciliation. Aggregates only.
This is not a DB restore/replay, a complete public recovery audit, or permission
to serve. Existing authenticated quarantine is input; no files are overwritten.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
FORMAT = 'moemoa-private-recovery-journal-v1'

def timestamp(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('TIME_INVALID')
    return parsed

def indexed(rows, keys):
    if not isinstance(rows, list):
        raise ValueError('ROWS_INVALID')
    result = {}
    for row in rows:
        key = tuple(row[k] for k in keys)
        if any(not isinstance(k, str) or not k for k in key) or key in result:
            raise ValueError('IDENTITY_INVALID')
        result[key] = row
    return result

def validate(journal, current=False):
    if journal['format'] != FORMAT or not journal['snapshot']:
        raise ValueError('SNAPSHOT_INVALID')
    timestamp(journal['capturedAt'])
    accounts = journal['accounts']
    if not isinstance(accounts, list) or any(not isinstance(x,str) or not x for x in accounts) or len(set(accounts)) != len(accounts):
        raise ValueError('ACCOUNTS_INVALID')
    for kind in ('cards', 'assets', 'media'):
        indexed(journal[kind], ['id'])
    indexed(journal['cardFences'], ['user_id', 'card_id'])
    indexed(journal['cancelled'], ['owner_id', 'operation_id'])
    for row in journal['cards']:
        for field in ('ownerId', 'deletedAt'): row[field]
    for row in journal['assets']:
        for field in ('ownerId', 'cardId', 'version', 'current', 'state', 'deletedAt'): row[field]
        if current: row['assetType']
        if type(row['current']) is not bool or type(row['version']) is not int:
            raise ValueError('SOURCE_INVALID')
    for row in journal['media']:
        for field in ('owner_id', 'asset_id', 'source_version', 'operation_id', 'state', 'pipeline',
                      'main_hash', 'thumb_hash', 'main_bytes', 'thumb_bytes', 'width', 'height'): row[field]

def analyze(backup, latest, now=None):
    validate(backup); validate(latest, current=True)
    now = now or datetime.now(timezone.utc)
    age = (now - timestamp(latest['capturedAt'])).total_seconds()
    if not -300 <= age <= 300 or timestamp(latest['capturedAt']) < timestamp(backup['capturedAt']):
        raise ValueError('SNAPSHOT_STALE')
    accounts = set(latest['accounts'])
    cards = {r['id']:r for r in latest['cards']}
    assets = {r['id']:r for r in latest['assets']}
    media = {r['id']:r for r in latest['media']}
    fences = {(r['user_id'],r['card_id']) for r in backup['cardFences'] + latest['cardFences']}
    cancelled = {(r['owner_id'],r['operation_id']) for r in backup['cancelled'] + latest['cancelled']}
    identity = ('owner_id','asset_id','source_version','operation_id','pipeline','main_hash','thumb_hash','main_bytes','thumb_bytes','width','height')
    counts = Counter()
    for old in backup['media']:
        owner = old['owner_id']; current = media.get(old['id']); asset = assets.get(old['asset_id'])
        card = cards.get(asset['cardId']) if asset else None
        if old['state'] != 'READY': reason = 'backupNotReady'
        elif owner not in accounts: reason = 'accountAbsent'
        elif not current: reason = 'mediaAbsent'
        elif current['state'] != 'READY': reason = 'mediaRetiredOrPending'
        elif any(current[k] != old[k] for k in identity): reason = 'manifestChanged'
        elif (owner,old['operation_id']) in cancelled: reason = 'operationCancelled'
        elif not asset or asset['ownerId'] != owner or asset['version'] != old['source_version'] or asset['current'] is not True or asset['state'] != 'READY' or asset['deletedAt'] is not None or asset['assetType'] != 'USER_IMAGE': reason = 'sourceIneligible'
        elif not card or card['ownerId'] != owner or card['deletedAt'] is not None: reason = 'cardIneligible'
        elif (owner,card['id']) in fences: reason = 'cardFenced'
        else: reason = 'eligibleForIsolatedReplay'
        counts[reason] += 1
    backup_ids = {r['id'] for r in backup['media']}
    return {
        'backupCapturedAt':backup['capturedAt'], 'latestCapturedAt':latest['capturedAt'],
        'backupMedia':len(backup['media']), 'latestMedia':len(latest['media']),
        'backupDisposition':dict(sorted(counts.items())),
        'backupAccountsNowAbsent':len(set(backup['accounts'])-accounts),
        'latestMediaNotInBackup':sum(r['id'] not in backup_ids for r in latest['media']),
        'databaseImportVerified':False, 'deletionReplayVerified':False, 'safeToServe':False,
        'scope':'Private media metadata eligibility only; no public rights/withdrawal or canonical-original completeness claim.'}

def inspect(quarantine):
    allowed = (ROOT / '.cache/operations-private').resolve()
    q = Path(quarantine).resolve(strict=True)
    if not q.is_relative_to(allowed) or q == allowed or (q/'RESTORE_INCOMPLETE').exists():
        raise ValueError('QUARANTINE_INVALID')
    proof = json.loads((q/'VERIFIED_BYTES_ONLY.json').read_text())
    if proof.get('allSha256AndLengthsMatch') is not True or proof.get('archiveSha256Matched') is not True:
        raise ValueError('QUARANTINE_UNVERIFIED')
    path = q/'payload/latest-journal.json'
    if path.is_symlink() or path.stat().st_size > 64*1024*1024: raise ValueError('INPUT_INVALID')
    backup = json.loads(path.read_text())
    validate(backup)
    spec = importlib.util.spec_from_file_location('retention', ROOT/'tools/operations/inspect-retention.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    env = module.connection('production')
    env['PGOPTIONS'] = '-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=2000'
    result = subprocess.run(['/usr/lib/postgresql/16/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-f',str(ROOT/'tools/private-images/capture-recovery-journal.sql')],env=env,capture_output=True,text=True,timeout=25)
    if result.returncode: raise ValueError('CAPTURE_FAILED')
    latest = json.loads(result.stdout)
    return {'target':'production','readOnly':True,**analyze(backup, latest)}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--quarantine',required=True)
    args=p.parse_args()
    try:
        print(json.dumps(inspect(args.quarantine)));return 0
    except Exception:
        print(json.dumps({'error':'BACKUP_RECONCILIATION_FAILED','safeToServe':False}));return 1

if __name__ == '__main__': raise SystemExit(main())
