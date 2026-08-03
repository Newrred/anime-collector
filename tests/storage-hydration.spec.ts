import { expect, test, type Page } from "@playwright/test";

const DB_NAME = "anime-collector-db";

async function seedIdbOnlyState(
  page: Page,
  {
    list,
    tier,
    watchLogs = [],
    localList,
    localTier,
    localWatchLogs,
  }: {
    list: Array<Record<string, unknown>>;
    tier?: Record<string, unknown>;
    watchLogs?: Array<Record<string, unknown>>;
    localList?: Array<Record<string, unknown>>;
    localTier?: Record<string, unknown>;
    localWatchLogs?: Array<Record<string, unknown>>;
  },
) {
  // Use a static same-origin document so no app module can start migration
  // before this interrupted-state fixture is fully installed.
  await page.goto("/favicon.svg");
  await page.evaluate(
    async ({ dbName, rows, tierState, logs, legacyRows, legacyTier, legacyLogs }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          const nextDb = request.result;
          if (!nextDb.objectStoreNames.contains("library_items")) {
            const store = nextDb.createObjectStore("library_items", { keyPath: "anilistId" });
            store.createIndex("status", "status", { unique: false });
            store.createIndex("score", "score", { unique: false });
            store.createIndex("addedAt", "addedAt", { unique: false });
          }
          if (!nextDb.objectStoreNames.contains("watch_logs")) {
            const store = nextDb.createObjectStore("watch_logs", { keyPath: "id" });
            store.createIndex("anilistId", "anilistId", { unique: false });
            store.createIndex("watchedAtSort", "watchedAtSort", { unique: false });
            store.createIndex("eventType", "eventType", { unique: false });
            store.createIndex("characterIds", "characterIds", { unique: false, multiEntry: true });
          }
          if (!nextDb.objectStoreNames.contains("character_pins")) {
            const store = nextDb.createObjectStore("character_pins", { keyPath: "id" });
            store.createIndex("characterId", "characterId", { unique: false });
            store.createIndex("pinnedAt", "pinnedAt", { unique: false });
            store.createIndex("mediaId", "mediaId", { unique: false });
          }
          if (!nextDb.objectStoreNames.contains("tier_state")) {
            nextDb.createObjectStore("tier_state", { keyPath: "scope" });
          }
          if (!nextDb.objectStoreNames.contains("media_cache")) {
            const store = nextDb.createObjectStore("media_cache", { keyPath: "anilistId" });
            store.createIndex("cachedAt", "cachedAt", { unique: false });
            store.createIndex("detailLevel", "detailLevel", { unique: false });
          }
          if (!nextDb.objectStoreNames.contains("search_cache")) {
            const store = nextDb.createObjectStore("search_cache", { keyPath: "queryKey" });
            store.createIndex("cachedAt", "cachedAt", { unique: false });
          }
          if (!nextDb.objectStoreNames.contains("meta")) {
            nextDb.createObjectStore("meta", { keyPath: "key" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const stores = ["library_items", "watch_logs", "meta", ...(tierState ? ["tier_state"] : [])];
      const tx = db.transaction(stores, "readwrite");
      const libraryStore = tx.objectStore("library_items");
      libraryStore.clear();
      for (const row of rows) libraryStore.put(row);
      const watchLogStore = tx.objectStore("watch_logs");
      watchLogStore.clear();
      for (const log of logs) watchLogStore.put(log);
      if (tierState) {
        const tierStore = tx.objectStore("tier_state");
        tierStore.clear();
        tierStore.put({ scope: "default", tierState, updatedAt: Date.now() });
      }
      tx.objectStore("meta").delete("migratedFromLocalV1");
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
      if (legacyRows) localStorage.setItem("anime:list:v1", JSON.stringify(legacyRows));
      else localStorage.removeItem("anime:list:v1");
      if (legacyTier) localStorage.setItem("anime:tier:v1", JSON.stringify(legacyTier));
      else localStorage.removeItem("anime:tier:v1");
      if (legacyLogs) localStorage.setItem("anime:watchLogs:v1", JSON.stringify(legacyLogs));
      else localStorage.removeItem("anime:watchLogs:v1");
    },
    {
      dbName: DB_NAME,
      rows: list,
      tierState: tier || null,
      logs: watchLogs,
      legacyRows: localList || null,
      legacyTier: localTier || null,
      legacyLogs: localWatchLogs || null,
    },
  );
}

async function readIdbState(page: Page) {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(["library_items", "tier_state", "meta"], "readonly");
    const libraryRequest = tx.objectStore("library_items").getAll();
    const tierRequest = tx.objectStore("tier_state").get("default");
    const migrationRequest = tx.objectStore("meta").get("migratedFromLocalV1");
    const [library, tierRow, migrationRow] = await Promise.all([
      new Promise<unknown[]>((resolve, reject) => {
        libraryRequest.onsuccess = () => resolve(libraryRequest.result);
        libraryRequest.onerror = () => reject(libraryRequest.error);
      }),
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        tierRequest.onsuccess = () => resolve(tierRequest.result);
        tierRequest.onerror = () => reject(tierRequest.error);
      }),
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        migrationRequest.onsuccess = () => resolve(migrationRequest.result);
        migrationRequest.onerror = () => reject(migrationRequest.error);
      }),
    ]);
    db.close();
    return {
      library,
      tier: tierRow?.tierState || null,
      migration: migrationRow?.value || null,
    };
  }, DB_NAME);
}

test("Library preserves an IndexedDB-only collection through startup hydration", async ({ page }) => {
  await seedIdbOnlyState(page, {
    list: [{ anilistId: 777, status: "completed", score: 8, memo: "IDB only", addedAt: 1 }],
  });

  await page.goto("/library/");
  await expect.poll(async () => (await readIdbState(page)).library).toHaveLength(1);
  const state = await readIdbState(page);
  expect(state.library[0]).toMatchObject({ anilistId: 777, memo: "IDB only" });
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]")),
  ).toHaveLength(1);
});

test("Tier preserves IndexedDB-only ranking state through startup hydration", async ({ page }) => {
  const tier = {
    unranked: [],
    tiers: { S: [777], A: [], B: [], C: [], D: [] },
  };
  await seedIdbOnlyState(page, {
    list: [{ anilistId: 777, status: "completed", score: 8, memo: "IDB only", addedAt: 1 }],
    tier,
  });

  await page.goto("/tier/");
  await expect.poll(async () => (await readIdbState(page)).library).toHaveLength(1);
  await expect.poll(async () => (await readIdbState(page)).tier).toMatchObject(tier);
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem("anime:tier:v1") || "null")),
  ).not.toBeNull();
});

test("interrupted migration merges partial IDB with complete local Library and Tier state", async ({ page }) => {
  const partialTier = {
    unranked: [],
    tiers: { S: [777], A: [], B: [], C: [], D: [] },
  };
  const completeTier = {
    unranked: [778],
    tiers: { S: [777], A: [], B: [], C: [], D: [] },
  };
  await seedIdbOnlyState(page, {
    list: [{ anilistId: 777, status: "completed", memo: "newer IDB", addedAt: 2 }],
    tier: partialTier,
    localList: [
      { anilistId: 777, status: "completed", memo: "older local", addedAt: 1 },
      { anilistId: 778, status: "completed", memo: "local only", addedAt: 3 },
    ],
    localTier: completeTier,
  });

  await page.goto("/library/");
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]")),
  ).toHaveLength(2);
  await expect.poll(async () => (await readIdbState(page)).library).toHaveLength(2);

  const libraryState = await readIdbState(page);
  expect(libraryState.library).toEqual(expect.arrayContaining([
    expect.objectContaining({ anilistId: 777, memo: "newer IDB" }),
    expect.objectContaining({ anilistId: 778, memo: "local only" }),
  ]));

  await page.goto("/tier/");
  await expect.poll(async () => (await readIdbState(page)).tier).toMatchObject(completeTier);
  await expect.poll(() => page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("anime:tier:v1") || "null");
    const topic = Array.isArray(raw?.topics)
      ? raw.topics.find((row: { id?: string }) => row?.id === raw.activeTopicId) || raw.topics[0]
      : null;
    return topic?.tier || raw;
  })).toMatchObject(completeTier);
});

test("migration marker stays unset when the merged local mirror cannot be written", async ({ page }) => {
  await seedIdbOnlyState(page, {
    list: [{ anilistId: 777, status: "completed", memo: "IDB row", addedAt: 1 }],
    localList: [
      { anilistId: 777, status: "completed", memo: "older local", addedAt: 1 },
      { anilistId: 778, status: "completed", memo: "local only", addedAt: 2 },
    ],
  });
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === "anime:list:v1") {
        throw new DOMException("Injected local mirror failure", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.goto("/library/");
  await expect.poll(async () => (await readIdbState(page)).library).toHaveLength(2);
  expect((await readIdbState(page)).migration).toBeNull();
});

test("an IndexedDB-only watch-log migration restores the complete local source", async ({ page }) => {
  await seedIdbOnlyState(page, {
    list: [
      { anilistId: 777, status: "completed", addedAt: 1 },
      { anilistId: 778, status: "completed", addedAt: 2 },
    ],
    watchLogs: [
      { id: "log-777", anilistId: 777, eventType: "completed", watchedAtSort: 2, cue: "first", createdAt: 2 },
      { id: "log-778", anilistId: 778, eventType: "completed", watchedAtSort: 1, cue: "second", createdAt: 1 },
    ],
  });

  await page.goto("/library/?animeId=777");
  await expect(page.locator(".modal")).toBeVisible();
  await page.locator(".modal .library-modal-tab").nth(1).click();
  await expect(page.locator(".library-modal-log-card")).toHaveCount(1);
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]")),
  ).toHaveLength(2);
});

test("IDB-only watch logs reach snapshot export and Home before any Library scoped read", async ({ page }) => {
  await seedIdbOnlyState(page, {
    list: [
      { anilistId: 777, status: "completed", addedAt: 1 },
      { anilistId: 778, status: "completed", addedAt: 2 },
      { anilistId: 779, status: "completed", addedAt: 3 },
    ],
    watchLogs: [{
      id: "home-export-log",
      anilistId: 777,
      eventType: "completed",
      watchedAtPrecision: "day",
      watchedAtValue: "2026-08-01",
      watchedAtSort: Date.UTC(2026, 7, 1),
      cue: "IDB memory reaches Home and export",
      createdAt: Date.UTC(2026, 7, 1),
      updatedAt: Date.UTC(2026, 7, 1),
    }],
  });

  const snapshot = await page.evaluate(async () => {
    const { exportSyncSnapshot } = await import("/src/domain/snapshotCodec.js");
    return exportSyncSnapshot();
  });
  expect(snapshot.watchLogs).toHaveLength(1);
  expect(snapshot.watchLogs[0]).toMatchObject({
    id: "home-export-log",
    cue: "IDB memory reaches Home and export",
  });

  await page.goto("/");
  await expect(page.locator(".home-focus-card__cue")).toHaveText("IDB memory reaches Home and export");
});
