import test from "node:test";
import assert from "node:assert/strict";
import { createSyncOperationCoordinator } from "../../src/services/syncOperationCoordinator.js";
import {
  applyRemoteSnapshot,
  buildLocalSyncState,
  markLocalDirty,
  readSyncMeta,
  uploadSnapshotToCloud,
} from "../../src/repositories/syncRepo.js";

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function installStorage({ failKey = null } = {}) {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (key === failKey) throw new Error(`Injected localStorage failure: ${key}`);
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type) {
      this.type = type;
    }
  };
  return values;
}

function remoteSnapshotFixture() {
  return {
    userId: "account-a",
    contentHash: "remote-hash",
    updatedAt: "2026-08-03T00:00:00.000Z",
    snapshot: {
      app: "ani-site",
      version: 5,
      exportedAt: "2026-08-03T00:00:00.000Z",
      list: [{ anilistId: 1, status: "completed", memo: "remote" }],
      tier: { unranked: [], tiers: { S: [1], A: [], B: [], C: [], D: [] } },
      watchLogs: [{
        id: "remote-log",
        anilistId: 1,
        eventType: "completed",
        watchedAtSort: 1,
        createdAt: 1,
      }],
      characterPins: [{
        id: "10:1",
        characterId: 10,
        mediaId: 1,
        nameSnapshot: "Character",
        pinnedAt: 1,
      }],
      preferences: { cardsPerRowBase: 5, cardView: "poster" },
    },
  };
}

function createDurableStorage(overrides = {}, calls = []) {
  return {
    replaceLibraryItemsIdb: async () => calls.push("library"),
    putTierStateIdb: async () => calls.push("tier"),
    replaceWatchLogsIdb: async () => calls.push("watchLogs"),
    replaceCharacterPinsIdb: async () => calls.push("characterPins"),
    ...overrides,
  };
}

function createUploadClient({ entered, release, calls }) {
  return {
    from(table) {
      return {
        upsert() {
          calls.push(table);
          if (table === "user_library_items") {
            return (async () => {
              entered.resolve();
              await release.promise;
              return { data: null, error: null };
            })();
          }
          if (table === "user_snapshots") {
            return {
              select() {
                return {
                  async maybeSingle() {
                    return { data: { updated_at: "2026-08-03T00:00:01.000Z" }, error: null };
                  },
                };
              },
            };
          }
          return Promise.resolve({ data: null, error: null });
        },
        delete() {
          calls.push(`delete:${table}`);
          return {
            eq() {
              return {
                in: async () => ({ data: null, error: null }),
              };
            },
          };
        },
      };
    },
  };
}

async function waitUntilEntered(signal) {
  const reached = await Promise.race([
    signal.promise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  assert.equal(reached, true, "the real repository path must reach the controlled IDB boundary");
}

test("applyRemoteSnapshot awaits every IDB-backed repository before completion", async () => {
  const cases = [
    ["library", "replaceLibraryItemsIdb"],
    ["tier", "putTierStateIdb"],
    ["watchLogs", "replaceWatchLogsIdb"],
    ["characterPins", "replaceCharacterPinsIdb"],
  ];

  for (const [target, method] of cases) {
    installStorage();
    const entered = deferred();
    const release = deferred();
    const calls = [];
    const storage = createDurableStorage({
      [method]: async () => {
        calls.push(target);
        entered.resolve();
        await release.promise;
      },
    }, calls);

    const apply = applyRemoteSnapshot(remoteSnapshotFixture(), {
      userId: "account-a",
      canMutate: () => true,
      expectedLocalRevision: 0,
      storage,
    });

    await waitUntilEntered(entered);
    assert.equal(readSyncMeta("account-a").lastSyncedHash, null);
    assert.deepEqual(calls, cases.slice(0, cases.findIndex((row) => row[0] === target) + 1).map((row) => row[0]));

    release.resolve();
    assert.notEqual(await apply, null);
    assert.equal(readSyncMeta("account-a").lastSyncedHash, "remote-hash");
    assert.deepEqual(calls, cases.map((row) => row[0]));
  }
});

test("applyRemoteSnapshot stops after a Library durability await when account A switches to B", async () => {
  installStorage();
  const coordinator = createSyncOperationCoordinator("account-a");
  const token = coordinator.begin("account-a", "apply");
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const storage = createDurableStorage({
    replaceLibraryItemsIdb: async () => {
      calls.push("library");
      entered.resolve();
      await release.promise;
    },
  }, calls);

  const apply = applyRemoteSnapshot(remoteSnapshotFixture(), {
    userId: "account-a",
    canMutate: () => coordinator.isCurrent(token),
    expectedLocalRevision: 0,
    storage,
  });

  await waitUntilEntered(entered);
  coordinator.updateUserId("account-b");
  release.resolve();

  assert.equal(await apply, null);
  assert.deepEqual(calls, ["library"]);
  assert.equal(readSyncMeta("account-a").lastSyncedHash, null);
});

test("applyRemoteSnapshot propagates an IDB durability failure without completion metadata", async () => {
  installStorage();
  const calls = [];
  const storage = createDurableStorage({
    replaceLibraryItemsIdb: async () => {
      calls.push("library");
      throw new Error("Injected Library IDB failure");
    },
  }, calls);

  await assert.rejects(
    applyRemoteSnapshot(remoteSnapshotFixture(), {
      userId: "account-a",
      canMutate: () => true,
      expectedLocalRevision: 0,
      storage,
    }),
    /Injected Library IDB failure/,
  );
  assert.deepEqual(calls, ["library"]);
  assert.equal(readSyncMeta("account-a").lastSyncedHash, null);
});

test("applyRemoteSnapshot rejects every failed local durable write before completion", async () => {
  const keys = [
    "anime:list:v1",
    "anime:tier:v1",
    "anime:watchLogs:v1",
    "anime:characterPins:v1",
    "anime:grid:perRowBase:v1",
    "anime:grid:cardView:v1",
  ];

  for (const failKey of keys) {
    installStorage({ failKey });
    await assert.rejects(applyRemoteSnapshot(remoteSnapshotFixture(), {
      userId: "account-a",
      canMutate: () => true,
      expectedLocalRevision: 0,
      storage: createDurableStorage(),
    }));
    assert.equal(readSyncMeta("account-a").lastSyncedHash, null);
  }
});

test("uploadSnapshotToCloud stops after an awaited Library upsert when account A switches to B", async () => {
  installStorage();
  const coordinator = createSyncOperationCoordinator("account-a");
  const token = coordinator.begin("account-a", "upload");
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const upload = uploadSnapshotToCloud("account-a", remoteSnapshotFixture().snapshot, {
    client: createUploadClient({ entered, release, calls }),
    remoteState: null,
    canMutate: () => coordinator.isCurrent(token),
    expectedLocalRevision: 0,
    hash: "stale-hash",
  });

  await waitUntilEntered(entered);
  coordinator.updateUserId("account-b");
  release.resolve();

  assert.equal(await upload, null);
  assert.deepEqual(calls, ["user_library_items"]);
  assert.equal(readSyncMeta("account-a").lastSyncedHash, null);
});

test("markLocalDirty increments a monotonic device-local revision", () => {
  installStorage();

  markLocalDirty("2026-08-03T00:00:00.000Z");
  assert.equal(readSyncMeta("account-a").localRevision, 1);

  markLocalDirty("2026-08-03T00:00:00.000Z");
  assert.equal(readSyncMeta("account-b").localRevision, 2);
});

test("actual upload completion keeps S2 pending when local revision changes during Library upsert", async () => {
  installStorage();
  markLocalDirty("2026-08-03T00:00:00.000Z");
  const capturedRevision = readSyncMeta("account-a").localRevision;
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const upload = uploadSnapshotToCloud("account-a", remoteSnapshotFixture().snapshot, {
    client: createUploadClient({ entered, release, calls }),
    remoteState: null,
    canMutate: () => true,
    expectedLocalRevision: capturedRevision,
    hash: "hash-s",
  });

  await waitUntilEntered(entered);
  markLocalDirty("2026-08-03T00:00:02.000Z");
  release.resolve();
  assert.notEqual(await upload, null);

  const nextSyncMeta = readSyncMeta("account-a");
  assert.equal(nextSyncMeta.localRevision, 2);
  assert.equal(nextSyncMeta.lastSyncedHash, "hash-s");
  assert.equal(nextSyncMeta.pending, true);

  const nextLocalState = await buildLocalSyncState("account-a");
  assert.equal(nextLocalState.meta.localRevision, 2);
  assert.equal(nextLocalState.meta.pending, true);
  assert.deepEqual(calls, [
    "user_library_items",
    "user_watch_logs",
    "user_character_pins",
    "user_preferences",
    "user_snapshots",
  ]);
});
