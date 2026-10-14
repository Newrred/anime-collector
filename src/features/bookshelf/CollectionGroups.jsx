import { useEffect, useState } from "react";
import { getPlatformMemoryRuntime } from "../memory/runtime/platformMemoryRuntime.js";
import BoardCollectionGrid from "../memory/components/BoardCollectionGrid.tsx";
import CollectionGroupTabs from "../../components/collection/CollectionGroupTabs.jsx";
export const collectionSections = settings => settings.sections || settings.shelves.map(s => ({ kind: "TITLE_SHELF", sourceId: s.id }));
export default function CollectionGroups({ settings, ownerKey, locale, selected, onSelect, onSave, onAddShelf, base, overview = false, renderShelf, disabled = false }) {
  const ko = locale === "ko";
  const [boards, setBoards] = useState([]), [error, setError] = useState(false), [adding, setAdding] = useState(false), [addKind, setAddKind] = useState(""), [choice, setChoice] = useState("");
  const [runtime, setRuntime] = useState(null);
  useEffect(() => {
    let live = true, revision = 0;
    const refresh = () => {
      const request = ++revision;
      getPlatformMemoryRuntime().then(async runtime => { await runtime.initialize(); if (live) setRuntime(runtime); return runtime.listBoards(); })
        .then(rows => { if (live && request === revision) { setBoards(rows); setError(false); } }).catch(() => live && request === revision && setError(true));
    };
    refresh(); window.addEventListener("moemoa:memory-updated",refresh); window.addEventListener("moemoa:collection-boards-updated",refresh);
    return () => { live = false; window.removeEventListener("moemoa:memory-updated",refresh); window.removeEventListener("moemoa:collection-boards-updated",refresh); };
  }, [ownerKey, adding]);
  const sections = collectionSections(settings);
  const titleOf = section => section.kind === "TITLE_SHELF" ? settings.shelves.find(s => s.id === section.sourceId)?.name : boards.find(b => b.id === section.sourceId)?.title;
  const countOf = section => section.kind === "TITLE_SHELF" ? settings.shelves.find(s => s.id === section.sourceId)?.titleKeys.length : boards.find(b => b.id === section.sourceId)?.cardCount;
  if (overview) return sections.map(section => {
    if (section.kind === "TITLE_SHELF") return <div key={section.kind + section.sourceId}>{renderShelf?.(settings.shelves.find(s => s.id === section.sourceId))}</div>;
    const board = boards.find(b => b.id === section.sourceId);
    return board && runtime ? <section key={section.kind + section.sourceId} className="collection-owner-section collection-board-overview" data-section-kind="MEMORY_BOARD"><header><div><small>{ko ? "이미지 보드" : "Memory Board"}</small><h2>{board.title}</h2></div><span>{ko ? `기억 ${board.cardCount}개` : `${board.cardCount} memories`}</span></header><BoardCollectionGrid boards={[board]} runtime={runtime} base={base} locale={locale} collection /></section> : null;
  });
  return <section className="collection-groups" aria-label={ko ? "컬렉션 묶음" : "Collection groups"}>
    <CollectionGroupTabs disabled={disabled} locale={locale} selected={selected} onSelect={onSelect} entries={sections.map(section => ({ key:section.kind+":"+section.sourceId,kind:section.kind,label:titleOf(section) || (ko ? "원본 확인 필요" : "Source unavailable"),count:countOf(section) }))}>
      <button type="button" disabled={disabled} onClick={() => { setAdding(!adding); setAddKind(""); }} aria-expanded={adding}>{ko ? "+ 묶음 추가" : "+ Add group"}</button>
    </CollectionGroupTabs>
    {disabled && <p role="status">{ko ? "현재 작업을 저장하거나 닫은 뒤 다른 묶음으로 이동할 수 있습니다." : "Save or close the current task before switching groups."}</p>}
    {error && <p role="alert">{ko ? "이미지 보드를 불러오지 못했습니다." : "Could not load Memory Boards."}</p>}
    {selected.startsWith("MEMORY_BOARD:") && !sections.some(s => s.kind + ":" + s.sourceId === selected) && boards.some(b => "MEMORY_BOARD:" + b.id === selected) && <p className="collection-unconnected-board">{ko ? "이 보드는 아직 컬렉션에 놓이지 않았습니다. 원본은 그대로 보관 중입니다." : "This Board is not placed in your collection yet. The original is preserved."} <button type="button" className="channel-text-button" disabled={disabled || sections.length >= 40} onClick={() => onSave({ ...settings, layoutVersion:1, sections:[...sections,{kind:"MEMORY_BOARD",sourceId:selected.slice(13)}] })}>{ko ? "이 보드를 컬렉션에 연결" : "Connect this Board to collection"}</button></p>}
    {selected !== "all" && <div className="collection-group-order">{[-1,1].map(direction => <button type="button" key={direction} className="channel-text-button" disabled={disabled || sections.findIndex(s => s.kind + ":" + s.sourceId === selected) + direction < 0 || sections.findIndex(s => s.kind + ":" + s.sourceId === selected) + direction >= sections.length} onClick={() => { const next = [...sections], i = next.findIndex(s => s.kind + ":" + s.sourceId === selected); if (i < 0 || !next[i+direction]) return; [next[i],next[i+direction]] = [next[i+direction],next[i]]; onSave({ ...settings, layoutVersion:1, sections:next }); }}>{direction < 0 ? (ko ? "묶음 앞으로" : "Move group earlier") : (ko ? "묶음 뒤로" : "Move group later")}</button>)}</div>}
    {adding && <div className="collection-group-add"><button type="button" className="btn btn--subtle" disabled={disabled || settings.shelves.length >= 20 || sections.length >= 40} onClick={onAddShelf}>{ko ? "작품 선반 만들기" : "Create title shelf"}</button><button type="button" className="btn btn--subtle" disabled={disabled} aria-expanded={addKind === "MEMORY_BOARD"} onClick={() => setAddKind(addKind ? "" : "MEMORY_BOARD")}>{ko ? "이미지 보드 연결" : "Connect Memory Board"}</button></div>}
    {adding && addKind === "MEMORY_BOARD" && <form onSubmit={e => { e.preventDefault(); if (!choice || disabled || sections.length >= 40) return; const saved = onSave({ ...settings, layoutVersion: 1, sections: [...sections, { kind: "MEMORY_BOARD", sourceId: choice }] }); if (!saved) return; setChoice(""); setAdding(false); onSelect("MEMORY_BOARD:" + choice); }}>
      <label>{ko ? "컬렉션에 놓을 이미지 보드" : "Memory Board to display"}<select required value={choice} onChange={e => setChoice(e.target.value)}><option value="">{ko ? "보드 선택" : "Choose Board"}</option>{boards.filter(b => !sections.some(s => s.kind === "MEMORY_BOARD" && s.sourceId === b.id)).map(b => <option key={b.id} value={b.id}>{b.title} · {b.cardCount}</option>)}</select></label>
      <button className="btn" disabled={disabled || !choice || sections.length >= 40}>{ko ? "컬렉션에 연결" : "Connect to collection"}</button>
      {!error && !boards.some(b => !sections.some(s => s.kind === "MEMORY_BOARD" && s.sourceId === b.id)) && <p>{ko ? "연결할 보드가 없습니다. 새 보드를 만들거나 기존 보드 연결을 유지하세요." : "No unconnected Boards. Create a Board or keep the existing connections."}</p>}
      <a href={`${base}?panel=boards`}>{ko ? "새 이미지 보드 만들기" : "Create Memory Board"}</a>
      <p>{ko ? "원본 보드는 그대로 유지되며 자동으로 공개되지 않습니다." : "The original Board is preserved and is not shared automatically."}</p>
    </form>}
    {selected.startsWith("MEMORY_BOARD:") && <button type="button" className="channel-text-button" disabled={disabled} onClick={() => { if (onSave({ ...settings, layoutVersion: 1, sections: sections.filter(s => s.kind + ":" + s.sourceId !== selected) })) onSelect("all"); }}>{ko ? "컬렉션에서만 빼기 · 원본 유지" : "Remove from collection · keep original"}</button>}
  </section>;
}
