import assert from "node:assert/strict";
import test from "node:test";
import { validateTitleWatchRecord, titleWatchIdentity, normalizeWatchStatus } from "../../src/features/titles/domain/titleWatchRecord.js";
import { createTitleWatchRecordWriter } from "../../src/features/titles/application/titleWatchRecordWriter.js";
import { buildWatchLogCloudRows } from "../../src/domain/cloudSyncTables.js";

const animeId = "anime:11111111-1111-4111-8111-000000000001";
const album = { titleRef: { kind: "ANIME", animeId }, anilistId: null, tracking: { isSaved: true } };
const draft = { operationId: "record-operation-01", watchStatus: "완료", rating: 0, rewatchCount: 3,
  eventType: "재시청", watchedAtPrecision: "month", watchedAtValue: "2026-10", note: "새 감상" };

test("watch dates reject invalid calendar dates and preserve unknown, month and year precision", () => {
  assert.equal(validateTitleWatchRecord(draft).watchedAtValue, "2026-10");
  assert.equal(validateTitleWatchRecord({ ...draft, watchedAtPrecision: "unknown", watchedAtValue: "" }).watchedAtPrecision, "unknown");
  assert.equal(validateTitleWatchRecord({ ...draft, watchedAtPrecision: "year", watchedAtValue: "2024" }).watchedAtValue, "2024");
  assert.doesNotThrow(() => validateTitleWatchRecord({ ...draft, watchedAtPrecision: "day", watchedAtValue: "2024-02-29" }));
  for (const [precision, value] of [["day", "2025-02-29"], ["month", "2026-13"], ["year", "0"], ["unknown", "2026"]]) {
    assert.throws(() => validateTitleWatchRecord({ ...draft, watchedAtPrecision: precision, watchedAtValue: value }), /INVALID_WATCH_DATE/);
  }
});
test("unrated stays distinct from zero and records require a real title identity", () => {
  assert.equal(validateTitleWatchRecord({ ...draft, rating: "" }).rating, null);
  assert.equal(validateTitleWatchRecord(draft).rating, 0);
  for (const rating of [-1, 5.5, 4.2, "bad"]) assert.throws(() => validateTitleWatchRecord({ ...draft, rating }), /INVALID_SCORE/);
  assert.deepEqual(titleWatchIdentity(album), { anilistId: null, catalogAnimeId: animeId });
  assert.throws(() => titleWatchIdentity({ titleRef: { kind: "PRIVATE_TITLE", privateTitleId: "private-1" } }), /TITLE_NOT_SAVEABLE/);
  assert.throws(() => validateTitleWatchRecord({ ...draft, rewatchCount: -1 }), /INVALID_REWATCH_COUNT/);
});
test("partial record write retries the same entry and absolute rewatch count, preserving old memo", async () => {
  let library = [{ catalogAnimeId: animeId, anilistId: null, memo: "긴 기존 감상", rewatchCount: 2 }];
  const logs = []; let failures = 1; let dispatches = 0;
  const save = createTitleWatchRecordWriter({
    readLibrary: async () => structuredClone(library), writeLibrary: async (rows) => { if (failures--) throw new Error("quota"); library = rows; },
    readWatchLogs: async () => logs, createLog: (input) => ({ ...input }),
    appendLog: async (log, options) => { assert.equal(options.skipSyncMark, true); logs.push(log); return log; },
    dispatchLibraryUpdated: () => dispatches++,
  });
  await assert.rejects(save(album, draft), /TITLE_TRACKING_PENDING/);
  assert.equal(logs.length, 1); assert.equal(library[0].rewatchCount, 2); assert.equal(dispatches, 0);
  await assert.rejects(save(album, { ...draft, note: "동의하지 않은 변경" }), /RECORD_RETRY_CHANGED/);
  await assert.rejects(save(album, { ...draft, rewatchCount: 4 }), /RECORD_RETRY_CHANGED/);
  await save(album, draft);
  assert.equal(logs.length, 1); assert.equal(library[0].rewatchCount, 3); assert.equal(library[0].score, 0);
  assert.equal(library[0].memo, "긴 기존 감상"); assert.equal(library[0].lastRewatchAt, null); assert.equal(dispatches, 1);
});
test("append failure does not change tracking, and unsaved titles are not silently created", async () => {
  let writes = 0;
  const config = { readLibrary: async () => [{ catalogAnimeId: animeId }], writeLibrary: async () => writes++,
    readWatchLogs: async () => [], createLog: (input) => input, appendLog: async () => { throw new Error("quota"); }, dispatchLibraryUpdated: () => {} };
  await assert.rejects(createTitleWatchRecordWriter(config)(album, draft), /quota/);
  assert.equal(writes, 0);
  await assert.rejects(createTitleWatchRecordWriter({ ...config, readLibrary: async () => [] })(album, draft), /TITLE_NOT_SAVEABLE/);
});
test("catalog-only watch records never become AniList zero in the legacy cloud writer", () => {
  const rows = buildWatchLogCloudRows("owner", [{ id: "own", catalogAnimeId: animeId, anilistId: null }, { id: "old", anilistId: 3, scoreAtThatTime: 0 }]);
  assert.equal(rows.length, 1); assert.equal(rows[0].anilist_id, 3); assert.equal(rows[0].score_at_that_time, 0);
});
test("a draft can change after a confirmed failed append without binding the wrong title or duplicating history", async () => {
  const logs = []; let failures = 1;
  const save = createTitleWatchRecordWriter({ readLibrary: async () => [{ catalogAnimeId: animeId }], writeLibrary: async () => {},
    readWatchLogs: async () => logs, createLog: (input) => input, appendLog: async (row) => { if (failures-- > 0) throw new Error("quota"); logs.push(row); return row; }, dispatchLibraryUpdated: () => {} });
  await assert.rejects(save(album, draft), /quota/);
  await save(album, { ...draft, note: "수정한 감상" });
  assert.equal(logs.length, 1); assert.equal(logs[0].note, "수정한 감상");
});
test("legacy English status is displayed consistently without an automatic write", () => {
  assert.equal(normalizeWatchStatus("completed"), "완료");
  assert.equal(normalizeWatchStatus("보는중"), "보는중");
});
