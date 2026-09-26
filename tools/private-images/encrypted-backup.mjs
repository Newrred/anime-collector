import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, rm, rmdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

const FORMAT = 'moemoa-encrypted-backup-v1';
const fail = () => { throw new Error('BACKUP_INVALID'); };
function checkKey(key) { if (!Buffer.isBuffer(key) || key.length !== 32) fail(); }
function checkContext(context) {
  if (!context || !/^[a-z]{20}$/.test(context.project) || !/^[\w.-]{1,100}$/.test(context.release)) fail();
  return { project: context.project, release: context.release };
}
function safeName(name) {
  if (typeof name !== 'string' || name.length > 240 || !name.split('/').every(part =>
    /^[a-zA-Z0-9_.-]+$/.test(part) && part !== '.' && part !== '..' && !part.endsWith('.') &&
    !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part))) fail();
  return name;
}
function checkNames(entries) {
  const names = new Set();
  for (const entry of entries) {
    const name = safeName(entry.name).toLowerCase();
    if (names.has(name)) fail();
    names.add(name);
  }
  // A file cannot also be a parent directory. Check all ancestors rather than
  // just sorted neighbors: "a-b" can sort between "a" and "a/child".
  for (const name of names) {
    for (let slash = name.indexOf('/'); slash !== -1; slash = name.indexOf('/', slash + 1)) {
      if (names.has(name.slice(0, slash))) fail();
    }
  }
}
const aad = (context, id) => Buffer.from(JSON.stringify([FORMAT, context.project, context.release, id]));
function seal(value, key, context) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad(context, 'manifest'));
  return Buffer.concat([iv, cipher.update(Buffer.from(JSON.stringify(value))), cipher.final(), cipher.getAuthTag()]);
}
function unseal(bytes, key, context) {
  if (bytes.length < 28 || bytes.length > 16 * 1024 * 1024) fail();
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  decipher.setAAD(aad(context, 'manifest'));
  decipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8'));
}
function measure() {
  const hash = createHash('sha256'); let bytes = 0;
  return { stream: new Transform({ transform(chunk, encoding, callback) { hash.update(chunk); bytes += chunk.length; callback(null, chunk); } }),
    result: () => ({ hash: hash.digest('hex'), bytes }) };
}
// No existing directory is overwritten. Failed output is removed only from the
// freshly created private staging directory; caller inputs are never deleted.
async function staged(output, action) {
  output = resolve(output);
  try { await lstat(output); throw new Error('BACKUP_TARGET_EXISTS'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const stage = `${output}.partial-${randomUUID()}`;
  await mkdir(stage, { mode: 0o700 });
  try {
    const result = await action(stage);
    // Exclusive final-directory creation prevents concurrent backups replacing one another.
    await mkdir(output, { mode: 0o700 });
    try { await rename(stage, resolve(output, 'payload')); }
    catch (e) { await rmdir(output).catch(() => {}); throw e; }
    return result;
  } finally { await rm(stage, { recursive: true, force: true }); }
}

export async function createEncryptedBackup({ files, output, key, context }) {
  checkKey(key); context = checkContext(context);
  if (!Array.isArray(files) || files.length < 1 || files.length > 10000) fail();
  checkNames(files);
  return staged(output, async stage => {
    const entries = [];
    for (const file of files) {
      // Explicit regular-file inputs only. No directory traversal or symlink recursion.
      const stat = await lstat(file.path);
      if (!stat.isFile() || stat.isSymbolicLink()) fail();
      const handle = await open(file.path, 'r');
      try {
        const before = await handle.stat();
        if (before.ino !== stat.ino || before.dev !== stat.dev || !before.isFile()) fail();
        const id = randomUUID(), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv), meter = measure();
        cipher.setAAD(aad(context, id));
        await pipeline(handle.createReadStream({ autoClose: false }), meter.stream, cipher,
          createWriteStream(resolve(stage, id), { flags: 'wx', mode: 0o600 }));
        const measured = meter.result(), after = await handle.stat();
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || measured.bytes !== before.size) fail();
        entries.push({ name: file.name, id, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ...measured });
      } finally { await handle.close(); }
    }
    const manifest = seal({ format: FORMAT, context, createdAt: new Date().toISOString(), entries }, key, context);
    const handle = await open(resolve(stage, 'manifest.enc'), 'wx', 0o600);
    try { await handle.writeFile(manifest); } finally { await handle.close(); }
    return { files: entries.length, bytes: entries.reduce((sum, item) => sum + item.bytes, 0) };
  });
}

// Restores bytes ONLY into a new quarantine folder. Never connects to a DB,
// applies stale manifests, enables serving, or asserts deletion-journal freshness.
export async function restoreEncryptedBackup({ source, output, key, context }) {
  checkKey(key); context = checkContext(context);
  const input = resolve(source, 'payload');
  const manifestPath = resolve(input, 'manifest.enc'), manifestStat = await lstat(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 16 * 1024 * 1024) fail();
  const manifest = unseal(await readFile(manifestPath), key, context);
  if (manifest.format !== FORMAT || JSON.stringify(manifest.context) !== JSON.stringify(context) ||
    !Array.isArray(manifest.entries) || manifest.entries.length < 1 || manifest.entries.length > 10000) fail();
  checkNames(manifest.entries);
  const ids = new Set();
  for (const entry of manifest.entries) {
    if (!/^[a-f0-9-]{36}$/.test(entry.id) || !/^[a-f0-9]{24}$/.test(entry.iv) ||
      !/^[a-f0-9]{32}$/.test(entry.tag) || !/^[a-f0-9]{64}$/.test(entry.hash) ||
      !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || ids.has(entry.id)) fail();
    ids.add(entry.id);
  }
  return staged(output, async stage => {
    for (const entry of manifest.entries) {
      const path = resolve(input, entry.id), stat = await lstat(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.bytes) fail();
      const destination = resolve(stage, entry.name);
      if (!destination.startsWith(stage + sep)) fail();
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(entry.iv, 'hex')), meter = measure();
      decipher.setAAD(aad(context, entry.id)); decipher.setAuthTag(Buffer.from(entry.tag, 'hex'));
      await pipeline(createReadStream(path), decipher, meter.stream, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
      const actual = meter.result();
      if (actual.bytes !== entry.bytes || actual.hash !== entry.hash) fail();
    }
    return { files: manifest.entries.length, bytes: manifest.entries.reduce((sum, item) => sum + item.bytes, 0) };
  });
}
