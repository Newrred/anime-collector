import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTitleCollectionQuery,
  chooseInitialTitleViewMode,
  normalizeTitleCollectionControls,
} from "../../src/features/titles/application/titleCollectionQuery.js";

const albums = [
  { key: "ANILIST:1", displayTitle: "장송의 프리렌", aliases: ["Frieren"], genres: ["Adventure", "Fantasy"], genreSearchLabels: ["모험", "판타지"], catalogDetail: { release: { startDate: "2023-09-29" } }, tracking: { isSaved: true, watchStatus: "보는중", rating: 5 }, memoryCount: 2, latestMemoryAt: "2026-09-03T00:00:00Z", libraryItem: { addedAt: 1 } },
  { key: "ANILIST:2", displayTitle: "던전밥", aliases: ["Delicious in Dungeon"], genres: ["Comedy", "Fantasy"], genreSearchLabels: ["코미디", "판타지"], catalogDetail: { release: { startDate: "2024-01-04" } }, tracking: { isSaved: true, watchStatus: "완료", rating: 4 }, memoryCount: 0, latestMemoryAt: null, libraryItem: { addedAt: 3 } },
  { key: "PRIVATE:p1", displayTitle: "나만의 작품", aliases: [], genres: ["Slice of Life"], genreSearchLabels: ["일상"], catalogDetail: null, tracking: { isSaved: false, watchStatus: null, rating: null }, memoryCount: 1, latestMemoryAt: "2026-08-01T00:00:00Z", libraryItem: null },
];

test("My Titles filters preserve the same album identities independently of view mode", () => {
  const controls = normalizeTitleCollectionControls({ filter: "HAS_MEMORY", sort: "TITLE", query: "" });
  const poster = applyTitleCollectionQuery(albums, controls).map((row) => row.key);
  const memory = applyTitleCollectionQuery(albums, controls).map((row) => row.key);
  assert.deepEqual(poster, ["PRIVATE:p1", "ANILIST:1"]);
  assert.deepEqual(memory, poster);
});

test("My Titles supports saved, watching, complete, and normalized title search", () => {
  assert.deepEqual(applyTitleCollectionQuery(albums, { filter: "SAVED" }).map((row) => row.key), ["ANILIST:1", "ANILIST:2"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { filter: "WATCHING" }).map((row) => row.key), ["ANILIST:1"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { filter: "COMPLETED" }).map((row) => row.key), ["ANILIST:2"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { query: "delicious" }).map((row) => row.key), ["ANILIST:2"]);
});

test("My Titles restores title-or-genre search and multi-genre filtering", () => {
  assert.deepEqual(applyTitleCollectionQuery(albums, { query: "판타지" }).map((row) => row.key), ["ANILIST:1", "ANILIST:2"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { genres: ["Comedy"] }).map((row) => row.key), ["ANILIST:2"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { genres: ["Adventure", "Comedy"], sort: "TITLE" }).map((row) => row.key), ["ANILIST:2", "ANILIST:1"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { filter: "UNSORTED" }).map((row) => row.key), ["PRIVATE:p1"]);
});

test("My Titles sort options are deterministic and bounded to known values", () => {
  assert.deepEqual(applyTitleCollectionQuery(albums, { sort: "RECENT_SAVED" }).map((row) => row.key), ["ANILIST:2", "ANILIST:1", "PRIVATE:p1"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { sort: "SCORE", sortDir: "desc" }).map((row) => row.key), ["ANILIST:1", "ANILIST:2", "PRIVATE:p1"]);
  assert.deepEqual(applyTitleCollectionQuery(albums, { sort: "YEAR", sortDir: "desc" }).map((row) => row.key), ["ANILIST:2", "ANILIST:1", "PRIVATE:p1"]);
  const normalized = normalizeTitleCollectionControls({ filter: "bad", sort: "bad", sortDir: "sideways", genres: ["Fantasy", "Fantasy", ""], query: " x ".repeat(100) });
  assert.equal(normalized.filter, "ALL");
  assert.equal(normalized.sort, "RECENT_MEMORY");
  assert.equal(normalized.sortDir, "desc");
  assert.deepEqual(normalized.genres, ["Fantasy"]);
  assert.ok([...normalized.query].length <= 120);
});

test("initial view preference defaults to Memory only when a complete Memory exists", () => {
  assert.equal(chooseInitialTitleViewMode("POSTER", albums), "POSTER");
  assert.equal(chooseInitialTitleViewMode("unknown", albums), "MEMORY");
  assert.equal(chooseInitialTitleViewMode(null, albums.map((row) => ({ ...row, memoryCount: 0 }))), "POSTER");
});
