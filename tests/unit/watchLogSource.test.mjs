import test from "node:test";
import assert from "node:assert/strict";
import { loadAuthoritativeWatchLogSnapshot } from "../../src/services/watchLogSource.js";
import {
  appendWatchLog,
  readAllWatchLogsPreferred,
} from "../../src/repositories/watchLogRepo.js";
import { exportSyncSnapshot } from "../../src/domain/snapshotCodec.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function installStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
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

async function waitUntilEntered(signal) {
  const reached = await Promise.race([
    signal.promise.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  assert.equal(reached, true, "the preferred repository read must reach the controlled IDB boundary");
}

test("an IDB-only legacy snapshot promotes every watch log before scoped reads", async () => {
  const idbSnapshot = [
    { id: "log-a", anilistId: 1 },
    { id: "log-b", anilistId: 2 },
  ];
  const writes = [];

  const rows = await loadAuthoritativeWatchLogSnapshot({
    hasLocalSnapshot: () => false,
    readLocalSnapshot: () => [],
    readAllIdbSnapshot: async () => idbSnapshot,
    writeLocalSnapshot: (next) => writes.push(next),
  });

  assert.deepEqual(rows, idbSnapshot);
  assert.deepEqual(writes, [idbSnapshot]);
});

test("an existing local watch-log snapshot never falls back to a stale IDB mirror", async () => {
  const localSnapshot = [{ id: "local", anilistId: 1 }];
  let idbReads = 0;

  const rows = await loadAuthoritativeWatchLogSnapshot({
    hasLocalSnapshot: () => true,
    readLocalSnapshot: () => localSnapshot,
    readAllIdbSnapshot: async () => {
      idbReads += 1;
      return [{ id: "stale", anilistId: 1 }];
    },
    writeLocalSnapshot: () => assert.fail("the IDB mirror must not replace local data"),
  });

  assert.deepEqual(rows, localSnapshot);
  assert.equal(idbReads, 0);
});

test("preferred watch-log read preserves a newer local append while its IDB promotion is pending", async () => {
  const values = installStorage();
  const entered = deferred();
  const idbRead = deferred();
  const preferred = readAllWatchLogsPreferred({
    readAllIdbSnapshot: async () => {
      entered.resolve();
      return idbRead.promise;
    },
  });

  await waitUntilEntered(entered);
  await appendWatchLog({
    id: "shared",
    anilistId: 1,
    eventType: "completed",
    watchedAtSort: 2,
    cue: "new local S2",
    createdAt: 2,
  });
  idbRead.resolve([
    {
      id: "shared",
      anilistId: 1,
      eventType: "completed",
      watchedAtSort: 1,
      cue: "stale IDB S",
      createdAt: 1,
    },
    {
      id: "idb-only",
      anilistId: 2,
      eventType: "completed",
      watchedAtSort: 1,
      cue: "IDB-only S",
      createdAt: 1,
    },
  ]);

  const rows = await preferred;
  assert.deepEqual(rows.map((row) => [row.id, row.cue]), [
    ["shared", "new local S2"],
    ["idb-only", "IDB-only S"],
  ]);
  const persisted = JSON.parse(values.get("anime:watchLogs:v1"));
  assert.deepEqual(Object.fromEntries(persisted.map((row) => [row.id, row.cue])), {
    shared: "new local S2",
    "idb-only": "IDB-only S",
  });
});

test("exportSyncSnapshot propagates a preferred watch-log IDB read failure", async () => {
  installStorage();
  const failure = new Error("Injected watch-log IDB read failure");

  await assert.rejects(
    exportSyncSnapshot({
      watchLogStorage: {
        readAllIdbSnapshot: async () => {
          throw failure;
        },
      },
    }),
    (error) => error === failure,
  );
});
