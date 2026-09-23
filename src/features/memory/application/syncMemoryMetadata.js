import { buildMutationRequest } from "../sync/memorySyncContract.js";

const ENTITY_TYPES = Object.freeze([
  "PRIVATE_TITLE",
  "MEMORY_CARD",
  "VISUAL_ASSET",
  "MEMORY_BOARD",
  "MEMORY_BOARD_CARD",
]);
const CARD_TYPES = new Set(["PRIVATE_TITLE", "MEMORY_CARD", "VISUAL_ASSET"]);
const SAFE_ERRORS = new Set([
  "AUTH_REQUIRED", "SYNC_ABORTED", "SYNC_FULL_RESYNC_LIMIT", "SYNC_RATE_LIMITED", "SYNC_PAUSED", "SYNC_QUOTA_EXCEEDED",
  "MEMORY_GATEWAY_FAILED",
  "SYNC_RESPONSE_INVALID",
  "SYNC_REQUEST_INVALID",
  "SYNC_OWNER_CHANGED",
]);

const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};
const safeCode = (error) => SAFE_ERRORS.has(error?.code) ? error.code : "MEMORY_GATEWAY_FAILED";
const clone = (value) => value == null ? value : structuredClone(value);
const emptyPushResult = () => ({ applied: 0, conflicts: 0, rejected: 0, remaining: 0, lastErrorCode: null });

const assertCurrentOwner = async (repository, ownerId) => {
  const active = await repository.getActiveOwner();
  if (active?.id !== ownerId) fail("SYNC_OWNER_CHANGED", "The active Memory owner changed");
};

export function createMemoryMetadataSync({ repository, gateway, clock, readDeviceSyncState }) {
  if (!repository || !gateway || typeof clock?.now !== "function") {
    fail("SYNC_RUNTIME_INVALID", "Memory sync dependencies are incomplete");
  }

  const flushOutbox = async ({ ownerId, userId, deviceId, signal, appliedVersions = new Map(), limit = 50 } = {}) => {
    const summary = emptyPushResult();
    const pending = await repository.listPendingSyncOperations(ownerId, Math.min(50, limit));
    for (const stored of pending) {
      if (signal?.aborted) {
        summary.lastErrorCode = "SYNC_ABORTED";
        break;
      }
      try {
        await assertCurrentOwner(repository, ownerId);
        const key = `${stored.entityType}:${stored.entityId}`;
        let request = {
          operationId: stored.id,
          deviceId,
          entityType: stored.entityType,
          entityId: stored.entityId,
          operationType: stored.operationType,
          baseVersion: stored.baseVersion,
          requestHash: stored.requestHash,
          payload: clone(stored.payload),
        };
        if (appliedVersions.has(key) && request.baseVersion < appliedVersions.get(key)) {
          request = await buildMutationRequest({
            ...request,
            baseVersion: appliedVersions.get(key),
          });
          await repository.rebaseSyncOperation({
            ownerId,
            operationId: stored.id,
            baseVersion: request.baseVersion,
            requestHash: request.requestHash,
          });
        }
        const result = CARD_TYPES.has(stored.entityType)
          ? await gateway.applyCardMutation(request, { signal })
          : await gateway.applyBoardMutation(request, { signal });
        await assertCurrentOwner(repository, ownerId);
        await repository.commitSyncMutation({ ownerId, userId, operation: { ...stored, ...request, id: stored.id }, result, now: String(clock.now()) });
        if (result.status === "APPLIED") {
          summary.applied += 1;
          appliedVersions.set(key, result.entityVersion);
          continue;
        }
        if (result.status === "CONFLICT") {
          summary.conflicts += 1;
          summary.lastErrorCode = result.errorCode || "VERSION_CONFLICT";
          break;
        }
        summary.rejected += 1;
        summary.lastErrorCode = result.errorCode || "MUTATION_REJECTED";
        break;
      } catch (error) {
        summary.lastErrorCode = safeCode(error);
        break;
      }
    }
    summary.remaining = await repository.countPendingSyncOperations(ownerId);
    return Object.freeze(summary);
  };

  const pullChanges = async ({ ownerId, userId, signal } = {}) => {
    if (signal?.aborted) fail("SYNC_ABORTED", "Memory sync was cancelled");
    await assertCurrentOwner(repository, ownerId);
    const state = await (readDeviceSyncState || repository.readDeviceSyncState.bind(repository))(ownerId);
    if (!state || state.userId !== userId) fail("DEVICE_SYNC_STATE_INVALID", "Device sync state is unavailable");
    const page = await gateway.pullChanges({ afterSeq: state.lastSyncSeq, limit: 200, signal });
    await assertCurrentOwner(repository, ownerId);
    if (signal?.aborted) fail("SYNC_ABORTED", "Memory sync was cancelled");
    if (page.requiresFullResync) {
      const entities = [];
      for (const entityType of ENTITY_TYPES) {
        if (signal?.aborted) fail("SYNC_ABORTED", "Memory sync was cancelled");
        const rows = await gateway.readAllEntities({ entityType, userId, limit: 5000, signal });
        entities.push(...rows);
      }
      if (signal?.aborted) fail("SYNC_ABORTED", "Memory sync was cancelled");
      await assertCurrentOwner(repository, ownerId);
      const committed = await repository.commitFullResync({
        ownerId,
        userId,
        entities,
        nextSyncSeq: page.nextSyncSeq,
        now: String(clock.now()),
      });
      return Object.freeze({
        applied: Number(committed?.applied ?? entities.length),
        conflicts: Number(committed?.conflicts ?? 0),
        nextSyncSeq: page.nextSyncSeq,
        fullResync: true,
        hasMore: true,
      });
    }

    let applied = 0;
    let conflicts = 0;
    const latestByEntity = new Map();
    for (const change of page.changes) latestByEntity.set(`${change.entityType}:${change.entityId}`, change);
    const effectiveChanges = [...latestByEntity.values()].sort((left, right) => left.syncSeq - right.syncSeq);
    for (const change of effectiveChanges) {
      if (signal?.aborted) fail("SYNC_ABORTED", "Memory sync was cancelled");
      const rows = await gateway.readEntities({ entityType: change.entityType, entityIds: [change.entityId], userId, signal });
      if (rows.length !== 1 || rows[0].id !== change.entityId || rows[0].version < change.entityVersion
        || (change.operationType === "DELETE" && !rows[0].deletedAt)) {
        fail("SYNC_RESPONSE_INVALID", "Pulled Memory entity did not match its change record");
      }
      await assertCurrentOwner(repository, ownerId);
      const hasPending = await repository.hasPendingEntityOperation(ownerId, change.entityType, change.entityId);
      if (signal?.aborted) fail("SYNC_ABORTED", "Memory sync was cancelled");
      const tombstoneWins = change.operationType === "DELETE" || Boolean(rows[0].deletedAt);
      const createConflict = hasPending && !tombstoneWins;
      await repository.commitPulledChange({
        ownerId,
        userId,
        change: { ...change, entityVersion: rows[0].version, operationType: tombstoneWins ? "DELETE" : change.operationType },
        remoteEntity: rows[0],
        createConflict,
        tombstoneWins,
        nextSyncSeq: change.syncSeq,
        now: String(clock.now()),
      });
      if (createConflict) conflicts += 1;
      else applied += 1;
    }
    return Object.freeze({ applied, conflicts, nextSyncSeq: page.nextSyncSeq, fullResync: false, hasMore: page.changes.length === 200 });
  };

  // These are per-click work budgets, never product storage limits.
  const syncNow = async (input = {}) => {
    const push = emptyPushResult();
    const pull = { applied: 0, conflicts: 0, hasMore: true };
    const appliedVersions = new Map();
    const deadline = Date.now() + 20000;
    const statusFor = (code) => ["SYNC_ABORTED", "SYNC_PAUSED", "SYNC_RATE_LIMITED"].includes(code) ? "PAUSED" : "ERROR";
    try {
      if ((await repository.listOpenSyncConflicts?.(input.ownerId) || []).length) {
        return Object.freeze({ status: "CONFLICT", push, pull: null });
      }
      for (const [key, version] of await repository.readAcknowledgedSyncVersions?.(input.ownerId) || []) appliedVersions.set(key, version);
      const target = Math.min(500, await repository.countPendingSyncOperations(input.ownerId));
      for (let batch = 0; batch < 10 && push.applied < target; batch++) {
        if (Date.now() >= deadline) return Object.freeze({ status: "PARTIAL", push, pull: null });
        const page = await flushOutbox({ ...input, appliedVersions, limit: Math.min(50, target - push.applied) });
        for (const key of ["applied", "conflicts", "rejected"]) push[key] += page[key];
        push.remaining = page.remaining;
        push.lastErrorCode = page.lastErrorCode;
        if (page.lastErrorCode || page.conflicts || page.rejected) {
          return Object.freeze({ status: page.conflicts ? "CONFLICT" : page.rejected ? "REJECTED" : statusFor(page.lastErrorCode), push, pull: null });
        }
        if (!page.applied) break;
      }
      push.remaining = await repository.countPendingSyncOperations(input.ownerId);
      if (push.remaining) return Object.freeze({ status: "PARTIAL", push, pull: null });
      for (let page = 0; page < 10; page++) {
        if (Date.now() >= deadline) break;
        const next = await pullChanges(input);
        Object.assign(pull, next, { applied: pull.applied + next.applied, conflicts: pull.conflicts + next.conflicts });
        // Totals are informational; completion follows durable cursors and pending state.
        if (pull.conflicts || !pull.hasMore) break;
      }
      push.remaining = await repository.countPendingSyncOperations(input.ownerId);
      const conflicts = await repository.listOpenSyncConflicts?.(input.ownerId) || [];
      const rejected = await repository.countRejectedSyncOperations?.(input.ownerId) || 0;
      return Object.freeze({ status: conflicts.length || pull.conflicts ? "CONFLICT" : rejected ? "REJECTED"
        : push.remaining || pull.hasMore ? "PARTIAL" : "SYNCED", push, pull });
    } catch (error) {
      const errorCode = safeCode(error);
      return Object.freeze({ status: statusFor(errorCode), push, pull: null, errorCode });
    }
  };

  return Object.freeze({ flushOutbox, pullChanges, syncNow });
}
