import assert from "node:assert/strict";
import test from "node:test";

import {
  createCatalogLibrarySearch,
  detailToTitleChoice,
} from "../../src/features/catalog/catalogConsumer.js";

const animeId = "anime:11111111-1111-4111-8111-000000000001";
const candidate = {
  kind: "ANIME_REF",
  animeId,
  displayTitle: "카우보이 비밥",
  aliases: ["Cowboy Bebop", "カウボーイビバップ"],
  genres: ["Action", "Sci-Fi"],
  sourceBinding: { provider: "ANILIST", externalId: "1" },
  verificationState: "PROVIDER_CANDIDATE",
  catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
};
const detail = {
  animeId,
  preferredTitle: { locale: "ko", value: "카우보이 비밥" },
  titles: [
    { locale: "ko", value: "카우보이 비밥" },
    { locale: "en", value: "Cowboy Bebop" },
    { locale: "ja", value: "カウボーイビバップ" },
  ],
  sourceBinding: { provider: "ANILIST", externalId: "1" },
  release: {
    format: "TV", status: "FINISHED", startDate: "1998-04-03",
    episodeCount: 26, sourceMaterialType: "ORIGINAL",
  },
  studios: [{ name: "Sunrise", role: "ANIMATION_PRODUCTION" }],
  genres: { core: ["Action", "Sci-Fi"], source: [] },
  cover: { publicUrl: "https://example.supabase.co/storage/v1/object/public/catalog-covers-preview/cover.jpg", width: 460, height: 640 },
};

test("detail becomes an exact AnimeRef choice without retaining the cover", () => {
  const choice = detailToTitleChoice(detail);
  assert.equal(choice.animeId, animeId);
  assert.equal(choice.displayTitle, "카우보이 비밥");
  assert.deepEqual(choice.sourceBinding, { provider: "ANILIST", externalId: "1" });
  assert.doesNotMatch(JSON.stringify(choice), /https?:|cover/iu);
});

test("catalog Library search projects bounded detail rows into the existing UI contract", async () => {
  const search = createCatalogLibrarySearch({
    titleResolver: { search: async () => [candidate] },
    repository: { getDetail: async (id) => id === animeId ? detail : null },
  });
  const outcome = await search("카우보이");

  assert.equal(outcome.status, "READY");
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0].id, 1);
  assert.equal(outcome.results[0].ko, "카우보이 비밥");
  assert.equal(outcome.results[0].media.title.english, "Cowboy Bebop");
  assert.equal(outcome.results[0].media.coverImage.large, detail.cover.publicUrl);
  assert.equal(outcome.results[0].src, "moemoa-catalog");
});

test("catalog Library search caps detail reads and isolates one malformed candidate", async () => {
  const candidates = Array.from({ length: 10 }, (_, index) => ({
    ...candidate,
    animeId: `anime:11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
    sourceBinding: { provider: "ANILIST", externalId: String(index + 1) },
  }));
  const detailCalls = [];
  const search = createCatalogLibrarySearch({
    titleResolver: { search: async () => candidates },
    repository: {
      getDetail: async (id) => {
        detailCalls.push(id);
        const matching = candidates.find((row) => row.animeId === id);
        if (matching.sourceBinding.externalId === "3") throw new Error("malformed detail");
        return {
          ...detail,
          animeId: id,
          sourceBinding: { ...matching.sourceBinding },
        };
      },
    },
  });

  const outcome = await search("anime");
  assert.equal(detailCalls.length, 8);
  assert.equal(outcome.results.length, 7);
  assert.equal(outcome.results.some((row) => row.id === 3), false);
});
