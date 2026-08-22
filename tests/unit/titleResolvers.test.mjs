import test from "node:test";
import assert from "node:assert/strict";

import { createLegacyAliasTitleResolver } from "../../src/features/memory/adapters/catalog/legacyAliasTitleResolver.js";
import { createAniListTitleResolver } from "../../src/features/memory/adapters/catalog/anilistTitleResolver.js";
import { createCombinedTitleResolver } from "../../src/features/memory/application/titleResolver.js";
import {
  createDevCatalogTitleResolver,
  createFallbackCatalogTitleResolver,
} from "../../src/features/memory/adapters/catalog/devCatalogTitleResolver.js";
import { createSupabaseCatalogTitleResolver } from "../../src/features/memory/adapters/catalog/supabaseCatalogTitleResolver.js";

const legacyRows = [
  {
    anilistId: 154587,
    ko: "장송의 프리렌",
    aliases: ["Frieren: Beyond Journey's End", "Sousou no Frieren", "葬送のフリーレン"],
  },
  {
    anilistId: 19,
    ko: "몬스터",
    aliases: ["Monster", "MONSTER"],
  },
];

test("legacy alias resolver returns local facts as explicitly unverified candidates", async () => {
  const resolver = createLegacyAliasTitleResolver({ rows: legacyRows, limit: 5 });

  const results = await resolver.search("  프리렌 ");

  assert.deepEqual(results, [{
    kind: "ANIME_REF",
    displayTitle: "장송의 프리렌",
    aliases: ["Frieren: Beyond Journey's End", "Sousou no Frieren", "葬送のフリーレン"],
    genres: [],
    sourceBinding: { provider: "ANILIST", externalId: "154587" },
    verificationState: "LEGACY_UNVERIFIED",
  }]);
});

test("AniList resolver projects only title facts and excludes provider artwork and URLs", async () => {
  const resolver = createAniListTitleResolver({
    searchAnime: async (query, limit) => {
      assert.equal(query, "Frieren");
      assert.equal(limit, 6);
      return [{
        id: 154587,
        title: {
          english: "Frieren: Beyond Journey's End",
          romaji: "Sousou no Frieren",
          native: "葬送のフリーレン",
        },
        synonyms: ["Frieren at the Funeral"],
        genres: ["Adventure", "Fantasy"],
        coverImage: { large: "https://cdn.example/cover.jpg" },
        bannerImage: "https://cdn.example/banner.jpg",
        siteUrl: "https://anilist.co/anime/154587",
      }];
    },
    limit: 6,
  });

  const [candidate] = await resolver.search(" Frieren ");

  assert.deepEqual(candidate, {
    kind: "ANIME_REF",
    displayTitle: "Frieren: Beyond Journey's End",
    aliases: ["Sousou no Frieren", "葬送のフリーレン", "Frieren at the Funeral"],
    genres: ["Adventure", "Fantasy"],
    sourceBinding: { provider: "ANILIST", externalId: "154587" },
    verificationState: "PROVIDER_CANDIDATE",
  });
  assert.doesNotMatch(JSON.stringify(candidate), /https?:|cover|banner/i);
});

test("combined resolver prefers provider facts for the same id and retains the local Korean alias", async () => {
  const localResolver = createLegacyAliasTitleResolver({ rows: legacyRows });
  const remoteResolver = createAniListTitleResolver({
    searchAnime: async () => [{
      id: 154587,
      title: { english: "Frieren: Beyond Journey's End", romaji: "Sousou no Frieren" },
      synonyms: [],
      genres: ["Adventure", "Fantasy"],
    }],
  });
  const resolver = createCombinedTitleResolver({ localResolver, remoteResolver, remoteTimeoutMs: 50 });

  const response = await resolver.search("프리렌");

  assert.equal(response.remoteStatus, "READY");
  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].verificationState, "PROVIDER_CANDIDATE");
  assert.equal(response.results[0].displayTitle, "Frieren: Beyond Journey's End");
  assert.deepEqual(response.results[0].aliases, [
    "Sousou no Frieren",
    "장송의 프리렌",
    "葬送のフリーレン",
  ]);
});

test("combined resolver returns local results when the provider fails or times out", async () => {
  const localResolver = createLegacyAliasTitleResolver({ rows: legacyRows });
  const failed = createCombinedTitleResolver({
    localResolver,
    remoteResolver: { search: async () => { throw new Error("private network detail"); } },
    remoteTimeoutMs: 20,
  });
  const timedOut = createCombinedTitleResolver({
    localResolver,
    remoteResolver: { search: () => new Promise(() => {}) },
    remoteTimeoutMs: 5,
  });

  const failedResponse = await failed.search("프리렌");
  const timeoutResponse = await timedOut.search("프리렌");

  assert.equal(failedResponse.remoteStatus, "UNAVAILABLE");
  assert.equal(timeoutResponse.remoteStatus, "TIMED_OUT");
  assert.equal(failedResponse.results[0].verificationState, "LEGACY_UNVERIFIED");
  assert.equal(timeoutResponse.results[0].displayTitle, "장송의 프리렌");
});

test("development catalog resolver accepts only the allowlisted local test DTO", async () => {
  const requests = [];
  const resolver = createDevCatalogTitleResolver({
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({
        schemaVersion: 1,
        results: [{
          kind: "ANIME_REF",
          displayTitle: "장송의 프리렌",
          aliases: ["Frieren: Beyond Journey's End"],
          genres: [],
          sourceBinding: { provider: "ANILIST", externalId: "154587" },
          verificationState: "PROVIDER_CANDIDATE",
          catalogSource: "LOCAL_TEST_SERVICE_PROJECTION",
          readiness: "READY_WITH_GAPS",
          coverPreviewUrl: "/__moemoa-dev/catalog/cover/154587",
        }],
      }), { headers: { "Content-Type": "application/json" } });
    },
  });

  const results = await resolver.search(" 프리렌 ");
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /q=%ED%94%84%EB%A6%AC%EB%A0%8C$/u);
  assert.equal(requests[0].init.credentials, "same-origin");
  assert.equal(results[0].catalogSource, "LOCAL_TEST_SERVICE_PROJECTION");
  assert.doesNotMatch(JSON.stringify(results), /rawPayloadRef|localRef|checksum|https?:|[A-Z]:\\/iu);

  const privateField = ["raw", "Payload", "Ref"].join("");
  const leaking = createDevCatalogTitleResolver({
    fetchImpl: async () => new Response(JSON.stringify({
      schemaVersion: 1,
      results: [{ ...results[0], [privateField]: "raw/anilist/private.json" }],
    })),
  });
  await assert.rejects(leaking.search("프리렌"), { code: "DEV_CATALOG_RESPONSE_INVALID" });
});

test("development catalog fallback calls AniList only when the local endpoint is unavailable", async () => {
  let fallbackCalls = 0;
  const fallback = { search: async () => { fallbackCalls += 1; return [{ displayTitle: "fallback" }]; } };
  const unavailable = createFallbackCatalogTitleResolver({
    primary: { search: async () => { throw new Error("local detail"); } }, fallback,
  });
  const empty = createFallbackCatalogTitleResolver({
    primary: { search: async () => [] }, fallback,
  });

  assert.deepEqual(await unavailable.search("frieren"), [{ displayTitle: "fallback" }]);
  assert.deepEqual(await empty.search("frieren"), []);
  assert.equal(fallbackCalls, 1);
});

test("combined resolver hides unmatched legacy candidates when catalog results exist", async () => {
  const localResolver = {
    search: async () => legacyRows.map((row) => ({
      kind: "ANIME_REF",
      displayTitle: row.ko,
      aliases: row.aliases,
      genres: [],
      sourceBinding: { provider: "ANILIST", externalId: String(row.anilistId) },
      verificationState: "LEGACY_UNVERIFIED",
    })),
  };
  const remoteResolver = {
    search: async () => [{
      kind: "ANIME_REF",
      animeId: "anime:11111111-1111-4111-8111-000000154587",
      displayTitle: "장송의 프리렌",
      aliases: ["Frieren: Beyond Journey's End"],
      genres: ["Fantasy"],
      sourceBinding: { provider: "ANILIST", externalId: "154587" },
      verificationState: "PROVIDER_CANDIDATE",
      catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
      readiness: "READY",
      coverAssetId: "asset:placeholder",
    }],
  };
  const response = await createCombinedTitleResolver({
    localResolver, remoteResolver, remoteTimeoutMs: 50,
  }).search("프리렌");

  assert.equal(response.results.length, 1);
  assert.equal(response.results[0].sourceBinding.externalId, "154587");
});

test("Supabase catalog resolver maps only bounded active-release search fields", async () => {
  const calls = [];
  const resolver = createSupabaseCatalogTitleResolver({
    client: {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: [{
          anime_id: "anime:11111111-1111-4111-8111-000000154587",
          anilist_id: 154587,
          preferred_title: "장송의 프리렌",
          preferred_locale: "ko",
          search_aliases: [{ locale: "en", value: "Frieren: Beyond Journey's End" }],
          format: "TV", status: "FINISHED", episode_count: 28,
          source_material_type: "MANGA", release_year: 2023, season: "FALL",
          studios: ["Madhouse"], genres: ["Adventure", "Fantasy"],
          readiness: "READY", cover_asset_id: "asset:placeholder",
        }], error: null };
      },
    },
  });
  const results = await resolver.search(" 프리렌 ");
  assert.deepEqual(calls, [{ name: "search_catalog_anime", args: { search_query: "프리렌", result_limit: 8 } }]);
  assert.deepEqual(results, [{
    kind: "ANIME_REF",
    animeId: "anime:11111111-1111-4111-8111-000000154587",
    displayTitle: "장송의 프리렌",
    aliases: ["Frieren: Beyond Journey's End"],
    genres: ["Adventure", "Fantasy"],
    sourceBinding: { provider: "ANILIST", externalId: "154587" },
    verificationState: "PROVIDER_CANDIDATE",
    catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
    readiness: "READY",
    coverAssetId: "asset:placeholder",
  }]);
  assert.doesNotMatch(JSON.stringify(results), /row_hash|search_text|payload|localRef|checksum/iu);
});

test("Supabase catalog resolver replaces a promotional preferred title with a clean alias", async () => {
  const resolver = createSupabaseCatalogTitleResolver({
    client: {
      rpc: async () => ({ data: [{
        anime_id: "anime:11111111-1111-4111-8111-000000000021",
        anilist_id: 21,
        preferred_title: "(고화질)나루토 질풍전",
        preferred_locale: "ko",
        search_aliases: [
          { locale: "en", value: "Naruto: Shippuden" },
          { locale: "ja", value: "NARUTO -ナルト- 疾風伝" },
        ],
        studios: ["Pierrot"], genres: ["Action"], readiness: "READY_WITH_GAPS",
        cover_asset_id: "asset:placeholder",
      }], error: null }),
    },
  });

  const [candidate] = await resolver.search("나루토");
  assert.equal(candidate.displayTitle, "Naruto: Shippuden");
  assert.doesNotMatch(JSON.stringify(candidate), /고화질/u);
});
