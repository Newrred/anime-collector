import assert from "node:assert/strict";
import test from "node:test";

import { createSupabaseCatalogRepository } from "../../src/features/catalog/catalogRepository.js";
import { resolveCatalogSupabaseConfig } from "../../src/features/catalog/catalogSupabaseClient.js";

const animeId = "anime:11111111-1111-4111-8111-000000000001";
const coverAssetId = `asset:${"a".repeat(40)}`;

test("catalog client uses its dedicated public configuration instead of auth Supabase variables", () => {
  assert.deepEqual(resolveCatalogSupabaseConfig({
    PUBLIC_SUPABASE_URL: "https://legacy-auth.supabase.co",
    PUBLIC_SUPABASE_ANON_KEY: "legacy-auth-key",
    PUBLIC_CATALOG_SUPABASE_URL: "https://catalog.supabase.co/",
    PUBLIC_CATALOG_SUPABASE_ANON_KEY: "catalog-publishable-key",
  }), {
    url: "https://catalog.supabase.co",
    publishableKey: "catalog-publishable-key",
  });
  assert.equal(resolveCatalogSupabaseConfig({
    PUBLIC_SUPABASE_URL: "https://legacy-auth.supabase.co",
    PUBLIC_SUPABASE_ANON_KEY: "legacy-auth-key",
  }), null);
});

function clientFor(rows) {
  return {
    storage: { from: (bucket) => ({ getPublicUrl: (path) => ({ data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}` } }) }) },
    from(table) {
      const filters = {};
      const chain = {
        select() { return chain; },
        eq(key, value) { filters[key] = value; return chain; },
        async maybeSingle() { return { data: rows(table, filters), error: null }; },
      };
      return chain;
    },
  };
}

test("catalog repository returns service-safe detail and paginated people", async () => {
  const repository = createSupabaseCatalogRepository({
    client: clientFor((table) => table === "catalog_anime_details" ? {
      anime_id: animeId,
      payload: {
        schemaVersion: 2, animeId,
        externalIds: [{ provider: "anilist", externalId: "1" }],
        preferredTitle: { locale: "ko", value: "카우보이 비밥" },
        titles: [{ locale: "ko", value: "카우보이 비밥" }, { locale: "en", value: "Cowboy Bebop" }],
        release: { format: "TV", status: "FINISHED", episodeCount: 26, startDate: "1998-04-03", sourceMaterialType: "ORIGINAL" },
        studios: [{ name: "Sunrise", role: "ANIMATION_PRODUCTION" }],
        genres: { core: ["Action"], source: ["Action", "Sci-Fi"] },
        officialLinks: [], relations: [],
        people: { characterCount: 1, castingCount: 1, pageCount: 1, pageSize: 30 },
        readiness: { status: "READY" }, coverAssetId, rowHash: "private-integrity-field",
      },
    } : table === "catalog_cover_revisions" ? {
      catalog_cover_revision_id: coverAssetId,
      catalog_cover_id: "cover:11111111-1111-4111-8111-000000000001",
      catalog_anime_id: animeId,
      availability: "READY", rights_basis: "EXPLICIT_PERMISSION",
      permission_verified_at: "2026-09-03T00:00:00.000Z",
      bucket_id: "catalog-covers-preview",
      object_path: `covers/anime-11111111-1111-4111-8111-000000000001/${"a".repeat(64)}.jpg`,
      width: 460, height: 650,
    } : {
      anime_id: animeId, page: 1,
      payload: {
        schemaVersion: 2, animeId, page: 1, totalCount: 1,
        entries: [{ characterId: "character:1", canonicalName: "Spike", role: "MAIN", castings: [{ creditedName: "Koichi Yamadera", language: "JAPANESE", roleType: "VOICE" }] }],
      },
    }),
  });
  const detail = await repository.getDetail(animeId);
  const people = await repository.getPeople(animeId, 1);
  assert.equal(detail.preferredTitle.value, "카우보이 비밥");
  assert.deepEqual(detail.sourceBinding, { provider: "ANILIST", externalId: "1" });
  assert.match(detail.cover.publicUrl, /catalog-covers-preview/u);
  assert.equal(detail.cover.catalogCoverRef.catalogCoverRevisionId, coverAssetId);
  assert.equal(people.entries[0].castings[0].creditedName, "Koichi Yamadera");
  assert.doesNotMatch(JSON.stringify({ detail, people }), /rowHash|localRef|checksum/u);
});

test("catalog repository batches active collection summaries by AniList id", async () => {
  const calls = [];
  const coverRow = {
    catalog_cover_revision_id: coverAssetId,
    catalog_cover_id: "cover:11111111-1111-4111-8111-000000000001",
    catalog_anime_id: animeId,
    availability: "READY", rights_basis: "EXPLICIT_PERMISSION",
    permission_verified_at: "2026-09-03T00:00:00.000Z",
    bucket_id: "catalog-covers-preview",
    object_path: `covers/anime-11111111-1111-4111-8111-000000000001/${"a".repeat(64)}.jpg`, width: 460, height: 650,
  };
  const client = {
    storage: { from: (bucket) => ({ getPublicUrl: (path) => ({ data: { publicUrl: `https://example.supabase.co/${bucket}/${path}` } }) }) },
    from(table) {
      return {
        select(columns) {
          return {
            async in(field, values) {
              calls.push({ table, columns, field, values });
              return { data: table === "catalog_anime_search" ? [{
                anime_id: animeId, anilist_id: 1, preferred_title: "카우보이 비밥", preferred_locale: "ko",
                search_aliases: [{ locale: "en", value: "Cowboy Bebop" }], format: "TV", status: "FINISHED",
                episode_count: 26, source_material_type: "ORIGINAL", release_year: 1998, season: "SPRING",
                studios: [{ name: "Sunrise" }], genres: ["Action", "Sci-Fi"], readiness: "READY", cover_asset_id: coverAssetId,
              }] : [coverRow], error: null };
            },
          };
        },
      };
    },
  };
  const rows = await createSupabaseCatalogRepository({ client }).getCollectionDetailsByAniListIds([1, 1, -1]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].preferredTitle.value, "카우보이 비밥");
  assert.equal(rows[0].release.episodeCount, 26);
  assert.equal(rows[0].studios[0].name, "Sunrise");
  assert.match(rows[0].cover.publicUrl, /catalog-covers-preview/u);
  assert.deepEqual(calls.map(({ table, field, values }) => ({ table, field, values })), [
    { table: "catalog_anime_search", field: "anilist_id", values: [1] },
    { table: "catalog_cover_revisions", field: "catalog_cover_revision_id", values: [coverAssetId] },
  ]);
});
