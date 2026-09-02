import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMutationRequest,
  parseMutationResult,
  parsePromotionResult,
  parsePullResult,
  toRemoteBoard,
  toRemoteBoardCard,
  toRemoteMemoryCard,
  toRemotePrivateTitle,
  toRemoteVisualAsset,
} from "../../src/features/memory/sync/memorySyncContract.js";

const OWNER_ID = "account:11111111-1111-4111-8111-111111111111";
const CARD_ID = "22222222-2222-4222-8222-222222222222";
const TITLE_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";
const BOARD_ID = "55555555-5555-4555-8555-555555555555";
const MEMBERSHIP_ID = "66666666-6666-4666-8666-666666666666";
const NOW = "2026-09-02T01:00:00.000Z";
const sync = { remoteVersion: 0, syncState: "LOCAL_ONLY", clientUpdatedAt: NOW, serverUpdatedAt: null, lastOperationId: null };

const privateTitle = {
  id: TITLE_ID, ownerId: OWNER_ID, displayTitle: "Frieren", normalizedTitle: "frieren",
  optionalGenres: ["Fantasy"], createdAt: NOW, updatedAt: NOW, deletedAt: null, sync,
};
const card = {
  id: CARD_ID, ownerId: OWNER_ID, animeRefId: null, privateTitleId: TITLE_ID,
  visualAssetId: ASSET_ID, status: "COMPLETE_PRIVATE", note: "Quiet journey",
  watchedAt: null, watchedAtPrecision: "UNKNOWN", episode: null, sceneCue: null,
  emotionTags: ["calm"], rewatchIntent: null, createdAt: NOW, updatedAt: NOW,
  deletedAt: null, sync,
};
const asset = {
  id: ASSET_ID, ownerId: OWNER_ID, imageType: "UNKNOWN", state: "READY",
  storageScope: "LOCAL_ONLY", visibility: "PRIVATE", rightsBasis: "UNKNOWN",
  localRef: "asset:private-path", previewDataUrl: "data:image/png;base64,private",
  sourcePath: "C:\\private\\image.png", checksumSha256: "a".repeat(64),
  mimeType: "image/png", byteSize: 2048, width: 1200, height: 675,
  designSpec: null, isCurrent: true, createdAt: NOW, updatedAt: NOW, deletedAt: null, sync,
};

test("remote DTOs redact local ownership and private media references", () => {
  const titleDto = toRemotePrivateTitle(privateTitle);
  const cardDto = toRemoteMemoryCard({ card, title: privateTitle, asset });
  const assetDto = toRemoteVisualAsset({ card, title: privateTitle, asset });
  assert.equal(titleDto.ownerId, undefined);
  assert.equal(cardDto.privateTitleId, TITLE_ID);
  assert.equal(cardDto.catalogAnimeId, null);
  assert.equal(cardDto.titleSnapshot, "Frieren");
  assert.equal(assetDto.cardId, CARD_ID);
  assert.equal(assetDto.assetType, "USER_IMAGE");
  assert.equal(assetDto.storageScope, "LOCAL_ONLY");
  assert.equal(assetDto.cloudBucket, null);
  assert.equal(assetDto.cloudObjectPath, null);
  assert.equal("localRef" in assetDto, false);
  assert.equal("previewDataUrl" in assetDto, false);
  assert.equal("sourcePath" in assetDto, false);
  assert.equal("ownerId" in assetDto, false);
});

test("catalog Card requires an exact catalog id before remote sync", () => {
  const anime = { id: TITLE_ID, catalogAnimeId: null, displayTitle: "Frieren", updatedAt: NOW };
  assert.throws(() => toRemoteMemoryCard({
    card: { ...card, privateTitleId: null, animeRefId: TITLE_ID }, title: anime, asset,
  }), { code: "CATALOG_MAPPING_REQUIRED" });
  const dto = toRemoteMemoryCard({
    card: { ...card, privateTitleId: null, animeRefId: TITLE_ID },
    title: { ...anime, catalogAnimeId: "anime:77777777-7777-4777-8777-777777777777" },
    asset,
  });
  assert.equal(dto.catalogAnimeId, "anime:77777777-7777-4777-8777-777777777777");
  assert.equal(dto.privateTitleId, null);
});

test("Card and title payload bounds fail before network use", () => {
  assert.throws(() => toRemotePrivateTitle({ ...privateTitle, optionalGenres: Array(17).fill("Fantasy") }), {
    code: "SYNC_DTO_INVALID",
  });
  assert.throws(() => toRemoteMemoryCard({ card: { ...card, note: "x".repeat(10001) }, title: privateTitle, asset }), {
    code: "SYNC_DTO_INVALID",
  });
  assert.throws(() => toRemoteMemoryCard({ card: { ...card, emotionTags: Array(21).fill("calm") }, title: privateTitle, asset }), {
    code: "SYNC_DTO_INVALID",
  });
  assert.throws(() => toRemoteVisualAsset({ card, title: privateTitle, asset: { ...asset, state: "IMPORTING" } }), {
    code: "SYNC_DTO_INVALID",
  });
});

test("Board DTOs stay private and bounded", () => {
  const board = {
    id: BOARD_ID, ownerId: OWNER_ID, title: "Scenes", description: "Remembered scenes",
    visibility: "PRIVATE", createdAt: NOW, updatedAt: NOW, deletedAt: null, sync,
  };
  const membership = {
    id: MEMBERSHIP_ID, ownerId: OWNER_ID, boardId: BOARD_ID, cardId: CARD_ID,
    positionKey: "h".repeat(24), createdAt: NOW, updatedAt: NOW, deletedAt: null, sync,
  };
  assert.deepEqual(toRemoteBoard(board), {
    id: BOARD_ID, title: "Scenes", description: "Remembered scenes", visibility: "PRIVATE",
    createdAt: NOW, clientUpdatedAt: NOW, deletedAt: null,
  });
  assert.equal(toRemoteBoardCard(membership).positionKey, "h".repeat(24));
  assert.throws(() => toRemoteBoard({ ...board, title: "x".repeat(81) }), { code: "SYNC_DTO_INVALID" });
});

test("mutation hash is stable SHA-256 and payload is bounded", async () => {
  const input = {
    operationId: "88888888-8888-4888-8888-888888888888",
    deviceId: "99999999-9999-4999-8999-999999999999",
    entityType: "MEMORY_CARD",
    entityId: CARD_ID,
    operationType: "UPSERT",
    baseVersion: 0,
    payload: { titleSnapshot: "Frieren", emotionTags: ["calm"] },
  };
  const first = await buildMutationRequest(input);
  const second = await buildMutationRequest({ ...input, payload: { emotionTags: ["calm"], titleSnapshot: "Frieren" } });
  assert.equal(first.requestHash, second.requestHash);
  assert.match(first.requestHash, /^[a-f0-9]{64}$/u);
  await assert.rejects(() => buildMutationRequest({ ...input, payload: { note: "x".repeat(1048577) } }), {
    code: "SYNC_PAYLOAD_TOO_LARGE",
  });
});

test("remote result parsers reject unknown fields, states, and versions", () => {
  assert.deepEqual(parseMutationResult({
    status: "APPLIED", entityVersion: 1, syncSeq: 2, errorCode: null, remoteEntity: { id: CARD_ID },
  }), {
    status: "APPLIED", entityVersion: 1, syncSeq: 2, errorCode: null, remoteEntity: { id: CARD_ID },
  });
  assert.throws(() => parseMutationResult({
    status: "APPLIED", entityVersion: 1, syncSeq: 2, errorCode: null, remoteEntity: null, query: "secret",
  }), { code: "SYNC_RESPONSE_INVALID" });
  assert.throws(() => parseMutationResult({
    status: "UNKNOWN", entityVersion: -1, syncSeq: null, errorCode: null, remoteEntity: null,
  }), { code: "SYNC_RESPONSE_INVALID" });

  assert.deepEqual(parsePullResult({
    changes: [{
      syncSeq: 3, entityType: "MEMORY_CARD", entityId: CARD_ID,
      operationType: "UPSERT", entityVersion: 1, changedAt: NOW,
    }],
    nextSyncSeq: 3, minimumRetainedSyncSeq: 0, requiresFullResync: false,
  }).nextSyncSeq, 3);
  assert.throws(() => parsePullResult({
    changes: [], nextSyncSeq: -1, minimumRetainedSyncSeq: 0, requiresFullResync: false,
  }), { code: "SYNC_RESPONSE_INVALID" });
  assert.throws(() => parsePullResult({
    changes: [{
      syncSeq: 1, entityType: "MEMORY_CARD", entityId: "not-a-uuid",
      operationType: "UPSERT", entityVersion: 1, changedAt: NOW,
    }],
    nextSyncSeq: 1, minimumRetainedSyncSeq: 0, requiresFullResync: false,
  }), { code: "SYNC_RESPONSE_INVALID" });

  assert.deepEqual(parsePromotionResult({
    status: "COMPLETED",
    importedCounts: { privateTitles: 1, cards: 1, visualAssets: 1, boards: 0, boardCards: 0 },
    nextSyncSeq: 3,
  }).status, "COMPLETED");
  assert.throws(() => parsePromotionResult({ status: "FAILED", importedCounts: {}, nextSyncSeq: 0 }), {
    code: "SYNC_RESPONSE_INVALID",
  });
});
