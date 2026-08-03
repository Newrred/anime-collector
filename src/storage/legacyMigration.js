import { STORAGE_KEYS } from "./keys.js";
import { readJson, writeJson } from "./localJsonStore.js";
import {
  getMetaValue,
  getAllLibraryItemsIdb,
  getRecentWatchLogsIdb,
  getTierStateIdb,
  isIdbSupported,
  putMetaValue,
  putTierStateIdb,
  replaceLibraryItemsIdb,
  replaceWatchLogsIdb,
} from "./idb.js";
import {
  mergeLegacyLibraryRows,
  mergeLegacyWatchLogs,
  mergeTierStatePreferExisting,
} from "../services/legacyMigrationMerge.js";
import {
  getActiveTierTopic,
  normalizeTierTopicBundle,
  replaceActiveTierState,
} from "../domain/tierTopics.js";

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

function writeMergedLocalSnapshot(key, value) {
  if (!writeJson(key, value)) {
    throw new Error(`Failed to mirror migrated storage: ${key}`);
  }
}

let migrationPromise = null;

const defaultMigrationStorage = {
  getMetaValue,
  getAllLibraryItemsIdb,
  getRecentWatchLogsIdb,
  getTierStateIdb,
  isIdbSupported,
  putMetaValue,
  putTierStateIdb,
  replaceLibraryItemsIdb,
  replaceWatchLogsIdb,
};

export function ensureLegacyStorageMigrated(options = {}) {
  if (migrationPromise) return migrationPromise;

  const storage = {
    ...defaultMigrationStorage,
    ...(options.storage || {}),
  };

  const attempt = (async () => {
    if (!storage.isIdbSupported()) {
      return { mode: "legacy", migrated: false, reason: "idb-not-supported" };
    }

    const already = await storage.getMetaValue(MIGRATION_META_KEY);
    if (already?.done) {
      return { mode: "idb", migrated: false, reason: "already-migrated" };
    }

    const legacyList = sanitizeList(readJson(STORAGE_KEYS.list, []));
    const legacyTier = readJson(STORAGE_KEYS.tier, null);
    const rawWatchLogs = readJson(STORAGE_KEYS.watchLogs, []);
    const legacyWatchLogs = Array.isArray(rawWatchLogs) ? rawWatchLogs : [];

    const [existingList, existingTier, existingWatchLogs] = await Promise.all([
      storage.getAllLibraryItemsIdb(),
      storage.getTierStateIdb("default"),
      storage.getRecentWatchLogsIdb(Number.MAX_SAFE_INTEGER),
    ]);

    // The marker is committed last. If a prior attempt stopped halfway, IDB
    // can be nonempty but incomplete, so union both sources instead of
    // treating any nonempty store as authoritative.
    const mergedList = mergeLegacyLibraryRows(existingList, legacyList);
    if (mergedList.length > 0) {
      await storage.replaceLibraryItemsIdb(mergedList);
      writeMergedLocalSnapshot(STORAGE_KEYS.list, mergedList);
    }

    const hasLegacyTier = legacyTier && typeof legacyTier === "object";
    const legacyTierState = hasLegacyTier
      ? getActiveTierTopic(normalizeTierTopicBundle(legacyTier))?.tier
      : null;
    const hasTierSource = Boolean(existingTier || legacyTierState);
    const mergedTier = mergeTierStatePreferExisting(existingTier, legacyTierState);
    if (hasTierSource) {
      await storage.putTierStateIdb(mergedTier, "default");
      const baseBundle = normalizeTierTopicBundle(hasLegacyTier ? legacyTier : existingTier, mergedTier);
      writeMergedLocalSnapshot(
        STORAGE_KEYS.tier,
        replaceActiveTierState(baseBundle, mergedTier),
      );
    }

    const mergedWatchLogs = mergeLegacyWatchLogs(existingWatchLogs, legacyWatchLogs);
    if (mergedWatchLogs.length > 0) {
      await storage.replaceWatchLogsIdb(mergedWatchLogs);
      writeMergedLocalSnapshot(STORAGE_KEYS.watchLogs, mergedWatchLogs);
    }

    await storage.putMetaValue(MIGRATION_META_KEY, {
      done: true,
      migratedAt: new Date().toISOString(),
      listCount: mergedList.length,
      hasTier: hasTierSource,
      watchLogCount: mergedWatchLogs.length,
    });

    return { mode: "idb", migrated: true, listCount: mergedList.length };
  })();

  migrationPromise = attempt;
  attempt.catch(() => {
    if (migrationPromise === attempt) migrationPromise = null;
  });

  return migrationPromise;
}
