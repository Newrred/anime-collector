import test from "node:test";
import assert from "node:assert/strict";

import { createDeleteMemoryCardCommand } from "../../src/features/memory/application/deleteMemoryCard.js";

const OWNER_ID = "guest:11111111-1111-4111-8111-111111111111";

test("delete tombstones first, deletes private media, then scrubs sensitive metadata", async () => {
  let current = {
    card: {
      id: "card-1",
      ownerId: OWNER_ID,
      status: "COMPLETE_PRIVATE",
      note: "private note",
      sceneCue: "private scene",
      visualAssetId: "asset-1",
      deletedAt: null,
    },
    title: { id: "title-1", ownerId: OWNER_ID, displayTitle: "Frieren" },
    asset: {
      id: "asset-1",
      ownerId: OWNER_ID,
      state: "READY",
      storageScope: "LOCAL_ONLY",
      localRef: "asset:asset-1",
      checksumSha256: "a".repeat(64),
      creatorName: "private creator",
      sourceUrl: "https://private.example/image",
      permissionEvidenceRef: "private evidence",
      deletedAt: null,
    },
  };
  const operations = new Map();
  const sequence = [];
  const repository = {
    getOperation: async (_, id) => operations.get(id) || null,
    getCardBundle: async (ownerId, id) =>
      current.card.ownerId === ownerId && current.card.id === id ? structuredClone(current) : null,
    planDelete: async ({ card, asset, operation }) => {
      sequence.push("tombstone");
      current = { ...current, card: structuredClone(card), asset: structuredClone(asset) };
      operations.set(operation.id, structuredClone(operation));
    },
    completeDelete: async ({ card, asset, operation }) => {
      sequence.push("scrub");
      current = { ...current, card: structuredClone(card), asset: structuredClone(asset) };
      operations.set(operation.id, structuredClone(operation));
    },
    failOperation: async () => { throw new Error("not expected"); },
  };
  const command = createDeleteMemoryCardCommand({
    repository,
    localMedia: {
      deleteAsset: async ({ localRef }) => {
        sequence.push("file-delete");
        assert.equal(current.card.status, "DELETED");
        assert.equal(current.asset.state, "DELETE_PENDING");
        assert.equal(localRef, "asset:asset-1");
        return true;
      },
    },
    telemetry: { track: (name, properties) => sequence.push([name, properties]) },
    clock: { now: () => "2026-08-12T03:00:00.000Z" },
  });

  const result = await command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    operationId: "delete-operation-1",
  });

  assert.deepEqual(result, { operationId: "delete-operation-1", cardId: "card-1", deleted: true });
  assert.deepEqual(sequence.slice(0, 3), ["tombstone", "file-delete", "scrub"]);
  assert.equal(current.card.note, null);
  assert.equal(current.card.sceneCue, null);
  assert.equal(current.asset.state, "DELETED");
  assert.equal(current.asset.localRef, null);
  assert.equal(current.asset.checksumSha256, null);
  assert.equal(current.asset.sourceUrl, null);
  assert.equal(operations.get("delete-operation-1").state, "COMPLETED");
  assert.deepEqual(sequence[3], ["memory_card_deleted", { storageScope: "LOCAL_ONLY" }]);
});
test("completed delete operation is idempotent", async () => {
  let mediaCalls = 0;
  const result = { operationId: "delete-operation-1", cardId: "card-1", deleted: true };
  const command = createDeleteMemoryCardCommand({
    repository: {
      getOperation: async () => ({ state: "COMPLETED", result }),
    },
    localMedia: { deleteAsset: async () => { mediaCalls += 1; } },
    telemetry: { track: () => {} },
    clock: { now: () => "2026-08-12T03:00:00.000Z" },
  });

  assert.deepEqual(await command.execute({
    ownerId: OWNER_ID,
    cardId: "card-1",
    operationId: "delete-operation-1",
  }), result);
  assert.equal(mediaCalls, 0);
});

test("deleting a catalog-cover Card never asks local media to delete the shared cover", async () => {
  const coverRef = {
    sourceKind: "CATALOG_COVER",
    catalogAnimeId: "anime:11111111-1111-4111-8111-000000154587",
    catalogCoverId: "cover:11111111-1111-4111-8111-000000154587",
    catalogCoverRevisionId: `asset:${"a".repeat(40)}`,
    rightsBasis: "EXPLICIT_PERMISSION",
    permissionVerifiedAt: "2026-09-03T00:00:00.000Z",
  };
  let bundle = {
    card: {
      id: "card-cover", ownerId: OWNER_ID, status: "COMPLETE_PRIVATE", note: "기억",
      visualAssetId: "asset-cover", privateTitleId: null, animeRefId: "anime-ref-1",
      deletedAt: null,
    },
    title: { id: "anime-ref-1", catalogAnimeId: coverRef.catalogAnimeId, displayTitle: "Frieren" },
    asset: {
      id: "asset-cover", ownerId: OWNER_ID, state: "READY", imageType: "CATALOG_COVER",
      storageScope: "CATALOG_MANAGED", visibility: "PRIVATE", rightsBasis: "EXPLICIT_PERMISSION",
      localRef: null, catalogCoverRef: coverRef, deletedAt: null,
    },
  };
  let mediaCalls = 0;
  const command = createDeleteMemoryCardCommand({
    repository: {
      getOperation: async () => null,
      getCardBundle: async () => structuredClone(bundle),
      planDelete: async ({ card, asset }) => { bundle = { ...bundle, card, asset }; },
      completeDelete: async ({ card, asset }) => { bundle = { ...bundle, card, asset }; },
      listCardBoardMemberships: async () => [],
    },
    localMedia: { deleteAsset: async () => { mediaCalls += 1; } },
    telemetry: { track: () => {} },
    clock: { now: () => "2026-09-03T03:00:00.000Z" },
  });

  await command.execute({ ownerId: OWNER_ID, cardId: "card-cover", operationId: "delete-cover" });
  assert.equal(mediaCalls, 0);
  assert.deepEqual(bundle.asset.catalogCoverRef, coverRef);
  assert.equal(bundle.asset.state, "DELETED");
});
