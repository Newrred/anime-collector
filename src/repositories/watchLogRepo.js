import { STORAGE_KEYS } from "../storage/keys";
import { readJson, writeJson } from "../storage/localJsonStore";
import {
  getRecentWatchLogsIdb,
  getWatchLogsByAnimeIdIdb,
  putWatchLogIdb,
  replaceWatchLogsIdb,
} from "../storage/idb";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toDateParts(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [year, month, day] = s.split("-").map((x) => Number(x));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function dateUtcMs(year, month, day) {
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

export function buildWatchedRange(value, precision, fallbackMs) {
  const raw = String(value || "").trim();
  const p = String(precision || "").toLowerCase();

  if (p === "day") {
    const d = toDateParts(raw);
    if (!d) return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
    const ms = dateUtcMs(d.year, d.month, d.day);
    return {
      watchedAtStart: raw,
      watchedAtEnd: raw,
      watchedAtSort: ms,
    };
  }

  if (p === "month") {
    const m = raw.match(/^(\d{4})-(\d{2})$/);
    if (!m) return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
    const year = Number(m[1]);
    const month = Number(m[2]);
    const start = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
    return {
      watchedAtStart: start,
      watchedAtEnd: null,
      watchedAtSort: dateUtcMs(year, month, 1),
    };
  }

  if (p === "year") {
    const y = raw.match(/^(\d{4})$/);
    if (!y) return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
    const year = Number(y[1]);
    return {
      watchedAtStart: `${String(year).padStart(4, "0")}-01-01`,
      watchedAtEnd: null,
      watchedAtSort: dateUtcMs(year, 1, 1),
    };
  }

  if (p === "season") {
    const m = raw.match(/^(\d{4})-(spring|summer|fall|winter)$/i);
    if (!m) return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
    const year = Number(m[1]);
    const season = m[2].toLowerCase();
    const month = season === "spring" ? 3 : season === "summer" ? 6 : season === "fall" ? 9 : 12;
    return {
      watchedAtStart: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`,
      watchedAtEnd: null,
      watchedAtSort: dateUtcMs(year, month, 1),
    };
  }

  return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
}

function normalizeWatchLog(raw) {
  const createdAt = Number(raw?.createdAt);
  const safeCreatedAt = Number.isFinite(createdAt) ? createdAt : Date.now();
  const sort = Number(raw?.watchedAtSort);

  return {
    id: String(raw?.id || makeId()),
    anilistId: Number(raw?.anilistId),
    eventType: String(raw?.eventType || "시작"),
    watchedAtValue: String(raw?.watchedAtValue || ""),
    watchedAtPrecision: String(raw?.watchedAtPrecision || "unknown"),
    watchedAtStart: raw?.watchedAtStart || null,
    watchedAtEnd: raw?.watchedAtEnd || null,
    watchedAtSort: Number.isFinite(sort) ? sort : safeCreatedAt,
    cue: String(raw?.cue || "").trim(),
    note: String(raw?.note || "").trim(),
    contextTags: toArray(raw?.contextTags).map((x) => String(x || "").trim()).filter(Boolean),
    scoreAtThatTime: Number.isFinite(Number(raw?.scoreAtThatTime))
      ? Number(raw.scoreAtThatTime)
      : null,
    characterIds: toArray(raw?.characterIds).map((x) => Number(x)).filter(Number.isFinite),
    characterRefs: toArray(raw?.characterRefs),
    createdAt: safeCreatedAt,
    updatedAt: Number.isFinite(Number(raw?.updatedAt)) ? Number(raw.updatedAt) : safeCreatedAt,
  };
}

function readWatchLogsLocal() {
  const rows = readJson(STORAGE_KEYS.watchLogs, []);
  return toArray(rows).map(normalizeWatchLog).filter((x) => Number.isFinite(x.anilistId));
}

function writeWatchLogsLocal(rows) {
  writeJson(STORAGE_KEYS.watchLogs, toArray(rows));
}

export function createWatchLog(input) {
  const now = Date.now();
  const precision = String(input?.watchedAtPrecision || "unknown").toLowerCase();
  const value = String(input?.watchedAtValue || "").trim();
  const range = buildWatchedRange(value, precision, now);

  return normalizeWatchLog({
    id: makeId(),
    anilistId: Number(input?.anilistId),
    eventType: input?.eventType || "시작",
    watchedAtValue: value,
    watchedAtPrecision: precision,
    watchedAtStart: range.watchedAtStart,
    watchedAtEnd: range.watchedAtEnd,
    watchedAtSort: range.watchedAtSort,
    cue: input?.cue || "",
    note: input?.note || "",
    contextTags: toArray(input?.contextTags),
    scoreAtThatTime: input?.scoreAtThatTime ?? null,
    characterIds: toArray(input?.characterIds),
    characterRefs: toArray(input?.characterRefs),
    createdAt: now,
    updatedAt: now,
  });
}

export async function appendWatchLog(logInput) {
  const row = normalizeWatchLog(logInput);
  if (!Number.isFinite(row.anilistId)) return null;

  const rows = readWatchLogsLocal();
  rows.push(row);
  writeWatchLogsLocal(rows);
  putWatchLogIdb(row).catch(() => {});
  return row;
}

export async function listWatchLogsByAnimeId(anilistId) {
  const id = Number(anilistId);
  if (!Number.isFinite(id)) return [];
  try {
    const rows = await getWatchLogsByAnimeIdIdb(id);
    if (Array.isArray(rows) && rows.length > 0) {
      return rows
        .map(normalizeWatchLog)
        .sort((a, b) => Number(b.watchedAtSort || 0) - Number(a.watchedAtSort || 0));
    }
  } catch {}

  return readWatchLogsLocal()
    .filter((x) => x.anilistId === id)
    .sort((a, b) => Number(b.watchedAtSort || 0) - Number(a.watchedAtSort || 0));
}

export async function listRecentWatchLogs(limit = 30) {
  try {
    const rows = await getRecentWatchLogsIdb(limit);
    if (Array.isArray(rows) && rows.length > 0) return rows.map(normalizeWatchLog);
  } catch {}
  return readWatchLogsLocal()
    .sort((a, b) => Number(b.watchedAtSort || 0) - Number(a.watchedAtSort || 0))
    .slice(0, Math.max(1, Number(limit) || 30));
}

export async function replaceWatchLogs(logs) {
  const rows = toArray(logs).map(normalizeWatchLog).filter((x) => Number.isFinite(x.anilistId));
  writeWatchLogsLocal(rows);
  replaceWatchLogsIdb(rows).catch(() => {});
  return rows.length;
}

export async function updateWatchLog(logId, patch = {}) {
  const key = String(logId || "").trim();
  if (!key) return null;

  const rows = readWatchLogsLocal();
  const idx = rows.findIndex((x) => String(x.id) === key);
  if (idx < 0) return null;

  const prev = rows[idx];
  const next = normalizeWatchLog({
    ...prev,
    ...patch,
    id: prev.id,
    anilistId: prev.anilistId,
    updatedAt: Date.now(),
  });

  rows[idx] = next;
  writeWatchLogsLocal(rows);
  putWatchLogIdb(next).catch(() => {});
  return next;
}

export function readAllWatchLogsSnapshot() {
  return readWatchLogsLocal().sort(
    (a, b) =>
      Number(b?.watchedAtSort || 0) - Number(a?.watchedAtSort || 0) ||
      Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
  );
}

export async function mergeWatchLogs(incomingLogs) {
  const incoming = toArray(incomingLogs)
    .map(normalizeWatchLog)
    .filter((x) => Number.isFinite(x.anilistId));
  if (!incoming.length) return 0;

  const map = new Map();
  for (const row of readWatchLogsLocal()) map.set(String(row.id), row);
  for (const row of incoming) map.set(String(row.id), row);

  const rows = [...map.values()].sort(
    (a, b) =>
      Number(b?.watchedAtSort || 0) - Number(a?.watchedAtSort || 0) ||
      Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
  );
  await replaceWatchLogs(rows);
  return rows.length;
}
