import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../../.github/workflows/private-image-cleanup.yml', import.meta.url), 'utf8');
const [production, testJob] = workflow.split('  phone-test-cleanup:');

test('cleanup workflow keeps production scheduled work out of phone-test dispatches', () => {
  assert.match(production, /if: github\.ref == 'refs\/heads\/master' && vars\.MOEMOA_PRIVATE_IMAGE_CLEANUP_ENABLED == 'true'/);
  assert.match(production, /OBSERVE_ONLY: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}/);
  assert.match(production, /cron: '7 0,6,12,18 \* \* \*'/);
  assert.match(workflow, /'phone-test-private-image-cleanup' \|\| 'private-image-cleanup'/);
});

test('test cleanup is manual, branch/repository limited and isolated in its own secret environment', () => {
  assert.ok(testJob);
  assert.match(testJob, /if: github\.event_name == 'workflow_dispatch' && github\.repository == 'Newrred\/anime-collector' && github\.ref == 'refs\/heads\/codex\/phone-test'/);
  assert.match(testJob, /environment: moemoa-test-cleanup/);
  assert.match(testJob, /persist-credentials: false/);
  assert.match(testJob, /npm ci --ignore-scripts --no-audit --no-fund/);
  assert.match(testJob, /MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY \}\}/);
  assert.match(testJob, /run: node tools\/private-images\/run-phone-test-cleanup\.mjs --apply/);
  assert.doesNotMatch(testJob, /secrets\.MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET|CLEANUP_ORIGIN|PUBLIC_CLEANUP|vercel-protection-bypass/);
  assert.equal((testJob.match(/secrets\./g) || []).length, 1);
});
