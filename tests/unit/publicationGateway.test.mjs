import assert from "node:assert/strict";
import test from "node:test";
import { SupabasePublicationGateway } from "../../src/features/memory/adapters/supabase/SupabasePublicationGateway.js";

function harness(response = { data: null, error: null }) {
  const calls = [];
  const client = { rpc(name, args) {
    const call = { name, args }; calls.push(call);
    const result = Promise.resolve(response);
    result.abortSignal = (signal) => { call.signal = signal; return result; };
    return result;
  } };
  return { gateway: new SupabasePublicationGateway(client), calls };
}

test("publication preparation transmits selection only, never private bundles or spoofed owner", async () => {
  const { gateway, calls } = harness();
  await gateway.prepare({ boardId: "board", expectedRevision: 0, title: "Explicit", description: "",
    userId: "spoof", privateCount: 500, cards: [{ cardId: "card", fields: ["note"], note: "PRIVATE", localRef: "file:///private" }] });
  assert.deepEqual(calls[0], { name: "prepare_memory_publication", args: {
    p_board_id: "board", p_expected_revision: 0,
    p_selection: { title: "Explicit", description: "", cards: [{ cardId: "card", fields: ["note"] }] },
  } });
});

test("publication commit preserves the exact reviewed revision, consent and retry identity", async () => {
  const { gateway, calls } = harness({ data: { state: "PUBLISHED", revision: 2 } });
  const review = { id: "public", expectedRevision: 1, reviewHash: "hash", policyRevision: "policy", operationId: "op" };
  assert.equal((await gateway.publish(review)).state, "PUBLISHED");
  await gateway.publish(review);
  assert.deepEqual(calls[0], calls[1]);
  assert.deepEqual(calls[0].args, { p_id: "public", p_expected_revision: 1, p_review_hash: "hash", p_policy_revision: "policy", p_operation_id: "op" });
});

test("publication retrieval distinguishes unavailable from network failure without leaking payloads", async () => {
  assert.equal(await harness().gateway.read("public"), null);
  const { gateway } = harness({ error: { message: "private note and credential in upstream detail" } });
  await assert.rejects(gateway.read("public"), { message: "PUBLICATION_REQUEST_FAILED", code: "PUBLICATION_REQUEST_FAILED" });
  await assert.rejects(harness({ error: { message: "PREVIEW_CHANGED" } }).gateway.read("public"), { code: "PREVIEW_CHANGED" });
});

test("publication revocation and owner recovery are separate RPCs and forward cancellation", async () => {
  const { gateway, calls } = harness();
  const signal = new AbortController().signal;
  await gateway.get("board");
  await gateway.revoke({ id: "public", expectedRevision: 2 }, { signal });
  await gateway.revokeCard("card");
  await gateway.retireCard("card", { signal });
  assert.deepEqual(calls.map(x => x.name), ["get_memory_publication", "revoke_memory_publication", "revoke_memory_card_publications", "retire_memory_card_publications"]);
  assert.equal(calls[3].signal, signal);
  assert.deepEqual(calls[1].args, { p_id: "public", p_expected_revision: 2 });
  assert.equal(calls[1].signal, signal);
});

test("publication transport failures expose only safe error codes", async () => {
  const gateway = new SupabasePublicationGateway({ rpc() { throw new Error("secret transport detail"); } });
  await assert.rejects(gateway.read("id"), { code: "PUBLICATION_REQUEST_FAILED" });
  await assert.rejects(gateway.read("id", { signal: AbortSignal.abort() }), { code: "REQUEST_ABORTED" });
  await assert.rejects(harness({ status: 429, error: { message: "rate limit detail" } }).gateway.read("id"), { code: "RATE_LIMITED" });
  await assert.rejects(harness({ error: { message: "abort detail" } }).gateway.read("id", { signal: AbortSignal.abort() }), { code: "REQUEST_ABORTED" });
});
