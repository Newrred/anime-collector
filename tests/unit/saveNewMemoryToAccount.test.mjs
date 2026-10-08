import assert from "node:assert/strict";
import test from "node:test";
import { saveNewMemoryToAccount } from "../../src/features/memory/application/saveNewMemoryToAccount.js";

const userId = "11111111-1111-4111-8111-111111111111";
const localBundle = {
  card: { id: "card-1", ownerId: `account:${userId}`, sync: { syncState: "PENDING", remoteVersion: 0 } },
  asset: { id: "asset-1", sync: { syncState: "PENDING", remoteVersion: 0 } },
};
const syncedBundle = {
  ...localBundle,
  card: { ...localBundle.card, sync: { syncState: "SYNCED", remoteVersion: 2 } },
  asset: { ...localBundle.asset, sync: { syncState: "SYNCED", remoteVersion: 2 } },
};

function harness(overrides = {}) {
  const calls = [];
  let reads = 0;
  const input = {
    cardId: "card-1",
    userId,
    runtime: { getCard: async () => { calls.push("read-card"); return ++reads === 1 ? localBundle : syncedBundle; } },
    getSession: async () => ({ user: { id: userId }, access_token: "test-token" }),
    getAccountRuntime: async () => ({
      initializeAccountSession: async () => { calls.push("initialize"); return { status: "ACCOUNT_READY", userId }; },
      syncNow: async () => { calls.push("metadata"); return { syncResultCode: "SYNCED" }; },
    }),
    createPhotoTransfer: () => ({ upload: async ({ consented }) => { assert.equal(consented, true); calls.push("photo"); } }),
    isPrivateImage: () => true,
    photoEnabled: true,
    isOnline: () => true,
    ...overrides,
  };
  return { input, calls };
}

test("guest saves stay local without a cloud request", async () => {
  const { input, calls } = harness({ userId: null });
  assert.deepEqual(await saveNewMemoryToAccount(input), { status: "LOCAL_ONLY" });
  assert.deepEqual(calls, []);
});

test("new account photo is sent only after its Card metadata has a remote version", async () => {
  const { input, calls } = harness({ includePhoto: true });
  assert.deepEqual(await saveNewMemoryToAccount(input), { status: "SYNCED" });
  assert.deepEqual(calls, ["read-card", "initialize", "metadata", "read-card", "photo"]);
});

test("account change or a partial metadata sync never uploads a photo", async () => {
  const changed = harness({ includePhoto: true, getSession: async () => ({ user: { id: "other" } }) });
  assert.deepEqual(await saveNewMemoryToAccount(changed.input), { status: "PENDING", stage: "account" });
  assert.deepEqual(changed.calls, []);

  const partial = harness({ includePhoto: true, getAccountRuntime: async () => ({
    initializeAccountSession: async () => ({ status: "ACCOUNT_READY", userId }),
    syncNow: async () => ({ syncResultCode: "PARTIAL" }),
  }) });
  assert.deepEqual(await saveNewMemoryToAccount(partial.input), { status: "PENDING", stage: "metadata" });
  assert.deepEqual(partial.calls, ["read-card"]);
});

test("a failed photo transfer leaves the existing Card available for an idempotent retry", async () => {
  let attempts = 0;
  const { input, calls } = harness({ includePhoto: true, createPhotoTransfer: () => ({ upload: async () => {
    calls.push("photo");
    if (++attempts === 1) throw new Error("network unavailable");
  } }) });
  assert.deepEqual(await saveNewMemoryToAccount(input), { status: "PENDING", stage: "photo" });
  assert.deepEqual(await saveNewMemoryToAccount(input), { status: "SYNCED" });
  assert.equal(attempts, 2);
});

test("an official-cover card syncs metadata without uploading private bytes", async () => {
  const { input, calls } = harness();
  assert.deepEqual(await saveNewMemoryToAccount(input), { status: "SYNCED" });
  assert.deepEqual(calls, ["read-card", "initialize", "metadata", "read-card"]);
});

test("a concurrent batch result cannot claim this new Card was already saved", async () => {
  const { input, calls } = harness({ runtime: { getCard: async () => { calls.push("read-card"); return localBundle; } } });
  assert.deepEqual(await saveNewMemoryToAccount(input), { status: "PENDING", stage: "metadata" });
  assert.deepEqual(calls, ["read-card", "initialize", "metadata", "read-card"]);
});
