import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const testDirectory = process.env.MOEMOA_CATALOG_TEST_DIR ?? fileURLToPath(new URL('.', import.meta.url));
const files = (await readdir(testDirectory))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => join(testDirectory, name));
const { NODE_TEST_CONTEXT: _nodeTestContext, ...childEnv } = process.env;

const code = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--test', ...files], { env: childEnv, stdio: 'inherit' });
  child.on('error', reject);
  child.on('close', (exitCode) => resolve(exitCode ?? 1));
});

process.exitCode = code;
