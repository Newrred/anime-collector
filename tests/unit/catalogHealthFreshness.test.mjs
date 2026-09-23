import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { assessHealthRuns } from '../../scripts/check-catalog-health-run.mjs';
const now = Date.parse('2026-09-23T03:00:00Z');
const run = { id: 1, created_at: new Date(now - 3600000).toISOString(), event: 'schedule', status: 'completed', conclusion: 'success' };
test('health watcher rejects never run, stale, failed, and stuck checks', () => {
  assert.equal(assessHealthRuns([], now).code, 'HEALTH_NEVER_RAN');
  assert.equal(assessHealthRuns([run], now).ok, true);
  assert.equal(assessHealthRuns([{ ...run, created_at: new Date(now - 37 * 3600000).toISOString() }], now).code, 'HEALTH_STALE');
  assert.equal(assessHealthRuns([{ ...run, conclusion: 'failure' }], now).code, 'HEALTH_FAILED');
  assert.equal(assessHealthRuns([{ ...run, status: 'in_progress' }], now).code, 'HEALTH_NOT_COMPLETED');
  assert.equal(assessHealthRuns([{ ...run, created_at: 'invalid' }], now).code, 'HEALTH_STALE');
});
test('health watcher cannot hide a newer failure behind an older success or unrelated push', () => {
  const newer = { ...run, id: 2, created_at: new Date(now).toISOString(), conclusion: 'failure' };
  assert.equal(assessHealthRuns([run, newer], now).ok, false);
  assert.equal(assessHealthRuns([newer, run], now).ok, false);
  assert.equal(assessHealthRuns([{ ...run, event: 'push' }], now).ok, false);
});

test('health configuration failure still emits a machine-readable timestamped report without credentials', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/catalog-health.mjs', import.meta.url))], {
    encoding: 'utf8', env: { ...process.env, PUBLIC_CATALOG_SUPABASE_URL: '', PUBLIC_CATALOG_SUPABASE_ANON_KEY: 'synthetic-secret-never-print' },
  });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.failures[0].code, 'CONFIG_INVALID');
  assert.ok(Number.isFinite(Date.parse(report.checkedAt)));
  assert.ok(!`${result.stdout}${result.stderr}`.includes('synthetic-secret-never-print'));
});
