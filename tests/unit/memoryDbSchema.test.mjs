import test from "node:test";
import assert from "node:assert/strict";

import {
  MEMORY_DB_NAME,
  MEMORY_DB_VERSION,
  upgradeMemoryDatabase,
} from "../../src/features/memory/adapters/indexeddb/memoryDb.js";

class FakeStore {
  constructor(name, options) {
    this.name = name;
    this.options = options;
    this.indexes = [];
  }

  createIndex(name, keyPath, options = {}) {
    this.indexes.push({ name, keyPath, options });
  }
}

class FakeDatabase {
  constructor() {
    this.objectStoreNames = { contains: (name) => this.stores.has(name) };
    this.stores = new Map();
  }

  createObjectStore(name, options) {
    const store = new FakeStore(name, options);
    this.stores.set(name, store);
    return store;
  }
}

test("memory schema is isolated under the canonical v1 database", () => {
  assert.equal(MEMORY_DB_NAME, "moemoa-memory-v1");
  assert.equal(MEMORY_DB_VERSION, 2);
});

test("schema upgrade creates only the owner-scoped memory stores and indexes", () => {
  const database = new FakeDatabase();

  upgradeMemoryDatabase(database);

  assert.deepEqual([...database.stores.keys()], [
    "owners",
    "anime_refs",
    "private_titles",
    "memory_cards",
    "visual_assets",
    "media_operations",
    "meta",
    "account_promotions",
    "device_sync_state",
    "memory_boards",
    "memory_board_cards",
    "sync_outbox",
    "sync_conflicts",
  ]);
  assert.deepEqual(
    database.stores.get("memory_cards").indexes.map(({ name, keyPath }) => ({ name, keyPath })),
    [
      { name: "owner_status_updated", keyPath: ["ownerId", "status", "updatedAt"] },
      { name: "owner_created", keyPath: ["ownerId", "createdAt"] },
      { name: "visual_asset", keyPath: "visualAssetId" },
    ],
  );
  assert.deepEqual(
    database.stores.get("visual_assets").indexes.map(({ name, keyPath }) => ({ name, keyPath })),
    [
      { name: "owner_state", keyPath: ["ownerId", "state"] },
      { name: "owner_checksum", keyPath: ["ownerId", "checksumSha256"] },
      { name: "updated", keyPath: "updatedAt" },
    ],
  );
});

test("schema upgrade is idempotent when stores already exist", () => {
  const database = new FakeDatabase();
  upgradeMemoryDatabase(database);
  assert.doesNotThrow(() => upgradeMemoryDatabase(database));
  assert.equal(database.stores.size, 13);
});
