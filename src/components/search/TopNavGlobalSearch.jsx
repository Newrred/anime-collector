import { useEffect, useMemo, useRef, useState } from "react";
import { getMessageGroup } from "../../domain/messages.js";
import { pushQuickSearchRecent, readQuickAddStatus, readQuickSearchRecent, writeQuickAddStatus } from "../../repositories/quickActionPrefRepo.js";
import { useGlobalQuickActionSource } from "../../hooks/useGlobalQuickActionSource.js";
import { searchLocalLibrary, mapLocalLibraryRow } from "../../domain/search/libraryLocalSearch.js";
import { searchRemoteCandidates } from "../../domain/search/quickActionRemote.js";
import { addAnimeFromQuickAction, openLibraryDeepLink } from "../../domain/search/quickActionActions.js";
import { IconSearch } from "../ui/AppIcons.jsx";
import QuickActionPanel from "./QuickActionPanel.jsx";
import GlobalQuickActionSheet from "./GlobalQuickActionSheet.jsx";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia(query);
    const sync = () => setMatches(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

function buildRecentLibraryRows(items, recentLogs, mediaMap, locale) {
  const itemById = new Map(
    (Array.isArray(items) ? items : []).map((item) => [Number(item?.anilistId), item])
  );
  const rows = [];
  const seen = new Set();

  for (const log of Array.isArray(recentLogs) ? recentLogs : []) {
    const id = Number(log?.anilistId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    const item = itemById.get(id);
    if (!item) continue;
    seen.add(id);
    const media = mediaMap.get(id) || null;
    const row = mapLocalLibraryRow({ item, media, locale });
    if (row) rows.push(row);
    if (rows.length >= 5) return rows;
  }

  for (const item of Array.isArray(items) ? items : []) {
    const id = Number(item?.anilistId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    const media = mediaMap.get(id) || null;
    const row = mapLocalLibraryRow({ item, media, locale });
    if (row) rows.push(row);
    if (rows.length >= 5) return rows;
  }

  return rows;
}

export default function TopNavGlobalSearch({ base = "/", locale = "ko" }) {
  const copy = getMessageGroup(locale, "globalQuickAction");
  const { items, recentLogs, mediaMap } = useGlobalQuickActionSource();
  const [query, setQuery] = useState("");
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remoteRows, setRemoteRows] = useState([]);
  const [recentQueries, setRecentQueries] = useState(() => readQuickSearchRecent());
  const [quickAddStatus, setQuickAddStatus] = useState(() => readQuickAddStatus());
  const rootRef = useRef(null);
  const desktopInputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const isMobile = useMediaQuery("(max-width: 900px)");

  const libraryIdSet = useMemo(
    () => new Set(items.map((item) => Number(item?.anilistId)).filter(Number.isFinite)),
    [items]
  );

  const recentRows = useMemo(
    () => buildRecentLibraryRows(items, recentLogs, mediaMap, locale),
    [items, recentLogs, mediaMap, locale]
  );

  const localRows = useMemo(() => {
    const trimmed = String(query || "").trim();
    if (!trimmed) return [];
    return searchLocalLibrary({
      items,
      mediaMap,
      query: trimmed,
      locale,
      limit: 6,
    });
  }, [items, mediaMap, query, locale]);

  useEffect(() => {
    const trimmed = String(query || "").trim();
    if (trimmed.length < 2) {
      setRemoteRows([]);
      setLoading(false);
      return undefined;
    }

    let alive = true;
    setLoading(true);

    const timer = window.setTimeout(() => {
      searchRemoteCandidates(trimmed, libraryIdSet)
        .then((rows) => {
          if (!alive) return;
          setRemoteRows(rows);
          setLoading(false);
        })
        .catch(() => {
          if (!alive) return;
          setRemoteRows([]);
          setLoading(false);
        });
    }, 180);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, libraryIdSet]);

  useEffect(() => {
    function onDocumentMouseDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setDesktopOpen(false);
      }
    }

    function focusInput() {
      if (isMobile) {
        setMobileOpen(true);
        requestAnimationFrame(() => mobileInputRef.current?.focus());
      } else {
        setDesktopOpen(true);
        requestAnimationFrame(() => desktopInputRef.current?.focus());
      }
    }

    function onOpenQuickAction() {
      focusInput();
    }

    function onKeyDown(event) {
      const key = String(event.key || "").toLowerCase();
      const withMeta = event.metaKey || event.ctrlKey;

      if (withMeta && key === "k") {
        event.preventDefault();
        focusInput();
        return;
      }

      if (!withMeta && key === "/") {
        const tag = String(document.activeElement?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;
        event.preventDefault();
        focusInput();
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("moemoa:quick-action-open", onOpenQuickAction);

    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("moemoa:quick-action-open", onOpenQuickAction);
    };
  }, [isMobile]);

  useEffect(() => {
    writeQuickAddStatus(quickAddStatus);
  }, [quickAddStatus]);

  function rememberQuery() {
    const trimmed = String(query || "").trim();
    if (!trimmed) return;
    setRecentQueries(pushQuickSearchRecent(trimmed));
  }

  async function handleAddRemote(row) {
    const result = await addAnimeFromQuickAction(row.media, quickAddStatus);
    rememberQuery();
    setDesktopOpen(false);
    setMobileOpen(false);
    openLibraryDeepLink({ base, animeId: result.item.anilistId, focus: "detail" });
  }

  function handleOpenDetail(animeId) {
    rememberQuery();
    setDesktopOpen(false);
    setMobileOpen(false);
    openLibraryDeepLink({ base, animeId, focus: "detail" });
  }

  function handleOpenQuickLog(animeId) {
    rememberQuery();
    setDesktopOpen(false);
    setMobileOpen(false);
    openLibraryDeepLink({ base, animeId, focus: "quick-log" });
  }

  function renderPanel() {
    return (
      <QuickActionPanel
        locale={locale}
        query={query}
        localRows={localRows}
        remoteRows={remoteRows}
        recentRows={recentRows}
        recentQueries={recentQueries}
        loading={loading}
        quickAddStatus={quickAddStatus}
        onQuickAddStatusChange={setQuickAddStatus}
        onPickRecentQuery={(value) => {
          setQuery(value);
          requestAnimationFrame(() => {
            if (isMobile) mobileInputRef.current?.focus();
            else desktopInputRef.current?.focus();
          });
        }}
        onOpenDetail={handleOpenDetail}
        onOpenQuickLog={handleOpenQuickLog}
        onAddRemote={handleAddRemote}
      />
    );
  }

  return (
    <>
      <div ref={rootRef} className="top-nav__search quick-action">
        <div className="quick-action__desktop">
          <div className="quick-action__input-wrap">
            <span className="quick-action__icon" aria-hidden>
              <IconSearch size={18} />
            </span>
            <input
              ref={desktopInputRef}
              className="quick-action__input"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setDesktopOpen(true);
              }}
              onFocus={() => setDesktopOpen(true)}
              placeholder={copy.inputPlaceholder}
              aria-label={copy.inputPlaceholder}
            />
          </div>
          {desktopOpen ? renderPanel() : null}
        </div>

        <button
          type="button"
          className="data-menu-trigger quick-action__mobile-trigger"
          onClick={() => {
            setMobileOpen(true);
            requestAnimationFrame(() => mobileInputRef.current?.focus());
          }}
          aria-label={copy.openSearchSheet}
          title={copy.openSearchSheet}
        >
          <IconSearch size={18} />
        </button>
      </div>

      <GlobalQuickActionSheet
        open={mobileOpen}
        title={copy.title}
        closeLabel={copy.closeSearchSheet}
        onClose={() => setMobileOpen(false)}
      >
        <div className="quick-action-sheet__search">
          <div className="quick-action__input-wrap">
            <span className="quick-action__icon" aria-hidden>
              <IconSearch size={18} />
            </span>
            <input
              ref={mobileInputRef}
              className="quick-action__input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.inputPlaceholder}
              aria-label={copy.inputPlaceholder}
            />
          </div>
        </div>
        {renderPanel()}
      </GlobalQuickActionSheet>
    </>
  );
}
