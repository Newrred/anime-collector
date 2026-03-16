import { STORAGE_KEYS } from "../storage/keys.js";
import { readJson, writeJson } from "../storage/localJsonStore.js";
import { getAllLibraryItemsIdb, replaceLibraryItemsIdb } from "../storage/idb.js";
import { markLocalDirty } from "./syncRepo.js";

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
    if (!options?.skipSyncMark) markLocalDirty();
  }
  replaceLibraryItemsIdb(list).catch(() => {});
}
