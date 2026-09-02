import { createDefaultSyncEnvelope } from "../../domain/memoryDomain.js";

export const MEMORY_DB_NAME = "moemoa-memory-v1";
export const MEMORY_DB_VERSION = 2;

const createStore = (database, name, options, indexes = []) => {
  if (database.objectStoreNames.contains(name)) return;
  const store = database.createObjectStore(name, options);
  for (const [indexName, keyPath, indexOptions] of indexes) {
    store.createIndex(indexName, keyPath, indexOptions);
  }
};

const normalizeStoreRecords = (transaction, storeName, normalize) => {
  if (!transaction) return;
  const request = transaction.objectStore(storeName).openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const normalized = normalize(cursor.value);
    if (normalized !== cursor.value) cursor.update(normalized);
    cursor.continue();
  };
};

const normalizeV1Records = (database, transaction) => {
  if (!transaction) return;
  if (database.objectStoreNames.contains("anime_refs")) {
    normalizeStoreRecords(transaction, "anime_refs", (value) => (
      Object.hasOwn(value, "catalogAnimeId") ? value : { ...value, catalogAnimeId: null }
    ));
  }
  for (const storeName of ["private_titles", "memory_cards", "visual_assets"]) {
    if (!database.objectStoreNames.contains(storeName)) continue;
    normalizeStoreRecords(transaction, storeName, (value) => {
      const updatedAt = String(value.updatedAt || value.createdAt || new Date(0).toISOString());
      const shared = {
        ...value,
        deletedAt: value.deletedAt ?? null,
        sync: value.sync || createDefaultSyncEnvelope(updatedAt),
      };
      if (storeName === "memory_cards") {
        return {
          ...shared,
          watchedAtPrecision: value.watchedAtPrecision || "UNKNOWN",
        };
      }
      if (storeName === "visual_assets") {
        return {
          ...shared,
          isCurrent: value.isCurrent ?? (value.state === "READY" && value.deletedAt == null),
        };
      }
      return shared;
    });
  }
};

export function upgradeMemoryDatabase(database, { oldVersion = 0, transaction = null } = {}) {
  createStore(database, "owners", { keyPath: "id" }, [
    ["kind", "kind"],
    ["created", "createdAt"],
  ]);
  createStore(database, "anime_refs", { keyPath: "id" }, [
    ["source_key", "sourceKey"],
    ["updated", "updatedAt"],
  ]);
  createStore(database, "private_titles", { keyPath: "id" }, [
    ["owner_normalized_title", ["ownerId", "normalizedTitle"]],
    ["owner_updated", ["ownerId", "updatedAt"]],
  ]);
  createStore(database, "memory_cards", { keyPath: "id" }, [
    ["owner_status_updated", ["ownerId", "status", "updatedAt"]],
    ["owner_created", ["ownerId", "createdAt"]],
    ["visual_asset", "visualAssetId"],
  ]);
  createStore(database, "visual_assets", { keyPath: "id" }, [
    ["owner_state", ["ownerId", "state"]],
    ["owner_checksum", ["ownerId", "checksumSha256"]],
    ["updated", "updatedAt"],
  ]);
  createStore(database, "media_operations", { keyPath: "id" }, [
    ["owner_state_updated", ["ownerId", "state", "updatedAt"]],
    ["asset", "assetId"],
    ["card", "cardId"],
  ]);
  createStore(database, "meta", { keyPath: "key" });
  createStore(database, "account_promotions", { keyPath: "operationId" }, [
    ["owner_status_updated", ["ownerId", "status", "updatedAt"]],
    ["owner_guest", ["ownerId", "guestOwnerId"], { unique: true }],
  ]);
  createStore(database, "device_sync_state", { keyPath: "ownerId" }, [
    ["user", "userId"],
    ["device", "deviceId", { unique: true }],
  ]);
  createStore(database, "memory_boards", { keyPath: "id" }, [
    ["owner_updated", ["ownerId", "updatedAt"]],
  ]);
  createStore(database, "memory_board_cards", { keyPath: "id" }, [
    ["owner_board_position", ["ownerId", "boardId", "positionKey"]],
    ["owner_card", ["ownerId", "cardId"]],
  ]);
  createStore(database, "sync_outbox", { keyPath: "id" }, [
    ["owner_state_created", ["ownerId", "state", "createdAt"]],
    ["owner_entity", ["ownerId", "entityType", "entityId"]],
  ]);
  createStore(database, "sync_conflicts", { keyPath: "id" }, [
    ["owner_state_created", ["ownerId", "state", "createdAt"]],
    ["owner_entity", ["ownerId", "entityType", "entityId"]],
  ]);

  if (oldVersion === 1) normalizeV1Records(database, transaction);
}
export function openMemoryDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("IndexedDB is unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(MEMORY_DB_NAME, MEMORY_DB_VERSION);
    request.onupgradeneeded = (event) => upgradeMemoryDatabase(request.result, {
      oldVersion: Number(event.oldVersion || 0),
      transaction: request.transaction,
    });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open Memory database"));
    request.onblocked = () => reject(new Error("Memory database upgrade is blocked"));
  });
}
