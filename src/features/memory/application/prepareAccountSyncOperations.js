import { buildMutationRequest } from "../sync/memorySyncContract.js";

const ACCOUNT_OWNER = /^account:([0-9a-f-]{36})$/i;

export async function prepareAccountSyncOperations({ repository, ownerId, specs, ids, createdAt }) {
  if (!ACCOUNT_OWNER.test(String(ownerId || ""))) return [];
  const resolvedSpecs = typeof specs === "function" ? specs() : specs;
  if (!Array.isArray(resolvedSpecs) || !resolvedSpecs.length || typeof ids?.next !== "function") {
    throw Object.assign(new Error("Account sync operation input is incomplete"), { code: "SYNC_OPERATION_INVALID" });
  }
  const device = await repository.readDeviceSyncState(ownerId);
  if (!device?.deviceId) {
    throw Object.assign(new Error("Account device registration is required"), { code: "DEVICE_SYNC_STATE_INVALID" });
  }
  const operations = [];
  for (const [ordinal, spec] of resolvedSpecs.entries()) {
    const request = await buildMutationRequest({
      operationId: ids.next("syncOperation"),
      deviceId: device.deviceId,
      entityType: spec.entityType,
      entityId: spec.entityId,
      operationType: spec.operationType,
      baseVersion: Number(spec.baseVersion || 0),
      payload: spec.payload,
    });
    operations.push(Object.freeze({
      id: request.operationId,
      ownerId,
      entityType: request.entityType,
      entityId: request.entityId,
      operationType: request.operationType,
      baseVersion: request.baseVersion,
      requestHash: request.requestHash,
      payload: request.payload,
      state: "PENDING",
      ordinal,
      createdAt: String(createdAt),
    }));
  }
  return Object.freeze(operations);
}

export const pendingSyncEnvelope = (entity, operations, now) => {
  const matching = operations.filter((operation) => operation.entityId === entity.id);
  if (!matching.length) return entity.sync;
  return {
    ...entity.sync,
    syncState: "PENDING",
    clientUpdatedAt: String(now),
    lastOperationId: matching.at(-1).id,
  };
};
