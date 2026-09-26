import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

test('build provenance verifies checkout and distinguishes formatting from configuration changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'moemoa-provenance-'));
  try {
    await mkdir(join(dir, 'scripts')); await mkdir(join(dir, 'public'));
    await copyFile(new URL('../../scripts/write-build-info.mjs', import.meta.url), join(dir, 'scripts/write-build-info.mjs'));
    const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true });
    await writeFile(join(dir, 'vercel.json'), '{"framework":"astro","buildCommand":"npm run build"}\n');
    await writeFile(join(dir, '.gitignore'), 'public/build-info.json\n');
    git(['init', '-q']); git(['add', '.']); git(['-c', 'user.name=Local Test', '-c', 'user.email=local@example.test', 'commit', '-qm', 'fixture']);
    const sha = git(['rev-parse', 'HEAD']).trim();
    const run = (overrides = {}) => spawnSync(process.execPath, ['scripts/write-build-info.mjs'], { cwd: dir, encoding: 'utf8', windowsHide: true,
      env: { ...process.env, VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: sha, ...overrides } });
    const info = async () => JSON.parse(await readFile(join(dir, 'public/build-info.json'), 'utf8'));
    assert.equal(run().status, 0);
    assert.equal((await info()).checkoutCommit, sha);
    assert.equal((await info()).workingTreeDirty, false);
    assert.equal((await info()).deploymentConfig.semanticMatch, true);
    await writeFile(join(dir, 'vercel.json'), '{\n "buildCommand": "npm run build",\n "framework": "astro"\n}\n');
    assert.equal(run().status, 0);
    const formatted = await info();
    assert.equal(formatted.workingTreeDirty, true);
    assert.equal(formatted.deploymentConfig.semanticMatch, true);
    assert.notEqual(formatted.deploymentConfig.trackedSha256, formatted.deploymentConfig.buildSha256);
    await writeFile(join(dir, 'vercel.json'), '{"framework":"astro","buildCommand":"changed-value-not-for-logs"}');
    const changed = run(); assert.equal(changed.status, 0);
    assert.equal((await info()).deploymentConfig.semanticMatch, false);
    assert.ok(!JSON.stringify(await info()).includes('changed-value-not-for-logs'));
    assert.ok(!changed.stdout.includes('changed-value-not-for-logs'));
    const wrong = run({ VERCEL_GIT_COMMIT_SHA: 'f'.repeat(40) });
    assert.notEqual(wrong.status, 0); assert.match(wrong.stderr, /BUILD_COMMIT_MISMATCH/);
    const missing = run({ VERCEL_GIT_COMMIT_SHA: '' });
    assert.notEqual(missing.status, 0); assert.match(missing.stderr, /require the Vercel Git integration/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
