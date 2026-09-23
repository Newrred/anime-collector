import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../dist/', import.meta.url);
const info = await readFile(new URL('build-info.json', root));
const path = new URL('sw.js', root);
const source = await readFile(path, 'utf8');
if (!source.includes('__MOEMOA_BUILD__')) throw new Error('SW_BUILD_TOKEN_MISSING');
const version = createHash('sha256').update(info).update(source).digest('hex').slice(0, 20);
await writeFile(path, source.replaceAll('__MOEMOA_BUILD__', version));
