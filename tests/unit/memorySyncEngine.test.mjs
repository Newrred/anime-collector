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
    async listPendingSyncOperations() { return queue.filter((row) => row.state === "PENDING").map((row) => structuredClone(row)); },
    async countPendingSyncOperations() { return queue.filter((row) => row.state === "PENDING").length; },
    async commitSyncMutation({ operation: row, result }) {
      const stored = queue.find((item) => item.id === row.id);
      if (result.status === "APPLIED") stored.state = "APPLIED";
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
  const h = harness({ pullResult: { changes: [change], nextSyncSeq: 4, minimumRetainedSyncSeq: 0, requiresFullResync: false }, remoteRows: [{ entityType: "MEMORY_CARD", id: ENTITY_ID, userId: USER_ID, version: 99 }] });
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
