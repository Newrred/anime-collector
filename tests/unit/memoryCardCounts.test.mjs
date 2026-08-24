import test from "node:test";
import assert from "node:assert/strict";

import { buildMemoryCardCountsByAniListId } from "../../src/features/memory/components/memory-card-counts.js";

const animeBundle = (externalId, overrides = {}) => {
  const bundle = {
    card: {
      id: `card-${externalId}`,
      animeRefId: `anime-ref-${externalId}`,
      privateTitleId: null,
    },
    title: {
      id: `anime-ref-${externalId}`,
      sourceBinding: { provider: "ANILIST", externalId },
    },
  };
  return {
    ...bundle,
    ...overrides,
    card: overrides.card === null ? null : { ...bundle.card, ...(overrides.card || {}) },
    title: { ...bundle.title, ...(overrides.title || {}) },
  };
};

test("memory card counts aggregate exact AniList bindings", () => {
  const archive = [animeBundle("1"), animeBundle("1", { card: { id: "card-1b" } }), animeBundle("154587")];

  assert.deepEqual([...buildMemoryCardCountsByAniListId(archive)], [[1, 2], [154587, 1]]);
});

test("memory card counts ignore custom, foreign, unsafe, and ambiguous bindings", () => {
  const archive = [
    { card: { id: "private-card", privateTitleId: "private-title", animeRefId: null }, title: { id: "private-title" } },
    animeBundle("1", { title: { id: "anime-ref-1", sourceBinding: { provider: "MAL", externalId: "1" } } }),
    animeBundle("0"),
    animeBundle("01"),
    animeBundle(" 1"),
    animeBundle("1.0"),
    animeBundle("9007199254740992"),
    animeBundle("1", { card: null }),
    animeBundle("1", { title: { id: "different-ref", sourceBinding: { provider: "ANILIST", externalId: "1" } } }),
    null,
    {},
  ];

  assert.deepEqual([...buildMemoryCardCountsByAniListId(archive)], []);
  assert.deepEqual([...buildMemoryCardCountsByAniListId(null)], []);
});

test("memory card counts do not mutate the archive or its bindings", () => {
  const archive = [animeBundle("154587")];
  const before = structuredClone(archive);

  buildMemoryCardCountsByAniListId(archive);

  assert.deepEqual(archive, before);
});
