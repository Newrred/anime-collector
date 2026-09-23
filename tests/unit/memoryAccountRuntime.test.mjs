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

function createHarness({ guestCards = 1, failRpc = false, activeOwnerId = GUEST_A, serverSequence = 0 } = {}) {
  const calls = [];
  const owners = new Map([[GUEST_A, { id: GUEST_A, kind: "GUEST", createdAt: NOW }]]);
  const deviceStates = new Map();
  let active = owners.get(activeOwnerId) || owners.get(GUEST_A);
  let uuidIndex = 0;
  let authUserId = USER_A;
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
      authUserId = userId;
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
    async listPendingSyncOperations() { calls.push(["listPendingSyncOperations"]); return []; },
    async countPendingSyncOperations() { return 0; },
    async listOpenSyncConflicts() { return []; },
    async getSyncConflict() { return null; },
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
      return { userId: authUserId, ...input, minimumRetainedSyncSeq: 0 };
    },
    async registerDevice(input) {
      calls.push(["registerDevice", input]);
      if (failRpc) throw Object.assign(new Error("select private.secret"), { code: "MEMORY_GATEWAY_FAILED" });
      return { id: input.deviceId, installationId: input.installationId, platform: input.platform, appVersion: input.appVersion, lastSyncSeq: serverSequence };
    },
    async promoteGuest() {
      return { status: "COMPLETED", importedCounts: { privateTitles: 0, cards: 0, visualAssets: 0, boards: 0, boardCards: 0 }, nextSyncSeq: 0 };
    },
    async pullChanges({ afterSeq }) {
      calls.push(["pullChanges", afterSeq]);
      return { changes: [], nextSyncSeq: afterSeq, minimumRetainedSyncSeq: 0, requiresFullResync: false };
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
    gateway,
    repository,
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

test("an authenticated account stays idle until the user explicitly starts sync", async () => {
  const harness = createHarness({ guestCards: 0 });
  const result = await harness.runtime.initializeAccountSession(session(USER_A));
  assert.equal(result.status, "ACCOUNT_READY");
  assert.equal(await harness.runtime.buildPromotionPreview(), null);
  assert.equal(await harness.runtime.promote(), null);
  assert.equal(harness.calls.some(([name]) => name.includes("sync")), false);
  const synced = await harness.runtime.syncNow();
  assert.equal(synced.syncResultCode, "SYNCED");
  assert.equal(harness.calls.filter(([name]) => name === "pullChanges").length, 1);
});


test('account initialization preserves the durable local pull cursor instead of skipping to server device state', async () => {
  const h = createHarness({ guestCards: 0, serverSequence: 100 });
  const ownerId = `account:${USER_A}`;
  h.deviceStates.set(ownerId, { ownerId, userId: USER_A, installationId: INSTALLATION_ID, deviceId: DEVICE_A, lastSyncSeq: 7, updatedAt: NOW });
  await h.runtime.initializeAccountSession(session(USER_A));
  await h.runtime.syncNow();
  assert.equal(h.deviceStates.get(ownerId).lastSyncSeq, 7);
  assert.deepEqual(h.calls.find(([name]) => name === 'pullChanges'), ['pullChanges', 7]);
});


const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
test('a delayed A initialization cannot reactivate A after B or sign-out', async () => {
  for (const target of ['B', 'OUT']) {
    const h = createHarness({ guestCards: 0 }); const entered = deferred(); const release = deferred();
    const register = h.gateway.registerDevice;
    let count = 0;
    h.gateway.registerDevice = async data => { if (++count === 1) { entered.resolve(); await release.promise; } return register(data); };
    const first = h.runtime.initializeAccountSession(session(USER_A)).catch(error => error.code);
    await entered.promise;
    const next = target === 'B' ? h.runtime.initializeAccountSession(session(USER_B)) : h.runtime.handleSignedOut();
    release.resolve();
    await Promise.all([first, next]);
    assert.equal(h.getActive().id, target === 'B' ? `account:${USER_B}` : GUEST_A);
    assert.equal((await h.runtime.getState()).userId || null, target === 'B' ? USER_B : null);
    assert.equal(h.calls.some(([name, owner]) => name === 'activateOwner' && owner === `account:${USER_A}`), false);
  }
});


test('late initialization failure cannot replace the newer account state', async () => {
  const h = createHarness({ guestCards: 0 }); const entered = deferred(); const release = deferred();
  const register = h.gateway.registerDevice; let first = true;
  h.gateway.registerDevice = async data => { if (first) { first = false; entered.resolve(); await release.promise; throw new Error('late A failure'); } return register(data); };
  const old = h.runtime.initializeAccountSession(session(USER_A)).catch(error => error.code);
  await entered.promise;
  const current = h.runtime.initializeAccountSession(session(USER_B)); release.resolve();
  await Promise.all([old, current]);
  assert.equal((await h.runtime.getState()).userId, USER_B);
  assert.equal((await h.runtime.getState()).status, 'ACCOUNT_READY');
});

test('cancelled promotion preview cannot be used to send a promotion', async () => {
  const h = createHarness(); let sent = 0;
  h.gateway.promoteGuest = async () => { sent++; throw new Error('unexpected RPC'); };
  await h.runtime.initializeAccountSession(session(USER_A));
  await h.runtime.buildPromotionPreview();
  h.runtime.cancelPromotionPreview();
  assert.equal(await h.runtime.promote(), null);
  assert.equal(sent, 0);
});

test('a preview arriving after cancellation is discarded', async () => {
  const h = createHarness(); await h.runtime.initializeAccountSession(session(USER_A));
  const read = h.repository.readOwnerPromotionBundle; const entered = deferred(); const release = deferred();
  h.repository.readOwnerPromotionBundle = async () => { entered.resolve(); await release.promise; return read(); };
  const preview = h.runtime.buildPromotionPreview();
  await entered.promise; h.runtime.cancelPromotionPreview(); release.resolve();
  await assert.rejects(() => preview, { code: 'PROMOTION_PREVIEW_CANCELLED' });
  assert.equal(await h.runtime.promote(), null);
});

test('A to B to A transition invalidates the first A request despite equal user ids', async () => {
  const h = createHarness({ guestCards: 0 }); const entered = deferred(); const release = deferred();
  const register = h.gateway.registerDevice; let first = true;
  h.gateway.registerDevice = async data => { if (first) { first = false; entered.resolve(); await release.promise; } return register(data); };
  const old = h.runtime.initializeAccountSession(session(USER_A)).catch(error => error.code);
  await entered.promise;
  const middle = h.runtime.initializeAccountSession(session(USER_B)).catch(error => error.code);
  const last = h.runtime.initializeAccountSession(session(USER_A));
  release.resolve();
  assert.equal(await old, 'SYNC_OWNER_CHANGED');
  assert.equal(await middle, 'SYNC_OWNER_CHANGED');
  assert.equal((await last).userId, USER_A);
  assert.equal(h.calls.filter(([name, owner]) => name === 'activateOwner' && owner === `account:${USER_A}`).length, 1);
});


test('late sync result cannot place A conflicts or completion state into B', async () => {
  const h = createHarness({ guestCards: 0 });
  await h.runtime.initializeAccountSession(session(USER_A));
  const entered = deferred(); const release = deferred();
  h.gateway.pullChanges = async ({ afterSeq }) => { entered.resolve(); await release.promise; return { changes: [], nextSyncSeq: afterSeq }; };
  const sync = h.runtime.syncNow().catch(error => error.code);
  await entered.promise;
  const next = h.runtime.initializeAccountSession(session(USER_B)); release.resolve();
  assert.equal(await sync, 'SYNC_OWNER_CHANGED');
  await next;
  const state = await h.runtime.getState();
  assert.equal(state.userId, USER_B);
  assert.equal(state.syncResultCode, undefined);
  assert.equal(state.conflicts, undefined);
});

test('a late conflict backup read cannot return A private content after switching to B', async () => {
  const h = createHarness({ guestCards: 0 });
  await h.runtime.initializeAccountSession(session(USER_A));
  const entered = deferred(); const release = deferred();
  h.repository.getSyncConflict = async () => { entered.resolve(); await release.promise; return { localEntity: { note: 'A private' } }; };
  const backup = h.runtime.exportConflictBackup('synthetic').catch(error => error.code);
  await entered.promise;
  await h.runtime.initializeAccountSession(session(USER_B)); release.resolve();
  assert.equal(await backup, 'SYNC_OWNER_CHANGED');
});
