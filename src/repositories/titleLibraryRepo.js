import { readLibraryListPreferred, writeLibraryListDurable } from "./libraryRepo.js";
import { getMetaValue, putMetaValue, isIdbSupported } from "../storage/idb.js";
import { readJsonSnapshot, writeJson } from "../storage/localJsonStore.js";
import { markLocalDirty } from "./syncRepo.js";

const KEY = "moemoa:catalog-saved-titles:v1";
const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const isCatalogSavedTitle = (item) => ANIME_ID.test(String(item?.catalogAnimeId || "")) && !item?.anilistId;

async function readCatalogTitles() {
  let idbFailed = false;
  let idbRows = null;
  if (isIdbSupported()) {
    try {
      const stored = await getMetaValue(KEY);
      if (Array.isArray(stored)) idbRows = stored.filter(isCatalogSavedTitle);
      else if (stored != null) throw new Error("CATALOG_TITLE_SNAPSHOT_UNREADABLE");
    } catch { idbFailed = true; }
  }
  const mirror = readJsonSnapshot(KEY);
  if (idbRows?.length) return idbRows;
  if (mirror.status === "valid") {
    if (!Array.isArray(mirror.value)) throw new Error("CATALOG_TITLE_SNAPSHOT_UNREADABLE");
    if (idbRows && mirror.value.some(isCatalogSavedTitle)) throw new Error("CATALOG_TITLE_SNAPSHOT_UNREADABLE");
    return mirror.value.filter(isCatalogSavedTitle);
  }
  if (mirror.status === "invalid" || mirror.status === "unavailable" || idbFailed) throw new Error("CATALOG_TITLE_SNAPSHOT_UNREADABLE");
  return [];
}

export async function readTitleLibrary() {
  const [legacy, catalog] = await Promise.all([readLibraryListPreferred([]), readCatalogTitles()]);
  return [...legacy, ...catalog];
}

export async function writeTitleLibrary(items, options = {}) {
  const catalog = items.filter(isCatalogSavedTitle);
  const legacy = items.filter((item) => !isCatalogSavedTitle(item));
  const previousLegacy = await readLibraryListPreferred([]);
  const previousCatalog = await readCatalogTitles();
  const legacyChanged = JSON.stringify(previousLegacy) !== JSON.stringify(legacy);
  if (legacyChanged) await writeLibraryListDurable(legacy, options);
  if (JSON.stringify(previousCatalog) !== JSON.stringify(catalog)) {
    if (isIdbSupported()) {
      await putMetaValue(KEY, catalog);
      writeJson(KEY, catalog);
    } else if (!writeJson(KEY, catalog)) {
      throw new Error("CATALOG_TITLE_SAVE_FAILED");
    }
    if (!legacyChanged && !options.skipSyncMark) markLocalDirty();
  }
  return items;
}
