import assert from "node:assert/strict";
import test from "node:test";

import { buildTitleAlbumProjections } from "../../src/features/titles/application/titleAlbumProjection.js";

const ANIME_ID = "anime:11111111-1111-4111-8111-000000000001";

const animeMemory = ({ id, updatedAt, imageType = "SYSTEM_DESIGN" }) => ({
  card: {
    id, animeRefId: "anime-ref-1", privateTitleId: null,
    status: "COMPLETE_PRIVATE", note: `${id} note`, updatedAt,
  },
  title: {
    id: "anime-ref-1", catalogAnimeId: ANIME_ID, displayTitle: "카우보이 비밥",
    aliases: ["Cowboy Bebop"], genres: ["Action"],
    sourceBinding: { provider: "ANILIST", externalId: "1" },
  },
  asset: { id: `asset-${id}`, imageType, state: "READY", localRef: imageType === "USER_IMAGE" ? `asset:${id}` : null },
});

const detail = {
  animeId: ANIME_ID,
  sourceBinding: { provider: "ANILIST", externalId: "1" },
  preferredTitle: { locale: "ko", value: "카우보이 비밥" },
  titles: [{ locale: "en", value: "Cowboy Bebop" }],
  release: { format: "TV", status: "FINISHED", startDate: "1998-04-03", episodeCount: 26 },
  studios: [{ name: "Sunrise", role: "ANIMATION_PRODUCTION" }],
  genres: { core: ["Action"], source: [] },
  cover: { publicUrl: "https://catalog.example/cowboy.jpg", width: 460, height: 640 },
};

test("Title albums merge saved state and memories without coupling their meanings", () => {
  const [album] = buildTitleAlbumProjections({
    libraryItems: [{ anilistId: 1, koTitle: "카우보이 비밥", status: "완료", score: 4.5 }],
    memoryBundles: [animeMemory({ id: "memory-1", updatedAt: "2026-09-03T01:00:00.000Z" })],
    catalogDetails: [detail],
  });

  assert.equal(album.key, "ANILIST:1");
  assert.deepEqual(album.titleRef, { kind: "ANIME", animeId: ANIME_ID });
  assert.equal(album.tracking.isSaved, true);
  assert.equal(album.tracking.watchStatus, "완료");
  assert.equal(album.memoryCount, 1);
  assert.equal(album.presence, "SAVED_WITH_MEMORY");
  assert.equal(album.officialCover.src, detail.cover.publicUrl);
});

test("saved-only and memory-only titles remain independent union members", () => {
  const albums = buildTitleAlbumProjections({
    libraryItems: [{ anilistId: 2, koTitle: "던전밥", status: "보는중" }],
    memoryBundles: [animeMemory({ id: "memory-1", updatedAt: "2026-09-03T01:00:00.000Z" })],
  });

  assert.deepEqual(albums.map((album) => album.key).sort(), ["ANILIST:1", "ANILIST:2"]);
  assert.equal(albums.find((album) => album.key === "ANILIST:2").presence, "SAVED_NO_MEMORY");
  assert.equal(albums.find((album) => album.key === "ANILIST:1").presence, "NOT_SAVED_WITH_MEMORY");
});

test("removing a saved row does not remove memories from the projection", () => {
  const memories = [animeMemory({ id: "memory-1", updatedAt: "2026-09-03T01:00:00.000Z" })];
  const [before] = buildTitleAlbumProjections({ libraryItems: [{ anilistId: 1 }], memoryBundles: memories });
  const [after] = buildTitleAlbumProjections({ libraryItems: [], memoryBundles: memories });

  assert.equal(before.tracking.isSaved, true);
  assert.equal(after.tracking.isSaved, false);
  assert.equal(after.memoryCount, 1);
});

test("duplicate memories resolve to one album and previews prefer personal images", () => {
  const [album] = buildTitleAlbumProjections({
    memoryBundles: [
      animeMemory({ id: "cover", updatedAt: "2026-09-03T03:00:00.000Z", imageType: "CATALOG_COVER" }),
      animeMemory({ id: "design", updatedAt: "2026-09-03T02:00:00.000Z" }),
      animeMemory({ id: "image", updatedAt: "2026-09-03T01:00:00.000Z", imageType: "USER_IMAGE" }),
      animeMemory({ id: "fourth", updatedAt: "2026-09-03T04:00:00.000Z", imageType: "CATALOG_COVER" }),
    ],
  });

  assert.equal(album.memoryCount, 4);
  assert.deepEqual(album.previewMemories.map((memory) => memory.sourceKind), [
    "USER_IMAGE", "SYSTEM_DESIGN", "CATALOG_COVER",
  ]);
});

test("PrivateTitle memories keep a private identity and never receive an official cover", () => {
  const privateBundle = {
    card: {
      id: "private-memory", animeRefId: null, privateTitleId: "private-title-1",
      status: "COMPLETE_PRIVATE", note: "개인 기록", updatedAt: "2026-09-03T01:00:00.000Z",
    },
    title: { id: "private-title-1", displayTitle: "내 비공개 작품" },
    asset: { id: "private-asset", imageType: "SYSTEM_DESIGN", state: "READY" },
  };
  const [album] = buildTitleAlbumProjections({ memoryBundles: [privateBundle] });

  assert.deepEqual(album.titleRef, { kind: "PRIVATE_TITLE", privateTitleId: "private-title-1" });
  assert.equal(album.isPrivateTitle, true);
  assert.equal(album.officialCover, null);
  assert.equal(album.memoryCount, 1);
});

test("catalog browse detail may produce NOT_SAVED_NO_MEMORY for a direct Title Hub", () => {
  const [album] = buildTitleAlbumProjections({ catalogDetails: [detail], includeBrowse: true });
  assert.equal(album.presence, "NOT_SAVED_NO_MEMORY");
  assert.equal(album.memoryCount, 0);
  assert.equal(album.tracking.isSaved, false);
});
