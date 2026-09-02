import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryAccountRuntime } from "../../src/features/memory/runtime/createMemoryAccountRuntime.js";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const INSTALLATION_ID = "33333333-3333-4333-8333-333333333333";
const GUEST_A = `guest:${INSTALLATION_ID}`;
const GUEST_B_UUID = "44444444-4444-4444-8444-444444444444";
const DEVICE_A = "55555555-5555-4555-8555-555555555555";
const DEVICE_B = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-09-02T01:00:00.000Z";

const session = (userId, email = "user@example.test") => ({ user: { id: userId, email } });

function createHarness({ guestCards = 1, failRpc = false, activeOwnerId = GUEST_A } = {}) {
  const calls = [];
  const owners = new Map([[GUEST_A, { id: GUEST_A, kind: "GUEST", createdAt: NOW }]]);
  const deviceStates = new Map();
  let active = owners.get(activeOwnerId) || owners.get(GUEST_A);
  let uuidIndex = 0;
  const uuids = [INSTALLATION_ID, DEVICE_A, DEVICE_B, GUEST_B_UUID];

  const repository = {
    async ensureInstallationIdentity() {
      calls.push(["ensureInstallationIdentity"]);
      return { installationId: INSTALLATION_ID, guestOwner: owners.get(GUEST_A) };
    },
    async getActiveOwner() {
      calls.push(["getActiveOwner"]);
      return structuredClone(active);
    },
    async ensureAccountOwner({ userId }) {
      calls.push(["ensureAccountOwner", userId]);
      const owner = { id: `account:${userId}`, kind: "ACCOUNT", userId, createdAt: NOW };
      owners.set(owner.id, owner);
      return structuredClone(owner);
    },
    async activateOwner({ ownerId }) {
      calls.push(["activateOwner", ownerId]);
      active = owners.get(ownerId);
      return structuredClone(active);
    },
    async rotateGuestOwnerAfterPromotion({ uuid }) {
      calls.push(["rotateGuestOwnerAfterPromotion", uuid]);
      const owner = { id: `guest:${uuid}`, kind: "GUEST", createdAt: NOW };
      owners.set(owner.id, owner);
      active = owner;
      return structuredClone(owner);
    },
    async countCompleteCards(ownerId) {
      calls.push(["countCompleteCards", ownerId]);
      return ownerId === GUEST_A ? guestCards : 0;
    },
    async readOwnerPromotionBundle() {
      return { owner: owners.get(GUEST_A), animeRefs: [], privateTitles: [], cards: [], visualAssets: [], mediaOperations: [], boards: [], boardCards: [] };
    },
    async resolvePromotionTitleChoice(input) { return input.choice; },
    async beginPromotionJournal(input) { return { ...input, status: "STARTED", remoteResult: null }; },
    async markPromotionRemoteCompleted() {},
    async listRecoverablePromotions() { return []; },
    async commitPromotionToAccount(input) { return { accountOwnerId: input.accountOwnerId, guestOwnerId: GUEST_A }; },
  };
  if (String(activeOwnerId).startsWith("account:")) {
    const userId = String(activeOwnerId).slice(8);
    active = { id: activeOwnerId, kind: "ACCOUNT", userId, createdAt: NOW };
    owners.set(active.id, active);
  }

  const gateway = {
    async ensureUserProfile(input) {
      calls.push(["ensureUserProfile", input]);
      if (failRpc) throw Object.assign(new Error("select private.secret"), { code: "MEMORY_GATEWAY_FAILED" });
      return { userId: active?.userId || USER_A, ...input, minimumRetainedSyncSeq: 0 };
    },
    async registerDevice(input) {
      calls.push(["registerDevice", input]);
      if (failRpc) throw Object.assign(new Error("select private.secret"), { code: "MEMORY_GATEWAY_FAILED" });
      return { id: input.deviceId, installationId: input.installationId, platform: input.platform, appVersion: input.appVersion, lastSyncSeq: 0 };
    },
    async promoteGuest() {
      return { status: "COMPLETED", importedCounts: { privateTitles: 0, cards: 0, visualAssets: 0, boards: 0, boardCards: 0 }, nextSyncSeq: 0 };
    },
  };

  const runtimeInput = {
    enabled: true,
    repository,
    gateway,
    readDeviceSyncState: async (ownerId) => structuredClone(deviceStates.get(ownerId) || null),
    writeDeviceSyncState: async (state) => { deviceStates.set(state.ownerId, structuredClone(state)); },
    uuid: () => uuids[uuidIndex++],
    clock: { now: () => NOW },
    appVersion: "1.0.0",
    locale: "ko",
    timeZone: "Asia/Seoul",
  };
  const makeRuntime = () => createMemoryAccountRuntime(runtimeInput);
  return {
    runtime: makeRuntime(),
    makeRuntime,
    calls,
    owners,
    deviceStates,
    getActive: () => structuredClone(active),
  };
}

test("flag off keeps the Guest runtime untouched and makes no RPC", async () => {
  let touched = 0;
  const runtime = createMemoryAccountRuntime({
    enabled: false,
    repository: new Proxy({}, { get: () => () => { touched += 1; } }),
    gateway: new Proxy({}, { get: () => () => { touched += 1; } }),
  });
  assert.equal(runtime.enabled, false);
  assert.equal(runtime.status, "LOCAL_ONLY");
  assert.equal(await runtime.initializeAccountSession(session(USER_A)), null);
  assert.equal(await runtime.buildPromotionPreview(), null);
  assert.equal(await runtime.promote(), null);
  assert.equal(await runtime.syncNow(), null);
  assert.equal(touched, 0);
});

test("Auth session registers profile and a stable device before activating Account", async () => {
  const harness = createHarness({ guestCards: 2 });
  const result = await harness.runtime.initializeAccountSession(session(USER_A, "a@example.test"));
  assert.equal(result.status, "PROMOTION_AVAILABLE");
  assert.equal(result.guestCardCount, 2);
  assert.equal(result.deviceId, DEVICE_A);
  assert.equal(harness.getActive().id, `account:${USER_A}`);
  assert.deepEqual(harness.calls.filter(([name]) => name === "ensureUserProfile").length, 1);
  assert.deepEqual(harness.calls.filter(([name]) => name === "registerDevice").length, 1);
  const activateIndex = harness.calls.findIndex(([name, ownerId]) => name === "activateOwner" && ownerId === `account:${USER_A}`);
  const registerIndex = harness.calls.findIndex(([name]) => name === "registerDevice");
  assert.ok(activateIndex > registerIndex);
});

test("concurrent initialization is deduplicated and reload state keeps the same device id", async () => {
  const harness = createHarness({ guestCards: 0 });
  const [first, second] = await Promise.all([
    harness.runtime.initializeAccountSession(session(USER_A)),
    harness.runtime.initializeAccountSession(session(USER_A)),
  ]);
  assert.equal(first.deviceId, DEVICE_A);
  assert.equal(second.deviceId, DEVICE_A);
  assert.equal(harness.calls.filter(([name]) => name === "registerDevice").length, 1);

  const state = harness.deviceStates.get(`account:${USER_A}`);
  assert.equal(state.deviceId, DEVICE_A);
  assert.equal(state.installationId, INSTALLATION_ID);
  const reloaded = await harness.makeRuntime().initializeAccountSession(session(USER_A));
  assert.equal(reloaded.deviceId, DEVICE_A);
  assert.equal(harness.calls.filter(([name]) => name === "registerDevice").length, 2);
  assert.equal(harness.calls.filter(([name, input]) => name === "registerDevice" && input.deviceId === DEVICE_A).length, 2);
});

test("sign out preserves Account rows and returns to the installation Guest namespace", async () => {
  const harness = createHarness({ guestCards: 0 });
  await harness.runtime.initializeAccountSession(session(USER_A));
  const signedOut = await harness.runtime.handleSignedOut();
  assert.equal(signedOut.status, "LOCAL_ONLY");
  assert.equal(harness.getActive().id, GUEST_A);
  assert.equal(harness.owners.has(`account:${USER_A}`), true);
  assert.equal(harness.owners.has(GUEST_A), true);
});

test("signing in account B hides account A without merging namespaces", async () => {
  const harness = createHarness({ activeOwnerId: `account:${USER_A}` });
  const result = await harness.runtime.initializeAccountSession(session(USER_B, "b@example.test"));
  assert.equal(result.accountOwnerId, `account:${USER_B}`);
  assert.equal(harness.getActive().id, `account:${USER_B}`);
  const activations = harness.calls.filter(([name]) => name === "activateOwner").map(([, ownerId]) => ownerId);
  assert.deepEqual(activations, [GUEST_A, `account:${USER_B}`]);
  assert.equal(harness.owners.has(`account:${USER_A}`), true);
});

test("profile or device failure keeps Auth valid and Guest data unchanged", async () => {
  const harness = createHarness({ guestCards: 3, failRpc: true });
  const authSession = session(USER_A);
  await assert.rejects(() => harness.runtime.initializeAccountSession(authSession), { code: "ACCOUNT_INITIALIZATION_FAILED" });
  assert.equal(authSession.user.id, USER_A);
  assert.equal(harness.getActive().id, GUEST_A);
  assert.equal(await harness.runtime.getState().then((state) => state.guestCardCount), 3);
});

test("an authenticated account with no Guest cards reports ready without starting sync", async () => {
  const harness = createHarness({ guestCards: 0 });
  const result = await harness.runtime.initializeAccountSession(session(USER_A));
  assert.equal(result.status, "ACCOUNT_READY");
  assert.equal(await harness.runtime.buildPromotionPreview(), null);
  assert.equal(await harness.runtime.promote(), null);
  assert.equal(await harness.runtime.syncNow(), null);
  assert.equal(harness.calls.some(([name]) => name.includes("sync")), false);
});
