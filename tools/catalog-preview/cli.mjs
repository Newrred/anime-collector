import { fileURLToPath } from 'node:url';

import { openCatalogWorkspace } from '../catalog-lab/lib/workspace.mjs';
import { exportServiceProjectionV2, validateServiceProjectionV2Release } from './export-v2.mjs';
import { uploadCatalogPreview } from './uploader.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const [command, ...args] = process.argv.slice(2);
const allowed = new Set(['--profile', '--allow-upload']);
for (const arg of args.filter((value) => value.startsWith('--'))) {
  const key = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
  if (!allowed.has(key)) {
    process.stderr.write('Catalog preview command rejected: OPTION_INVALID\n');
    process.exitCode = 64;
  }
}

function option(name, fallback) {
  const prefix = `${name}=`;
  const direct = args.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

if (!process.exitCode) {
  try {
    const profile = option('--profile', 'full3998');
    if (!/^[a-z0-9]+$/u.test(profile)) throw Object.assign(new Error(), { code: 'PROFILE_INVALID' });
    const workspace = await openCatalogWorkspace({ repoRoot, create: false });
    let result;
    if (command === 'export') result = await exportServiceProjectionV2({ workspace, profile });
    else if (command === 'validate') result = await validateServiceProjectionV2Release({ workspace, profile });
    else if (command === 'upload') result = await uploadCatalogPreview({
      workspace, profile, allowUpload: args.includes('--allow-upload'),
    });
    else throw Object.assign(new Error(), { code: 'COMMAND_INVALID' });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Catalog preview command rejected: ${error?.code || 'FAILED'}\n`);
    process.exitCode = 64;
  }
}
