import test from "node:test";
import assert from "node:assert/strict";

import { buildTitleHubHref, buildMemoryTitleHubHref, parseTitleHubRequest, resolveLegacyLibraryHref } from "../../src/features/titles/domain/titleNavigation.js";

const animeId = "anime:11111111-1111-4111-8111-000000154587";

test("Memory cross-links preserve private and catalog identity without treating other provider IDs as AniList IDs", () => {
  assert.equal(buildMemoryTitleHubHref({ bundle: { card: { privateTitleId: "private-1" }, title: { displayTitle: "Mine" } }, native: true }), "/title/index.html?privateTitleId=private-1&title=Mine");
  assert.equal(buildMemoryTitleHubHref({ bundle: { title: { catalogAnimeId: animeId, sourceBinding: { provider: "ANILIST", externalId: "1" } } } }), `/title/?animeId=${encodeURIComponent(animeId)}`);
  assert.equal(buildMemoryTitleHubHref({ base: "/Anime/", bundle: { title: { sourceBinding: { provider: "ANILIST", externalId: "1" } } } }), "/Anime/title/?anilistId=1");
  assert.equal(buildMemoryTitleHubHref({ bundle: { title: { sourceBinding: { provider: "MYANIMELIST", externalId: "1" } } } }), null);
});

test("legacy URLs map safely without losing explicit editing or quick-log actions", () => {
  assert.equal(resolveLegacyLibraryHref(), "/titles/");
  assert.equal(resolveLegacyLibraryHref({ base: "/Anime/", search: "?animeId=154587" }), "/Anime/title/?anilistId=154587");
  assert.equal(resolveLegacyLibraryHref({ native: true, search: "?animeId=154587" }), "/title/index.html?anilistId=154587");
  assert.equal(resolveLegacyLibraryHref({ search: "?animeId=154587&focus=quick-log" }), null);
  assert.equal(resolveLegacyLibraryHref({ search: "?animeId=154587&focus=edit" }), null);
  assert.equal(resolveLegacyLibraryHref({ search: "?animeId=javascript:alert(1)&next=https://example.com" }), "/titles/");
});

test("Title Hub navigation keeps an exact catalog identity and a display-only title", () => {
  const href = buildTitleHubHref({
    titleRef: { kind: "ANIME", animeId },
    title: " 장송의   프리렌 ",
  });
  assert.equal(href, `/title/?${new URLSearchParams({ animeId, title: "장송의 프리렌" })}`);
  assert.deepEqual(parseTitleHubRequest(href.split("?")[1]), {
    kind: "ANIME",
    animeId,
    title: "장송의 프리렌",
  });
});

test("Title Hub navigation maps legacy and private identities into packaged Android routes", () => {
  assert.equal(
    buildTitleHubHref({ native: true, anilistId: 154587, title: "Frieren" }),
    "/title/index.html?anilistId=154587&title=Frieren",
  );
  assert.deepEqual(parseTitleHubRequest("?privateTitleId=private%3Aone&title=Mine"), {
    kind: "PRIVATE_TITLE",
    privateTitleId: "private:one",
    title: "Mine",
  });
});

test("Title Hub request rejects missing and malformed identities", () => {
  assert.equal(parseTitleHubRequest("?animeId=anime%3Abad&title=Bad"), null);
  assert.equal(parseTitleHubRequest("?anilistId=-1"), null);
  assert.equal(parseTitleHubRequest(""), null);
});
