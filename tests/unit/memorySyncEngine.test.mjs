import assert from "node:assert/strict";
import test from "node:test";

import { createMemoryMetadataSync } from "../../src/features/memory/application/syncMemoryMetadata.js";
import { createResolveMemoryConflict } from "../../src/features/memory/application/resolveMemoryConflict.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = `account:${USER_ID}`;
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const ENTITY_ID = "33333333-3333-4333-8333-333333333333";
const OPERATION_A = "44444444-4444-4444-8444-444444444444";
const OPERATION_B = "55555555-5555-4555-8555-555555555555";
const NOW = "2026-09-02T04:00:00.000Z";
const HASH = "a".repeat(64);

const operation = (id = OPERATION_A, overrides = {}) => ({
  id,
  ownerId: OWNER_ID,
  entityType: "MEMORY_CARD",
  entityId: ENTITY_ID,
  operationType: "UPSERT",
  baseVersion: 0,
  requestHash: HASH,
  payload: { id: ENTITY_ID, note: id === OPERATION_A ? "first" : "second" },
  state: "PENDING",
  createdAt: id === OPERATION_A ? NOW : "2026-09-02T04:00:01.000Z",
  ...overrides,
});

function harness({ operations = [], mutationResults = [], pullResult = null, remoteRows = [], failMutation = null } = {}) {
  const queue = operations.map((row) => structuredClone(row));
  const calls = [];
  const conflicts = [];
  const appliedRemote = [];
  let cursor = 0;
  let activeOwnerId = OWNER_ID;
  const repository = {
    async listPendingSyncOperations(_ownerId, limit = 50) { return queue.filter((row) => row.state === "PENDING").slice(0, limit).map((row) => structuredClone(row)); },
    async countPendingSyncOperations() { return queue.filter((row) => row.state === "PENDING").length; },
    async commitSyncMutation({ operation: row, result }) {
      const stored = queue.find((item) => item.id === row.id);
      if (result.status === "APPLIED") { stored.state = "APPLIED"; stored.appliedVersion = result.entityVersion; }
      if (result.status === "CONFLICT") {
        stored.state = "CONFLICT";
        conflicts.push({ entityId: row.entityId, localEntity: row.payload, remoteEntity: result.remoteEntity, remoteVersion: result.entityVersion });
      }
    },
    async rebaseSyncOperation({ operationId, baseVersion, requestHash }) {
      const stored = queue.find((item) => item.id === operationId);
      Object.assign(stored, { baseVersion, requestHash });
    },
    async readDeviceSyncState() { return { ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID, lastSyncSeq: cursor }; },
    async commitPulledChange(input) {
      appliedRemote.push(structuredClone(input));
      if (input.createConflict) conflicts.push({ entityId: input.change.entityId, remoteEntity: input.remoteEntity });
      cursor = input.nextSyncSeq;
    },
    async hasPendingEntityOperation(_ownerId, _type, entityId) {
      return queue.some((row) => row.entityId === entityId && row.state === "PENDING");
    },
    async commitFullResync({ nextSyncSeq, entities }) { cursor = nextSyncSeq; appliedRemote.push(...entities); return { applied: entities.length, conflicts: 0 }; },
    async getActiveOwner() { return { id: activeOwnerId, kind: "ACCOUNT", userId: USER_ID }; },
    async listOpenSyncConflicts() { return conflicts.map((row, index) => ({ id: `conflict-${index}`, ownerId: OWNER_ID, state: "OPEN", ...row })); },
    async getSyncConflict(_ownerId, id) { return (await this.listOpenSyncConflicts()).find((row) => row.id === id) || null; },
    async commitConflictResolution(input) { calls.push(["commit-resolution", input.selection]); },
  };
  const gateway = {
    async applyCardMutation(input) {
      calls.push(["mutation", structuredClone(input)]);
      if (failMutation) throw Object.assign(new Error("private detail"), { code: failMutation });
      return structuredClone(mutationResults.shift() || { status: "APPLIED", entityVersion: 1, syncSeq: 1, errorCode: null, remoteEntity: null });
    },
    async applyBoardMutation(input) { return this.applyCardMutation(input); },
    async pullChanges() {
      return structuredClone(pullResult || { changes: [], nextSyncSeq: cursor, minimumRetainedSyncSeq: 0, requiresFullResync: false });
    },
    async readEntities({ entityIds }) { return remoteRows.filter((row) => entityIds.includes(row.id)).map((row) => structuredClone(row)); },
    async readAllEntities() { return remoteRows.map((row) => structuredClone(row)); },
    async resolveConflict(input) {
      calls.push(["resolve", structuredClone(input)]);
      return { status: "APPLIED", entityVersion: 3, syncSeq: 9, errorCode: null, remoteEntity: null };
    },
  };
  const sync = createMemoryMetadataSync({ repository, gateway, clock: { now: () => NOW } });
  return { sync, repository, gateway, queue, calls, conflicts, appliedRemote, setActiveOwner: (value) => { activeOwnerId = value; } };
}

test("new entity pushes base version zero and marks one idempotent retry applied once", async () => {
  const row = operation();
  const h = harness({ operations: [row], mutationResults: [{ status: "APPLIED", entityVersion: 1, syncSeq: 1, errorCode: null, remoteEntity: null }] });
  const result = await h.sync.flushOutbox({ ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID });
  assert.deepEqual(result, { applied: 1, conflicts: 0, rejected: 0, remaining: 0, lastErrorCode: null });
  assert.equal(h.calls[0][1].baseVersion, 0);
  assert.equal(h.queue[0].state, "APPLIED");
});

test("two updates preserve order and rebase the second request on the first applied version", async () => {
  const h = harness({
    operations: [operation(OPERATION_A), operation(OPERATION_B)],
    mutationResults: [
      { status: "APPLIED", entityVersion: 1, syncSeq: 1, errorCode: null, remoteEntity: null },
      { status: "APPLIED", entityVersion: 2, syncSeq: 2, errorCode: null, remoteEntity: null },
    ],
  });
  await h.sync.flushOutbox({ ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID });
  assert.deepEqual(h.calls.map(([, request]) => request.operationId), [OPERATION_A, OPERATION_B]);
  assert.equal(h.calls[1][1].baseVersion, 1);
  assert.notEqual(h.calls[1][1].requestHash, HASH);
});

test("remote mismatch preserves local payload and stops with a durable conflict", async () => {
  const remoteEntity = { id: ENTITY_ID, note: "cloud", version: 2 };
  const h = harness({ operations: [operation()], mutationResults: [{ status: "CONFLICT", entityVersion: 2, syncSeq: null, errorCode: "VERSION_CONFLICT", remoteEntity }] });
  const result = await h.sync.flushOutbox({ ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID });
  assert.equal(result.conflicts, 1);
  assert.equal(h.conflicts[0].localEntity.note, "first");
  assert.equal(h.conflicts[0].remoteEntity.note, "cloud");
});

test("pull applies clean changes, records overlap conflicts, and advances only through durable commits", async () => {
  const change = { syncSeq: 4, entityType: "MEMORY_CARD", entityId: ENTITY_ID, operationType: "UPSERT", entityVersion: 2, changedAt: NOW };
  const remote = { entityType: "MEMORY_CARD", id: ENTITY_ID, userId: USER_ID, version: 2, note: "cloud" };
  const clean = harness({ pullResult: { changes: [change], nextSyncSeq: 4, minimumRetainedSyncSeq: 0, requiresFullResync: false }, remoteRows: [remote] });
  await clean.sync.pullChanges({ ownerId: OWNER_ID, userId: USER_ID });
  assert.equal(clean.appliedRemote[0].createConflict, false);
  const overlap = harness({ operations: [operation()], pullResult: { changes: [change], nextSyncSeq: 4, minimumRetainedSyncSeq: 0, requiresFullResync: false }, remoteRows: [remote] });
  await overlap.sync.pullChanges({ ownerId: OWNER_ID, userId: USER_ID });
  assert.equal(overlap.appliedRemote[0].createConflict, true);
});

test("expired cursor performs bounded full metadata resync", async () => {
  const remote = { entityType: "MEMORY_CARD", id: ENTITY_ID, userId: USER_ID, version: 2, note: "cloud" };
  const h = harness({ pullResult: { changes: [], nextSyncSeq: 12, minimumRetainedSyncSeq: 8, requiresFullResync: true }, remoteRows: [remote] });
  const result = await h.sync.pullChanges({ ownerId: OWNER_ID, userId: USER_ID });
  assert.equal(result.fullResync, true);
  assert.equal(h.appliedRemote[0].id, ENTITY_ID);
});

test("remote tombstone wins over a stale pending local upsert", async () => {
  const change = { syncSeq: 5, entityType: "MEMORY_CARD", entityId: ENTITY_ID, operationType: "DELETE", entityVersion: 3, changedAt: NOW };
  const remote = { entityType: "MEMORY_CARD", id: ENTITY_ID, userId: USER_ID, version: 3, status: "DELETED", deletedAt: NOW };
  const h = harness({ operations: [operation()], pullResult: { changes: [change], nextSyncSeq: 5, minimumRetainedSyncSeq: 0, requiresFullResync: false }, remoteRows: [remote] });
  await h.sync.pullChanges({ ownerId: OWNER_ID, userId: USER_ID });
  assert.equal(h.appliedRemote[0].tombstoneWins, true);
  assert.equal(h.appliedRemote[0].createConflict, false);
});

test("malformed or mismatched pull payload never reaches the local mutation boundary", async () => {
  const change = { syncSeq: 4, entityType: "MEMORY_CARD", entityId: ENTITY_ID, operationType: "UPSERT", entityVersion: 2, changedAt: NOW };
  const h = harness({ pullResult: { changes: [change], nextSyncSeq: 4, minimumRetainedSyncSeq: 0, requiresFullResync: false }, remoteRows: [{ entityType: "MEMORY_CARD", id: ENTITY_ID, userId: USER_ID, version: 1 }] });
  await assert.rejects(() => h.sync.pullChanges({ ownerId: OWNER_ID, userId: USER_ID }), { code: "SYNC_RESPONSE_INVALID" });
  assert.equal(h.appliedRemote.length, 0);
});

test("multiple change records for one entity coalesce to the current remote version", async () => {
  const changes = [1, 2].map((version) => ({
    syncSeq: version, entityType: "MEMORY_CARD", entityId: ENTITY_ID,
    operationType: "UPSERT", entityVersion: version, changedAt: NOW,
  }));
  const remote = { entityType: "MEMORY_CARD", id: ENTITY_ID, userId: USER_ID, version: 2, note: "latest" };
  const h = harness({ pullResult: { changes, nextSyncSeq: 2, minimumRetainedSyncSeq: 0, requiresFullResync: false }, remoteRows: [remote] });
  await h.sync.pullChanges({ ownerId: OWNER_ID, userId: USER_ID });
  assert.equal(h.appliedRemote.length, 1);
  assert.equal(h.appliedRemote[0].change.entityVersion, 2);
});

test("network failure leaves outbox retryable and returns only a bounded code", async () => {
  const h = harness({ operations: [operation()], failMutation: "MEMORY_GATEWAY_FAILED" });
  const result = await h.sync.flushOutbox({ ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID });
  assert.equal(result.lastErrorCode, "MEMORY_GATEWAY_FAILED");
  assert.equal(h.queue[0].state, "PENDING");
  assert.equal(JSON.stringify(result).includes("private detail"), false);
});

test("account switch while a request is in flight discards the stale remote result", async () => {
  const h = harness({ operations: [operation()] });
  const original = h.gateway.applyCardMutation;
  h.gateway.applyCardMutation = async (input) => {
    h.setActiveOwner("account:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    return original.call(h.gateway, input);
  };
  const result = await h.sync.flushOutbox({ ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID });
  assert.equal(result.lastErrorCode, "SYNC_OWNER_CHANGED");
  assert.equal(h.queue[0].state, "PENDING");
});

test("explicit conflict resolution keeps local through RPC or backs it up before cloud apply", async () => {
  const h = harness();
  h.conflicts.push({ entityId: ENTITY_ID, entityType: "MEMORY_CARD", localEntity: { id: ENTITY_ID, note: "local" }, remoteEntity: { id: ENTITY_ID, note: "cloud" }, remoteVersion: 2 });
  const resolver = createResolveMemoryConflict({ repository: h.repository, gateway: h.gateway, uuid: () => OPERATION_B, clock: { now: () => NOW } });
  await resolver({ ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID, conflictId: "conflict-0", selection: "KEEP_LOCAL" });
  assert.equal(h.calls[0][0], "resolve");
  assert.equal(h.calls.at(-1)[1], "KEEP_LOCAL");
  await resolver({ ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID, conflictId: "conflict-0", selection: "USE_CLOUD" });
  assert.equal(h.calls.at(-1)[1], "USE_CLOUD");
});

const input = { ownerId: OWNER_ID, userId: USER_ID, deviceId: DEVICE_ID };
const uniqueId = (index) => `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`;

test('51 pending operations drain across pages before SYNCED', async () => {
  const h = harness({ operations: Array.from({ length: 51 }, (_, i) => operation(uniqueId(i))) });
  const result = await h.sync.syncNow(input);
  assert.equal(result.status, 'SYNCED');
  assert.equal(result.push.applied, 51);
  assert.equal(result.push.remaining, 0);
});

test('201 changes continue beyond the first page without reporting early completion', async () => {
  const h = harness();
  const changes = Array.from({ length: 201 }, (_, i) => ({ syncSeq: i + 1, entityType: 'MEMORY_CARD', entityId: uniqueId(i), entityVersion: 1, operationType: 'UPSERT' }));
  h.gateway.pullChanges = async ({ afterSeq, limit }) => {
    const page = changes.filter(row => row.syncSeq > afterSeq).slice(0, limit);
    return { changes: page, nextSyncSeq: page.at(-1)?.syncSeq || afterSeq, requiresFullResync: false };
  };
  h.gateway.readEntities = async ({ entityIds }) => [{ id: entityIds[0], version: 1 }];
  const result = await h.sync.syncNow(input);
  assert.equal(result.status, 'SYNCED');
  assert.equal(result.pull.applied, 201);
  assert.equal((await h.repository.readDeviceSyncState()).lastSyncSeq, 201);
});

test('bounded session returns PARTIAL and resumes remaining operations', async () => {
  const h = harness({ operations: Array.from({ length: 501 }, (_, i) => operation(uniqueId(i), { entityId: uniqueId(i) })) });
  const first = await h.sync.syncNow(input);
  assert.equal(first.status, 'PARTIAL');
  assert.equal(first.push.applied, 500);
  assert.equal(first.push.remaining, 1);
  const second = await h.sync.syncNow(input);
  assert.equal(second.status, 'SYNCED');
  assert.equal(second.push.applied, 1);
});

test('continuous incoming pages stop at the budget and keep the committed cursor', async () => {
  const h = harness(); let pages = 0;
  h.gateway.pullChanges = async ({ afterSeq }) => {
    pages++;
    return { changes: Array.from({ length: 200 }, (_, i) => ({ syncSeq: afterSeq+i+1, entityType: 'MEMORY_CARD', entityId: ENTITY_ID, entityVersion: 1, operationType: 'UPSERT' })), nextSyncSeq: afterSeq+200, requiresFullResync: false };
  };
  h.gateway.readEntities = async () => [{ id: ENTITY_ID, version: 1 }];
  assert.equal((await h.sync.syncNow(input)).status, 'PARTIAL');
  assert.equal(pages, 10);
  assert.equal((await h.repository.readDeviceSyncState()).lastSyncSeq, 2000);
});

test('current remote version and concurrent deletion override older change records safely', async () => {
  const change = { syncSeq: 1, entityType: 'MEMORY_CARD', entityId: ENTITY_ID, entityVersion: 1, operationType: 'UPSERT' };
  const h = harness({ operations: [operation()], pullResult: { changes: [change], nextSyncSeq: 1 }, remoteRows: [{ id: ENTITY_ID, version: 201, deletedAt: NOW }] });
  await h.sync.pullChanges(input);
  assert.equal(h.appliedRemote[0].change.entityVersion, 201);
  assert.equal(h.appliedRemote[0].tombstoneWins, true);
  assert.equal(h.appliedRemote[0].createConflict, false);
});

test('paused sync preserves remaining work and successful retry reuses operation identity', async () => {
  const h = harness({ operations: [operation()] });
  const controller = new AbortController(); controller.abort();
  const first = await h.sync.syncNow({ ...input, signal: controller.signal });
  assert.equal(first.status, 'PAUSED');
  assert.equal(h.calls.length, 0);
  assert.equal((await h.sync.syncNow(input)).status, 'SYNCED');
  assert.equal(h.calls[0][1].operationId, OPERATION_A);
});

test('empty queues still respect pause, durable conflicts and rejected changes', async () => {
  const h = harness();
  const controller = new AbortController(); controller.abort();
  assert.equal((await h.sync.syncNow({ ...input, signal: controller.signal })).status, 'PAUSED');
  h.conflicts.push({ entityId: ENTITY_ID });
  assert.equal((await h.sync.syncNow(input)).status, 'CONFLICT');
  h.conflicts.length = 0;
  h.repository.countRejectedSyncOperations = async () => 1;
  assert.equal((await h.sync.syncNow(input)).status, 'REJECTED');
});

test('rate limit remains retryable and does not expose server details', async () => {
  const h = harness({ operations: [operation()], failMutation: 'SYNC_RATE_LIMITED' });
  const result = await h.sync.syncNow(input);
  assert.equal(result.status, 'PAUSED');
  assert.equal(result.push.lastErrorCode, 'SYNC_RATE_LIMITED');
  assert.equal(h.queue[0].state, 'PENDING');
});


test('resume rebases a later edit on the durable acknowledgement without replacing its operation id', async () => {
  const h = harness({ operations: [operation(OPERATION_B)] });
  h.repository.readAcknowledgedSyncVersions = async () => [[`MEMORY_CARD:${ENTITY_ID}`, 50]];
  await h.sync.syncNow(input);
  assert.equal(h.calls[0][1].baseVersion, 50);
  assert.equal(h.calls[0][1].operationId, OPERATION_B);
});

test('an uncertain network result retries exactly the same id and request hash', async () => {
  const h = harness({ operations: [operation()] });
  const seen = []; let first = true;
  h.gateway.applyCardMutation = async request => {
    seen.push(structuredClone(request));
    if (first) { first = false; throw new Error('lost response after remote commit'); }
    return { status: 'APPLIED', entityVersion: 1, syncSeq: 50 };
  };
  assert.equal((await h.sync.syncNow(input)).status, 'ERROR');
  assert.equal((await h.sync.syncNow(input)).status, 'SYNCED');
  assert.deepEqual(seen[0], seen[1]);
});

test('an incomplete full restore never commits a partial snapshot or advances the cursor', async () => {
  const h = harness({ pullResult: { changes: [], nextSyncSeq: 80, requiresFullResync: true } });
  h.gateway.readAllEntities = async ({ entityType }) => {
    if (entityType === 'MEMORY_CARD') throw Object.assign(new Error('over bound'), { code: 'SYNC_FULL_RESYNC_LIMIT' });
    return [{ id: ENTITY_ID }];
  };
  const result = await h.sync.syncNow(input);
  assert.equal(result.errorCode, 'SYNC_FULL_RESYNC_LIMIT');
  assert.equal(h.appliedRemote.length, 0);
  assert.equal((await h.repository.readDeviceSyncState()).lastSyncSeq, 0);
});


test('the same entity changing across a 200-change page boundary converges to its current version', async () => {
  const h = harness();
  const changes = Array.from({ length: 201 }, (_, i) => ({ syncSeq: i+1, entityType: 'MEMORY_CARD', entityId: ENTITY_ID, entityVersion: i+1, operationType: 'UPSERT' }));
  h.gateway.pullChanges = async ({ afterSeq, limit }) => {
    const page = changes.filter(row => row.syncSeq > afterSeq).slice(0, limit);
    return { changes: page, nextSyncSeq: page.at(-1)?.syncSeq || afterSeq, requiresFullResync: false };
  };
  h.gateway.readEntities = async () => [{ id: ENTITY_ID, version: 201 }];
  assert.equal((await h.sync.syncNow(input)).status, 'SYNCED');
  assert.equal(h.appliedRemote.length, 2);
  assert.equal((await h.repository.readDeviceSyncState()).lastSyncSeq, 201);
});


test('unresolved conflict blocks later sync from silently applying over the preserved local version', async () => {
  const h = harness(); h.conflicts.push({ entityId: ENTITY_ID, localEntity: { note: 'keep local' } });
  let requested = false;
  h.gateway.pullChanges = async () => { requested = true; throw new Error('must not pull before review'); };
  assert.equal((await h.sync.syncNow(input)).status, 'CONFLICT');
  assert.equal(requested, false);
  assert.equal(h.appliedRemote.length, 0);
});
