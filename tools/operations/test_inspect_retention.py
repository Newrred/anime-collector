import contextlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('retention', Path(__file__).with_name('inspect-retention.py'))
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)
apply_spec = importlib.util.spec_from_file_location('apply_retention', Path(__file__).with_name('apply-test-retention.py'))
apply_retention = importlib.util.module_from_spec(apply_spec)
apply_spec.loader.exec_module(apply_retention)


class RetentionSafety(unittest.TestCase):
    def test_apply_requires_exact_approved_candidate(self):
        with patch.object(apply_retention.Path, 'read_text', return_value='changed candidate'):
            with self.assertRaisesRegex(ValueError, 'UNAPPROVED_CANDIDATE'):
                apply_retention.sql_for('apply')

    def test_default_inspection_cannot_execute_cleanup(self):
        sql = apply_retention.sql_for('inspect')
        self.assertTrue(sql.startswith('begin read only;'))
        self.assertTrue(sql.endswith('rollback;'))
        self.assertNotIn('create or replace', sql)
        self.assertNotIn('purge_expired_memory_tombstones(now())', sql)
        mutation = apply_retention.sql_for('apply')
        self.assertIn('BASELINE_MISMATCH', mutation)
        self.assertTrue(mutation.endswith('commit;'))

    def test_target_binding_and_verified_transport(self):
        ref = retention.TARGETS['test']
        values = {'SUPABASE_DB_URL': f'postgresql://postgres.{ref}:synthetic@aws-0.pooler.supabase.com:6543/postgres'}
        env = retention.connection_parameters(values, 'test')
        self.assertEqual(env['PGSSLMODE'], 'verify-full')
        self.assertEqual(env['PGDATABASE'], 'postgres')
        with self.assertRaises(ValueError):
            retention.connection_parameters(values, 'production')
        for url in [values['SUPABASE_DB_URL'].replace('.supabase.com', '.supabase.com.evil.test'),
                    values['SUPABASE_DB_URL'].replace('/postgres', '/other'),
                    values['SUPABASE_DB_URL'].replace('postgresql:', 'https:')]:
            with self.assertRaises(ValueError):
                retention.connection_parameters({'SUPABASE_DB_URL': url}, 'test')

    def test_structured_production_connection(self):
        values = {'SUPABASE_DB_HOST': f"db.{retention.TARGETS['production']}.supabase.co",
                  'SUPABASE_DB_USER': 'postgres', 'SUPABASE_DB_NAME': 'postgres', 'SUPABASE_DB_PASSWORD': 'synthetic'}
        self.assertEqual(retention.connection_parameters(values, 'production')['PGUSER'], 'postgres')
        with self.assertRaises(ValueError):
            retention.connection_parameters(values, 'test')

    def test_queries_are_readonly_bounded_and_do_not_select_job_commands(self):
        calls = []
        def run(args, **kwargs):
            sql = kwargs['input']
            calls.append(sql)
            self.assertTrue(sql.startswith('begin read only;'))
            self.assertTrue(sql.endswith('rollback;'))
            self.assertLessEqual(kwargs['timeout'], 25)
            self.assertNotIn('j.command', sql)
            self.assertNotIn('return_message', sql)
            self.assertNotIn('select *', sql.lower())
            value = {name: True for name in retention.TABLES} if len(calls) == 1 else {}
            return SimpleNamespace(returncode=0, stdout=json.dumps(value), stderr='')
        with patch.object(retention, 'connection', return_value={}), patch.object(retention.subprocess, 'run', side_effect=run):
            self.assertTrue(retention.inspect('test')['readOnly'])
        self.assertEqual(len(calls), 3)

    def test_errors_never_echo_credentials_or_database_content(self):
        output = io.StringIO()
        with patch('sys.argv', ['inspect-retention.py','--target','test']), \
             patch.object(retention, 'inspect', side_effect=ValueError('SYNTHETIC_SECRET')), contextlib.redirect_stdout(output):
            self.assertEqual(retention.main(), 1)
        self.assertNotIn('SYNTHETIC_SECRET', output.getvalue())
        self.assertEqual(json.loads(output.getvalue())['error'], 'RETENTION_INSPECTION_FAILED')


if __name__ == '__main__':
    unittest.main()
