import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCardClassification } from "../../src/features/memory/domain/cardClassification.js";
import { matchesArchiveFacets, archiveFacetOptions } from "../../src/features/memory/application/archiveFacets.js";
import { createUpdateMemoryCardCommand } from "../../src/features/memory/application/updateMemoryCard.js";
import { toRemoteMemoryCard } from "../../src/features/memory/sync/memorySyncContract.js";
import { catalogCharacterAniListId, createTitleCharactersReader } from "../../src/features/titles/application/titleCharacters.js";

const classification = { version: 1, tags: ["우산"], characters: [{ source: "ANILIST", id: "10", name: "합성 캐릭터" }] };
test("card classification bounds and provenance survive normalization without private image fields", () => {
  assert.deepEqual(normalizeCardClassification({ ...classification, tags: [" 우산 ", "우산", "Warm", "warm"] }).tags, ["우산", "warm"]);
  assert.deepEqual(normalizeCardClassification().tags, []);
  for (const input of [null, { ...classification, tags: Array(21).fill("tag") }, { ...classification, tags: ["x".repeat(49)] }, { ...classification, characters: [{ source: "ANILIST", id: "wrong", name: "A" }] }]) assert.throws(() => normalizeCardClassification(input), /CARD_CLASSIFICATION_INVALID/);
  assert.deepEqual(normalizeCardClassification({ ...classification, characters: [{ ...classification.characters[0], image: "private-file" }] }), classification);
});
test("card filters separate two memories of the same title and combine with existing WatchLog filters", () => {
  const a = { card: { classification }, title: { sourceBinding: { provider: "ANILIST", externalId: "1" } } }, b = { ...a, card: {} };
  assert.equal(matchesArchiveFacets(a, [], { memoryTag: "우산", memoryCharacter: "ANILIST:10" }), true);
  assert.equal(matchesArchiveFacets(b, [], { memoryTag: "우산" }), false);
  assert.equal(matchesArchiveFacets(a, [], { memoryTag: "우산", tag: "성장" }), false);
  assert.deepEqual(archiveFacetOptions([a, b], []).memoryCharacters, [{ value: "ANILIST:10", label: "합성 캐릭터" }]);
});
test("classification-only save preserves note and old-server DTO while staying owner-scoped", async () => {
  const card = { id: "22222222-2222-4222-8222-222222222222", ownerId: "guest:11111111-1111-4111-8111-111111111111", privateTitleId: "33333333-3333-4333-8333-333333333333", status: "COMPLETE_PRIVATE", note: "existing note", createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z" };
  let saved, operations;
  const title = { id: card.privateTitleId, displayTitle: "Private title" };
  const command = createUpdateMemoryCardCommand({ repository: {
    getCardBundle: async () => ({ card, title, asset: {} }),
    updateCardMetadata: async input => { operations = input.syncOperations; return saved = { ...card, ...input.changes }; },
  }, telemetry: { track() {} }, clock: { now: () => "2026-10-05T01:00:00Z" } });
  const result = await command.execute({ ownerId: card.ownerId, cardId: card.id, classification });
  assert.equal(result.note, card.note); assert.deepEqual(saved.classification, classification); assert.deepEqual(operations, []);
  assert.equal(Object.hasOwn(toRemoteMemoryCard({ card: result, title }), "classification"), false);
  assert.deepEqual(toRemoteMemoryCard({ card: result, title }, { includeClassification: true }).classification, classification);
  await assert.rejects(command.execute({ ownerId: "guest:44444444-4444-4444-8444-444444444444", cardId: card.id, classification }), /Private Card was not found/);
});
test("character reads use only catalog data and distinguish empty results from errors", async () => {
  let calls = 0;
  const read = createTitleCharactersReader({ catalog: { getPeople: async id => {
    calls++; assert.equal(id, "anime:one"); return null;
  } } });
  assert.deepEqual((await read({ animeId: "anime:one", anilistId: 1 })).characters, []);
  assert.equal((await read({ anilistId: 1 })).characters.length, 0); assert.equal(calls, 1);
  await assert.rejects(createTitleCharactersReader({ catalog: null })({ animeId: "anime:one", anilistId: 1 }), /UNAVAILABLE/);
});
test("catalog character IDs preserve legacy numeric favorite and watch references", () => {
  assert.equal(catalogCharacterAniListId("anilist:355049"), 355049);
  assert.equal(catalogCharacterAniListId("355049"), 355049);
  assert.equal(catalogCharacterAniListId("catalog:355049"), null);
});

test("explicit save after sync rollout queues locally pending classification without changing the note", async () => {
  const card = { id: "22222222-2222-4222-8222-222222222222", ownerId: "account:11111111-1111-4111-8111-111111111111", privateTitleId: "33333333-3333-4333-8333-333333333333", status: "COMPLETE_PRIVATE", note: "existing note", classification, classificationPending: true, createdAt: "2026-10-05T00:00:00Z", updatedAt: "2026-10-05T00:00:00Z", sync: { remoteVersion: 2 } };
  let saved;
  const command = createUpdateMemoryCardCommand({ classificationSync: true, repository: {
    getCardBundle: async () => ({ card, title: { id: card.privateTitleId, displayTitle: "Synthetic" }, asset: {} }),
    readDeviceSyncState: async () => ({ deviceId: "44444444-4444-4444-8444-444444444444" }),
    updateCardMetadata: async input => { saved = input; return { ...card, ...input.changes }; },
  }, ids: { next: () => "55555555-5555-4555-8555-555555555555" }, telemetry: { track() {} }, clock: { now: () => "2026-10-05T01:00:00Z" } });
  const result = await command.execute({ ownerId: card.ownerId, cardId: card.id, classification });
  assert.equal(result.note, card.note); assert.equal(result.classificationPending, false);
  assert.equal(saved.syncOperations.length, 1); assert.equal(saved.syncOperations[0].baseVersion, 2);
  assert.deepEqual(saved.syncOperations[0].payload.classification, classification);
});

test("catalog pagination failure remains retryable without a provider request", async () => {
  const read = createTitleCharactersReader({ catalog: { getPeople: async (_id, page) => {
    if (page === 2) throw new Error("Synthetic catalog failure");
    return { entries: [{ characterId: "catalog-character-1", name: "Synthetic", castings: [] }], totalCount: 31 };
  } } });
  assert.equal((await read({ animeId: "anime:one", anilistId: 1 })).hasMore, true);
  await assert.rejects(read({ animeId: "anime:one", anilistId: 1, page: 2 }), /TITLE_CHARACTERS_UNAVAILABLE/);
});
