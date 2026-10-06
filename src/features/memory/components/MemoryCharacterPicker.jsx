import { useState } from "react";
import { createPortal } from "react-dom";
import { useModalInteraction } from "../../../hooks/useModalInteraction.js";
import TitleCharacters from "../../titles/components/TitleCharacters.jsx";
import { characterTagKey } from "../domain/cardClassification.js";

export default function MemoryCharacterPicker({ title, selected, onChange, locale, disabled }) {
  const ko = locale === "ko";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [query, setQuery] = useState("");
  const close = () => setOpen(false);
  const dialogRef = useModalInteraction({ open, onClose: close, busy: disabled });
  const anilistId = title.sourceBinding?.provider === "ANILIST" ? Number(title.sourceBinding.externalId) : null;
  const toggle = row => {
    const key = characterTagKey(row);
    setDraft(current => current.some(value => characterTagKey(value) === key)
      ? current.filter(value => characterTagKey(value) !== key)
      : current.length < 12 ? [...current, row] : current);
  };
  return <>
    <button type="button" className="channel-text-button memory-classification__choose" disabled={disabled} aria-haspopup="dialog" onClick={() => { setDraft(selected); setQuery(""); setOpen(true); }}>{ko ? "캐릭터 선택" : "Choose characters"}<span aria-hidden="true">＋</span></button>
    {open && createPortal(<div className="memory-character-picker__layer" data-modal-layer>
      <section ref={dialogRef} className="memory-character-picker" role="dialog" aria-modal="true" aria-labelledby="memory-character-picker-title" tabIndex={-1}>
        <header><h2 id="memory-character-picker-title">{ko ? "캐릭터 선택" : "Choose characters"}</h2><button type="button" className="channel-text-button" disabled={disabled} aria-label={ko ? "캐릭터 선택 닫기" : "Close character picker"} onClick={close}>×</button></header>
        <p className="memory-character-picker__subtitle">{title.displayTitle}</p>
        <label className="memory-character-picker__search">{ko ? "불러온 캐릭터 검색" : "Search loaded characters"}<input type="search" value={query} onChange={event => setQuery(event.target.value)} disabled={disabled} placeholder={ko ? "캐릭터 이름" : "Character name"} /></label>
        <div className="memory-character-picker__selection" aria-live="polite"><span>{ko ? `선택 ${draft.length}/12` : `Selected ${draft.length}/12`}</span><div>{draft.map(row => <button className="memory-tag" type="button" key={characterTagKey(row)} disabled={disabled} aria-label={`${row.name} ${ko ? "선택 해제" : "deselect"}`} onClick={() => toggle(row)}>{row.name}<span aria-hidden="true">×</span></button>)}</div></div>
        <div className="memory-character-picker__results">
          {title.catalogAnimeId || anilistId ? <TitleCharacters animeId={title.catalogAnimeId} anilistId={anilistId} locale={locale} selected={draft} onSelect={toggle} disabled={disabled} query={query} /> : <p>{ko ? "직접 만든 작품은 커스텀 태그로 분류할 수 있어요." : "Use custom tags to classify a private title."}</p>}
        </div>
        <footer><span>{ko ? "적용 후 변경 저장을 눌러 주세요." : "Save the memory after applying."}</span><div><button className="btn btn--subtle" type="button" disabled={disabled} onClick={close}>{ko ? "취소" : "Cancel"}</button><button className="btn" type="button" disabled={disabled} onClick={() => { onChange(draft); close(); }}>{ko ? "선택 적용" : "Apply selection"}</button></div></footer>
      </section>
    </div>, document.body)}
  </>;
}
