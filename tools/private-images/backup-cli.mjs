import { readFile } from 'node:fs/promises';
import { createEncryptedBackup, restoreEncryptedBackup } from './encrypted-backup.mjs';

// Explicit local file lists only. Secrets are read from the process environment,
// never command-line arguments. No network, DB writes, or serving activation.
try {
  const [mode, configFile] = process.argv.slice(2);
  if (!['create', 'restore'].includes(mode) || !configFile || process.argv.length !== 4) throw Error();
  const rawKey = process.env.MOEMOA_BACKUP_KEY;
  if (!/^[a-fA-F0-9]{64}$/.test(rawKey || '')) throw Error();
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  const key = Buffer.from(rawKey, 'hex');
  delete process.env.MOEMOA_BACKUP_KEY;
  try {
    const result = await (mode === 'create' ? createEncryptedBackup : restoreEncryptedBackup)({ ...config, key });
    console.log(JSON.stringify({ ok: true, mode, ...result }));
  } finally { key.fill(0); }
} catch {
  console.error('BACKUP_FAILED: check key, project/release, explicit input files, integrity and new output directory. No serving was enabled.');
  process.exitCode = 1;
}
