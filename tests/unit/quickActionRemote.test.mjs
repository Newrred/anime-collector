import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogQuickRows } from "../../src/domain/search/catalogQuickActionProjection.js";

const media = (id, title) => ({
  id,
  title: { english: title, romaji: title, native: title },
  coverImage: { large: `https://example.supabase.co/cover-${id}.jpg` },
  seasonYear: 2000 + id,
  format: "TV",
});

test("global quick search projects at most eight catalog rows and excludes Library ids", () => {
  const results = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1,
    ko: index === 1 ? null : `작품 ${index + 1}`,
    media: media(index + 1, index === 1 ? "Naruto: Shippuden" : `Title ${index + 1}`),
  }));

  const rows = projectCatalogQuickRows(results, new Set([1]));
  assert.equal(rows.length, 8);
  assert.equal(rows.some((row) => row.id === 1), false);
  assert.equal(rows.find((row) => row.id === 2).title, "Naruto: Shippuden");
  assert.equal(rows.every((row) => row.src === "moemoa-catalog"), true);
  assert.doesNotMatch(JSON.stringify(rows), /rawPayloadRef|localRef|checksum/iu);
});
