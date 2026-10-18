import contextlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('df02',Path(__file__).with_name('inspect-retention-response.py'))
df02=importlib.util.module_from_spec(spec)
spec.loader.exec_module(df02)
apply_spec=importlib.util.spec_from_file_location('df02_apply',Path(__file__).with_name('apply-production-retention-response.py'))
df02_apply=importlib.util.module_from_spec(apply_spec)
apply_spec.loader.exec_module(df02_apply)


class DF02InspectionSafety(unittest.TestCase):
    def test_read_only_no_mutations_or_payload_export(self):
        sql=df02.query_sql().lower()
        self.assertTrue(sql.startswith('begin read only;'))
        self.assertTrue(sql.rstrip().endswith('rollback;'))
        for forbidden in ['create or replace','delete from','update public','insert into','select *','result_payload as','return_message']:
            self.assertNotIn(forbidden,sql)
        self.assertIn("statement_timeout='20s'",sql)
        self.assertNotIn("'command',j.command",sql)
        self.assertIn("j.command='select public.purge_expired_memory_tombstones(now())'",sql)

    def test_metadata_body_stays_internal(self):
        body=df02.source_body(df02.ROOT/'tools/operations/retention-response-candidate.sql')
        raw={'body':body,'definition':'SYNTHETIC_DEFINITION','metadata':{},'impact':{}}
        with patch.object(df02.retention,'connection',return_value={}),patch.object(df02.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=json.dumps(raw))):
            result=df02.inspect('test')
        self.assertTrue(result['approvedTestFunction'])
        self.assertNotIn('body',result)
        self.assertNotIn('definition',result)
        self.assertNotIn('SYNTHETIC_DEFINITION',json.dumps(result))

    def test_migration_reuses_approved_function_and_acl(self):
        old=(df02.ROOT/'tools/operations/retention-response-candidate.sql').read_text(encoding='utf-8')
        new=(df02.ROOT/'supabase/migrations/20261019090000_memory_retention_response_cleanup.sql').read_text(encoding='utf-8')
        self.assertEqual(old[old.index('create or replace'):],new[new.index('create or replace'):])
        self.assertNotIn('cron.schedule',new)
        self.assertNotIn('purge_expired_memory_tombstones(now())',new)

    def test_failures_never_print_db_details(self):
        output=io.StringIO()
        with patch('sys.argv',['inspect-retention-response.py','--target','production']),patch.object(df02,'inspect',side_effect=ValueError('SYNTHETIC_SECRET')),contextlib.redirect_stdout(output):
            self.assertEqual(df02.main(),1)
        self.assertNotIn('SYNTHETIC_SECRET',output.getvalue())
        self.assertTrue(json.loads(output.getvalue())['readOnly'])

    def test_apply_without_exact_commit_stops_before_connection(self):
        output=io.StringIO()
        with patch('sys.argv',['apply-production-retention-response.py','--apply']),patch.object(df02_apply.inspect_tool,'inspect') as query,contextlib.redirect_stdout(output):
            self.assertEqual(df02_apply.main(),1)
        query.assert_not_called()

    def test_default_executor_is_read_only(self):
        output=io.StringIO()
        with patch('sys.argv',['apply-production-retention-response.py']),patch.object(df02_apply.inspect_tool,'inspect',return_value={'readOnly':True}),patch.object(df02_apply,'verify_source') as verify,contextlib.redirect_stdout(output):
            self.assertEqual(df02_apply.main(),0)
        verify.assert_not_called()
        self.assertEqual(json.loads(output.getvalue())['mode'],'READ_ONLY')

    def test_apply_sql_has_guards_ledger_and_no_manual_purge(self):
        source=(df02.ROOT/'supabase/migrations/20261019090000_memory_retention_response_cleanup.sql').read_text(encoding='utf-8')
        sql=df02_apply.apply_sql(source,'a'*40)
        self.assertTrue(sql.startswith('begin;'))
        self.assertTrue(sql.endswith('commit;'))
        self.assertIn('DF02_BASELINE_CHANGED',sql)
        self.assertIn('DF02_RESULT_MISMATCH',sql)
        self.assertIn('insert into supabase_migrations.schema_migrations',sql)
        self.assertNotIn('\nselect public.purge_expired_memory_tombstones(',sql)


if __name__=='__main__':
    unittest.main()
