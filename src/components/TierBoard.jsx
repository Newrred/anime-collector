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
import { IconTrash } from "./ui/AppIcons.jsx";
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
import { getMessageGroup } from "../domain/messages.js";
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

function TopicChip({ label, meta, isActive, onClick }) {
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
  const copy = getMessageGroup(locale, "tierBoard");

  const [library, setLibrary] = useStoredState(STORAGE_KEYS.list, myListSeed);
  const [tierBundleRaw, setTierBundleRaw] = useStoredState(STORAGE_KEYS.tier, null);
  const [backupMsg, setBackupMsg] = useState("");
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [watchLogsSnapshot, setWatchLogsSnapshot] = useState([]);
  const [characterPinsSnapshot, setCharacterPinsSnapshot] = useState([]);
  const [mediaMap, setMediaMap] = useState(new Map());
  const [customTopicName, setCustomTopicName] = useState("");
  const [unrankedQuery, setUnrankedQuery] = useState("");
  const [unrankedGenre, setUnrankedGenre] = useState("");

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
    return [...sourceIds];
  }

  const activeEligibleIds = useMemo(
    () => getEligibleIdsForTopic(activeTopic),
    [activeTopic, idsKey, mediaMap]
  );

  const activeEligibleIdSet = useMemo(() => new Set(activeEligibleIds), [activeEligibleIds]);

  const unrankedGenreOptions = useMemo(() => {
    const counts = new Map();
    for (const id of activeTierState.unranked || []) {
      const media = mediaMap.get(id);
      for (const genre of safeGenres(media)) {
        counts.set(genre, (counts.get(genre) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort(
        (a, b) =>
          b[1] - a[1] ||
          formatGenreLabel(a[0], locale).localeCompare(
            formatGenreLabel(b[0], locale),
            locale === "en" ? "en" : "ko"
          )
      )
      .map(([genre, count]) => ({ genre, count }));
  }, [activeTierState.unranked, mediaMap, locale]);

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
    DEFAULT_TIERS.reduce(
      (acc, tier) => acc + (Array.isArray(activeTierState?.tiers?.[tier]) ? activeTierState.tiers[tier].length : 0),
      0
    );

  const unrankedVisibleIds = useMemo(
    () =>
      (activeTierState.unranked || []).filter(
        (id) =>
          activeEligibleIdSet.has(id) &&
          (!unrankedGenre || safeGenres(mediaMap.get(id)).includes(unrankedGenre)) &&
          matchesTopicSearch(
            library.find((item) => Number(item?.anilistId) === Number(id)),
            mediaMap.get(id),
            unrankedQuery,
            locale
          )
      ),
    [activeTierState.unranked, activeEligibleIdSet, library, mediaMap, unrankedGenre, unrankedQuery, locale]
  );

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
    if (activeTopic?.kind === "custom") {
      setCustomTopicName(activeTopic.name || "");
      return;
    }
    setCustomTopicName("");
  }, [activeTopic?.id, activeTopic?.kind, activeTopic?.name]);

  useEffect(() => {
    setUnrankedQuery("");
    setUnrankedGenre("");
  }, [activeTopic?.id]);

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

  function persistCustomTopic() {
    const name = String(customTopicName || "").trim();
    if (!name) {
      setBackupMsg(copy.needCustomName);
      return;
    }

    const nextTopic = activeTopic?.kind === "custom"
      ? {
          ...activeTopic,
          name,
          includedIds: ids,
          tier: syncTierStateWithEligibleIds(activeTopic.tier, ids),
        }
      : createCustomTierTopic({
          name,
          includedIds: ids,
          tier: makeEmptyTierState(ids),
        });

    setTierBundleRaw((prevRaw) => upsertTierTopic(prevRaw, nextTopic, true));
    setBackupMsg(copy.customSaved);
    setCustomTopicName("");
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
        currentRoute="tier"
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
              <button className="btn btn--danger" onClick={deleteCurrentTopic}>
                <span className="btn__icon"><IconTrash size={14} /></span>
                <span className="btn__label">{copy.deleteTopic}</span>
              </button>
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

        <div className="tier-summary-card__topic-tools">
          <div className="tier-summary-card__topic-creator">
            <div className="tier-summary-card__eyebrow">{copy.createCustomTopic}</div>
            <p className="pageLead tier-summary-card__topic-helper">{copy.customTopicLead}</p>
            <div className="tier-summary-card__topic-input-row">
              <input
                className="input tier-summary-card__topic-input"
                value={customTopicName}
                onChange={(event) => setCustomTopicName(event.target.value)}
                placeholder={copy.customNamePlaceholder}
                aria-label={copy.customName}
              />
              <button className="btn" onClick={persistCustomTopic}>
                {activeTopic.kind === "custom" ? copy.updateCustomTopic : copy.createCustomTopic}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-card tier-topic-switcher" aria-label={copy.topicLibrary}>
        <div className="tier-summary-card__eyebrow">{copy.topicLibrary}</div>
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
                    onClick={() => selectTopic(topic.id)}
                  />
                );
          })}
        </div>
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
        <div className="tier-unranked__toolbar">
          <input
            className="input tier-unranked__search"
            value={unrankedQuery}
            onChange={(event) => setUnrankedQuery(event.target.value)}
            placeholder={copy.customSearchPlaceholder}
            aria-label={copy.unrankedSearch}
          />
          <select
            className="select tier-unranked__genre"
            value={unrankedGenre}
            onChange={(event) => setUnrankedGenre(String(event.target.value || ""))}
            aria-label={copy.genreFilter}
          >
            <option value="">{copy.genreFilterAll}</option>
            {unrankedGenreOptions.map((row) => (
              <option key={row.genre} value={row.genre}>
                {formatGenreLabel(row.genre, locale)} ({row.count})
              </option>
            ))}
          </select>
        </div>
        <div className="tier-unranked__grid">
          {unrankedVisibleIds.map((id, idx) => {
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
          {(activeTierState.unranked || []).length === 0 && (
            <div className="small tier-rank-row__empty">{copy.noUnranked}</div>
          )}
          {(activeTierState.unranked || []).length > 0 && unrankedVisibleIds.length === 0 && (
            <div className="small tier-rank-row__empty">{copy.noCandidates}</div>
          )}
        </div>
      </section>
    </div>
  );
}
