import test from "node:test";
import assert from "node:assert/strict";

import {
  MEMORY_DB_NAME,
  MEMORY_DB_VERSION,
  openMemoryDatabase,
  upgradeMemoryDatabase,
} from "../../src/features/memory/adapters/indexeddb/memoryDb.js";

const OWNER_GUEST = "guest:11111111-1111-4111-8111-111111111111";
const EXPECTED_STORES = [
  "account_promotions",
  "anime_refs",
  "device_sync_state",
  "media_operations",
  "memory_board_cards",
  "memory_boards",
  "memory_cards",
  "meta",
  "owners",
  "private_titles",
  "sync_conflicts",
  "sync_outbox",
  "visual_assets",
].sort();

class FakeStore {
  constructor(name, options) {
    this.name = name;
    this.options = options;
    this.indexes = [];
    this.records = new Map();
  }

  createIndex(name, keyPath, options = {}) {
    this.indexes.push({ name, keyPath, options });
  }
}

class FakeDatabase {
  constructor() {
    this.stores = new Map();
    this.objectStoreNames = { contains: (name) => this.stores.has(name) };
  }

  createObjectStore(name, options) {
    const store = new FakeStore(name, options);
    this.stores.set(name, store);
    return store;
  }

  close() {}
}

class FakeUpgradeTransaction {
  constructor(database) {
    this.database = database;
  }

  objectStore(name) {
    const store = this.database.stores.get(name);
    return {
      openCursor() {
        const request = {};
        const entries = [...store.records.entries()];
        let index = 0;
        const emit = () => queueMicrotask(() => {
          if (index >= entries.length) {
            request.result = null;
          } else {
            const [key, value] = entries[index];
            request.result = {
              value: structuredClone(value),
              update(nextValue) {
                store.records.set(key, structuredClone(nextValue));
              },
              continue() {
                index += 1;
                emit();
              },
            };
          }
          request.onsuccess?.();
        });
        emit();
        return request;
      },
    };
  }
}

const seedV1 = () => {
  const database = new FakeDatabase();
  for (const [name, keyPath] of [
    ["owners", "id"],
    ["anime_refs", "id"],
    ["private_titles", "id"],
    ["memory_cards", "id"],
    ["visual_assets", "id"],
    ["media_operations", "id"],
    ["meta", "key"],
  ]) {
    database.createObjectStore(name, { keyPath });
  }
  database.stores.get("memory_cards").records.set("card-1", {
    id: "card-1",
    ownerId: OWNER_GUEST,
    animeRefId: "anime-ref-1",
    privateTitleId: null,
    visualAssetId: "asset-1",
    status: "COMPLETE_PRIVATE",
    note: "preserve me",
    updatedAt: "2026-08-25T00:00:00.000Z",
    deletedAt: null,
  });
  return database;
};

test("v1 to v2 upgrade adds sync-ready stores without replacing existing card content", async () => {
  const database = seedV1();

  upgradeMemoryDatabase(database, {
    oldVersion: 1,
    transaction: new FakeUpgradeTransaction(database),
  });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(MEMORY_DB_VERSION, 2);
  assert.deepEqual([...database.stores.keys()].sort(), EXPECTED_STORES);
  const existingCard = database.stores.get("memory_cards").records.get("card-1");
  assert.equal(existingCard.ownerId, OWNER_GUEST);
  assert.equal(existingCard.note, "preserve me");
  assert.equal(existingCard.watchedAtPrecision, "UNKNOWN");
  assert.deepEqual(existingCard.sync, {
    remoteVersion: 0,
    syncState: "LOCAL_ONLY",
    clientUpdatedAt: "2026-08-25T00:00:00.000Z",
    serverUpdatedAt: null,
    lastOperationId: null,
  });
});

test("Memory database open never touches the legacy library database", async () => {
  const calls = [];
  const legacyFixture = { untouched: true };
  const indexedDb = {
    open(name, version) {
      calls.push({ name, version });
      const request = { result: new FakeDatabase() };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };

  const database = await openMemoryDatabase(indexedDb);
  database.close();

  assert.equal(MEMORY_DB_NAME, "moemoa-memory-v1");
  assert.deepEqual(calls, [{ name: MEMORY_DB_NAME, version: 2 }]);
  assert.deepEqual(legacyFixture, { untouched: true });
  assert.equal(calls.some(({ name }) => name === "anime-collector-db"), false);
});
