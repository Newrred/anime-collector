import {
  createAccountOwner,
  createDefaultSyncEnvelope,
  requireOwnerId,
} from "../../domain/memoryDomain.js";

const ENTITY_TYPES = new Set([
  "PRIVATE_TITLE",
  "MEMORY_CARD",
  "VISUAL_ASSET",
  "MEMORY_BOARD",
  "MEMORY_BOARD_CARD",
]);
const OPERATION_TYPES = new Set(["UPSERT", "DELETE", "PROMOTE", "RESOLVE_CONFLICT"]);
const OPERATION_STATES = new Set(["PENDING", "APPLIED", "CONFLICT", "REJECTED"]);
const HASH = /^[0-9a-f]{64}$/;

const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result ?? null);
  request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
  transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
});

const clone = (value) => value == null ? value : structuredClone(value);
const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};

const requireText = (value, field) => {
  const text = String(value || "").trim();
  if (!text) fail("SYNC_RECORD_INVALID", `${field} is required`);
  return text;
};

const readOwner = async (database, ownerId) => {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction("owners", "readonly");
  const owner = await requestResult(transaction.objectStore("owners").get(validOwnerId));
  await transactionDone(transaction);
  return owner || null;
};

const validateOperation = (operation) => {
  const value = operation && typeof operation === "object" ? operation : {};
  const normalized = {
    id: requireText(value.id, "operation id"),
    ownerId: requireOwnerId(value.ownerId),
    entityType: String(value.entityType || ""),
    entityId: requireText(value.entityId, "entity id"),
    operationType: String(value.operationType || ""),
    baseVersion: Number(value.baseVersion),
    requestHash: String(value.requestHash || ""),
    payload: clone(value.payload),
    state: String(value.state || ""),
    createdAt: requireText(value.createdAt, "createdAt"),
  };
  if (!ENTITY_TYPES.has(normalized.entityType)
    || !OPERATION_TYPES.has(normalized.operationType)
    || !OPERATION_STATES.has(normalized.state)
    || !Number.isSafeInteger(normalized.baseVersion)
    || normalized.baseVersion < 0
    || !HASH.test(normalized.requestHash)) {
    fail("SYNC_RECORD_INVALID", "Sync operation fields are invalid");
  }
  let payloadText;
  try {
    payloadText = JSON.stringify(normalized.payload);
  } catch {
    fail("SYNC_RECORD_INVALID", "Sync payload must be JSON serializable");
  }
  if (payloadText === undefined || new TextEncoder().encode(payloadText).byteLength > 1048576) {
    fail("SYNC_RECORD_INVALID", "Sync payload exceeds its local bound");
  }
  return Object.freeze(normalized);
};

export const defaultSyncEnvelope = (now) => createDefaultSyncEnvelope(now);

export async function appendSyncOperation(database, operation) {
  const normalized = validateOperation(operation);
  if (!await readOwner(database, normalized.ownerId)) {
    fail("OWNER_NOT_FOUND", "Sync operation owner does not exist");
  }
  const transaction = database.transaction("sync_outbox", "readwrite");
  transaction.objectStore("sync_outbox").add(normalized);
  await transactionDone(transaction);
}

export async function listPendingSyncOperations(database, ownerId, limit = 50) {
  const validOwnerId = requireOwnerId(ownerId);
  const maximum = Number(limit);
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 50) {
    fail("SYNC_LIMIT_INVALID", "Pending sync limit must be between 1 and 50");
  }
  if (!await readOwner(database, validOwnerId)) return [];
  const transaction = database.transaction("sync_outbox", "readonly");
  const rows = await requestResult(transaction.objectStore("sync_outbox").getAll());
  await transactionDone(transaction);
  return clone((rows || [])
    .filter((row) => row.ownerId === validOwnerId && row.state === "PENDING")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, maximum));
}

export async function readDeviceSyncState(database, ownerId) {
  const validOwnerId = requireOwnerId(ownerId);
  if (!await readOwner(database, validOwnerId)) return null;
  const transaction = database.transaction("device_sync_state", "readonly");
  const state = await requestResult(transaction.objectStore("device_sync_state").get(validOwnerId));
  await transactionDone(transaction);
  return state?.ownerId === validOwnerId ? clone(state) : null;
}

export async function writeDeviceSyncState(database, state) {
  const value = state && typeof state === "object" ? state : {};
  const ownerId = requireOwnerId(value.ownerId);
  const owner = await readOwner(database, ownerId);
  const expectedAccount = createAccountOwner({ userId: value.userId, now: value.updatedAt });
  if (!owner || owner.kind !== "ACCOUNT" || expectedAccount.id !== ownerId
    || !requireText(value.installationId, "installationId")
    || !requireText(value.deviceId, "deviceId")
    || !Number.isSafeInteger(Number(value.lastSyncSeq))
    || Number(value.lastSyncSeq) < 0) {
    fail("DEVICE_SYNC_STATE_INVALID", "Device sync state is invalid");
  }
  const normalized = Object.freeze({
    ownerId,
    userId: expectedAccount.userId,
    installationId: String(value.installationId),
    deviceId: String(value.deviceId),
    lastSyncSeq: Number(value.lastSyncSeq),
    updatedAt: requireText(value.updatedAt, "updatedAt"),
  });
  const transaction = database.transaction("device_sync_state", "readwrite");
  transaction.objectStore("device_sync_state").put(normalized);
  await transactionDone(transaction);
}
