const DB_NAME = "anime-collector-db";
const DB_VERSION = 1;

const STORE_LIBRARY = "library_items";
const STORE_WATCH_LOGS = "watch_logs";
const STORE_CHARACTER_PINS = "character_pins";
const STORE_TIER = "tier_state";
const STORE_MEDIA_CACHE = "media_cache";
const STORE_SEARCH_CACHE = "search_cache";
const STORE_META = "meta";

function isBrowser() {
  return typeof window !== "undefined";
}

export function isIdbSupported() {
  return isBrowser() && typeof indexedDB !== "undefined";
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

let dbOpenPromise = null;

export function openAppDb() {
  if (!isIdbSupported()) return Promise.resolve(null);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_LIBRARY)) {
        const s = db.createObjectStore(STORE_LIBRARY, { keyPath: "anilistId" });
        s.createIndex("status", "status", { unique: false });
        s.createIndex("score", "score", { unique: false });
        s.createIndex("addedAt", "addedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_WATCH_LOGS)) {
        const s = db.createObjectStore(STORE_WATCH_LOGS, { keyPath: "id" });
        s.createIndex("anilistId", "anilistId", { unique: false });
        s.createIndex("watchedAtSort", "watchedAtSort", { unique: false });
        s.createIndex("eventType", "eventType", { unique: false });
        s.createIndex("characterIds", "characterIds", { unique: false, multiEntry: true });
      }

      if (!db.objectStoreNames.contains(STORE_CHARACTER_PINS)) {
        const s = db.createObjectStore(STORE_CHARACTER_PINS, { keyPath: "id" });
        s.createIndex("characterId", "characterId", { unique: false });
        s.createIndex("pinnedAt", "pinnedAt", { unique: false });
        s.createIndex("mediaId", "mediaId", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_TIER)) {
        db.createObjectStore(STORE_TIER, { keyPath: "scope" });
      }

      if (!db.objectStoreNames.contains(STORE_MEDIA_CACHE)) {
        const s = db.createObjectStore(STORE_MEDIA_CACHE, { keyPath: "anilistId" });
        s.createIndex("cachedAt", "cachedAt", { unique: false });
        s.createIndex("detailLevel", "detailLevel", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SEARCH_CACHE)) {
        const s = db.createObjectStore(STORE_SEARCH_CACHE, { keyPath: "queryKey" });
        s.createIndex("cachedAt", "cachedAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });

  return dbOpenPromise;
}

async function withStore(storeName, mode, fn) {
  const db = await openAppDb();
  if (!db) return null;
  const tx = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);
  const result = await fn(store, tx);
  await txDone(tx);
  return result;
}

export async function replaceLibraryItemsIdb(list) {
  const rows = Array.isArray(list) ? list : [];
  return withStore(STORE_LIBRARY, "readwrite", async (store) => {
    await reqToPromise(store.clear());
    for (const row of rows) {
      await reqToPromise(store.put(row));
    }
    return rows.length;
  });
}

export async function getAllLibraryItemsIdb() {
  const rows = await withStore(STORE_LIBRARY, "readonly", async (store) => reqToPromise(store.getAll()));
  return Array.isArray(rows) ? rows : [];
}

export async function putTierStateIdb(tierState, scope = "default") {
  return withStore(STORE_TIER, "readwrite", async (store) => {
    await reqToPromise(
      store.put({
        scope,
        tierState,
        updatedAt: Date.now(),
      })
    );
    return true;
  });
}

export async function getTierStateIdb(scope = "default") {
  const row = await withStore(STORE_TIER, "readonly", async (store) => reqToPromise(store.get(scope)));
  return row?.tierState ?? null;
}

export async function putWatchLogIdb(log) {
  if (!log || typeof log !== "object") return false;
  return withStore(STORE_WATCH_LOGS, "readwrite", async (store) => {
    await reqToPromise(store.put(log));
    return true;
  });
}

export async function replaceWatchLogsIdb(logs) {
  const rows = Array.isArray(logs) ? logs : [];
  return withStore(STORE_WATCH_LOGS, "readwrite", async (store) => {
    await reqToPromise(store.clear());
    for (const row of rows) {
      await reqToPromise(store.put(row));
    }
    return rows.length;
  });
}

export async function putCharacterPinIdb(pin) {
  if (!pin || typeof pin !== "object") return false;
  const id = String(pin?.id || "").trim();
  if (!id) return false;
  return withStore(STORE_CHARACTER_PINS, "readwrite", async (store) => {
    await reqToPromise(store.put(pin));
    return true;
  });
}

export async function deleteCharacterPinIdb(pinId) {
  const id = String(pinId || "").trim();
  if (!id) return false;
  return withStore(STORE_CHARACTER_PINS, "readwrite", async (store) => {
    await reqToPromise(store.delete(id));
    return true;
  });
}

export async function getAllCharacterPinsIdb() {
  const rows = await withStore(STORE_CHARACTER_PINS, "readonly", async (store) => reqToPromise(store.getAll()));
  return Array.isArray(rows) ? rows : [];
}

export async function replaceCharacterPinsIdb(pins) {
  const rows = Array.isArray(pins) ? pins : [];
  return withStore(STORE_CHARACTER_PINS, "readwrite", async (store) => {
    await reqToPromise(store.clear());
    for (const row of rows) {
      const id = String(row?.id || "").trim();
      if (!id) continue;
      await reqToPromise(store.put(row));
    }
    return true;
  });
}

export async function getWatchLogsByAnimeIdIdb(anilistId) {
  const id = Number(anilistId);
  if (!Number.isFinite(id)) return [];
  const rows = await withStore(STORE_WATCH_LOGS, "readonly", async (store) => {
    const index = store.index("anilistId");
    return reqToPromise(index.getAll(id));
  });
  return Array.isArray(rows) ? rows : [];
}

export async function getRecentWatchLogsIdb(limit = 30) {
  const rows = await withStore(STORE_WATCH_LOGS, "readonly", async (store) => reqToPromise(store.getAll()));
  const list = Array.isArray(rows) ? rows : [];
  list.sort((a, b) => Number(b?.watchedAtSort || 0) - Number(a?.watchedAtSort || 0));
  return list.slice(0, Math.max(1, Number(limit) || 30));
}

export async function putSearchCacheEntryIdb(entry) {
  if (!entry || typeof entry !== "object") return false;
  const key = String(entry?.queryKey || "").trim();
  if (!key) return false;
  return withStore(STORE_SEARCH_CACHE, "readwrite", async (store) => {
    await reqToPromise(
      store.put({
        queryKey: key,
        ts: Number.isFinite(Number(entry?.ts)) ? Number(entry.ts) : Date.now(),
        results: Array.isArray(entry?.results) ? entry.results : [],
      })
    );
    return true;
  });
}

export async function getAllSearchCacheEntriesIdb() {
  const rows = await withStore(STORE_SEARCH_CACHE, "readonly", async (store) => reqToPromise(store.getAll()));
  return Array.isArray(rows) ? rows : [];
}

export async function replaceSearchCacheEntriesIdb(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  return withStore(STORE_SEARCH_CACHE, "readwrite", async (store) => {
    await reqToPromise(store.clear());
    for (const row of rows) {
      const key = String(row?.queryKey || "").trim();
      if (!key) continue;
      await reqToPromise(
        store.put({
          queryKey: key,
          ts: Number.isFinite(Number(row?.ts)) ? Number(row.ts) : Date.now(),
          results: Array.isArray(row?.results) ? row.results : [],
        })
      );
    }
    return true;
  });
}

export async function putMetaValue(key, value) {
  return withStore(STORE_META, "readwrite", async (store) => {
    await reqToPromise(
      store.put({
        key,
        value,
        updatedAt: Date.now(),
      })
    );
    return true;
  });
}

export async function getMetaValue(key) {
  const row = await withStore(STORE_META, "readonly", async (store) => reqToPromise(store.get(key)));
  return row?.value ?? null;
}
