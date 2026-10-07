import test from "node:test";
import assert from "node:assert/strict";
import { makeTitleSyncLocalMap, planTitleSync, titleSyncKey } from "../../src/features/titles/application/titleStateSync.js";

const title = (id, status = "미분류") => ({ anilistId: id, koTitle: `작품 ${id}`, status });
const remote = (kind, key, payload, version = 1, deleted = false) => ({
  entity_kind: kind, entity_key: key, payload: deleted ? {} : payload, version,
  deleted_at: deleted ? "2026-10-07T00:00:00Z" : null,
});

test("first account sync uploads local titles while an empty phone downloads them", () => {
  const pc = makeTitleSyncLocalMap({ titles: [title(1), title(2)] });
  const first = planTitleSync(pc, [], {});
  assert.equal(first.push.length, 2);
  assert.equal(first.pull.length, 0);
  const phone = planTitleSync(new Map(), [remote("title", "anilist:1", title(1)), remote("title", "anilist:2", title(2))], {});
  assert.equal(phone.push.length, 0);
  assert.equal(phone.pull.length, 2);
  assert.equal(phone.conflicts.length, 0);
});

test("catalog-only titles and watch logs receive distinct stable identities", () => {
  const catalogAnimeId = "anime:d3821c62-5010-49db-a751-1d56e87fdcd1";
  const entries = makeTitleSyncLocalMap({
    titles: [{ catalogAnimeId, anilistId: null, koTitle: "자체 작품" }],
    watchLogs: [{ id: "watch-1", catalogAnimeId, anilistId: null }],
  });
  assert.equal(titleSyncKey({ catalogAnimeId, anilistId: null }), catalogAnimeId);
  assert.deepEqual([...entries.keys()], [`title:${catalogAnimeId}`, "watch_log:log:watch-1"]);
});

test("duplicate title identities stop sync before either copy can be overwritten", () => {
  assert.throws(
    () => makeTitleSyncLocalMap({ titles: [title(1), title(1, "완료")] }),
    /TITLE_SYNC_DUPLICATE_KEY/,
  );
});

test("a stale empty device cannot delete the server title without a baseline", () => {
  const plan = planTitleSync(new Map(), [remote("title", "anilist:1", title(1))], {});
  assert.equal(plan.push.length, 0);
  assert.equal(plan.pull.length, 1);
});

test("explicit local deletion creates a tombstone only from an acknowledged baseline", () => {
  const item = title(1);
  const acknowledged = planTitleSync(makeTitleSyncLocalMap({ titles: [item] }), [remote("title", "anilist:1", item, 3)], {});
  const base = { "title:anilist:1": { kind: "title", key: "anilist:1", ...acknowledged.acknowledge[0] } };
  const plan = planTitleSync(new Map(), [remote("title", "anilist:1", item, 3)], base);
  assert.deepEqual(plan.push.map(row => ({ deleted: row.deleted, expectedVersion: row.expectedVersion })), [{ deleted: true, expectedVersion: 3 }]);
});

test("simultaneous edits to the same title do not overwrite either version", () => {
  const original = title(1);
  const acknowledged = planTitleSync(makeTitleSyncLocalMap({ titles: [original] }), [remote("title", "anilist:1", original, 1)], {});
  const base = { "title:anilist:1": { kind: "title", key: "anilist:1", ...acknowledged.acknowledge[0] } };
  const plan = planTitleSync(makeTitleSyncLocalMap({ titles: [title(1, "완료")] }), [remote("title", "anilist:1", title(1, "보는중"), 2)], base);
  assert.equal(plan.push.length, 0);
  assert.equal(plan.pull.length, 0);
  assert.equal(plan.conflicts.length, 1);
});
