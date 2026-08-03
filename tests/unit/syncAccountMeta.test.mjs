import test from "node:test";
import assert from "node:assert/strict";
import { markSyncCompleted, readSyncMeta } from "../../src/repositories/syncRepo.js";

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type) {
      this.type = type;
    }
  };
}

test("sync baselines are isolated by account", () => {
  installStorage();
  markSyncCompleted({
    userId: "account-a",
    hash: "hash-a",
    remoteUpdatedAt: "2026-08-01T00:00:00.000Z",
  });
  markSyncCompleted({
    userId: "account-b",
    hash: "hash-b",
    remoteUpdatedAt: "2026-08-02T00:00:00.000Z",
  });

  assert.equal(readSyncMeta("account-a").lastSyncedHash, "hash-a");
  assert.equal(readSyncMeta("account-b").lastSyncedHash, "hash-b");
  assert.equal(readSyncMeta("account-c").lastSyncedHash, null);
});
