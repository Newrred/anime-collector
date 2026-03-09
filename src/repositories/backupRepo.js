import { STORAGE_KEYS } from "../storage/keys";
import { readString, writeJson, writeString } from "../storage/localJsonStore";

export function readLastExportAtMs() {
  const raw = readString(STORAGE_KEYS.lastBackupAt, "");
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function markManualBackupExported(atIso = new Date().toISOString()) {
  writeString(STORAGE_KEYS.lastBackupAt, atIso);
}

export function writeAutoBackupSnapshot(snapshot) {
  writeJson(STORAGE_KEYS.autoBackup, snapshot);
  writeJson(STORAGE_KEYS.autoBackupMeta, {
    savedAt: snapshot?.savedAt || null,
    count: Array.isArray(snapshot?.list) ? snapshot.list.length : 0,
  });
}

