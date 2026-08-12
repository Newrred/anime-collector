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

const replaceCleanupBundle = () => ({
  operation: {
    id: "replace-op",
    ownerId: OWNER_ID,
    cardId: "card-3",
    assetId: "asset-new",
    previousAssetId: "asset-old",
    kind: "REPLACE",
    state: "FAILED",
    attemptCount: 1,
    intakeTicketId: null,
    result: {
      operationId: "replace-op",
      cardId: "card-3",
      visualAssetId: "asset-new",
      previousAssetId: "asset-old",
      cleanupPending: true,
    },
    createdAt: "2026-08-12T00:00:00.000Z",
  },
  card: {
    id: "card-3",
    ownerId: OWNER_ID,
    privateTitleId: "title-3",
    animeRefId: null,
    visualAssetId: "asset-new",
    status: "COMPLETE_PRIVATE",
    note: "keep note",
  },
  title: { id: "title-3", ownerId: OWNER_ID, displayTitle: "Violet" },
  asset: {
    id: "asset-new",
    ownerId: OWNER_ID,
    state: "READY",
    localRef: "asset:new",
    storageScope: "LOCAL_ONLY",
    visibility: "PRIVATE",
  },
  previousAsset: {
    id: "asset-old",
    ownerId: OWNER_ID,
    state: "DELETE_PENDING",
    localRef: "asset:old",
    checksumSha256: "c".repeat(64),
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

test("reconciliation preserves an AnimeRef title when an import resumes", async () => {
  const imports = importBundle();
  imports.card.privateTitleId = null;
  imports.card.animeRefId = "anime-ref-1";
  imports.title = null;
  imports.animeRef = {
    id: "anime-ref-1",
    displayTitle: "Frieren: Beyond Journey's End",
    sourceKey: "ANILIST:154587",
    verificationState: "PROVIDER_CANDIDATE",
  };
  let completion;
  const reconciler = createMemoryOperationReconciler({
    repository: {
      listRecoverableOperations: async () => [imports.operation],
      getOperationBundle: async () => structuredClone(imports),
      beginOperationAttempt: async () => {},
      completeCreate: async (value) => { completion = value; },
      failOperation: async () => { throw new Error("not expected"); },
    },
    localMedia: {
      promoteTicket: async () => ({
        localRef: "asset:asset-1",
        checksumSha256: "a".repeat(64),
        mimeType: "image/png",
        byteSize: 42,
        width: 1920,
        height: 1080,
      }),
    },
    clock: { now: () => "2026-08-12T04:00:00.000Z" },
  });

  assert.deepEqual(await reconciler.execute(OWNER_ID), { recovered: 1, failed: 0 });
  assert.equal(completion.title, null);
  assert.equal(completion.animeRef.id, "anime-ref-1");
  assert.equal(completion.card.animeRefId, "anime-ref-1");
  assert.equal(completion.operation.result.animeRefId, "anime-ref-1");
  assert.equal("privateTitleId" in completion.operation.result, false);
});

test("reconciliation finishes old-file cleanup without promoting an already-switched replacement", async () => {
  const replacement = replaceCleanupBundle();
  const attempts = [];
  let completion;
  const mediaCalls = [];
  const reconciler = createMemoryOperationReconciler({
    repository: {
      listRecoverableOperations: async () => [replacement.operation],
      getOperationBundle: async () => structuredClone(replacement),
      beginOperationAttempt: async (operation) => attempts.push(operation.id),
      completeReplace: async (value) => { completion = value; },
      failOperation: async () => { throw new Error("not expected"); },
    },
    localMedia: {
      promoteTicket: async () => assert.fail("committed replacement must not promote again"),
      deleteAsset: async (value) => { mediaCalls.push(value); return true; },
    },
    clock: { now: () => "2026-08-12T06:00:00.000Z" },
  });

  assert.deepEqual(await reconciler.execute(OWNER_ID), { recovered: 1, failed: 0 });
  assert.deepEqual(attempts, ["replace-op"]);
  assert.deepEqual(mediaCalls, [{ localRef: "asset:old" }]);
  assert.equal(completion.card.visualAssetId, "asset-new");
  assert.equal(completion.replacementAsset.id, "asset-new");
  assert.equal(completion.previousAsset.state, "DELETED");
  assert.equal(completion.previousAsset.localRef, null);
  assert.equal(completion.previousAsset.checksumSha256, null);
  assert.equal(completion.operation.state, "COMPLETED");
  assert.equal(completion.operation.result.cleanupPending, false);
});

test("reconciliation does not scrub a previous asset when native deletion is unconfirmed", async () => {
  const replacement = replaceCleanupBundle();
  const failures = [];
  let completion;
  const reconciler = createMemoryOperationReconciler({
    repository: {
      listRecoverableOperations: async () => [replacement.operation],
      getOperationBundle: async () => structuredClone(replacement),
      beginOperationAttempt: async () => {},
      completeReplace: async (value) => { completion = value; },
      failOperation: async (failure) => failures.push(failure),
    },
    localMedia: {
      promoteTicket: async () => assert.fail("committed replacement must not promote again"),
      deleteAsset: async () => false,
    },
    clock: { now: () => "2026-08-12T06:30:00.000Z" },
  });

  assert.deepEqual(await reconciler.execute(OWNER_ID), { recovered: 0, failed: 1 });
  assert.equal(completion, undefined);
  assert.equal(replacement.previousAsset.localRef, "asset:old");
  assert.equal(failures[0].errorCode, "MEDIA_DELETE_FAILED");
});

test("reconciliation resumes a replacement that stopped before the new file was committed", async () => {
  const replacement = replaceCleanupBundle();
  replacement.operation.state = "FAILED";
  replacement.operation.intakeTicketId = "ticket-new";
  replacement.operation.result = null;
  replacement.card.visualAssetId = "asset-old";
  replacement.asset.state = "IMPORTING";
  replacement.asset.localRef = null;
  replacement.previousAsset.state = "READY";
  replacement.previousAsset.deletedAt = null;
  const sequence = [];
  let committed;
  let completed;
  const reconciler = createMemoryOperationReconciler({
    repository: {
      listRecoverableOperations: async () => [replacement.operation],
      getOperationBundle: async () => structuredClone(replacement),
      beginOperationAttempt: async () => sequence.push("attempt"),
      commitReplace: async (value) => { sequence.push("commit"); committed = value; },
      completeReplace: async (value) => { sequence.push("complete"); completed = value; },
      failOperation: async () => { throw new Error("not expected"); },
    },
    localMedia: {
      promoteTicket: async (value) => {
        sequence.push("promote");
        assert.deepEqual(value, {
          ticketId: "ticket-new",
          assetId: "asset-new",
          operationId: "replace-op",
        });
        return {
          localRef: "asset:new",
          checksumSha256: "d".repeat(64),
          mimeType: "image/webp",
          byteSize: 4096,
          width: 1920,
          height: 1080,
        };
      },
      deleteAsset: async ({ localRef }) => {
        sequence.push("delete-old");
        assert.equal(localRef, "asset:old");
        return true;
      },
    },
    clock: { now: () => "2026-08-12T07:00:00.000Z" },
  });

  assert.deepEqual(await reconciler.execute(OWNER_ID), { recovered: 1, failed: 0 });
  assert.deepEqual(sequence, ["attempt", "promote", "commit", "delete-old", "complete"]);
  assert.equal(committed.card.visualAssetId, "asset-new");
  assert.equal(committed.replacementAsset.state, "READY");
  assert.equal(committed.previousAsset.state, "DELETE_PENDING");
  assert.equal(committed.operation.state, "FILE_READY");
  assert.equal(committed.operation.intakeTicketId, null);
  assert.equal(completed.previousAsset.state, "DELETED");
  assert.equal(completed.operation.state, "COMPLETED");
  assert.equal(completed.operation.result.cleanupPending, false);
});
