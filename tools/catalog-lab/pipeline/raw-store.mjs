import { randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';

import { sha256 } from '../lib/hash.mjs';
import { toPathKey } from '../lib/path-key.mjs';

const REPAIR_LOCK_POLICY = Object.freeze({ maxWaitAttempts: 20, waitMs: 5 });

function sourceRecordIdentity(envelope) {
  const { fetchedAt, ...identity } = envelope;
  return identity;
}

async function writeDurableTemporaryRecord(directory, path, record) {
  const temporaryPath = join(directory, `${basename(path)}.${randomUUID()}.tmp`);
  const file = await open(temporaryPath, 'wx');
  try {
    await file.writeFile(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
    await file.sync();
  } finally {
    await file.close();
  }
  return temporaryPath;
}

async function isValidExistingRecord(path, sourceRecordId, payloadHash) {
  try {
    const record = JSON.parse(await readFile(path, 'utf8'));
    return record?.sourceRecordId === sourceRecordId
      && record.payloadHash === payloadHash
      && sha256(record.payload) === payloadHash;
  } catch {
    return false;
  }
}

async function quarantineCorruptRecord(path) {
  try {
    await rename(path, `${path}.corrupt.${randomUUID()}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function waitForRepairLock() {
  return new Promise((resolve) => setTimeout(resolve, REPAIR_LOCK_POLICY.waitMs));
}

function repairLockTimeoutError(path) {
  const error = new Error('Raw record repair lock did not become available');
  error.code = 'RAW_REPAIR_LOCK_TIMEOUT';
  error.recoverable = true;
  error.path = path;
  return error;
}

async function acquireRepairLock(path, { onRepairLocked, onRepairWaiting } = {}) {
  const lockPath = `${path}.repair.lock`;
  let waiting = false;
  let attempts = 0;
  while (true) {
    try {
      const file = await open(lockPath, 'wx');
      try {
        await onRepairLocked?.();
      } catch (error) {
        await file.close();
        await rm(lockPath, { force: true });
        throw error;
      }
      return async () => {
        await file.close();
        await rm(lockPath, { force: true });
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      attempts += 1;
      if (attempts >= REPAIR_LOCK_POLICY.maxWaitAttempts) throw repairLockTimeoutError(path);
      if (!waiting) {
        waiting = true;
        await onRepairWaiting?.();
      }
      await waitForRepairLock();
    }
  }
}

async function publishRecord(directory, path, record) {
  const temporaryPath = await writeDurableTemporaryRecord(directory, path, record);
  try {
    await link(temporaryPath, path);
    await rm(temporaryPath);
    await syncDirectory(directory);
    return true;
  } catch (error) {
    await rm(temporaryPath, { force: true });
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

async function syncDirectory(directory) {
  try {
    const handle = await open(directory, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Windows does not allow opening directories for fsync; the staged file is still fsynced.
  }
}

export async function storeSourceEnvelope({
  workspace, envelope, onRepairLocked, onRepairWaiting,
}) {
  const sourceRecordId = sha256(sourceRecordIdentity(envelope));
  const sourcePath = toPathKey(envelope.sourceId);
  const targetPath = toPathKey(envelope.targetKey);
  const path = workspace.resolve('raw', sourcePath, targetPath, `${sourceRecordId}.json`);
  const directory = workspace.resolve('raw', sourcePath, targetPath);

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
  await mkdir(directory, { recursive: true });
  while (true) {
    if (await publishRecord(directory, path, record)) {
      return Object.freeze({ sourceRecordId, created: true, path });
    }
    if (await isValidExistingRecord(path, sourceRecordId, record.payloadHash)) {
      return Object.freeze({ sourceRecordId, created: false, path });
    }
    const releaseRepairLock = await acquireRepairLock(path, { onRepairLocked, onRepairWaiting });
    try {
      if (await isValidExistingRecord(path, sourceRecordId, record.payloadHash)) {
        return Object.freeze({ sourceRecordId, created: false, path });
      }
      await quarantineCorruptRecord(path);
      if (await publishRecord(directory, path, record)) {
        return Object.freeze({ sourceRecordId, created: true, path });
      }
    } finally {
      await releaseRepairLock();
    }
  }
}
