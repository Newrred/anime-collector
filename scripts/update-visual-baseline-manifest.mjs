import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  buildVisualBaselineManifest,
  inspectVisualBaselinePolicy,
  VISUAL_BASELINE_MANIFEST_PATH,
} from '../tools/catalog-lab/visual-baseline-policy.mjs';

function defaultRepoRoot() {
  return fileURLToPath(new URL('..', import.meta.url));
}

export async function writeVisualBaselineManifest({ repoRoot = defaultRepoRoot() } = {}) {
  const manifest = await buildVisualBaselineManifest({ repoRoot });
  const path = resolve(repoRoot, ...VISUAL_BASELINE_MANIFEST_PATH.split('/'));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const inspection = await inspectVisualBaselinePolicy({ repoRoot });
  if (inspection.violations.length > 0) {
    const error = new Error('Written visual baseline manifest failed closed verification');
    error.code = 'VISUAL_BASELINE_POLICY_INVALID';
    throw error;
  }
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) {
    process.stderr.write('Visual baseline manifest rejected: CLI_USAGE_OR_SAFETY\n');
    process.exitCode = 64;
  } else {
    try {
      const manifest = await writeVisualBaselineManifest();
      process.stdout.write(`Visual baseline manifest: ${manifest.entries.length} screenshots\n`);
    } catch (error) {
      process.stderr.write(`Visual baseline manifest rejected: ${error?.code ?? 'VISUAL_BASELINE_POLICY_INVALID'}\n`);
      process.exitCode = 2;
    }
  }
}
