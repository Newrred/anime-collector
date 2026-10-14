import test from "node:test";
import assert from "node:assert/strict";
import { recordFirstMemoryViewSuggestion as record, consumeFirstMemoryViewSuggestion as consume } from "../../src/features/titles/application/firstMemoryViewSuggestion.js";

const bundle = (id = "card-1", ownerId = "owner-a", status = "COMPLETE_PRIVATE") => ({ card: { id, ownerId, status } });
function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("a preparation frame cannot consume the visible document's first Memory guidance", () => {
  const storage = memoryStorage(), archive = [bundle()];
  const original = globalThis.window;
  try {
    assert.equal(record({ cardId: "card-1", archive }, storage), true);
    globalThis.window = { top: {} };
    assert.equal(consume(archive, storage), false);
    assert.deepEqual(JSON.parse(storage.getItem("moemoa:titles:first-memory-view:v1:owner-a")), { cardId: "card-1" });
    const visible = {}; visible.top = visible; globalThis.window = visible;
    assert.equal(consume(archive, storage), true);
    assert.equal(consume(archive, storage), false);
  } finally {
    if (original === undefined) delete globalThis.window;
    else globalThis.window = original;
  }
});

test("first saved Memory guidance is consumed once per owner without changing the view preference", () => {
  const storage = memoryStorage();
  storage.setItem("moemoa:titles:view:v1", "POSTER");
  const archive = [bundle()];
  assert.equal(record({ cardId: "card-1", archive }, storage), true);
  assert.equal(consume([bundle("card-b", "owner-b")], storage), false);
  assert.equal(consume(archive, storage), true);
  assert.equal(consume(archive, storage), false);
  assert.equal(record({ cardId: "card-1", archive }, storage), false);
  assert.equal(storage.getItem("moemoa:titles:view:v1"), "POSTER");
  assert.equal(record({ cardId: "card-b", archive: [bundle("card-b", "owner-b")] }, storage), true);
});

test("drafts, subsequent saves, mismatched cards, deleted pending cards and failed storage never show guidance", () => {
  const storage = memoryStorage();
  assert.equal(record({ cardId: "card-1", archive: [bundle("card-1", "owner-a", "DRAFT")] }, storage), false);
  assert.equal(record({ cardId: "card-2", archive: [bundle(), bundle("card-2")] }, storage), false);
  assert.equal(record({ cardId: "wrong", archive: [bundle()] }, storage), false);
  assert.equal(record({ cardId: "card-1", archive: [bundle()] }, storage), true);
  assert.equal(consume([], storage), false);
  assert.equal(consume([bundle("different")], storage), false);
  const unavailable = { getItem() { throw new Error("Storage unavailable"); } };
  assert.equal(record({ cardId: "card-1", archive: [bundle()] }, unavailable), false);
  assert.equal(consume([bundle()], unavailable), false);
});
