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
