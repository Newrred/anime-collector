import { STORAGE_KEYS } from "./keys";
import { readJson } from "./localJsonStore";
import {
  getMetaValue,
  isIdbSupported,
  putMetaValue,
  putTierStateIdb,
  replaceLibraryItemsIdb,
  replaceWatchLogsIdb,
} from "./idb";

const MIGRATION_META_KEY = "migratedFromLocalV1";

function sanitizeList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const it of list) {
    const id = Number(it?.anilistId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...it, anilistId: id });
  }
  return out;
}

let migrationPromise = null;

export function ensureLegacyStorageMigrated() {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    if (!isIdbSupported()) {
      return { mode: "legacy", migrated: false, reason: "idb-not-supported" };
    }

    const already = await getMetaValue(MIGRATION_META_KEY);
    if (already?.done) {
      return { mode: "idb", migrated: false, reason: "already-migrated" };
    }

    const legacyList = sanitizeList(readJson(STORAGE_KEYS.list, []));
    const legacyTier = readJson(STORAGE_KEYS.tier, null);
    const rawWatchLogs = readJson(STORAGE_KEYS.watchLogs, []);
    const legacyWatchLogs = Array.isArray(rawWatchLogs) ? rawWatchLogs : [];

    await replaceLibraryItemsIdb(legacyList);
    if (legacyTier && typeof legacyTier === "object") {
      await putTierStateIdb(legacyTier, "default");
    }
    if (legacyWatchLogs.length) {
      await replaceWatchLogsIdb(legacyWatchLogs);
    }

    await putMetaValue(MIGRATION_META_KEY, {
      done: true,
      migratedAt: new Date().toISOString(),
      listCount: legacyList.length,
      hasTier: !!legacyTier,
      watchLogCount: legacyWatchLogs.length,
    });

    return { mode: "idb", migrated: true, listCount: legacyList.length };
  })().catch((error) => {
    console.error("[storage] legacy migration failed", error);
    return { mode: "legacy", migrated: false, reason: "error" };
  });

  return migrationPromise;
}
