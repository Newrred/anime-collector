import { stableStringify } from "../../../domain/syncHash.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATALOG_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const ENTITY_TYPES = new Set(["PRIVATE_TITLE", "MEMORY_CARD", "VISUAL_ASSET", "MEMORY_BOARD", "MEMORY_BOARD_CARD"]);
const OPERATION_TYPES = new Set(["UPSERT", "DELETE", "RESOLVE_CONFLICT"]);
const MUTATION_STATES = new Set(["APPLIED", "CONFLICT", "REJECTED"]);
const CARD_STATES = new Set(["DRAFT", "COMPLETE_PRIVATE", "DELETED"]);
const ASSET_STATES = new Set(["READY", "DELETE_PENDING", "DELETED"]);
const PRECISIONS = new Set(["DAY", "MONTH", "YEAR", "UNKNOWN"]);
const RIGHTS = new Set(["UNKNOWN", "USER_ORIGINAL", "LICENSED", "SYSTEM_GENERATED"]);

export class MemorySyncContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MemorySyncContractError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new MemorySyncContractError(code, message);
};

const plainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exactKeys = (value, keys) => {
  if (!plainObject(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) {
    fail("SYNC_RESPONSE_INVALID", "Remote response shape is invalid");
  }
};
const uuid = (value, field = "id") => {
  const normalized = String(value || "").toLowerCase();
  if (!UUID_V4.test(normalized)) fail("SYNC_DTO_INVALID", `${field} is invalid`);
  return normalized;
};
const responseUuid = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (!UUID_V4.test(normalized)) fail("SYNC_RESPONSE_INVALID", "Remote entity id is invalid");
  return normalized;
};
const text = (value, field, { min = 0, max }) => {
  const normalized = String(value ?? "").trim();
  if (normalized.length < min || normalized.length > max) fail("SYNC_DTO_INVALID", `${field} is invalid`);
  return normalized;
};
const nullableText = (value, field, max) => value == null ? null : text(value, field, { max });
const timestamp = (value, field) => {
  const normalized = String(value || "");
  if (!normalized || !Number.isFinite(Date.parse(normalized))) fail("SYNC_DTO_INVALID", `${field} is invalid`);
  return normalized;
};
const nullableTimestamp = (value, field) => value == null ? null : timestamp(value, field);
const boundedTexts = (value, field, maxItems, maxLength) => {
  if (!Array.isArray(value) || value.length > maxItems) fail("SYNC_DTO_INVALID", `${field} is invalid`);
  return value.map((entry) => text(entry, field, { min: 1, max: maxLength }));
};
const nonnegativeInteger = (value, code = "SYNC_RESPONSE_INVALID") => {
  if (!Number.isSafeInteger(value) || value < 0) fail(code, "Remote version is invalid");
  return value;
};
const nullableNonnegativeInteger = (value) => value == null ? null : nonnegativeInteger(value);
const responseTimestamp = (value) => {
  const normalized = String(value || "");
  if (!normalized || !Number.isFinite(Date.parse(normalized))) {
    fail("SYNC_RESPONSE_INVALID", "Remote timestamp is invalid");
  }
  return normalized;
};

const assertJsonValue = (value, depth = 0) => {
  if (depth > 32) fail("SYNC_DTO_INVALID", "JSON payload is too deeply nested");
  if (value == null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => assertJsonValue(entry, depth + 1));
    return;
  }
  if (plainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      if (!key || key.length > 120) fail("SYNC_DTO_INVALID", "JSON payload key is invalid");
      assertJsonValue(entry, depth + 1);
    }
    return;
  }
  fail("SYNC_DTO_INVALID", "Payload must contain JSON values only");
};

const jsonByteLength = (value) => {
  assertJsonValue(value);
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
};

export function toRemotePrivateTitle(entity) {
  if (!plainObject(entity)) fail("SYNC_DTO_INVALID", "Private title is required");
  const displayTitle = text(entity.displayTitle, "displayTitle", { min: 1, max: 120 });
  const normalizedTitle = text(entity.normalizedTitle, "normalizedTitle", { min: 1, max: 160 });
  if (normalizedTitle !== normalizedTitle.toLowerCase()) fail("SYNC_DTO_INVALID", "normalizedTitle is invalid");
  return Object.freeze({
    id: uuid(entity.id),
    displayTitle,
    normalizedTitle,
    optionalGenres: boundedTexts(entity.optionalGenres || [], "optionalGenres", 16, 48),
    createdAt: timestamp(entity.createdAt || entity.updatedAt, "createdAt"),
    clientUpdatedAt: timestamp(entity.updatedAt, "updatedAt"),
    deletedAt: nullableTimestamp(entity.deletedAt, "deletedAt"),
  });
}

export function toRemoteMemoryCard(bundle) {
  if (!plainObject(bundle) || !plainObject(bundle.card) || !plainObject(bundle.title)) {
    fail("SYNC_DTO_INVALID", "Card bundle is required");
  }
  const { card, title: localTitle } = bundle;
  const isPrivateTitle = Boolean(card.privateTitleId);
  const catalogAnimeId = isPrivateTitle ? null : String(localTitle.catalogAnimeId || "").toLowerCase();
  if (!isPrivateTitle && !CATALOG_ID.test(catalogAnimeId)) {
    fail("CATALOG_MAPPING_REQUIRED", "Catalog mapping is required before sync");
  }
  const privateTitleId = isPrivateTitle ? uuid(card.privateTitleId, "privateTitleId") : null;
  if (isPrivateTitle && localTitle.id !== privateTitleId) fail("SYNC_DTO_INVALID", "Card title reference is invalid");
  if ((privateTitleId == null) === (catalogAnimeId == null)) fail("SYNC_DTO_INVALID", "Card title source is invalid");
  if (!CARD_STATES.has(card.status) || !PRECISIONS.has(card.watchedAtPrecision || "UNKNOWN")) {
    fail("SYNC_DTO_INVALID", "Card state is invalid");
  }
  const episode = card.episode == null ? null : Number(card.episode);
  if (episode != null && (!Number.isSafeInteger(episode) || episode < 1)) fail("SYNC_DTO_INVALID", "episode is invalid");
  const watchedAt = card.watchedAt == null ? null : String(card.watchedAt);
  if (watchedAt && !/^\d{4}-\d{2}-\d{2}$/.test(watchedAt)) fail("SYNC_DTO_INVALID", "watchedAt is invalid");
  const deletedAt = nullableTimestamp(card.deletedAt, "deletedAt");
  if ((card.status === "DELETED") !== Boolean(deletedAt)) fail("SYNC_DTO_INVALID", "Card deletion state is invalid");
  return Object.freeze({
    id: uuid(card.id),
    catalogAnimeId,
    privateTitleId,
    titleSnapshot: text(localTitle.displayTitle, "titleSnapshot", { min: 1, max: 120 }),
    status: card.status,
    note: nullableText(card.note, "note", 10000),
    watchedAt,
    watchedAtPrecision: card.watchedAtPrecision || "UNKNOWN",
    episode,
    sceneCue: nullableText(card.sceneCue, "sceneCue", 500),
    emotionTags: boundedTexts(card.emotionTags || [], "emotionTags", 20, 48),
    rewatchIntent: nullableText(card.rewatchIntent, "rewatchIntent", 100),
    visibility: "PRIVATE",
    createdAt: timestamp(card.createdAt || card.updatedAt, "createdAt"),
    clientUpdatedAt: timestamp(card.updatedAt, "updatedAt"),
    deletedAt,
  });
}

export function toRemoteVisualAsset(bundle) {
  if (!plainObject(bundle) || !plainObject(bundle.card) || !plainObject(bundle.asset)) {
    fail("SYNC_DTO_INVALID", "Visual asset bundle is required");
  }
  const { card, asset } = bundle;
  if (!ASSET_STATES.has(asset.state) || asset.storageScope !== "LOCAL_ONLY" || asset.visibility !== "PRIVATE"
    || !RIGHTS.has(asset.rightsBasis)) fail("SYNC_DTO_INVALID", "Visual asset state is invalid");
  const assetType = asset.imageType === "SYSTEM_DESIGN" ? "SYSTEM_DESIGN" : "USER_IMAGE";
  if (assetType === "SYSTEM_DESIGN") {
    if (!plainObject(asset.designSpec) || jsonByteLength(asset.designSpec) > 32768) {
      fail("SYNC_DTO_INVALID", "System design is invalid");
    }
  } else if (asset.designSpec != null) fail("SYNC_DTO_INVALID", "User image cannot contain a system design");
  const checksum = asset.checksumSha256 == null ? null : String(asset.checksumSha256).toLowerCase();
  if (checksum && !HASH.test(checksum)) fail("SYNC_DTO_INVALID", "Asset checksum is invalid");
  const dimensions = [asset.width, asset.height];
  if ((dimensions[0] == null) !== (dimensions[1] == null)
    || dimensions.some((value) => value != null && (!Number.isSafeInteger(value) || value < 1))) {
    fail("SYNC_DTO_INVALID", "Asset dimensions are invalid");
  }
  const byteSize = asset.byteSize == null ? null : Number(asset.byteSize);
  if (byteSize != null && (!Number.isSafeInteger(byteSize) || byteSize < 1)) fail("SYNC_DTO_INVALID", "byteSize is invalid");
  const mimeType = nullableText(asset.mimeType, "mimeType", 255);
  if (mimeType && !/^image\/[A-Za-z0-9.+-]+$/.test(mimeType)) fail("SYNC_DTO_INVALID", "mimeType is invalid");
  const deletedAt = nullableTimestamp(asset.deletedAt, "deletedAt");
  if ((asset.state === "DELETED") !== Boolean(deletedAt)) fail("SYNC_DTO_INVALID", "Asset deletion state is invalid");
  return Object.freeze({
    id: uuid(asset.id),
    cardId: uuid(card.id, "cardId"),
    assetType,
    state: asset.state,
    storageScope: "LOCAL_ONLY",
    visibility: "PRIVATE",
    rightsBasis: asset.rightsBasis,
    checksumSha256: checksum,
    mimeType,
    byteSize,
    width: asset.width ?? null,
    height: asset.height ?? null,
    designSpec: asset.designSpec == null ? null : structuredClone(asset.designSpec),
    cloudBucket: null,
    cloudObjectPath: null,
    isCurrent: Boolean(asset.isCurrent),
    createdAt: timestamp(asset.createdAt || asset.updatedAt, "createdAt"),
    clientUpdatedAt: timestamp(asset.updatedAt, "updatedAt"),
    deletedAt,
  });
}

export function toRemoteBoard(entity) {
  if (!plainObject(entity) || entity.visibility !== "PRIVATE") fail("SYNC_DTO_INVALID", "Board is invalid");
  return Object.freeze({
    id: uuid(entity.id),
    title: text(entity.title, "title", { min: 1, max: 80 }),
    description: text(entity.description || "", "description", { max: 500 }),
    visibility: "PRIVATE",
    createdAt: timestamp(entity.createdAt || entity.updatedAt, "createdAt"),
    clientUpdatedAt: timestamp(entity.updatedAt, "updatedAt"),
    deletedAt: nullableTimestamp(entity.deletedAt, "deletedAt"),
  });
}

export function toRemoteBoardCard(entity) {
  if (!plainObject(entity)) fail("SYNC_DTO_INVALID", "Board membership is invalid");
  return Object.freeze({
    id: uuid(entity.id),
    boardId: uuid(entity.boardId, "boardId"),
    cardId: uuid(entity.cardId, "cardId"),
    positionKey: text(entity.positionKey, "positionKey", { min: 1, max: 128 }),
    createdAt: timestamp(entity.createdAt || entity.updatedAt, "createdAt"),
    clientUpdatedAt: timestamp(entity.updatedAt, "updatedAt"),
    deletedAt: nullableTimestamp(entity.deletedAt, "deletedAt"),
  });
}

export async function buildMutationRequest(input) {
  if (!plainObject(input)) fail("SYNC_REQUEST_INVALID", "Mutation input is required");
  const request = {
    operationId: uuid(input.operationId, "operationId"),
    deviceId: uuid(input.deviceId, "deviceId"),
    entityType: String(input.entityType || ""),
    entityId: uuid(input.entityId, "entityId"),
    operationType: String(input.operationType || ""),
    baseVersion: Number(input.baseVersion),
    payload: structuredClone(input.payload),
  };
  if (!ENTITY_TYPES.has(request.entityType) || !OPERATION_TYPES.has(request.operationType)
    || !Number.isSafeInteger(request.baseVersion) || request.baseVersion < 0) {
    fail("SYNC_REQUEST_INVALID", "Mutation fields are invalid");
  }
  const size = jsonByteLength(request.payload);
  if (size > 1048576) fail("SYNC_PAYLOAD_TOO_LARGE", "Mutation payload exceeds 1 MiB");
  if (!globalThis.crypto?.subtle?.digest) fail("SHA256_UNAVAILABLE", "SHA-256 is required for remote sync");
  const canonical = stableStringify(request);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const requestHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return Object.freeze({ ...request, requestHash });
}

export function parseMutationResult(value) {
  exactKeys(value, ["status", "entityVersion", "syncSeq", "errorCode", "remoteEntity"]);
  if (!MUTATION_STATES.has(value.status)) fail("SYNC_RESPONSE_INVALID", "Mutation status is invalid");
  const result = {
    status: value.status,
    entityVersion: nullableNonnegativeInteger(value.entityVersion),
    syncSeq: nullableNonnegativeInteger(value.syncSeq),
    errorCode: value.errorCode == null ? null : String(value.errorCode),
    remoteEntity: value.remoteEntity == null ? null : structuredClone(value.remoteEntity),
  };
  if (result.errorCode && !/^[A-Z][A-Z0-9_]{0,99}$/.test(result.errorCode)) {
    fail("SYNC_RESPONSE_INVALID", "Mutation error code is invalid");
  }
  try {
    if (jsonByteLength(result.remoteEntity) > 1048576) fail("SYNC_RESPONSE_INVALID", "Remote entity is too large");
  } catch (error) {
    if (error?.code === "SYNC_RESPONSE_INVALID") throw error;
    fail("SYNC_RESPONSE_INVALID", "Remote entity is invalid");
  }
  return Object.freeze(result);
}

export function parsePullResult(value) {
  exactKeys(value, ["changes", "nextSyncSeq", "minimumRetainedSyncSeq", "requiresFullResync"]);
  if (!Array.isArray(value.changes) || value.changes.length > 500 || typeof value.requiresFullResync !== "boolean") {
    fail("SYNC_RESPONSE_INVALID", "Pull result is invalid");
  }
  const changes = value.changes.map((change) => {
    exactKeys(change, ["syncSeq", "entityType", "entityId", "operationType", "entityVersion", "changedAt"]);
    if (!ENTITY_TYPES.has(change.entityType) || !["UPSERT", "DELETE"].includes(change.operationType)) {
      fail("SYNC_RESPONSE_INVALID", "Pull change is invalid");
    }
    return Object.freeze({
      syncSeq: nonnegativeInteger(change.syncSeq),
      entityType: change.entityType,
      entityId: responseUuid(change.entityId),
      operationType: change.operationType,
      entityVersion: nonnegativeInteger(change.entityVersion),
      changedAt: responseTimestamp(change.changedAt),
    });
  });
  const nextSyncSeq = nonnegativeInteger(value.nextSyncSeq);
  const minimumRetainedSyncSeq = nonnegativeInteger(value.minimumRetainedSyncSeq);
  if (changes.some((change) => change.syncSeq > nextSyncSeq)) fail("SYNC_RESPONSE_INVALID", "Pull cursor is invalid");
  return Object.freeze({ changes, nextSyncSeq, minimumRetainedSyncSeq, requiresFullResync: value.requiresFullResync });
}

export function parsePromotionResult(value) {
  exactKeys(value, ["status", "importedCounts", "nextSyncSeq"]);
  if (value.status !== "COMPLETED" || !plainObject(value.importedCounts)) {
    fail("SYNC_RESPONSE_INVALID", "Promotion result is invalid");
  }
  const allowed = ["privateTitles", "cards", "visualAssets", "boards", "boardCards"];
  if (Object.keys(value.importedCounts).some((key) => !allowed.includes(key))) {
    fail("SYNC_RESPONSE_INVALID", "Promotion counts are invalid");
  }
  const importedCounts = {};
  for (const key of allowed) importedCounts[key] = nonnegativeInteger(value.importedCounts[key] ?? 0);
  return Object.freeze({ status: "COMPLETED", importedCounts: Object.freeze(importedCounts), nextSyncSeq: nonnegativeInteger(value.nextSyncSeq) });
}
