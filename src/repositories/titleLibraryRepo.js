import { readLibraryListPreferred, writeLibraryListDurable } from "./libraryRepo.js";
import { getMetaValue, putMetaValue, isIdbSupported } from "../storage/idb.js";
import { readJson, writeJson } from "../storage/localJsonStore.js";

const KEY = "moemoa:catalog-saved-titles:v1";
const ANIME_ID = /^anime:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const isCatalogSavedTitle = (item) => ANIME_ID.test(String(item?.catalogAnimeId || "")) && !item?.anilistId;

async function readCatalogTitles() {
  if (isIdbSupported()) {
    try {
      const stored = await getMetaValue(KEY);
      if (Array.isArray(stored)) return stored.filter(isCatalogSavedTitle);
    } catch { /* Recover the local mirror when IndexedDB cannot be read. */ }
  }
  const mirror = readJson(KEY, []);
  return Array.isArray(mirror) ? mirror.filter(isCatalogSavedTitle) : [];
}

export async function readTitleLibrary() {
  const [legacy, catalog] = await Promise.all([readLibraryListPreferred([]), readCatalogTitles()]);
  return [...legacy, ...catalog];
}

export async function writeTitleLibrary(items) {
  const catalog = items.filter(isCatalogSavedTitle);
  const legacy = items.filter((item) => !isCatalogSavedTitle(item));
  const previousLegacy = await readLibraryListPreferred([]);
  const previousCatalog = await readCatalogTitles();
  if (JSON.stringify(previousLegacy) !== JSON.stringify(legacy)) await writeLibraryListDurable(legacy);
  if (JSON.stringify(previousCatalog) !== JSON.stringify(catalog)) {
    if (isIdbSupported()) {
      await putMetaValue(KEY, catalog);
      writeJson(KEY, catalog);
    } else if (!writeJson(KEY, catalog)) {
      throw new Error("CATALOG_TITLE_SAVE_FAILED");
    }
  }
  return items;
}
