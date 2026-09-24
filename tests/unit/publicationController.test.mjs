import assert from "node:assert/strict";
import test from "node:test";
import { createPublicationController } from "../../src/features/memory/application/createPublicationController.js";
import { publicationSnapshot, publicationReview } from "../../src/features/memory/domain/publicationView.js";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const error = (code) => Object.assign(new Error(code), { code });
const sync = () => ({ syncState: "SYNCED", remoteVersion: 1 });
const selection = { title: "Public title", description: "", cards: [{ cardId: id(2), fields: ["note"] }] };
const snapshot = () => ({ schemaVersion: 1, title: "Public title", description: "", cards: [{ id: id(4), title: "Memory",
  note: "Selected note", visual: { type: "SYSTEM_DESIGN", rendererVersion: 1, patternToken: "aabbccdd" } }] });
const review = () => ({ id: id(3), revision: 1, policyRevision: "test-policy", reviewHash: "a".repeat(64), snapshot: snapshot() });
function harness(overrides = {}) {
  const calls = [];
  let session = { user: { id: id(1) }, access_token: "test-only" };
  const detail = { board: { id: id(5), ownerId: `account:${id(1)}`, sync: sync() }, items: [{ membership: { sync: sync() },
    bundle: { card: { id: id(2), sync: sync() }, asset: { id: id(6), sync: sync() } } }] };
  const gateway = {
    async get() { return null; }, async prepare(input) { calls.push(["prepare", input]); return review(); },
    async publish(input) { calls.push(["publish", input]); return { id: id(3), revision: 2, state: "PUBLISHED" }; },
    async revoke(input) { calls.push(["revoke", input]); return { id: id(3), revision: 3, state: "REVOKED" }; },
    ...overrides,
  };
  const controller = createPublicationController({ boardId: id(5), ownerId: `account:${id(1)}`, gateway,
    getSession: async () => session, getBoard: async () => structuredClone(detail), uuid: () => id(7) });
  return { controller, gateway, detail, calls, session: (value) => { session = value; } };
}
test("public DTO renderer drops private extras and rejects unusable or duplicate visuals", () => {
  const input = snapshot();
  input.privateCount = 99; input.cards[0].localRef = "private:file";
  input.cards[0].visual.seed = "private seed";
  input.cards[0].rewatchIntent = "YES";
  const result = publicationSnapshot(input);
  assert.equal(result.privateCount, undefined); assert.equal(result.cards[0].localRef, undefined);
  assert.equal(result.cards[0].visual.seed, undefined); assert.equal(result.cards[0].rewatchIntent, "YES");
  input.cards.push(input.cards[0]);
  assert.throws(() => publicationSnapshot(input), { code: "PUBLICATION_RESPONSE_INVALID" });
  assert.throws(() => publicationReview({ ...review(), policyRevision: "UNAPPROVED" }));
});
test("publication selection starts from explicit IDs and fields; no private bundle or owner is transmitted", async () => {
  const h = harness();
  await h.controller.prepare({ ...selection, privateBoardTitle: "secret", ownerId: "spoof", cards: [{ ...selection.cards[0], note: "not sent", localRef: "private:file" }] });
  assert.deepEqual(h.calls, [["prepare", { boardId: id(5), expectedRevision: 0, ...selection }]]);
  assert.equal(h.controller.getSnapshot().phase, "reviewing");
  await h.controller.publish({ consented: false, visualsReady: true });
  assert.equal(h.calls.length, 1);
  await h.controller.publish({ consented: true, visualsReady: false });
  assert.equal(h.calls.length, 1);
});
test("unknown publish outcome retries the exact operation/review, with a synchronous double-click lock", async () => {
  let complete;
  const calls = [];
  const h = harness({ async publish(input) {
    calls.push(input);
    if (calls.length === 1) return new Promise((resolve, reject) => { complete = () => reject(error("PUBLICATION_REQUEST_FAILED")); });
    return { id: id(3), revision: 2, state: "PUBLISHED" };
  } });
  await h.controller.prepare(selection);
  const first = h.controller.publish({ consented: true, visualsReady: true });
  await h.controller.publish({ consented: true, visualsReady: true });
  while (!complete) await new Promise((resolve) => setImmediate(resolve));
  complete(); await first;
  assert.equal(calls.length, 1);
  await h.controller.publish({ consented: true, visualsReady: true });
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(h.controller.getSnapshot().phase, "published");
});
test("cancelled prepare cannot restore a review even when transport ignores abort", async () => {
  let complete;
  const h = harness({ prepare: () => new Promise((resolve) => { complete = resolve; }) });
  const task = h.controller.prepare(selection);
  while (!complete) await new Promise((resolve) => setImmediate(resolve));
  h.controller.cancel(); complete(review()); await task;
  assert.equal(h.controller.getSnapshot().review, null);
  assert.equal(h.controller.getSnapshot().phase, "selecting");
});
test("local unsynced/private source edits require a new review before any publish call", async () => {
  const h = harness();
  await h.controller.prepare(selection);
  h.detail.items[0].bundle.card.sync.syncState = "PENDING";
  await h.controller.publish({ consented: true, visualsReady: true });
  assert.equal(h.controller.getSnapshot().error, "SYNC_REQUIRED");
  assert.equal(h.controller.getSnapshot().review, null);
  assert.equal(h.calls.filter(([name]) => name === "publish").length, 0);
});
test("server stale-content rejection clears consentable preview and a new prepare recovers revision", async () => {
  const h = harness({ publish: async () => { throw error("PREVIEW_CHANGED"); } });
  await h.controller.prepare(selection);
  await h.controller.publish({ consented: true, visualsReady: true });
  assert.equal(h.controller.getSnapshot().review, null);
  h.gateway.get = async () => ({ id: id(3), revision: 9, state: "PREPARING" });
  await h.controller.prepare(selection);
  assert.equal(h.calls.at(-1)[1].expectedRevision, 9);
});
test("account switching drops delayed responses and blocks writes for the previous owner", async () => {
  let complete;
  const h = harness({ prepare: () => new Promise((resolve) => { complete = resolve; }) });
  const task = h.controller.prepare(selection);
  while (!complete) await new Promise((resolve) => setImmediate(resolve));
  h.session({ user: { id: id(9) } }); complete(review()); await task;
  assert.equal(h.controller.getSnapshot().review, null);
  assert.equal(h.controller.getSnapshot().error, "AUTH_REQUIRED");
  await h.controller.publish({ consented: true, visualsReady: true });
  assert.equal(h.calls.length, 0);
});
test("reload reports server publication state but never auto-consents or auto-publishes a recovered draft", async () => {
  const h = harness({ get: async () => ({ ...review(), state: "PREPARING" }) });
  await h.controller.load();
  assert.equal(h.controller.getSnapshot().publication.state, "PREPARING");
  assert.equal(h.controller.getSnapshot().review, null);
  assert.equal(h.calls.length, 0);
});
test("missing selected cards cannot silently produce partial-publication success", async () => {
  const h = harness({ prepare: async () => ({ ...review(), snapshot: { ...snapshot(), cards: [] } }) });
  await h.controller.prepare(selection);
  assert.equal(h.controller.getSnapshot().error, "PUBLICATION_RESPONSE_INVALID");
  assert.equal(h.controller.getSnapshot().review, null);
});
test("revoke uses fresh server revision and dispose prevents delayed state delivery", async () => {
  const h = harness({ get: async () => ({ id: id(3), revision: 12, state: "PUBLISHED" }) });
  await h.controller.revoke();
  assert.deepEqual(h.calls, [["revoke", { id: id(3), expectedRevision: 12 }]]);
  assert.equal(h.controller.getSnapshot().publication.state, "REVOKED");
  h.controller.dispose(); await h.controller.prepare(selection);
  assert.equal(h.calls.length, 1);
});

test("update preview retains the existing public placement and cancelled review cannot publish", async () => {
  const h = harness({ get: async () => ({ id: id(3), revision: 2, state: "PUBLISHED", hasPublished: true, sourceChanged: true }) });
  await h.controller.load();
  assert.equal(h.controller.getSnapshot().publication.sourceChanged, true);
  await h.controller.prepare(selection);
  assert.equal(h.controller.getSnapshot().publication.hasPublished, true);
  h.controller.cancel();
  await h.controller.publish({ consented: true, visualsReady: true });
  assert.equal(h.controller.getSnapshot().error, "REVIEW_REQUIRED");
  assert.equal(h.calls.filter(([name]) => name === "publish").length, 0);
});

test("global withdrawal invalidates pending review even when the result is ambiguous", async () => {
  const h = harness({ revokeCard: async () => { throw error("PUBLICATION_REQUEST_FAILED"); } });
  await h.controller.prepare(selection);
  await h.controller.revokeCard(id(2));
  assert.equal(h.controller.getSnapshot().review, null);
  assert.equal(h.controller.getSnapshot().error, "PUBLICATION_REQUEST_FAILED");
  h.gateway.revokeCard = async () => {};
  await h.controller.revokeCard(id(2));
  assert.equal(h.controller.getSnapshot().phase, "cardRevoked");
});
