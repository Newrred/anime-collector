import test from "node:test";
import assert from "node:assert/strict";
import { runGuardedMutationSteps } from "../../src/services/guardedMutationSteps.js";
import { createSyncOperationCoordinator } from "../../src/services/syncOperationCoordinator.js";
import {
  buildLocalSyncState,
  markLocalDirty,
  markSyncCompleted,
  readSyncMeta,
} from "../../src/repositories/syncRepo.js";

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
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
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type) {
      this.type = type;
    }
  };
}

test("an account switch during an awaited destructive phase blocks every later phase and completion metadata", async () => {
  installStorage();
  const coordinator = createSyncOperationCoordinator("account-a");
  const token = coordinator.begin("account-a", "upload");
  const entered = deferred();
  const release = deferred();
  const phases = [];

  const upload = runGuardedMutationSteps({
    canMutate: () => coordinator.isCurrent(token),
    steps: [
      async () => {
        phases.push("replace-library");
        entered.resolve();
        await release.promise;
      },
      async () => {
        phases.push("delete-watch-logs");
      },
    ],
    onComplete: () => {
      phases.push("complete");
      markSyncCompleted({
        userId: "account-a",
        hash: "stale-hash",
        remoteUpdatedAt: "2026-08-03T00:00:00.000Z",
      });
    },
  });

  await entered.promise;
  coordinator.updateUserId("account-b");
  release.resolve();

  assert.deepEqual(await upload, { completed: false, stale: true, value: null });
  assert.deepEqual(phases, ["replace-library"]);
  assert.equal(readSyncMeta("account-a").lastSyncedHash, null);
});

test("markLocalDirty increments a monotonic device-local revision", () => {
  installStorage();

  markLocalDirty("2026-08-03T00:00:00.000Z");
  assert.equal(readSyncMeta("account-a").localRevision, 1);

  markLocalDirty("2026-08-03T00:00:00.000Z");
  assert.equal(readSyncMeta("account-b").localRevision, 2);
});

test("completion of snapshot S keeps S2 pending when the local revision changed during upload", async () => {
  installStorage();
  markLocalDirty("2026-08-03T00:00:00.000Z");
  const capturedRevision = readSyncMeta("account-a").localRevision;
  const entered = deferred();
  const release = deferred();

  const upload = runGuardedMutationSteps({
    canMutate: () => true,
    steps: [async () => {
      entered.resolve();
      await release.promise;
    }],
    onComplete: () => markSyncCompleted({
      userId: "account-a",
      hash: "hash-s",
      remoteUpdatedAt: "2026-08-03T00:00:01.000Z",
      expectedLocalRevision: capturedRevision,
    }),
  });

  await entered.promise;
  markLocalDirty("2026-08-03T00:00:02.000Z");
  release.resolve();
  await upload;

  const nextSyncMeta = readSyncMeta("account-a");
  assert.equal(nextSyncMeta.localRevision, 2);
  assert.equal(nextSyncMeta.lastSyncedHash, "hash-s");
  assert.equal(nextSyncMeta.pending, true);

  const nextLocalState = await buildLocalSyncState("account-a");
  assert.equal(nextLocalState.meta.localRevision, 2);
  assert.equal(nextLocalState.meta.pending, true);
});
