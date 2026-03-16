import { readJson, writeJson } from "../storage/localJsonStore.js";
import { STORAGE_KEYS } from "../storage/keys.js";
import { readLibraryListPreferred, writeLibraryList } from "../repositories/libraryRepo.js";
import { readTierBoardBundlePreferred, writeTierBoardBundle } from "../repositories/tierRepo.js";
import { DEFAULT_TIER_TOPIC_ID, getActiveTierTopic, isLegacyTierState } from "./tierTopics.js";
import { readAllWatchLogsSnapshot, replaceWatchLogs } from "../repositories/watchLogRepo.js";
import { listCharacterPinsPreferred, replaceCharacterPins } from "../repositories/characterPinRepo.js";
import {
  DEFAULT_TIERS,
  normalizeRewatchCount,
  normalizeRewatchDate,
  normalizeScoreValue,
  normalizeTierState,
  toUniqueIdArray,
} from "./animeState.js";

export const SYNC_SNAPSHOT_VERSION = 5;
const DEFAULT_EXPORT_ISO = "1970-01-01T00:00:00.000Z";
const STATUS_CODES = ["미분류", "보는중", "보류", "완료", "하차"];
const EVENT_CODES = ["시작", "완료", "재시청", "하차"];
const PRECISION_CODES = ["day", "month", "season", "year", "unknown"];
const AFFINITY_CODES = ["최애", "기억남음", "불호지만강렬"];
const TOPIC_KIND_CODES = ["all", "genre", "custom"];
const CARD_VIEW_CODES = ["meta", "poster"];
const REASON_TAG_CODES = ["성장", "관계성", "대사", "연출", "디자인", "성우", "기타"];

const toArray = (value) => (Array.isArray(value) ? value : []);
const normalizeString = (value, fallback = "") => String(value || "").trim() || fallback;
const normalizeNullableString = (value) => {
  const raw = String(value || "").trim();
  return raw || null;
};
const normalizeIsoString = (value, fallback = DEFAULT_EXPORT_ISO) => {
  const raw = String(value || "").trim();
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : fallback;
};
function normalizeStringList(value, limit = Infinity) {
  const out = [];
  const seen = new Set();
  for (const entry of toArray(value)) {
    const text = String(entry || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}
function encodeEnum(value, codes, fallback = null) {
  if (value == null) return fallback;
  const idx = codes.indexOf(String(value || "").trim());
  return idx >= 0 ? idx : value;
}
function decodeEnum(value, codes, fallback = "") {
  if (typeof value === "number" && Number.isInteger(value) && codes[value] != null) return codes[value];
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}
function trimCompactArray(values) {
  let end = values.length;
  while (end > 0) {
    const current = values[end - 1];
    if (current == null || current === "" || (Array.isArray(current) && current.length === 0)) { end -= 1; continue; }
    if (typeof current === "object" && !Array.isArray(current) && Object.keys(current).length === 0) { end -= 1; continue; }
    break;
  }
  return values.slice(0, end);
}
function encodeStringRef(value, poolMap) {
  if (value == null) return null;
  const text = String(value);
  if (!text) return null;
  return poolMap.has(text) ? poolMap.get(text) : text;
}
function decodeStringRef(value, pool, fallback = "") {
  if (typeof value === "number" && Number.isInteger(value)) return pool[value] != null ? String(pool[value]) : fallback;
  if (typeof value === "string") return value;
  return fallback;
}
function encodeNumberRef(value, poolMap) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return poolMap.has(number) ? -(poolMap.get(number) + 1) : number;
}
function decodeNumberRef(value, pool, fallback = null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number < 0 && Number.isInteger(number)) {
    const resolved = pool[Math.abs(number) - 1];
    return Number.isFinite(Number(resolved)) ? Number(resolved) : fallback;
  }
  return number;
}

function toDateParts(raw) {
  const s = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [year, month, day] = s.split("-").map(Number);
  return Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day) ? { year, month, day } : null;
}
const dateUtcMs = (year, month, day) => Date.UTC(year, month - 1, day, 0, 0, 0, 0);
function buildWatchedRange(value, precision, fallbackMs) {
  const raw = String(value || "").trim();
  const p = String(precision || "").toLowerCase();
  if (p === "day") {
    const d = toDateParts(raw);
    return d ? { watchedAtStart: raw, watchedAtEnd: raw, watchedAtSort: dateUtcMs(d.year, d.month, d.day) } : { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
  }
  if (p === "month") {
    const m = raw.match(/^(\d{4})-(\d{2})$/);
    if (!m) return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
    return { watchedAtStart: `${m[1]}-${m[2]}-01`, watchedAtEnd: null, watchedAtSort: dateUtcMs(Number(m[1]), Number(m[2]), 1) };
  }
  if (p === "year") {
    const y = raw.match(/^(\d{4})$/);
    if (!y) return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
    return { watchedAtStart: `${y[1]}-01-01`, watchedAtEnd: null, watchedAtSort: dateUtcMs(Number(y[1]), 1, 1) };
  }
  if (p === "season") {
    const m = raw.match(/^(\d{4})-(spring|summer|fall|winter)$/i);
    if (!m) return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
    const month = m[2].toLowerCase() === "spring" ? 3 : m[2].toLowerCase() === "summer" ? 6 : m[2].toLowerCase() === "fall" ? 9 : 12;
    return { watchedAtStart: `${m[1]}-${String(month).padStart(2, "0")}-01`, watchedAtEnd: null, watchedAtSort: dateUtcMs(Number(m[1]), month, 1) };
  }
  return { watchedAtStart: null, watchedAtEnd: null, watchedAtSort: fallbackMs };
}

function normalizeSnapshotTierState(value) {
  const tier = normalizeTierState(value);
  const normalizedTiers = Object.fromEntries(
    DEFAULT_TIERS.map((label) => [label, toUniqueIdArray(tier.tiers?.[label] || [])])
  );
  const ranked = new Set();
  for (const ids of Object.values(normalizedTiers)) for (const id of ids || []) ranked.add(id);
  return { tiers: normalizedTiers, unranked: (tier.unranked || []).filter((id) => !ranked.has(id)) };
}
function normalizeSnapshotList(value) {
  const map = new Map();
  for (const [idx, raw] of toArray(value).entries()) {
    const anilistId = Number(raw?.anilistId);
    if (!Number.isFinite(anilistId)) continue;
    const has = {
      koTitle: raw?.koTitle != null && String(raw.koTitle).trim() !== "",
      status: raw?.status != null && String(raw.status).trim() !== "",
      score: raw?.score != null && String(raw.score).trim() !== "",
      memo: raw?.memo != null,
      rewatchCount: raw?.rewatchCount != null && String(raw.rewatchCount).trim() !== "",
      lastRewatchAt: raw?.lastRewatchAt != null && String(raw.lastRewatchAt).trim() !== "",
    };
    const next = {
      anilistId,
      koTitle: has.koTitle ? normalizeNullableString(raw?.koTitle) : null,
      status: has.status ? normalizeString(raw?.status, "미분류") : null,
      score: has.score ? normalizeScoreValue(raw?.score) : null,
      memo: has.memo ? String(raw?.memo ?? "") : null,
      rewatchCount: has.rewatchCount ? normalizeRewatchCount(raw?.rewatchCount) : null,
      lastRewatchAt: has.lastRewatchAt ? normalizeRewatchDate(raw?.lastRewatchAt) : null,
      addedAt: Number.isFinite(Number(raw?.addedAt)) ? Number(raw.addedAt) : idx,
    };
    if (!map.has(anilistId)) {
      map.set(anilistId, { anilistId, koTitle: next.koTitle, status: next.status || "미분류", score: next.score, memo: next.memo ?? "", rewatchCount: next.rewatchCount ?? 0, lastRewatchAt: next.lastRewatchAt, addedAt: next.addedAt });
      continue;
    }
    const prev = map.get(anilistId);
    map.set(anilistId, {
      anilistId,
      koTitle: next.koTitle || prev?.koTitle || null,
      status: next.status || prev?.status || "미분류",
      score: has.score ? next.score : prev?.score ?? null,
      memo: has.memo ? next.memo ?? "" : prev?.memo ?? "",
      rewatchCount: has.rewatchCount ? next.rewatchCount ?? 0 : prev?.rewatchCount ?? 0,
      lastRewatchAt: has.lastRewatchAt ? next.lastRewatchAt : prev?.lastRewatchAt ?? null,
      addedAt: Math.max(Number(prev?.addedAt || 0), Number(next.addedAt || 0)),
    });
  }
  return [...map.values()]
    .sort((a, b) => Number(a?.addedAt || 0) - Number(b?.addedAt || 0) || a.anilistId - b.anilistId)
    .map((row, idx) => ({
      ...row,
      addedAt: idx,
    }));
}
function normalizeSnapshotCharacterRefs(rawRefs) {
  const refs = toArray(rawRefs).map((raw, idx) => {
    const characterId = Number(raw?.characterId);
    if (!Number.isFinite(characterId)) return null;
    return {
      characterId,
      mediaId: Number.isFinite(Number(raw?.mediaId)) ? Number(raw.mediaId) : null,
      order: Number.isFinite(Number(raw?.order)) ? Number(raw.order) : idx,
      nameSnapshot: normalizeString(raw?.nameSnapshot, `#${characterId}`),
      imageSnapshot: raw?.imageSnapshot || null,
      role: String(raw?.role || ""),
      affinity: normalizeString(raw?.affinity, "기억남음"),
      reasonTags: normalizeStringList(raw?.reasonTags, 6),
      note: String(raw?.note || "").trim().slice(0, 200),
      isPrimary: raw?.isPrimary === true,
    };
  }).filter(Boolean).sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0) || a.characterId - b.characterId);
  if (!refs.length) return [];
  const primaryIndex = refs.findIndex((row) => row.isPrimary === true);
  refs.forEach((row, idx) => { row.order = idx; row.isPrimary = idx === (primaryIndex >= 0 ? primaryIndex : 0); });
  return refs;
}
function normalizeSnapshotWatchLogs(value) {
  return toArray(value).map((raw, idx) => {
    const anilistId = Number(raw?.anilistId);
    if (!Number.isFinite(anilistId)) return null;
    const rawCreatedAt = Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : idx;
    const precision = normalizeString(raw?.watchedAtPrecision, "unknown").toLowerCase();
    const watchedAtValue = String(raw?.watchedAtValue || "").trim();
    const range = buildWatchedRange(watchedAtValue, precision, rawCreatedAt);
    const createdAt =
      precision !== "unknown" && watchedAtValue
        ? Number(range.watchedAtSort || rawCreatedAt)
        : rawCreatedAt;
    const watchedAtSort = Number(range.watchedAtSort || createdAt);
    const characterRefs = normalizeSnapshotCharacterRefs(raw?.characterRefs);
    const characterIds = toUniqueIdArray(toArray(raw?.characterIds).length ? raw?.characterIds : characterRefs.map((row) => row.characterId));
    const hasScoreAtThatTime =
      raw?.scoreAtThatTime != null &&
      String(raw.scoreAtThatTime).trim() !== "" &&
      Number.isFinite(Number(raw.scoreAtThatTime));
    return {
      id: normalizeString(raw?.id, `log-${idx}`),
      anilistId,
      eventType: normalizeString(raw?.eventType, "시작"),
      watchedAtValue,
      watchedAtPrecision: precision,
      watchedAtStart: range.watchedAtStart || null,
      watchedAtEnd: range.watchedAtEnd || null,
      watchedAtSort,
      cue: String(raw?.cue || "").trim(),
      note: String(raw?.note || "").trim(),
      contextTags: normalizeStringList(raw?.contextTags),
      scoreAtThatTime: hasScoreAtThatTime ? normalizeScoreValue(raw?.scoreAtThatTime) : null,
      characterIds,
      characterRefs,
      createdAt,
      updatedAt: createdAt,
    };
  }).filter(Boolean).sort((a, b) => Number(b?.watchedAtSort || 0) - Number(a?.watchedAtSort || 0) || Number(b?.createdAt || 0) - Number(a?.createdAt || 0) || String(a?.id || "").localeCompare(String(b?.id || "")));
}
function normalizeSnapshotPins(value) {
  return toArray(value).map((raw, idx) => {
    const characterId = Number(raw?.characterId);
    const mediaId = Number(raw?.mediaId);
    if (!Number.isFinite(characterId) || !Number.isFinite(mediaId)) return null;
    const linkedLogId = raw?.pinnedFromLogId ? String(raw.pinnedFromLogId) : raw?.sourceLogId ? String(raw.sourceLogId) : null;
    return {
      id: normalizeString(raw?.id, `${characterId}:${mediaId}`),
      characterId,
      mediaId,
      nameSnapshot: normalizeString(raw?.nameSnapshot, `#${characterId}`),
      imageSnapshot: raw?.imageSnapshot || null,
      note: String(raw?.note || ""),
      sourceLogId: linkedLogId,
      pinReason: String(raw?.pinReason || "").trim(),
      pinnedFromLogId: linkedLogId,
      pinnedAt: Number.isFinite(Number(raw?.pinnedAt)) ? Number(raw.pinnedAt) : idx,
    };
  }).filter(Boolean)
    .sort((a, b) => Number(b?.pinnedAt || 0) - Number(a?.pinnedAt || 0) || String(a?.id || "").localeCompare(String(b?.id || "")))
    .map((row, idx, rows) => ({
      ...row,
      pinnedAt: rows.length - idx,
    }));
}
function normalizeSnapshotTopic(raw) {
  const kind = raw?.kind === "genre" || raw?.kind === "custom" ? raw.kind : "all";
  if (kind === "genre") return { id: normalizeString(raw?.id, "genre-0"), kind, name: normalizeString(raw?.name, normalizeString(raw?.genreKey, "") || "Genre"), genreKey: normalizeString(raw?.genreKey, ""), includedIds: [], createdAt: Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : 0, tier: normalizeSnapshotTierState(raw?.tier) };
  if (kind === "custom") return { id: normalizeString(raw?.id, "custom-0"), kind, name: normalizeString(raw?.name, "Custom topic"), genreKey: "", includedIds: [...toUniqueIdArray(raw?.includedIds || [])].sort((a, b) => a - b), createdAt: Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : 0, tier: normalizeSnapshotTierState(raw?.tier) };
  return { id: DEFAULT_TIER_TOPIC_ID, kind: "all", name: "All anime", genreKey: "", includedIds: [], createdAt: Number.isFinite(Number(raw?.createdAt)) ? Number(raw.createdAt) : 0, tier: normalizeSnapshotTierState(raw?.tier || raw) };
}
function normalizeSnapshotTierBundle(value, fallbackTier = null) {
  if (isLegacyTierState(value)) return { version: 1, activeTopicId: DEFAULT_TIER_TOPIC_ID, topics: [{ id: DEFAULT_TIER_TOPIC_ID, kind: "all", name: "All anime", genreKey: "", includedIds: [], createdAt: 0, tier: normalizeSnapshotTierState(value) }] };
  const source = value && typeof value === "object" ? value : {};
  const seen = new Set();
  const topics = toArray(source?.topics).map((raw) => normalizeSnapshotTopic(raw)).filter((topic) => {
    if (seen.has(topic.id)) return false;
    seen.add(topic.id);
    return true;
  });
  if (!seen.has(DEFAULT_TIER_TOPIC_ID)) topics.unshift({ id: DEFAULT_TIER_TOPIC_ID, kind: "all", name: "All anime", genreKey: "", includedIds: [], createdAt: 0, tier: normalizeSnapshotTierState(fallbackTier) });
  topics.sort((a, b) => a.id === DEFAULT_TIER_TOPIC_ID ? -1 : b.id === DEFAULT_TIER_TOPIC_ID ? 1 : Number(a?.createdAt || 0) - Number(b?.createdAt || 0) || String(a?.name || "").localeCompare(String(b?.name || ""), "en") || String(a?.id || "").localeCompare(String(b?.id || ""), "en"));
  const normalizedTopics = topics.map((topic, index) => ({
    ...topic,
    createdAt: index,
  }));
  return {
    version: 1,
    activeTopicId: normalizedTopics.some((topic) => topic.id === source?.activeTopicId) ? source.activeTopicId : DEFAULT_TIER_TOPIC_ID,
    topics: normalizedTopics,
  };
}
function normalizePreferences(value) {
  const out = {};
  const cardsPerRowBase = Number(value?.cardsPerRowBase);
  const cardView = String(value?.cardView || "").trim();
  if (Number.isFinite(cardsPerRowBase)) out.cardsPerRowBase = cardsPerRowBase;
  if (cardView === "meta" || cardView === "poster") out.cardView = cardView;
  return Object.keys(out).length ? out : undefined;
}

function normalizeExpandedSnapshot(snapshot) {
  const safe = snapshot && typeof snapshot === "object" ? snapshot : {};
  const tierTopics = normalizeSnapshotTierBundle(safe.tierTopics || safe.tier, safe.tier);
  const activeTier = getActiveTierTopic(tierTopics)?.tier || { unranked: [], tiers: {} };
  return {
    app: String(safe.app || "ani-site"),
    version: Number.isFinite(Number(safe.version)) ? Number(safe.version) : SYNC_SNAPSHOT_VERSION,
    exportedAt: normalizeIsoString(safe.exportedAt, DEFAULT_EXPORT_ISO),
    list: normalizeSnapshotList(safe.list),
    tier: normalizeSnapshotTierState(activeTier),
    tierTopics,
    watchLogs: normalizeSnapshotWatchLogs(safe.watchLogs),
    characterPins: normalizeSnapshotPins(safe.characterPins),
    preferences: normalizePreferences(safe.preferences),
  };
}
function isCompactSnapshot(raw) {
  return !!(raw && typeof raw === "object" && !Array.isArray(raw) && Number(raw?.v) === SYNC_SNAPSHOT_VERSION && ("l" in raw || "tt" in raw || "w" in raw || "p" in raw));
}
function buildStringPool(snapshot) {
  const stats = new Map();
  const count = (value) => {
    if (typeof value === "string" && value.trim().length >= 4) stats.set(value, (stats.get(value) || 0) + 1);
  };
  for (const item of snapshot.list || []) { count(item.koTitle); count(item.memo); }
  for (const topic of snapshot.tierTopics?.topics || []) { count(topic.name); count(topic.genreKey); }
  for (const log of snapshot.watchLogs || []) {
    count(log.cue); count(log.note);
    for (const tag of log.contextTags || []) count(tag);
    for (const ref of log.characterRefs || []) { count(ref.nameSnapshot); count(ref.imageSnapshot); count(ref.note); for (const tag of ref.reasonTags || []) count(tag); }
  }
  for (const pin of snapshot.characterPins || []) { count(pin.nameSnapshot); count(pin.imageSnapshot); count(pin.note); count(pin.pinReason); }
  const strings = [...stats.entries()].filter(([, value]) => value > 1).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])).map(([text]) => text);
  return { strings, map: new Map(strings.map((text, idx) => [text, idx])) };
}
function buildNumberPool(snapshot) {
  const stats = new Map();
  const count = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || !Number.isInteger(number) || number <= 0) return;
    stats.set(number, (stats.get(number) || 0) + 1);
  };
  for (const item of snapshot.list || []) count(item.anilistId);
  for (const topic of snapshot.tierTopics?.topics || []) {
    for (const animeId of topic.includedIds || []) count(animeId);
    for (const animeId of topic.tier?.unranked || []) count(animeId);
    for (const ids of Object.values(topic.tier?.tiers || {})) for (const animeId of ids || []) count(animeId);
  }
  for (const log of snapshot.watchLogs || []) {
    count(log.anilistId);
    for (const characterId of log.characterIds || []) count(characterId);
    for (const ref of log.characterRefs || []) {
      count(ref.characterId);
      count(ref.mediaId);
    }
  }
  for (const pin of snapshot.characterPins || []) {
    count(pin.characterId);
    count(pin.mediaId);
  }
  const numbers = [...stats.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([number]) => number);
  return { numbers, map: new Map(numbers.map((number, idx) => [number, idx])) };
}
function encodeTierStateCompact(tierState, numberPoolMap) {
  const safe = normalizeSnapshotTierState(tierState);
  const rankedRows = DEFAULT_TIERS
    .map((label, idx) => [idx, encodeTierStateIds(safe.tiers?.[label] || [], numberPoolMap)])
    .filter(([, ids]) => ids.length > 0);
  const unranked = encodeTierStateIds(safe.unranked || [], numberPoolMap);
  return !unranked.length && !rankedRows.length
    ? null
    : trimCompactArray([unranked.length ? unranked : null, rankedRows.length ? rankedRows : null]);
}
function encodeTierStateIds(values, numberPoolMap) {
  return toUniqueIdArray(values || []).map((value) => encodeNumberRef(value, numberPoolMap));
}
function decodeTierStateIds(values, numberPool) {
  return toUniqueIdArray(
    toArray(values)
      .map((value) => decodeNumberRef(value, numberPool, null))
      .filter((value) => Number.isFinite(value))
  );
}
function decodeTierStateCompact(raw, numberPool = []) {
  if (!Array.isArray(raw)) return normalizeSnapshotTierState(raw);
  const tiers = Object.fromEntries(DEFAULT_TIERS.map((label) => [label, []]));
  for (const row of toArray(raw?.[1])) {
    const label = DEFAULT_TIERS[Number(row?.[0])];
    if (label) tiers[label] = decodeTierStateIds(row?.[1], numberPool);
  }
  return normalizeSnapshotTierState({ unranked: decodeTierStateIds(raw?.[0], numberPool), tiers });
}
function encodeCharacterRefCompact(ref, poolMap, numberPoolMap) {
  const tags = (ref.reasonTags || []).map((tag) => encodeEnum(tag, REASON_TAG_CODES, null)).filter((tag) => tag != null);
  const affinityCode = encodeEnum(ref.affinity, AFFINITY_CODES, 1);
  return trimCompactArray([
    encodeNumberRef(ref.characterId, numberPoolMap),
    encodeStringRef(ref.nameSnapshot, poolMap),
    encodeStringRef(ref.imageSnapshot, poolMap),
    affinityCode === 1 ? null : affinityCode,
    tags.length ? tags : null,
    encodeStringRef(ref.note, poolMap),
    ref.isPrimary === true ? 1 : null,
  ]);
}
function decodeCharacterRefCompact(raw, mediaId, pool, numberPool, index) {
  const characterId = decodeNumberRef(raw?.[0], numberPool, null);
  if (!Number.isFinite(characterId)) return null;
  return {
    characterId,
    mediaId: Number.isFinite(Number(mediaId)) ? Number(mediaId) : null,
    order: index,
    nameSnapshot: decodeStringRef(raw?.[1], pool, `#${characterId}`),
    imageSnapshot: decodeStringRef(raw?.[2], pool, "") || null,
    role: "",
    affinity: decodeEnum(raw?.[3], AFFINITY_CODES, "기억남음"),
    reasonTags: toArray(raw?.[4]).map((tag) => decodeEnum(tag, REASON_TAG_CODES, "")).filter(Boolean),
      note: decodeStringRef(raw?.[5], pool, ""),
      isPrimary: raw?.[6] === 1,
  };
}
function encodeListCompact(list, poolMap, numberPoolMap) {
  return (list || []).map((item) => {
    const statusCode = encodeEnum(item.status, STATUS_CODES, 0);
    return trimCompactArray([
      encodeNumberRef(item.anilistId, numberPoolMap),
      encodeStringRef(item.koTitle, poolMap),
      statusCode === 0 ? null : statusCode,
      item.score,
      encodeStringRef(item.memo, poolMap),
      item.rewatchCount > 0 ? item.rewatchCount : null,
      item.lastRewatchAt || null,
    ]);
  });
}
function decodeListCompact(rows, pool, numberPool) {
  return toArray(rows).map((row, idx) => ({
    anilistId: decodeNumberRef(row?.[0], numberPool, null),
    koTitle: decodeStringRef(row?.[1], pool, "") || null,
    status: decodeEnum(row?.[2], STATUS_CODES, "미분류"),
    score: row?.[3] == null ? null : Number(row[3]),
    memo: decodeStringRef(row?.[4], pool, ""),
    rewatchCount: row?.[5] == null ? 0 : Number(row[5]),
    lastRewatchAt: row?.[6] == null ? null : String(row[6]),
    addedAt: idx,
  }));
}
function encodeTopicCompact(topic, poolMap, numberPoolMap) {
  const kindCode = encodeEnum(topic.kind, TOPIC_KIND_CODES, 0);
  const encodedName =
    topic.kind === "custom"
      ? encodeStringRef(topic.name, poolMap)
      : topic.kind === "genre" && topic.name && topic.name !== topic.genreKey
        ? encodeStringRef(topic.name, poolMap)
        : null;
  return trimCompactArray([
    topic.id === DEFAULT_TIER_TOPIC_ID ? null : topic.id,
    kindCode === 0 ? null : kindCode,
    encodedName,
    topic.kind === "genre" ? encodeStringRef(topic.genreKey, poolMap) : null,
    topic.kind === "custom" && topic.includedIds.length ? encodeTierStateIds(topic.includedIds, numberPoolMap) : null,
    encodeTierStateCompact(topic.tier, numberPoolMap),
  ]);
}
function decodeTopicCompact(raw, pool, numberPool, index) {
  const kind = decodeEnum(raw?.[1], TOPIC_KIND_CODES, "all");
  const genreKey = kind === "genre" ? decodeStringRef(raw?.[3], pool, "") : "";
  const defaultId = kind === "genre" ? `genre-${index}` : kind === "custom" ? `custom-${index}` : DEFAULT_TIER_TOPIC_ID;
  return {
    id: kind === "all" ? DEFAULT_TIER_TOPIC_ID : normalizeString(raw?.[0], defaultId),
    kind,
    name: decodeStringRef(raw?.[2], pool, kind === "genre" ? genreKey || "Genre" : kind === "custom" ? "Custom topic" : "All anime"),
    genreKey,
    includedIds: kind === "custom" ? decodeTierStateIds(raw?.[4], numberPool) : [],
    createdAt: index,
    tier: decodeTierStateCompact(raw?.[5], numberPool),
  };
}
function encodeTierTopicsCompact(bundle, poolMap, numberPoolMap) {
  const topics = toArray(bundle?.topics).map((topic) => encodeTopicCompact(topic, poolMap, numberPoolMap));
  return topics.length ? trimCompactArray([bundle?.activeTopicId && bundle.activeTopicId !== DEFAULT_TIER_TOPIC_ID ? bundle.activeTopicId : null, topics]) : null;
}
function decodeTierTopicsCompact(raw, pool, numberPool) {
  if (!Array.isArray(raw)) return null;
  return {
    version: 1,
    activeTopicId: raw?.[0] ? String(raw[0]) : DEFAULT_TIER_TOPIC_ID,
    topics: toArray(raw?.[1]).map((topic, idx) => decodeTopicCompact(topic, pool, numberPool, idx)).filter(Boolean),
  };
}
function encodeWatchLogsCompact(rows, poolMap, numberPoolMap) {
  return (rows || []).map((row) => {
    const refs = (row.characterRefs || []).map((ref) => encodeCharacterRefCompact(ref, poolMap, numberPoolMap)).filter(Boolean);
    const precision = String(row?.watchedAtPrecision || "unknown");
    const createdAt = Number.isFinite(Number(row?.createdAt)) ? Number(row.createdAt) : 0;
    const needsCreatedAt = precision === "unknown" || !String(row?.watchedAtValue || "").trim();
    const eventCode = encodeEnum(row.eventType, EVENT_CODES, 0);
    const precisionCode = encodeEnum(precision, PRECISION_CODES, 4);
    return trimCompactArray([
      row.id,
      encodeNumberRef(row.anilistId, numberPoolMap),
      eventCode === 0 ? null : eventCode,
      row.watchedAtValue || null,
      precisionCode === 4 ? null : precisionCode,
      encodeStringRef(row.cue, poolMap),
      encodeStringRef(row.note, poolMap),
      row.scoreAtThatTime,
      row.contextTags?.length ? row.contextTags.map((tag) => encodeStringRef(tag, poolMap)) : null,
      refs.length ? refs : null,
      needsCreatedAt ? createdAt : null,
    ]);
  });
}
function decodeWatchLogsCompact(rows, pool, numberPool) {
  return toArray(rows).map((row, idx) => {
    const anilistId = decodeNumberRef(row?.[1], numberPool, null);
    const precision = decodeEnum(row?.[4], PRECISION_CODES, "unknown");
    const watchedAtValue = String(row?.[3] || "").trim();
    const createdAtHint = Number.isFinite(Number(row?.[10])) ? Number(row[10]) : null;
    const range = buildWatchedRange(watchedAtValue, precision, createdAtHint ?? idx);
    const createdAt = createdAtHint ?? Number(range.watchedAtSort || idx);
    const characterRefs = toArray(row?.[9]).map((ref, refIndex) => decodeCharacterRefCompact(ref, anilistId, pool, numberPool, refIndex)).filter(Boolean);
    return {
      id: normalizeString(row?.[0], `log-${idx}`),
      anilistId,
      eventType: decodeEnum(row?.[2], EVENT_CODES, "시작"),
      watchedAtValue,
      watchedAtPrecision: precision,
      watchedAtStart: range.watchedAtStart,
      watchedAtEnd: range.watchedAtEnd,
      watchedAtSort: Number(range.watchedAtSort || createdAt),
      cue: decodeStringRef(row?.[5], pool, ""),
      note: decodeStringRef(row?.[6], pool, ""),
      contextTags: toArray(row?.[8]).map((tag) => decodeStringRef(tag, pool, "")).filter(Boolean),
      scoreAtThatTime: row?.[7] == null ? null : Number(row[7]),
      characterIds: characterRefs.map((ref) => ref.characterId),
      characterRefs,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
function encodePinsCompact(rows, poolMap, numberPoolMap) {
  return (rows || []).map((pin) =>
    trimCompactArray([
      encodeNumberRef(pin.characterId, numberPoolMap),
      encodeNumberRef(pin.mediaId, numberPoolMap),
      encodeStringRef(pin.nameSnapshot, poolMap),
      encodeStringRef(pin.imageSnapshot, poolMap),
      encodeStringRef(pin.note, poolMap),
      encodeStringRef(pin.pinReason, poolMap),
      pin.pinnedFromLogId || pin.sourceLogId || null,
      pin.id && pin.id !== `${Number(pin.characterId)}:${Number(pin.mediaId)}` ? pin.id : null,
    ])
  );
}
function decodePinsCompact(rows, pool, numberPool) {
  return toArray(rows).map((row, idx, allRows) => {
    const characterId = decodeNumberRef(row?.[0], numberPool, null);
    const mediaId = decodeNumberRef(row?.[1], numberPool, null);
    const linkedLogId = row?.[6] ? String(row[6]) : null;
    return {
      id: row?.[7] ? String(row[7]) : `${characterId}:${mediaId}`,
      characterId,
      mediaId,
      nameSnapshot: decodeStringRef(row?.[2], pool, `#${characterId}`),
      imageSnapshot: decodeStringRef(row?.[3], pool, "") || null,
      note: decodeStringRef(row?.[4], pool, ""),
      sourceLogId: linkedLogId,
      pinReason: decodeStringRef(row?.[5], pool, ""),
      pinnedFromLogId: linkedLogId,
      pinnedAt: allRows.length - idx,
    };
  });
}
function encodePreferencesCompact(preferences) {
  if (!preferences || typeof preferences !== "object") return null;
  const cardViewCode = preferences?.cardView ? encodeEnum(preferences.cardView, CARD_VIEW_CODES, null) : null;
  return trimCompactArray([
    Number.isFinite(Number(preferences?.cardsPerRowBase)) ? Number(preferences.cardsPerRowBase) : null,
    cardViewCode === 0 ? null : cardViewCode,
  ]);
}
function decodePreferencesCompact(raw) {
  if (!Array.isArray(raw)) return undefined;
  const out = {};
  if (Number.isFinite(Number(raw?.[0]))) out.cardsPerRowBase = Number(raw[0]);
  const cardView = decodeEnum(raw?.[1], CARD_VIEW_CODES, "");
  if (cardView === "meta" || cardView === "poster") out.cardView = cardView;
  return Object.keys(out).length ? out : undefined;
}
function decodeCompactSnapshot(raw) {
  const pool = toArray(raw?.s).map((value) => String(value || ""));
  const numberPool = toArray(raw?.n).map((value) => Number(value)).filter((value) => Number.isFinite(value));
  return {
    app: "ani-site",
    version: SYNC_SNAPSHOT_VERSION,
    exportedAt: normalizeIsoString(raw?.e, DEFAULT_EXPORT_ISO),
    list: decodeListCompact(raw?.l, pool, numberPool),
    tierTopics: decodeTierTopicsCompact(raw?.tt, pool, numberPool),
    watchLogs: decodeWatchLogsCompact(raw?.w, pool, numberPool),
    characterPins: decodePinsCompact(raw?.p, pool, numberPool),
    preferences: decodePreferencesCompact(raw?.pr),
  };
}

export function encodeSyncSnapshot(snapshot) {
  const normalized = normalizeExpandedSnapshot(snapshot);
  const { strings, map } = buildStringPool(normalized);
  const { numbers, map: numberMap } = buildNumberPool(normalized);
  const payload = {
    v: SYNC_SNAPSHOT_VERSION,
    e: normalized.exportedAt === DEFAULT_EXPORT_ISO ? undefined : normalized.exportedAt,
    s: strings.length ? strings : undefined,
    n: numbers.length ? numbers : undefined,
    l: normalized.list.length ? encodeListCompact(normalized.list, map, numberMap) : undefined,
    tt: encodeTierTopicsCompact(normalized.tierTopics, map, numberMap) || undefined,
    w: normalized.watchLogs.length ? encodeWatchLogsCompact(normalized.watchLogs, map, numberMap) : undefined,
    p: normalized.characterPins.length ? encodePinsCompact(normalized.characterPins, map, numberMap) : undefined,
    pr: encodePreferencesCompact(normalized.preferences) || undefined,
  };
  return payload;
}
export function normalizeSyncSnapshot(snapshot) {
  return normalizeExpandedSnapshot(isCompactSnapshot(snapshot) ? decodeCompactSnapshot(snapshot) : snapshot);
}
export async function exportSyncSnapshot() {
  const [list, tierTopics, characterPins] = await Promise.all([
    readLibraryListPreferred([]).catch(() => []),
    readTierBoardBundlePreferred(null).catch(() => null),
    listCharacterPinsPreferred().catch(() => []),
  ]);
  const activeTier = getActiveTierTopic(tierTopics)?.tier || { unranked: [], tiers: {} };
  const cardsPerRowBase = readJson(STORAGE_KEYS.cardsPerRowBase, null);
  const cardView = String(readJson(STORAGE_KEYS.cardView, "") || "").trim();
  return normalizeSyncSnapshot({
    app: "ani-site",
    version: SYNC_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    list,
    tier: activeTier,
    tierTopics,
    watchLogs: readAllWatchLogsSnapshot(),
    characterPins,
    preferences:
      Number.isFinite(Number(cardsPerRowBase)) || cardView === "meta" || cardView === "poster"
        ? {
            ...(Number.isFinite(Number(cardsPerRowBase)) ? { cardsPerRowBase: Number(cardsPerRowBase) } : {}),
            ...(cardView === "meta" || cardView === "poster" ? { cardView } : {}),
          }
        : undefined,
  });
}
export function isSnapshotEffectivelyEmpty(snapshot) {
  const safe = normalizeSyncSnapshot(snapshot);
  const hasPreferences = safe.preferences && Object.keys(safe.preferences).length > 0;
  return safe.list.length === 0 &&
    safe.watchLogs.length === 0 &&
    safe.characterPins.length === 0 &&
    !hasPreferences &&
    safe.tier.unranked.length === 0 &&
    Object.values(safe.tier.tiers || {}).every((rows) => !Array.isArray(rows) || rows.length === 0);
}
export async function applySyncSnapshot(snapshot) {
  const safe = normalizeSyncSnapshot(snapshot);
  writeLibraryList(safe.list, { skipSyncMark: true });
  writeTierBoardBundle(safe.tierTopics || safe.tier, { skipSyncMark: true });
  await replaceWatchLogs(safe.watchLogs, { skipSyncMark: true });
  await replaceCharacterPins(safe.characterPins, { skipSyncMark: true });
  const cardsPerRowBase = Number(safe.preferences?.cardsPerRowBase);
  if (Number.isFinite(cardsPerRowBase)) writeJson(STORAGE_KEYS.cardsPerRowBase, cardsPerRowBase);
  const cardView = String(safe.preferences?.cardView || "").trim();
  if (cardView === "meta" || cardView === "poster") writeJson(STORAGE_KEYS.cardView, cardView);
  return safe;
}
export function downloadSnapshotJson(snapshot, filename = "") {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  const blob = new Blob([JSON.stringify(encodeSyncSnapshot(snapshot))], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = filename || `ani-site-sync-backup-${date}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
