import { useEffect, useMemo, useRef, useState } from "react";
import MemoryRouteShell, { useMemoryRouteUi } from "../memory/components/MemoryRouteShell.jsx";
import { createTitleCollectionService } from "../titles/application/titleCollectionService.js";
import { buildTitleHubHref } from "../titles/domain/titleNavigation.js";
import TitlePosterTile from "../titles/components/TitlePosterTile.jsx";
import TitleAlbumCard from "../titles/components/TitleAlbumCard.jsx";
import ChannelHeader, { ChannelFacts, ChannelSection, TextChoices } from "../../components/collection/ChannelHeader.jsx";
import { readBookshelf, saveBookshelf } from "./bookshelfSettings.js";
import BookshelfEditor from "./BookshelfEditor.jsx";

export default function BookshelfView({ base = "/" }) {
  return <MemoryRouteShell base={base} currentRoute="home"><BookshelfContent base={base} /></MemoryRouteShell>;
}
function BookshelfContent({ base }) {
  const { locale, copy, ownerKey } = useMemoryRouteUi(), ko = locale === "ko";
  const service = useMemo(() => createTitleCollectionService(), []);
  const [albums, setAlbums] = useState([]), [status, setStatus] = useState("loading");
  const [settings, setSettings] = useState(() => readBookshelf(ownerKey)), [draft, setDraft] = useState(null);
  const [shelf, setShelf] = useState("all"), [selected, setSelected] = useState(""), [query, setQuery] = useState(""), [view, setView] = useState("grid"), [message, setMessage] = useState("");
  const grid = useRef(null);
  const closeSelection = () => {
    grid.current?.querySelector('.bookshelf-cover-trigger[aria-expanded="true"]')?.focus();
    setSelected("");
  };
  useEffect(() => {
    if (!selected) return;
    grid.current?.querySelector('.is-expanded .bookshelf-cover-area')?.scrollIntoView({ block: "nearest" });
    const escape = event => { if (event.key === "Escape") { event.preventDefault(); closeSelection(); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [selected]);
  useEffect(() => {
    let active = true, revision = 0;
    const refresh = () => {
      const request = ++revision;
      service.load().then(rows => {
        if (!active || request !== revision) return;
        setAlbums(rows); setStatus("ready");
      }).catch(() => active && request === revision && setStatus("error"));
    };
    refresh(); window.addEventListener("moemoa:library-updated", refresh);
    return () => { active = false; window.removeEventListener("moemoa:library-updated", refresh); };
  }, [service]);
  const model = draft || settings;
  const ids = new Set(model.shelves.filter(row => shelf === "all" || row.id === shelf).flatMap(row => row.titleKeys));
  const visible = albums.filter(album => ids.has(album.key) && album.displayTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const hrefFor = album => buildTitleHubHref({ base, titleRef: album.titleRef, anilistId: album.anilistId, title: album.displayTitle });
  const changeShelf = id => { setShelf(id); setSelected(""); };
  return <div className="bookshelf-page channel-page">
    <ChannelHeader base={base} locale={locale} title={ko ? "컬렉션" : "Collection"} trail={shelf === "all" ? "" : model.shelves.find(row => row.id === shelf)?.name}
      actions={<button className="btn btn--subtle" disabled={status !== "ready" || Boolean(draft)} onClick={() => { setMessage(""); setSelected(""); setDraft(structuredClone(settings)); }}>{ko ? "컬렉션 편집" : "Edit collection"}</button>}
      sections={<><ChannelSection title={ko ? "정보" : "Info"}><p>{ko ? "다시 꺼내 보고 싶은 작품과 장면들." : "Titles and moments to revisit."}</p><ChannelFacts rows={[[ko ? "진열한 작품" : "Displayed titles", albums.filter(a => ids.has(a.key)).length], [ko ? "기억" : "Memories", albums.filter(a => ids.has(a.key)).reduce((n, a) => n + a.memoryCount, 0)]]} /><p className="channel-hint">{ko ? "선반 설정은 이 기기에 저장됩니다." : "Shelf settings are saved on this device."}</p></ChannelSection>
        <ChannelSection title={ko ? "선반" : "Shelves"}><TextChoices label={ko ? "선반 선택" : "Choose shelf"} options={[{ value: "all", label: ko ? "전체" : "All" }, ...model.shelves.map(row => ({ value: row.id, label: row.name }))]} value={shelf} onChange={changeShelf} /><label className="channel-search">{ko ? "컬렉션 검색" : "Search collection"}<input type="search" value={query} placeholder={ko ? "작품명으로 찾기" : "Find a title"} onChange={e => { setQuery(e.target.value); setSelected(""); }} /></label></ChannelSection>
        <ChannelSection title={ko ? "보기" : "View"}><TextChoices label={ko ? "컬렉션 보기" : "Collection view"} options={[{ value: "grid", label: ko ? "그리드" : "Grid" }, { value: "table", label: ko ? "표" : "Table" }]} value={view} onChange={next => { setView(next); setSelected(""); }} /><p className="channel-hint">{ko ? "표지 선택 → 기억 펼치기\n작품 이름 → 작품 상세" : "Select a cover for memories; a title for details."}</p><a href={`${base}boards/`}>{ko ? "보드 모아보기 →" : "Browse Boards →"}</a></ChannelSection></>} />
    {status === "loading" ? <p role="status">{copy.titles.loading}</p> : status === "error" ? <p role="alert">{copy.titles.loadFailed}</p> : null}
    {draft && <BookshelfEditor draft={draft} setDraft={setDraft} albums={albums} copy={copy.titles} locale={locale}
      onCancel={() => { setDraft(null); setShelf("all"); setMessage(""); }}
      onApply={() => { try { const saved = saveBookshelf(ownerKey, draft); setSettings(saved); setDraft(null); setShelf("all"); setSelected(""); setMessage(ko ? "컬렉션에 적용했어요." : "Collection saved."); } catch { setMessage(ko ? "저장하지 못했어요. 저장 공간을 확인해 주세요." : "Could not save. Check browser storage."); } }} />}
    {message ? <p role="status">{message}</p> : null}
    {status === "ready" && !draft && !visible.length ? <section className="channel-empty"><h2>{query ? (ko ? "검색 결과가 없어요." : "No results.") : (ko ? "아직 진열한 작품이 없어요." : "Your shelves are empty.")}</h2><p>{ko ? "컬렉션 편집에서 작품을 골라 주세요." : "Choose titles in Edit collection."}</p><a href={`${base}titles/`}>{ko ? "내 작품 보기 →" : "My titles →"}</a></section> : null}
    {!draft && view === "table" ? <table className="channel-table"><thead><tr><th>{ko ? "작품" : "Title"}</th><th>{ko ? "기억" : "Memories"}</th></tr></thead><tbody>{visible.map(a => <tr key={a.key}><td><a href={hrefFor(a)}>{a.displayTitle}</a></td><td>{a.memoryCount}</td></tr>)}</tbody></table> : null}
    {!draft && view !== "table" ? <section ref={grid} className="bookshelf-grid" aria-label={ko ? "진열한 작품" : "Displayed titles"}>{visible.map(album => <div key={album.key} className={`bookshelf-tile ${album.previewMemories.length ? "has-memories" : ""} ${selected === album.key ? "is-expanded" : ""}`}>
      <div className="bookshelf-cover-area">
        <button className="bookshelf-cover-trigger" aria-label={`${album.displayTitle} ${ko ? "기억 펼치기" : "open memories"}`} aria-expanded={selected === album.key} aria-controls={`collection-memories-${album.key}`} onClick={() => selected === album.key ? closeSelection() : setSelected(album.key)}><span>{selected === album.key ? (ko ? "접기 ×" : "Close ×") : (ko ? "기억 보기 ↗" : "Memories ↗")}</span></button>
        <TitlePosterTile album={album} href={hrefFor(album)} copy={copy.titles} titleKey={album.key} locale={locale} />
      </div>
      {selected === album.key ? <div id={`collection-memories-${album.key}`} className="bookshelf-film collection-memory-fan" role="region" aria-label={`${album.displayTitle} · ${copy.titles.memoryCount(album.memoryCount)}`}><button className="film-close btn btn--subtle" onClick={closeSelection}>{ko ? "접기 ×" : "Close ×"}</button><TitleAlbumCard album={album} href={hrefFor(album)} base={base} copy={copy.titles} locale={locale} titleKey={album.key} formatGenre={v => v} />{album.memoryCount > 0 ? <a className="bookshelf-film-more" href={hrefFor(album)}>{ko ? `기억 ${album.memoryCount}개 모두 보기 →` : `View all ${album.memoryCount} memories →`}</a> : null}</div> : null}
    </div>)}</section> : null}
  </div>;
}
