import test from "node:test";
import assert from "node:assert/strict";
import { retirePublicationBeforeDelete } from "../../src/features/memory/application/retirePublicationBeforeDelete.js";
import { createDeleteMemoryCardCommand } from "../../src/features/memory/application/deleteMemoryCard.js";

test("remote withdrawal is awaited, failures preserve original and account changes reject completion", async () => {
  const card = { id: "card", ownerId: "account:A", status: "COMPLETE_PRIVATE", sync: { remoteVersion: 1 } };
  let session = { user: { id: "A" } }, calls = 0;
  const input = { ownerId: card.ownerId, card, getSession: async () => session,
    gateway: { retireCard: async () => { calls++; throw new Error("offline"); } } };
  const command = createDeleteMemoryCardCommand({
    repository: { getOperation: async () => null, getCardBundle: async () => ({ card, asset: { ownerId: card.ownerId, state: "READY" } }),
      planDelete: async () => assert.fail("must preserve original") },
    beforeDelete: () => retirePublicationBeforeDelete(input),
  });
  await assert.rejects(command.execute({ ownerId: card.ownerId, cardId: card.id, operationId: "operation" }), { code: "PUBLICATION_WITHDRAWAL_UNCONFIRMED" });
  assert.equal(calls, 1);
  input.gateway.retireCard = async () => { session = { user: { id: "B" } }; };
  await assert.rejects(retirePublicationBeforeDelete(input), /AUTH_REQUIRED/);
});

test("guest keeps local deletion; account cards with missing sync acknowledgement still require server fence", async () => {
  const input = { card: { id: "card", sync: { remoteVersion: 1 } }, getSession: async () => ({ user: { id: "B" } }),
    gateway: { retireCard: async () => assert.fail("must not call gateway") } };
  await retirePublicationBeforeDelete({ ...input, ownerId: "guest:A" });
  await assert.rejects(retirePublicationBeforeDelete({ ...input, ownerId: "account:A", card: { id: "card" } }), /AUTH_REQUIRED/);
  await assert.rejects(retirePublicationBeforeDelete({ ...input, ownerId: "account:A" }), /AUTH_REQUIRED/);
  let retired = false;
  await retirePublicationBeforeDelete({ ownerId: "account:A", card: { id: "card" }, getSession: async () => ({ user: { id: "A" } }),
    gateway: { retireCard: async () => { retired = true; } } });
  assert.equal(retired, true);
});
