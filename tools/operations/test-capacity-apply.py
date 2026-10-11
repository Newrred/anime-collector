"""Safety checks for the exact test migration runner; never connect to a DB."""
import contextlib
import importlib.util
import io
import re
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('capacity_apply', Path(__file__).with_name('apply-test-public-capacity.py'))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)

class CapacityApplyTests(unittest.TestCase):
    def invoke(self, args):
        with patch.object(sys, 'argv', ['runner'] + args), patch.object(runner.module, 'connection', return_value={}) as conn, patch.object(runner.subprocess, 'run', return_value=SimpleNamespace(returncode=0, stdout='{}')) as execute, contextlib.redirect_stdout(io.StringIO()):
            code = runner.main()
        return code, conn, execute

    def test_default_inspection_never_writes(self):
        code, conn, execute = self.invoke([])
        self.assertEqual(code, 0)
        conn.assert_called_once_with('test')
        sql = execute.call_args.kwargs['input']
        self.assertTrue(sql.startswith('begin read only;'))
        self.assertTrue(sql.endswith('rollback;'))
        self.assertNotIn('create function', sql)
        self.assertNotIn('notify pgrst', sql)

    def test_dependency_inspection_never_calls_observer(self):
        code, conn, execute = self.invoke(['--observation-dependency'])
        self.assertEqual(code, 0)
        conn.assert_called_once_with('test')
        sql = execute.call_args.kwargs['input']
        self.assertIn('begin read only;', sql)
        self.assertNotIn('select public.observe_', sql)
        self.assertNotIn('update private.', sql)

    def test_dependency_apply_only_installs_exact_function(self):
        code, conn, execute = self.invoke(['--observation-dependency', '--apply'])
        self.assertEqual(code, 0)
        conn.assert_called_once_with('test')
        sql = execute.call_args.kwargs['input']
        executable = re.sub(r'\$candidate\$.*?\$candidate\$', '', sql, flags=re.S)
        self.assertEqual(executable.count('create function'), 1)
        self.assertIn('ALREADY_PRESENT_INSPECT_FIRST', sql)
        self.assertIn(runner.OBSERVATION_RELEASE, sql)
        self.assertNotIn('create table', sql)
        self.assertNotIn('select public.observe_', sql)
        self.assertEqual(sql.count('EXISTING_DATA_CHANGED'), 15)
        self.assertTrue(sql.endswith('commit;'))

    def test_original_candidate_still_has_two_migrations(self):
        code, conn, execute = self.invoke(['--apply'])
        self.assertEqual(code, 0)
        sql = execute.call_args.kwargs['input']
        self.assertEqual(sql.count('insert into supabase_migrations.schema_migrations'), 2)
        self.assertIn(runner.RELEASE, sql)
        self.assertNotIn(runner.OBSERVATION_RELEASE, sql)
        self.assertEqual(sql.count('EXISTING_DATA_CHANGED'), 12)

    def test_changed_candidate_stops_before_connection(self):
        with patch.object(runner, 'OBSERVATION_FILES', {'20261008090000_private_image_observation.sql': 'invalid'}):
            code, conn, execute = self.invoke(['--observation-dependency', '--apply'])
        self.assertEqual(code, 1)
        conn.assert_not_called()
        execute.assert_not_called()

if __name__ == '__main__':
    unittest.main()
