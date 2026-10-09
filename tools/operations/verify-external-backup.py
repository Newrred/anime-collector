#!/usr/bin/env python3
"""Authenticate an externally retrieved encrypted ZIP into a NEW quarantine.

No network, database restore, serving activation or input deletion. Supply key
FILE path, never a key value. Output contains aggregates only. Run in WSL with
the already available cryptography package. An incomplete marker remains on
failure; even a verified quarantine is not an approved live recovery.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

FORMAT = 'moemoa-encrypted-backup-v1'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def verify(archive, key_file, output, project, release, expected_sha):
    archive, key_file, output = map(Path, (archive, key_file, output))
    if not re.fullmatch('[a-z]{20}', project) or not re.fullmatch(r'[\w.-]{1,100}', release):
        raise ValueError('CONTEXT_INVALID')
    if not re.fullmatch('[a-f0-9]{64}', expected_sha) or archive.is_symlink() or not archive.is_file():
        raise ValueError('ARCHIVE_INVALID')
    if digest(archive) != expected_sha:
        raise ValueError('ARCHIVE_MISMATCH')
    if key_file.is_symlink() or key_file.stat().st_size > 128:
        raise ValueError('KEY_INVALID')
    raw = key_file.read_text().strip()
    if not re.fullmatch('[a-fA-F0-9]{64}', raw):
        raise ValueError('KEY_INVALID')
    key = bytes.fromhex(raw)
    context = {'project': project, 'release': release}
    def aad(identifier):
        return json.dumps([FORMAT, project, release, identifier], separators=(',', ':')).encode()
    with zipfile.ZipFile(archive) as z:
        members = [x for x in z.infolist() if not x.is_dir()]
        names = [x.filename for x in members]
        manifests = [x for x in names if x.endswith('/manifest.enc') or x == 'manifest.enc']
        if len(manifests) != 1 or len(names) != len(set(names)) or len(names) > 10003:
            raise ValueError('ARCHIVE_ENTRIES_INVALID')
        manifest_name = manifests[0]
        prefix = manifest_name[:-len('manifest.enc')]
        if z.getinfo(manifest_name).file_size > 16 * 1024 * 1024:
            raise ValueError('MANIFEST_TOO_LARGE')
        blob = z.read(manifest_name)
        manifest = json.loads(AESGCM(key).decrypt(blob[:12], blob[12:], aad('manifest')))
        entries = manifest['entries']
        if manifest['format'] != FORMAT or manifest['context'] != context or not 0 < len(entries) <= 10000:
            raise ValueError('MANIFEST_INVALID')
        outputs, ids = set(), set()
        for e in entries:
            name = e['name']
            if not isinstance(name, str) or len(name) > 240 or not all(
                re.fullmatch('[a-zA-Z0-9_.-]+', p) and p not in ('.', '..') and not p.endswith('.')
                and not re.match(r'^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)', p, re.I) for p in name.split('/')):
                raise ValueError('OUTPUT_PATH_INVALID')
            if name.lower() in outputs or not re.fullmatch('[a-f0-9-]{36}', e['id']) or e['id'] in ids:
                raise ValueError('DUPLICATE_ENTRY')
            outputs.add(name.lower()); ids.add(e['id'])
            if type(e['bytes']) is not int or e['bytes'] < 0 or z.getinfo(prefix + e['id']).file_size != e['bytes']:
                raise ValueError('LENGTH_INVALID')
            if not all(re.fullmatch('[a-f0-9]{%d}' % n, e[k]) for k,n in [('iv',24),('tag',32),('hash',64)]):
                raise ValueError('CRYPTO_METADATA_INVALID')
        # Approved exports may carry these two root-level helper files. Never
        # restore/execute README contents; authenticated manifest stays authoritative.
        extras = set(names) - {manifest_name, *(prefix + identifier for identifier in ids)}
        if not extras.issubset({'context.json', 'README.txt'}) or any(z.getinfo(n).file_size > 4096 for n in extras):
            raise ValueError('UNEXPECTED_FILE')
        if 'context.json' in extras and json.loads(z.read('context.json').decode('utf-8-sig')) != context:
            raise ValueError('EXTERNAL_CONTEXT_MISMATCH')
        for name in outputs:
            parts = name.split('/')
            if any('/'.join(parts[:i]) in outputs for i in range(1, len(parts))):
                raise ValueError('OUTPUT_COLLISION')
        # Parent must be the operator's existing protected staging directory.
        # Exclusive mkdir refuses old directories/symlinks; paths come only from
        # authenticated, validated relative names, never ZipFile.extractall.
        output.mkdir(mode=0o700, exist_ok=False)
        marker = output / 'RESTORE_INCOMPLETE'
        marker.write_text('Quarantine only. Do not serve.\n')
        payload = output / 'payload'
        payload.mkdir(mode=0o700)
        total = 0
        for e in entries:
            target = payload.joinpath(*e['name'].split('/'))
            target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            dec = Cipher(algorithms.AES(key), modes.GCM(bytes.fromhex(e['iv']), bytes.fromhex(e['tag']))).decryptor()
            dec.authenticate_additional_data(aad(e['id']))
            h, size = hashlib.sha256(), 0
            with z.open(prefix + e['id']) as source, target.open('xb') as dest:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    plain = dec.update(chunk); h.update(plain); size += len(plain); dest.write(plain)
                tail = dec.finalize(); h.update(tail); size += len(tail); dest.write(tail)
            if size != e['bytes'] or h.hexdigest() != e['hash']:
                raise ValueError('PLAINTEXT_MISMATCH')
            total += size
        report = {'archiveSha256Matched': True, 'authenticatedFiles': len(entries), 'bytes': total,
                  'allSha256AndLengthsMatch': True, 'databaseImportVerified': False,
                  'deletionReconciliationVerified': False, 'safeToServe': False}
        (output / 'VERIFIED_BYTES_ONLY.json').write_text(json.dumps(report, indent=2))
        marker.unlink()
        return report


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ('archive','key-file','output','project','release','sha256'):
        p.add_argument('--' + name, required=True)
    args = p.parse_args()
    try:
        print(json.dumps(verify(args.archive,args.key_file,args.output,args.project,args.release,args.sha256)))
        return 0
    except Exception:
        print(json.dumps({'error':'EXTERNAL_BACKUP_VERIFY_FAILED','safeToServe':False}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
