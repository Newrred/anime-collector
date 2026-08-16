import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export async function atomicWriteJson(path, value) {
  const directory = dirname(path);
  const temporaryPath = join(directory, `${basename(path)}.${randomUUID()}.tmp`);
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
}
