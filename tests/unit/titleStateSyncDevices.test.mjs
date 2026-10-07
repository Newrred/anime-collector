import test from "node:test";
import assert from "node:assert/strict";
import { syncTitleState } from "../../src/features/titles/application/titleStateSync.js";
import { STORAGE_KEYS } from "../../src/storage/keys.js";

function device(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    read: key => JSON.parse(values.get(key) || "null"),
  };
}

function selectDevice(storage) {
  globalThis.window = { dispatchEvent() {} };
  globalThis.localStorage = storage;
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
}

function fakeServer(userId) {
  const rows = new Map();
  return {
    rows,
    auth: { getSession: async () => ({ data: { session: { user: { id: userId } } }, error: null }) },
    from() {
      return {
        select() { return this; }, eq() { return this; }, order() { return this; },
        async range(start, end) { return { data: [...rows.values()].slice(start, end + 1), error: null }; },
      };
    },
    async rpc(_name, input) {
      const id = `${input.p_kind}:${input.p_key}`;
      const prior = rows.get(id);
      if (Number(prior?.version || 0) !== input.p_expected_version) return { data: null, error: new Error("conflict") };
      const row = {
        entity_kind: input.p_kind, entity_key: input.p_key,
        payload: input.p_deleted ? {} : input.p_payload,
        version: Number(prior?.version || 0) + 1,
        updated_at: "2026-10-07T00:00:00Z",
        deleted_at: input.p_deleted ? "2026-10-07T00:00:00Z" : null,
      };
      rows.set(id, row);
      return { data: row, error: null };
    },
  };
}

test("PC records reach an initially empty phone and an old empty phone cannot erase them", async () => {
  const accountId = "account-sync-test";
  const server = fakeServer(accountId);
  const shelfKey = `moemoa:bookshelf:v1:${encodeURIComponent(`account:${accountId}`)}`;
  const pc = device({
    [STORAGE_KEYS.list]: [
      { anilistId: 1, koTitle: "첫 작품", status: "완료" },
      { anilistId: 2, koTitle: "둘째 작품", status: "보는중" },
    ],
    [STORAGE_KEYS.watchLogs]: [{ id: "watch-1", anilistId: 1, eventType: "완료", createdAt: 1, updatedAt: 1 }],
    [shelfKey]: { shelves: [{ id: "favorites", name: "좋아하는 작품", titleKeys: ["ANILIST:1", "ANILIST:2"] }] },
  });
  const phone = device({ [STORAGE_KEYS.list]: [{ koTitle: "기기 전용 메모" }] });
  selectDevice(pc);
  const beforeApproval = await syncTitleState(accountId, { client: server });
  assert.equal(beforeApproval.promotionRequired, true);
  assert.equal(server.rows.size, 0);
  const uploaded = await syncTitleState(accountId, { client: server, allowPromotion: true });
  assert.equal(uploaded.uploaded, 4);
  assert.equal(server.rows.size, 4);

  selectDevice(phone);
  const downloaded = await syncTitleState(accountId, { client: server });
  assert.equal(downloaded.downloaded, 4);
  assert.equal(phone.read(STORAGE_KEYS.list).length, 3);
  assert.equal(phone.read(STORAGE_KEYS.list).filter(item => !item.anilistId).length, 1);
  assert.equal(phone.read(STORAGE_KEYS.watchLogs).length, 1);
  assert.equal(phone.read(shelfKey).shelves[0].titleKeys.length, 2);
  const again = await syncTitleState(accountId, { client: server });
  assert.equal(again.uploaded, 0);
  assert.equal(again.downloaded, 0);
  assert.equal(server.rows.size, 4);

  selectDevice(pc);
  pc.setItem(STORAGE_KEYS.list, JSON.stringify([pc.read(STORAGE_KEYS.list)[0]]));
  const deleted = await syncTitleState(accountId, { client: server });
  assert.equal(deleted.uploaded, 1);
  assert.ok(server.rows.get("title:anilist:2").deleted_at);
  selectDevice(phone);
  const pulledDeletion = await syncTitleState(accountId, { client: server });
  assert.equal(pulledDeletion.downloaded, 1);
  assert.equal(phone.read(STORAGE_KEYS.list).length, 2);
  assert.equal(phone.read(STORAGE_KEYS.list).filter(item => item.anilistId === 1).length, 1);
  assert.equal(phone.read(STORAGE_KEYS.list).filter(item => !item.anilistId).length, 1);
});

test("a different account cannot upload an existing account's local titles", async () => {
  const sharedDevice = device({
    [STORAGE_KEYS.list]: [{ anilistId: 99, koTitle: "개인 작품" }],
    "moemoa:title-sync-local-owner:v1": "account-a",
  });
  selectDevice(sharedDevice);
  const otherAccount = fakeServer("account-b");
  await assert.rejects(syncTitleState("account-b", { client: otherAccount, allowPromotion: true }), /TITLE_SYNC_OTHER_ACCOUNT/);
  assert.equal(otherAccount.rows.size, 0);
});

test("an unreadable personal snapshot cannot be treated as a remote deletion", async () => {
  const accountId = "account-corrupt-local";
  const server = fakeServer(accountId);
  const corruptTitles = device({ [STORAGE_KEYS.watchLogs]: [] });
  corruptTitles.setItem(STORAGE_KEYS.list, "{broken");
  selectDevice(corruptTitles);
  await assert.rejects(syncTitleState(accountId, { client: server, allowPromotion: true }), /LIBRARY_SNAPSHOT_UNREADABLE/);
  assert.equal(server.rows.size, 0);

  const corruptLogs = device({ [STORAGE_KEYS.list]: [{ anilistId: 1, koTitle: "저장 작품" }] });
  corruptLogs.setItem(STORAGE_KEYS.watchLogs, "{broken");
  selectDevice(corruptLogs);
  await assert.rejects(syncTitleState(accountId, { client: server, allowPromotion: true }), /WATCH_LOG_SNAPSHOT_UNREADABLE/);
  assert.equal(server.rows.size, 0);
});

test("unavailable storage and a corrupt catalog mirror stop title sync before any remote write", async () => {
  const accountId = "account-unreadable-catalog";
  const server = fakeServer(accountId);
  selectDevice({ getItem() { throw new Error("storage denied"); } });
  await assert.rejects(syncTitleState(accountId, { client: server, allowPromotion: true }), /(LIBRARY|CATALOG_TITLE)_SNAPSHOT_UNREADABLE/);
  assert.equal(server.rows.size, 0);

  const corruptCatalog = device({ [STORAGE_KEYS.list]: [], [STORAGE_KEYS.watchLogs]: [] });
  corruptCatalog.setItem("moemoa:catalog-saved-titles:v1", "{broken");
  selectDevice(corruptCatalog);
  await assert.rejects(syncTitleState(accountId, { client: server, allowPromotion: true }), /CATALOG_TITLE_SNAPSHOT_UNREADABLE/);
  assert.equal(server.rows.size, 0);
});
