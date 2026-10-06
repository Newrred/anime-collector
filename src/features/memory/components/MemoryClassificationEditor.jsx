import { useState } from "react";
import MemoryCharacterPicker from "./MemoryCharacterPicker.jsx";
import { addCustomTag, characterTagKey, classificationSyncEnabled } from "../domain/cardClassification.js";

export default function MemoryClassificationEditor({ value, onChange, title, disabled, locale, draftTag, onDraftTag }) {
  const ko = locale === "ko", [error, setError] = useState("");
  const addTag = () => {
    try { onChange(addCustomTag(value, draftTag)); onDraftTag(""); setError(""); }
    catch { setError(ko ? "태그는 48자 이내, 최대 20개예요." : "Use up to 20 tags, each 48 characters or fewer."); }
  };
  return <section className="memory-classification" aria-label={ko ? "이 기억의 분류" : "Classify this memory"}>
    <div className="memory-classification__heading"><h2>{ko ? "캐릭터" : "Characters"}</h2><MemoryCharacterPicker title={title} selected={value.characters} onChange={characters => onChange({ ...value, characters })} locale={locale} disabled={disabled} /></div>
    <div className="memory-classification__chips">{value.characters.map(row => <button type="button" className="memory-tag" disabled={disabled} key={characterTagKey(row)} aria-label={`${row.name} ${ko ? "태그 제거" : "remove tag"}`} onClick={() => onChange({ ...value, characters: value.characters.filter(value => characterTagKey(value) !== characterTagKey(row)) })}>{row.name}<span aria-hidden="true">×</span></button>)}</div>
    <label htmlFor="memory-custom-tag">{ko ? "커스텀 태그" : "Custom tags"}</label>
    <div className="memory-classification__chips">{value.tags.map(label => <button type="button" className="memory-tag" disabled={disabled} key={label} aria-label={`${label} ${ko ? "태그 제거" : "remove tag"}`} onClick={() => onChange({ ...value, tags: value.tags.filter(value => value !== label) })}>#{label}<span aria-hidden="true">×</span></button>)}</div>
    <div className="memory-classification__add"><input id="memory-custom-tag" type="text" maxLength={49} placeholder={ko ? "태그 입력 후 Enter" : "Enter a tag and press Enter"} value={draftTag} disabled={disabled} onChange={event => onDraftTag(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); addTag(); } }} /><button type="button" className="channel-text-button" disabled={disabled || !draftTag.trim()} onClick={addTag}>{ko ? "추가" : "Add"}</button></div>
    {error && <p role="alert">{error}</p>}
    <small>{classificationSyncEnabled() ? (ko ? "이 기억에만 적용됩니다." : "Applies only to this memory.") : (ko ? "이 기억의 태그는 현재 이 기기에만 저장돼요." : "These memory tags are currently saved on this device only.")}</small>
  </section>;
}
