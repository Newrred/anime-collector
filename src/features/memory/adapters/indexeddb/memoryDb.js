export const MEMORY_DB_NAME = "moemoa-memory-v1";
export const MEMORY_DB_VERSION = 1;

const createStore = (database, name, options, indexes = []) => {
  if (database.objectStoreNames.contains(name)) return;
  const store = database.createObjectStore(name, options);
  for (const [indexName, keyPath, indexOptions] of indexes) {
    store.createIndex(indexName, keyPath, indexOptions);
  }
};

export function upgradeMemoryDatabase(database) {
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
}
export function openMemoryDatabase(indexedDb = globalThis.indexedDB) {
  if (!indexedDb) return Promise.reject(new Error("IndexedDB is unavailable"));
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(MEMORY_DB_NAME, MEMORY_DB_VERSION);
    request.onupgradeneeded = () => upgradeMemoryDatabase(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open Memory database"));
    request.onblocked = () => reject(new Error("Memory database upgrade is blocked"));
  });
}
