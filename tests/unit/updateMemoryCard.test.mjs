import test from "node:test";
import assert from "node:assert/strict";

import { createUpdateMemoryCardCommand } from "../../src/features/memory/application/updateMemoryCard.js";

const OWNER_A = "guest:11111111-1111-4111-8111-111111111111";
const OWNER_B = "guest:22222222-2222-4222-8222-222222222222";

const bundle = () => ({
  card: {
    id: "card-1",
    ownerId: OWNER_A,
    status: "COMPLETE_PRIVATE",
    note: "old note",
    updatedAt: "2026-08-12T00:00:00.000Z",
  },
  title: { id: "title-1", ownerId: OWNER_A, displayTitle: "Frieren" },
  asset: { id: "asset-1", ownerId: OWNER_A, state: "READY" },
});

test("metadata update is owner-scoped and normalizes the private note", async () => {
  let stored = bundle();
  const events = [];
  const command = createUpdateMemoryCardCommand({
    repository: {
      getCardBundle: async () => structuredClone(stored),
      updateCardMetadata: async ({ cardId, changes, now }) => {
        const card = { ...stored.card, ...changes, id: cardId, updatedAt: now };
        stored = { ...stored, card: structuredClone(card) };
        return card;
      },
    },
    telemetry: { track: (name, properties) => events.push({ name, properties }) },
    clock: { now: () => "2026-08-12T01:00:00.000Z" },
  });

  const updated = await command.execute({ ownerId: OWNER_A, cardId: "card-1", note: "  new memory  " });

  assert.equal(updated.note, "new memory");
  assert.equal(updated.updatedAt, "2026-08-12T01:00:00.000Z");
  assert.deepEqual(events, [{ name: "memory_card_updated", properties: { changedFieldCount: 1 } }]);
  assert.doesNotMatch(JSON.stringify(events), /new memory/);
});

test("metadata update rejects cross-owner and deleted card access", async () => {
  const command = createUpdateMemoryCardCommand({
    repository: {
      getCardBundle: async () => bundle(),
      updateCardMetadata: async () => { throw new Error("must not write"); },
    },
    telemetry: { track: () => {} },
    clock: { now: () => "2026-08-12T01:00:00.000Z" },
  });
  await assert.rejects(
    () => command.execute({ ownerId: OWNER_B, cardId: "card-1", note: "x" }),
    { code: "CARD_NOT_FOUND" },
  );
});
