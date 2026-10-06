import { filterArchive } from "../application/archiveSearch.js";
import { useEffect, useRef, useState } from "react";
import { readAllWatchLogsPreferred } from "../../../repositories/watchLogRepo.js";
import { formatAffinityLabel, formatReasonTagLabel } from "../../../components/library/libraryCopy.js";
import { archiveFacetOptions, matchesArchiveFacets } from "../application/archiveFacets.js";
import ChannelHeader, { ChannelFacts, ChannelSection, TextChoices } from "../../../components/collection/ChannelHeader.jsx";
import CollectionSelect from "../../../components/collection/CollectionSelect.jsx";
import { useCollectionMasonry } from "../../../components/collection/useCollectionMasonry.js";
import { getPlatformMemoryRuntime } from "../runtime/platformMemoryRuntime.js";
import PrivateMemoryCardPreview from "./PrivateMemoryCardPreview.jsx";
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
  const [runtime, setRuntime] = useState(null);
  const [logs, setLogs] = useState([]), [logsFailed, setLogsFailed] = useState(false);
  const [facets, setFacets] = useState(() => { const p = new URLSearchParams(globalThis.location?.search); return { tag: p.get("tag") || "", character: p.get("character") || "", affinity: p.get("affinity") || "", memoryTag: p.get("memoryTag") || "", memoryCharacter: p.get("memoryCharacter") || "" }; });
  const [view, setView] = useState(() => new URLSearchParams(globalThis.location?.search).get("view") === "table" ? "table" : "grid");
  const grid = useRef(null);
  const [query, setQuery] = useState(() => new URLSearchParams(globalThis.location?.search || "").get("q") || "");
  const [sort, setSort] = useState(() => new URLSearchParams(globalThis.location?.search || "").get("sort") || "created");
  const updateFilter = (nextQuery, nextSort) => {
    setQuery(nextQuery); setSort(nextSort);
    const url = new URL(window.location.href);
    if (nextQuery) url.searchParams.set("q", nextQuery); else url.searchParams.delete("q");
    if (nextSort !== "created") url.searchParams.set("sort", nextSort); else url.searchParams.delete("sort");
    window.history.replaceState(null, "", url);
  };
  const filtered = filterArchive(items, query, sort).filter(item => matchesArchiveFacets(item, logs, facets));
  const options = archiveFacetOptions(items, logs);
  const changeFacet = (key, value) => {
    const next = { ...facets, [key]: facets[key] === value ? "" : value }; setFacets(next);
    const url = new URL(location.href); for (const [k, v] of Object.entries(next)) { if (v) url.searchParams.set(k, v); else url.searchParams.delete(k); } history.replaceState(null, "", url);
  };
  const clearFacets = () => { setFacets({ tag: "", character: "", affinity: "", memoryTag: "", memoryCharacter: "" }); const url = new URL(location.href); for (const key of ["tag", "character", "affinity", "memoryTag", "memoryCharacter"]) url.searchParams.delete(key); history.replaceState(null, "", url); };
  useCollectionMasonry(grid, `${view}:${filtered.map(item => item.card.id).join(",")}`);
  const [status, setStatus] = useState("loading");
  const [showViewSuggestion, setShowViewSuggestion] = useState(false);

  useEffect(() => {
    let active = true;
    readAllWatchLogsPreferred().then(rows => active && setLogs(rows)).catch(() => active && setLogsFailed(true));
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
      setRuntime(runtime);
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
      <ChannelHeader base={base} title={archiveCopy.title} locale={locale} extended sections={<>
        <ChannelSection title={locale === "ko" ? "정보" : "Info"}><p>{locale === "ko" ? "작품마다 남겨 둔 장면과 짧은 감상." : "Scenes and reflections from your titles."}</p><ChannelFacts rows={[[locale === "ko" ? "기억" : "Memories", items.length], [locale === "ko" ? "작품" : "Titles", new Set(items.map(item => item.title.id)).size]]} /></ChannelSection>
        <ChannelSection title={locale === "ko" ? "찾아보기" : "Browse"}><label className="channel-search">{locale === "ko" ? "기억 찾기" : "Find memories"}<input type="search" value={query} placeholder={locale === "ko" ? "작품명 또는 감상" : "Title or reflection"} onChange={e => updateFilter(e.target.value, sort)} /></label><p role="status">{archiveCopy.count(filtered.length)}</p><button className="channel-text-button" onClick={() => { updateFilter("", "created"); clearFacets(); }}>{locale === "ko" ? "검색 초기화" : "Reset search"}</button></ChannelSection>
        <ChannelSection title={locale === "ko" ? "보기" : "View"}><TextChoices label={locale === "ko" ? "기억 보기" : "Memory view"} options={[{ value: "grid", label: locale === "ko" ? "그리드" : "Grid" }, { value: "table", label: locale === "ko" ? "표" : "Table" }]} value={view} onChange={value => { setView(value); const url = new URL(location.href); url.searchParams.set("view", value); history.replaceState(null, "", url); }} /><div className="channel-sort"><span>{locale === "ko" ? "정렬" : "Sort"}</span><CollectionSelect label={locale === "ko" ? "정렬" : "Sort"} value={sort} onChange={value => updateFilter(query, value)} options={[{ value: "created", label: locale === "ko" ? "최근 작성순" : "Recently created" }, { value: "updated", label: locale === "ko" ? "최근 수정순" : "Recently edited" }]} /></div></ChannelSection>
        <ChannelSection title={locale === "ko" ? "태그" : "Tags"}>
          <TextChoices label={locale === "ko" ? "카드 태그" : "Memory tags"} options={options.memoryTags.map(value => ({ value, label: `#${value}` }))} value={facets.memoryTag} onChange={value => changeFacet("memoryTag", value)} />
          {!options.memoryTags.length && <p className="channel-hint">{locale === "ko" ? "기억 상세에서 태그를 추가해 보세요." : "Add tags in a memory's detail."}</p>}
          <p className="channel-hint">{locale === "ko" ? "작품 감상 기록 기준" : "Based on title watch logs"}</p>
          <TextChoices label={locale === "ko" ? "포인트 태그" : "Point tags"} options={options.tags.map(value => ({ value, label: formatReasonTagLabel(value, locale) }))} value={facets.tag} onChange={value => changeFacet("tag", value)} />
          <button className="channel-text-button" onClick={clearFacets}>{locale === "ko" ? "전체 보기 ↗" : "Show all ↗"}</button>
        </ChannelSection>
        <ChannelSection title={locale === "ko" ? "캐릭터" : "Characters"}>
          <TextChoices label={locale === "ko" ? "기억의 캐릭터" : "Memory characters"} options={options.memoryCharacters} value={facets.memoryCharacter} onChange={value => changeFacet("memoryCharacter", value)} />
          {!options.memoryCharacters.length && <p className="channel-hint">{locale === "ko" ? "기억마다 캐릭터를 선택해 보세요." : "Choose characters for individual memories."}</p>}
          <p className="channel-hint">{locale === "ko" ? "작품 감상 기록 기준" : "Based on title watch logs"}</p>
          <TextChoices label={locale === "ko" ? "캐릭터" : "Characters"} options={options.characters} value={facets.character} onChange={value => changeFacet("character", value)} />
          <TextChoices label={locale === "ko" ? "캐릭터 감정" : "Character affinity"} options={options.affinities.map(value => ({ value, label: formatAffinityLabel(value, locale) }))} value={facets.affinity} onChange={value => changeFacet("affinity", value)} />
          {logsFailed && <p className="channel-hint">{locale === "ko" ? "감상 기록을 불러오지 못했어요." : "Watch logs unavailable."}</p>}
        </ChannelSection>
      </>} />

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

      {items.length > 0 && !filtered.length ? <p role="status">{locale === "ko" ? "검색 결과가 없어요." : "No memories match."}</p> : null}
      {items.length > 0 && view === "table" ? <table className="channel-table"><thead><tr><th>{locale === "ko" ? "작품 · 감상" : "Title · reflection"}</th><th>{locale === "ko" ? "기록일" : "Date"}</th></tr></thead><tbody>{filtered.map(item => <tr key={item.card.id}><td><a href={`${base}memory/card/?id=${encodeURIComponent(item.card.id)}`}>{item.title.displayTitle}</a><p>{item.card.note}</p></td><td>{formatArchiveDate(item.card.createdAt, locale)}</td></tr>)}</tbody></table> : null}
      {items.length > 0 && view === "grid" && (
        <section ref={grid} className="memory-archive__grid channel-masonry" aria-label={archiveCopy.listLabel}>
          {filtered.map(({ card, title, asset, previewDataUrl, catalogCover }) => (
            <PrivateMemoryCardPreview locale={locale}
              runtime={runtime} bundle={{ card, title, asset }}
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
              visualFit="contain"
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
      {status === "ready" && items.length >= 3 && (
        <section className="memory-archive__board-suggestion">
          <div><h2>{archiveCopy.boardSuggestionTitle}</h2><p>{archiveCopy.boardSuggestionBody}</p></div>
          <a className="btn btn--subtle" href={`${base}boards/`}>{archiveCopy.boardSuggestionAction}</a>
        </section>
      )}
    </div>
  );
}
