import { deriveKoTitleFromMedia } from "../animeTitles.js";
import { LIBRARY_EVENT, LIBRARY_STATUS } from "../../components/library/libraryCopy.js";
import { readLibraryListPreferred, writeLibraryList } from "../../repositories/libraryRepo.js";
import { appendWatchLog, createWatchLog } from "../../repositories/watchLogRepo.js";

function normalizeStatusValue(rawStatus) {
  const value = String(rawStatus || "").trim();
  if (value === LIBRARY_STATUS.watching) return LIBRARY_STATUS.watching;
  if (value === LIBRARY_STATUS.hold) return LIBRARY_STATUS.hold;
  if (value === LIBRARY_STATUS.completed) return LIBRARY_STATUS.completed;
  if (value === LIBRARY_STATUS.dropped) return LIBRARY_STATUS.dropped;
  return LIBRARY_STATUS.unclassified;
}

function eventTypeFromStatus(status) {
  if (status === LIBRARY_STATUS.watching) return LIBRARY_EVENT.start;
  if (status === LIBRARY_STATUS.completed) return LIBRARY_EVENT.complete;
  if (status === LIBRARY_STATUS.dropped) return LIBRARY_EVENT.drop;
  return null;
}

function formatLocalDate(date = new Date()) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dispatchQuickActionEvent(name) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name));
}

export async function addAnimeFromQuickAction(media, statusValue) {
  const id = Number(media?.id);
  if (!Number.isFinite(id)) throw new Error("Invalid media id");

  const list = await readLibraryListPreferred([]);
  const current = Array.isArray(list) ? list : [];
  const existing = current.find((item) => Number(item?.anilistId) === id);
  if (existing) {
    return { item: existing, alreadyExists: true, initialLog: null };
  }

  const initialStatus = normalizeStatusValue(statusValue);
  const item = {
    anilistId: id,
    koTitle: deriveKoTitleFromMedia(media) || null,
    status: initialStatus,
    score: null,
    memo: "",
    rewatchCount: 0,
    lastRewatchAt: null,
    addedAt: Date.now(),
  };

  writeLibraryList([...current, item]);

  let initialLog = null;
  const eventType = eventTypeFromStatus(initialStatus);
  if (eventType) {
    const cueByStatus = {
      [LIBRARY_STATUS.watching]: "라이브러리에 보는중 상태로 추가",
      [LIBRARY_STATUS.completed]: "라이브러리에 완료 상태로 추가",
      [LIBRARY_STATUS.dropped]: "라이브러리에 하차 상태로 추가",
    };
    initialLog = await appendWatchLog(
      createWatchLog({
        anilistId: id,
        eventType,
        watchedAtPrecision: "day",
        watchedAtValue: formatLocalDate(new Date()),
        cue: cueByStatus[initialStatus] || "라이브러리에 추가",
        note: "",
        scoreAtThatTime: null,
        contextTags: ["추가", "초기상태"],
        characterIds: [],
        characterRefs: [],
      })
    );
  }

  dispatchQuickActionEvent("moemoa:library-updated");
  if (initialLog) dispatchQuickActionEvent("moemoa:watch-log-updated");

  return { item, alreadyExists: false, initialLog };
}

export function openLibraryDeepLink({ base = "/", animeId, focus = "" }) {
  const id = Number(animeId);
  if (!Number.isFinite(id)) return;
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();
  params.set("animeId", String(id));
  if (focus && focus !== "detail") params.set("focus", focus);
  window.location.href = `${base}library/?${params.toString()}`;
}
