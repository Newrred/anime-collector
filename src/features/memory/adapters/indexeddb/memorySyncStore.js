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
    ordinal: Number(value.ordinal ?? 0),
  };
  if (!ENTITY_TYPES.has(normalized.entityType)
    || !OPERATION_TYPES.has(normalized.operationType)
    || !OPERATION_STATES.has(normalized.state)
    || !Number.isSafeInteger(normalized.baseVersion)
    || !Number.isSafeInteger(normalized.ordinal)
    || normalized.ordinal < 0
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
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt)
      || Number(left.ordinal || 0) - Number(right.ordinal || 0)
      || left.id.localeCompare(right.id))
    .slice(0, maximum));
}

export function appendSyncOperationsToTransaction(transaction, operations = []) {
  if (!operations.length) return;
  const outbox = transaction.objectStore("sync_outbox");
  for (const operation of operations) outbox.add(validateOperation(operation));
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

const ENTITY_STORES = Object.freeze({
  PRIVATE_TITLE: "private_titles",
  MEMORY_CARD: "memory_cards",
  VISUAL_ASSET: "visual_assets",
  MEMORY_BOARD: "memory_boards",
  MEMORY_BOARD_CARD: "memory_board_cards",
});

const snakeToCamel = (key) => key.replace(/_([a-z])/g, (_, character) => character.toUpperCase());
const normalizeRemoteShape = (remote) => Object.fromEntries(
  Object.entries(remote || {}).map(([key, value]) => [snakeToCamel(key), clone(value)]),
);
const conflictIdFor = (ownerId, entityType, entityId) => `${ownerId}|${entityType}|${entityId}`;

const toLocalEntity = (entityType, remoteInput, ownerId, existing = null) => {
  const remote = normalizeRemoteShape(remoteInput);
  const clientUpdatedAt = String(remote.clientUpdatedAt || remote.serverUpdatedAt || remote.createdAt);
  const shared = {
    ...(existing || {}),
    id: remote.id,
    ownerId,
    createdAt: String(remote.createdAt),
    updatedAt: clientUpdatedAt,
    deletedAt: remote.deletedAt ?? null,
    sync: {
      remoteVersion: Number(remote.version),
      syncState: "SYNCED",
      clientUpdatedAt,
      serverUpdatedAt: String(remote.serverUpdatedAt),
      lastOperationId: null,
    },
  };
  if (entityType === "PRIVATE_TITLE") return {
    ...shared,
    displayTitle: remote.displayTitle,
    normalizedTitle: remote.normalizedTitle,
    optionalGenres: remote.optionalGenres || [],
  };
  if (entityType === "MEMORY_CARD") return {
    ...shared,
    animeRefId: existing?.animeRefId ?? null,
    catalogAnimeId: remote.catalogAnimeId ?? null,
    privateTitleId: remote.privateTitleId ?? null,
    titleSnapshot: remote.titleSnapshot,
    visualAssetId: existing?.visualAssetId ?? null,
    status: remote.status,
    note: remote.note ?? null,
    watchedAt: remote.watchedAt ?? null,
    watchedAtPrecision: remote.watchedAtPrecision || "UNKNOWN",
    episode: remote.episode ?? null,
    sceneCue: remote.sceneCue ?? null,
    emotionTags: remote.emotionTags || [],
    rewatchIntent: remote.rewatchIntent ?? null,
  };
  if (entityType === "VISUAL_ASSET") return {
    ...shared,
    cardId: remote.cardId,
    imageType: remote.assetType === "SYSTEM_DESIGN" ? "SYSTEM_DESIGN" : "USER_IMAGE",
    state: remote.state,
    storageScope: "LOCAL_ONLY",
    visibility: "PRIVATE",
    rightsBasis: remote.rightsBasis,
    localRef: existing?.localRef ?? null,
    checksumSha256: remote.checksumSha256 ?? null,
    mimeType: remote.mimeType ?? null,
    byteSize: remote.byteSize ?? null,
    width: remote.width ?? null,
    height: remote.height ?? null,
    designSpec: remote.designSpec ?? null,
    isCurrent: Boolean(remote.isCurrent),
  };
  if (entityType === "MEMORY_BOARD") return {
    ...shared,
    title: remote.title,
    description: remote.description || "",
    visibility: "PRIVATE",
  };
  return {
    ...shared,
    boardId: remote.boardId,
    cardId: remote.cardId,
    positionKey: remote.positionKey,
  };
};

const updateCursorInTransaction = async (transaction, ownerId, nextSyncSeq, now) => {
  if (nextSyncSeq == null) return;
  const store = transaction.objectStore("device_sync_state");
  const state = await requestResult(store.get(ownerId));
  if (!state) fail("DEVICE_SYNC_STATE_INVALID", "Device sync state is unavailable");
  store.put({ ...state, lastSyncSeq: Math.max(Number(state.lastSyncSeq || 0), Number(nextSyncSeq)), updatedAt: String(now) });
};

export async function countPendingSyncOperations(database, ownerId) {
  const validOwnerId = requireOwnerId(ownerId);
  const transaction = database.transaction("sync_outbox", "readonly");
  const rows = await requestResult(transaction.objectStore("sync_outbox").getAll());
  await transactionDone(transaction);
  return rows.filter((row) => row.ownerId === validOwnerId && row.state === "PENDING").length;
}

export async function rebaseSyncOperation(database, { ownerId, operationId, baseVersion, requestHash }) {
  const transaction = database.transaction("sync_outbox", "readwrite");
  const store = transaction.objectStore("sync_outbox");
  const operation = await requestResult(store.get(String(operationId)));
  if (!operation || operation.ownerId !== ownerId || operation.state !== "PENDING") {
    transaction.abort();
    fail("SYNC_OPERATION_NOT_FOUND", "Pending sync operation is unavailable");
  }
  store.put(validateOperation({ ...operation, baseVersion, requestHash }));
  await transactionDone(transaction);
}

export async function hasPendingEntityOperation(database, ownerId, entityType, entityId) {
  const transaction = database.transaction("sync_outbox", "readonly");
  const rows = await requestResult(transaction.objectStore("sync_outbox").getAll());
  await transactionDone(transaction);
  return rows.some((row) => row.ownerId === ownerId && row.entityType === entityType
    && row.entityId === entityId && row.state === "PENDING");
}

export async function commitSyncMutation(database, { ownerId, operation, result, now }) {
  const storeName = ENTITY_STORES[operation.entityType];
  if (!storeName) fail("SYNC_RECORD_INVALID", "Unknown sync entity type");
  const transaction = database.transaction(
    [storeName, "sync_outbox", "sync_conflicts", "device_sync_state"],
    "readwrite",
  );
  const outbox = transaction.objectStore("sync_outbox");
  const stored = await requestResult(outbox.get(operation.id));
  if (!stored || stored.ownerId !== ownerId || stored.state !== "PENDING") {
    transaction.abort();
    fail("SYNC_OPERATION_NOT_FOUND", "Pending sync operation is unavailable");
  }
  outbox.put({
    ...stored,
    baseVersion: operation.baseVersion,
    requestHash: operation.requestHash,
    state: result.status,
    resultCode: result.errorCode ?? null,
    appliedVersion: result.entityVersion ?? null,
    syncSeq: result.syncSeq ?? null,
    updatedAt: String(now),
  });
  if (result.status === "APPLIED") {
    const allOperations = await requestResult(outbox.getAll());
    const hasNewerPending = allOperations.some((row) => row.id !== operation.id
      && row.ownerId === ownerId && row.entityType === operation.entityType
      && row.entityId === operation.entityId && row.state === "PENDING");
    const entities = transaction.objectStore(storeName);
    const local = await requestResult(entities.get(operation.entityId));
    if (local?.ownerId === ownerId) {
      entities.put({
        ...local,
        sync: {
          ...(local.sync || createDefaultSyncEnvelope(now)),
          remoteVersion: Number(result.entityVersion),
          syncState: hasNewerPending ? "PENDING" : "SYNCED",
          serverUpdatedAt: String(now),
          lastOperationId: operation.id,
        },
      });
    }
    await updateCursorInTransaction(transaction, ownerId, result.syncSeq, now);
  } else if (result.status === "CONFLICT") {
    const conflicts = transaction.objectStore("sync_conflicts");
    const id = conflictIdFor(ownerId, operation.entityType, operation.entityId);
    conflicts.put({
      id,
      ownerId,
      entityType: operation.entityType,
      entityId: operation.entityId,
      state: "OPEN",
      localEntity: clone(operation.payload),
      remoteEntity: clone(result.remoteEntity),
      remoteVersion: Number(result.entityVersion),
      createdAt: String(now),
      updatedAt: String(now),
      localBackup: null,
      resolution: null,
    });
    const entities = transaction.objectStore(storeName);
    const local = await requestResult(entities.get(operation.entityId));
    if (local?.ownerId === ownerId) entities.put({ ...local, sync: { ...local.sync, syncState: "CONFLICT" } });
  }
  await transactionDone(transaction);
}

const pendingPayloadFor = (rows, ownerId, entityType, entityId, fallback) => {
  const pending = rows.filter((row) => row.ownerId === ownerId && row.entityType === entityType
    && row.entityId === entityId && row.state === "PENDING")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return clone(pending[0]?.payload ?? fallback);
};

export async function commitPulledChange(database, input) {
  const { ownerId, change, remoteEntity, createConflict, tombstoneWins, nextSyncSeq, now } = input;
  const storeName = ENTITY_STORES[change.entityType];
  const names = [storeName, "sync_outbox", "sync_conflicts", "device_sync_state"];
  if (change.entityType === "VISUAL_ASSET") names.push("memory_cards");
  const transaction = database.transaction([...new Set(names)], "readwrite");
  const entities = transaction.objectStore(storeName);
  const existing = await requestResult(entities.get(change.entityId));
  const outbox = transaction.objectStore("sync_outbox");
  const operations = await requestResult(outbox.getAll());
  if (createConflict) {
    transaction.objectStore("sync_conflicts").put({
      id: conflictIdFor(ownerId, change.entityType, change.entityId),
      ownerId,
      entityType: change.entityType,
      entityId: change.entityId,
      state: "OPEN",
      localEntity: pendingPayloadFor(operations, ownerId, change.entityType, change.entityId, existing),
      remoteEntity: clone(remoteEntity),
      remoteVersion: Number(change.entityVersion),
      createdAt: String(now),
      updatedAt: String(now),
      localBackup: null,
      resolution: null,
    });
    if (existing?.ownerId === ownerId) entities.put({ ...existing, sync: { ...existing.sync, syncState: "CONFLICT" } });
  } else {
    entities.put(toLocalEntity(change.entityType, remoteEntity, ownerId, existing));
    if (change.entityType === "VISUAL_ASSET" && remoteEntity.isCurrent) {
      const cards = transaction.objectStore("memory_cards");
      const card = await requestResult(cards.get(remoteEntity.cardId));
      if (card?.ownerId === ownerId) cards.put({ ...card, visualAssetId: remoteEntity.id });
    }
    if (tombstoneWins) {
      for (const row of operations.filter((item) => item.ownerId === ownerId
        && item.entityType === change.entityType && item.entityId === change.entityId && item.state === "PENDING")) {
        outbox.put({ ...row, state: "REJECTED", resultCode: "TOMBSTONE_WINS", updatedAt: String(now) });
      }
    }
  }
  await updateCursorInTransaction(transaction, ownerId, nextSyncSeq, now);
  await transactionDone(transaction);
}

export async function listOpenSyncConflicts(database, ownerId) {
  const transaction = database.transaction("sync_conflicts", "readonly");
  const rows = await requestResult(transaction.objectStore("sync_conflicts").getAll());
  await transactionDone(transaction);
  return clone(rows.filter((row) => row.ownerId === ownerId && row.state === "OPEN")
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
}

export async function getSyncConflict(database, ownerId, conflictId) {
  const transaction = database.transaction("sync_conflicts", "readonly");
  const row = await requestResult(transaction.objectStore("sync_conflicts").get(String(conflictId)));
  await transactionDone(transaction);
  return row?.ownerId === ownerId ? clone(row) : null;
}

export async function commitConflictResolution(database, { ownerId, conflictId, selection, operation, result, now }) {
  const existingConflict = await getSyncConflict(database, ownerId, conflictId);
  if (!existingConflict || existingConflict.state !== "OPEN") fail("SYNC_CONFLICT_NOT_FOUND", "Memory conflict is unavailable");
  const storeName = ENTITY_STORES[existingConflict.entityType];
  const stores = [storeName, "sync_conflicts", "device_sync_state"];
  if (existingConflict.entityType === "VISUAL_ASSET") stores.push("memory_cards");
  const transaction = database.transaction([...new Set(stores)], "readwrite");
  const conflicts = transaction.objectStore("sync_conflicts");
  const conflict = await requestResult(conflicts.get(conflictId));
  if (!conflict || conflict.ownerId !== ownerId || conflict.state !== "OPEN") {
    transaction.abort();
    fail("SYNC_CONFLICT_NOT_FOUND", "Memory conflict is unavailable");
  }
  const entities = transaction.objectStore(storeName);
  const current = await requestResult(entities.get(conflict.entityId));
  if (selection === "USE_CLOUD") {
    const projected = toLocalEntity(conflict.entityType, conflict.remoteEntity, ownerId, current);
    entities.put(projected);
    if (conflict.entityType === "VISUAL_ASSET" && projected.isCurrent && !projected.deletedAt) {
      const cards = transaction.objectStore("memory_cards");
      const card = await requestResult(cards.get(projected.cardId));
      if (card?.ownerId === ownerId) cards.put({ ...card, visualAssetId: projected.id });
    }
  } else if (current?.ownerId === ownerId) {
    entities.put({
      ...current,
      sync: {
        ...current.sync,
        remoteVersion: Number(result.entityVersion),
        syncState: "SYNCED",
        serverUpdatedAt: String(now),
        lastOperationId: operation.operationId,
      },
    });
    await updateCursorInTransaction(transaction, ownerId, result.syncSeq, now);
  }
  conflicts.put({
    ...conflict,
    state: "RESOLVED",
    resolution: selection,
    localBackup: selection === "USE_CLOUD" ? clone(conflict.localEntity) : null,
    updatedAt: String(now),
    resolvedAt: String(now),
  });
  await transactionDone(transaction);
}

export async function commitFullResync(database, { ownerId, entities, nextSyncSeq, now }) {
  const storeNames = [...new Set([...Object.values(ENTITY_STORES), "sync_outbox", "sync_conflicts", "device_sync_state"])];
  const transaction = database.transaction(storeNames, "readwrite");
  const operations = await requestResult(transaction.objectStore("sync_outbox").getAll());
  const conflicts = transaction.objectStore("sync_conflicts");
  const remoteKeys = new Set(entities.map((entity) => `${entity.entityType}:${entity.id}`));
  let applied = 0;
  let conflictCount = 0;
  const localByType = new Map(await Promise.all(Object.entries(ENTITY_STORES).map(async ([entityType, storeName]) => [
    entityType,
    new Map((await requestResult(transaction.objectStore(storeName).getAll())).map((row) => [row.id, row])),
  ])));
  for (const [entityType, storeName] of Object.entries(ENTITY_STORES)) {
    const store = transaction.objectStore(storeName);
    const localRows = [...localByType.get(entityType).values()];
    for (const row of localRows.filter((item) => item.ownerId === ownerId)) {
      const pending = operations.some((operation) => operation.ownerId === ownerId
        && operation.entityType === entityType && operation.entityId === row.id && operation.state === "PENDING");
      if (!pending && row.sync?.syncState === "SYNCED" && !remoteKeys.has(`${entityType}:${row.id}`)) {
        store.delete(row.id);
        localByType.get(entityType).delete(row.id);
      }
    }
  }
  for (const remote of entities) {
    const storeName = ENTITY_STORES[remote.entityType];
    if (!storeName) continue;
    const store = transaction.objectStore(storeName);
    const local = localByType.get(remote.entityType).get(remote.id) || null;
    const pending = operations.some((operation) => operation.ownerId === ownerId
      && operation.entityType === remote.entityType && operation.entityId === remote.id && operation.state === "PENDING");
    if (pending || local?.sync?.syncState === "CONFLICT") {
      conflictCount += 1;
      conflicts.put({
        id: conflictIdFor(ownerId, remote.entityType, remote.id), ownerId,
        entityType: remote.entityType, entityId: remote.id, state: "OPEN",
        localEntity: pendingPayloadFor(operations, ownerId, remote.entityType, remote.id, local),
        remoteEntity: clone(remote), remoteVersion: Number(remote.version),
        createdAt: String(now), updatedAt: String(now), localBackup: null, resolution: null,
      });
      if (local) store.put({ ...local, sync: { ...local.sync, syncState: "CONFLICT" } });
    } else {
      const projected = toLocalEntity(remote.entityType, remote, ownerId, local);
      store.put(projected);
      localByType.get(remote.entityType).set(remote.id, projected);
      applied += 1;
    }
  }
  const cards = transaction.objectStore("memory_cards");
  for (const asset of entities.filter((entity) => entity.entityType === "VISUAL_ASSET" && entity.isCurrent && !entity.deletedAt)) {
    const card = localByType.get("MEMORY_CARD").get(asset.cardId);
    if (card?.ownerId === ownerId && card.visualAssetId !== asset.id) {
      const projectedCard = { ...card, visualAssetId: asset.id };
      cards.put(projectedCard);
      localByType.get("MEMORY_CARD").set(card.id, projectedCard);
    }
  }
  await updateCursorInTransaction(transaction, ownerId, nextSyncSeq, now);
  await transactionDone(transaction);
  return Object.freeze({ applied, conflicts: conflictCount });
}
