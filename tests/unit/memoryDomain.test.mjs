import test from "node:test";
import assert from "node:assert/strict";

import {
  assertCompletePrivateCard,
  createAnimeRef,
  createGuestOwner,
  createPrivateTitle,
} from "../../src/features/memory/domain/memoryDomain.js";
import { createSystemDesignViewModel } from "../../src/features/memory/domain/systemDesign.js";

const OWNER_A = "guest:11111111-1111-4111-8111-111111111111";
const OWNER_B = "guest:22222222-2222-4222-8222-222222222222";

const completeFixture = () => ({
  card: {
    id: "card-1",
    ownerId: OWNER_A,
    privateTitleId: "title-1",
    animeRefId: null,
    visualAssetId: "asset-1",
    status: "COMPLETE_PRIVATE",
  },
  title: {
    id: "title-1",
    ownerId: OWNER_A,
    displayTitle: "Frieren",
  },
  asset: {
    id: "asset-1",
    ownerId: OWNER_A,
    state: "READY",
    storageScope: "LOCAL_ONLY",
    visibility: "PRIVATE",
  },
});

test("guest owner is installation-scoped and uses the canonical guest id", () => {
  const owner = createGuestOwner({
    uuid: "11111111-1111-4111-8111-111111111111",
    now: "2026-08-12T00:00:00.000Z",
  });

  assert.deepEqual(owner, {
    id: OWNER_A,
    kind: "GUEST",
    createdAt: "2026-08-12T00:00:00.000Z",
  });
});

test("private title normalization is deterministic without provider data", () => {
  const title = createPrivateTitle({
    id: "title-1",
    ownerId: OWNER_A,
    displayTitle: "  葬送の   フリーレン  ",
    now: "2026-08-12T00:00:00.000Z",
  });

  assert.equal(title.displayTitle, "葬送の フリーレン");
  assert.equal(title.normalizedTitle, "葬送の フリーレン");
  assert.equal(title.ownerId, OWNER_A);
});

test("anime reference keeps only normalized title facts and explicit AniList provenance", () => {
  const animeRef = createAnimeRef({
    id: "anime-ref-1",
    displayTitle: "  Frieren:  Beyond Journey's End ",
    aliases: ["Sousou no Frieren", "  葬送のフリーレン  ", "Sousou no Frieren"],
    genres: ["Adventure", " Fantasy ", "Adventure"],
    sourceBinding: { provider: "ANILIST", externalId: 154587 },
    verificationState: "PROVIDER_CANDIDATE",
    now: "2026-08-12T00:00:00.000Z",
  });

  assert.deepEqual(animeRef, {
    id: "anime-ref-1",
    displayTitle: "Frieren: Beyond Journey's End",
    normalizedTitle: "frieren: beyond journey's end",
    aliases: ["Sousou no Frieren", "葬送のフリーレン"],
    genres: ["Adventure", "Fantasy"],
    sourceKey: "ANILIST:154587",
    sourceBinding: { provider: "ANILIST", externalId: "154587" },
    verificationState: "PROVIDER_CANDIDATE",
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  });
  assert.equal("coverImage" in animeRef, false);
  assert.equal("siteUrl" in animeRef, false);
});

test("anime reference rejects unknown providers and unclassified provenance", () => {
  const base = {
    id: "anime-ref-1",
    displayTitle: "Frieren",
    aliases: [],
    genres: [],
    sourceBinding: { provider: "ANILIST", externalId: "154587" },
    verificationState: "PROVIDER_CANDIDATE",
    now: "2026-08-12T00:00:00.000Z",
  };

  assert.throws(
    () => createAnimeRef({ ...base, sourceBinding: { provider: "UNKNOWN", externalId: "1" } }),
    { code: "INVALID_ANIME_SOURCE" },
  );
  assert.throws(
    () => createAnimeRef({ ...base, verificationState: "VERIFIED" }),
    { code: "INVALID_VERIFICATION_STATE" },
  );
});

test("complete private card accepts exactly one same-owner title and a READY local asset", () => {
  const fixture = completeFixture();
  assert.doesNotThrow(() => assertCompletePrivateCard(fixture));
});

test("complete private card rejects zero or two title references", () => {
  const noTitle = completeFixture();
  noTitle.card.privateTitleId = null;
  assert.throws(() => assertCompletePrivateCard(noTitle), { code: "TITLE_REFERENCE_REQUIRED" });

  const twoTitles = completeFixture();
  twoTitles.card.animeRefId = "anime-1";
  assert.throws(() => assertCompletePrivateCard(twoTitles), { code: "TITLE_REFERENCE_CONFLICT" });
});

test("complete private card rejects an unready or cross-owner asset", () => {
  const importing = completeFixture();
  importing.asset.state = "IMPORTING";
  assert.throws(() => assertCompletePrivateCard(importing), { code: "VISUAL_ASSET_NOT_READY" });

  const wrongOwner = completeFixture();
  wrongOwner.asset.ownerId = OWNER_B;
  assert.throws(() => assertCompletePrivateCard(wrongOwner), { code: "CROSS_OWNER_REFERENCE" });
});

test("complete private card rejects a cross-owner private title", () => {
  const fixture = completeFixture();
  fixture.title.ownerId = OWNER_B;
  assert.throws(() => assertCompletePrivateCard(fixture), { code: "CROSS_OWNER_REFERENCE" });
});

test("system design view model is deterministic for the same versioned spec", () => {
  const spec = {
    version: 1,
    templateId: "memory-gradient",
    paletteId: "violet-dawn",
    patternSeed: "frieren-episode-1",
    titleLayout: "BOTTOM_LEFT",
    genreTokens: ["fantasy", "drama"],
  };

  const first = createSystemDesignViewModel(spec);
  const second = createSystemDesignViewModel({ ...spec, genreTokens: [...spec.genreTokens] });

  assert.deepEqual(first, second);
  assert.match(first.patternToken, /^[a-f0-9]{8}$/);
  assert.deepEqual(first.genreTokens, ["fantasy", "drama"]);
});
