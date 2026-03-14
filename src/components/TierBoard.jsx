import { useEffect, useMemo, useState } from "react";
import myListSeed from "../data/myAnime.json";
import { fetchAnimeByIdsCached, getCachedAnimeMap } from "../lib/anilist";
import {
  DEFAULT_TIERS,
  dedupeByAnilistId,
  makeEmptyTierState,
  normalizeImportList,
  normalizeItem,
  sameItem,
} from "../domain/animeState";
import {
  createCustomTierTopic,
  createGenreTierTopic,
  DEFAULT_TIER_TOPIC_ID,
  getActiveTierTopic,
  mergeTierTopicBundles,
  normalizeTierTopicBundle,
  removeTierTopic,
  replaceActiveTierState,
  setActiveTierTopicId,
  syncTierStateWithEligibleIds,
  upsertTierTopic,
} from "../domain/tierTopics";
import { useStoredState } from "../hooks/useStoredState";
import { STORAGE_KEYS } from "../storage/keys";
import { markManualBackupExported } from "../repositories/backupRepo";
import { readLibraryListPreferred, writeLibraryList } from "../repositories/libraryRepo";
import { readTierBoardBundlePreferred, writeTierBoardBundle } from "../repositories/tierRepo";
import { mergeWatchLogs, readAllWatchLogsSnapshot, replaceWatchLogs } from "../repositories/watchLogRepo";
import { listCharacterPinsPreferred, mergeCharacterPins, readCharacterPinsSnapshot, replaceCharacterPins } from "../repositories/characterPinRepo";
import { ensureLegacyStorageMigrated } from "../storage/legacyMigration";
import TopNavDataMenu from "./TopNavDataMenu.jsx";
import { useUiPreferences } from "../hooks/useUiPreferences";
import { formatGenreLabel } from "./library/libraryCopy.js";
import { pickByLocale } from "../domain/uiText";
import { pickDisplayTitle } from "../domain/animeTitles";

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase().normalize("NFKC");
}

function safeGenres(media) {
  return Array.isArray(media?.genres) ? media.genres.filter(Boolean) : [];
}

function matchesTopicSearch(item, media, query, locale) {
  const q = normalizeSearchText(query);
  if (!q) return true;

  const hay = [
    pickDisplayTitle(item, media, locale),
    item?.koTitle,
    media?.title?.english,
    media?.title?.romaji,
    media?.title?.native,
    ...(Array.isArray(media?.synonyms) ? media.synonyms : []),
    ...safeGenres(media),
    ...safeGenres(media).map((genre) => formatGenreLabel(genre, locale)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function TopicMetric({ label, value }) {
  return (
    <div className="tier-topic-metric">
      <span className="tier-topic-metric__label">{label}</span>
      <strong className="tier-topic-metric__value">{value}</strong>
    </div>
  );
}

function TopicChip({ label, meta, isActive, onClick, badge }) {
  return (
    <button
      type="button"
      className={`tier-topic-chip${isActive ? " is-active" : ""}`}
      onClick={onClick}
    >
      <span className="tier-topic-chip__text">
        <span className="tier-topic-chip__label">{label}</span>
        <span className="tier-topic-chip__meta">{meta}</span>
      </span>
      {badge ? <span className="tier-topic-chip__badge">{badge}</span> : null}
    </button>
  );
}

function TierPoster({ id, index, listName, title, image, onDragStart, onDragOver, onDrop }) {
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, id, listName, index)}
      onDragOver={onDragOver}
      onDrop={(event) => onDrop(event, listName, index)}
      title={title}
      className="tier-poster"
    >
      {image ? (
        <img
          src={image}
          alt={title}
          className="tier-poster__image"
          loading="lazy"
        />
      ) : (
        <div className="tier-poster__fallback">{title}</div>
      )}
    </div>
  );
}

export default function TierBoard() {
  const { theme, locale, setTheme, setLocale } = useUiPreferences();
  const copy = pickByLocale(locale, {
    ko: {
      title: "티어 보드",
      lead: "장르별 랭킹과 커스텀 주제를 저장해 두고 드래그로 정리하는 보드입니다.",
      currentBoard: "현재 보드",
      currentBoardLead: "지금 선택된 주제를 기준으로 포스터를 드래그해 순위를 매깁니다.",
      reset: "현재 주제 초기화",
      deleteTopic: "현재 주제 삭제",
      dragDrop: "Drag & Drop",
      topicLibrary: "저장된 주제",
      topicLibraryLead: "주제를 바꿔가며 서로 다른 랭킹을 저장할 수 있습니다.",
      createTopic: "새 주제 만들기",
      createTopicLead: "장르 보드를 빠르게 만들거나, 원하는 작품만 골라 커스텀 보드를 저장할 수 있습니다.",
      allAnime: "전체 작품",
      genreTopic: "장르 주제",
      customTopic: "커스텀 주제",
      topicType: "주제 종류",
      topicTypeAll: "전체 작품 보드",
      topicTypeGenre: "장르 보드",
      topicTypeCustom: "커스텀 보드",
      activeTopicBadge: "사용 중",
      createGenreTopic: "장르 주제 저장",
      createCustomTopic: "커스텀 주제 저장",
      updateCustomTopic: "현재 커스텀 주제 저장",
      genreSelect: "장르 선택",
      genreTopicLead: "하나의 장르를 골라 별도 랭킹 보드로 저장합니다.",
      customName: "주제 이름",
      customNamePlaceholder: "예: 눈물나는 작품, 올타임 액션 탑",
      customSearch: "작품 찾기",
      customSearchPlaceholder: "제목이나 장르로 작품 찾기",
      customTopicLead: "직접 작품을 골라 나만의 랭킹 주제를 만듭니다.",
      selectedAnime: "선택된 작품",
      selectedCount: "선택",
      candidateAnime: "후보 작품",
      selectedAnimeLead: "보드에 포함할 작품입니다. 다시 누르면 빠집니다.",
      candidateAnimeLead: "검색 결과에서 작품을 눌러 보드에 추가합니다.",
      topicCount: "대상 작품",
      total: "전체",
      tiers: "티어",
      unranked: "미분류",
      rankingBoard: "랭킹 보드",
      rankingLead: "포스터를 끌어서 각 티어로 옮기거나 순서를 바꿉니다.",
      unrankedLead: "아직 순위를 정하지 않은 작품입니다. 여기서 시작해 위 티어로 옮기면 됩니다.",
      emptyTier: "여기에 작품을 드래그해 넣으세요.",
      noGenre: "장르 정보가 아직 없습니다.",
      noCandidates: "조건에 맞는 작품이 없습니다.",
      noSelected: "아직 선택한 작품이 없습니다.",
      needGenre: "장르를 먼저 골라 주세요.",
      needCustomName: "커스텀 주제 이름을 입력해 주세요.",
      needCustomAnime: "커스텀 주제에 넣을 작품을 하나 이상 선택해 주세요.",
      duplicateGenre: "이미 저장된 장르 주제가 있어 해당 주제로 이동했어요.",
      customSaved: "커스텀 주제를 저장했어요.",
      genreSaved: "장르 주제를 저장했어요.",
      topicDeleted: "주제를 삭제했어요.",
      topicSummary: "현재 주제",
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
    },
    en: {
      title: "Tier Board",
      lead: "Save genre-specific boards and custom ranking topics, then reorder them by drag and drop.",
      currentBoard: "Current board",
      currentBoardLead: "Rank posters by drag and drop for the topic that is currently selected.",
      reset: "Reset current topic",
      deleteTopic: "Delete current topic",
      dragDrop: "Drag & Drop",
      topicLibrary: "Saved topics",
      topicLibraryLead: "Switch between topics and keep separate rankings.",
      createTopic: "Create a topic",
      createTopicLead: "Quickly save a genre board or build a custom board from hand-picked anime.",
      allAnime: "All anime",
      genreTopic: "Genre topic",
      customTopic: "Custom topic",
      topicType: "Topic type",
      topicTypeAll: "All-anime board",
      topicTypeGenre: "Genre board",
      topicTypeCustom: "Custom board",
      activeTopicBadge: "Active",
      createGenreTopic: "Save genre topic",
      createCustomTopic: "Save custom topic",
      updateCustomTopic: "Save current custom topic",
      genreSelect: "Choose genre",
      genreTopicLead: "Pick one genre and save it as its own ranking board.",
      customName: "Topic name",
      customNamePlaceholder: "Example: tearjerkers, all-time action top",
      customSearch: "Find anime",
      customSearchPlaceholder: "Search by title or genre",
      customTopicLead: "Hand-pick anime and save them as your own ranking topic.",
      selectedAnime: "Selected anime",
      selectedCount: "Selected",
      candidateAnime: "Candidates",
      selectedAnimeLead: "Anime currently included in this board. Click again to remove.",
      candidateAnimeLead: "Click a search result to add it to the board.",
      topicCount: "Eligible anime",
      total: "Total",
      tiers: "Tiers",
      unranked: "Unranked",
      rankingBoard: "Ranking board",
      rankingLead: "Drag posters into tiers or reorder them within the same tier.",
      unrankedLead: "Anime without a rank yet. Start here and move them upward.",
      emptyTier: "Drag anime here to place them.",
      noGenre: "No genre data yet.",
      noCandidates: "No matching anime.",
      noSelected: "No anime selected yet.",
      needGenre: "Choose a genre first.",
      needCustomName: "Enter a name for the custom topic.",
      needCustomAnime: "Select at least one anime for the custom topic.",
      duplicateGenre: "A topic for that genre already exists, so the board switched to it.",
      customSaved: "Saved the custom topic.",
      genreSaved: "Saved the genre topic.",
      topicDeleted: "Deleted the topic.",
      topicSummary: "Current topic",
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
    },
  });

  const [library, setLibrary] = useStoredState(STORAGE_KEYS.list, myListSeed);
  const [tierBundleRaw, setTierBundleRaw] = useStoredState(STORAGE_KEYS.tier, null);
  const [backupMsg, setBackupMsg] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [watchLogsSnapshot, setWatchLogsSnapshot] = useState([]);
  const [characterPinsSnapshot, setCharacterPinsSnapshot] = useState([]);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [topicKindDraft, setTopicKindDraft] = useState("genre");
  const [genreDraft, setGenreDraft] = useState("");
  const [customTopicName, setCustomTopicName] = useState("");
  const [customSearch, setCustomSearch] = useState("");
  const [customSelectedIds, setCustomSelectedIds] = useState([]);

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

      if (!Array.isArray(prev)) return normalized;
      if (
        normalized.length === source.length &&
        normalized.every((it, idx) => sameItem(it, source[idx]))
      ) {
        return prev;
      }
      return normalized;
    });
  }, [setLibrary]);

  const ids = useMemo(() => library.map((row) => row.anilistId), [library]);
  const idsKey = useMemo(() => ids.join(","), [ids]);

  const koById = useMemo(() => {
    const map = new Map();
    for (const item of library) {
      if (item?.anilistId == null) continue;
      if (item?.koTitle) map.set(item.anilistId, item.koTitle);
    }
    return map;
  }, [library]);

  function titleFor(id, media) {
    return pickDisplayTitle({ anilistId: id, koTitle: koById.get(id) || null }, media, locale) || (id ? `#${id}` : "Loading...");
  }

  const tierBundle = useMemo(
    () => normalizeTierTopicBundle(tierBundleRaw, makeEmptyTierState(ids)),
    [tierBundleRaw, idsKey]
  );
  const activeTopic = useMemo(() => getActiveTierTopic(tierBundle), [tierBundle]);
  const activeTierState = activeTopic?.tier || makeEmptyTierState([]);

  function getEligibleIdsForTopic(topic, sourceIds = ids, sourceMediaMap = mediaMap) {
    if (!topic || topic.kind === "all") return [...sourceIds];
    if (topic.kind === "genre") {
      const genreKey = String(topic.genreKey || "").trim();
      if (!genreKey) return [];
      return sourceIds.filter((id) => safeGenres(sourceMediaMap.get(id)).includes(genreKey));
    }
    if (topic.kind === "custom") {
      const set = new Set(sourceIds);
      return (Array.isArray(topic.includedIds) ? topic.includedIds : []).filter((id) => set.has(id));
    }
    return [...sourceIds];
  }

  const activeEligibleIds = useMemo(
    () => getEligibleIdsForTopic(activeTopic),
    [activeTopic, idsKey, mediaMap]
  );

  const genreOptions = useMemo(() => {
    const counts = new Map();
    for (const id of ids) {
      for (const genre of safeGenres(mediaMap.get(id))) {
        counts.set(genre, (counts.get(genre) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || formatGenreLabel(a[0], locale).localeCompare(formatGenreLabel(b[0], locale), locale === "en" ? "en" : "ko"))
      .map(([genre, count]) => ({ genre, count }));
  }, [idsKey, mediaMap, locale]);

  const customCandidates = useMemo(() => {
    const selectedSet = new Set(customSelectedIds);
    return library
      .filter((item) => !selectedSet.has(item.anilistId))
      .filter((item) => matchesTopicSearch(item, mediaMap.get(item.anilistId), customSearch, locale))
      .sort((a, b) => {
        const ta = titleFor(a.anilistId, mediaMap.get(a.anilistId));
        const tb = titleFor(b.anilistId, mediaMap.get(b.anilistId));
        return ta.localeCompare(tb, locale === "en" ? "en" : "ko");
      })
      .slice(0, 16);
  }, [customSearch, customSelectedIds, library, mediaMap, locale]);

  const activeTopicLabel = useMemo(() => {
    if (!activeTopic) return copy.allAnime;
    if (activeTopic.kind === "genre" && activeTopic.genreKey) return formatGenreLabel(activeTopic.genreKey, locale);
    if (activeTopic.id === DEFAULT_TIER_TOPIC_ID) return copy.allAnime;
    return activeTopic.name || copy.customTopic;
  }, [activeTopic, copy.allAnime, copy.customTopic, locale]);

  const activeTopicTypeLabel = useMemo(() => {
    if (!activeTopic || activeTopic.id === DEFAULT_TIER_TOPIC_ID || activeTopic.kind === "all") {
      return copy.topicTypeAll;
    }
    if (activeTopic.kind === "genre") return copy.topicTypeGenre;
    return copy.topicTypeCustom;
  }, [activeTopic, copy.topicTypeAll, copy.topicTypeCustom, copy.topicTypeGenre]);

  const totalPlacedCount =
    (Array.isArray(activeTierState?.unranked) ? activeTierState.unranked.length : 0) +
    DEFAULT_TIERS.reduce((acc, tier) => acc + (Array.isArray(activeTierState?.tiers?.[tier]) ? activeTierState.tiers[tier].length : 0), 0);

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
      .then((rows) => setCharacterPinsSnapshot(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await ensureLegacyStorageMigrated().catch(() => {});
      const [preferredLibrary, preferredBundle] = await Promise.all([
        readLibraryListPreferred(myListSeed).catch(() => null),
        readTierBoardBundlePreferred(null).catch(() => null),
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

      if (preferredBundle && typeof preferredBundle === "object") {
        setTierBundleRaw((prev) => {
          const current = normalizeTierTopicBundle(prev, null);
          const next = normalizeTierTopicBundle(preferredBundle, null);
          return sameJson(current, next) ? prev : next;
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [setLibrary, setTierBundleRaw]);

  useEffect(() => {
    writeLibraryList(library, { mirrorOnly: true });
  }, [library]);

  useEffect(() => {
    writeTierBoardBundle(tierBundle, { mirrorOnly: true });
  }, [tierBundle]);

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
  }, [idsKey]);

  useEffect(() => {
    setTierBundleRaw((prevRaw) => {
      const current = normalizeTierTopicBundle(prevRaw, makeEmptyTierState(ids));
      const next = {
        ...current,
        topics: current.topics.map((topic) => {
          const eligibleIds = getEligibleIdsForTopic(topic, ids, mediaMap);
          return {
            ...topic,
            includedIds: topic.kind === "custom" ? eligibleIds : topic.includedIds,
            tier: syncTierStateWithEligibleIds(topic.tier, eligibleIds),
          };
        }),
      };
      return sameJson(current, next) ? prevRaw : next;
    });
  }, [idsKey, mediaMap, setTierBundleRaw]);

  useEffect(() => {
    if (activeTopic?.kind !== "custom") return;
    setTopicKindDraft("custom");
    setCustomTopicName(activeTopic.name || "");
    setCustomSelectedIds(Array.isArray(activeTopic.includedIds) ? activeTopic.includedIds : []);
    setCustomSearch("");
  }, [activeTopic?.id, activeTopic?.kind]);

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

  function allowDrop(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function onDragStart(event, id, from, fromIndex) {
    event.dataTransfer.setData("text/plain", JSON.stringify({ id, from, fromIndex }));
    event.dataTransfer.effectAllowed = "move";
  }

  function parsePayload(event) {
    const raw = event.dataTransfer.getData("text/plain");
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
    state.unranked = (state.unranked || []).filter((value) => value !== id);
    for (const key of Object.keys(state.tiers || {})) {
      state.tiers[key] = (state.tiers[key] || []).filter((value) => value !== id);
    }
  }

  function insertAt(arr, index, value) {
    const nextIndex = Math.max(0, Math.min(index, arr.length));
    arr.splice(nextIndex, 0, value);
  }

  function moveItem(prev, { id, from, fromIndex }, to, toIndex) {
    const next = structuredClone(prev);
    const sameList = from === to;
    removeEverywhere(next, id);

    const target = getListRef(next, to) || [];
    if (to === "unranked") next.unranked = target;
    else next.tiers[to] = target;

    let nextIndex = typeof toIndex === "number" ? toIndex : target.length;
    if (sameList && typeof fromIndex === "number" && fromIndex < nextIndex) nextIndex -= 1;
    insertAt(target, nextIndex, id);
    return next;
  }

  function updateActiveTier(updater) {
    setTierBundleRaw((prevRaw) => {
      const current = normalizeTierTopicBundle(prevRaw, makeEmptyTierState(ids));
      const nextTier =
        typeof updater === "function"
          ? updater(getActiveTierTopic(current)?.tier || makeEmptyTierState(activeEligibleIds))
          : updater;
      return replaceActiveTierState(current, nextTier);
    });
  }

  function onDropToEnd(event, to) {
    event.preventDefault();
    const payload = parsePayload(event);
    if (!payload) return;
    updateActiveTier((prevTier) => {
      const arr = getListRef(prevTier, to) || [];
      return moveItem(prevTier, payload, to, arr.length);
    });
  }

  function onDropToItem(event, to, toIndex) {
    event.preventDefault();
    event.stopPropagation();
    const payload = parsePayload(event);
    if (!payload) return;
    updateActiveTier((prevTier) => moveItem(prevTier, payload, to, toIndex));
  }

  function reset() {
    updateActiveTier(makeEmptyTierState(activeEligibleIds));
  }

  function selectTopic(topicId) {
    setTierBundleRaw((prevRaw) => setActiveTierTopicId(prevRaw, topicId));
  }

  function deleteCurrentTopic() {
    if (!activeTopic || activeTopic.id === DEFAULT_TIER_TOPIC_ID) return;
    setTierBundleRaw((prevRaw) => removeTierTopic(prevRaw, activeTopic.id));
    setBackupMsg(copy.topicDeleted);
  }

  function createGenreTopic() {
    const genreKey = String(genreDraft || "").trim();
    if (!genreKey) {
      setBackupMsg(copy.needGenre);
      return;
    }

    const existing = tierBundle.topics.find((topic) => topic.kind === "genre" && topic.genreKey === genreKey);
    if (existing) {
      setTierBundleRaw((prevRaw) => setActiveTierTopicId(prevRaw, existing.id));
      setBackupMsg(copy.duplicateGenre);
      return;
    }

    const eligibleIds = getEligibleIdsForTopic({ kind: "genre", genreKey });
    const nextTopic = createGenreTierTopic({
      name: genreKey,
      genreKey,
      tier: makeEmptyTierState(eligibleIds),
    });
    setTierBundleRaw((prevRaw) => upsertTierTopic(prevRaw, nextTopic, true));
    setBackupMsg(copy.genreSaved);
  }

  function persistCustomTopic() {
    const name = String(customTopicName || "").trim();
    if (!name) {
      setBackupMsg(copy.needCustomName);
      return;
    }
    if (!customSelectedIds.length) {
      setBackupMsg(copy.needCustomAnime);
      return;
    }

    const nextTopic = activeTopic?.kind === "custom"
      ? {
          ...activeTopic,
          name,
          includedIds: customSelectedIds,
          tier: syncTierStateWithEligibleIds(activeTopic.tier, customSelectedIds),
        }
      : createCustomTierTopic({
          name,
          includedIds: customSelectedIds,
          tier: makeEmptyTierState(customSelectedIds),
        });

    setTierBundleRaw((prevRaw) => upsertTierTopic(prevRaw, nextTopic, true));
    setBackupMsg(copy.customSaved);
  }

  function addCustomAnime(id) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;
    setCustomSelectedIds((prev) => (prev.includes(numericId) ? prev : [...prev, numericId]));
  }

  function removeCustomAnime(id) {
    const numericId = Number(id);
    setCustomSelectedIds((prev) => prev.filter((row) => row !== numericId));
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
      version: 4,
      exportedAt: new Date().toISOString(),
      list: normalizeImportList(library),
      tier: activeTierState,
      tierTopics: tierBundle,
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
    const anchor = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `ani-site-backup-${date}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
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
        await navigator.share({ title: copy.shareFileTitle, files: [file] });
        markBackupExported(copy.sharedFile);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        setBackupMsg(copy.shareCancelled);
        return;
      }
    }

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: copy.shareTextTitle, text });
        markBackupExported(copy.sharedText);
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
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
    if (!Array.isArray(incomingList)) throw new Error(copy.missingList);

    const incomingNormalized = normalizeImportList(incomingList);
    const isOverwrite = mode === "overwrite";

    if (isOverwrite) {
      const ok = window.confirm(copy.overwriteConfirm);
      if (!ok) return;
      setLibrary(incomingNormalized);
    } else {
      setLibrary((prev) => dedupeByAnilistId([...prev, ...incomingNormalized]));
    }

    const incomingBundle = !Array.isArray(json) ? json?.tierTopics : null;
    const incomingTier = !Array.isArray(json) ? json?.tier : null;
    if (incomingBundle || incomingTier) {
      const nextBundle = incomingBundle || incomingTier;
      setTierBundleRaw((prevRaw) =>
        isOverwrite ? normalizeTierTopicBundle(nextBundle, null) : mergeTierTopicBundles(prevRaw, nextBundle)
      );
    }

    const incomingLogs = !Array.isArray(json) ? json?.watchLogs : null;
    if (Array.isArray(incomingLogs)) {
      if (isOverwrite) await replaceWatchLogs(incomingLogs);
      else await mergeWatchLogs(incomingLogs);
      refreshWatchLogsSnapshot();
    } else if (isOverwrite) {
      await replaceWatchLogs([]);
      refreshWatchLogsSnapshot();
    }

    const incomingPins = !Array.isArray(json) ? json?.characterPins : null;
    if (Array.isArray(incomingPins)) {
      if (isOverwrite) await replaceCharacterPins(incomingPins);
      else await mergeCharacterPins(incomingPins);
      refreshCharacterPinsSnapshot();
    } else if (isOverwrite) {
      await replaceCharacterPins([]);
      refreshCharacterPinsSnapshot();
    }

    setBackupMsg(isOverwrite ? copy.importDoneOverwrite : copy.importDoneMerge);
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
    } catch (error) {
      console.error(error);
      setBackupMsg(`${copy.pasteImportFailed}: ${error?.message || copy.unknownError}`);
      throw error;
    }
  }

  async function importBackupFile(file, mode = "merge") {
    try {
      await importBackup(file, mode);
    } catch (error) {
      console.error(error);
      setBackupMsg(`${copy.importFailed}: ${error?.message || copy.unknownError}`);
      throw error;
    }
  }

  const rawBase = String(import.meta.env.BASE_URL || "/");
  const base = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  return (
    <div className="tier-board">
      <TopNavDataMenu
        base={base}
        panelId="tier-data-menu-panel"
        canInstallPwa={canInstallPwa}
        locale={locale}
        theme={theme}
        onToggleLocale={(nextLocale) => setLocale(nextLocale || (locale === "ko" ? "en" : "ko"))}
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        onExportFile={exportBackup}
        onExportMobile={exportBackupMobile}
        onInstallPwa={onClickInstallPwa}
        onImportJsonFile={importBackupFile}
        onImportJsonText={importBackupText}
      />

      {backupMsg && <div className="tier-board__feedback small">{backupMsg}</div>}

      <section className="pageHeader tier-board__header">
        <h1 className="pageTitle">{copy.title}</h1>
        <p className="pageLead">{copy.lead}</p>
      </section>

      <section className="surface-card tier-summary-card">
        <div className="tier-summary-card__top">
          <div className="pageHeader tier-summary-card__copy">
            <div className="pageTitle tier-summary-card__title">{copy.currentBoard}</div>
            <p className="pageLead">{copy.currentBoardLead}</p>
          </div>
          <div className="tier-summary-card__actions">
            <button className="btn" onClick={reset}>{copy.reset}</button>
            {activeTopic.id !== DEFAULT_TIER_TOPIC_ID && (
              <button className="btn" onClick={deleteCurrentTopic}>{copy.deleteTopic}</button>
            )}
          </div>
        </div>

        <div className="tier-summary-card__meta">
          <div className="tier-summary-card__topic">
            <div className="tier-summary-card__eyebrow">{copy.topicSummary}</div>
            <div className="tier-summary-card__topic-row">
              <strong className="tier-summary-card__topic-name">{activeTopicLabel}</strong>
              <span className="tier-summary-card__topic-kind">{activeTopicTypeLabel}</span>
            </div>
          </div>
          <div className="tier-summary-card__metrics">
            <TopicMetric label={copy.topicCount} value={activeEligibleIds.length} />
            <TopicMetric label={copy.total} value={totalPlacedCount} />
            <TopicMetric label={copy.tiers} value={DEFAULT_TIERS.length} />
          </div>
        </div>
      </section>

      <section className="surface-card tier-topic-section">
        <div className="pageHeader tier-topic-section__header">
          <div className="pageTitle tier-topic-section__title">{copy.topicLibrary}</div>
          <p className="pageLead">{copy.topicLibraryLead}</p>
        </div>

        <div className="tier-topic-chip-row">
          {tierBundle.topics.map((topic) => {
            const label =
              topic.id === DEFAULT_TIER_TOPIC_ID
                ? copy.allAnime
                : topic.kind === "genre" && topic.genreKey
                  ? formatGenreLabel(topic.genreKey, locale)
                  : topic.name;
            const eligibleCount = getEligibleIdsForTopic(topic).length;

            return (
              <TopicChip
                key={topic.id}
                label={label}
                meta={`${copy.topicCount} ${eligibleCount}`}
                isActive={topic.id === activeTopic.id}
                badge={topic.id === activeTopic.id ? copy.activeTopicBadge : null}
                onClick={() => selectTopic(topic.id)}
              />
            );
          })}
        </div>
      </section>

      <section className="surface-card tier-topic-section">
        <div className="pageHeader tier-topic-section__header">
          <div className="pageTitle tier-topic-section__title">{copy.createTopic}</div>
          <p className="pageLead">{copy.createTopicLead}</p>
        </div>

        <div className="tier-topic-mode-row" aria-label={copy.topicType}>
          <button
            type="button"
            className={`tier-topic-mode-btn${topicKindDraft === "genre" ? " is-active" : ""}`}
            onClick={() => setTopicKindDraft("genre")}
          >
            {copy.genreTopic}
          </button>
          <button
            type="button"
            className={`tier-topic-mode-btn${topicKindDraft === "custom" ? " is-active" : ""}`}
            onClick={() => setTopicKindDraft("custom")}
          >
            {copy.customTopic}
          </button>
        </div>

        {topicKindDraft === "genre" ? (
          <div className="tier-topic-builder">
            <div className="tier-topic-builder__main">
              <div className="tier-topic-builder__eyebrow">{copy.genreTopic}</div>
              <p className="tier-topic-builder__lead">{copy.genreTopicLead}</p>
              <select
                className="select tier-topic-builder__control"
                value={genreDraft}
                onChange={(event) => setGenreDraft(String(event.target.value || ""))}
                aria-label={copy.genreSelect}
              >
                <option value="">{copy.genreSelect}</option>
                {genreOptions.map((row) => (
                  <option key={row.genre} value={row.genre}>
                    {formatGenreLabel(row.genre, locale)} ({row.count})
                  </option>
                ))}
              </select>
              {genreOptions.length === 0 && <div className="small">{copy.noGenre}</div>}
            </div>

            <div className="tier-topic-builder__side">
              <button className="btn" onClick={createGenreTopic}>{copy.createGenreTopic}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="tier-topic-builder tier-topic-builder--custom">
              <div className="tier-topic-builder__main">
                <div className="tier-topic-builder__eyebrow">{copy.customTopic}</div>
                <p className="tier-topic-builder__lead">{copy.customTopicLead}</p>
                <input
                  className="input tier-topic-builder__control"
                  value={customTopicName}
                  onChange={(event) => setCustomTopicName(event.target.value)}
                  placeholder={copy.customNamePlaceholder}
                  aria-label={copy.customName}
                />
                <input
                  className="input tier-topic-builder__control"
                  value={customSearch}
                  onChange={(event) => setCustomSearch(event.target.value)}
                  placeholder={copy.customSearchPlaceholder}
                  aria-label={copy.customSearch}
                />
              </div>

              <div className="tier-topic-builder__side">
                <button className="btn" onClick={persistCustomTopic}>
                  {activeTopic.kind === "custom" ? copy.updateCustomTopic : copy.createCustomTopic}
                </button>
              </div>
            </div>

            <div className="tier-topic-picker-grid">
              <section className="tier-topic-picker-card">
                <div className="tier-topic-picker-card__head">
                  <strong>{copy.selectedAnime}</strong>
                  <span className="small">{copy.selectedCount} {customSelectedIds.length}</span>
                </div>
                <p className="pageLead tier-topic-picker-card__lead">{copy.selectedAnimeLead}</p>
                <div className="tier-topic-picker-card__body">
                  <div className="tier-token-wrap">
                    {customSelectedIds.map((id) => {
                      const media = mediaMap.get(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className="tier-token-btn"
                          onClick={() => removeCustomAnime(id)}
                        >
                          {titleFor(id, media)} <span aria-hidden="true">×</span>
                        </button>
                      );
                    })}
                  </div>
                  {customSelectedIds.length === 0 && <div className="small">{copy.noSelected}</div>}
                </div>
              </section>

              <section className="tier-topic-picker-card">
                <div className="tier-topic-picker-card__head">
                  <strong>{copy.candidateAnime}</strong>
                </div>
                <p className="pageLead tier-topic-picker-card__lead">{copy.candidateAnimeLead}</p>
                <div className="tier-topic-picker-card__body">
                  <div className="tier-token-wrap">
                    {customCandidates.map((item) => {
                      const media = mediaMap.get(item.anilistId);
                      return (
                        <button
                          key={item.anilistId}
                          type="button"
                          className="tier-token-btn"
                          onClick={() => addCustomAnime(item.anilistId)}
                        >
                          {titleFor(item.anilistId, media)}
                        </button>
                      );
                    })}
                  </div>
                  {customCandidates.length === 0 && <div className="small">{copy.noCandidates}</div>}
                </div>
              </section>
            </div>
          </>
        )}
      </section>

      <section className="pageHeader tier-rank-header">
        <div className="pageTitle tier-topic-section__title">{copy.rankingBoard}</div>
        <p className="pageLead">{copy.rankingLead}</p>
      </section>

      {DEFAULT_TIERS.map((tierName) => (
        <div
          key={tierName}
          onDragOver={allowDrop}
          onDrop={(event) => onDropToEnd(event, tierName)}
          className="tier-rank-row"
        >
          <div className="tier-rank-row__label">{tierName}</div>
          <div className="tier-rank-row__dropzone">
            {(activeTierState.tiers?.[tierName] || []).map((id, idx) => {
              const media = mediaMap.get(id);
              const title = titleFor(id, media);
              return (
                <TierPoster
                  key={id}
                  id={id}
                  index={idx}
                  listName={tierName}
                  title={title}
                  image={media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium || undefined}
                  onDragStart={onDragStart}
                  onDragOver={allowDrop}
                  onDrop={onDropToItem}
                />
              );
            })}
            {(activeTierState.tiers?.[tierName] || []).length === 0 && (
              <div className="tier-rank-row__empty small">{copy.emptyTier}</div>
            )}
          </div>
        </div>
      ))}

      <section
        onDragOver={allowDrop}
        onDrop={(event) => onDropToEnd(event, "unranked")}
        className="tier-unranked"
      >
        <div className="tier-unranked__head">
          <strong>{copy.unranked}</strong>
          <p className="pageLead tier-unranked__lead">{copy.unrankedLead}</p>
        </div>
        <div className="tier-unranked__grid">
          {(activeTierState.unranked || []).map((id, idx) => {
            const media = mediaMap.get(id);
            const title = titleFor(id, media);
            return (
              <TierPoster
                key={id}
                id={id}
                index={idx}
                listName="unranked"
                title={title}
                image={media?.coverImage?.extraLarge || media?.coverImage?.large || media?.coverImage?.medium || undefined}
                onDragStart={onDragStart}
                onDragOver={allowDrop}
                onDrop={onDropToItem}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
