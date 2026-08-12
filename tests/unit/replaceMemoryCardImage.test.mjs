import test from "node:test";
import assert from "node:assert/strict";

import { createReplaceMemoryCardImageCommand } from "../../src/features/memory/application/replaceMemoryCardImage.js";

const OWNER_ID = "guest:11111111-1111-4111-8111-111111111111";

const originalBundle = () => ({
  card: {
    id: "card-1",
    ownerId: OWNER_ID,
    privateTitleId: "title-1",
    animeRefId: null,
    visualAssetId: "asset-old",
    status: "COMPLETE_PRIVATE",
    note: "keep this note",
    updatedAt: "2026-08-12T00:00:00.000Z",
  },
  title: { id: "title-1", ownerId: OWNER_ID, displayTitle: "Frieren" },
  asset: {
    id: "asset-old",
    ownerId: OWNER_ID,
    state: "READY",
    localRef: "asset:old",
    checksumSha256: "a".repeat(64),
    storageScope: "LOCAL_ONLY",
    visibility: "PRIVATE",
    updatedAt: "2026-08-12T00:00:00.000Z",
  },
});

test("replacement switches the card only after the new asset is ready, then deletes the old file", async () => {
  let current = originalBundle();
  let previousAsset = null;
  const operations = new Map();
  const sequence = [];
  const repository = {
    getOperation: async (_, id) => operations.get(id) || null,
    getCardBundle: async () => structuredClone(current),
    reserveReplace: async ({ replacementAsset, operation }) => {
      sequence.push("reserve");
      assert.equal(current.card.visualAssetId, "asset-old");
      assert.equal(current.asset.state, "READY");
      assert.equal(replacementAsset.state, "IMPORTING");
      operations.set(operation.id, structuredClone(operation));
    },
    commitReplace: async ({ card, replacementAsset, previousAsset: previous, operation }) => {
      sequence.push("commit");
      previousAsset = structuredClone(previous);
      current = { ...current, card: structuredClone(card), asset: structuredClone(replacementAsset) };
      operations.set(operation.id, structuredClone(operation));
    },
    completeReplace: async ({ previousAsset: previous, operation }) => {
      sequence.push("complete");
      previousAsset = structuredClone(previous);
      operations.set(operation.id, structuredClone(operation));
    },
    failOperation: async () => { throw new Error("not expected"); },
  };
  const telemetry = [];
  const command = createReplaceMemoryCardImageCommand({
    repository,
    localMedia: {
      promoteTicket: async ({ ticketId, assetId, operationId }) => {
        sequence.push("promote");
        assert.equal(current.card.visualAssetId, "asset-old");
        assert.deepEqual({ ticketId, assetId, operationId }, {
          ticketId: "ticket-new",
          assetId: "asset-new",
          operationId: "replace-op",
        });
        return {
          localRef: "asset:new",
          checksumSha256: "b".repeat(64),
          mimeType: "image/png",
          byteSize: 2048,
          width: 1280,
          height: 720,
        };
      },
      deleteAsset: async ({ localRef }) => {
        sequence.push("delete-old");
        assert.equal(current.card.visualAssetId, "asset-new");
        assert.equal(current.asset.state, "READY");
        assert.equal(previousAsset.state, "DELETE_PENDING");
        assert.equal(localRef, "asset:old");
        return true;
      },
    },
    telemetry: { track: (name, properties) => telemetry.push([name, properties]) },
    clock: { now: () => "2026-08-12T01:00:00.000Z" },
    ids: { next: () => "asset-new" },
  });

  const result = await command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-op",
  });

  assert.deepEqual(sequence, ["reserve", "promote", "commit", "delete-old", "complete"]);
  assert.equal(current.card.note, "keep this note");
  assert.equal(previousAsset.state, "DELETED");
  assert.equal(previousAsset.localRef, null);
  assert.equal(previousAsset.checksumSha256, null);
  assert.deepEqual(result, {
    operationId: "replace-op",
    cardId: "card-1",
    visualAssetId: "asset-new",
    previousAssetId: "asset-old",
    cleanupPending: false,
  });
  assert.equal(operations.get("replace-op").state, "COMPLETED");
  assert.deepEqual(telemetry, [["memory_card_image_replaced", {
    storageScope: "LOCAL_ONLY",
    cleanupPending: false,
  }]]);
});

test("promotion failure records a safe operation error and preserves the original card", async () => {
  const current = originalBundle();
  const failures = [];
  let committed = false;
  let deleted = false;
  const command = createReplaceMemoryCardImageCommand({
    repository: {
      getOperation: async () => null,
      getCardBundle: async () => structuredClone(current),
      reserveReplace: async () => {},
      commitReplace: async () => { committed = true; },
      completeReplace: async () => { committed = true; },
      failOperation: async (failure) => failures.push(failure),
    },
    localMedia: {
      promoteTicket: async () => {
        throw Object.assign(new Error("private native path detail"), {
          code: "MEDIA_STORAGE_FULL",
        });
      },
      deleteAsset: async () => { deleted = true; },
    },
    telemetry: { track: () => assert.fail("failed promotion must not emit success telemetry") },
    clock: { now: () => "2026-08-12T02:00:00.000Z" },
    ids: { next: () => "asset-new" },
  });

  await assert.rejects(command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-op",
  }), (error) => {
    assert.equal(error.code, "MEDIA_STORAGE_FULL");
    assert.equal(error.intakeTicketOwned, true);
    assert.equal(error.message, "The replacement image could not be stored");
    assert.doesNotMatch(error.message, /private|path/i);
    return true;
  });

  assert.equal(current.card.visualAssetId, "asset-old");
  assert.equal(current.asset.state, "READY");
  assert.equal(committed, false);
  assert.equal(deleted, false);
  assert.deepEqual(failures, [{
    ownerId: OWNER_ID,
    operationId: "replace-op",
    errorCode: "MEDIA_STORAGE_FULL",
    now: "2026-08-12T02:00:00.000Z",
  }]);
});

test("promotion error still transfers ticket ownership when recording the failure also fails", async () => {
  const command = createReplaceMemoryCardImageCommand({
    repository: {
      getOperation: async () => null,
      getCardBundle: async () => originalBundle(),
      reserveReplace: async () => {},
      failOperation: async () => { throw new Error("database write failed"); },
    },
    localMedia: {
      promoteTicket: async () => {
        throw Object.assign(new Error("private native detail"), { code: "MEDIA_STORAGE_FULL" });
      },
    },
    telemetry: { track: () => assert.fail("failed promotion must not emit telemetry") },
    clock: { now: () => "2026-08-12T02:30:00.000Z" },
    ids: { next: () => "asset-new" },
  });

  await assert.rejects(command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-op",
  }), (error) => {
    assert.equal(error.code, "MEDIA_STORAGE_FULL");
    assert.equal(error.intakeTicketOwned, true);
    return true;
  });
});

test("old-file cleanup failure keeps the new card visible and leaves a recoverable operation", async () => {
  let current = originalBundle();
  const operations = new Map();
  const failures = [];
  let completed = false;
  const telemetry = [];
  const command = createReplaceMemoryCardImageCommand({
    repository: {
      getOperation: async (_, id) => operations.get(id) || null,
      getCardBundle: async () => structuredClone(current),
      reserveReplace: async ({ operation }) => operations.set(operation.id, structuredClone(operation)),
      commitReplace: async ({ card, replacementAsset, operation }) => {
        current = { ...current, card: structuredClone(card), asset: structuredClone(replacementAsset) };
        operations.set(operation.id, structuredClone(operation));
      },
      completeReplace: async () => { completed = true; },
      failOperation: async (failure) => {
        failures.push(failure);
        const operation = operations.get(failure.operationId);
        operations.set(failure.operationId, {
          ...operation,
          state: "FAILED",
          lastErrorCode: failure.errorCode,
        });
      },
    },
    localMedia: {
      promoteTicket: async () => ({
        localRef: "asset:new",
        checksumSha256: "b".repeat(64),
        mimeType: "image/png",
        byteSize: 2048,
        width: 1280,
        height: 720,
      }),
      deleteAsset: async () => {
        throw Object.assign(new Error("private old path"), { code: "MEDIA_DELETE_FAILED" });
      },
    },
    telemetry: { track: (name, properties) => telemetry.push([name, properties]) },
    clock: { now: () => "2026-08-12T03:00:00.000Z" },
    ids: { next: () => "asset-new" },
  });

  const result = await command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-op",
  });

  assert.equal(current.card.visualAssetId, "asset-new");
  assert.equal(current.asset.state, "READY");
  assert.equal(completed, false);
  assert.deepEqual(result, {
    operationId: "replace-op",
    cardId: "card-1",
    visualAssetId: "asset-new",
    previousAssetId: "asset-old",
    cleanupPending: true,
  });
  assert.equal(operations.get("replace-op").state, "FAILED");
  assert.equal(operations.get("replace-op").result.cleanupPending, true);
  assert.deepEqual(failures, [{
    ownerId: OWNER_ID,
    operationId: "replace-op",
    errorCode: "MEDIA_DELETE_FAILED",
    now: "2026-08-12T03:00:00.000Z",
  }]);
  assert.deepEqual(telemetry, [["memory_card_image_replaced", {
    storageScope: "LOCAL_ONLY",
    cleanupPending: true,
  }]]);
});

test("unconfirmed native deletion keeps the previous asset reference recoverable", async () => {
  let operation;
  let completion;
  const failures = [];
  const command = createReplaceMemoryCardImageCommand({
    repository: {
      getOperation: async () => null,
      getCardBundle: async () => originalBundle(),
      reserveReplace: async ({ operation: reserved }) => { operation = reserved; },
      commitReplace: async ({ operation: committed }) => { operation = committed; },
      completeReplace: async (value) => { completion = value; },
      failOperation: async (failure) => failures.push(failure),
    },
    localMedia: {
      promoteTicket: async () => ({
        localRef: "asset:new",
        checksumSha256: "b".repeat(64),
        mimeType: "image/png",
        byteSize: 2048,
        width: 1280,
        height: 720,
      }),
      deleteAsset: async () => false,
    },
    telemetry: { track: () => {} },
    clock: { now: () => "2026-08-12T03:30:00.000Z" },
    ids: { next: () => "asset-new" },
  });

  const result = await command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-op",
  });

  assert.equal(result.cleanupPending, true);
  assert.equal(operation.state, "FILE_READY");
  assert.equal(completion, undefined);
  assert.deepEqual(failures, [{
    ownerId: OWNER_ID,
    operationId: "replace-op",
    errorCode: "MEDIA_DELETE_FAILED",
    now: "2026-08-12T03:30:00.000Z",
  }]);
});

test("cleanup persistence failure still reports the committed replacement and keeps recovery possible", async () => {
  let operation;
  const failures = [];
  const command = createReplaceMemoryCardImageCommand({
    repository: {
      getOperation: async () => null,
      getCardBundle: async () => originalBundle(),
      reserveReplace: async ({ operation: reserved }) => { operation = reserved; },
      commitReplace: async ({ operation: committed }) => { operation = committed; },
      completeReplace: async () => {
        throw Object.assign(new Error("private database detail"), { code: "DB_WRITE_FAILED" });
      },
      failOperation: async (failure) => {
        failures.push(failure);
        throw new Error("secondary failure while recording cleanup state");
      },
    },
    localMedia: {
      promoteTicket: async () => ({
        localRef: "asset:new",
        checksumSha256: "b".repeat(64),
        mimeType: "image/png",
        byteSize: 2048,
        width: 1280,
        height: 720,
      }),
      deleteAsset: async () => true,
    },
    telemetry: { track: () => {} },
    clock: { now: () => "2026-08-12T03:45:00.000Z" },
    ids: { next: () => "asset-new" },
  });

  const result = await command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-op",
  });

  assert.equal(operation.state, "FILE_READY");
  assert.equal(result.cleanupPending, true);
  assert.deepEqual(failures, [{
    ownerId: OWNER_ID,
    operationId: "replace-op",
    errorCode: "DB_WRITE_FAILED",
    now: "2026-08-12T03:45:00.000Z",
  }]);
});

test("replacement requires explicit local-use rights confirmation before reading the card", async () => {
  const command = createReplaceMemoryCardImageCommand({
    repository: {
      getOperation: async () => null,
      getCardBundle: async () => assert.fail("card must not be read before confirmation"),
    },
    localMedia: {
      promoteTicket: async () => assert.fail("media must not be promoted"),
      deleteAsset: async () => assert.fail("media must not be deleted"),
    },
    telemetry: { track: () => assert.fail("telemetry must not be emitted") },
    clock: { now: () => "2026-08-12T04:00:00.000Z" },
    ids: { next: () => "asset-new" },
  });

  await assert.rejects(command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: false,
    operationId: "replace-op",
  }), { code: "LOCAL_USE_CONFIRMATION_REQUIRED" });
});

test("completed replacement is idempotent and never touches native media again", async () => {
  const result = {
    operationId: "replace-op",
    cardId: "card-1",
    visualAssetId: "asset-new",
    previousAssetId: "asset-old",
    cleanupPending: false,
  };
  const command = createReplaceMemoryCardImageCommand({
    repository: {
      getOperation: async () => ({ state: "COMPLETED", result }),
      getCardBundle: async () => assert.fail("completed operation must return before card read"),
    },
    localMedia: {
      promoteTicket: async () => assert.fail("completed operation must not promote again"),
      deleteAsset: async () => assert.fail("completed operation must not delete again"),
    },
    telemetry: { track: () => assert.fail("idempotent read must not emit telemetry") },
    clock: { now: () => "2026-08-12T05:00:00.000Z" },
    ids: { next: () => assert.fail("completed operation must not allocate an asset") },
  });

  assert.deepEqual(await command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-op",
  }), result);
});
