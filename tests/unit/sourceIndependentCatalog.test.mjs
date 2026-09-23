import assert from "node:assert/strict";
import test from "node:test";
import { createAnimeRef } from "../../src/features/memory/domain/memoryDomain.js";
import { detailToTitleChoice, createCatalogLibrarySearch } from "../../src/features/catalog/catalogConsumer.js";
import { createSupabaseCatalogTitleResolver } from "../../src/features/memory/adapters/catalog/supabaseCatalogTitleResolver.js";
import { createCombinedTitleResolver } from "../../src/features/memory/application/titleResolver.js";
import { buildTitleAlbumProjections } from "../../src/features/titles/application/titleAlbumProjection.js";
import { addAnimeFromQuickAction } from "../../src/domain/search/quickActionActions.js";
import { projectCatalogQuickRows } from "../../src/domain/search/catalogQuickActionProjection.js";
import { searchLocalLibrary } from "../../src/domain/search/libraryLocalSearch.js";

const ids = [1, 2].map((n) => `anime:11111111-1111-4111-8111-00000000000${n}`);
const detail = (animeId) => ({
  animeId, sourceBinding: null, preferredTitle: { value: `Title ${animeId.slice(-1)}` },
  titles: [], genres: { core: [], source: [] }, release: {}, studios: [], readiness: "READY_WITH_GAPS",
  cover: { publicUrl: "https://example.test/cover.jpg", catalogCoverRef: {} },
});

test("two catalog-only candidates survive search, Memory choice, quick save and local reload independently", async () => {
  const resolver = createSupabaseCatalogTitleResolver({ client: {
    rpc: async () => ({ data: ids.map((anime_id, i) => ({ anime_id, anilist_id: null,
      preferred_title: `Title ${i + 1}`, preferred_locale: "en", search_aliases: [], genres: [],
      readiness: "READY_WITH_GAPS", cover_asset_id: `asset:${"a".repeat(40)}` })), error: null }),
  } });
  const combined = createCombinedTitleResolver({ localResolver: { search: async () => [] }, remoteResolver: resolver });
  assert.equal((await combined.search("Title")).results.length, 2);
  const search = createCatalogLibrarySearch({ titleResolver: resolver, repository: { getDetail: async (id) => detail(id) } });
  const rows = projectCatalogQuickRows((await search("Title")).results);
  assert.deepEqual(rows.map((row) => row.id), ids);
  let stored = [];
  for (const row of rows) await addAnimeFromQuickAction(row.media, "미분류", {
    readLibraryListPreferred: async () => structuredClone(stored),
    writeLibraryListDurable: async (value) => { stored = structuredClone(value); },
  });
  assert.equal(stored.length, 2);
  assert.equal(searchLocalLibrary({ items: stored, query: "Title", mediaMap: new Map() }).length, 2);
  const memories = ids.map((id, i) => {
    const choice = detailToTitleChoice(detail(id));
    const title = createAnimeRef({ ...choice, id: `ref-${i}`, catalogAnimeId: choice.animeId, now: "2026-09-07T00:00:00Z" });
    assert.equal(title.sourceBinding, null);
    assert.equal(title.sourceKey, id);
    return { title, card: { id: `card-${i}`, animeRefId: title.id, status: "COMPLETE_PRIVATE", updatedAt: "2026-09-07T00:00:00Z" }, asset: { imageType: "SYSTEM_DESIGN" } };
  });
  const albums = buildTitleAlbumProjections({ libraryItems: stored, memoryBundles: memories, catalogDetails: ids.map(detail) });
  assert.equal(albums.length, 2);
  for (const album of albums) {
    assert.equal(album.presence, "SAVED_WITH_MEMORY");
    assert.equal(album.memoryCount, 1);
    assert.equal(album.titleRef.kind, "ANIME");
  }
  assert.equal(buildTitleAlbumProjections({ memoryBundles: memories }).length, 2);
});

test("missing external binding requires a valid catalog UUID and preserves candidate provenance", () => {
  assert.throws(() => createAnimeRef({ id: "ref", displayTitle: "Title", sourceBinding: null, verificationState: "PROVIDER_CANDIDATE" }));
  assert.throws(() => createAnimeRef({ id: "ref", catalogAnimeId: ids[0], displayTitle: "Title", sourceBinding: null, verificationState: "SOURCE_REVIEWED" }));
});

test("adding an optional AniList binding does not hide an already saved UUID title", () => {
  const bound = { ...detail(ids[0]), sourceBinding: { provider: "ANILIST", externalId: "50" } };
  const albums = buildTitleAlbumProjections({ libraryItems: [{ catalogAnimeId: ids[0], anilistId: null, koTitle: "Title" }], catalogDetails: [bound] });
  assert.equal(albums.length, 1);
  assert.equal(albums[0].tracking.isSaved, true);
  assert.equal(albums[0].catalogDetail.animeId, ids[0]);
});
