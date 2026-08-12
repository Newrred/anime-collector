import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryRuntime } from "../../src/features/memory/runtime/createMemoryRuntime.js";

const OWNER_ID = "guest:11111111-1111-4111-8111-111111111111";

test("runtime initializes one guest owner and scopes create/archive commands to it", async () => {
  const calls = [];
  const repository = {
    ensureGuestOwner: async (value) => {
      calls.push(["owner", value]);
      return { id: OWNER_ID, kind: "GUEST", createdAt: value.now };
    },
    listArchive: async (ownerId) => {
      calls.push(["archive", ownerId]);
      return [{ card: { id: "card-1" } }];
    },
  };
  const command = {
    execute: async (value) => {
      calls.push(["create", value]);
      return { cardId: "card-1" };
    },
  };
  const generated = [
    "11111111-1111-4111-8111-111111111111",
    "operation-1",
  ];
  const runtime = createMemoryRuntime({
    repository,
    imageIntake: { available: true },
    createCommand: command,
    uuid: () => generated.shift(),
    clock: { now: () => "2026-08-12T00:00:00.000Z" },
  });

  assert.equal((await runtime.initialize()).id, OWNER_ID);
  assert.deepEqual(await runtime.createCard({
    titleChoice: { kind: "PRIVATE_TITLE", displayTitle: "Frieren" },
    intakeTicketId: "ticket-1",
    rightsConfirmed: true,
  }), { cardId: "card-1" });
  assert.deepEqual(await runtime.listArchive(), [{ card: { id: "card-1" } }]);
  assert.equal(calls.filter(([name]) => name === "owner").length, 1);
  assert.equal(calls.find(([name]) => name === "create")[1].ownerId, OWNER_ID);
  assert.equal(calls.find(([name]) => name === "create")[1].operationId, "operation-1");
  assert.equal(calls.find(([name]) => name === "archive")[1], OWNER_ID);
});

test("runtime exposes title search without initializing an owner or logging the query", async () => {
  const calls = [];
  const runtime = createMemoryRuntime({
    repository: {
      ensureGuestOwner: async () => { throw new Error("search must not initialize owner"); },
    },
    imageIntake: { available: false },
    createCommand: { execute: async () => ({}) },
    titleResolver: {
      search: async (query) => {
        calls.push(query);
        return { results: [{ displayTitle: "Frieren" }], remoteStatus: "READY" };
      },
    },
    uuid: () => "11111111-1111-4111-8111-111111111111",
    clock: { now: () => "2026-08-12T00:00:00.000Z" },
  });

  assert.deepEqual(await runtime.searchTitles("프리렌"), {
    results: [{ displayTitle: "Frieren" }],
    remoteStatus: "READY",
  });
  assert.deepEqual(calls, ["프리렌"]);
});

test("runtime scopes image replacement to the guest owner and assigns an operation id", async () => {
  const calls = [];
  const refreshedBundle = {
    card: { id: "card-1", visualAssetId: "asset-new" },
    asset: { id: "asset-new", localRef: "asset:asset-new" },
  };
  const generated = [
    "11111111-1111-4111-8111-111111111111",
    "replace-operation-1",
  ];
  const runtime = createMemoryRuntime({
    repository: {
      ensureGuestOwner: async () => ({
        id: OWNER_ID,
        kind: "GUEST",
        createdAt: "2026-08-12T00:00:00.000Z",
      }),
      getCardBundle: async () => refreshedBundle,
    },
    imageIntake: {
      available: true,
      getPreview: async () => "data:image/jpeg;base64,bmV3",
    },
    createCommand: { execute: async () => ({}) },
    replaceCommand: {
      execute: async (value) => {
        calls.push(value);
        return { cardId: value.cardId, cleanupPending: false };
      },
    },
    uuid: () => generated.shift(),
    clock: { now: () => "2026-08-12T00:00:00.000Z" },
  });

  assert.deepEqual(await runtime.replaceCardImage("card-1", {
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
  }), {
    cardId: "card-1",
    cleanupPending: false,
    bundle: refreshedBundle,
    previewDataUrl: "data:image/jpeg;base64,bmV3",
    refreshPending: false,
  });
  assert.deepEqual(calls, [{
    ownerId: OWNER_ID,
    cardId: "card-1",
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
    operationId: "replace-operation-1",
  }]);
});

test("runtime preserves a committed replacement result when detail refresh fails", async () => {
  const runtime = createMemoryRuntime({
    repository: {
      ensureGuestOwner: async () => ({ id: OWNER_ID, kind: "GUEST" }),
      getCardBundle: async () => { throw new Error("transient IndexedDB read failure"); },
    },
    imageIntake: { available: true },
    createCommand: { execute: async () => ({}) },
    replaceCommand: {
      execute: async () => ({ cardId: "card-1", cleanupPending: false }),
    },
    uuid: (() => {
      const generated = ["11111111-1111-4111-8111-111111111111", "replace-operation-1"];
      return () => generated.shift();
    })(),
    clock: { now: () => "2026-08-12T00:00:00.000Z" },
  });

  assert.deepEqual(await runtime.replaceCardImage("card-1", {
    intakeTicketId: "ticket-new",
    rightsConfirmed: true,
  }), {
    cardId: "card-1",
    cleanupPending: false,
    bundle: null,
    previewDataUrl: null,
    refreshPending: true,
  });
});
