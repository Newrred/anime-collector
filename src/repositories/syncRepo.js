import { readJson, readString, writeJson, writeString } from "../storage/localJsonStore.js";
import { STORAGE_KEYS } from "../storage/keys.js";
import { supabase } from "../lib/supabaseClient.js";
import {
  SYNC_SNAPSHOT_VERSION,
  applySyncSnapshot,
  downloadSnapshotJson,
  encodeSyncSnapshot,
  exportSyncSnapshot,
  isSnapshotEffectivelyEmpty,
  normalizeSyncSnapshot,
} from "../domain/snapshotCodec.js";
import { hashSnapshot } from "../domain/syncHash.js";
import {
  buildCharacterPinCloudRows,
  buildLibraryCloudRows,
  buildPreferenceCloudRow,
  buildWatchLogCloudRows,
  characterPinCloudRowsToPins,
  diffCloudRows,
  libraryCloudRowsToItems,
  maxIsoTimestamps,
  preferenceCloudRowToPreferences,
  watchLogCloudRowsToLogs,
} from "../domain/cloudSyncTables.js";

const SYNC_EVENT = "ani:sync-meta-change";
const TIER_SNAPSHOT_TABLE = "user_snapshots";
const LIBRARY_TABLE = "user_library_items";
const WATCH_LOG_TABLE = "user_watch_logs";
const CHARACTER_PIN_TABLE = "user_character_pins";
const PREFERENCE_TABLE = "user_preferences";

function emitSyncMetaChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

function normalizeIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function readPendingFlag() {
  return readJson(STORAGE_KEYS.syncPending, false) === true;
}

function hasTierData(snapshot) {
  const safe = normalizeSyncSnapshot(snapshot);
  if (safe.tier.unranked.length > 0) return true;
  return Object.values(safe.tier.tiers || {}).some((rows) => Array.isArray(rows) && rows.length > 0);
}

function buildTierOnlySnapshot(snapshot) {
  const safe = normalizeSyncSnapshot(snapshot);
  return normalizeSyncSnapshot({
    app: "ani-site",
    version: SYNC_SNAPSHOT_VERSION,
    exportedAt: safe.exportedAt,
    tier: safe.tier,
    tierTopics: safe.tierTopics,
  });
}

function normalizeTierRemoteRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    snapshot: normalizeSyncSnapshot(row.snapshot),
    schemaVersion:
      Number(row.schema_version) ||
      Number(row?.snapshot?.v) ||
      Number(row?.snapshot?.version) ||
      SYNC_SNAPSHOT_VERSION,
    contentHash: String(row.content_hash || "").trim() || null,
    updatedAt: normalizeIso(row.updated_at),
    deviceId: String(row.device_id || "").trim() || null,
    appVersion: String(row.app_version || "").trim() || null,
  };
}

function buildRemoteCompositeSnapshot({
  tierRow,
  libraryRows,
  watchLogRows,
  characterPinRows,
  preferenceRow,
}) {
  const legacySnapshot = tierRow?.snapshot ? normalizeSyncSnapshot(tierRow.snapshot) : null;
  const splitList = libraryCloudRowsToItems(libraryRows);
  const splitLogs = watchLogCloudRowsToLogs(watchLogRows);
  const splitPins = characterPinCloudRowsToPins(characterPinRows);
  const splitPreferences = preferenceCloudRowToPreferences(preferenceRow);

  const legacySources = {
    list: splitList.length === 0 && (legacySnapshot?.list?.length || 0) > 0,
    watchLogs: splitLogs.length === 0 && (legacySnapshot?.watchLogs?.length || 0) > 0,
    characterPins: splitPins.length === 0 && (legacySnapshot?.characterPins?.length || 0) > 0,
    preferences: !splitPreferences && legacySnapshot?.preferences != null,
    tier: Boolean(legacySnapshot),
  };

  const snapshot = normalizeSyncSnapshot({
    app: "ani-site",
    version: SYNC_SNAPSHOT_VERSION,
    exportedAt: legacySnapshot?.exportedAt || new Date(0).toISOString(),
    list: splitList.length ? splitList : legacySnapshot?.list || [],
    watchLogs: splitLogs.length ? splitLogs : legacySnapshot?.watchLogs || [],
    characterPins: splitPins.length ? splitPins : legacySnapshot?.characterPins || [],
    preferences: splitPreferences || legacySnapshot?.preferences,
    tier: legacySnapshot?.tier,
    tierTopics: legacySnapshot?.tierTopics || legacySnapshot?.tier,
  });

  return {
    snapshot,
    legacySources,
    hasAnyData:
      splitList.length > 0 ||
      splitLogs.length > 0 ||
      splitPins.length > 0 ||
      Boolean(splitPreferences) ||
      Boolean(legacySnapshot),
  };
}

async function readTierSnapshotRow(userId) {
  const { data, error } = await supabase
    .from(TIER_SNAPSHOT_TABLE)
    .select("user_id,snapshot,schema_version,content_hash,updated_at,device_id,app_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return normalizeTierRemoteRow(data);
}

async function readLibraryRows(userId) {
  const { data, error } = await supabase
    .from(LIBRARY_TABLE)
    .select("user_id,anilist_id,ko_title,status,score,memo,rewatch_count,last_rewatch_at,sort_order,updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function readWatchLogRows(userId) {
  const { data, error } = await supabase
    .from(WATCH_LOG_TABLE)
    .select("user_id,log_id,anilist_id,event_type,watched_at_value,watched_at_precision,cue,note,score_at_that_time,context_tags,character_refs,created_at,updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function readCharacterPinRows(userId) {
  const { data, error } = await supabase
    .from(CHARACTER_PIN_TABLE)
    .select("user_id,pin_id,character_id,media_id,name_snapshot,image_snapshot,note,pin_reason,linked_log_id,sort_order,updated_at")
    .eq("user_id", userId);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function readPreferenceRow(userId) {
  const { data, error } = await supabase
    .from(PREFERENCE_TABLE)
    .select("user_id,cards_per_row_base,card_view,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertRows(table, rows, onConflict) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw error;
}

async function deleteRowsByKeys(table, userId, keyColumn, keys) {
  if (!keys.length) return;
  const chunkSize = 200;
  for (let index = 0; index < keys.length; index += chunkSize) {
    const slice = keys.slice(index, index + chunkSize);
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in(keyColumn, slice);
    if (error) throw error;
  }
}

async function replaceLibraryRows(userId, localSnapshot, remoteState, updatedAt) {
  const localRows = buildLibraryCloudRows(userId, localSnapshot.list, updatedAt);
  const remoteRows = buildLibraryCloudRows(userId, remoteState.snapshot.list, remoteState.updatedAt || updatedAt);
  const { upsertRows: rowsToUpsert, deleteKeys } = diffCloudRows(localRows, remoteRows, "anilist_id", {
    forceAll: remoteState.legacySources.list,
  });
  await upsertRows(LIBRARY_TABLE, rowsToUpsert, "user_id,anilist_id");
  await deleteRowsByKeys(LIBRARY_TABLE, userId, "anilist_id", deleteKeys);
}

async function replaceWatchLogRows(userId, localSnapshot, remoteState, updatedAt) {
  const localRows = buildWatchLogCloudRows(userId, localSnapshot.watchLogs, updatedAt);
  const remoteRows = buildWatchLogCloudRows(userId, remoteState.snapshot.watchLogs, remoteState.updatedAt || updatedAt);
  const { upsertRows: rowsToUpsert, deleteKeys } = diffCloudRows(localRows, remoteRows, "log_id", {
    forceAll: remoteState.legacySources.watchLogs,
  });
  await upsertRows(WATCH_LOG_TABLE, rowsToUpsert, "user_id,log_id");
  await deleteRowsByKeys(WATCH_LOG_TABLE, userId, "log_id", deleteKeys);
}

async function replaceCharacterPinRows(userId, localSnapshot, remoteState, updatedAt) {
  const localRows = buildCharacterPinCloudRows(userId, localSnapshot.characterPins, updatedAt);
  const remoteRows = buildCharacterPinCloudRows(userId, remoteState.snapshot.characterPins, remoteState.updatedAt || updatedAt);
  const { upsertRows: rowsToUpsert, deleteKeys } = diffCloudRows(localRows, remoteRows, "pin_id", {
    forceAll: remoteState.legacySources.characterPins,
  });
  await upsertRows(CHARACTER_PIN_TABLE, rowsToUpsert, "user_id,pin_id");
  await deleteRowsByKeys(CHARACTER_PIN_TABLE, userId, "pin_id", deleteKeys);
}

async function replacePreferenceRow(userId, localSnapshot, remoteState, updatedAt) {
  const localRow = buildPreferenceCloudRow(userId, localSnapshot.preferences, updatedAt);
  const remoteRow = buildPreferenceCloudRow(userId, remoteState.snapshot.preferences, remoteState.updatedAt || updatedAt);
  if (localRow) {
    const same =
      remoteRow &&
      JSON.stringify({ ...localRow, user_id: undefined, updated_at: undefined }) ===
        JSON.stringify({ ...remoteRow, user_id: undefined, updated_at: undefined });
    if (!same || remoteState.legacySources.preferences) {
      await upsertRows(PREFERENCE_TABLE, [localRow], "user_id");
    }
    return;
  }
  if (remoteRow) {
    const { error } = await supabase.from(PREFERENCE_TABLE).delete().eq("user_id", userId);
    if (error) throw error;
  }
}

async function replaceTierSnapshot(userId, localSnapshot, updatedAt) {
  const tierSnapshot = buildTierOnlySnapshot(localSnapshot);
  if (!hasTierData(tierSnapshot)) {
    const { error } = await supabase.from(TIER_SNAPSHOT_TABLE).delete().eq("user_id", userId);
    if (error) throw error;
    return null;
  }

  const wireSnapshot = encodeSyncSnapshot(tierSnapshot);
  const tierHash = await hashSnapshot(tierSnapshot);
  const deviceId = ensureSyncDeviceId();
  const { data, error } = await supabase
    .from(TIER_SNAPSHOT_TABLE)
    .upsert(
      {
        user_id: userId,
        snapshot: wireSnapshot,
        schema_version: Number(wireSnapshot?.v) || SYNC_SNAPSHOT_VERSION,
        content_hash: tierHash,
        updated_at: updatedAt,
        device_id: deviceId,
        app_version: "web",
      },
      { onConflict: "user_id" }
    )
    .select("updated_at")
    .maybeSingle();
  if (error) throw error;
  return normalizeIso(data?.updated_at) || updatedAt;
}

async function pushLocalState(userId, snapshot, remoteState, options = {}) {
  const localSnapshot = normalizeSyncSnapshot(snapshot);
  const updatedAt = new Date().toISOString();
  const effectiveRemote = remoteState || {
    snapshot: normalizeSyncSnapshot(null),
    updatedAt: updatedAt,
    legacySources: {
      list: false,
      watchLogs: false,
      characterPins: false,
      preferences: false,
      tier: false,
    },
  };

  await Promise.all([
    replaceLibraryRows(userId, localSnapshot, effectiveRemote, updatedAt),
    replaceWatchLogRows(userId, localSnapshot, effectiveRemote, updatedAt),
    replaceCharacterPinRows(userId, localSnapshot, effectiveRemote, updatedAt),
    replacePreferenceRow(userId, localSnapshot, effectiveRemote, updatedAt),
    replaceTierSnapshot(userId, localSnapshot, updatedAt),
  ]);

  const contentHash = options.hash || (await hashSnapshot(localSnapshot));
  markSyncCompleted({
    hash: contentHash,
    remoteUpdatedAt: updatedAt,
    syncedAt: updatedAt,
  });

  return {
    contentHash,
    updatedAt,
  };
}

export function readSyncMeta() {
  return {
    deviceId: readString(STORAGE_KEYS.syncDeviceId, "").trim() || null,
    lastSyncedAt: normalizeIso(readString(STORAGE_KEYS.syncLastSyncedAt, "")),
    lastSyncedHash: readString(STORAGE_KEYS.syncLastSyncedHash, "").trim() || null,
    lastRemoteUpdatedAt: normalizeIso(readString(STORAGE_KEYS.syncLastRemoteUpdatedAt, "")),
    pending: readPendingFlag(),
    lastError: readString(STORAGE_KEYS.syncLastError, "").trim() || null,
    lastLocalMutationAt: normalizeIso(readString(STORAGE_KEYS.syncLastLocalMutationAt, "")),
  };
}

export function subscribeSyncMeta(listener) {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener(readSyncMeta());
  window.addEventListener(SYNC_EVENT, handler);
  return () => window.removeEventListener(SYNC_EVENT, handler);
}

export function ensureSyncDeviceId() {
  const current = readString(STORAGE_KEYS.syncDeviceId, "").trim();
  if (current) return current;
  const deviceId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  writeString(STORAGE_KEYS.syncDeviceId, deviceId);
  emitSyncMetaChanged();
  return deviceId;
}

function writeSyncMetaPatch(patch = {}) {
  if (Object.prototype.hasOwnProperty.call(patch, "deviceId")) {
    writeString(STORAGE_KEYS.syncDeviceId, patch.deviceId || "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "lastSyncedAt")) {
    writeString(STORAGE_KEYS.syncLastSyncedAt, patch.lastSyncedAt || "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "lastSyncedHash")) {
    writeString(STORAGE_KEYS.syncLastSyncedHash, patch.lastSyncedHash || "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "lastRemoteUpdatedAt")) {
    writeString(STORAGE_KEYS.syncLastRemoteUpdatedAt, patch.lastRemoteUpdatedAt || "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "pending")) {
    writeJson(STORAGE_KEYS.syncPending, patch.pending === true);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "lastError")) {
    writeString(STORAGE_KEYS.syncLastError, patch.lastError || "");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "lastLocalMutationAt")) {
    writeString(STORAGE_KEYS.syncLastLocalMutationAt, patch.lastLocalMutationAt || "");
  }
  emitSyncMetaChanged();
}

export function markLocalDirty(atIso = new Date().toISOString()) {
  writeSyncMetaPatch({
    deviceId: ensureSyncDeviceId(),
    pending: true,
    lastLocalMutationAt: atIso,
    lastError: "",
  });
}

export function clearSyncError() {
  writeSyncMetaPatch({ lastError: "" });
}

export function setSyncError(error) {
  writeSyncMetaPatch({
    lastError: String(error?.message || error || "").trim() || "Unknown sync error",
  });
}

export function markSyncCompleted({ hash, remoteUpdatedAt, syncedAt = new Date().toISOString() }) {
  writeSyncMetaPatch({
    deviceId: ensureSyncDeviceId(),
    pending: false,
    lastSyncedAt: syncedAt,
    lastSyncedHash: hash || "",
    lastRemoteUpdatedAt: remoteUpdatedAt || syncedAt,
    lastError: "",
  });
}

export async function buildLocalSyncState() {
  const snapshot = await exportSyncSnapshot();
  const hash = await hashSnapshot(snapshot);
  return { snapshot, hash, meta: readSyncMeta() };
}

export async function readRemoteSnapshot(userId) {
  if (!supabase || !userId) return null;

  const [tierRow, libraryRows, watchLogRows, characterPinRows, preferenceRow] = await Promise.all([
    readTierSnapshotRow(userId),
    readLibraryRows(userId),
    readWatchLogRows(userId),
    readCharacterPinRows(userId),
    readPreferenceRow(userId),
  ]);

  const composite = buildRemoteCompositeSnapshot({
    tierRow,
    libraryRows,
    watchLogRows,
    characterPinRows,
    preferenceRow,
  });

  if (!composite.hasAnyData || isSnapshotEffectivelyEmpty(composite.snapshot)) {
    return null;
  }

  const updatedAt = maxIsoTimestamps([
    tierRow?.updatedAt,
    ...libraryRows.map((row) => row.updated_at),
    ...watchLogRows.map((row) => row.updated_at),
    ...characterPinRows.map((row) => row.updated_at),
    preferenceRow?.updated_at,
  ]) || new Date().toISOString();

  return {
    userId,
    snapshot: composite.snapshot,
    schemaVersion: SYNC_SNAPSHOT_VERSION,
    contentHash: await hashSnapshot(composite.snapshot),
    updatedAt,
    deviceId: tierRow?.deviceId || null,
    appVersion: tierRow?.appVersion || "web",
    legacySources: composite.legacySources,
  };
}

export async function uploadSnapshotToCloud(userId, snapshot, options = {}) {
  if (!supabase) throw new Error("Supabase env missing");
  if (!userId) throw new Error("Missing user id");

  const remoteState = options.remoteState || (await readRemoteSnapshot(userId));
  return pushLocalState(userId, snapshot, remoteState, options);
}

export async function applyRemoteSnapshot(remoteRow) {
  const snapshot = normalizeSyncSnapshot(remoteRow?.snapshot);
  await applySyncSnapshot(snapshot);
  const hash = remoteRow?.contentHash || (await hashSnapshot(snapshot));
  markSyncCompleted({
    hash,
    remoteUpdatedAt: normalizeIso(remoteRow?.updatedAt) || new Date().toISOString(),
  });
  return snapshot;
}

export async function exportConflictBackup() {
  const localState = await buildLocalSyncState();
  return downloadSnapshotJson(localState.snapshot);
}
