import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const checkoutCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sha = process.env.VERCEL_GIT_COMMIT_SHA || checkoutCommit;
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('BUILD_COMMIT_INVALID');
if (sha !== checkoutCommit) throw new Error('BUILD_COMMIT_MISMATCH');
if (process.env.VERCEL_ENV === 'production' && !process.env.VERCEL_GIT_COMMIT_SHA) {
  throw new Error('Production builds require the Vercel Git integration.');
}
const workingTreeStatus = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim();
const workingTreeDirty = Boolean(workingTreeStatus);
// Build logs contain changed paths only, never environment values or file contents.
if (workingTreeDirty) console.info('Build provenance changed paths:', workingTreeStatus);
// Hash only this public deployment config, never env files or arbitrary dirty contents.
const trackedConfig = execFileSync('git', ['show', 'HEAD:vercel.json']);
const buildConfig = await readFile(new URL('../vercel.json', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const deploymentConfig = {
  trackedSha256: hash(trackedConfig), buildSha256: hash(buildConfig),
  semanticMatch: JSON.stringify(canonical(JSON.parse(trackedConfig))) === JSON.stringify(canonical(JSON.parse(buildConfig))),
};
await writeFile(new URL('../public/build-info.json', import.meta.url), `${JSON.stringify({
  commit: sha, checkoutCommit, builtAt: new Date().toISOString(), workingTreeDirty, deploymentConfig,
  source: process.env.VERCEL_GIT_COMMIT_SHA ? 'vercel-git' : 'local',
}, null, 2)}\n`);
