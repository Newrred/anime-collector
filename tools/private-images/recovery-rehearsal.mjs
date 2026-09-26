// Synthetic, local-only rehearsal. Not an operational backup/export command.
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { createEncryptedBackup, restoreEncryptedBackup } from './encrypted-backup.mjs';

if (process.platform !== 'win32') throw new Error('Run this workspace rehearsal from Windows with WSL PostgreSQL installed');
const root = fileURLToPath(new URL('../..', import.meta.url));
const work = await mkdtemp(resolve(root, '.cache/private-recovery-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = {};
for (const [variant, size] of [['main', 64], ['thumb', 16]]) {
  const bytes = await sharp({ create: { width: size, height: size, channels: 3, background: '#347899' } }).webp().toBuffer();
  await writeFile(resolve(work, `${variant}.webp`), bytes);
  manifest[variant] = { hash: hash(bytes), bytes: bytes.length, size };
}
await writeFile(resolve(work, 'manifest.json'), JSON.stringify(manifest));
const wslPath = path => `/mnt/${path[0].toLowerCase()}${path.slice(2).replaceAll('\\', '/')}`;
const result = spawnSync('wsl.exe', ['-u', 'postgres', '-e', 'env',
  `PRIVATE_RECOVERY_FIXTURES=${wslPath(work)}`, 'bash', `${wslPath(root)}/tools/private-images/run-local-postgres.sh`],
{ cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120_000 });
await writeFile(resolve(work, 'postgres.log'), (result.stdout ?? '') + (result.stderr ?? ''));
if (result.error || result.status !== 0) throw new Error(`Local PostgreSQL rehearsal failed; inspect ${work}/postgres.log`);
for (const variant of ['main', 'thumb']) {
  const bytes = await readFile(resolve(work, `restored-${variant}.webp`));
  if (hash(bytes) !== manifest[variant].hash || bytes.length !== manifest[variant].bytes) throw new Error('Restored bytes mismatch');
  const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  if (decoded.info.width !== manifest[variant].size || decoded.info.height !== manifest[variant].size) throw new Error('Restored image decode mismatch');
}
console.log(((result.stdout ?? '') + (result.stderr ?? '')).split('\n').filter(line => line.includes('PASS:')).join('\n'));
console.log('PASS: physically restored main/thumb hashes, byte counts and decoded dimensions');
const context = { project: 'nmgkhknponvzcwliajyk', release: 'synthetic-recovery-local' }, key = randomBytes(32);
const names = ['database.dump', 'latest-journal.json', 'restored-main.webp', 'restored-thumb.webp'];
const encrypted = resolve(work, 'encrypted'), quarantine = resolve(work, 'quarantine');
try {
  await createEncryptedBackup({ files: names.map(name => ({ name, path: resolve(work, name) })), output: encrypted, key, context });
  await restoreEncryptedBackup({ source: encrypted, output: quarantine, key, context });
  for (const name of names) {
    if (hash(await readFile(resolve(work, name))) !== hash(await readFile(resolve(quarantine, 'payload', name)))) throw new Error('Encrypted recovery mismatch');
  }
  const journal = JSON.parse(await readFile(resolve(quarantine, 'payload/latest-journal.json'), 'utf8'));
  if (journal.format !== 'moemoa-private-recovery-journal-v1' || !journal.snapshot || !journal.capturedAt ||
    !journal.accounts.includes('11111111-1111-4111-8111-111111111111') ||
    !journal.cardFences.some(f => f.card_id === 'dddddddd-dddd-4ddd-8ddd-000000000002') ||
    !journal.media.some(m => m.operation_id === '88888888-8888-4888-8888-000000000003' && m.state === 'DELETING')) throw new Error('Incomplete latest journal');
  for (const variant of ['main', 'thumb']) {
    const decoded = await sharp(await readFile(resolve(quarantine, `payload/restored-${variant}.webp`))).raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== manifest[variant].size) throw new Error('Encrypted image decode mismatch');
  }
  console.log('PASS: actual SQL latest journal includes account, source, card fence and known cancellation state');
  console.log('PASS: DB dump, latest journal and WebP bodies survive authenticated encryption and quarantine restore');
} finally { key.fill(0); }
console.log(`Synthetic local evidence: ${work}`);
