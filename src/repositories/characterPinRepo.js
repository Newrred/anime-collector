import { STORAGE_KEYS } from "../storage/keys.js";
import { readJson, writeJson } from "../storage/localJsonStore.js";
import {
  deleteCharacterPinIdb,
  getAllCharacterPinsIdb,
  putCharacterPinIdb,
  replaceCharacterPinsIdb,
} from "../storage/idb.js";
import { markLocalDirty } from "./syncRepo.js";

function normalizePin(raw) {
  const characterId = Number(raw?.characterId);
  const mediaId = Number(raw?.mediaId);
  if (!Number.isFinite(characterId) || !Number.isFinite(mediaId)) return null;
  const id = String(raw?.id || `${characterId}:${mediaId}`).trim();
  if (!id) return null;
  const pinnedFromLogId = raw?.pinnedFromLogId
    ? String(raw.pinnedFromLogId)
    : raw?.sourceLogId
      ? String(raw.sourceLogId)
      : null;
  return {
    id,
    characterId,
    mediaId,
    nameSnapshot: String(raw?.nameSnapshot || "").trim() || `#${characterId}`,
    imageSnapshot: raw?.imageSnapshot || null,
    note: String(raw?.note || ""),
    sourceLogId: raw?.sourceLogId ? String(raw.sourceLogId) : null,
    pinReason: String(raw?.pinReason || "").trim(),
    pinnedFromLogId,
    pinnedAt: Number.isFinite(Number(raw?.pinnedAt)) ? Number(raw.pinnedAt) : Date.now(),
  };
}

function readPinsLocal() {
  const rows = readJson(STORAGE_KEYS.characterPins, []);
  return (Array.isArray(rows) ? rows : [])
    .map(normalizePin)
    .filter(Boolean)
    .sort((a, b) => Number(b?.pinnedAt || 0) - Number(a?.pinnedAt || 0));
}

function writePinsLocal(rows) {
  writeJson(STORAGE_KEYS.characterPins, Array.isArray(rows) ? rows : []);
}

export function readCharacterPinsSnapshot() {
  return readPinsLocal();
}

export async function listCharacterPinsPreferred() {
  try {
    const rows = await getAllCharacterPinsIdb();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows
        .map(normalizePin)
        .filter(Boolean)
        .sort((a, b) => Number(b?.pinnedAt || 0) - Number(a?.pinnedAt || 0));
    }
  } catch {}
  return readPinsLocal();
}

export async function replaceCharacterPins(pins, options = {}) {
  const rows = (Array.isArray(pins) ? pins : [])
    .map(normalizePin)
    .filter(Boolean)
    .sort((a, b) => Number(b?.pinnedAt || 0) - Number(a?.pinnedAt || 0));
  writePinsLocal(rows);
  if (!options?.skipSyncMark) markLocalDirty();
  replaceCharacterPinsIdb(rows).catch(() => {});
  return rows.length;
}

export async function mergeCharacterPins(incomingPins) {
  const incoming = (Array.isArray(incomingPins) ? incomingPins : [])
    .map(normalizePin)
    .filter(Boolean);
  if (!incoming.length) return readPinsLocal().length;

  const map = new Map();
  for (const pin of readPinsLocal()) map.set(pin.id, pin);
  for (const pin of incoming) map.set(pin.id, pin);
  const merged = [...map.values()].sort((a, b) => Number(b?.pinnedAt || 0) - Number(a?.pinnedAt || 0));
  await replaceCharacterPins(merged);
  return merged.length;
}

export async function upsertCharacterPin(pinInput, options = {}) {
  const pin = normalizePin(pinInput);
  if (!pin) return null;
  const map = new Map(readPinsLocal().map((x) => [x.id, x]));
  map.set(pin.id, pin);
  const next = [...map.values()].sort((a, b) => Number(b?.pinnedAt || 0) - Number(a?.pinnedAt || 0));
  writePinsLocal(next);
  if (!options?.skipSyncMark) markLocalDirty();
  putCharacterPinIdb(pin).catch(() => {});
  return pin;
}

export async function removeCharacterPin(pinId, options = {}) {
  const id = String(pinId || "").trim();
  if (!id) return false;
  const next = readPinsLocal().filter((x) => String(x.id) !== id);
  writePinsLocal(next);
  if (!options?.skipSyncMark) markLocalDirty();
  deleteCharacterPinIdb(id).catch(() => {});
  return true;
}
