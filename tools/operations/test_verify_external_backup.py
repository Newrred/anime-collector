import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
import uuid
import zipfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

spec = importlib.util.spec_from_file_location('external_backup', Path(__file__).with_name('verify-external-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class ExternalBackup(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.key = os.urandom(32)
        self.key_file = self.root / 'synthetic.key'
        self.key_file.write_text(self.key.hex())
        self.context = {'project':'nmgkhknponvzcwliajyk','release':'synthetic'}

    def fixture(self, names=('database.dump','objects/image.webp'), corrupt=False):
        def aad(i):
            return json.dumps([backup.FORMAT,*self.context.values(),i], separators=(',', ':')).encode()
        entries, bodies = [], {}
        for name in names:
            identifier, iv, plain = str(uuid.uuid4()), os.urandom(12), b'synthetic bytes only'
            encrypted = AESGCM(self.key).encrypt(iv, plain, aad(identifier))
            body, tag = encrypted[:-16], encrypted[-16:]
            if corrupt:
                body = bytes([body[0] ^ 1]) + body[1:]
            bodies['payload/' + identifier] = body
            entries.append(dict(name=name,id=identifier,iv=iv.hex(),tag=tag.hex(),bytes=len(plain),hash=hashlib.sha256(plain).hexdigest()))
        manifest = json.dumps(dict(format=backup.FORMAT,context=self.context,entries=entries)).encode()
        iv = os.urandom(12)
        bodies['payload/manifest.enc'] = iv + AESGCM(self.key).encrypt(iv,manifest,aad('manifest'))
        archive = self.root / (str(uuid.uuid4()) + '.zip')
        with zipfile.ZipFile(archive,'w') as z:
            for name,body in bodies.items():
                z.writestr(name,body)
        return dict(archive=archive,key_file=self.key_file,output=self.root / 'output',**self.context,expected_sha=backup.digest(archive))

    def test_complete_quarantine_and_no_overwrite(self):
        args = self.fixture()
        result = backup.verify(**args)
        self.assertEqual(result['authenticatedFiles'],2)
        self.assertFalse(result['safeToServe'])
        self.assertFalse((args['output']/'RESTORE_INCOMPLETE').exists())
        self.assertEqual((args['output']/'payload/database.dump').read_bytes(),b'synthetic bytes only')
        with self.assertRaises(FileExistsError):
            backup.verify(**args)

    def test_wrong_archive_or_key_never_creates_output(self):
        args = self.fixture()
        with self.assertRaises(ValueError):
            backup.verify(**dict(args,expected_sha='0'*64))
        self.key_file.write_text(os.urandom(32).hex())
        with self.assertRaises(Exception):
            backup.verify(**args)
        self.assertFalse(args['output'].exists())

    def test_authenticated_unsafe_names_refused_before_output(self):
        for names in [('../escape',),('CON.txt',),('x','X'),('a','a-b','A/nested')]:
            with self.subTest(names=names):
                args = self.fixture(names)
                with self.assertRaises(ValueError):
                    backup.verify(**args)
                self.assertFalse(args['output'].exists())

    def test_tampered_body_remains_incomplete_and_never_verified(self):
        args = self.fixture(corrupt=True)
        with self.assertRaises(Exception):
            backup.verify(**args)
        self.assertTrue((args['output']/'RESTORE_INCOMPLETE').exists())
        self.assertFalse((args['output']/'VERIFIED_BYTES_ONLY.json').exists())
        self.assertTrue(args['archive'].exists())

    def test_export_helpers_are_bounded_and_never_restored(self):
        args = self.fixture()
        with zipfile.ZipFile(args['archive'],'a') as z:
            z.writestr('context.json',json.dumps(self.context))
            z.writestr('README.txt','Untrusted instructions must not be executed.')
        args['expected_sha'] = backup.digest(args['archive'])
        self.assertEqual(backup.verify(**args)['authenticatedFiles'],2)
        self.assertFalse((args['output']/'payload/README.txt').exists())

    def test_unexpected_zip_entries_are_not_extracted(self):
        args = self.fixture()
        with zipfile.ZipFile(args['archive'],'a') as z:
            z.writestr('../escape','unexpected')
        args['expected_sha'] = backup.digest(args['archive'])
        with self.assertRaisesRegex(ValueError,'UNEXPECTED_FILE'):
            backup.verify(**args)
        self.assertFalse(args['output'].exists())


if __name__ == '__main__':
    unittest.main()
