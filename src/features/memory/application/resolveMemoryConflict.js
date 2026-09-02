import { buildMutationRequest } from "../sync/memorySyncContract.js";

const fail = (code, message) => {
  throw Object.assign(new Error(message), { code });
};

export function createResolveMemoryConflict({ repository, gateway, uuid, clock }) {
  if (!repository || !gateway || typeof uuid !== "function" || typeof clock?.now !== "function") {
    fail("SYNC_RUNTIME_INVALID", "Conflict resolution dependencies are incomplete");
  }
  return async ({ ownerId, userId, deviceId, conflictId, selection }) => {
    if (!new Set(["KEEP_LOCAL", "USE_CLOUD"]).has(selection)) {
      fail("CONFLICT_SELECTION_INVALID", "Choose the local or cloud Memory version");
    }
    const conflict = await repository.getSyncConflict(ownerId, conflictId);
    if (!conflict || conflict.state !== "OPEN") fail("SYNC_CONFLICT_NOT_FOUND", "Memory conflict is unavailable");
    let result = null;
    let operation = null;
    if (selection === "KEEP_LOCAL") {
      operation = await buildMutationRequest({
        operationId: String(uuid()).toLowerCase(),
        deviceId,
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        operationType: "RESOLVE_CONFLICT",
        baseVersion: Number(conflict.remoteVersion),
        payload: structuredClone(conflict.localEntity),
      });
      result = await gateway.resolveConflict(operation);
      if (result.status !== "APPLIED") fail(result.errorCode || "CONFLICT_RESOLUTION_FAILED", "Cloud conflict changed again");
    }
    const active = await repository.getActiveOwner();
    if (active?.id !== ownerId || active?.userId !== userId) fail("SYNC_OWNER_CHANGED", "The active Memory owner changed");
    await repository.commitConflictResolution({
      ownerId,
      conflictId,
      selection,
      operation,
      result,
      now: String(clock.now()),
    });
    return Object.freeze({ selection, entityType: conflict.entityType, entityId: conflict.entityId });
  };
}
