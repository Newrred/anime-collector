import { useId, useState } from "react";
import TitleCover from "../titles/components/TitleCover.jsx";
import { TextChoices } from "../../components/collection/ChannelHeader.jsx";

export default function BookshelfEditor({ draft, setDraft, albums, copy, locale, onCancel, onApply }) {
  const ko = locale === "ko", nameId = useId();
  const [activeId, setActiveId] = useState(draft.shelves[0]?.id || "");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const active = draft.shelves.find(row => row.id === activeId) || draft.shelves[0];
  const selected = new Set(active?.titleKeys || []);
  const visible = albums.filter(album => album.displayTitle.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && (filter === "all" || selected.has(album.key)));
  const edit = patch => setDraft(current => ({ ...current, shelves: current.shelves.map(row => row.id === active.id ? { ...row, ...patch } : row) }));
  const selectShelf = id => { setActiveId(id); setQuery(""); setFilter("all"); };
  const addShelf = () => {
    const id = crypto.randomUUID();
    setDraft(current => ({ ...current, shelves: [...current.shelves, { id, name: ko ? "새 선반" : "New shelf", titleKeys: [] }] }));
    selectShelf(id);
  };
  const removeShelf = () => {
    const nextId = draft.shelves.find(row => row.id !== active.id)?.id || "";
    setDraft(current => ({ ...current, shelves: current.shelves.filter(row => row.id !== active.id) }));
    selectShelf(nextId);
  };
  return <section className="bookshelf-editor" aria-label={ko ? "컬렉션 편집 화면" : "Collection editor"}>
    <header className="bookshelf-editor-heading"><h2>{ko ? "선반 편집" : "Edit shelves"}</h2><p>{ko ? "선반을 고르고, 진열할 작품을 선택해 주세요." : "Choose a shelf, then select the titles to display."}</p></header>
    <div className="bookshelf-editor-layout">
      <nav className="bookshelf-editor-shelves" aria-label={ko ? "편집할 선반" : "Shelves to edit"}>
        <p className="bookshelf-editor-label">{ko ? "선반" : "Shelves"}<span>{draft.shelves.length}/20</span></p>
        <div className="bookshelf-editor-shelf-list">{draft.shelves.map(row => <button key={row.id} type="button" aria-label={ko ? `${row.name || "이름 없는 선반"} 편집` : `Edit ${row.name || "Untitled shelf"}`} aria-pressed={active?.id === row.id} onClick={() => selectShelf(row.id)}><span>{row.name || (ko ? "이름 없는 선반" : "Untitled shelf")}</span><small>{ko ? `${row.titleKeys.length}개` : row.titleKeys.length}</small></button>)}</div>
        <button type="button" className="btn btn--subtle" disabled={draft.shelves.length >= 20} onClick={addShelf}>{ko ? "선반 추가" : "Add shelf"}<span aria-hidden="true"> +</span></button>
      </nav>
      <div className="bookshelf-editor-content">{active ? <>
        <div className="bookshelf-editor-name-row"><label htmlFor={nameId}>{ko ? "선반 이름" : "Shelf name"}<input id={nameId} maxLength={80} value={active.name} onChange={event => edit({ name: event.target.value })} /></label><button type="button" className="channel-text-button" onClick={removeShelf}>{ko ? "선반 제거" : "Remove shelf"}</button></div>
        <div className="bookshelf-editor-tools"><label className="bookshelf-editor-search"><span className="sr-only">{ko ? "진열할 작품 찾기" : "Find titles to display"}</span><input type="search" placeholder={ko ? "작품명으로 찾기" : "Find a title"} value={query} onChange={event => setQuery(event.target.value)} /></label><TextChoices label={ko ? "선택 작품 보기" : "Filter title selection"} value={filter} onChange={setFilter} options={[{ value: "all", label: ko ? "전체" : "All" }, { value: "selected", label: ko ? "선택됨" : "Selected" }]} /></div>
        <p className="bookshelf-editor-selection" role="status">{ko ? `${selected.size}개 선택 · ${visible.length}개 표시` : `${selected.size} selected · ${visible.length} shown`}</p>
        <div className="bookshelf-picker">{visible.map(album => {
          const checked = selected.has(album.key);
          return <label key={album.key} className={`bookshelf-picker-title ${checked ? "is-selected" : ""}`}><input type="checkbox" aria-label={album.displayTitle} checked={checked} disabled={!checked && selected.size >= 300} onChange={event => edit({ titleKeys: event.target.checked ? [...active.titleKeys, album.key] : active.titleKeys.filter(key => key !== album.key) })} /><TitleCover album={album} copy={copy} className="bookshelf-picker-cover" /><span className="bookshelf-picker-text"><strong>{album.displayTitle}</strong><small>{copy.memoryCount(album.memoryCount)}</small></span></label>;
        })}</div>
        {!visible.length ? <div className="bookshelf-editor-empty"><p>{query ? (ko ? "검색 결과가 없어요." : "No matching titles.") : filter === "selected" ? (ko ? "아직 선택한 작품이 없어요." : "No titles selected yet.") : (ko ? "저장한 작품이나 기억이 여기에 표시돼요." : "Saved titles and memories appear here.")}</p>{query || filter !== "all" ? <button type="button" className="channel-text-button" onClick={() => { setQuery(""); setFilter("all"); }}>{ko ? "전체 작품 보기" : "Show all titles"}</button> : null}</div> : null}
        {selected.size >= 300 ? <p className="channel-hint">{ko ? "한 선반에는 최대 300개 작품을 선택할 수 있어요." : "Each shelf can hold up to 300 titles."}</p> : null}
      </> : <div className="bookshelf-editor-empty"><p>{ko ? "첫 선반을 만들고 작품을 모아 보세요." : "Create your first shelf to collect titles."}</p></div>}</div>
    </div>
    <footer className="bookshelf-editor-footer"><p>{ko ? "적용을 누르면 이 기기에 저장됩니다." : "Apply saves your shelves on this device."}</p><div className="action-row"><button type="button" className="btn btn--subtle" onClick={onCancel}>{ko ? "취소" : "Cancel"}</button><button type="button" className="btn" disabled={draft.shelves.some(row => !row.name.trim())} onClick={onApply}>{ko ? "적용" : "Apply"}</button></div></footer>
  </section>;
}
