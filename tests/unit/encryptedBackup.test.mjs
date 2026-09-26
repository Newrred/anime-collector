import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createEncryptedBackup, restoreEncryptedBackup } from '../../tools/private-images/encrypted-backup.mjs';
const context = { project: 'nmgkhknponvzcwliajyk', release: 'synthetic-local-v1' };
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'moemoa-encryption-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const bytes = randomBytes(2 * 1024 * 1024 + 17), key = randomBytes(32), path = join(dir, 'input');
  await writeFile(path, bytes);
  return { dir, bytes, key, files: [{ name: 'objects/main.webp', path }], context, output: join(dir, 'backup') };
}
test('encrypted backup streams exact bytes and hides filenames, authenticates project/release', async t => {
  const f = await fixture(t);
  assert.deepEqual(await createEncryptedBackup(f), { files: 1, bytes: f.bytes.length });
  const encrypted = await readFile(join(f.output, 'payload/manifest.enc'));
  assert.equal(encrypted.includes(Buffer.from('objects/main.webp')), false);
  const options = { source: f.output, output: join(f.dir, 'restore'), key: f.key, context };
  for (const bad of [{ ...context, project: 'aaaaaaaaaaaaaaaaaaaa' }, { ...context, release: 'wrong' }])
    await assert.rejects(restoreEncryptedBackup({ ...options, context: bad }));
  await assert.rejects(restoreEncryptedBackup({ ...options, key: randomBytes(32) }));
  await restoreEncryptedBackup(options);
  assert.deepEqual(await readFile(join(options.output, 'payload/objects/main.webp')), f.bytes);
  await assert.rejects(restoreEncryptedBackup(options), /TARGET_EXISTS/);
  await assert.rejects(createEncryptedBackup(f), /TARGET_EXISTS/);
});
test('tampered encrypted body fails without publishing a partial restore or changing input', async t => {
  const f = await fixture(t); await createEncryptedBackup(f);
  const [name] = (await readdir(join(f.output, 'payload'))).filter(n => n !== 'manifest.enc');
  const path = join(f.output, 'payload', name), bytes = await readFile(path); bytes[0] ^= 1; await writeFile(path, bytes);
  const output = join(f.dir, 'restore');
  await assert.rejects(restoreEncryptedBackup({ source: f.output, output, key: f.key, context }));
  await assert.rejects(access(output));
  assert.equal((await readdir(f.dir)).some(n => n.includes('.partial-')), false);
  assert.deepEqual(await readFile(f.files[0].path), f.bytes);
});
test('tampered manifest and unsafe/duplicate names or keys are refused', async t => {
  const f = await fixture(t);
  for (const name of ['../escape', '/absolute', 'C:/escape', 'a\\b', 'CON.txt', 'a./b'])
    await assert.rejects(createEncryptedBackup({ ...f, files: [{ ...f.files[0], name }] }));
  await assert.rejects(createEncryptedBackup({ ...f, files: [f.files[0], { ...f.files[0], name: 'OBJECTS/main.webp' }] }));
  await assert.rejects(createEncryptedBackup({ ...f, key: Buffer.alloc(16) }));
  await createEncryptedBackup(f);
  const path = join(f.output, 'payload/manifest.enc'), bytes = await readFile(path); bytes[20] ^= 1; await writeFile(path, bytes);
  await assert.rejects(restoreEncryptedBackup({ source: f.output, output: join(f.dir, 'restore'), key: f.key, context }));
});

test('backup rejects file/directory collisions regardless of order or platform casing', async t => {
  const f = await fixture(t);
  for (const names of [['objects', 'objects/main.webp'], ['objects/main.webp', 'OBJECTS'], ['a', 'a-b', 'A/nested/file']]) {
    await assert.rejects(createEncryptedBackup({ ...f, files: names.map(name => ({ name, path: f.files[0].path })) }), /BACKUP_INVALID/);
    await assert.rejects(access(f.output));
    assert.equal((await readdir(f.dir)).some(name => name.includes('.partial-')), false);
  }
  assert.deepEqual(await readFile(f.files[0].path), f.bytes);
});

test('restore rejects an authenticated older manifest with conflicting output paths', async t => {
  const f = await fixture(t);
  await createEncryptedBackup({ ...f, files: ['objects', 'other'].map(name => ({ name, path: f.files[0].path })) });
  const path = join(f.output, 'payload/manifest.enc'), encrypted = await readFile(path);
  const aad = Buffer.from(JSON.stringify(['moemoa-encrypted-backup-v1', context.project, context.release, 'manifest']));
  const reader = createDecipheriv('aes-256-gcm', f.key, encrypted.subarray(0, 12));
  reader.setAAD(aad); reader.setAuthTag(encrypted.subarray(-16));
  const manifest = JSON.parse(Buffer.concat([reader.update(encrypted.subarray(12, -16)), reader.final()]));
  manifest.entries[1].name = 'OBJECTS/main.webp';
  const iv = randomBytes(12), writer = createCipheriv('aes-256-gcm', f.key, iv);
  writer.setAAD(aad);
  await writeFile(path, Buffer.concat([iv, writer.update(JSON.stringify(manifest)), writer.final(), writer.getAuthTag()]));
  const output = join(f.dir, 'restore');
  await assert.rejects(restoreEncryptedBackup({ source: f.output, output, key: f.key, context }), /BACKUP_INVALID/);
  await assert.rejects(access(output));
  assert.equal((await readdir(f.dir)).some(name => name.includes('.partial-')), false);
  assert.deepEqual(await readFile(f.files[0].path), f.bytes);
});
