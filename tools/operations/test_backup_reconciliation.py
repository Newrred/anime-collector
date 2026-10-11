import copy
from datetime import datetime, timezone, timedelta
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('inspect-backup-reconciliation.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

class Reconciliation(unittest.TestCase):
    def setUp(self):
        self.now=datetime.now(timezone.utc)
        self.before={'format':audit.FORMAT,'snapshot':'1:2:','capturedAt':(self.now-timedelta(days=1)).isoformat(),
            'accounts':['owner'],'cards':[{'id':'card','ownerId':'owner','deletedAt':None}],
            'assets':[{'id':'asset','ownerId':'owner','cardId':'card','version':1,'current':True,'state':'READY','deletedAt':None,'assetType':'USER_IMAGE'}],
            'cardFences':[],'cancelled':[],
            'media':[{'id':'media','owner_id':'owner','asset_id':'asset','source_version':1,'operation_id':'op','state':'READY','pipeline':'private-webp-v1','main_hash':'a'*64,'thumb_hash':'b'*64,'main_bytes':30,'thumb_bytes':10,'width':24,'height':30}]}
        self.latest=copy.deepcopy(self.before);self.latest['capturedAt']=self.now.isoformat()
    def result(self): return audit.analyze(self.before,self.latest,self.now)
    def assertReason(self,reason): self.assertEqual(self.result()['backupDisposition'],{reason:1})
    def test_eligible_never_authorizes_serving(self):
        result=self.result();self.assertReason('eligibleForIsolatedReplay')
        self.assertFalse(result['safeToServe']);self.assertFalse(result['databaseImportVerified']);self.assertFalse(result['deletionReplayVerified'])
    def test_absent_account(self): self.latest['accounts']=[];self.assertReason('accountAbsent')
    def test_absent_media(self): self.latest['media']=[];self.assertReason('mediaAbsent')
    def test_retired_media_without_cancel_row(self): self.latest['media'][0]['state']='DELETING';self.assertReason('mediaRetiredOrPending')
    def test_changed_manifest(self): self.latest['media'][0]['main_hash']='c'*64;self.assertReason('manifestChanged')
    def test_changed_operation(self): self.latest['media'][0]['operation_id']='different';self.assertReason('manifestChanged')
    def test_cancel(self): self.latest['cancelled']=[{'owner_id':'owner','operation_id':'op'}];self.assertReason('operationCancelled')
    def test_source_version(self): self.latest['assets'][0]['version']=2;self.assertReason('sourceIneligible')
    def test_wrong_asset_type(self): self.latest['assets'][0]['assetType']='CATALOG_COVER';self.assertReason('sourceIneligible')
    def test_wrong_owner(self): self.latest['assets'][0]['ownerId']='other';self.assertReason('sourceIneligible')
    def test_deleted_card(self): self.latest['cards'][0]['deletedAt']=self.now.isoformat();self.assertReason('cardIneligible')
    def test_fence(self): self.latest['cardFences']=[{'user_id':'owner','card_id':'card'}];self.assertReason('cardFenced')
    def test_old_fence_is_not_removed(self): self.before['cardFences']=[{'user_id':'owner','card_id':'card'}];self.assertReason('cardFenced')
    def test_new_media_missing_from_backup(self):
        extra=copy.deepcopy(self.latest['media'][0]);extra['id']='new';self.latest['media'].append(extra)
        self.assertEqual(self.result()['latestMediaNotInBackup'],1)
    def test_old_retirement_is_not_reversed(self): self.before['media'][0]['state']='DELETED';self.assertReason('backupNotReady')
    def test_missing_collection(self):
        del self.latest['cancelled']
        with self.assertRaises(KeyError):self.result()
    def test_duplicate_identity(self):
        self.latest['assets'].append(copy.deepcopy(self.latest['assets'][0]))
        with self.assertRaises(ValueError):self.result()
    def test_missing_asset_type(self):
        del self.latest['assets'][0]['assetType']
        with self.assertRaises(KeyError):self.result()
    def test_stale_latest(self):
        self.latest['capturedAt']=(self.now-timedelta(minutes=6)).isoformat()
        with self.assertRaises(ValueError):self.result()
    def test_future_latest(self):
        self.latest['capturedAt']=(self.now+timedelta(minutes=6)).isoformat()
        with self.assertRaises(ValueError):self.result()
    def test_no_identifiers_in_report(self):
        import json
        rendered=json.dumps(self.result())
        for value in ['"owner"','"card"','"asset"','"op"','a'*64]:self.assertNotIn(value,rendered)

if __name__=='__main__':unittest.main()
