import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";

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
import TitleViewModeControl from "./TitleViewModeControl.jsx";
import ChannelHeader, { ChannelFacts, ChannelSection, TextChoices } from "../../../components/collection/ChannelHeader.jsx";
import CollectionSelect from "../../../components/collection/CollectionSelect.jsx";
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

  const [cardsPerRowBase, setCardsPerRowBase] = useStoredState(STORAGE_KEYS.cardsPerRowBase, 4);
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
    const baseColumns = clamp(Number(cardsPerRowBase) || 4, 2, 10);
    if (!Number.isFinite(gridWidth) || gridWidth <= 0) return baseColumns;
    const scaled = Math.round(baseColumns * (gridWidth / 1310));
    const posterMode = mode === "POSTER";
    const minColumns = posterMode && gridWidth >= 320 ? 2 : 1;
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


  if (status === "loading") return <div className="title-collection"><p className="title-collection__state">{copy.loading}</p></div>;
  if (status === "error") return <div className="title-collection"><p className="title-collection__state" role="alert">{copy.loadFailed}</p></div>;

  return (
    <div className="title-collection">
      <ChannelHeader base={base} title={copy.title} locale={locale} sections={<>
        <ChannelSection title={locale === "ko" ? "정보" : "Info"}><p>{locale === "ko" ? "저장한 작품과 기억을 남긴 작품을 한곳에." : "Saved titles and titles with memories, together."}</p><ChannelFacts rows={[[locale === "ko" ? "전체 작품" : "All titles", albums.length], [copy.saved, albums.filter(a => a.tracking.isSaved).length], [copy.filters.HAS_MEMORY, albums.filter(a => a.memoryCount).length]]} /></ChannelSection>
        <ChannelSection title={locale === "ko" ? "찾아보기" : "Browse"}><label className="channel-search"><span className="sr-only">{copy.searchLabel}</span><input type="search" value={query} placeholder={copy.searchPlaceholder} onChange={e => setQuery(e.target.value)} /></label><TextChoices label={locale === "ko" ? "작품 필터" : "Title filters"} options={filterOptions} value={filter} onChange={setFilter} /><p role="status">{copy.count(visibleAlbums.length)}</p></ChannelSection>
        <ChannelSection title={locale === "ko" ? "보기" : "View"}><TitleViewModeControl mode={mode} copy={copy} onChange={changeMode} /><div className="channel-sort"><span>{locale === "ko" ? "정렬" : "Sort"}</span><CollectionSelect label={locale === "ko" ? "작품 정렬" : "Title sort"} value={sort} onChange={changeSort} options={sortOptions} /></div></ChannelSection>
      </>} />

      {albums.length ? (
        <>
          <details className="channel-advanced"><summary aria-controls="title-collection-filter-panel-content">{locale === "ko" ? "장르·열 수와 추가 탐색" : "Genres, columns and more controls"}</summary>
            <div id="title-collection-filter-panel-content" className="channel-advanced-controls">
              <section><h2>{locale === "ko" ? "장르" : "Genres"}</h2><div className="channel-choices"><button aria-pressed={!genres.length} onClick={clearGenres}>{locale === "ko" ? "전체" : "All"}</button>{genreOptions.map(genre => <button key={genre} aria-pressed={genres.includes(genre)} onClick={() => toggleGenre(genre)}>{formatGenreLabel(genre, locale)}</button>)}</div></section>
              <label>{locale === "ko" ? "표지 열 수" : "Poster columns"}<input type="range" min="2" max="10" step="1" value={cardsPerRowBase} onChange={e => setCardsPerRowBase(Number(e.target.value))} /><span>{locale === "ko" ? "기준 " + cardsPerRowBase + " · 현재 " + effectiveCols + "열" : "Base " + cardsPerRowBase + " · Current " + effectiveCols + " columns"}</span></label>
              <button className="btn btn--subtle" onClick={() => setSortDir(value => value === "asc" ? "desc" : "asc")}>{locale === "ko" ? (sortDir === "asc" ? "오름차순 ↑" : "내림차순 ↓") : (sortDir === "asc" ? "Ascending ↑" : "Descending ↓")}</button>
            </div>
          </details>

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
                  locale={locale}
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
