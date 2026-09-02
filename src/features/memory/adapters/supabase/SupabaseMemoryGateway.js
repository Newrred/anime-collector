import {
  parseMutationResult,
  parsePromotionResult,
  parsePullResult,
} from "../../sync/memorySyncContract.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const MEMORY_TYPES = new Set(["PRIVATE_TITLE", "MEMORY_CARD", "VISUAL_ASSET"]);
const BOARD_TYPES = new Set(["MEMORY_BOARD", "MEMORY_BOARD_CARD"]);
const ALL_TYPES = new Set([...MEMORY_TYPES, ...BOARD_TYPES]);
const ALLOWED_REMOTE_ERRORS = new Set([
  "AUTH_REQUIRED",
  "DEVICE_NOT_REGISTERED",
  "DEVICE_PAYLOAD_INVALID",
  "DEVICE_OWNERSHIP_CONFLICT",
  "PROMOTION_PAYLOAD_INVALID",
  "PROMOTION_BUNDLE_TOO_LARGE",
  "PROMOTION_BUNDLE_LIMIT_EXCEEDED",
  "PROMOTION_SOURCE_HASH_MISMATCH",
  "PROMOTION_OPERATION_ID_CONFLICT",
  "SYNC_PULL_INVALID",
  "FOREIGN_OWNER_REFERENCE",
  "OPERATION_ID_CONFLICT",
  "OPERATION_HASH_MISMATCH",
]);

const READ_MODELS = Object.freeze({
  PRIVATE_TITLE: {
    table: "memory_private_titles",
    columns: ["id", "user_id", "display_title", "normalized_title", "optional_genres", "version", "created_at", "client_updated_at", "server_updated_at", "deleted_at"],
  },
  MEMORY_CARD: {
    table: "memory_cards",
    columns: ["id", "user_id", "catalog_anime_id", "private_title_id", "title_snapshot", "status", "note", "watched_at", "watched_at_precision", "episode", "scene_cue", "emotion_tags", "rewatch_intent", "visibility", "version", "created_at", "client_updated_at", "server_updated_at", "deleted_at"],
  },
  VISUAL_ASSET: {
    table: "memory_visual_assets",
    columns: ["id", "user_id", "card_id", "asset_type", "state", "storage_scope", "visibility", "rights_basis", "checksum_sha256", "mime_type", "byte_size", "width", "height", "design_spec", "cloud_bucket", "cloud_object_path", "is_current", "version", "created_at", "client_updated_at", "server_updated_at", "deleted_at"],
  },
  MEMORY_BOARD: {
    table: "memory_boards",
    columns: ["id", "user_id", "title", "description", "visibility", "version", "created_at", "client_updated_at", "server_updated_at", "deleted_at"],
  },
  MEMORY_BOARD_CARD: {
    table: "memory_board_cards",
    columns: ["id", "user_id", "board_id", "card_id", "position_key", "version", "created_at", "client_updated_at", "server_updated_at", "deleted_at"],
  },
});

export class SupabaseMemoryGatewayError extends Error {
  constructor(code, message = "Memory metadata request failed") {
    super(message);
    this.name = "SupabaseMemoryGatewayError";
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new SupabaseMemoryGatewayError(code, message);
};
const plainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exactKeys = (value, keys) => {
  if (!plainObject(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) {
    fail("SYNC_RESPONSE_INVALID", "Memory metadata response was invalid");
  }
};
const uuid = (value, field = "id") => {
  const normalized = String(value || "").toLowerCase();
  if (!UUID_V4.test(normalized)) fail("SYNC_REQUEST_INVALID", `${field} is invalid`);
  return normalized;
};
const responseUuid = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (!UUID_V4.test(normalized)) fail("SYNC_RESPONSE_INVALID", "Remote entity id is invalid");
  return normalized;
};
const safeInteger = (value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    fail("SYNC_REQUEST_INVALID", "Numeric request field is invalid");
  }
  return normalized;
};
const boundedText = (value, field, { min = 1, max = 200 } = {}) => {
  const normalized = String(value ?? "").trim();
  if (normalized.length < min || normalized.length > max) fail("SYNC_REQUEST_INVALID", `${field} is invalid`);
  return normalized;
};
const timestamp = (value) => {
  const normalized = String(value || "");
  if (!Number.isFinite(Date.parse(normalized))) fail("SYNC_RESPONSE_INVALID", "Remote timestamp is invalid");
  return normalized;
};

const sanitizeRemoteError = (error) => {
  const message = String(error?.message || "");
  const code = [...ALLOWED_REMOTE_ERRORS].find((candidate) => (
    new RegExp(`(?:^|[^A-Z0-9_])${candidate}(?:$|[^A-Z0-9_])`).test(message)
  )) || "MEMORY_GATEWAY_FAILED";
  return new SupabaseMemoryGatewayError(code);
};

const validateMutationRequest = (input, family) => {
  if (!plainObject(input)) fail("SYNC_REQUEST_INVALID", "Mutation request is required");
  const entityType = String(input.entityType || "");
  if (!family.has(entityType) || !["UPSERT", "DELETE", "RESOLVE_CONFLICT"].includes(input.operationType)
    || !HASH.test(String(input.requestHash || "")) || !plainObject(input.payload)) {
    fail("SYNC_REQUEST_INVALID", "Mutation request is invalid");
  }
  let payload;
  try {
    payload = structuredClone(input.payload);
    const serialized = JSON.stringify(payload);
    if (serialized === undefined || new TextEncoder().encode(serialized).byteLength > 1048576) {
      fail("SYNC_REQUEST_INVALID", "Mutation payload is invalid");
    }
  } catch (error) {
    if (error?.code === "SYNC_REQUEST_INVALID") throw error;
    fail("SYNC_REQUEST_INVALID", "Mutation payload is invalid");
  }
  return {
    operationId: uuid(input.operationId, "operationId"),
    deviceId: uuid(input.deviceId, "deviceId"),
    entityType,
    entityId: uuid(input.entityId, "entityId"),
    operationType: input.operationType,
    baseVersion: safeInteger(input.baseVersion),
    requestHash: String(input.requestHash),
    payload,
  };
};

const mutationParameters = (request) => ({
  p_operation_id: request.operationId,
  p_device_id: request.deviceId,
  p_entity_type: request.entityType,
  p_entity_id: request.entityId,
  p_operation_type: request.operationType,
  p_base_version: request.baseVersion,
  p_request_hash: request.requestHash,
  p_payload: request.payload,
});

const parseProfile = (value) => {
  exactKeys(value, ["userId", "displayName", "locale", "timeZone", "minimumRetainedSyncSeq"]);
  return Object.freeze({
    userId: uuid(value.userId, "userId"),
    displayName: boundedText(value.displayName, "displayName", { max: 80 }),
    locale: boundedText(value.locale, "locale", { max: 16 }),
    timeZone: boundedText(value.timeZone, "timeZone", { max: 64 }),
    minimumRetainedSyncSeq: safeInteger(value.minimumRetainedSyncSeq),
  });
};

const parseDevice = (value) => {
  exactKeys(value, ["id", "installationId", "platform", "appVersion", "lastSyncSeq"]);
  if (!["WEB", "ANDROID"].includes(value.platform)) fail("SYNC_RESPONSE_INVALID", "Device response is invalid");
  return Object.freeze({
    id: uuid(value.id),
    installationId: uuid(value.installationId, "installationId"),
    platform: value.platform,
    appVersion: boundedText(value.appVersion, "appVersion", { max: 100 }),
    lastSyncSeq: safeInteger(value.lastSyncSeq),
  });
};

const snakeToCamel = (key) => key.replace(/_([a-z])/g, (_, character) => character.toUpperCase());
const parseEntityRow = (entityType, model, row, userId) => {
  exactKeys(row, model.columns);
  if (responseUuid(row.user_id) !== userId) fail("SYNC_RESPONSE_INVALID", "Foreign Memory row was rejected");
  if (!Number.isSafeInteger(Number(row.version)) || Number(row.version) < 1) {
    fail("SYNC_RESPONSE_INVALID", "Remote entity version is invalid");
  }
  const mapped = { entityType };
  for (const column of model.columns) mapped[snakeToCamel(column)] = structuredClone(row[column]);
  mapped.id = responseUuid(row.id);
  mapped.userId = userId;
  mapped.version = Number(row.version);
  mapped.createdAt = timestamp(row.created_at);
  mapped.clientUpdatedAt = timestamp(row.client_updated_at);
  mapped.serverUpdatedAt = timestamp(row.server_updated_at);
  mapped.deletedAt = row.deleted_at == null ? null : timestamp(row.deleted_at);
  if (entityType === "PRIVATE_TITLE") {
    if (typeof row.display_title !== "string" || row.display_title.trim().length < 1 || row.display_title.trim().length > 120
      || typeof row.normalized_title !== "string" || row.normalized_title !== row.normalized_title.trim().toLowerCase()
      || row.normalized_title.length > 160 || !Array.isArray(row.optional_genres) || row.optional_genres.length > 16
      || row.optional_genres.some((genre) => typeof genre !== "string" || genre.length > 48)) {
      fail("SYNC_RESPONSE_INVALID", "Remote private title is invalid");
    }
  } else if (entityType === "MEMORY_CARD") {
    const hasCatalog = typeof row.catalog_anime_id === "string" && row.catalog_anime_id.length > 0;
    const hasPrivateTitle = row.private_title_id != null;
    if (hasCatalog === hasPrivateTitle || (hasPrivateTitle && !UUID_V4.test(String(row.private_title_id)))
      || !["DRAFT", "COMPLETE_PRIVATE", "DELETED"].includes(row.status)
      || !["DAY", "MONTH", "YEAR", "UNKNOWN"].includes(row.watched_at_precision)
      || row.visibility !== "PRIVATE" || typeof row.title_snapshot !== "string"
      || row.title_snapshot.trim().length < 1 || row.title_snapshot.trim().length > 120
      || !Array.isArray(row.emotion_tags) || row.emotion_tags.length > 20) {
      fail("SYNC_RESPONSE_INVALID", "Remote Card is invalid");
    }
  } else if (entityType === "VISUAL_ASSET") {
    const isSystem = row.asset_type === "SYSTEM_DESIGN";
    if (!["USER_IMAGE", "SYSTEM_DESIGN"].includes(row.asset_type)
      || !["READY", "DELETE_PENDING", "DELETED"].includes(row.state)
      || row.storage_scope !== "LOCAL_ONLY" || row.visibility !== "PRIVATE"
      || row.cloud_bucket != null || row.cloud_object_path != null || !UUID_V4.test(String(row.card_id))
      || (isSystem ? !plainObject(row.design_spec) : row.design_spec != null)) {
      fail("SYNC_RESPONSE_INVALID", "Remote visual asset is invalid");
    }
  } else if (entityType === "MEMORY_BOARD") {
    if (typeof row.title !== "string" || row.title.trim().length < 1 || row.title.trim().length > 80
      || typeof row.description !== "string" || row.description.length > 500 || row.visibility !== "PRIVATE") {
      fail("SYNC_RESPONSE_INVALID", "Remote Board is invalid");
    }
  } else if (entityType === "MEMORY_BOARD_CARD") {
    if (!UUID_V4.test(String(row.board_id)) || !UUID_V4.test(String(row.card_id))
      || typeof row.position_key !== "string" || row.position_key.length < 1 || row.position_key.length > 128) {
      fail("SYNC_RESPONSE_INVALID", "Remote Board membership is invalid");
    }
  }
  return Object.freeze(mapped);
};

export class SupabaseMemoryGateway {
  constructor(client) {
    if (!client || typeof client.rpc !== "function" || typeof client.from !== "function") {
      fail("SUPABASE_CLIENT_INVALID", "A Supabase Auth client is required");
    }
    this.client = client;
  }

  async rpc(name, parameters, parser) {
    let response;
    try {
      response = await this.client.rpc(name, parameters);
    } catch (error) {
      throw sanitizeRemoteError(error);
    }
    if (response?.error) throw sanitizeRemoteError(response.error);
    try {
      return parser(response?.data);
    } catch (error) {
      if (error?.code === "SYNC_RESPONSE_INVALID") throw error;
      throw new SupabaseMemoryGatewayError("SYNC_RESPONSE_INVALID", "Memory metadata response was invalid");
    }
  }

  ensureUserProfile(input = {}) {
    const parameters = {
      p_display_name: input.displayName == null ? null : boundedText(input.displayName, "displayName", { max: 80 }),
      p_locale: boundedText(input.locale || "en", "locale", { max: 16 }),
      p_time_zone: boundedText(input.timeZone || "UTC", "timeZone", { max: 64 }),
    };
    return this.rpc("ensure_user_profile", parameters, parseProfile);
  }

  registerDevice(input = {}) {
    const platform = String(input.platform || "");
    if (!["WEB", "ANDROID"].includes(platform)) fail("SYNC_REQUEST_INVALID", "platform is invalid");
    return this.rpc("register_user_device", {
      p_device_id: uuid(input.deviceId, "deviceId"),
      p_installation_id: uuid(input.installationId, "installationId"),
      p_platform: platform,
      p_app_version: boundedText(input.appVersion, "appVersion", { max: 100 }),
    }, parseDevice);
  }

  promoteGuest(input = {}) {
    const guestOwnerId = String(input.guestOwnerId || "").toLowerCase();
    if (!/^guest:[0-9a-f-]{36}$/.test(guestOwnerId) || !HASH.test(String(input.sourceHash || ""))
      || !plainObject(input.bundle)) fail("SYNC_REQUEST_INVALID", "Promotion request is invalid");
    const limits = { privateTitles: 250, cards: 500, visualAssets: 500, boards: 100, boardCards: 2000 };
    if (Object.keys(input.bundle).some((key) => !Object.hasOwn(limits, key))
      || Object.entries(limits).some(([key, limit]) => !Array.isArray(input.bundle[key] || []) || (input.bundle[key] || []).length > limit)) {
      fail("SYNC_REQUEST_INVALID", "Promotion bundle is invalid");
    }
    let bundleText;
    try {
      bundleText = JSON.stringify(input.bundle);
    } catch {
      fail("SYNC_REQUEST_INVALID", "Promotion bundle is invalid");
    }
    if (new TextEncoder().encode(bundleText).byteLength > 2097152) {
      fail("SYNC_REQUEST_INVALID", "Promotion bundle is too large");
    }
    return this.rpc("promote_guest_memory", {
      p_operation_id: uuid(input.operationId, "operationId"),
      p_device_id: uuid(input.deviceId, "deviceId"),
      p_guest_owner_id: guestOwnerId,
      p_source_hash: String(input.sourceHash),
      p_bundle: structuredClone(input.bundle),
    }, parsePromotionResult);
  }

  applyCardMutation(input) {
    const request = validateMutationRequest(input, MEMORY_TYPES);
    return this.rpc("apply_memory_card_mutation", mutationParameters(request), parseMutationResult);
  }

  applyBoardMutation(input) {
    const request = validateMutationRequest(input, BOARD_TYPES);
    return this.rpc("apply_board_mutation", mutationParameters(request), parseMutationResult);
  }

  resolveConflict(input) {
    const request = validateMutationRequest(input, ALL_TYPES);
    return this.rpc("resolve_memory_conflict", {
      p_operation_id: request.operationId,
      p_device_id: request.deviceId,
      p_entity_type: request.entityType,
      p_entity_id: request.entityId,
      p_base_version: request.baseVersion,
      p_request_hash: request.requestHash,
      p_payload: request.payload,
    }, parseMutationResult);
  }

  pullChanges({ afterSeq = 0, limit = 200 } = {}) {
    return this.rpc("pull_memory_changes", {
      p_after_seq: safeInteger(afterSeq),
      p_limit: safeInteger(limit, { min: 1, max: 500 }),
    }, parsePullResult);
  }

  async readEntities({ entityType, entityIds, userId }) {
    const model = READ_MODELS[entityType];
    if (!model || !Array.isArray(entityIds) || entityIds.length < 1 || entityIds.length > 200) {
      fail("SYNC_REQUEST_INVALID", "Entity read request is invalid");
    }
    const validUserId = uuid(userId, "userId");
    const ids = [...new Set(entityIds.map((id) => uuid(id)))];
    let response;
    try {
      response = await this.client.from(model.table).select(model.columns.join(",")).in("id", ids);
    } catch (error) {
      throw sanitizeRemoteError(error);
    }
    if (response?.error) throw sanitizeRemoteError(response.error);
    if (!Array.isArray(response?.data) || response.data.length > ids.length) {
      fail("SYNC_RESPONSE_INVALID", "Entity read response is invalid");
    }
    return response.data.map((row) => parseEntityRow(entityType, model, row, validUserId));
  }

  async readAllEntities({ entityType, userId, limit = 5000 }) {
    const model = READ_MODELS[entityType];
    const validUserId = uuid(userId, "userId");
    const maximum = safeInteger(limit, { min: 1, max: 5000 });
    if (!model) fail("SYNC_REQUEST_INVALID", "Entity read request is invalid");
    const rows = [];
    const pageSize = 200;
    for (let offset = 0; offset < maximum; offset += pageSize) {
      let response;
      try {
        response = await this.client
          .from(model.table)
          .select(model.columns.join(","))
          .eq("user_id", validUserId)
          .order("id", { ascending: true })
          .range(offset, Math.min(offset + pageSize - 1, maximum - 1));
      } catch (error) {
        throw sanitizeRemoteError(error);
      }
      if (response?.error) throw sanitizeRemoteError(response.error);
      if (!Array.isArray(response?.data) || response.data.length > pageSize) {
        fail("SYNC_RESPONSE_INVALID", "Entity read response is invalid");
      }
      rows.push(...response.data.map((row) => parseEntityRow(entityType, model, row, validUserId)));
      if (response.data.length < pageSize) return rows;
    }
    fail("SYNC_FULL_RESYNC_LIMIT", "Full Memory resync exceeded its local bound");
  }
}
