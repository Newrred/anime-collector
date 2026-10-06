import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import MemoryRouteShell, { useMemoryRouteUi } from "../memory/components/MemoryRouteShell.jsx";
import { createTitleCollectionService } from "../titles/application/titleCollectionService.js";
import { buildTitleHubHref } from "../titles/domain/titleNavigation.js";
import TitlePosterTile from "../titles/components/TitlePosterTile.jsx";
import TitleAlbumCard from "../titles/components/TitleAlbumCard.jsx";
import ChannelHeader, { ChannelFacts, ChannelSection, TextChoices } from "../../components/collection/ChannelHeader.jsx";
import { readBookshelf, saveBookshelf } from "./bookshelfSettings.js";

export default function BookshelfView({ base = "/" }) {
  return <MemoryRouteShell base={base} currentRoute="home"><BookshelfContent base={base} /></MemoryRouteShell>;
}
function BookshelfContent({ base }) {
  const { locale, copy, ownerKey } = useMemoryRouteUi(), ko = locale === "ko";
  const service = useMemo(() => createTitleCollectionService(), []);
  const [albums, setAlbums] = useState([]), [status, setStatus] = useState("loading");
  const [settings, setSettings] = useState(() => readBookshelf(ownerKey)), [draft, setDraft] = useState(null);
  const [shelf, setShelf] = useState("all"), [selected, setSelected] = useState(""), [query, setQuery] = useState(""), [view, setView] = useState("grid"), [message, setMessage] = useState("");
  const grid = useRef(null), [columns, setColumns] = useState(4);
  useEffect(() => {
    const update = () => { if (grid.current) setColumns(Number.parseInt(getComputedStyle(grid.current).getPropertyValue("--channel-columns"), 10) || 4); };
    update(); window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [view, draft, status]);
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
  const active = visible.find(album => album.key === selected);
  const selectedRow = active ? Math.floor(visible.indexOf(active) / columns) : -1;
  const hrefFor = album => buildTitleHubHref({ base, titleRef: album.titleRef, anilistId: album.anilistId, title: album.displayTitle });
  const changeShelf = id => { setShelf(id); setSelected(""); };
  const editShelf = (id, patch) => setDraft(current => ({ shelves: current.shelves.map(row => row.id === id ? { ...row, ...patch } : row) }));
  return <div className="bookshelf-page channel-page">
    <ChannelHeader base={base} locale={locale} title={ko ? "내 책장" : "My bookshelf"} trail={shelf === "all" ? "" : model.shelves.find(row => row.id === shelf)?.name}
      actions={<button className="btn btn--subtle" disabled={status !== "ready" || Boolean(draft)} onClick={() => { setMessage(""); setDraft(structuredClone(settings)); }}>{ko ? "책장 꾸미기" : "Edit bookshelf"}</button>}
      sections={<><ChannelSection title={ko ? "정보" : "Info"}><p>{ko ? "다시 꺼내 보고 싶은 작품과 장면들." : "Titles and moments to revisit."}</p><ChannelFacts rows={[[ko ? "진열한 작품" : "Displayed titles", albums.filter(a => ids.has(a.key)).length], [ko ? "기억" : "Memories", albums.filter(a => ids.has(a.key)).reduce((n, a) => n + a.memoryCount, 0)]]} /><p className="channel-hint">{ko ? "선반 설정은 이 기기에 저장됩니다." : "Shelf settings are saved on this device."}</p></ChannelSection>
        <ChannelSection title={ko ? "선반" : "Shelves"}><TextChoices label={ko ? "선반 선택" : "Choose shelf"} options={[{ value: "all", label: ko ? "전체" : "All" }, ...model.shelves.map(row => ({ value: row.id, label: row.name }))]} value={shelf} onChange={changeShelf} /><label className="channel-search">{ko ? "책장 검색" : "Search bookshelf"}<input type="search" value={query} placeholder={ko ? "작품명으로 찾기" : "Find a title"} onChange={e => { setQuery(e.target.value); setSelected(""); }} /></label></ChannelSection>
        <ChannelSection title={ko ? "보기" : "View"}><TextChoices label={ko ? "책장 보기" : "Bookshelf view"} options={[{ value: "grid", label: ko ? "그리드" : "Grid" }, { value: "table", label: ko ? "표" : "Table" }]} value={view} onChange={setView} /><p className="channel-hint">{ko ? "표지 선택 → 기억 필름\n작품 이름 → 작품 상세" : "Select a cover for memories; a title for details."}</p><a href={`${base}boards/`}>{ko ? "보드 모아보기 →" : "Browse Boards →"}</a></ChannelSection></>} />
    {status === "loading" ? <p role="status">{copy.titles.loading}</p> : status === "error" ? <p role="alert">{copy.titles.loadFailed}</p> : null}
    {draft && <section className="bookshelf-editor" aria-label={ko ? "책장 편집" : "Bookshelf editor"}>
      <p>{ko ? "선반을 만들고 진열할 작품을 골라 주세요." : "Create shelves and choose titles to display."}</p>
      {draft.shelves.map(row => <fieldset key={row.id}><legend>{row.name}</legend><label>{ko ? "선반 이름" : "Shelf name"}<input maxLength={80} value={row.name} onChange={e => editShelf(row.id, { name: e.target.value })} /></label>
        <div className="bookshelf-picker">{albums.map(a => <label key={a.key}><input type="checkbox" checked={row.titleKeys.includes(a.key)} onChange={e => editShelf(row.id, { titleKeys: e.target.checked ? [...row.titleKeys, a.key] : row.titleKeys.filter(key => key !== a.key) })} />{a.displayTitle}</label>)}</div>
        <button className="btn btn--subtle" onClick={() => setDraft(current => ({ shelves: current.shelves.filter(s => s.id !== row.id) }))}>{ko ? "선반 제거" : "Remove shelf"}</button></fieldset>)}
      <div className="action-row"><button className="btn btn--subtle" disabled={draft.shelves.length >= 20} onClick={() => setDraft(current => ({ shelves: [...current.shelves, { id: crypto.randomUUID(), name: ko ? "새 선반" : "New shelf", titleKeys: [] }] }))}>{ko ? "선반 추가" : "Add shelf"}</button>
        <button className="btn btn--subtle" onClick={() => { setDraft(null); setShelf("all"); setMessage(""); }}>{ko ? "취소" : "Cancel"}</button>
        <button className="btn" disabled={draft.shelves.some(row => !row.name.trim())} onClick={() => { try { const saved = saveBookshelf(ownerKey, draft); setSettings(saved); setDraft(null); setShelf("all"); setSelected(""); setMessage(ko ? "책장에 적용했어요." : "Bookshelf saved."); } catch { setMessage(ko ? "저장하지 못했어요. 저장 공간을 확인해 주세요." : "Could not save. Check browser storage."); } }}>{ko ? "적용" : "Apply"}</button></div>
    </section>}
    {message ? <p role="status">{message}</p> : null}
    {status === "ready" && !draft && !visible.length ? <section className="channel-empty"><h2>{query ? (ko ? "검색 결과가 없어요." : "No results.") : (ko ? "아직 진열한 작품이 없어요." : "Your shelves are empty.")}</h2><p>{ko ? "책장 꾸미기에서 작품을 골라 주세요." : "Choose titles in Edit bookshelf."}</p><a href={`${base}titles/`}>{ko ? "내 작품 보기 →" : "My titles →"}</a></section> : null}
    {!draft && view === "table" ? <table className="channel-table"><thead><tr><th>{ko ? "작품" : "Title"}</th><th>{ko ? "기억" : "Memories"}</th></tr></thead><tbody>{visible.map(a => <tr key={a.key}><td><a href={hrefFor(a)}>{a.displayTitle}</a></td><td>{a.memoryCount}</td></tr>)}</tbody></table> : null}
    {!draft && view === "grid" ? <section ref={grid} className="bookshelf-grid" aria-label={ko ? "진열한 작품" : "Displayed titles"}>{visible.map((album, index) => <Fragment key={album.key}><div className="bookshelf-tile">
      <button className="bookshelf-cover-trigger" aria-label={`${album.displayTitle} ${ko ? "기억 필름" : "memory film"}`} aria-expanded={selected === album.key} onClick={() => setSelected(selected === album.key ? "" : album.key)}><span>{ko ? "필름 펼치기" : "Open film"}</span></button>
      <TitlePosterTile album={album} href={hrefFor(album)} copy={copy.titles} titleKey={album.key} />
    </div>{selectedRow === Math.floor(index / columns) && ((index + 1) % columns === 0 || index === visible.length - 1) ? <div className="bookshelf-film"><button className="film-close btn btn--subtle" onClick={() => setSelected("")}>{ko ? "접기 ×" : "Close ×"}</button><TitleAlbumCard album={active} href={hrefFor(active)} base={base} copy={copy.titles} locale={locale} titleKey={active.key} formatGenre={v => v} /><a className="bookshelf-film-more" href={hrefFor(active)}>{ko ? `기억 ${active.memoryCount}개 모두 보기 →` : `View all ${active.memoryCount} memories →`}</a></div> : null}</Fragment>)}</section> : null}
  </div>;
}
