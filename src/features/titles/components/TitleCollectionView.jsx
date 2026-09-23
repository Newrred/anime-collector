import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import LibraryFiltersPanel from "../../../components/library/LibraryFiltersPanel.jsx";
import { formatGenreLabel } from "../../../components/library/libraryCopy.js";
import { useStoredState } from "../../../hooks/useStoredState.js";
import { STORAGE_KEYS } from "../../../storage/keys.js";
import { buildTitleHubHref } from "../domain/titleNavigation.js";
import { applyTitleCollectionQuery, chooseInitialTitleViewMode } from "../application/titleCollectionQuery.js";
import { readTitleCollectionViewPreference, writeTitleCollectionViewPreference } from "../application/titleCollectionPreference.js";
import { createTitleCollectionService } from "../application/titleCollectionService.js";
import MemoryRouteShell, { useMemoryRouteUi } from "../../memory/components/MemoryRouteShell.jsx";
import TitleAlbumCard from "./TitleAlbumCard.jsx";
import TitlePosterTile from "./TitlePosterTile.jsx";
import "./title-collection.css";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export default function TitleCollectionView({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="titles">
      <TitleCollectionContent base={base} />
    </MemoryRouteShell>
  );
}

function TitleCollectionContent({ base }) {
  const { locale, copy: memoryCopy } = useMemoryRouteUi();
  const copy = memoryCopy.titles;
  const service = useMemo(() => (
    import.meta.env.DEV && globalThis.__MOEMOA_TEST_TITLE_COLLECTION_SERVICE__
      ? globalThis.__MOEMOA_TEST_TITLE_COLLECTION_SERVICE__
      : createTitleCollectionService()
  ), []);
  const [albums, setAlbums] = useState([]);
  const [status, setStatus] = useState("loading");
  const [mode, setMode] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [sort, setSort] = useState("RECENT_MEMORY");
  const [sortDir, setSortDir] = useState("desc");
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState([]);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [cardsPerRowBase, setCardsPerRowBase] = useStoredState(STORAGE_KEYS.cardsPerRowBase, 5);
  const gridRef = useRef(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    let active = true;
    let revision = 0;
    function refresh() {
      const request = ++revision;
      service.load().then((nextAlbums) => {
        if (!active || request !== revision) return;
        setAlbums(nextAlbums);
        setMode((current) => current || chooseInitialTitleViewMode(readTitleCollectionViewPreference(), nextAlbums));
        setStatus("ready");
      }).catch(() => active && request === revision && setStatus("error"));
    }
    refresh();
    window.addEventListener("moemoa:library-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("moemoa:library-updated", refresh);
    };
  }, [service]);

  const genreOptions = useMemo(() => {
    const values = new Set();
    for (const album of albums) {
      for (const genre of Array.isArray(album.genres) ? album.genres : []) values.add(genre);
    }
    return [...values].sort((left, right) => (
      formatGenreLabel(left, locale).localeCompare(formatGenreLabel(right, locale), locale === "en" ? "en" : "ko")
    ));
  }, [albums, locale]);
  const indexedAlbums = useMemo(() => albums.map((album) => ({
    ...album,
    genreSearchLabels: (Array.isArray(album.genres) ? album.genres : []).flatMap((genre) => [
      formatGenreLabel(genre, "ko"),
      formatGenreLabel(genre, "en"),
    ]),
  })), [albums]);
  const visibleAlbums = useMemo(() => applyTitleCollectionQuery(indexedAlbums, {
    filter,
    sort,
    sortDir,
    query,
    genres,
  }), [indexedAlbums, filter, sort, sortDir, query, genres]);
  const hasVisibleAlbums = visibleAlbums.length > 0;

  useEffect(() => {
    const element = gridRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries?.[0]?.contentRect?.width;
      if (Number.isFinite(width)) setGridWidth(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [status, mode, hasVisibleAlbums]);

  const effectiveCols = useMemo(() => {
    const baseColumns = clamp(Number(cardsPerRowBase) || 5, 2, 10);
    if (!Number.isFinite(gridWidth) || gridWidth <= 0) return baseColumns;
    const scaled = Math.round(baseColumns * (gridWidth / 1080));
    const posterMode = mode === "POSTER";
    const minColumns = posterMode ? 2 : 1;
    const minCardWidth = posterMode ? 120 : 300;
    const maxColumnsByWidth = Math.max(minColumns, Math.floor(gridWidth / minCardWidth));
    return clamp(scaled, minColumns, Math.max(minColumns, maxColumnsByWidth));
  }, [cardsPerRowBase, gridWidth, mode]);

  const native = Capacitor.isNativePlatform();
  const hrefFor = (album) => buildTitleHubHref({
    base,
    native,
    titleRef: album.titleRef,
    anilistId: album.anilistId,
    title: album.displayTitle,
  });
  const changeMode = (nextMode) => {
    setMode(nextMode);
    writeTitleCollectionViewPreference(nextMode);
  };
  const changeSort = (nextSort) => {
    setSort(nextSort);
    setSortDir(nextSort === "TITLE" || nextSort === "GENRE" ? "asc" : "desc");
  };
  const clearGenres = () => setGenres([]);
  const toggleGenre = (genre) => setGenres((current) => {
    const next = new Set(current);
    if (next.has(genre)) next.delete(genre);
    else next.add(genre);
    return [...next];
  });
  const pickGenreFromTag = (genre, event) => {
    const keepSelection = Boolean(event?.shiftKey || event?.metaKey || event?.ctrlKey);
    if (keepSelection) toggleGenre(genre);
    else setGenres((current) => current.length === 1 && current[0] === genre ? [] : [genre]);
  };

  const filterOptions = [
    { value: "ALL", label: copy.filters.ALL },
    { value: "SAVED", label: copy.filters.SAVED },
    { value: "HAS_MEMORY", label: copy.filters.HAS_MEMORY },
    { value: "WATCHING", label: copy.filters.WATCHING },
    { value: "COMPLETED", label: copy.filters.COMPLETED },
    { value: "ON_HOLD", label: copy.filters.ON_HOLD },
    { value: "DROPPED", label: copy.filters.DROPPED },
    { value: "UNSORTED", label: copy.filters.UNSORTED },
  ];
  const sortOptions = [
    { value: "RECENT_MEMORY", label: copy.sorts.RECENT_MEMORY },
    { value: "RECENT_SAVED", label: copy.sorts.RECENT_SAVED },
    { value: "TITLE", label: copy.sorts.TITLE },
    { value: "SCORE", label: copy.sorts.SCORE },
    { value: "YEAR", label: copy.sorts.YEAR },
    { value: "GENRE", label: copy.sorts.GENRE },
  ];
  const viewOptions = [
    { value: "MEMORY", label: copy.memoryView },
    { value: "POSTER", label: copy.posterView },
  ];

  if (status === "loading") return <div className="title-collection"><p className="title-collection__state">{copy.loading}</p></div>;
  if (status === "error") return <div className="title-collection"><p className="title-collection__state" role="alert">{copy.loadFailed}</p></div>;

  return (
    <div className="title-collection">
      <header className="title-collection__header">
        <h1 className="pageTitle">{copy.title}</h1>
        <span className="title-collection__count">{copy.count(albums.length)}</span>
      </header>

      {albums.length ? (
        <>
          <LibraryFiltersPanel
            locale={locale}
            filteredCount={visibleAlbums.length}
            open={filterPanelOpen}
            onToggle={() => setFilterPanelOpen((current) => !current)}
            sortKey={sort}
            onSortKeyChange={changeSort}
            status={filter}
            onStatusChange={setFilter}
            groupByStatus={false}
            onGroupByStatusChange={() => {}}
            sortDir={sortDir}
            onToggleSortDir={() => setSortDir((current) => current === "asc" ? "desc" : "asc")}
            query={query}
            onQueryChange={setQuery}
            cardView={mode}
            onCardViewChange={changeMode}
            genreSet={new Set(genres)}
            genreOptions={genreOptions}
            onClearGenres={clearGenres}
            onToggleGenre={toggleGenre}
            cardsPerRowBase={cardsPerRowBase}
            onCardsPerRowBaseChange={setCardsPerRowBase}
            effectiveCols={effectiveCols}
            formatGenreLabel={(genre) => formatGenreLabel(genre, locale)}
            sortOptions={sortOptions}
            statusOptions={filterOptions}
            viewOptions={viewOptions}
            viewLabel={copy.viewLabel}
            showGroupByStatus={false}
            showStatusSelect={false}
            searchPlaceholder={copy.searchPlaceholder}
            searchAriaLabel={copy.searchLabel}
            controlsId="title-collection-filter-panel-content"
          />

          {hasVisibleAlbums ? (
            <section
              ref={gridRef}
              className={`grid library-grid title-collection__grid ${mode === "MEMORY" ? "title-collection__memory-grid" : "library-grid--poster title-collection__poster-grid"}`}
              style={{ gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))` }}
              aria-label={copy.count(visibleAlbums.length)}
            >
              {visibleAlbums.map((album) => mode === "MEMORY" ? (
                <TitleAlbumCard
                  key={album.key}
                  album={album}
                  href={hrefFor(album)}
                  base={base}
                  native={native}
                  copy={copy}
                  titleKey={album.key}
                  formatGenre={(genre) => formatGenreLabel(genre, locale)}
                  onPickGenre={pickGenreFromTag}
                />
              ) : (
                <TitlePosterTile key={album.key} album={album} href={hrefFor(album)} copy={copy} titleKey={album.key} />
              ))}
            </section>
          ) : (
            <section className="surface-card title-collection__empty">
              <h2>{copy.noFilteredTitle}</h2>
              <p>{copy.noFilteredBody}</p>
            </section>
          )}
        </>
      ) : (
        <section className="surface-card title-collection__empty">
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
          <a className="btn" href={`${base}memory/new/`} data-astro-reload>{copy.emptyAction}</a>
        </section>
      )}
    </div>
  );
}
