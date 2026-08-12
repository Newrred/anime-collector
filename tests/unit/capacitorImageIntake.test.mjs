import test from "node:test";
import assert from "node:assert/strict";
import {
  createCapacitorImageIntake,
  sanitizeLocalMediaResult,
  sanitizeNativeTicket,
} from "../../src/features/memory/adapters/platform/capacitorImageIntake.js";

const safeTicket = {
  ticketId: "ticket-1",
  mimeType: "image/png",
  byteSize: 42,
  width: 1920,
  height: 1080,
  createdAtEpochMs: 123,
  previewDataUrl: "data:image/jpeg;base64,cHJldmlldw==",
  localOnly: true,
};

test("native ticket sanitizer drops private paths, source URIs, and hashes", () => {
  const sanitized = sanitizeNativeTicket({
    ...safeTicket,
    sourceUri: "content://private/source",
    stagedFileName: "ticket-1.original",
    previewFileName: "ticket-1.preview.jpg",
    localPath: "/data/user/0/private",
    checksumSha256: "private-hash",
  });

  assert.deepEqual(sanitized, safeTicket);
  assert.equal("sourceUri" in sanitized, false);
  assert.equal("stagedFileName" in sanitized, false);
  assert.equal("checksumSha256" in sanitized, false);
});

test("adapter normalizes claim, picker cancellation, and discard responses", async () => {
  const calls = [];
  const adapter = createCapacitorImageIntake({
    claimPendingIntake: async () => ({ ticket: safeTicket, processing: false }),
    pickImage: async () => ({ ticket: null, cancelled: true }),
    discardIntake: async ({ ticketId }) => {
      calls.push(ticketId);
      return { removed: true };
    },
  });

  assert.deepEqual(await adapter.claim(), { ticket: safeTicket, processing: false, errorCode: null });
  assert.deepEqual(await adapter.pick(), { ticket: null, cancelled: true });
  assert.equal(await adapter.discard("ticket-1"), true);
  assert.deepEqual(calls, ["ticket-1"]);
});

test("adapter rejects non-JPEG or oversized preview payloads", () => {
  assert.equal(sanitizeNativeTicket({ ...safeTicket, previewDataUrl: "file:///private.jpg" }), null);
  assert.equal(
    sanitizeNativeTicket({ ...safeTicket, previewDataUrl: `data:image/jpeg;base64,${"A".repeat(3_000_001)}` }),
    null
  );
});

test("permanent media result keeps required metadata but drops native paths", () => {
  assert.deepEqual(sanitizeLocalMediaResult({
    localRef: "asset:asset-1",
    checksumSha256: "a".repeat(64),
    mimeType: "image/png",
    byteSize: 42,
    width: 1920,
    height: 1080,
    localOnly: true,
    originalPath: "/data/user/0/private/asset-1.original",
    previewPath: "/data/user/0/private/asset-1.preview.jpg",
  }), {
    localRef: "asset:asset-1",
    checksumSha256: "a".repeat(64),
    mimeType: "image/png",
    byteSize: 42,
    width: 1920,
    height: 1080,
  });

  assert.equal(sanitizeLocalMediaResult({
    localRef: "file:///private/asset-1",
    checksumSha256: "a".repeat(64),
    mimeType: "image/png",
    byteSize: 42,
    width: 1920,
    height: 1080,
    localOnly: true,
  }), null);
});

test("adapter promotes a ticket and requests only a bounded preview by opaque local ref", async () => {
  const calls = [];
  const adapter = createCapacitorImageIntake({
    promoteIntake: async (value) => {
      calls.push(value);
      return {
        localRef: "asset:asset-1",
        checksumSha256: "a".repeat(64),
        mimeType: "image/png",
        byteSize: 42,
        width: 1920,
        height: 1080,
        localOnly: true,
      };
    },
    getAssetPreview: async (value) => {
      calls.push(value);
      return { previewDataUrl: "data:image/jpeg;base64,cHJldmlldw==" };
    },
  });

  assert.equal((await adapter.promoteTicket({
    ticketId: "ticket-1",
    assetId: "asset-1",
    operationId: "operation-1",
  })).localRef, "asset:asset-1");
  assert.equal(await adapter.getPreview("asset:asset-1"), "data:image/jpeg;base64,cHJldmlldw==");
  assert.deepEqual(calls, [
    { ticketId: "ticket-1", assetId: "asset-1", operationId: "operation-1" },
    { localRef: "asset:asset-1" },
  ]);
});

test("adapter deletes only an opaque private media reference", async () => {
  const calls = [];
  const adapter = createCapacitorImageIntake({
    deleteAsset: async (value) => { calls.push(value); return { deleted: true }; },
  });

  assert.equal(await adapter.deleteAsset("asset:asset-1"), true);
  assert.equal(await adapter.deleteAsset("file:///private/asset-1"), false);
  assert.deepEqual(calls, [{ localRef: "asset:asset-1" }]);
});
