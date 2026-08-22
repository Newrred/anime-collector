import assert from "node:assert/strict";
import test from "node:test";

import { projectCatalogQuickRows } from "../../src/domain/search/catalogQuickActionProjection.js";
import { buildMemoryCardHref } from "../../src/domain/search/memoryCardNavigation.js";

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
    animeId: `anime:00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ko: index === 1 ? null : `작품 ${index + 1}`,
    media: media(index + 1, index === 1 ? "Naruto: Shippuden" : `Title ${index + 1}`),
  }));

  const rows = projectCatalogQuickRows(results, new Set([1]));
  assert.equal(rows.length, 8);
  assert.equal(rows.some((row) => row.id === 1), false);
  assert.equal(rows.find((row) => row.id === 2).title, "Naruto: Shippuden");
  assert.equal(rows.find((row) => row.id === 2).catalogAnimeId, "anime:00000000-0000-4000-8000-000000000002");
  assert.equal(rows.every((row) => row.src === "moemoa-catalog"), true);
  assert.doesNotMatch(JSON.stringify(rows), /rawPayloadRef|localRef|checksum/iu);
});

test("memory card navigation preserves an exact catalog AnimeRef without mutating Library", () => {
  const href = buildMemoryCardHref({
    base: "/preview/",
    row: {
      title: "나루토",
      catalogAnimeId: "anime:00000000-0000-4000-8000-000000000001",
    },
  });

  assert.equal(
    href,
    "/preview/memory/new/?animeId=anime%3A00000000-0000-4000-8000-000000000001&title=%EB%82%98%EB%A3%A8%ED%86%A0"
  );
  assert.equal(buildMemoryCardHref({ base: "/", row: { title: "개인 제목" } }), "/memory/new/?title=%EA%B0%9C%EC%9D%B8+%EC%A0%9C%EB%AA%A9");
});
