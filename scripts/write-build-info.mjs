import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const sha = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('BUILD_COMMIT_INVALID');
if (process.env.VERCEL_ENV === 'production' && !process.env.VERCEL_GIT_COMMIT_SHA) {
  throw new Error('Production builds require the Vercel Git integration.');
}
const workingTreeStatus = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim();
const workingTreeDirty = Boolean(workingTreeStatus);
// Build logs contain changed paths only, never environment values or file contents.
if (workingTreeDirty) console.info('Build provenance changed paths:', workingTreeStatus);
await writeFile(new URL('../public/build-info.json', import.meta.url), `${JSON.stringify({
  commit: sha, builtAt: new Date().toISOString(), workingTreeDirty,
  source: process.env.VERCEL_GIT_COMMIT_SHA ? 'vercel-git' : 'local',
}, null, 2)}\n`);
