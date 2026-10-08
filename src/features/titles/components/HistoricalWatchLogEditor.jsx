import { useEffect, useMemo, useState } from "react";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { AFFINITY_OPTIONS, REASON_TAG_OPTIONS, SEASON_TERM_OPTIONS } from "../../../components/library/libraryCopy.js";
import { WATCH_EVENTS } from "../domain/titleWatchRecord.js";
import { catalogCharacterAniListId, createTitleCharactersReader } from "../application/titleCharacters.js";

const eventText = (value, ko) => value === "NOTE" ? (ko ? "감상" : "Reflection") : value;
const seasonParts = value => {
  const match = String(value || "").match(/^(\d{4})-(spring|summer|fall|winter)$/iu);
  return { year: match?.[1] || "", term: match?.[2]?.toLowerCase() || "spring" };
};

export default function HistoricalWatchLogEditor({ album, log, service, locale, onSaved, onCancel }) {
  const ko = locale === "ko";
  const initial = useMemo(() => ({ eventType: log.eventType, watchedAtPrecision: log.watchedAtPrecision,
    watchedAtValue: log.watchedAtValue, cue: log.cue, note: log.note,
    scoreAtThatTime: log.scoreAtThatTime ?? "", characterRefs: structuredClone(log.characterRefs || []) }), [log]);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [characters, setCharacters] = useState([]);
  const [characterQuery, setCharacterQuery] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const allowLeave = useUnsavedNavigation(dirty, locale, { busy });

  useEffect(() => {
    if (!album.anilistId) return undefined;
    let active = true;
    createTitleCharactersReader()({ animeId: album.titleRef?.kind === "ANIME" ? album.titleRef.animeId : null,
      anilistId: album.anilistId }).then(result => { if (active) setCharacters(result.characters || []); }).catch(() => {});
    return () => { active = false; };
  }, [album.anilistId, album.titleRef]);

  const patch = update => setDraft(current => ({ ...current, ...update }));
  const changeRef = (id, update) => patch({ characterRefs: draft.characterRefs.map(ref => Number(ref.characterId) === id ? { ...ref, ...update } : ref) });
  const cancel = () => {
    if (dirty && !window.confirm(ko ? "수정 중인 내용을 버릴까요?" : "Discard your changes?")) return;
    allowLeave(); onCancel();
  };
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const updated = await service.editWatchLog(album, log, draft);
      allowLeave(); onSaved(updated);
    } catch (error) {
      setMessage(error.message === "WATCH_LOG_CHANGED" || error.message === "WATCH_LOG_NOT_FOUND"
        ? (ko ? "다른 곳에서 기록이 바뀌었어요. 내용을 확인한 뒤 다시 열어 주세요." : "This entry changed elsewhere. Review it and reopen the editor.")
        : error.message === "INVALID_WATCH_DATE"
          ? (ko ? "날짜를 다시 확인해 주세요." : "Check the date.")
          : (ko ? "수정 내용을 저장하지 못했어요. 입력은 남아 있어요." : "Could not save. Your changes are still here."));
    } finally { setBusy(false); }
  };
  const season = seasonParts(draft.watchedAtValue);
  const candidates = characters.filter(row => catalogCharacterAniListId(row.id)
    && row.name.toLocaleLowerCase().includes(characterQuery.trim().toLocaleLowerCase()));
  return <form className="watch-record-editor watch-record-editor--historical" onSubmit={save}
    aria-label={ko ? "감상 기록 수정" : "Edit watch record"}>
    <h3>{ko ? "감상 기록 수정" : "Edit watch record"}</h3>
    <div className="watch-record-editor__event-row">
      <label>{ko ? "기록 종류" : "Entry type"}<select value={draft.eventType} onChange={event => patch({ eventType: event.target.value })} disabled={busy}>
        {[...new Set([draft.eventType, ...WATCH_EVENTS])].map(value => <option key={value} value={value}>{eventText(value, ko)}</option>)}
      </select></label>
      <label>{ko ? "날짜 단위" : "Date precision"}<select value={draft.watchedAtPrecision} disabled={busy}
        onChange={event => patch({ watchedAtPrecision: event.target.value, watchedAtValue: "" })}>
        {[["unknown", ko ? "날짜 미상" : "Unknown"], ["day", ko ? "일" : "Day"], ["month", ko ? "월" : "Month"],
          ["season", ko ? "계절" : "Season"], ["year", ko ? "연도" : "Year"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {draft.watchedAtPrecision === "season" ? <div className="watch-record-editor__season">
        <label>{ko ? "연도" : "Year"}<input type="text" inputMode="numeric" maxLength={4} disabled={busy} value={season.year}
          onChange={event => patch({ watchedAtValue: `${event.target.value.replace(/\D/gu, "").slice(0, 4)}-${season.term}` })} /></label>
        <label>{ko ? "계절" : "Season"}<select disabled={busy} value={season.term}
          onChange={event => patch({ watchedAtValue: `${season.year}-${event.target.value}` })}>
          {SEASON_TERM_OPTIONS.map(term => <option key={term} value={term.toLowerCase()}>{term}</option>)}
        </select></label>
      </div> : draft.watchedAtPrecision !== "unknown" ? <label>{ko ? "시청한 날짜" : "Watched on"}<input disabled={busy}
        type={draft.watchedAtPrecision === "day" ? "date" : draft.watchedAtPrecision === "month" ? "month" : "text"}
        inputMode={draft.watchedAtPrecision === "year" ? "numeric" : undefined} value={draft.watchedAtValue}
        onChange={event => patch({ watchedAtValue: event.target.value })} /></label> : null}
    </div>
    <label>{ko ? "한줄 감상" : "Short cue"}<input maxLength={120} disabled={busy} value={draft.cue}
      onChange={event => patch({ cue: event.target.value })} /></label>
    <label>{ko ? "감상" : "Reflection"}<textarea rows={5} maxLength={10000} disabled={busy} value={draft.note}
      onChange={event => patch({ note: event.target.value })} /></label>
    <label>{ko ? "당시 별점" : "Rating at the time"}<input type="number" min="0" max="5" step="0.5" disabled={busy}
      value={draft.scoreAtThatTime} onChange={event => patch({ scoreAtThatTime: event.target.value })} /></label>
    <details className="watch-record-editor__characters"><summary>{ko ? `함께 남긴 캐릭터 ${draft.characterRefs.length}명` : `Characters ${draft.characterRefs.length}`}</summary>
      {draft.characterRefs.map(ref => <div key={ref.characterId} className="watch-record-editor__character">
        <div className="watch-record-editor__character-heading"><strong>{ref.nameSnapshot}</strong>
          <button type="button" className="btn btn--subtle" disabled={busy} onClick={() => patch({ characterRefs: draft.characterRefs.filter(row => row.characterId !== ref.characterId) })}>{ko ? "제외" : "Remove"}</button></div>
        <label>{ko ? "대표 캐릭터" : "Primary"}<input type="radio" name="watch-primary-character" disabled={busy} checked={ref.isPrimary === true}
          onChange={() => patch({ characterRefs: draft.characterRefs.map(row => ({ ...row, isPrimary: row.characterId === ref.characterId })) })} /></label>
        <label>{ko ? "인상" : "Affinity"}<select disabled={busy} value={ref.affinity || "기억남음"}
          onChange={event => changeRef(Number(ref.characterId), { affinity: event.target.value })}>
          {AFFINITY_OPTIONS.map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <div className="watch-record-editor__reasons"><span>{ko ? "좋아한 이유" : "Reasons"}</span>
          {REASON_TAG_OPTIONS.map(value => <label key={value}><input type="checkbox" disabled={busy}
            checked={(ref.reasonTags || []).includes(value)} onChange={() => {
              const values = ref.reasonTags || [];
              changeRef(Number(ref.characterId), { reasonTags: values.includes(value) ? values.filter(item => item !== value) : [...values, value].slice(0, 6) });
            }} />{value}</label>)}</div>
        <label>{ko ? "캐릭터 메모" : "Character note"}<input maxLength={200} disabled={busy} value={ref.note || ""}
          onChange={event => changeRef(Number(ref.characterId), { note: event.target.value })} /></label>
      </div>)}
      {album.anilistId && <div className="watch-record-editor__character-search"><label>{ko ? "캐릭터 찾기" : "Find a character"}<input disabled={busy}
        value={characterQuery} onChange={event => setCharacterQuery(event.target.value)} /></label>
        {characterQuery.trim() && <div className="watch-record-editor__candidates">{candidates.filter(row => !draft.characterRefs.some(ref => Number(ref.characterId) === catalogCharacterAniListId(row.id))).slice(0, 8)
          .map(row => <button type="button" className="btn btn--subtle" key={row.id} disabled={busy || draft.characterRefs.length >= 3}
            onClick={() => patch({ characterRefs: [...draft.characterRefs, { characterId: catalogCharacterAniListId(row.id), mediaId: album.anilistId,
              nameSnapshot: row.name, imageSnapshot: row.image || null, role: row.role || "", affinity: "기억남음", reasonTags: [], note: "",
              order: draft.characterRefs.length, isPrimary: draft.characterRefs.length === 0 }] })}>{row.name}</button>)}</div>}</div>}
    </details>
    {message && <p role="alert">{message}</p>}
    <div className="watch-record-editor__actions"><button className="btn" disabled={busy}>{busy ? (ko ? "저장 중…" : "Saving…") : (ko ? "수정 저장" : "Save changes")}</button>
      <button type="button" className="btn btn--subtle" disabled={busy} onClick={cancel}>{ko ? "취소" : "Cancel"}</button></div>
  </form>;
}
