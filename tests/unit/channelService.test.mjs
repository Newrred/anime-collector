import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBookshelf, readBookshelf, saveBookshelf } from "../../src/features/bookshelf/bookshelfSettings.js";
import { archiveFacetOptions, matchesArchiveFacets } from "../../src/features/memory/application/archiveFacets.js";

test("bookshelf settings cannot appear under a different local or account owner", () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const shelf = { shelves: [{ id: "shelf-1", name: "Scenes", titleKeys: ["PRIVATE:title-1"] }] };
  saveBookshelf("guest:one", shelf, storage);
  assert.deepEqual(readBookshelf("guest:one", storage), shelf);
  assert.deepEqual(readBookshelf("guest:two", storage), { shelves: [] });
  assert.deepEqual(readBookshelf("account:one", storage), { shelves: [] });
  assert.throws(() => saveBookshelf("", shelf, storage), /OWNER_REQUIRED/);
  assert.throws(() => saveBookshelf("guest:one", shelf, { setItem() { throw new Error("QUOTA"); } }), /QUOTA/);
});

test("malformed or oversized shelf preferences stay bounded and never affect title records", () => {
  assert.deepEqual(readBookshelf("guest", { getItem: () => "broken" }), { shelves: [] });
  const normalized = normalizeBookshelf({ shelves: [{ id: "all", name: "invalid" }, { id: "x", name: "  one  ", titleKeys: ["", "a", "a", 2] }, { id: "x", name: "duplicate" }] });
  assert.deepEqual(normalized, { shelves: [{ id: "x", name: "one", titleKeys: ["a"] }] });
  assert.equal(normalizeBookshelf({ shelves: Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: "x" })) }).shelves.length, 20);
});

const image = id => ({ title: { displayTitle: "Same title", sourceBinding: { provider: "ANILIST", externalId: String(id) } } });
const logs = [{ anilistId: 1, characterRefs: [
  { characterId: 10, nameSnapshot: "One", affinity: "최애", reasonTags: ["성장"] },
  { characterId: 20, nameSnapshot: "Two", affinity: "기억남음", reasonTags: ["연출"] },
] }, { anilistId: 2, characterRefs: [{ characterId: 30, nameSnapshot: "Other title", affinity: "최애", reasonTags: ["관계성"] }] }];
test("archive facets require the actual title binding and all conditions on the same character", () => {
  assert.equal(matchesArchiveFacets(image(1), logs, { tag: "성장", character: "10", affinity: "최애" }), true);
  assert.equal(matchesArchiveFacets(image(1), logs, { tag: "성장", character: "20" }), false);
  assert.equal(matchesArchiveFacets(image(1), logs, { tag: "연출", affinity: "최애" }), false);
  assert.equal(matchesArchiveFacets(image(2), logs, { tag: "성장" }), false);
  assert.equal(matchesArchiveFacets({ title: { displayTitle: "Same title" } }, logs, { tag: "성장" }), false);
  assert.equal(matchesArchiveFacets({ title: { displayTitle: "Same title" } }, logs, {}), true);
  assert.deepEqual(archiveFacetOptions([image(1)], logs), { memoryTags: [], memoryCharacters: [], tags: ["성장", "연출"], affinities: ["최애", "기억남음"], characters: [{ value: "10", label: "One" }, { value: "20", label: "Two" }] });
});
