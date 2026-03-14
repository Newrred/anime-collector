import { useEffect, useMemo, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import {
  DEFAULT_TIERS,
  dedupeByAnilistId,
  makeEmptyTierState,
  mergeTierState,
  normalizeImportList,
  normalizeItem,
  normalizeTierState,
  sameItem,
} from "../domain/animeState";
import { useStoredState } from "../hooks/useStoredState";
import { STORAGE_KEYS } from "../storage/keys";
import { markManualBackupExported } from "../repositories/backupRepo";
import { readLibraryListPreferred, writeLibraryList } from "../repositories/libraryRepo";
import { readTierStatePreferred, writeTierState } from "../repositories/tierRepo";
import { mergeWatchLogs, readAllWatchLogsSnapshot, replaceWatchLogs } from "../repositories/watchLogRepo";
import { listCharacterPinsPreferred, mergeCharacterPins, readCharacterPinsSnapshot, replaceCharacterPins } from "../repositories/characterPinRepo";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { formatSeasonTermLabel, formatReasonTagLabel } from "./library/libraryCopy.js";
import { pickByLocale } from "../domain/uiText";
import { pickDisplayTitle } from "../domain/animeTitles";

const SEASON_OPTIONS = ["Spring", "Summer", "Fall", "Winter"];

function extractYearFromLog(log) {
  const start = String(log?.watchedAtStart || "");
  const mStart = start.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (mStart) return Number(mStart[1]);

  const value = String(log?.watchedAtValue || "");
  const mValue = value.match(/^(\d{4})/);
  if (mValue) return Number(mValue[1]);

  return null;
}

function seasonByMonth(month) {
  const m = Number(month);
  if (m >= 3 && m <= 5) return "Spring";
  if (m >= 6 && m <= 8) return "Summer";
  if (m >= 9 && m <= 11) return "Fall";
  return "Winter";
}

function extractSeasonFromLog(log) {
  const value = String(log?.watchedAtValue || "");
  const direct = value.match(/^\d{4}-(Spring|Summer|Fall|Winter)$/i);
  if (direct) {
    return `${direct[1][0].toUpperCase()}${direct[1].slice(1).toLowerCase()}`;
  }

  const start = String(log?.watchedAtStart || "");
  const m = start.match(/^\d{4}-(\d{2})-\d{2}$/);
  if (m) return seasonByMonth(Number(m[1]));
  return null;
}

export default function TierBoard() {
  const { locale, setLocale } = useUiPreferences();
  const copy = pickByLocale(locale, {
    ko: {
      installReady: "앱이 설치되었습니다. 홈 화면에서 바로 열 수 있어요.",
      installUnsupported: "현재 브라우저에서는 설치 프롬프트를 아직 사용할 수 없습니다.",
      installCancelled: "설치를 취소했어요. 필요할 때 다시 시도할 수 있습니다.",
      installFailed: "설치 요청 중 오류가 발생했습니다.",
      backupDownloaded: "백업 파일을 다운로드했어요.",
      shareFileTitle: "애니 보관함 백업",
      sharedFile: "백업 JSON 파일을 공유했어요.",
      shareCancelled: "공유를 취소했어요.",
      shareTextTitle: "애니 보관함 백업(JSON)",
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
      title: "티어 보드",
      lead: "감상 기록을 기준으로 다시 정리해 보는 티어 보드입니다.",
      reset: "초기화",
      filterTitle: "감상 기록 필터",
      visible: "표시",
      total: "전체",
      filterWarning: "필터를 쓰는 동안에는 보기만 할 수 있어요. 드래그 편집은 `전체`에서 해주세요.",
      unranked: "미분류",
      all: "전체",
      year: "올해/연도",
      season: "시즌",
      rewatch: "재시청 기록",
      primary: "대표캐 있는 작품",
      favorite: "최애캐가 있는 작품",
      pinned: "고정한 캐릭터가 있는 작품",
      reasonTag: "포인트 태그",
      character: "캐릭터 선택",
      logYearFilter: "로그 연도 필터",
      logSeasonFilter: "로그 시즌 필터",
      reasonTagFilter: "포인트 태그 필터",
      reasonTagSelect: "포인트 태그 선택",
      characterFilter: "캐릭터 선택 필터",
      characterSelect: "캐릭터 선택",
    },
    en: {
      installReady: "App installed. You can launch it from your home screen.",
      installUnsupported: "This browser does not support the install prompt yet.",
      installCancelled: "Install cancelled. You can try again later.",
      installFailed: "Failed while requesting install.",
      backupDownloaded: "Downloaded backup file.",
      shareFileTitle: "Anime Library Backup",
      sharedFile: "Shared backup JSON file.",
      shareCancelled: "Share cancelled.",
      shareTextTitle: "Anime Library Backup (JSON)",
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
      title: "Tier Board",
      lead: "Reorganize your rankings based on watch history.",
      reset: "Reset",
      filterTitle: "Log filter",
      visible: "Showing",
      total: "Total",
      filterWarning: "While a filter is active, the board is view-only. Use `All` to drag and edit.",
      unranked: "Unranked",
      all: "All",
      year: "This year / year",
      season: "Season",
      rewatch: "Rewatch logs",
      primary: "Has primary character",
      favorite: "Has favorite character",
      pinned: "Has pinned character",
      reasonTag: "Reason tag",
      character: "Character",
      logYearFilter: "Log year filter",
      logSeasonFilter: "Log season filter",
      reasonTagFilter: "Reason tag filter",
      reasonTagSelect: "Choose reason tag",
      characterFilter: "Character filter",
      characterSelect: "Choose character",
    },
  });
  // ✅ 라이브러리(localStorage) 읽어서 ids를 만든다 (새로 추가된 애니 자동 반영)
  const [library, setLibrary] = useStoredState(STORAGE_KEYS.list, myListSeed);

  useEffect(() => {
    setLibrary((prev) => {
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
  }, [setLibrary]);

  const ids = useMemo(() => library.map((x) => x.anilistId), [library]);

  // ✅ id -> koTitle 맵 (라이브러리에 저장된 한글 제목 우선)
  const koById = useMemo(() => {
    const m = new Map();
    for (const it of library) {
      if (it?.anilistId == null) continue;
      if (it?.koTitle) m.set(it.anilistId, it.koTitle);
    }
    return m;
  }, [library]);

  function titleFor(id, media) {
    return pickDisplayTitle({ anilistId: id, koTitle: koById.get(id) || null }, media, locale) || (id ? `#${id}` : "Loading...");
  }

  const [mediaMap, setMediaMap] = useState(new Map());

  // ✅ tierState는 localStorage에 저장
  const [tierState, setTierState] = useStoredState(
    STORAGE_KEYS.tier,
    makeEmptyTierState(ids)
  );
  const [backupMsg, setBackupMsg] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [watchLogsSnapshot, setWatchLogsSnapshot] = useState([]);
  const [logFilter, setLogFilter] = useState("all"); // all | year | season | rewatch | primary | favorite | pinned | reasonTag | character
  const [logYear, setLogYear] = useState(String(new Date().getUTCFullYear()));
  const [logSeason, setLogSeason] = useState("Spring");
  const [characterPinsSnapshot, setCharacterPinsSnapshot] = useState([]);
  const [reasonTagFilter, setReasonTagFilter] = useState("");
  const [characterFilterId, setCharacterFilterId] = useState("");

  function refreshWatchLogsSnapshot() {
    const rows = readAllWatchLogsSnapshot();
    setWatchLogsSnapshot(Array.isArray(rows) ? rows : []);
  }

  function refreshCharacterPinsSnapshot() {
    const rows = readCharacterPinsSnapshot();
    setCharacterPinsSnapshot(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    refreshWatchLogsSnapshot();
    refreshCharacterPinsSnapshot();
    listCharacterPinsPreferred()
      .then((rows) => {
        setCharacterPinsSnapshot(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureLegacyStorageMigrated().catch(() => {});
      const [preferredLibrary, preferredTier] = await Promise.all([
        readLibraryListPreferred(myListSeed).catch(() => null),
        readTierStatePreferred(null).catch(() => null),
      ]);
      if (!alive) return;

      if (Array.isArray(preferredLibrary)) {
        setLibrary((prev) => {
          const source = Array.isArray(prev) ? prev : [];
          const next = dedupeByAnilistId(
            preferredLibrary.map((it, idx) =>
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
      }

      if (preferredTier && typeof preferredTier === "object") {
        setTierState((prev) => {
          const next = normalizeTierState(preferredTier);
          const same =
            JSON.stringify(prev?.unranked || []) === JSON.stringify(next?.unranked || []) &&
            JSON.stringify(prev?.tiers || {}) === JSON.stringify(next?.tiers || {});
          return same ? prev : next;
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [setLibrary, setTierState]);

  useEffect(() => {
    writeLibraryList(library, { mirrorOnly: true });
  }, [library]);

  useEffect(() => {
    writeTierState(tierState, { mirrorOnly: true });
  }, [tierState]);

  // AniList 메타 로드(캐시 우선)
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

  // ✅ 라이브러리 ↔ 티어 자동 동기화
  const idsKey = useMemo(() => ids.join(","), [ids]);
  useEffect(() => {
    setTierState((prev) => {
      const next = structuredClone(prev);

      const allNow = new Set();
      for (const id of next.unranked || []) allNow.add(id);
      for (const k of Object.keys(next.tiers || {})) {
        for (const id of next.tiers[k] || []) allNow.add(id);
      }

      const desired = new Set(ids);

      const missing = ids.filter((id) => !allNow.has(id));
      const removed = [...allNow].filter((id) => !desired.has(id));

      if (missing.length === 0 && removed.length === 0) return prev;

      if (removed.length) {
        next.unranked = (next.unranked || []).filter((id) => !removed.includes(id));
        for (const k of Object.keys(next.tiers || {})) {
          next.tiers[k] = (next.tiers[k] || []).filter((id) => !removed.includes(id));
        }
      }

      if (missing.length) {
        next.unranked = [...missing, ...(next.unranked || [])];
        // 중복 제거
        const seen = new Set();
        next.unranked = next.unranked.filter((id) =>
          seen.has(id) ? false : (seen.add(id), true)
        );
      }

      return next;
    });
  }, [idsKey, setTierState]);

  useEffect(() => {
    function syncInstallState() {
      setCanInstallPwa(typeof window !== "undefined" && typeof window.__promptPwaInstall === "function");
    }
    function onInstallReady() {
      setCanInstallPwa(true);
    }
    function onInstalled() {
      setCanInstallPwa(false);
      setBackupMsg(copy.installReady);
    }

    syncInstallState();
    window.addEventListener("pwa-install-ready", onInstallReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-install-ready", onInstallReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [copy.installReady]);

  // ---- Drag & Drop (순서 재정렬 지원) ----
  function allowDrop(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDragStart(e, id, from, fromIndex) {
    // Drag&Drop 데이터는 문자열로 넣고(getData로 꺼냄)
    e.dataTransfer.setData("text/plain", JSON.stringify({ id, from, fromIndex }));
    e.dataTransfer.effectAllowed = "move";
  }

  function parsePayload(e) {
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function getListRef(state, listName) {
    return listName === "unranked" ? state.unranked : state.tiers[listName];
  }

  function removeEverywhere(state, id) {
    state.unranked = (state.unranked || []).filter((x) => x !== id);
    for (const k of Object.keys(state.tiers || {})) {
      state.tiers[k] = (state.tiers[k] || []).filter((x) => x !== id);
    }
  }

  function insertAt(arr, index, value) {
    const i = Math.max(0, Math.min(index, arr.length));
    arr.splice(i, 0, value);
  }

  function moveItem(prev, { id, from, fromIndex }, to, toIndex) {
    const next = structuredClone(prev);
    const sameList = from === to;

    removeEverywhere(next, id);

    const target = getListRef(next, to) || [];
    if (to !== "unranked") next.tiers[to] = target;
    else next.unranked = target;

    let idx = typeof toIndex === "number" ? toIndex : target.length;
    if (sameList && typeof fromIndex === "number" && fromIndex < idx) idx = idx - 1;

    insertAt(target, idx, id);
    return next;
  }

  function onDropToEnd(e, to) {
    if (logFilter !== "all") return;
    e.preventDefault();
    const payload = parsePayload(e);
    if (!payload) return;

    setTierState((prev) => {
      const arr = getListRef(prev, to) || [];
      return moveItem(prev, payload, to, arr.length);
    });
  }

  function onDropToItem(e, to, toIndex) {
    if (logFilter !== "all") return;
    e.preventDefault();
    e.stopPropagation();
    const payload = parsePayload(e);
    if (!payload) return;

    setTierState((prev) => moveItem(prev, payload, to, toIndex));
  }

  function reset() {
    setTierState(makeEmptyTierState(ids));
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

  function buildBackupPayload() {
    return {
      app: "ani-site",
      version: 3,
      exportedAt: new Date().toISOString(),
      list: normalizeImportList(library),
      tier: tierState,
      watchLogs: readAllWatchLogsSnapshot(),
      characterPins: readCharacterPinsSnapshot(),
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
          title: copy.shareFileTitle,
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
          title: copy.shareTextTitle,
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
      setLibrary(incomingNormalized);
    } else {
      setLibrary((prev) => dedupeByAnilistId([...prev, ...incomingNormalized]));
    }

    const incomingTier = !Array.isArray(json) ? json?.tier : null;
    if (incomingTier) {
      const nextTier = isOverwrite
        ? normalizeTierState(incomingTier)
        : mergeTierState(tierState, incomingTier);
      setTierState(nextTier);
    }

    const incomingLogs = !Array.isArray(json) ? json?.watchLogs : null;
    if (Array.isArray(incomingLogs)) {
      if (isOverwrite) {
        await replaceWatchLogs(incomingLogs);
      } else {
        await mergeWatchLogs(incomingLogs);
      }
      refreshWatchLogsSnapshot();
    } else if (isOverwrite) {
      await replaceWatchLogs([]);
      refreshWatchLogsSnapshot();
    }

    const incomingPins = !Array.isArray(json) ? json?.characterPins : null;
    if (Array.isArray(incomingPins)) {
      if (isOverwrite) {
        await replaceCharacterPins(incomingPins);
      } else {
        await mergeCharacterPins(incomingPins);
      }
      refreshCharacterPinsSnapshot();
    } else if (isOverwrite) {
      await replaceCharacterPins([]);
      refreshCharacterPinsSnapshot();
    }

    setBackupMsg(
      isOverwrite
        ? copy.importDoneOverwrite
        : copy.importDoneMerge
    );
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

  // ---- Render ----
  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  const canEditTierBoard = logFilter === "all";
  const eligibleIdSet = useMemo(() => {
    if (logFilter === "all") return null;
    const logs = Array.isArray(watchLogsSnapshot) ? watchLogsSnapshot : [];
    const out = new Set();

    for (const log of logs) {
      const id = Number(log?.anilistId);
      if (!Number.isFinite(id)) continue;

      if (logFilter === "year") {
        const y = extractYearFromLog(log);
        if (Number.isFinite(y) && String(y) === String(logYear)) out.add(id);
        continue;
      }

      if (logFilter === "season") {
        const y = extractYearFromLog(log);
        const season = extractSeasonFromLog(log);
        if (
          Number.isFinite(y) &&
          String(y) === String(logYear) &&
          season === logSeason
        ) {
          out.add(id);
        }
        continue;
      }

      if (logFilter === "rewatch") {
        if (String(log?.eventType || "") === "재시청") out.add(id);
        continue;
      }

      if (logFilter === "primary") {
        const refs = Array.isArray(log?.characterRefs) ? log.characterRefs : [];
        const hasPrimary = refs.some((ref) => ref?.isPrimary === true);
        if (hasPrimary || refs.length === 1) out.add(id);
        continue;
      }

      if (logFilter === "favorite") {
        const refs = Array.isArray(log?.characterRefs) ? log.characterRefs : [];
        const hasFavorite = refs.some((ref) => String(ref?.affinity || "") === "최애");
        if (hasFavorite) out.add(id);
        continue;
      }

      if (logFilter === "reasonTag") {
        const selectedTag = String(reasonTagFilter || "").trim();
        if (!selectedTag) continue;
        const refs = Array.isArray(log?.characterRefs) ? log.characterRefs : [];
        const hasTag = refs.some((ref) =>
          Array.isArray(ref?.reasonTags) && ref.reasonTags.includes(selectedTag)
        );
        if (hasTag) out.add(id);
        continue;
      }

      if (logFilter === "character") {
        const selectedId = Number(characterFilterId);
        if (!Number.isFinite(selectedId)) continue;
        const refs = Array.isArray(log?.characterRefs) ? log.characterRefs : [];
        const hasCharacter = refs.some((ref) => Number(ref?.characterId) === selectedId);
        if (hasCharacter) out.add(id);
      }
    }

    if (logFilter === "pinned") {
      for (const pin of Array.isArray(characterPinsSnapshot) ? characterPinsSnapshot : []) {
        const mediaId = Number(pin?.mediaId);
        if (Number.isFinite(mediaId)) out.add(mediaId);
      }
    }
    return out;
  }, [characterFilterId, characterPinsSnapshot, logFilter, logSeason, logYear, reasonTagFilter, watchLogsSnapshot]);

  const reasonTagOptions = useMemo(() => {
    const map = new Map();
    for (const log of Array.isArray(watchLogsSnapshot) ? watchLogsSnapshot : []) {
      const refs = Array.isArray(log?.characterRefs) ? log.characterRefs : [];
      for (const ref of refs) {
        const tags = Array.isArray(ref?.reasonTags) ? ref.reasonTags : [];
        for (const tagRaw of tags) {
          const tag = String(tagRaw || "").trim();
          if (!tag) continue;
          map.set(tag, (map.get(tag) || 0) + 1);
        }
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
      .map(([tag, count]) => ({ tag, count }));
  }, [watchLogsSnapshot]);

  const characterFilterOptions = useMemo(() => {
    const map = new Map();
    for (const log of Array.isArray(watchLogsSnapshot) ? watchLogsSnapshot : []) {
      const refs = Array.isArray(log?.characterRefs) ? log.characterRefs : [];
      for (const ref of refs) {
        const id = Number(ref?.characterId);
        if (!Number.isFinite(id)) continue;
        const cur = map.get(id) || {
          id,
          name: String(ref?.nameSnapshot || `#${id}`).trim() || `#${id}`,
          count: 0,
        };
        cur.count += 1;
        if (!cur.name && ref?.nameSnapshot) cur.name = String(ref.nameSnapshot).trim();
        map.set(id, cur);
      }
    }
    return [...map.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ko"))
      .slice(0, 100);
  }, [watchLogsSnapshot]);

  function filterIdsByLog(idsList) {
    if (!eligibleIdSet) return Array.isArray(idsList) ? idsList : [];
    return (Array.isArray(idsList) ? idsList : []).filter((id) => eligibleIdSet.has(id));
  }

  const totalPlacedCount =
    (Array.isArray(tierState?.unranked) ? tierState.unranked.length : 0) +
    DEFAULT_TIERS.reduce((acc, t) => acc + (Array.isArray(tierState?.tiers?.[t]) ? tierState.tiers[t].length : 0), 0);
  const visiblePlacedCount =
    filterIdsByLog(tierState?.unranked).length +
    DEFAULT_TIERS.reduce((acc, t) => acc + filterIdsByLog(tierState?.tiers?.[t]).length, 0);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <TopNavDataMenu
        base={base}
        panelId="tier-data-menu-panel"
        canInstallPwa={canInstallPwa}
        locale={locale}
        onToggleLocale={() => setLocale((current) => (current === "ko" ? "en" : "ko"))}
        onExportFile={exportBackup}
        onExportMobile={exportBackupMobile}
        onInstallPwa={onClickInstallPwa}
        onImportJsonFile={importBackupFile}
        onImportJsonText={importBackupText}
      />
      {backupMsg && <div className="small" style={{ opacity: 0.9 }}>{backupMsg}</div>}

      <section className="pageHeader" style={{ marginBottom: 4 }}>
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageLead">{copy.lead}</p>
      </section>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={reset}>{copy.reset}</button>
        <span className="small">Drag & Drop</span>
      </div>

      <section
        style={{
          border: "1px solid rgba(255,255,255,.1)",
          background: "rgba(255,255,255,.03)",
          borderRadius: 5,
          padding: 10,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>{copy.filterTitle}</div>
          <div className="small" style={{ opacity: 0.86 }}>
            {copy.visible} {visiblePlacedCount} / {copy.total} {totalPlacedCount}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { key: "all", label: copy.all },
            { key: "year", label: copy.year },
            { key: "season", label: copy.season },
            { key: "rewatch", label: copy.rewatch },
            { key: "primary", label: copy.primary },
            { key: "favorite", label: copy.favorite },
            { key: "pinned", label: copy.pinned },
            { key: "reasonTag", label: copy.reasonTag },
            { key: "character", label: copy.character },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              className="btn"
              onClick={() => setLogFilter(opt.key)}
              style={{
                border: "1px solid rgba(255,255,255,.2)",
                background: logFilter === opt.key ? "rgba(255,255,255,.82)" : "transparent",
                color: logFilter === opt.key ? "#0b0c10" : "inherit",
                fontWeight: logFilter === opt.key ? 700 : 500,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {(logFilter === "year" || logFilter === "season") && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              type="number"
              min={1950}
              max={2099}
              value={logYear}
              onChange={(e) => setLogYear(String(e.target.value || "").replace(/[^\d]/g, "").slice(0, 4))}
              aria-label={copy.logYearFilter}
              style={{ width: 100 }}
            />
            {logFilter === "season" && (
              <select
                className="select"
                value={logSeason}
                onChange={(e) => setLogSeason(SEASON_OPTIONS.includes(e.target.value) ? e.target.value : "Spring")}
                aria-label={copy.logSeasonFilter}
                style={{ width: 140 }}
              >
                {SEASON_OPTIONS.map((term) => (
                  <option key={term} value={term}>
                    {formatSeasonTermLabel(term, locale)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {logFilter === "reasonTag" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="select"
              value={reasonTagFilter}
              onChange={(e) => setReasonTagFilter(String(e.target.value || ""))}
              aria-label={copy.reasonTagFilter}
              style={{ width: 200 }}
            >
              <option value="">{copy.reasonTagSelect}</option>
              {reasonTagOptions.map((row) => (
                <option key={row.tag} value={row.tag}>
                  {formatReasonTagLabel(row.tag, locale)} ({row.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {logFilter === "character" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              className="select"
              value={characterFilterId}
              onChange={(e) => setCharacterFilterId(String(e.target.value || ""))}
              aria-label={copy.characterFilter}
              style={{ width: 260 }}
            >
              <option value="">{copy.characterSelect}</option>
              {characterFilterOptions.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {row.name} ({row.count})
                </option>
              ))}
            </select>
          </div>
        )}

        {!canEditTierBoard && (
          <div className="small" style={{ opacity: 0.85 }}>
            {copy.filterWarning}
          </div>
        )}
      </section>

      {DEFAULT_TIERS.map((t) => (
        <div
          key={t}
          onDragOver={allowDrop}
          onDrop={(e) => onDropToEnd(e, t)}
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr",
            gap: 12,
            alignItems: "start",
            border: "1px rgba(255,255,255,.12)",
            borderStyle: "solid none",
            borderRadius: 0,
            padding: 12,
            background: "rgba(255,255,255,.03)",
            minHeight: 110,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 48 }}>{t}</div>

          <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
            {filterIdsByLog(tierState.tiers?.[t] || []).map((id, idx) => {
              const m = mediaMap.get(id);
              const title = titleFor(id, m);
              return (
                <div
                  key={id}
                  draggable={canEditTierBoard}
                  onDragStart={(e) => {
                    if (!canEditTierBoard) return;
                    onDragStart(e, id, t, idx);
                  }}
                  onDragOver={allowDrop}
                  onDrop={(e) => onDropToItem(e, t, idx)}
                  title={title}
                  style={{
                    width: 78,
                    borderRadius: 0,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(255,255,255,.04)",
                    cursor: canEditTierBoard ? "grab" : "default",
                  }}
                >
                  <img
                    src={m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || undefined}
                    alt={title}
                    style={{
                      width: "100%",
                      aspectRatio: "2/3",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                </div>
              );
            })}

            {filterIdsByLog(tierState.tiers?.[t] || []).length === 0 && (
              <div className="small" style={{ opacity: 0.7, padding: "6px 0" }} />
            )}
          </div>
        </div>
      ))}

      {/* Unranked */}
      <div
        onDragOver={allowDrop}
        onDrop={(e) => onDropToEnd(e, "unranked")}
        style={{
          border: "1px dashed rgba(255,255,255,.18)",
          borderRadius: 0,
          padding: 12,
          background: "rgba(255,255,255,.02)",
          minHeight: 140,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>{copy.unranked}</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {filterIdsByLog(tierState.unranked || []).map((id, idx) => {
            const m = mediaMap.get(id);
            const title = titleFor(id, m);
            return (
              <div
                key={id}
                draggable={canEditTierBoard}
                onDragStart={(e) => {
                  if (!canEditTierBoard) return;
                  onDragStart(e, id, "unranked", idx);
                }}
                onDragOver={allowDrop}
                onDrop={(e) => onDropToItem(e, "unranked", idx)}
                title={title}
                style={{
                  width: 78,
                  borderRadius: 0,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,.10)",
                  background: "rgba(255,255,255,.04)",
                  cursor: canEditTierBoard ? "grab" : "default",
                }}
              >
                <img
                  src={m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || undefined}
                  alt={title}
                  style={{
                    width: "100%",
                    aspectRatio: "2/3",
                    objectFit: "cover",
                    display: "block",
                  }}
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
