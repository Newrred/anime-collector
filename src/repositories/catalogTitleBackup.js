import { openAppDb } from "../storage/idb.js";
import { readJson, writeJson } from "../storage/localJsonStore.js";
import { readTitleLibrary, isCatalogSavedTitle } from "./titleLibraryRepo.js";
const KEY = "moemoa:catalog-saved-titles:v1";

export async function exportCatalogTitleBackup() {
  return {format: "moemoa-catalog-saved-titles", version: 1, titles: (await readTitleLibrary()).filter(isCatalogSavedTitle)};
}
export function validateCatalogTitleBackup(value) {
  if (value?.format !== "moemoa-catalog-saved-titles" || value.version !== 1 || !Array.isArray(value.titles) || value.titles.length > 50000) throw new Error("INVALID_TITLE_BACKUP");
  if (new Set(value.titles.map((r) => r?.catalogAnimeId)).size !== value.titles.length) throw new Error("DUPLICATE_TITLE");
  return value.titles.map((r) => {
    if (!isCatalogSavedTitle(r) || typeof r.koTitle !== "string" || !r.koTitle.trim() || r.koTitle.length > 500
      || !["미분류", "보는중", "완료", "보류", "하차", "볼예정"].includes(r.status)
      || (r.score != null && (!Number.isFinite(r.score) || r.score < 0 || r.score > 5))) throw new Error("INVALID_TITLE_BACKUP");
    return {catalogAnimeId: r.catalogAnimeId, anilistId: null, koTitle: r.koTitle, status: r.status, score: r.score ?? null,
      memo: String(r.memo || "").slice(0, 10000), rewatchCount: Number.isSafeInteger(r.rewatchCount) && r.rewatchCount >= 0 ? r.rewatchCount : 0,
      lastRewatchAt: r.lastRewatchAt || null, addedAt: Number.isFinite(r.addedAt) ? r.addedAt : Date.now()};
  });
}
export async function restoreCatalogTitleBackup(snapshot) {
  const titles = validateCatalogTitleBackup(snapshot);
  const db = await openAppDb();
  if (!db) throw new Error("INDEXEDDB_REQUIRED");
  const tx = db.transaction("meta", "readwrite");
  const completed = new Promise((resolve, reject) => {
    tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error("RESTORE_ABORTED")); tx.onerror = () => reject(tx.error);
  });
  const store = tx.objectStore("meta");
  try {
    const existing = await new Promise((resolve, reject) => { const req = store.get(KEY); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const previous = Array.isArray(existing?.value) ? existing.value : readJson(KEY, []);
    if (Array.isArray(previous) && previous.length) throw new Error("CATALOG_TITLES_NOT_EMPTY");
    store.put({key: KEY, value: titles, updatedAt: Date.now()});
    await completed;
  } catch (error) {
    try {tx.abort();} catch { /* Transaction already completed. */ }
    await completed.catch(() => {}); throw error;
  }
  writeJson(KEY, titles);
  globalThis.dispatchEvent?.(new Event("moemoa:library-updated"));
  return titles.length;
}
