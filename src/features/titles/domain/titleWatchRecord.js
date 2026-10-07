import { REWATCH_COUNT_MAX } from "../../../domain/animeState.js";
import { isWatchCatalogId } from "../../../domain/watchLogIdentity.js";

export const WATCH_STATUSES = ["미분류", "보는중", "완료", "보류", "하차", "볼예정"];
export const WATCH_EVENTS = ["NOTE", "시작", "완료", "재시청", "하차"];
export const normalizeWatchStatus = (value) => WATCH_STATUSES.includes(value) ? value
  : ({ watching: "보는중", completed: "완료", on_hold: "보류", dropped: "하차", planning: "볼예정" }[String(value || "").toLowerCase()] || "미분류");

export function titleWatchIdentity(album) {
  const catalogAnimeId = album?.titleRef?.kind === "ANIME" && isWatchCatalogId(album.titleRef.animeId)
    ? album.titleRef.animeId.toLowerCase() : null;
  const id = Number(album?.anilistId);
  const anilistId = Number.isSafeInteger(id) && id > 0 ? id : null;
  if (!catalogAnimeId && !anilistId) throw new Error("TITLE_NOT_SAVEABLE");
  return { anilistId, ...(catalogAnimeId ? { catalogAnimeId } : {}) };
}

export function validateTitleWatchRecord(raw) {
  if (!WATCH_STATUSES.includes(raw.watchStatus)) throw new Error("INVALID_STATUS");
  const rating = raw.rating == null || String(raw.rating).trim() === "" ? null : Number(raw.rating);
  if (rating != null && (!Number.isFinite(rating) || rating < 0 || rating > 5 || rating * 2 % 1)) throw new Error("INVALID_SCORE");
  const rewatchCount = Number(raw.rewatchCount);
  if (!Number.isInteger(rewatchCount) || rewatchCount < 0 || rewatchCount > REWATCH_COUNT_MAX) throw new Error("INVALID_REWATCH_COUNT");
  if (!WATCH_EVENTS.includes(raw.eventType)) throw new Error("INVALID_EVENT");
  const precision = raw.watchedAtPrecision || "unknown";
  const value = String(raw.watchedAtValue || "").trim();
  let valid = precision === "unknown" && !value;
  if (precision === "year") valid = /^[1-9]\d{3}$/u.test(value);
  if (precision === "month") valid = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/u.test(value);
  if (precision === "day" && /^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }
  if (!valid) throw new Error("INVALID_WATCH_DATE");
  const note = String(raw.note || "").trim();
  if (note.length > 10000) throw new Error("NOTE_TOO_LONG");
  const operationId = String(raw.operationId || "");
  if (!/^[\w-]{8,100}$/u.test(operationId)) throw new Error("INVALID_OPERATION");
  return { operationId, watchStatus: raw.watchStatus, rating, rewatchCount, eventType: raw.eventType,
    watchedAtPrecision: precision, watchedAtValue: value, note };
}

// Historical edits do not run the new-record validator: old season precision and
// metadata belong to the existing log, not to today's title tracking state.
export function validateHistoricalWatchLogEdit(raw, original) {
  const patch = {};
  const eventType = String(raw.eventType ?? original.eventType);
  if (eventType !== original.eventType) {
    if (!WATCH_EVENTS.includes(eventType)) throw new Error("INVALID_EVENT");
    patch.eventType = eventType;
  }
  const precision = String(raw.watchedAtPrecision ?? original.watchedAtPrecision);
  const value = String(raw.watchedAtValue ?? original.watchedAtValue ?? "").trim();
  if (precision !== original.watchedAtPrecision || value !== original.watchedAtValue) {
    const dateIsValid = precision === "unknown" ? !value
      : precision === "year" ? /^[1-9]\d{3}$/u.test(value)
      : precision === "month" ? /^[1-9]\d{3}-(0[1-9]|1[0-2])$/u.test(value)
      : precision === "season" ? /^[1-9]\d{3}-(spring|summer|fall|winter)$/iu.test(value)
      : precision === "day" && /^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value)
        && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
        && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!dateIsValid) throw new Error("INVALID_WATCH_DATE");
    patch.watchedAtPrecision = precision;
    patch.watchedAtValue = value;
  }
  const cue = String(raw.cue ?? original.cue ?? "").trim();
  const note = String(raw.note ?? original.note ?? "").trim();
  if (cue.length > 120 || note.length > 10000) throw new Error("NOTE_TOO_LONG");
  if (cue !== original.cue) patch.cue = cue;
  if (note !== original.note) patch.note = note;
  if (Object.hasOwn(raw, "scoreAtThatTime")) {
    const rating = raw.scoreAtThatTime == null || raw.scoreAtThatTime === "" ? null : Number(raw.scoreAtThatTime);
    if (rating != null && (!Number.isFinite(rating) || rating < 0 || rating > 5 || rating * 2 % 1)) throw new Error("INVALID_SCORE");
    if (rating !== original.scoreAtThatTime) patch.scoreAtThatTime = rating;
  }
  if (Object.hasOwn(raw, "characterRefs")) {
    if (!Array.isArray(raw.characterRefs) || raw.characterRefs.length > 12) throw new Error("INVALID_CHARACTERS");
    if (JSON.stringify(raw.characterRefs) !== JSON.stringify(original.characterRefs || [])) {
      patch.characterRefs = raw.characterRefs;
      patch.characterIds = raw.characterRefs.map(ref => Number(ref.characterId)).filter(Number.isFinite);
    }
  }
  return patch;
}
