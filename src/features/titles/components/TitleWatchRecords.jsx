import { useEffect, useRef, useState } from "react";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { WATCH_EVENTS, WATCH_STATUSES, normalizeWatchStatus } from "../domain/titleWatchRecord.js";

const statusEn = ["Unsorted", "Watching", "Completed", "On hold", "Dropped", "Plan to watch"];
const eventEn = ["Reflection", "Started", "Completed", "Rewatched", "Dropped"];
export const watchStatusLabel = (value, ko) => ko ? normalizeWatchStatus(value) : statusEn[WATCH_STATUSES.indexOf(normalizeWatchStatus(value))];
const eventLabel = (value, ko) => ko ? value === "NOTE" ? "감상" : value : eventEn[WATCH_EVENTS.indexOf(value)] || value;

function initialDraft(album) {
  return { watchStatus: normalizeWatchStatus(album.tracking.watchStatus), rating: album.tracking.rating ?? "",
    rewatchCount: album.tracking.rewatchCount || 0, eventType: "NOTE", watchedAtPrecision: "unknown", watchedAtValue: "", note: "" };
}

function WatchEditor({ album, service, locale, onSaved, onCancel }) {
  const ko = locale === "ko";
  const [initial] = useState(() => initialDraft(album));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const operationId = useRef(crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || pending;
  const allowLeave = useUnsavedNavigation(dirty, locale, { busy });
  const patch = (update) => { if (!pending) setDraft((current) => ({ ...current, ...update })); };
  const save = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const result = await service.saveWatchRecord(album, { ...draft, operationId: operationId.current });
      allowLeave(); onSaved(result);
    } catch (error) {
      const partial = error.message === "TITLE_TRACKING_PENDING";
      setPending(partial);
      setMessage(partial
        ? ko ? "감상 이력은 저장됐지만 작품 상태 반영을 마치지 못했어요. 같은 내용으로 다시 저장해 주세요." : "The entry is saved, but title details are still pending. Retry with the same details."
        : error.message === "INVALID_WATCH_DATE"
          ? ko ? "선택한 날짜 단위에 맞는 유효한 날짜를 입력해 주세요." : "Enter a valid date for the selected precision."
          : ko ? "저장하지 못했어요. 입력 내용은 남아 있으니 다시 시도해 주세요." : "Could not save. Your draft is kept; please try again.");
      // A failed append may have committed before a later error. Keep this ID for every retry.
    } finally { busyRef.current = false; setBusy(false); }
  };
  return <form className="watch-record-editor" onSubmit={save} aria-label={ko ? "감상 기록 작성" : "Write a watch record"}>
    <fieldset disabled={busy || pending}>
      <legend>{ko ? "작품의 현재 감상" : "Your current impression"}</legend>
      <div className="watch-record-editor__summary">
        <label>{ko ? "시청 상태" : "Watch status"}<select aria-label={ko ? "시청 상태" : "Watch status"} value={draft.watchStatus} onChange={(e) => patch({ watchStatus: e.target.value })}>
          {WATCH_STATUSES.map((value, i) => <option value={value} key={value}>{ko ? value : statusEn[i]}</option>)}
        </select></label>
        <div className="watch-record-editor__rating">
          <span>{ko ? "별점" : "Rating"}</span>
          <div className="watch-record-editor__stars" role="group" aria-label={ko ? "별점 선택" : "Choose rating"}>
            {[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} aria-label={ko ? `${score}점` : `${score} stars`}
              aria-pressed={Number(draft.rating) === score && draft.rating !== ""} className={draft.rating !== "" && Number(draft.rating) >= score ? "is-filled" : ""}
              onClick={() => patch({ rating: score })}>★</button>)}
          </div>
          <div className="watch-record-editor__rating-value"><input aria-label={ko ? "평점 (0~5)" : "Rating (0–5)"} type="number" min="0" max="5" step="0.5"
            value={draft.rating} onChange={(e) => patch({ rating: e.target.value })} placeholder={ko ? "미평가" : "Unrated"} />
            <button type="button" onClick={() => patch({ rating: "" })}>{ko ? "미평가" : "Clear"}</button></div>
        </div>
        <label>{ko ? "다시 정주행한 횟수" : "Rewatch count"}<input aria-label={ko ? "다시 정주행한 횟수" : "Rewatch count"} type="number" min="0" max="999" step="1" value={draft.rewatchCount} onChange={(e) => patch({ rewatchCount: e.target.value })} />
          <small>{ko ? "첫 시청을 제외한 횟수예요." : "Excludes the first viewing."}</small></label>
      </div>
    </fieldset>
    <fieldset disabled={busy || pending}>
      <legend>{ko ? "이번에 남길 기록" : "This entry"}</legend>
      <div className="watch-record-editor__event-row">
        <label>{ko ? "기록 종류" : "Entry type"}<select aria-label={ko ? "기록 종류" : "Entry type"} value={draft.eventType} onChange={(e) => {
          const value = e.target.value;
          patch({ eventType: value, ...(value === "재시청" ? { rewatchCount: Math.min(999, initial.rewatchCount + 1) }
            : draft.eventType === "재시청" && Number(draft.rewatchCount) === initial.rewatchCount + 1 ? { rewatchCount: initial.rewatchCount } : {}),
            ...({ "시작": "보는중", "완료": "완료", "하차": "하차" }[value] ? { watchStatus: { "시작": "보는중", "완료": "완료", "하차": "하차" }[value] } : {}) });
        }}>{WATCH_EVENTS.map((value) => <option key={value} value={value}>{eventLabel(value, ko)}</option>)}</select></label>
        <label>{ko ? "날짜 단위" : "Date precision"}<select aria-label={ko ? "날짜 단위" : "Date precision"} value={draft.watchedAtPrecision} onChange={(e) => patch({ watchedAtPrecision: e.target.value, watchedAtValue: "" })}>
          {["unknown", "day", "month", "year"].map((value, i) => <option key={value} value={value}>{(ko ? ["날짜 미상", "일", "월", "연도"] : ["Unknown", "Day", "Month", "Year"])[i]}</option>)}
        </select></label>
        {draft.watchedAtPrecision !== "unknown" && <label>{ko ? "시청한 날짜" : "Watched on"}<input required aria-label={ko ? "시청한 날짜" : "Watched on"}
          type={draft.watchedAtPrecision === "year" ? "text" : draft.watchedAtPrecision === "day" ? "date" : "month"}
          inputMode={draft.watchedAtPrecision === "year" ? "numeric" : undefined} placeholder="2026" value={draft.watchedAtValue}
          onChange={(e) => patch({ watchedAtValue: e.target.value })} /></label>}
      </div>
      <label>{ko ? "감상" : "Reflection"}<textarea aria-label={ko ? "감상" : "Reflection"} rows="5" maxLength="10000" value={draft.note}
        placeholder={ko ? "이번 감상이나 다시 보며 달라진 생각을 남겨 주세요." : "What stayed with you, or changed on this viewing?"}
        onChange={(e) => patch({ note: e.target.value })} /></label>
    </fieldset>
    <p className="watch-record-help">{ko ? "이미지 없이 기록할 수 있어요. 감상 기록은 이 기기에 저장됩니다." : "No image is needed. Watch records are saved on this device."}</p>
    {message && <p role="alert">{message}</p>}
    <div className="watch-record-editor__actions"><button className="btn" disabled={busy}>{busy ? ko ? "저장 중…" : "Saving…" : pending ? ko ? "다시 저장" : "Retry save" : ko ? "감상 기록 저장" : "Save watch record"}</button>
      <button type="button" className="btn btn--subtle" disabled={busy || pending} onClick={onCancel}>{ko ? "취소" : "Cancel"}</button></div>
  </form>;
}

export default function TitleWatchRecords({ album, service, locale, base = "/", onSaved, onSaveTitle, onEditingChange, busy, startWriting = false }) {
  const ko = locale === "ko";
  const [editing, setEditing] = useState(startWriting);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    onEditingChange(editing && album.tracking.isSaved);
    return () => onEditingChange(false);
  }, [editing, album.tracking.isSaved, onEditingChange]);
  return <section className="title-watch-records" aria-labelledby="watch-record-heading">
    <div className="title-hub__section-heading"><h2 id="watch-record-heading">{ko ? "감상 기록" : "Watch records"}</h2>
      {album.tracking.isSaved && !editing && <button className="btn" onClick={() => { setEditing(true); setSaved(false); }}>{ko ? "감상 기록 남기기" : "Add watch record"}</button>}</div>
    {!album.tracking.isSaved ? <div className="title-watch-records__save-first"><p>{ko ? "이 작품을 저장하면 시청 상태·별점·정주행과 감상을 기록할 수 있어요." : "Save this title to record status, rating, rewatches and reflections."}</p>
      <button className="btn" disabled={busy} onClick={onSaveTitle}>{ko ? "작품 저장하고 기록하기" : "Save title and start recording"}</button></div>
      : editing ? <WatchEditor album={album} service={service} locale={locale} onCancel={() => setEditing(false)} onSaved={(result) => { onSaved(result); setEditing(false); setSaved(true); }} /> : null}
    {saved && <p role="status">{ko ? "감상 기록을 저장했어요." : "Watch record saved."}</p>}
    {album.anilistId && album.tracking.isSaved && !editing && <div className="title-watch-records__management">
      <a className="btn btn--subtle" data-astro-reload href={`${base}library/?${new URLSearchParams({ animeId: String(album.anilistId), focus: "edit" })}`}>
        {ko ? "감상 이력 관리 →" : "Manage watch history →"}
      </a>
      <p className="watch-record-help">{ko ? "기존 기록의 수정·삭제, 상황 태그와 캐릭터를 관리할 수 있어요." : "Edit or delete earlier records, and manage their context tags and characters."}</p>
    </div>}
    {album.libraryItem?.memo && <section className="title-watch-records__legacy"><h3>{ko ? "기존 감상 메모" : "Earlier reflection"}</h3><p>{album.libraryItem.memo}</p></section>}
    <ol className="title-watch-records__timeline">{album.watchLogs.map((log) => <li key={log.id}>
      <header><strong>{eventLabel(log.eventType, ko)}</strong><span>{log.watchedAtPrecision === "unknown" ? ko ? "날짜 미상" : "Date unknown" : log.watchedAtValue}</span>
        {log.scoreAtThatTime != null && <span>{ko ? "별점" : "Rating"} {log.scoreAtThatTime}/5</span>}</header>
      {log.cue && <h3>{log.cue}</h3>}{log.note && <p>{log.note}</p>}
      {!!log.contextTags?.length && <p className="watch-record-help">{log.contextTags.join(" · ")}</p>}
      {!!log.characterRefs?.length && <p className="watch-record-help">{log.characterRefs.map((ref) => ref.nameSnapshot).join(" · ")}</p>}
    </li>)}</ol>
    {!album.watchLogs.length && !editing && <p className="watch-record-help">{ko ? "시청을 시작한 날, 마친 날, 다시 본 감상을 차곡차곡 남겨 보세요." : "Keep a history of first viewings, completions and rewatches."}</p>}
  </section>;
}
