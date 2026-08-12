import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryOperationReconciler } from "../../src/features/memory/application/reconcileMemoryOperations.js";

const OWNER_ID = "guest:11111111-1111-4111-8111-111111111111";

const importBundle = () => ({
  operation: {
    id: "import-op",
    ownerId: OWNER_ID,
    cardId: "card-1",
    assetId: "asset-1",
    kind: "IMPORT",
    state: "PLANNED",
    attemptCount: 1,
    intakeTicketId: "ticket-1",
    createdAt: "2026-08-12T00:00:00.000Z",
  },
  card: {
    id: "card-1",
    ownerId: OWNER_ID,
    privateTitleId: "title-1",
    animeRefId: null,
    visualAssetId: "asset-1",
    status: "DRAFT",
    note: "private note",
  },
  title: { id: "title-1", ownerId: OWNER_ID, displayTitle: "Frieren" },
  asset: {
    id: "asset-1",
    ownerId: OWNER_ID,
    state: "IMPORTING",
    storageScope: "LOCAL_ONLY",
    visibility: "PRIVATE",
  },
});

const deleteBundle = () => ({
  operation: {
    id: "delete-op",
    ownerId: OWNER_ID,
    cardId: "card-2",
    assetId: "asset-2",
    kind: "DELETE",
    state: "FAILED",
    attemptCount: 1,
    createdAt: "2026-08-12T00:00:00.000Z",
  },
  card: {
    id: "card-2",
    ownerId: OWNER_ID,
    privateTitleId: "title-2",
    status: "DELETED",
    note: "private note",
    visualAssetId: "asset-2",
  },
  title: { id: "title-2", ownerId: OWNER_ID, displayTitle: "Violet" },
  asset: {
    id: "asset-2",
    ownerId: OWNER_ID,
    state: "DELETE_PENDING",
    localRef: "asset:asset-2",
    checksumSha256: "b".repeat(64),
    storageScope: "LOCAL_ONLY",
    visibility: "PRIVATE",
  },
});

test("startup reconciliation completes interrupted import and delete journals", async () => {
  const imports = importBundle();
  const deletion = deleteBundle();
  const completed = [];
  const attempts = [];
  const repository = {
    listRecoverableOperations: async () => [imports.operation, deletion.operation],
    getOperationBundle: async (_, id) => structuredClone(id === "import-op" ? imports : deletion),
    beginOperationAttempt: async (operation) => attempts.push(operation.id),
    completeCreate: async (value) => completed.push(["import", value]),
    completeDelete: async (value) => completed.push(["delete", value]),
    failOperation: async () => { throw new Error("not expected"); },
  };
  const mediaCalls = [];
  const reconciler = createMemoryOperationReconciler({
    repository,
    localMedia: {
      promoteTicket: async (value) => {
        mediaCalls.push(["promote", value]);
        return {
          localRef: "asset:asset-1",
          checksumSha256: "a".repeat(64),
          mimeType: "image/png",
          byteSize: 42,
          width: 1920,
          height: 1080,
        };
      },
      deleteAsset: async (value) => { mediaCalls.push(["delete", value]); return true; },
    },
    clock: { now: () => "2026-08-12T04:00:00.000Z" },
  });

  const report = await reconciler.execute(OWNER_ID);

  assert.deepEqual(report, { recovered: 2, failed: 0 });
  assert.deepEqual(attempts, ["import-op", "delete-op"]);
  assert.deepEqual(mediaCalls, [
    ["promote", { ticketId: "ticket-1", assetId: "asset-1", operationId: "import-op" }],
    ["delete", { localRef: "asset:asset-2" }],
  ]);
  assert.equal(completed[0][1].card.status, "COMPLETE_PRIVATE");
  assert.equal(completed[0][1].asset.state, "READY");
  assert.equal(completed[0][1].operation.intakeTicketId, null);
  assert.equal(completed[1][1].asset.state, "DELETED");
  assert.equal(completed[1][1].asset.localRef, null);
  assert.equal(completed[1][1].card.note, null);
});

test("reconciliation records a safe failure and continues with other operations", async () => {
  const imports = importBundle();
  const failures = [];
  const reconciler = createMemoryOperationReconciler({
    repository: {
      listRecoverableOperations: async () => [imports.operation],
      getOperationBundle: async () => structuredClone(imports),
      beginOperationAttempt: async () => {},
      completeCreate: async () => { throw new Error("must not complete"); },
      failOperation: async (value) => failures.push(value),
    },
    localMedia: {
      promoteTicket: async () => {
        throw Object.assign(new Error("private native detail"), { code: "MEDIA_STORAGE_FULL" });
      },
    },
    clock: { now: () => "2026-08-12T04:00:00.000Z" },
  });

  assert.deepEqual(await reconciler.execute(OWNER_ID), { recovered: 0, failed: 1 });
  assert.deepEqual(failures, [{
    ownerId: OWNER_ID,
    operationId: "import-op",
    errorCode: "MEDIA_STORAGE_FULL",
    now: "2026-08-12T04:00:00.000Z",
  }]);
});
