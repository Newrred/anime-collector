import { normalizeRewatchDate, normalizeScoreValue } from "./animeState.js";
import { stableStringify } from "./syncHash.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function trimString(value) {
  return String(value || "").trim();
}

function normalizeIso(value) {
  const raw = trimString(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function normalizeDateValue(value) {
  const raw = trimString(value);
  return raw || null;
}

function buildComparableRow(row) {
  if (!row || typeof row !== "object") return row;
  const { user_id, updated_at, ...rest } = row;
  return rest;
}

export function buildLibraryCloudRows(userId, items, updatedAt = new Date().toISOString()) {
  const safeUserId = trimString(userId);
  return toArray(items).map((item, index) => ({
    user_id: safeUserId,
    anilist_id: Number(item?.anilistId),
    ko_title: item?.koTitle ? String(item.koTitle) : null,
    status: trimString(item?.status) || "미분류",
    score: item?.score == null ? null : normalizeScoreValue(item.score),
    memo: String(item?.memo || ""),
    rewatch_count: Number.isFinite(Number(item?.rewatchCount)) ? Math.max(0, Math.round(Number(item.rewatchCount))) : 0,
    last_rewatch_at: normalizeRewatchDate(item?.lastRewatchAt),
    sort_order: Number.isFinite(Number(item?.addedAt)) ? Number(item.addedAt) : index,
    updated_at: updatedAt,
  })).filter((row) => Number.isFinite(row.anilist_id));
}

export function libraryCloudRowsToItems(rows) {
  return toArray(rows)
    .map((row, index) => ({
      anilistId: Number(row?.anilist_id),
      koTitle: row?.ko_title ? String(row.ko_title) : null,
      status: trimString(row?.status) || "미분류",
      score: row?.score == null ? null : normalizeScoreValue(row.score),
      memo: String(row?.memo || ""),
      rewatchCount: Number.isFinite(Number(row?.rewatch_count)) ? Math.max(0, Math.round(Number(row.rewatch_count))) : 0,
      lastRewatchAt: normalizeRewatchDate(row?.last_rewatch_at),
      addedAt: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index,
    }))
    .filter((row) => Number.isFinite(row.anilistId))
    .sort((a, b) => Number(a.addedAt || 0) - Number(b.addedAt || 0) || a.anilistId - b.anilistId);
}

export function buildWatchLogCloudRows(userId, logs, updatedAt = new Date().toISOString()) {
  const safeUserId = trimString(userId);
  return toArray(logs).map((log) => ({
    user_id: safeUserId,
    log_id: trimString(log?.id),
    anilist_id: Number(log?.anilistId),
    event_type: trimString(log?.eventType) || "시작",
    watched_at_value: normalizeDateValue(log?.watchedAtValue),
    watched_at_precision: trimString(log?.watchedAtPrecision) || "unknown",
    cue: String(log?.cue || ""),
    note: String(log?.note || ""),
    score_at_that_time: log?.scoreAtThatTime == null ? null : normalizeScoreValue(log.scoreAtThatTime),
    context_tags: toArray(log?.contextTags).map((tag) => String(tag || "").trim()).filter(Boolean),
    character_refs: toArray(log?.characterRefs),
    created_at: Number.isFinite(Number(log?.createdAt)) ? Number(log.createdAt) : Date.now(),
    updated_at: updatedAt,
  })).filter((row) => row.log_id && Number.isFinite(row.anilist_id));
}

export function watchLogCloudRowsToLogs(rows) {
  return toArray(rows)
    .map((row) => ({
      id: trimString(row?.log_id),
      anilistId: Number(row?.anilist_id),
      eventType: trimString(row?.event_type) || "시작",
      watchedAtValue: normalizeDateValue(row?.watched_at_value) || "",
      watchedAtPrecision: trimString(row?.watched_at_precision) || "unknown",
      cue: String(row?.cue || ""),
      note: String(row?.note || ""),
      scoreAtThatTime: row?.score_at_that_time == null ? null : normalizeScoreValue(row.score_at_that_time),
      contextTags: toArray(row?.context_tags).map((tag) => String(tag || "").trim()).filter(Boolean),
      characterRefs: toArray(row?.character_refs),
      createdAt: Number.isFinite(Number(row?.created_at)) ? Number(row.created_at) : Date.now(),
    }))
    .filter((row) => row.id && Number.isFinite(row.anilistId));
}

export function buildCharacterPinCloudRows(userId, pins, updatedAt = new Date().toISOString()) {
  const safeUserId = trimString(userId);
  return toArray(pins).map((pin, index) => ({
    user_id: safeUserId,
    pin_id: trimString(pin?.id) || `${Number(pin?.characterId)}:${Number(pin?.mediaId)}`,
    character_id: Number(pin?.characterId),
    media_id: Number(pin?.mediaId),
    name_snapshot: trimString(pin?.nameSnapshot) || `#${Number(pin?.characterId)}`,
    image_snapshot: trimString(pin?.imageSnapshot) || null,
    note: String(pin?.note || ""),
    pin_reason: trimString(pin?.pinReason) || "",
    linked_log_id: trimString(pin?.pinnedFromLogId || pin?.sourceLogId) || null,
    sort_order: Number.isFinite(Number(pin?.pinnedAt)) ? Number(pin.pinnedAt) : index,
    updated_at: updatedAt,
  })).filter((row) => row.pin_id && Number.isFinite(row.character_id) && Number.isFinite(row.media_id));
}

export function characterPinCloudRowsToPins(rows) {
  return toArray(rows)
    .map((row, index) => {
      const linkedLogId = trimString(row?.linked_log_id) || null;
      return {
        id: trimString(row?.pin_id) || `${Number(row?.character_id)}:${Number(row?.media_id)}`,
        characterId: Number(row?.character_id),
        mediaId: Number(row?.media_id),
        nameSnapshot: trimString(row?.name_snapshot) || `#${Number(row?.character_id)}`,
        imageSnapshot: trimString(row?.image_snapshot) || null,
        note: String(row?.note || ""),
        sourceLogId: linkedLogId,
        pinReason: trimString(row?.pin_reason) || "",
        pinnedFromLogId: linkedLogId,
        pinnedAt: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : index,
      };
    })
    .filter((row) => row.id && Number.isFinite(row.characterId) && Number.isFinite(row.mediaId))
    .sort((a, b) => Number(b.pinnedAt || 0) - Number(a.pinnedAt || 0) || String(a.id).localeCompare(String(b.id)));
}

export function buildPreferenceCloudRow(userId, preferences, updatedAt = new Date().toISOString()) {
  if (!preferences || typeof preferences !== "object") return null;
  const safeUserId = trimString(userId);
  const cardsPerRowBase = Number(preferences?.cardsPerRowBase);
  const cardView = trimString(preferences?.cardView);
  const row = {
    user_id: safeUserId,
    cards_per_row_base: Number.isFinite(cardsPerRowBase) ? cardsPerRowBase : null,
    card_view: cardView === "meta" || cardView === "poster" ? cardView : null,
    updated_at: updatedAt,
  };
  if (row.cards_per_row_base == null && row.card_view == null) return null;
  return row;
}

export function preferenceCloudRowToPreferences(row) {
  if (!row || typeof row !== "object") return undefined;
  const cardsPerRowBase = Number(row?.cards_per_row_base);
  const cardView = trimString(row?.card_view);
  const out = {};
  if (Number.isFinite(cardsPerRowBase)) out.cardsPerRowBase = cardsPerRowBase;
  if (cardView === "meta" || cardView === "poster") out.cardView = cardView;
  return Object.keys(out).length ? out : undefined;
}

export function diffCloudRows(localRows, remoteRows, keyField, options = {}) {
  const forceAll = options?.forceAll === true;
  const localMap = new Map(toArray(localRows).map((row) => [String(row?.[keyField] || ""), row]).filter(([key]) => key));
  const remoteMap = new Map(toArray(remoteRows).map((row) => [String(row?.[keyField] || ""), row]).filter(([key]) => key));
  const upsertRows = [];
  const deleteKeys = [];

  for (const [key, localRow] of localMap.entries()) {
    const remoteRow = remoteMap.get(key);
    if (
      forceAll ||
      !remoteRow ||
      stableStringify(buildComparableRow(localRow)) !== stableStringify(buildComparableRow(remoteRow))
    ) {
      upsertRows.push(localRow);
    }
  }

  for (const key of remoteMap.keys()) {
    if (!localMap.has(key)) deleteKeys.push(key);
  }

  return { upsertRows, deleteKeys };
}

export function maxIsoTimestamps(values) {
  let best = null;
  let bestMs = -1;
  for (const value of toArray(values)) {
    const iso = normalizeIso(value);
    if (!iso) continue;
    const ms = Date.parse(iso);
    if (ms > bestMs) {
      bestMs = ms;
      best = iso;
    }
  }
  return best;
}
