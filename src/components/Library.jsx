import { useEffect, useMemo, useRef, useState } from "react";
import myListSeed from "../data/myAnime.json";
import aliasSeed from "../data/aliases.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import AddAnime from "./AddAnime.jsx";
import {
  clamp,
  dedupeByAnilistId,
  mergeTierState,
  normalizeImportList,
  normalizeItem,
  normalizeRewatchCount,
  normalizeRewatchDate,
  normalizeScoreValue,
  normalizeTierState,
  sameItem,
  SCORE_MAX,
  SCORE_STEP,
} from "../domain/animeState";
import { mergeTierTopicBundles, normalizeTierTopicBundle } from "../domain/tierTopics";
import { useStoredState } from "../hooks/useStoredState";
import { STORAGE_KEYS } from "../storage/keys";
import { readTierBoardBundle, readTierState, writeTierBoardBundle, writeTierState, pruneTierByAnimeId } from "../repositories/tierRepo";
import { readLibraryListPreferred, writeLibraryList } from "../repositories/libraryRepo";
import {
  markManualBackupExported,
  readLastExportAtMs,
  writeAutoBackupSnapshot,
} from "../repositories/backupRepo";
import {
  appendWatchLog,
  buildWatchedRange,
  createWatchLog,
  listWatchLogsByAnimeId,
  mergeWatchLogs,
  readAllWatchLogsSnapshot,
  replaceWatchLogs,
  updateWatchLog,
} from "../repositories/watchLogRepo";
import {
  listCharacterPinsPreferred,
  mergeCharacterPins,
  readCharacterPinsSnapshot,
  removeCharacterPin,
  replaceCharacterPins,
  upsertCharacterPin,
} from "../repositories/characterPinRepo";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration";
import { wikidataGetKoTitlesByAniListIds } from "../lib/wikidata";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { Chip, CollapsiblePanelHeader, GenresRow, SegTabButton } from "./library/LibraryUi.jsx";
import LibraryStatsPanel from "./library/LibraryStatsPanel.jsx";
import LibraryFiltersPanel from "./library/LibraryFiltersPanel.jsx";
import LibraryDetailModal from "./library/LibraryDetailModal.jsx";
import LibraryQuickLogSheet from "./library/LibraryQuickLogSheet.jsx";
import {
  AFFINITY_OPTIONS,
  BACKUP_REMIND_DAYS,
  LIBRARY_EVENT,
  LIBRARY_STATUS,
  REASON_TAG_OPTIONS,
  SEASON_TERM_OPTIONS,
  formatAffinityLabel,
  formatGenreLabel,
  formatRelationTypeLabel,
  formatReasonTagLabel,
  formatStatusLabel,
} from "./library/libraryCopy.js";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { formatRelativeAgo, pickByLocale } from "../domain/uiText";
import { deriveKoTitleFromMedia, firstHangulSynonym, pickDisplayMediaTitle, pickDisplayTitle } from "../domain/animeTitles";

function safeGenres(media) {
  const arr = media?.genres;
  return Array.isArray(arr) ? arr.filter(Boolean) : [];
}

function formatLocalDate(date = new Date()) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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

function formatWatchLogDate(log, locale = "ko") {
  const value = String(log?.watchedAtValue || "").trim();
  if (value) return value;
  const createdAt = Number(log?.createdAt);
  if (!Number.isFinite(createdAt)) return locale === "en" ? "Date unknown" : "날짜 잘 모름";
  return new Date(createdAt).toISOString().slice(0, 10);
}

function parseSeasonValue(value) {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{4})-(Spring|Summer|Fall|Winter)$/i);
  if (!m) return null;
  return { year: m[1], term: `${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}` };
}

function normalizeQuickLogPrecision(raw) {
  const p = String(raw || "").toLowerCase();
  if (["day", "month", "season", "year", "unknown"].includes(p)) return p;
  return "day";
}

function defaultQuickLogValue(precision) {
  const nowIso = formatLocalDate(new Date());
  if (precision === "day") return nowIso;
  if (precision === "month") return nowIso.slice(0, 7);
  if (precision === "year") return nowIso.slice(0, 4);
  if (precision === "season") return `${nowIso.slice(0, 4)}-Spring`;
  return "";
}

function coerceQuickLogValue(precision, rawValue) {
  const raw = String(rawValue || "").trim();
  if (precision === "day") {
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : defaultQuickLogValue("day");
  }
  if (precision === "month") {
    return /^\d{4}-\d{2}$/.test(raw) ? raw : defaultQuickLogValue("month");
  }
  if (precision === "year") {
    return /^\d{4}$/.test(raw) ? raw : defaultQuickLogValue("year");
  }
  if (precision === "season") {
    const season = parseSeasonValue(raw);
    const year = season?.year || defaultQuickLogValue("year");
    const term = season?.term || "Spring";
    return `${year}-${term}`;
  }
  return "";
}

function buildQuickLogInputByPrecision(draft) {
  const precision = normalizeQuickLogPrecision(draft?.watchedAtPrecision);
  const raw = String(draft?.watchedAtValue || "").trim();

  if (precision === "day") {
    return { precision, value: coerceQuickLogValue("day", raw) };
  }
  if (precision === "month") {
    return { precision, value: coerceQuickLogValue("month", raw) };
  }
  if (precision === "year") {
    return { precision, value: coerceQuickLogValue("year", raw) };
  }
  if (precision === "season") {
    return { precision, value: coerceQuickLogValue("season", raw) };
  }
  return { precision: "unknown", value: "" };
}

function isHangulText(s) {
  return /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(String(s || ""));
}

function pickCharacterName(node) {
  const full = String(node?.name?.full || "").trim();
  const native = String(node?.name?.native || "").trim();
  let name = "Unknown";

  if (isHangulText(full)) name = full;
  else if (isHangulText(native)) name = native;
  else name = full || native || "Unknown";

  const subName = [full, native].find((v) => v && v !== name) || "";
  return { name, subName };
}

function getCharacterRows(media, limit = 8) {
  const edges = media?.characters?.edges;
  if (!Array.isArray(edges)) return [];

  const mapped = edges
    .map((edge) => {
      const { name, subName } = pickCharacterName(edge?.node);
      return {
        id: Number(edge?.node?.id),
        name,
        subName,
        image: edge?.node?.image?.medium || edge?.node?.image?.large || "",
        role: String(edge?.role || ""),
      };
    })
    .filter((x) => Number.isFinite(x.id) && x.name);

  if (!mapped.length) return [];

  mapped.sort((a, b) => {
    const ar = a.role === "MAIN" ? 0 : 1;
    const br = b.role === "MAIN" ? 0 : 1;
    return ar - br || a.name.localeCompare(b.name, "ko");
  });

  const seen = new Set();
  const out = [];
  for (const row of mapped) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

const ANIME_MEDIA_FORMATS = new Set([
  "TV",
  "TV_SHORT",
  "MOVIE",
  "SPECIAL",
  "OVA",
  "ONA",
  "MUSIC",
]);

function isAnimeMediaFormat(format) {
  const key = String(format || "").trim().toUpperCase();
  return ANIME_MEDIA_FORMATS.has(key);
}

function pickMediaTitle(media) {
  return pickDisplayMediaTitle(media, "ko");
}

function getRelatedSeriesRows(media, currentId, limit = 12, locale = "ko") {
  const edges = media?.relations?.edges;
  if (!Array.isArray(edges)) return [];

  const current = Number(currentId);
  const seen = new Set();
  const out = [];
  for (const edge of edges) {
    const node = edge?.node;
    const id = Number(node?.id);
    if (!Number.isFinite(id)) continue;
    if (Number.isFinite(current) && id === current) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const seasonYear = Number(node?.seasonYear);
    const episodes = Number(node?.episodes);
    out.push({
      id,
      relationType: String(edge?.relationType || ""),
      relationLabel: formatRelationTypeLabel(edge?.relationType, locale),
      title: pickMediaTitle(node),
      siteUrl: String(node?.siteUrl || ""),
      cover: node?.coverImage?.extraLarge || node?.coverImage?.large || node?.coverImage?.medium || "",
      seasonYear: Number.isFinite(seasonYear) ? seasonYear : null,
      format: String(node?.format || ""),
      episodes: Number.isFinite(episodes) && episodes > 0 ? episodes : null,
      media: node,
    });

    if (out.length >= limit) break;
  }
  return out;
}

function buildAliasKoTitleMap(seed) {
  const out = new Map();
  if (!Array.isArray(seed)) return out;

  for (const row of seed) {
    const id = Number(row?.anilistId);
    if (!Number.isFinite(id) || out.has(id)) continue;

    const ko = String(row?.ko || "").trim();
    if (ko) {
      out.set(id, ko);
      continue;
    }

    const aliases = Array.isArray(row?.aliases) ? row.aliases : [];
    const koAlias = aliases
      .map((v) => String(v || "").trim())
      .find((v) => v && /[\uAC00-\uD7A3]/.test(v));
    if (koAlias) out.set(id, koAlias);
  }

  return out;
}

const ALIAS_KO_TITLE_MAP = buildAliasKoTitleMap(aliasSeed);

export default function Library() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = pickByLocale(locale, {
    ko: {
      fallbackBackup: "자동 로컬 백업이 켜져 있어요. 주기적으로 JSON 내보내기를 권장합니다.",
      title: "애니 보관함",
      lead: "지금까지 본 작품을 모아 두고 다시 꺼내보는 개인 보관함",
      addPanel: "추가할 애니 검색",
      addPanelSummarySearch: "검색으로 직접 추가",
      addPanelSummaryRecommend: "AI 추천 준비 중",
      addPanelOpen: "추가할 애니 검색 접기",
      addPanelClosed: "추가할 애니 검색 펼치기",
      searchTab: "애니 검색",
      recommendTab: "AI 추천",
      recommendPlaceholder: "추후 구현 예정: 시청기록 기반 추천",
      openDetail: "상세 열기",
      unrated: "미평가",
      starLabel: "별점",
      backupNone: "수동 백업 기록이 없습니다. 내보내기(JSON)로 백업해 두세요.",
      backupWas: "마지막 수동 백업이",
      backupRefresh: "입니다. 백업 갱신을 권장합니다.",
      backupLast: "마지막 수동 백업:",
      backupAuto: "(자동 로컬 스냅샷은 계속 저장)",
      installed: "앱이 설치됐습니다. 홈 화면에서 바로 실행할 수 있어요.",
      backupDownloaded: "백업 파일을 다운로드했어요.",
      sharedFile: "백업 JSON 파일을 공유했어요.",
      shareCancelled: "공유를 취소했어요.",
      sharedText: "백업 JSON 텍스트를 공유했어요.",
      copiedJson: "백업 JSON을 클립보드에 복사했어요.",
      shareFailed: "공유/복사에 실패했어요. JSON 파일 내보내기를 사용해 주세요.",
      missingList: "가져오기 파일에 list 배열이 없어요.",
      overwriteConfirm: "지금 보관함 데이터를 모두 바꾸고 불러올까요?",
      importDoneOverwrite: "불러오기 완료! 지금 보관함 데이터로 교체했어요.",
      importDoneMerge: "불러오기 완료! 기존 보관함 뒤에 이어서 합쳤어요.",
      emptyPaste: "붙여넣은 JSON 텍스트가 비어 있어요.",
      pasteImportFailed: "붙여넣기 가져오기 실패",
      importFailed: "가져오기 실패",
      unknownError: "알 수 없는 오류",
      nonAnimeType: "애니 형식이 아닌 항목은 보관함에 추가하지 않습니다.",
      addedRelated: "관련 시리즈를 보관함에 추가하고 상세를 열었습니다.",
      deleteAnimeConfirm: "이 작품을 보관함에서 삭제할까요?\n(점수/메모 포함된 모든 데이터가 사라집니다)",
      deleteLogConfirm: "이 감상 기록을 삭제할까요?",
      deletedLog: "감상 기록을 삭제했습니다.",
      deleteLogFailed: "감상 기록 삭제 중 오류가 발생했습니다.",
      installUnsupported: "현재 브라우저에서는 설치 프롬프트를 직접 사용할 수 없습니다.",
      installCancelled: "설치를 취소했어요. 필요하면 다시 시도해 주세요.",
      installFailed: "설치 요청 중 오류가 발생했습니다.",
    },
    en: {
      fallbackBackup: "Automatic local backup is on. Export JSON regularly for a manual backup.",
      title: "Anime Library",
      lead: "A personal library for revisiting anime you have watched",
      addPanel: "Search anime to add",
      addPanelSummarySearch: "Add directly from search",
      addPanelSummaryRecommend: "AI recommendations coming soon",
      addPanelOpen: "Collapse add anime search",
      addPanelClosed: "Expand add anime search",
      searchTab: "Search",
      recommendTab: "AI picks",
      recommendPlaceholder: "Planned next: recommendations from watch history",
      openDetail: "Open detail",
      unrated: "Unrated",
      starLabel: "Rating",
      backupNone: "No manual backup yet. Export JSON to keep a backup file.",
      backupWas: "Last manual backup was",
      backupRefresh: ". Refreshing your backup is recommended.",
      backupLast: "Last manual backup:",
      backupAuto: "(automatic local snapshots continue in the background)",
      installed: "The app was installed. You can launch it from your home screen.",
      backupDownloaded: "Downloaded backup file.",
      sharedFile: "Shared backup JSON file.",
      shareCancelled: "Share cancelled.",
      sharedText: "Shared backup JSON text.",
      copiedJson: "Copied backup JSON to clipboard.",
      shareFailed: "Share/copy failed. Use JSON file export instead.",
      missingList: "Imported file does not contain a list array.",
      overwriteConfirm: "Replace the current library data with this import?",
      importDoneOverwrite: "Import complete. Replaced current library data.",
      importDoneMerge: "Import complete. Merged into the existing library.",
      emptyPaste: "Pasted JSON text is empty.",
      pasteImportFailed: "Paste import failed",
      importFailed: "Import failed",
      unknownError: "Unknown error",
      nonAnimeType: "Non-anime entries are not added to the library.",
      addedRelated: "Added the related series to the library and opened its detail view.",
      deleteAnimeConfirm: "Remove this anime from the library?\n(All score and memo data will be deleted.)",
      deleteLogConfirm: "Delete this watch log?",
      deletedLog: "Deleted the watch log.",
      deleteLogFailed: "Failed while deleting the watch log.",
      installUnsupported: "This browser cannot open the install prompt directly.",
      installCancelled: "Install cancelled. You can try again later.",
      installFailed: "Failed while requesting install.",
    },
  });
  const [sortKey, setSortKey] = useState("addedAt"); // addedAt | title | score | year | genre
  const [sortDir, setSortDir] = useState("desc"); // asc | desc
  const [groupByStatus, setGroupByStatus] = useState(true);
  const [items, setItems] = useStoredState(STORAGE_KEYS.list, myListSeed);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("전체");

  // 장르 다중 선택(영문 원본 값 배열)
  const [genre, setGenre] = useState([]); // [] = 전체

  const [selectedId, setSelectedId] = useState(null);
  const [hoverScore, setHoverScore] = useState(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [rewatchCountDraft, setRewatchCountDraft] = useState(0);
  const [lastRewatchAtDraft, setLastRewatchAtDraft] = useState("");
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [characterPins, setCharacterPins] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogDraft, setQuickLogDraft] = useState(null);
  const [quickLogCandidates, setQuickLogCandidates] = useState([]);
  const [quickLogCharacterIds, setQuickLogCharacterIds] = useState([]);
  const [quickLogPrimaryCharacterId, setQuickLogPrimaryCharacterId] = useState(null);
  const [quickLogCharacterMeta, setQuickLogCharacterMeta] = useState({});
  const [quickLogContext, setQuickLogContext] = useState(null);
  const [relatedKoTitleById, setRelatedKoTitleById] = useState({});

  const [backupMsg, setBackupMsg] = useState("");
  const [backupReminder, setBackupReminder] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(true);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);
  const [addTab, setAddTab] = useState("search"); // search | recommend
  const [cardView, setCardView] = useState("meta"); // meta | poster
  const [cardsPerRowBase, setCardsPerRowBase] = useStoredState(STORAGE_KEYS.cardsPerRowBase, 5);
  const gridRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(0);
  const deepLinkHandledRef = useRef(false);
  const genreKo = (value) => formatGenreLabel(value, locale);
  const affinityLabel = (value) => formatAffinityLabel(value, locale);
  const reasonTagLabel = (value) => formatReasonTagLabel(value, locale);

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureLegacyStorageMigrated().catch(() => {});
      const preferred = await readLibraryListPreferred(myListSeed).catch(() => null);
      if (!alive || !Array.isArray(preferred)) return;

      setItems((prev) => {
        const source = Array.isArray(prev) ? prev : [];
        const next = dedupeByAnilistId(
          preferred.map((it, idx) =>
            normalizeItem(
              it,
              Number.isFinite(Number(it?.addedAt)) ? Number(it.addedAt) : idx
            )
          )
        );

        if (
          source.length === next.length &&
          next.every((it, idx) => sameItem(it, source[idx]))
        ) {
          return prev;
        }
        return next;
      });
    })();
    return () => {
      alive = false;
    };
  }, [setItems]);

  useEffect(() => {
    writeLibraryList(items, { mirrorOnly: true });
  }, [items]);

  useEffect(() => {
    setItems((prev) => {
      const source = Array.isArray(prev) ? prev : [];
      const normalized = dedupeByAnilistId(
        source.map((it, idx) =>
          normalizeItem(
            it,
            Number.isFinite(Number(it?.addedAt)) ? Number(it.addedAt) : idx
          )
        )
      );

      if (!Array.isArray(prev)) {
        return normalized;
      }
      if (
        normalized.length === source.length &&
        normalized.every((it, idx) => sameItem(it, source[idx]))
      ) {
        return prev;
      }
      return normalized;
    });
  }, [setItems]);

  function buildBackupPayload() {
    const tier = readTierState(null);

    return {
      app: "ani-site",
      version: 3,
      exportedAt: new Date().toISOString(),
      list: normalizeImportList(items),
      tier,
      watchLogs: readAllWatchLogsSnapshot(),
      characterPins: readCharacterPinsSnapshot(),
      preferences: {
        cardsPerRowBase,
        cardView,
      },
    };
  }

  function markBackupExported(message) {
    markManualBackupExported(new Date().toISOString());
    setBackupMsg(message);
  }

  function exportBackup() {
    const payload = buildBackupPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ani-site-backup-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    markBackupExported(copy.backupDownloaded);
  }

  async function exportBackupMobile() {
    const payload = buildBackupPayload();
    const text = JSON.stringify(payload, null, 2);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `ani-site-backup-${date}.json`;

    try {
      const file = new File([text], filename, { type: "application/json" });
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: locale === "en" ? "Anime Library Backup" : "애니 보관함 백업",
          files: [file],
        });
        markBackupExported(copy.sharedFile);
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        setBackupMsg(copy.shareCancelled);
        return;
      }
    }

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: locale === "en" ? "Anime Library Backup (JSON)" : "애니 보관함 백업(JSON)",
          text,
        });
        markBackupExported(copy.sharedText);
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        setBackupMsg(copy.shareCancelled);
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      markBackupExported(copy.copiedJson);
    } catch {
      setBackupMsg(copy.shareFailed);
    }
  }

  async function importBackupFromJson(json, mode = "merge") {
    const incomingList = Array.isArray(json) ? json : json?.list;
    if (!Array.isArray(incomingList)) {
      throw new Error(copy.missingList);
    }

    const incomingNormalized = normalizeImportList(incomingList);
    const isOverwrite = mode === "overwrite";

    if (isOverwrite) {
      const ok = window.confirm(copy.overwriteConfirm);
      if (!ok) return;
      setItems(incomingNormalized);
    } else {
      setItems((prev) => dedupeByAnilistId([...prev, ...incomingNormalized]));
    }

    const incomingTierBundle = !Array.isArray(json) ? json?.tierTopics : null;
    const incomingTier = !Array.isArray(json) ? json?.tier : null;
    if (incomingTierBundle || incomingTier) {
      if (incomingTierBundle) {
        const currentBundle = readTierBoardBundle(null);
        const nextBundle = isOverwrite
          ? normalizeTierTopicBundle(incomingTierBundle, null)
          : mergeTierTopicBundles(currentBundle, incomingTierBundle);
        writeTierBoardBundle(nextBundle);
      } else if (incomingTier) {
        const currentTier = readTierState(null);
        const nextTier = isOverwrite
          ? normalizeTierState(incomingTier)
          : mergeTierState(currentTier, incomingTier);
        writeTierState(nextTier);
      }
    }

    const incomingLogs = !Array.isArray(json) ? json?.watchLogs : null;
    if (Array.isArray(incomingLogs)) {
      if (isOverwrite) {
        await replaceWatchLogs(incomingLogs);
      } else {
        await mergeWatchLogs(incomingLogs);
      }
      if (selectedId) {
        const rows = await listWatchLogsByAnimeId(selectedId).catch(() => []);
        setSelectedLogs(Array.isArray(rows) ? rows : []);
      }
    } else if (isOverwrite) {
      await replaceWatchLogs([]);
      setSelectedLogs([]);
    }

    const incomingPins = !Array.isArray(json) ? json?.characterPins : null;
    if (Array.isArray(incomingPins)) {
      if (isOverwrite) {
        await replaceCharacterPins(incomingPins);
      } else {
        await mergeCharacterPins(incomingPins);
      }
      refreshCharacterPins();
    } else if (isOverwrite) {
      await replaceCharacterPins([]);
      refreshCharacterPins();
    }

    const incomingPrefs = !Array.isArray(json) ? json?.preferences : null;
    if (incomingPrefs && typeof incomingPrefs === "object") {
      if (Object.prototype.hasOwnProperty.call(incomingPrefs, "cardsPerRowBase")) {
        setCardsPerRowBase(incomingPrefs.cardsPerRowBase);
      }
      if (Object.prototype.hasOwnProperty.call(incomingPrefs, "cardView")) {
        const cv = String(incomingPrefs.cardView || "");
        if (cv === "meta" || cv === "poster") setCardView(cv);
      }
    }

    setBackupMsg(
      isOverwrite
        ? copy.importDoneOverwrite
        : copy.importDoneMerge
    );
    setSelectedId(null);
  }

  async function importBackup(file, mode = "merge") {
    const text = await file.text();
    const json = JSON.parse(text);
    await importBackupFromJson(json, mode);
  }

  async function importBackupText(rawText, mode = "merge") {
    const raw = String(rawText || "").trim();
    if (!raw) {
      setBackupMsg(copy.emptyPaste);
      return;
    }

    try {
      const json = JSON.parse(raw);
      await importBackupFromJson(json, mode);
    } catch (err) {
      console.error(err);
      setBackupMsg(`${copy.pasteImportFailed}: ${err?.message || copy.unknownError}`);
      throw err;
    }
  }

  async function importBackupFile(file, mode = "merge") {
    try {
      await importBackup(file, mode);
    } catch (err) {
      console.error(err);
      setBackupMsg(`${copy.importFailed}: ${err?.message || copy.unknownError}`);
      throw err;
    }
  }

  const ids = useMemo(() => items.map((x) => x.anilistId), [items]);

  useEffect(() => {
    setItems((prev) => dedupeByAnilistId(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (deepLinkHandledRef.current) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const fromQuery = Number(params.get("animeId"));
    if (!Number.isFinite(fromQuery)) {
      deepLinkHandledRef.current = true;
      return;
    }

    const exists = items.some((x) => Number(x?.anilistId) === fromQuery);
    if (!exists) return;

    setSelectedId(fromQuery);
    deepLinkHandledRef.current = true;
  }, [items]);

  useEffect(() => {
    setMediaMap(getCachedAnimeMap(ids));

    let alive = true;
    (async () => {
      const map = await fetchAnimeByIdsCached(ids, { includeCharacters: false });
      if (alive) setMediaMap(map);
    })().catch(console.error);
    return () => {
      alive = false;
    };
  }, [ids]);

  useEffect(() => {
    setItems((prev) => {
      const baseTs = Date.now() - prev.length;
      let changed = false;
      const next = prev.map((x, idx) => {
        if (Number.isFinite(Number(x?.addedAt))) return x;
        changed = true;
        return { ...x, addedAt: baseTs + idx };
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!items.length) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        if (String(item?.koTitle || "").trim()) return item;
        const id = Number(item?.anilistId);
        const aliasKo = Number.isFinite(id) ? String(ALIAS_KO_TITLE_MAP.get(id) || "").trim() : "";
        const media = mediaMap.get(id);
        const koTitle = aliasKo || deriveKoTitleFromMedia(media);
        if (!koTitle) return item;
        changed = true;
        return { ...item, koTitle };
      });
      return changed ? next : prev;
    });
  }, [items.length, mediaMap, setItems]);

  useEffect(() => {
    const tier = readTierState(null);
    const snapshot = {
      app: "ani-site",
      version: 1,
      savedAt: new Date().toISOString(),
      list: items,
      tier,
    };
    writeAutoBackupSnapshot(snapshot);
  }, [items]);

  useEffect(() => {
    const last = readLastExportAtMs();
    if (!items.length) {
      setBackupReminder("");
      return;
    }

    if (!last) {
      setBackupReminder(copy.backupNone);
      return;
    }

    const threshold = BACKUP_REMIND_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - last >= threshold) {
      setBackupReminder(`${copy.backupWas} ${formatRelativeAgo(last, locale, { ko: "기록 없음", en: "No record" })}${copy.backupRefresh}`);
    } else {
      setBackupReminder(`${copy.backupLast} ${formatRelativeAgo(last, locale, { ko: "기록 없음", en: "No record" })} ${copy.backupAuto}`);
    }
  }, [items, backupMsg, copy.backupNone, copy.backupWas, copy.backupRefresh, copy.backupLast, copy.backupAuto, locale]);

  useEffect(() => {
    function syncInstallState() {
      setCanInstallPwa(typeof window !== "undefined" && typeof window.__promptPwaInstall === "function");
    }
    function onInstallReady() {
      setCanInstallPwa(true);
    }
    function onInstalled() {
      setCanInstallPwa(false);
      setBackupMsg(copy.installed);
    }

    syncInstallState();
    window.addEventListener("pwa-install-ready", onInstallReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-ready", onInstallReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [copy.installed]);

  useEffect(() => {
    if (!gridRef.current || typeof ResizeObserver === "undefined") return undefined;
    const el = gridRef.current;
    const ro = new ResizeObserver((entries) => {
      const width = entries?.[0]?.contentRect?.width;
      if (Number.isFinite(width)) setGridWidth(width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const statusOrder = { 보는중: 0, 완료: 1, 보류: 2, 하차: 3, 미분류: 4 };
  const statusBadgeTheme = {
    완료: { text: "#8fd3ff", border: "rgba(143,211,255,.72)", bg: "rgba(143,211,255,.14)" },
    보는중: { text: "#8ff3ba", border: "rgba(143,243,186,.72)", bg: "rgba(143,243,186,.14)" },
    보류: { text: "#ffd083", border: "rgba(255,208,131,.72)", bg: "rgba(255,208,131,.14)" },
    하차: { text: "#ff9a9a", border: "rgba(255,154,154,.72)", bg: "rgba(255,154,154,.14)" },
    미분류: { text: "#d7d9df", border: "rgba(215,217,223,.52)", bg: "rgba(215,217,223,.10)" },
  };

  function getStatusBadgeStyle(statusRaw) {
    const status = statusRaw || "미분류";
    const theme = statusBadgeTheme[status] || statusBadgeTheme.미분류;
    return {
      display: "inline-flex",
      alignItems:"center",
      justifyContent: "center",
      padding: "1px 6px",
      borderRadius: 999,
      border: `1px solid ${theme.border}`,
      background: theme.bg,
      color: theme.text,
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1.3,
      whiteSpace: "nowrap",
    };
  }

  function getTitle(it) {
    const m = mediaMap.get(it.anilistId);
    return pickCardTitle(it, m);
  }

  function pickCardTitle(item, media) {
    return pickDisplayTitle(item, media, locale);
  }
  function getYear(it) {
    const m = mediaMap.get(it.anilistId);
    return m?.seasonYear ?? -1;
  }
  function getScore(it) {
    const score = normalizeScoreValue(it?.score);
    return score == null ? -1 : score;
  }
  function getGenreKey(it) {
    const m = mediaMap.get(it.anilistId);
    const gs = safeGenres(m);
    if (!gs.length) return "";
    return gs.map((g) => genreKo(g)).join("|");
  }

  function removeAnime(id) {
    const ok = window.confirm(copy.deleteAnimeConfirm);
    if (!ok) return;

    setItems((prev) => prev.filter((x) => x.anilistId !== id));
    pruneTierByAnimeId(id);
    setSelectedId(null);
  }

  const genreSet = useMemo(() => new Set((Array.isArray(genre) ? genre : []).filter(Boolean)), [genre]);

  function clearGenres() {
    setGenre([]);
  }

  function toggleGenre(g) {
    setGenre((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const s = new Set(arr);
      if (s.has(g)) s.delete(g);
      else s.add(g);
      return [...s];
    });
  }

  // 카드 장르 태그 클릭: 기본은 해당 장르만, (Shift/Meta/Ctrl) 누르면 다중 선택 유지
  function onPickGenreFromTag(g, e) {
    const hasModifier = !!(e?.shiftKey || e?.metaKey || e?.ctrlKey);
    if (!hasModifier) {
      // 바로 필터링 느낌: 단일로 만들기(이미 단일이면 해제)
      setGenre((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        if (arr.length === 1 && arr[0] === g) return [];
        return [g];
      });
    } else {
      toggleGenre(g);
    }
  }

  // 현재 라이브러리에 저장된 장르 목록(추가 요청 없이 mediaMap 기반)
  const genreOptions = useMemo(() => {
    const s = new Set();
    for (const it of items) {
      const m = mediaMap.get(it.anilistId);
      for (const g of safeGenres(m)) s.add(g);
    }
    const arr = [...s];
    arr.sort((a, b) => genreKo(a).localeCompare(genreKo(b), "ko"));
    return arr;
  }, [items, mediaMap]);

  // 검색어(q)에 제목과 장르를 모두 포함
  function matchesQuery(it, qq) {
    if (!qq) return true;

    const m = mediaMap.get(it.anilistId);
    const gs = safeGenres(m);

    // 제목 관련
    const titles = [
      getTitle(it),
      m?.title?.english,
      m?.title?.romaji,
      m?.title?.native,
      ...(Array.isArray(m?.synonyms) ? m.synonyms : []),
      it?.koTitle,
    ].filter(Boolean);

    // 장르(영문 + 한글)
    const genreText = [
      ...gs,
      ...gs.map((g) => genreKo(g)),
    ].filter(Boolean);

    const hay = (titles.join(" ") + " " + genreText.join(" ")).toLowerCase();
    return hay.includes(qq);
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const arr = items.filter((it) => {
      if (status !== "전체" && (it.status || "미분류") !== status) return false;

      // 장르 다중 필터: 선택값이 있으면 교집합만 통과
      if (genreSet.size > 0) {
        const m = mediaMap.get(it.anilistId);
        const gs = safeGenres(m);
        let ok = false;
        for (const g of gs) {
          if (genreSet.has(g)) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      // 제목/장르 포함 검색
      if (!matchesQuery(it, qq)) return false;

      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;

    arr.sort((a, b) => {
      if (groupByStatus && status === "전체") {
        const sa = a.status || "미분류";
        const sb = b.status || "미분류";
        const da = statusOrder[sa] ?? 999;
        const db = statusOrder[sb] ?? 999;
        if (da !== db) return da - db;
      }

      let va = 0, vb = 0;

      if (sortKey === "addedAt") { va = a.addedAt ?? 0; vb = b.addedAt ?? 0; }

      if (sortKey === "title") {
        const ta = getTitle(a) || "";
        const tb = getTitle(b) || "";
        return dir * ta.localeCompare(tb, locale === "en" ? "en" : "ko") || (a.anilistId - b.anilistId);
      }

      if (sortKey === "score") { va = getScore(a); vb = getScore(b); }
      if (sortKey === "year")  { va = getYear(a);  vb = getYear(b); }

      if (sortKey === "genre") {
        const ga = getGenreKey(a);
        const gb = getGenreKey(b);
        return dir * ga.localeCompare(gb, "ko") || (a.anilistId - b.anilistId);
      }

      if (va === vb) return (a.anilistId - b.anilistId);
      return dir * (va - vb);
    });

    return arr;
  }, [items, mediaMap, q, status, sortKey, sortDir, groupByStatus, genreSet]);

  const effectiveCols = useMemo(() => {
    const base = clamp(Number(cardsPerRowBase) || 5, 2, 10);
    if (!Number.isFinite(gridWidth) || gridWidth <= 0) return base;

    const normalized = gridWidth / 1080;
    const scaled = Math.round(base * normalized);
    const minCols = cardView === "poster" ? 2 : 1;
    const minCardWidth = cardView === "poster" ? 120 : 180;
    const maxColsByWidth = Math.max(minCols, Math.floor(gridWidth / minCardWidth));
    return clamp(scaled, minCols, Math.max(minCols, maxColsByWidth));
  }, [cardsPerRowBase, gridWidth, cardView]);

  const dashboard = useMemo(() => {
    const statusRows = ["완료", "보는중", "보류", "하차", "미분류"].map((s) => ({
      key: s,
      label: formatStatusLabel(s, locale),
      count: items.filter((it) => (it.status || "미분류") === s).length,
    }));

    const genreCount = new Map();
    let scoreSum = 0;
    let scoreCount = 0;

    for (const it of items) {
      const m = mediaMap.get(it.anilistId);
      const gs = safeGenres(m);
      for (const g of gs) {
        genreCount.set(g, (genreCount.get(g) || 0) + 1);
      }

      const score = normalizeScoreValue(it?.score);
      if (score != null) {
        scoreSum += score;
        scoreCount += 1;
      }
    }

    const genreRows = [...genreCount.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "ko"))
      .slice(0, 5)
      .map(([g, count]) => ({ key: g, label: genreKo(g), count }));

    const rewatchRows = items
      .map((it) => ({
        key: String(it.anilistId),
        id: it.anilistId,
        title: getTitle(it),
        count: normalizeRewatchCount(it?.rewatchCount),
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, locale === "en" ? "en" : "ko"))
      .slice(0, 5)
      .map((row) => ({ ...row }));

    const maxStatus = Math.max(...statusRows.map((x) => x.count), 1);
    const maxGenre = Math.max(...genreRows.map((x) => x.count), 1);
    const averageScore = scoreCount > 0 ? scoreSum / scoreCount : null;

    return {
      total: items.length,
      scored: scoreCount,
      averageScore,
      statusRows,
      genreRows,
      rewatchRows,
      maxStatus,
      maxGenre,
    };
  }, [items, mediaMap, locale]);

  const selected = selectedId ? items.find((x) => x.anilistId === selectedId) : null;
  const selectedMedia = selectedId ? mediaMap.get(selectedId) : null;
  const selectedTitle = pickCardTitle(selected, selectedMedia);
  const selectedScoreRaw = normalizeScoreValue(selected?.score);
  const selectedScore = selectedScoreRaw ?? 0;
  const selectedRewatchCount = normalizeRewatchCount(selected?.rewatchCount);
  const selectedLastRewatchAt = normalizeRewatchDate(selected?.lastRewatchAt) || "";
  const previewScore = hoverScore == null ? selectedScore : hoverScore;
  const selectedStarsFill = `${(previewScore / SCORE_MAX) * 100}%`;
  const selectedScoreLabel = hoverScore != null
    ? `${hoverScore} / ${SCORE_MAX}`
    : selectedScoreRaw == null
      ? copy.unrated
      : `${selectedScore} / ${SCORE_MAX}`;
  const selectedCharacters = useMemo(
    () => getCharacterRows(selectedMedia, 8),
    [selectedMedia]
  );
  const selectedRelatedSeries = useMemo(
    () => getRelatedSeriesRows(selectedMedia, selectedId, 12, locale),
    [selectedMedia, selectedId, locale]
  );
  const itemKoTitleMap = useMemo(() => {
    const m = new Map();
    for (const item of items) {
      const id = Number(item?.anilistId);
      if (!Number.isFinite(id)) continue;
      const koTitle = String(item?.koTitle || "").trim();
      if (koTitle) m.set(id, koTitle);
    }
    return m;
  }, [items]);
  const libraryIdSet = useMemo(
    () => new Set(items.map((x) => Number(x?.anilistId)).filter(Number.isFinite)),
    [items]
  );
  const pinnedCharacterKeySet = useMemo(() => {
    const s = new Set();
    for (const pin of Array.isArray(characterPins) ? characterPins : []) {
      const cid = Number(pin?.characterId);
      const mid = Number(pin?.mediaId);
      if (!Number.isFinite(cid) || !Number.isFinite(mid)) continue;
      s.add(`${cid}:${mid}`);
    }
    return s;
  }, [characterPins]);
  const quickLogAnime = quickLogDraft
    ? items.find((x) => x.anilistId === Number(quickLogDraft.anilistId)) || null
    : null;
  const quickLogMedia = quickLogDraft ? mediaMap.get(Number(quickLogDraft.anilistId)) : null;
  const quickLogTitle = quickLogDraft ? pickCardTitle(quickLogAnime, quickLogMedia) : "";
  const quickLogSelectedCharacters = useMemo(() => {
    const ids = Array.isArray(quickLogCharacterIds)
      ? quickLogCharacterIds.map((x) => Number(x)).filter(Number.isFinite).slice(0, 3)
      : [];
    if (!ids.length) return [];
    const byId = new Map(
      (Array.isArray(quickLogCandidates) ? quickLogCandidates : []).map((c) => [Number(c.id), c])
    );
    return ids.map((id) => byId.get(id) || { id, name: `#${id}`, image: "", role: "" });
  }, [quickLogCandidates, quickLogCharacterIds]);
  const quickLogPrimaryCharacterIdSafe = useMemo(() => {
    const id = Number(quickLogPrimaryCharacterId);
    if (!Number.isFinite(id)) return null;
    return quickLogSelectedCharacters.some((c) => Number(c.id) === id) ? id : null;
  }, [quickLogPrimaryCharacterId, quickLogSelectedCharacters]);

  useEffect(() => {
    let alive = true;
    if (!selectedId) {
      setSelectedLogs([]);
      setLogsLoading(false);
      return undefined;
    }

    setLogsLoading(true);
    listWatchLogsByAnimeId(selectedId)
      .then((rows) => {
        if (!alive) return;
        setSelectedLogs(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!alive) return;
        setSelectedLogs([]);
      })
      .finally(() => {
        if (!alive) return;
        setLogsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedId]);

  useEffect(() => {
    const id = Number(selectedId);
    if (!Number.isFinite(id)) return undefined;

    const media = mediaMap.get(id);
    const hasCharacters = Array.isArray(media?.characters?.edges);
    const hasRelations = Array.isArray(media?.relations?.edges);
    if (hasCharacters && hasRelations) return undefined;

    let alive = true;
    fetchAnimeByIdsCached([id], { includeCharacters: true, includeRelations: true })
      .then((map) => {
        if (!alive) return;
        const full = map.get(id);
        if (!full) return;
        setMediaMap((prev) => {
          const current = prev.get(id);
          const currentHasCharacters = Array.isArray(current?.characters?.edges);
          const currentHasRelations = Array.isArray(current?.relations?.edges);
          if (currentHasCharacters && currentHasRelations) return prev;
          const next = new Map(prev);
          next.set(id, full);
          return next;
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [selectedId, mediaMap]);

  useEffect(() => {
    const ids = selectedRelatedSeries
      .map((row) => Number(row?.id))
      .filter(Number.isFinite);
    if (!ids.length) return undefined;

    const need = ids.filter((id) => {
      const existingKo = String(relatedKoTitleById[id] || "").trim();
      if (existingKo) return false;
      if (itemKoTitleMap.has(id)) return false;
      if (ALIAS_KO_TITLE_MAP.has(id)) return false;

      const media = mediaMap.get(id) || selectedRelatedSeries.find((row) => Number(row?.id) === id)?.media;
      return !deriveKoTitleFromMedia(media);
    });
    if (!need.length) return undefined;

    let alive = true;
    wikidataGetKoTitlesByAniListIds(need)
      .then((koMap) => {
        if (!alive) return;
        if (!(koMap instanceof Map) || koMap.size === 0) return;

        setRelatedKoTitleById((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const [rawId, rawTitle] of koMap.entries()) {
            const id = Number(rawId);
            const title = String(rawTitle || "").trim();
            if (!Number.isFinite(id) || !title) continue;
            if (next[id] === title) continue;
            next[id] = title;
            changed = true;
          }
          return changed ? next : prev;
        });

        setItems((prev) => {
          let changed = false;
          const next = prev.map((item) => {
            if (String(item?.koTitle || "").trim()) return item;
            const id = Number(item?.anilistId);
            if (!Number.isFinite(id)) return item;
            const title = String(koMap.get(id) || "").trim();
            if (!title) return item;
            changed = true;
            return { ...item, koTitle: title };
          });
          return changed ? next : prev;
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [selectedRelatedSeries, relatedKoTitleById, itemKoTitleMap, mediaMap, setItems]);

  function refreshCharacterPins() {
    const rows = readCharacterPinsSnapshot();
    setCharacterPins(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    refreshCharacterPins();
    listCharacterPinsPreferred()
      .then((rows) => {
        setCharacterPins(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
  }, []);

  async function ensureQuickLogCharacters(anilistId, fallbackMedia = null) {
    const id = Number(anilistId);
    if (!Number.isFinite(id)) {
      setQuickLogCandidates([]);
      return;
    }

    const pickFromMedia = (media) => getCharacterRows(media, 8);

    const fromFallback = fallbackMedia ? pickFromMedia(fallbackMedia) : [];
    if (fromFallback.length) {
      setQuickLogCandidates(fromFallback);
      return;
    }

    const existing = mediaMap.get(id);
    const fromExisting = pickFromMedia(existing);
    if (fromExisting.length) {
      setQuickLogCandidates(fromExisting);
      return;
    }

    try {
      const map = await fetchAnimeByIdsCached([id], { includeCharacters: true });
      const media = map.get(id);
      if (media) {
        setMediaMap((prev) => {
          const next = new Map(prev);
          next.set(id, media);
          return next;
        });
      }
      setQuickLogCandidates(pickFromMedia(media));
    } catch {
      setQuickLogCandidates([]);
    }
  }

  function openQuickLogSheet(log, fallbackMedia = null, context = null) {
    if (!log) return;
    const precision = normalizeQuickLogPrecision(log.watchedAtPrecision || "day");
    const value = coerceQuickLogValue(precision, log.watchedAtValue);

    const existingRefs = Array.isArray(log.characterRefs) ? log.characterRefs : [];
    const existingIds = Array.isArray(log.characterIds)
      ? log.characterIds.map((x) => Number(x)).filter(Number.isFinite)
      : existingRefs.map((x) => Number(x?.characterId)).filter(Number.isFinite);
    const existingPrimary = Number(
      existingRefs.find((x) => x?.isPrimary === true)?.characterId
    );
    const primaryId = Number.isFinite(existingPrimary) ? existingPrimary : null;
    const initialIds = existingIds.slice(0, 3);
    if (Number.isFinite(primaryId) && !initialIds.includes(primaryId)) {
      initialIds.unshift(primaryId);
    }
    const compactIds = [...new Set(initialIds)].slice(0, 3);
    const resolvedPrimaryId = Number.isFinite(primaryId)
      ? primaryId
      : compactIds.length
        ? compactIds[0]
        : null;
    const nextMeta = {};
    for (const id of existingIds) {
      const ref = existingRefs.find((x) => Number(x?.characterId) === id);
      nextMeta[id] = {
        affinity: ref?.affinity || "기억남음",
        reasonTags: Array.isArray(ref?.reasonTags) ? ref.reasonTags.filter(Boolean) : [],
        note: String(ref?.note || ""),
      };
    }

    setQuickLogDraft({
      logId: log.id,
      anilistId: log.anilistId,
      eventType: log.eventType,
      watchedAtPrecision: precision,
      watchedAtValue: value,
      cue: String(log.cue || "").slice(0, 120),
      note: String(log.note || ""),
    });
    setQuickLogCharacterIds(compactIds);
    setQuickLogPrimaryCharacterId(resolvedPrimaryId);
    setQuickLogCharacterMeta(nextMeta);
    setQuickLogContext(context && typeof context === "object" ? context : null);
    setQuickLogOpen(true);
    ensureQuickLogCharacters(log.anilistId, fallbackMedia).catch(() => {});
  }

  function closeQuickLogSheet() {
    setQuickLogOpen(false);
    setQuickLogDraft(null);
    setQuickLogCandidates([]);
    setQuickLogCharacterIds([]);
    setQuickLogPrimaryCharacterId(null);
    setQuickLogCharacterMeta({});
    setQuickLogContext(null);
  }

  useEffect(() => {
    if (!selectedId) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") closeSelectedModal();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedId, memoDraft, rewatchCountDraft, lastRewatchAtDraft]);

  useEffect(() => {
    setHoverScore(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    setMemoDraft(selected?.memo || "");
    setRewatchCountDraft(selectedRewatchCount);
    setLastRewatchAtDraft(selectedLastRewatchAt);
  }, [selectedId, selected?.memo, selectedRewatchCount, selectedLastRewatchAt]);

  function commitModalDraft() {
    if (!selectedId) return;
    updateSelected({
      memo: memoDraft,
      rewatchCount: rewatchCountDraft,
      lastRewatchAt: lastRewatchAtDraft || null,
    });
  }

  function closeSelectedModal() {
    commitModalDraft();
    setSelectedId(null);
  }

  function appendSelectedWatchLog(eventType, overrides = {}, options = {}) {
    if (!selectedId) return Promise.resolve(null);
    const today = formatLocalDate(new Date());
    const log = createWatchLog({
      anilistId: selectedId,
      eventType,
      watchedAtPrecision: "day",
      watchedAtValue: today,
      cue: overrides.cue || "",
      note: overrides.note || "",
      scoreAtThatTime: selectedScoreRaw ?? null,
      contextTags: overrides.contextTags || [],
      characterIds: [],
      characterRefs: [],
    });
    return appendWatchLog(log)
      .then((saved) => listWatchLogsByAnimeId(selectedId).then((rows) => ({ saved, rows })))
      .then(({ saved, rows }) => {
        if (options?.openQuickSheet && saved) {
          openQuickLogSheet(saved, selectedMedia || null, options?.quickContext || null);
        }
        return { saved, rows };
      })
      .then(({ rows, saved }) => {
        setSelectedLogs(Array.isArray(rows) ? rows : []);
        return saved;
      })
      .catch(() => {
        setBackupMsg("\uB85C\uADF8 \uC800\uC7A5 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.");
        return null;
      });
  }

  function onAddAnimeFromSearch(addedItem, addedMedia, options = {}) {
    const id = Number(addedItem?.anilistId);
    if (!Number.isFinite(id)) return;

    const initialStatus = normalizeStatusValue(options?.initialStatus || addedItem?.status);
    const eventType = eventTypeFromStatus(initialStatus);
    if (!eventType) return;

    const today = formatLocalDate(new Date());
    const cueByStatus = {
      [LIBRARY_STATUS.watching]: "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uBCF4\uB294\uC911 \uC0C1\uD0DC\uB85C \uCD94\uAC00",
      [LIBRARY_STATUS.completed]: "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uC644\uB8CC \uC0C1\uD0DC\uB85C \uCD94\uAC00",
      [LIBRARY_STATUS.dropped]: "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uD558\uCC28 \uC0C1\uD0DC\uB85C \uCD94\uAC00",
    };
    const log = createWatchLog({
      anilistId: id,
      eventType,
      watchedAtPrecision: "day",
      watchedAtValue: today,
      cue: cueByStatus[initialStatus] || "\uB77C\uC774\uBE0C\uB7EC\uB9AC\uC5D0 \uCD94\uAC00",
      note: "",
      scoreAtThatTime: null,
      contextTags: ["\uCD94\uAC00", "\uCD08\uAE30\uC0C1\uD0DC"],
      characterIds: [],
      characterRefs: [],
    });
    const quickContext = {
      source:
        initialStatus === LIBRARY_STATUS.completed
          ? "add-completed"
          : initialStatus === LIBRARY_STATUS.dropped
            ? "add-dropped"
            : "add-watching",
      isAuto: true,
      status: initialStatus,
    };
    const shouldOpenQuickSheet =
      initialStatus === LIBRARY_STATUS.completed || initialStatus === LIBRARY_STATUS.dropped;

    appendWatchLog(log)
      .then((saved) => {
        if (!saved) return;
        if (shouldOpenQuickSheet) {
          openQuickLogSheet(saved, addedMedia || null, quickContext);
        }
      })
      .catch(() => {
        setBackupMsg(locale === "en" ? "Failed to create the initial status log." : "초기 상태 로그 생성에 실패했습니다.");
      });
  }

  function onSelectedStatusChange(nextStatus) {
    const normalizedNext = normalizeStatusValue(nextStatus);
    const prevStatus = normalizeStatusValue(selected?.status);
    updateSelected({ status: normalizedNext });

    if (normalizedNext === prevStatus) return;
    const eventType = eventTypeFromStatus(normalizedNext);
    if (!eventType) return;
    appendSelectedWatchLog(eventType, {
      cue: `\uC0C1\uD0DC \uBCC0\uACBD: ${prevStatus} -> ${normalizedNext}`,
    }, {
      openQuickSheet: true,
      quickContext: { source: "status-change", isAuto: true, status: normalizedNext },
    });
  }

  function addRelatedSeriesToLibrary(row) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return;
    if (!isAnimeMediaFormat(row?.format)) {
      setBackupMsg(copy.nonAnimeType);
      return;
    }
    if (libraryIdSet.has(id)) {
      setSelectedId(id);
      return;
    }

    const derivedKoTitle =
      String(ALIAS_KO_TITLE_MAP.get(id) || "").trim() ||
      String(relatedKoTitleById[id] || "").trim() ||
      deriveKoTitleFromMedia(row?.media);

    const nextItem = normalizeItem({
      anilistId: id,
      koTitle: derivedKoTitle,
      status: LIBRARY_STATUS.unclassified,
      score: null,
      memo: "",
      rewatchCount: 0,
      lastRewatchAt: null,
      addedAt: Date.now(),
    });
    setItems((prev) => dedupeByAnilistId([...prev, nextItem]));
    if (row?.media && typeof row.media === "object") {
      setMediaMap((prev) => {
        const next = new Map(prev);
        const previousMedia = next.get(id) || {};
        next.set(id, { ...previousMedia, ...row.media });
        return next;
      });
    }
    setSelectedId(id);
    setBackupMsg(copy.addedRelated);
  }

  function toggleQuickLogCharacter(characterId) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    setQuickLogCharacterIds((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const exists = arr.includes(id);
      if (exists) {
        setQuickLogCharacterMeta((metaPrev) => {
          const next = { ...metaPrev };
          delete next[id];
          return next;
        });
        const nextIds = arr.filter((x) => x !== id);
        setQuickLogPrimaryCharacterId((prevPrimary) => {
          const cur = Number(prevPrimary);
          if (Number.isFinite(cur) && cur !== id && nextIds.includes(cur)) return cur;
          return nextIds.length ? nextIds[0] : null;
        });
        return nextIds;
      }
      if (arr.length >= 3) return arr;
      setQuickLogCharacterMeta((metaPrev) => ({
        ...metaPrev,
        [id]: metaPrev?.[id] || { affinity: "기억남음", reasonTags: [], note: "" },
      }));
      const nextIds = [...arr, id];
      setQuickLogPrimaryCharacterId((prevPrimary) =>
        Number.isFinite(Number(prevPrimary)) ? Number(prevPrimary) : id
      );
      return nextIds;
    });
  }

  function setQuickLogPrimaryCharacter(characterId) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    if (!Array.isArray(quickLogCharacterIds) || !quickLogCharacterIds.includes(id)) return;
    setQuickLogPrimaryCharacterId(id);
  }

  function setQuickLogPrecision(nextPrecisionRaw) {
    const nextPrecision = normalizeQuickLogPrecision(nextPrecisionRaw);
    setQuickLogDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        watchedAtPrecision: nextPrecision,
        watchedAtValue: coerceQuickLogValue(nextPrecision, prev.watchedAtValue),
      };
    });
  }

  function setQuickLogCharacterAffinity(characterId, affinity) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    const value = AFFINITY_OPTIONS.includes(affinity) ? affinity : "기억남음";
    setQuickLogCharacterMeta((prev) => ({
      ...prev,
      [id]: {
        affinity: value,
        reasonTags: Array.isArray(prev?.[id]?.reasonTags) ? prev[id].reasonTags : [],
        note: String(prev?.[id]?.note || ""),
      },
    }));
  }

  function toggleQuickLogReasonTag(characterId, tag) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    const safeTag = String(tag || "").trim();
    if (!safeTag) return;
    setQuickLogCharacterMeta((prev) => {
      const cur = prev?.[id] || { affinity: "기억남음", reasonTags: [], note: "" };
      const curTags = Array.isArray(cur.reasonTags) ? cur.reasonTags : [];
      const exists = curTags.includes(safeTag);
      const nextTags = exists ? curTags.filter((x) => x !== safeTag) : [...curTags, safeTag];
      return {
        ...prev,
        [id]: {
          affinity: cur.affinity || "기억남음",
          reasonTags: nextTags.slice(0, 3),
          note: String(cur.note || ""),
        },
      };
    });
  }

  function setQuickLogCharacterNote(characterId, note) {
    const id = Number(characterId);
    if (!Number.isFinite(id)) return;
    setQuickLogCharacterMeta((prev) => {
      const cur = prev?.[id] || { affinity: "기억남음", reasonTags: [], note: "" };
      return {
        ...prev,
        [id]: {
          affinity: cur.affinity || "기억남음",
          reasonTags: Array.isArray(cur.reasonTags) ? cur.reasonTags.slice(0, 3) : [],
          note: String(note || "").slice(0, 200),
        },
      };
    });
  }

  async function deleteSelectedWatchLog(logId) {
    const key = String(logId || "").trim();
    if (!key) return;
    const ok = window.confirm(copy.deleteLogConfirm);
    if (!ok) return;

    try {
      const all = readAllWatchLogsSnapshot();
      const next = Array.isArray(all) ? all.filter((row) => String(row?.id || "") !== key) : [];
      await replaceWatchLogs(next);
      const rows = await listWatchLogsByAnimeId(selectedId).catch(() => []);
      setSelectedLogs(Array.isArray(rows) ? rows : []);
      if (quickLogDraft?.logId && String(quickLogDraft.logId) === key) closeQuickLogSheet();
      setBackupMsg(copy.deletedLog);
    } catch {
      setBackupMsg(copy.deleteLogFailed);
    }
  }

  async function saveQuickLogDraft() {
    if (!quickLogDraft?.logId || !Number.isFinite(Number(quickLogDraft?.anilistId))) {
      closeQuickLogSheet();
      return;
    }

    const watchedInput = buildQuickLogInputByPrecision(quickLogDraft);
    const watchedMeta = buildWatchedRange(
      watchedInput.value,
      watchedInput.precision,
      Date.now()
    );

    const selectedRefs = quickLogSelectedCharacters
      .slice(0, 3)
      .map((c, idx) => ({
        characterId: Number(c.id),
        mediaId: Number(quickLogDraft.anilistId),
        order: idx,
        nameSnapshot: c.name || `#${c.id}`,
        imageSnapshot: c.image || null,
        role: c.role || "",
        affinity: quickLogCharacterMeta?.[c.id]?.affinity || "기억남음",
        reasonTags: Array.isArray(quickLogCharacterMeta?.[c.id]?.reasonTags)
          ? quickLogCharacterMeta[c.id].reasonTags
          : [],
        note: String(quickLogCharacterMeta?.[c.id]?.note || ""),
        isPrimary:
          Number(c.id) === Number(quickLogPrimaryCharacterIdSafe) ||
          (!Number.isFinite(Number(quickLogPrimaryCharacterIdSafe)) && idx === 0),
      }));
    const saved = await updateWatchLog(quickLogDraft.logId, {
      watchedAtPrecision: watchedInput.precision,
      watchedAtValue: watchedInput.value,
      watchedAtStart: watchedMeta.watchedAtStart,
      watchedAtEnd: watchedMeta.watchedAtEnd,
      watchedAtSort: watchedMeta.watchedAtSort,
      cue: String(quickLogDraft.cue || "").slice(0, 120),
      note: String(quickLogDraft.note || ""),
      characterIds: selectedRefs.map((x) => x.characterId),
      characterRefs: selectedRefs,
    });

    const primaryRef = selectedRefs.find((x) => x.isPrimary);
    if (saved && primaryRef) {
      const pinId = buildCharacterPinId(primaryRef.characterId, quickLogDraft.anilistId);
      const alreadyPinned = pinnedCharacterKeySet.has(pinId);
      if (!alreadyPinned) {
        const reasonSeed =
          (Array.isArray(primaryRef.reasonTags) ? primaryRef.reasonTags[0] : "") ||
          String(primaryRef.note || "").trim() ||
          String(quickLogDraft.cue || "").trim();
        const shouldPin = window.confirm(
          locale === "en"
            ? `Pin "${primaryRef.nameSnapshot}" as a favorite character?`
            : `이 캐릭터("${primaryRef.nameSnapshot}")를 최애로 고정할까요?`
        );
        if (shouldPin) {
          await upsertCharacterPin({
            id: pinId,
            characterId: primaryRef.characterId,
            mediaId: Number(quickLogDraft.anilistId),
            nameSnapshot: primaryRef.nameSnapshot,
            imageSnapshot: primaryRef.imageSnapshot || null,
            note: String(primaryRef.note || ""),
            sourceLogId: saved.id,
            pinnedFromLogId: saved.id,
            pinReason: String(reasonSeed || ""),
            pinnedAt: Date.now(),
          }).catch(() => {});
          refreshCharacterPins();
        }
      }
    }

    if (selectedId && Number(selectedId) === Number(quickLogDraft.anilistId)) {
      const rows = await listWatchLogsByAnimeId(selectedId).catch(() => []);
      setSelectedLogs(Array.isArray(rows) ? rows : []);
    }
    closeQuickLogSheet();
  }

  function buildCharacterPinId(characterId, mediaId) {
    return `${Number(characterId)}:${Number(mediaId)}`;
  }

  async function toggleCharacterPin(character) {
    const cid = Number(character?.id);
    const mid = Number(selectedId);
    if (!Number.isFinite(cid) || !Number.isFinite(mid)) return;

    const pinId = buildCharacterPinId(cid, mid);
    const isPinned = pinnedCharacterKeySet.has(pinId);
    if (isPinned) {
      await removeCharacterPin(pinId).catch(() => {});
      refreshCharacterPins();
      return;
    }

    await upsertCharacterPin({
      id: pinId,
      characterId: cid,
      mediaId: mid,
      nameSnapshot: character?.name || `#${cid}`,
      imageSnapshot: character?.image || null,
      note: "",
      sourceLogId: null,
      pinnedFromLogId: null,
      pinReason: "",
      pinnedAt: Date.now(),
    }).catch(() => {});
    refreshCharacterPins();
  }

  function updateSelected(patch) {
    setItems((prev) =>
      prev.map((x) => {
        if (x.anilistId !== selectedId) return x;
        const next = { ...x, ...patch };
        if (Object.prototype.hasOwnProperty.call(patch, "score")) {
          next.score = normalizeScoreValue(patch.score);
        }
        if (Object.prototype.hasOwnProperty.call(patch, "rewatchCount")) {
          next.rewatchCount = normalizeRewatchCount(patch.rewatchCount);
        }
        if (Object.prototype.hasOwnProperty.call(patch, "lastRewatchAt")) {
          next.lastRewatchAt = normalizeRewatchDate(patch.lastRewatchAt);
        }
        return next;
      })
    );
  }

  function onCardKeyDown(e, id) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedId(id);
    }
  }

  function getHoverScoreFromPointer(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return normalizeScoreValue(ratio * SCORE_MAX);
  }

  async function onClickInstallPwa() {
    if (typeof window === "undefined") return;
    if (typeof window.__promptPwaInstall !== "function") {
      setBackupMsg(copy.installUnsupported);
      return;
    }

    try {
      const ok = await window.__promptPwaInstall();
      if (!ok) setBackupMsg(copy.installCancelled);
    } catch {
      setBackupMsg(copy.installFailed);
    }
  }

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return (
    <>
      <TopNavDataMenu
        base={base}
        panelId="data-menu-panel"
        canInstallPwa={canInstallPwa}
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || ((locale === "ko") ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onExportFile={exportBackup}
        onExportMobile={exportBackupMobile}
        onInstallPwa={onClickInstallPwa}
        onImportJsonFile={importBackupFile}
        onImportJsonText={importBackupText}
      />

      <section className="pageHeader">
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageLead">{copy.lead}</p>
        <div className="library-top-note">
          <span className="small">
            {backupReminder || copy.fallbackBackup}
          </span>
        </div>
        {backupMsg && <div className="small library-msg-line">{backupMsg}</div>}
      </section>

      <section className="library-panel">
        <CollapsiblePanelHeader
          title={copy.addPanel}
          summary={addTab === "search" ? copy.addPanelSummarySearch : copy.addPanelSummaryRecommend}
          open={addPanelOpen}
          onToggle={() => setAddPanelOpen((v) => !v)}
          controlsId="add-anime-panel-content"
          openLabel={copy.addPanelOpen}
          closedLabel={copy.addPanelClosed}
        />
        {addPanelOpen && (
          <>
            <div id="add-anime-panel-content" className="library-seg-wrap">
              <SegTabButton active={addTab === "search"} onClick={() => setAddTab("search")}>{copy.searchTab}</SegTabButton>
              <SegTabButton active={addTab === "recommend"} onClick={() => setAddTab("recommend")}>{copy.recommendTab}</SegTabButton>
            </div>
            {addTab === "search" ? (
              <AddAnime items={items} setItems={setItems} onAnimeAdded={onAddAnimeFromSearch} locale={locale} />
            ) : (
              <div className="library-recommend-placeholder">
                <div className="small">
                  {copy.recommendPlaceholder}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <LibraryStatsPanel
        locale={locale}
        dashboard={dashboard}
        open={statsOpen}
        onToggle={() => setStatsOpen((value) => !value)}
        onOpenAnime={setSelectedId}
        scoreMax={SCORE_MAX}
      />

      <LibraryFiltersPanel
        locale={locale}
        filteredCount={filtered.length}
        open={filterPanelOpen}
        onToggle={() => setFilterPanelOpen((value) => !value)}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        status={status}
        onStatusChange={setStatus}
        groupByStatus={groupByStatus}
        onGroupByStatusChange={setGroupByStatus}
        sortDir={sortDir}
        onToggleSortDir={() => setSortDir((direction) => (direction === "asc" ? "desc" : "asc"))}
        query={q}
        onQueryChange={setQ}
        cardView={cardView}
        onCardViewChange={setCardView}
        genreSet={genreSet}
        genreOptions={genreOptions}
        onClearGenres={clearGenres}
        onToggleGenre={toggleGenre}
        cardsPerRowBase={cardsPerRowBase}
        onCardsPerRowBaseChange={setCardsPerRowBase}
        effectiveCols={effectiveCols}
        formatGenreLabel={genreKo}
      />

      <div
        ref={gridRef}
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
        }}
      >
        {filtered.map((it) => {
          const m = mediaMap.get(it.anilistId);
          const cardTitle = getTitle(it);
          const cardStatus = it.status || "미분류";
          const cardStatusLabel = formatStatusLabel(cardStatus, locale);
          const cardScore = normalizeScoreValue(it.score);
          const cardStarsFill = `${((cardScore ?? 0) / SCORE_MAX) * 100}%`;
          const gs = safeGenres(m);

          return (
            <div
              key={it.anilistId}
              className="card"
              onClick={() => setSelectedId(it.anilistId)}
              onKeyDown={(e) => onCardKeyDown(e, it.anilistId)}
              role="button"
              tabIndex={0}
              aria-label={`${cardTitle} ${copy.openDetail}`}
            >
              <img
                src={m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || undefined}
                alt={cardTitle}
                loading="lazy"
              />

              {cardView === "meta" && (
                <div className="meta library-card-meta">
                  <div className="library-card-title">
                    {cardTitle}
                  </div>

                  <div className="library-card-meta-row">
                    <span style={getStatusBadgeStyle(cardStatus)}>{cardStatusLabel}</span>
                    <span
                      aria-label={cardScore == null ? copy.unrated : `${copy.starLabel} ${cardScore} / ${SCORE_MAX}`}
                      className="library-card-stars"
                    >
                      <span aria-hidden className="library-card-stars-base">★★★★★</span>
                      <span
                        aria-hidden
                        style={{
                          width: cardStarsFill,
                        }}
                        className="library-card-stars-fill"
                      >
                        ★★★★★
                      </span>
                    </span>
                  </div>

                  <GenresRow
                    genres={gs}
                    max={3}
                    compact={true}
                    formatGenreLabel={genreKo}
                    onPickGenre={onPickGenreFromTag}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <LibraryDetailModal
        locale={locale}
        open={Boolean(selected)}
        selectedId={selectedId}
        selected={selected}
        selectedMedia={selectedMedia}
        selectedTitle={selectedTitle}
        selectedRelatedSeries={selectedRelatedSeries}
        libraryIdSet={libraryIdSet}
        items={items}
        mediaMap={mediaMap}
        itemKoTitleMap={itemKoTitleMap}
        relatedKoTitleById={relatedKoTitleById}
        aliasKoTitleMap={ALIAS_KO_TITLE_MAP}
        selectedScore={selectedScore}
        selectedScoreLabel={selectedScoreLabel}
        selectedStarsFill={selectedStarsFill}
        selectedLogs={selectedLogs}
        logsLoading={logsLoading}
        selectedCharacters={selectedCharacters}
        memoDraft={memoDraft}
        rewatchCountDraft={rewatchCountDraft}
        lastRewatchAtDraft={lastRewatchAtDraft}
        pinnedCharacterKeySet={pinnedCharacterKeySet}
        onClose={closeSelectedModal}
        onRemoveAnime={removeAnime}
        onOpenAnime={setSelectedId}
        onAddRelatedSeries={addRelatedSeriesToLibrary}
        onStatusChange={onSelectedStatusChange}
        onUpdateSelected={updateSelected}
        onHoverScoreChange={setHoverScore}
        getHoverScoreFromPointer={getHoverScoreFromPointer}
        setMemoDraft={setMemoDraft}
        setRewatchCountDraft={setRewatchCountDraft}
        setLastRewatchAtDraft={setLastRewatchAtDraft}
        onCommitModalDraft={commitModalDraft}
        onAppendSelectedWatchLog={appendSelectedWatchLog}
        onOpenQuickLogSheet={openQuickLogSheet}
        onDeleteSelectedWatchLog={deleteSelectedWatchLog}
        onToggleCharacterPin={toggleCharacterPin}
        safeGenres={safeGenres}
        formatGenreLabel={genreKo}
        isAnimeMediaFormat={isAnimeMediaFormat}
        pickCardTitle={pickCardTitle}
        formatLocalDate={formatLocalDate}
        formatWatchLogDate={(log) => formatWatchLogDate(log, locale)}
        normalizeRewatchCount={normalizeRewatchCount}
        onPickGenreFromTag={onPickGenreFromTag}
        scoreMax={SCORE_MAX}
        scoreStep={SCORE_STEP}
        eventRewatch={LIBRARY_EVENT.rewatch}
        statusCompleted={LIBRARY_STATUS.completed}
      />

      <LibraryQuickLogSheet
        locale={locale}
        open={quickLogOpen}
        draft={quickLogDraft}
        title={quickLogTitle}
        context={quickLogContext}
        candidates={quickLogCandidates}
        characterIds={quickLogCharacterIds}
        primaryCharacterId={quickLogPrimaryCharacterIdSafe}
        selectedCharacters={quickLogSelectedCharacters}
        characterMeta={quickLogCharacterMeta}
        onClose={closeQuickLogSheet}
        onSave={saveQuickLogDraft}
        onDraftChange={setQuickLogDraft}
        onPrecisionChange={setQuickLogPrecision}
        onToggleCharacter={toggleQuickLogCharacter}
        onSetPrimaryCharacter={setQuickLogPrimaryCharacter}
        onSetAffinity={setQuickLogCharacterAffinity}
        onToggleReasonTag={toggleQuickLogReasonTag}
        onSetCharacterNote={setQuickLogCharacterNote}
        helpers={{
          coerceQuickLogValue,
          parseSeasonValue,
          defaultQuickLogValue,
          affinityLabel,
          reasonTagLabel,
        }}
        constants={{
          seasonTermOptions: SEASON_TERM_OPTIONS,
          affinityOptions: AFFINITY_OPTIONS,
          reasonTagOptions: REASON_TAG_OPTIONS,
        }}
      />
    </>
  );
}

