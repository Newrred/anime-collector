import { mkdir, stat, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';

import { sha256 } from '../lib/hash.mjs';
import { toPathKey } from '../lib/path-key.mjs';

function sourceRecordIdentity(envelope) {
  const { fetchedAt, ...identity } = envelope;
  return identity;
}

async function exists(path) {
  return stat(path).then(() => true, (error) => {
    if (error.code === 'ENOENT') return false;
    throw error;
  });
}

export async function storeSourceEnvelope({ workspace, envelope }) {
  const sourceRecordId = sha256(sourceRecordIdentity(envelope));
  const sourcePath = toPathKey(envelope.sourceId);
  const targetPath = toPathKey(envelope.targetKey);
  const path = workspace.resolve('raw', sourcePath, targetPath, `${sourceRecordId}.json`);
  if (await exists(path)) return Object.freeze({ sourceRecordId, created: false, path });

  const rawPayloadRef = relative(workspace.root, path).replaceAll('\\', '/');
  const record = {
    sourceRecordId,
    targetKey: envelope.targetKey,
    sourceId: envelope.sourceId,
    sourceEntityId: envelope.sourceEntityId,
    fetchStatus: envelope.responseStatus >= 200 && envelope.responseStatus < 300 ? 'FETCHED' : 'FAILED_PERMANENT',
    fetchedAt: envelope.fetchedAt,
    requestFingerprint: envelope.requestFingerprint,
    responseStatus: envelope.responseStatus,
    payloadHash: sha256(envelope.payload),
    parserVersion: envelope.parserVersion,
    rawPayloadRef,
    payload: envelope.payload,
  };
  try {
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return Object.freeze({ sourceRecordId, created: true, path });
  } catch (error) {
    if (error.code === 'ENOENT') {
      const directory = workspace.resolve('raw', sourcePath, targetPath);
      await mkdir(directory, { recursive: true });
      try {
        await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
        return Object.freeze({ sourceRecordId, created: true, path });
      } catch (retryError) {
        if (retryError.code === 'EEXIST') return Object.freeze({ sourceRecordId, created: false, path });
        throw retryError;
      }
    }
    if (error.code === 'EEXIST') return Object.freeze({ sourceRecordId, created: false, path });
    throw error;
  }
}
