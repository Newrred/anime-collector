import assert from "node:assert/strict";
import test from "node:test";

import { SupabaseMemoryGateway } from "../../src/features/memory/adapters/supabase/SupabaseMemoryGateway.js";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";
const ENTITY_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_HASH = "a".repeat(64);
const mutationResult = { status: "APPLIED", entityVersion: 1, syncSeq: 1, errorCode: null, remoteEntity: null };

const createClient = ({ rpcResult = { data: mutationResult, error: null }, rows = [] } = {}) => {
  const calls = [];
  const client = {
    async rpc(name, parameters) {
      calls.push(["rpc", name, parameters]);
      return typeof rpcResult === "function" ? rpcResult(name, parameters) : rpcResult;
    },
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          const query = {
            async in(column, values) {
              calls.push(["in", column, values]);
              return { data: rows, error: null };
            },
            eq(column, value) { calls.push(["eq", column, value]); return query; },
            order(column, options) { calls.push(["order", column, options]); return query; },
            async range(from, to) { calls.push(["range", from, to]); return { data: rows, error: null }; },
          };
          return query;
        },
      };
    },
  };
  return { client, calls };
};

test("gateway rejects an incomplete Supabase client", () => {
  assert.throws(() => new SupabaseMemoryGateway({ rpc() {} }), { code: "SUPABASE_CLIENT_INVALID" });
});

test("gateway calls the exact account and device RPC contracts", async () => {
  const { client, calls } = createClient({
    rpcResult: (name) => ({
      data: name === "ensure_user_profile"
        ? { userId: USER_ID, displayName: "MOEMOA", locale: "ko", timeZone: "Asia/Seoul", minimumRetainedSyncSeq: 0 }
        : { id: DEVICE_ID, installationId: ENTITY_ID, platform: "WEB", appVersion: "1.0.0", lastSyncSeq: 0 },
      error: null,
    }),
  });
  const gateway = new SupabaseMemoryGateway(client);
  await gateway.ensureUserProfile({ displayName: "MOEMOA", locale: "ko", timeZone: "Asia/Seoul" });
  await gateway.registerDevice({ deviceId: DEVICE_ID, installationId: ENTITY_ID, platform: "WEB", appVersion: "1.0.0" });
  assert.deepEqual(calls[0], ["rpc", "ensure_user_profile", {
    p_display_name: "MOEMOA", p_locale: "ko", p_time_zone: "Asia/Seoul",
  }]);
  assert.deepEqual(calls[1], ["rpc", "register_user_device", {
    p_device_id: DEVICE_ID, p_installation_id: ENTITY_ID, p_platform: "WEB", p_app_version: "1.0.0",
  }]);
});

test("gateway calls exact mutation, pull, conflict, and promotion RPCs", async () => {
  const { client, calls } = createClient({
    rpcResult: (name) => ({
      data: name === "pull_memory_changes"
        ? { changes: [], nextSyncSeq: 4, minimumRetainedSyncSeq: 0, requiresFullResync: false }
        : name === "promote_guest_memory"
          ? { status: "COMPLETED", importedCounts: {}, nextSyncSeq: 4 }
          : mutationResult,
      error: null,
    }),
  });
  const gateway = new SupabaseMemoryGateway(client);
  const request = {
    operationId: OPERATION_ID, deviceId: DEVICE_ID, entityType: "MEMORY_CARD",
    entityId: ENTITY_ID, operationType: "UPSERT", baseVersion: 0,
    requestHash: REQUEST_HASH, payload: { titleSnapshot: "Frieren" },
  };
  await gateway.applyCardMutation(request);
  await gateway.applyBoardMutation({ ...request, entityType: "MEMORY_BOARD" });
  await gateway.resolveConflict({ ...request, operationType: "RESOLVE_CONFLICT" });
  await gateway.pullChanges({ afterSeq: 0, limit: 200 });
  await gateway.promoteGuest({
    operationId: OPERATION_ID, deviceId: DEVICE_ID,
    guestOwnerId: "guest:55555555-5555-4555-8555-555555555555",
    sourceHash: REQUEST_HASH, bundle: { privateTitles: [], cards: [], visualAssets: [], boards: [], boardCards: [] },
  });
  assert.deepEqual(calls[0], ["rpc", "apply_memory_card_mutation", {
    p_operation_id: OPERATION_ID, p_device_id: DEVICE_ID, p_entity_type: "MEMORY_CARD",
    p_entity_id: ENTITY_ID, p_operation_type: "UPSERT", p_base_version: 0,
    p_request_hash: REQUEST_HASH, p_payload: { titleSnapshot: "Frieren" },
  }]);
  assert.equal(calls[1][1], "apply_board_mutation");
  assert.deepEqual(calls[2], ["rpc", "resolve_memory_conflict", {
    p_operation_id: OPERATION_ID, p_device_id: DEVICE_ID, p_entity_type: "MEMORY_CARD",
    p_entity_id: ENTITY_ID, p_base_version: 0, p_request_hash: REQUEST_HASH,
    p_payload: { titleSnapshot: "Frieren" },
  }]);
  assert.deepEqual(calls[3], ["rpc", "pull_memory_changes", { p_after_seq: 0, p_limit: 200 }]);
  assert.equal(calls[4][1], "promote_guest_memory");
});

test("readEntities uses an allowlisted table and rejects foreign or unknown rows", async () => {
  const row = {
    id: ENTITY_ID, user_id: USER_ID, catalog_anime_id: "anime:66666666-6666-4666-8666-666666666666",
    private_title_id: null, title_snapshot: "Frieren", status: "COMPLETE_PRIVATE", note: null,
    watched_at: null, watched_at_precision: "UNKNOWN", episode: null, scene_cue: null,
    emotion_tags: [], rewatch_intent: null, visibility: "PRIVATE", version: 1,
    created_at: "2026-09-02T00:00:00.000Z", client_updated_at: "2026-09-02T00:00:00.000Z",
    server_updated_at: "2026-09-02T00:00:01.000Z", deleted_at: null,
  };
  const { client, calls } = createClient({ rows: [row] });
  const gateway = new SupabaseMemoryGateway(client);
  const result = await gateway.readEntities({ entityType: "MEMORY_CARD", entityIds: [ENTITY_ID], userId: USER_ID });
  assert.equal(calls[0][1], "memory_cards");
  assert.deepEqual(calls.at(-1), ["in", "id", [ENTITY_ID]]);
  assert.equal(result[0].titleSnapshot, "Frieren");
  const all = await gateway.readAllEntities({ entityType: "MEMORY_CARD", userId: USER_ID, limit: 200 });
  assert.equal(all[0].id, ENTITY_ID);
  assert.deepEqual(calls.slice(-3), [
    ["eq", "user_id", USER_ID],
    ["order", "id", { ascending: true }],
    ["range", 0, 199],
  ]);

  const foreign = createClient({ rows: [{ ...row, user_id: "77777777-7777-4777-8777-777777777777" }] });
  await assert.rejects(
    () => new SupabaseMemoryGateway(foreign.client).readEntities({ entityType: "MEMORY_CARD", entityIds: [ENTITY_ID], userId: USER_ID }),
    { code: "SYNC_RESPONSE_INVALID" },
  );
  await assert.rejects(
    () => gateway.readEntities({ entityType: "UNKNOWN", entityIds: [ENTITY_ID], userId: USER_ID }),
    { code: "SYNC_REQUEST_INVALID" },
  );
});

test("gateway exposes only allowlisted error codes and never raw Postgres text", async () => {
  const { client } = createClient({
    rpcResult: {
      data: null,
      error: {
        code: "P0001",
        message: "DEVICE_NOT_REGISTERED: select * from private.secret where payload='private note'",
        details: "private note",
        hint: "select private.secret",
      },
    },
  });
  const gateway = new SupabaseMemoryGateway(client);
  await assert.rejects(
    () => gateway.applyCardMutation({
      operationId: OPERATION_ID, deviceId: DEVICE_ID, entityType: "MEMORY_CARD",
      entityId: ENTITY_ID, operationType: "UPSERT", baseVersion: 0,
      requestHash: REQUEST_HASH, payload: { note: "private note" },
    }),
    (error) => {
      assert.equal(error.code, "DEVICE_NOT_REGISTERED");
      assert.equal(error.message.includes("private note"), false);
      assert.equal(error.message.includes("select"), false);
      assert.equal("details" in error, false);
      return true;
    },
  );
});
