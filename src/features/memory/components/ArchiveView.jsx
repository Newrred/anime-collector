import { filterArchive } from "../application/archiveSearch.js";
import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import MemoryCardPreview from "./MemoryCardPreview.jsx";
import MemoryRouteShell, { useMemoryRouteUi } from "./MemoryRouteShell.jsx";
import FirstMemoryViewSuggestion from "../../titles/components/FirstMemoryViewSuggestion.jsx";
import { consumeFirstMemoryViewSuggestion } from "../../titles/application/firstMemoryViewSuggestion.js";
import "./archive-view.css";

const formatArchiveDate = (value, locale) => {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp));
};

const toArchiveVisual = ({ asset, previewDataUrl, catalogCover, title, archiveCopy }) => {
  if (asset.designSpec) return { kind: "SYSTEM_DESIGN", designSpec: asset.designSpec };
  if (asset.imageType === "CATALOG_COVER" && catalogCover?.publicUrl) {
    return { kind: "IMAGE", src: catalogCover.publicUrl, alt: archiveCopy.cardAlt(title.displayTitle) };
  }
  if (previewDataUrl) {
    return {
      kind: "IMAGE",
      src: previewDataUrl,
      alt: archiveCopy.cardAlt(title.displayTitle),
    };
  }
  return { kind: "MISSING" };
};

const syncLabel = (entity, copy) => copy.syncStates?.[entity?.sync?.syncState] || "";

export default function ArchiveView({ base = "/" }) {
  return (
    <MemoryRouteShell base={base} currentRoute="archive">
      <ArchiveContent base={base} />
    </MemoryRouteShell>
  );
}

function ArchiveContent({ base }) {
  const { locale, copy } = useMemoryRouteUi();
  const archiveCopy = copy.archive;
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState(() => new URLSearchParams(globalThis.location?.search || "").get("q") || "");
  const [sort, setSort] = useState(() => new URLSearchParams(globalThis.location?.search || "").get("sort") || "created");
  const updateFilter = (nextQuery, nextSort) => {
    setQuery(nextQuery); setSort(nextSort);
    const url = new URL(window.location.href);
    if (nextQuery) url.searchParams.set("q", nextQuery); else url.searchParams.delete("q");
    if (nextSort !== "created") url.searchParams.set("sort", nextSort); else url.searchParams.delete("sort");
    window.history.replaceState(null, "", url);
  };
  const filtered = filterArchive(items, query, sort);
  const [status, setStatus] = useState("loading");
  const [showViewSuggestion, setShowViewSuggestion] = useState(false);

  useEffect(() => {
    let active = true;
    getPlatformMemoryRuntime().then(async (runtime) => {
      await runtime.initialize();
      const archive = await runtime.listArchive();
      const withPreviews = await Promise.all(archive.filter(Boolean).map(async (item) => ({
        ...item,
        previewDataUrl: item.asset.localRef
          ? await runtime.getPreview(item.asset.localRef).catch(() => null)
          : null,
        catalogCover: item.asset.catalogCoverRef
          ? await runtime.resolveCatalogCover(item.asset.catalogCoverRef).catch(() => null)
          : null,
      })));
      if (!active) return;
      setItems(withPreviews);
      setShowViewSuggestion(consumeFirstMemoryViewSuggestion(archive));
      setStatus("ready");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="memory-archive page-shell page-shell--wide">
      <header className="memory-archive__header">
        <div className="pageHeader">
          <h1 className="pageTitle">{archiveCopy.title}</h1>
          {status === "ready" && items.length > 0 && (
            <p className="memory-archive__summary">{archiveCopy.count(items.length)}</p>
          )}
        </div>
        <a className="btn" href={`${base}memory/new/`} data-astro-reload>{archiveCopy.create}</a>
      </header>

      {status === "loading" && (
        <p className="surface-card memory-archive__state" role="status">{archiveCopy.loading}</p>
      )}
      {status === "error" && (
        <p className="surface-card memory-archive__state" role="alert">
          {archiveCopy.error}
          <button type="button" className="btn btn--subtle" onClick={() => window.location.reload()}>{locale === "ko" ? "다시 시도" : "Try again"}</button>
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <section className="surface-card memory-archive__state">
          <h2>{archiveCopy.emptyTitle}</h2>
          <p>{archiveCopy.emptyBody}</p>
        </section>
      )}

      {showViewSuggestion && (
        <FirstMemoryViewSuggestion base={base} copy={copy.firstMemoryView} onDismiss={() => setShowViewSuggestion(false)} />
      )}

      {status === "ready" && items.length >= 3 && (
        <section className="surface-card memory-archive__board-suggestion">
          <div>
            <h2>{archiveCopy.boardSuggestionTitle}</h2>
            <p>{archiveCopy.boardSuggestionBody}</p>
          </div>
          <a className="btn btn--subtle" href={`${base}boards/`}>{archiveCopy.boardSuggestionAction}</a>
        </section>
      )}

      {items.length > 0 ? <ArchiveFilters query={query} sort={sort} updateFilter={updateFilter} locale={locale} empty={filtered.length === 0} /> : null}
      {items.length > 0 && (
        <section className="memory-archive__grid" aria-label={archiveCopy.listLabel}>
          {filtered.map(({ card, title, asset, previewDataUrl, catalogCover }) => (
            <MemoryCardPreview
              key={card.id}
              className="surface-card memory-archive__card"
              href={`${base}memory/card/?id=${encodeURIComponent(card.id)}`}
              title={title.displayTitle}
              cue={card.note || ""}
              dateLabel={formatArchiveDate(sort === "updated" ? card.updatedAt : card.createdAt, locale)}
              badge={asset.imageType === "CATALOG_COVER"
                ? archiveCopy.catalogCover
                : asset.designSpec ? archiveCopy.systemDesign : archiveCopy.privateImage}
              syncBadge={syncLabel(card, archiveCopy)}
              visual={toArchiveVisual({ asset, previewDataUrl, catalogCover, title, archiveCopy })}
              visualFit={asset.imageType === "CATALOG_COVER" ? "contain" : "cover"}
              variant="grid"
              systemCopy={{
                label: copy.systemDesign.label,
                fallbackTitle: title.displayTitle,
                footer: copy.systemDesign.footer,
              }}
              missingLabel={asset.imageType === "CATALOG_COVER"
                ? archiveCopy.coverUnavailable
                : !asset.designSpec && !asset.localRef
                  ? archiveCopy.unavailableOnDevice
                  : archiveCopy.missingImage}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function ArchiveFilters({ query, sort, updateFilter, locale, empty }) {
  return (<div className="memory-archive__filters action-row">
        <label>{locale === "ko" ? "기억 찾기" : "Find memories"}<input type="search" value={query} placeholder={locale === "ko" ? "작품명 또는 감상" : "Title or reflection"} onChange={(e) => updateFilter(e.target.value, sort)} /></label>
        <label>{locale === "ko" ? "정렬" : "Sort"}<select aria-label={locale === "ko" ? "정렬" : "Sort"} value={sort} onChange={(e) => updateFilter(query, e.target.value)}><option value="created">{locale === "ko" ? "최근 작성순" : "Recently created"}</option><option value="updated">{locale === "ko" ? "최근 수정순" : "Recently edited"}</option></select></label>
        {empty ? <p role="status">{locale === "ko" ? "검색 결과가 없어요." : "No memories match."} <button className="btn btn--subtle" onClick={() => updateFilter("", "created")}>{locale === "ko" ? "검색 초기화" : "Reset search"}</button></p> : null}
      </div>);
}
