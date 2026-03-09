import { STORAGE_KEYS } from "../storage/keys";
import { readJson, writeJson } from "../storage/localJsonStore";
import { getAllLibraryItemsIdb, replaceLibraryItemsIdb } from "../storage/idb";

export function readLibraryList(fallback = []) {
  return readJson(STORAGE_KEYS.list, fallback);
}

export async function readLibraryListPreferred(fallback = []) {
  try {
    const rows = await getAllLibraryItemsIdb();
    if (Array.isArray(rows) && rows.length > 0) return rows;
  } catch {}
  return readLibraryList(fallback);
}

export function writeLibraryList(list, options = {}) {
  if (!options?.mirrorOnly) {
    writeJson(STORAGE_KEYS.list, list);
  }
  replaceLibraryItemsIdb(list).catch(() => {});
}
