import { STORAGE_KEYS } from "../storage/keys.js";
import { readJson, readJsonSnapshot, writeJson } from "../storage/localJsonStore.js";
import { getAllLibraryItemsIdb, isIdbSupported, replaceLibraryItemsIdb } from "../storage/idb.js";
import { markLocalDirty } from "./syncRepo.js";

export function readLibraryList(fallback = []) {
  return readJson(STORAGE_KEYS.list, fallback);
}

export async function readLibraryListPreferred(fallback = []) {
  let idbFailed = false;
  try {
    const rows = await getAllLibraryItemsIdb();
    if (Array.isArray(rows) && rows.length > 0) return rows;
  } catch { idbFailed = true; }
  const mirror = readJsonSnapshot(STORAGE_KEYS.list);
  if (mirror.status === "valid") {
    if (!Array.isArray(mirror.value)) throw new Error("LIBRARY_SNAPSHOT_UNREADABLE");
    return mirror.value;
  }
  if (mirror.status === "invalid" || mirror.status === "unavailable" || (idbFailed && isIdbSupported())) {
    throw new Error("LIBRARY_SNAPSHOT_UNREADABLE");
  }
  return fallback;
}

export function writeLibraryList(list, options = {}) {
  if (!options?.mirrorOnly) {
    writeJson(STORAGE_KEYS.list, list);
    if (!options?.skipSyncMark) markLocalDirty();
  }
  replaceLibraryItemsIdb(list).catch(() => {});
}

export async function writeLibraryListDurable(list, options = {}) {
  if (!writeJson(STORAGE_KEYS.list, list)) {
    throw new Error("Failed to persist Library snapshot to localStorage");
  }
  if (!options?.skipSyncMark) markLocalDirty();
  const replaceIdb = options?.storage?.replaceLibraryItemsIdb || replaceLibraryItemsIdb;
  await replaceIdb(list);
  return list;
}
