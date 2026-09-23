import test from "node:test";
import assert from "node:assert/strict";
import { createUpdateMemoryCardCommand } from "../../src/features/memory/application/updateMemoryCard.js";
import { selectHomeRediscovery } from "../../src/features/memory/application/homeRediscovery.js";
import { buildTitleAlbumProjections } from "../../src/features/titles/application/titleAlbumProjection.js";
import { buildMemoryCardHref } from "../../src/domain/search/memoryCardNavigation.js";

test("last cover signal cannot be removed; another personal signal allows note removal", async () => {
  let writes = 0;
  const bundle = {card: {id: "c", ownerId: "guest:a", status: "COMPLETE_PRIVATE", note: "old"}, asset: {imageType: "CATALOG_COVER"}};
  const command = createUpdateMemoryCardCommand({ repository: {
    getCardBundle: async () => structuredClone(bundle),
    updateCardMetadata: async ({ changes }) => { writes++; return changes; },
  }, telemetry: { track() {} }, clock: { now: () => "2026-09-22" } });
  await assert.rejects(command.execute({ownerId: "guest:a", cardId: "c", note: "  "}), {code: "CATALOG_COVER_PERSONAL_SIGNAL_REQUIRED"});
  assert.equal(writes, 0);
  assert.equal(bundle.card.note, "old");
  bundle.card.sceneCue = "episode 2";
  assert.equal((await command.execute({ownerId: "guest:a", cardId: "c", note: ""})).note, null);
  assert.equal(writes, 1);
});

test("unrated values remain absent while an explicit zero is retained", () => {
  for (const score of [null, undefined, "", " ", 0, "0", 4.5]) {
    const [album] = buildTitleAlbumProjections({libraryItems: [{anilistId: 1, koTitle: "A", score}]});
    assert.equal(album.tracking.rating, score == null || String(score).trim() === "" ? null : Number(score));
  }
});

test("private composer navigation preserves stable identity, including native route", () => {
  const href = buildMemoryCardHref({native: true, row: {privateTitleId: "private:one", title: "A"}});
  assert.match(href, /index.html\?privateTitleId=private%3Aone/);
});

const bundle = (id, day, title = "one") => ({card: {id, privateTitleId: title, status: "COMPLETE_PRIVATE", createdAt: day, updatedAt: "2026-09-22", note: id}, title: {id: title, displayTitle: title}});
test("rediscovery is stable, disjoint and uses creation rather than edit time", () => {
  const archive = [bundle("1", "2026-09-22"), bundle("2", "2026-09-21"), bundle("3", "2026-09-20"), bundle("4", "2026-01-01"), bundle("5", "2026-02-01"), bundle("6", "2026-03-01"), bundle("7", "2026-04-01")];
  const now = Date.parse("2026-09-22");
  const groups = selectHomeRediscovery(archive, now);
  assert.deepEqual(groups, selectHomeRediscovery([...archive].reverse(), now + 1000));
  assert.equal(groups.recent.length, 3);
  assert.equal(groups.past.length, 1);
  assert.equal(groups.sameTitle.length, 2);
  const ids = Object.values(groups).flat().map(b => b.card.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(selectHomeRediscovery(archive.slice(0, 1), now).past.length, 0);
  assert.deepEqual(selectHomeRediscovery([], now), {recent: [], past: [], sameTitle: [], lines: []});
});
