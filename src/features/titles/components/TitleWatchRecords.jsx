import { useEffect, useRef, useState } from "react";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { WATCH_EVENTS, WATCH_STATUSES, normalizeWatchStatus } from "../domain/titleWatchRecord.js";
import HistoricalWatchLogEditor from "./HistoricalWatchLogEditor.jsx";
import TitleCurrentDetailsEditor from "./TitleCurrentDetailsEditor.jsx";

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
  const cancel = () => {
    if (dirty && !window.confirm(ko ? "작성 중인 내용을 버릴까요?" : "Discard this draft?")) return;
    allowLeave(); onCancel();
  };
  const save = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setMessage("");
    try {
      const result = await service.saveWatchRecord(album, { ...draft, operationId: operationId.current });
      allowLeave(); onSaved(result);
    } catch (error) {
      if (error.message === "TITLE_TRACKING_CONFLICT" && error.log) {
        allowLeave(); onSaved({ log: error.log, tracking: error.tracking || album.tracking, trackingConflict: true });
        return;
      }
      const partial = error.message === "TITLE_TRACKING_PENDING";
      setPending(partial);
      setMessage(partial
        ? ko ? "감상 이력은 저장됐지만 작품 상태 반영을 마치지 못했어요. 같은 내용으로 다시 저장해 주세요." : "The entry is saved, but title details are still pending. Retry with the same details."
        : error.message === "TITLE_TRACKING_CONFLICT"
          ? ko ? "다른 곳에서 작품 상태가 바뀌었어요. 현재 상태를 확인한 뒤 다시 작성해 주세요." : "Title details changed elsewhere. Review them before saving."
          : error.message === "RECORD_RESULT_UNKNOWN"
            ? ko ? "이미 저장된 감상인지 확인이 필요해요. 작품을 다시 열어 확인해 주세요." : "Check the existing entry before trying again."
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
    <p className="watch-record-help">{ko ? "이미지 없이 감상을 남길 수 있어요." : "You can save a reflection without an image."}</p>
    {message && <p role="alert">{message}</p>}
    <div className="watch-record-editor__actions"><button className="btn" disabled={busy}>{busy ? ko ? "저장 중…" : "Saving…" : pending ? ko ? "다시 저장" : "Retry save" : ko ? "감상 기록 저장" : "Save watch record"}</button>
      <button type="button" className="btn btn--subtle" disabled={busy || pending} onClick={cancel}>{ko ? "취소" : "Cancel"}</button></div>
  </form>;
}

export default function TitleWatchRecords({ album, service, locale, base = "/", onSaved, onLogChanged, onTitleDetailsSaved, onSaveTitle, onEditingChange, busy, startWriting = false }) {
  const ko = locale === "ko";
  const [editing, setEditing] = useState(startWriting);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [managementMessage, setManagementMessage] = useState("");
  const [trackingConflict, setTrackingConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    onEditingChange((editing && album.tracking.isSaved) || Boolean(editingLogId) || editingTitle);
    return () => onEditingChange(false);
  }, [editing, editingLogId, editingTitle, album.tracking.isSaved, onEditingChange]);
  const removeLog = async log => {
    if (!window.confirm(ko ? "이 감상 기록을 삭제할까요? 작품과 기억 이미지는 그대로 둡니다." : "Delete this watch record? The title and memories stay.")) return;
    setDeletingId(log.id); setManagementMessage("");
    try {
      await service.deleteWatchLog(album, log);
      onLogChanged(null, log.id);
      setManagementMessage(ko ? "감상 기록을 삭제했어요." : "Watch record deleted.");
    } catch (error) {
      setManagementMessage(error.message === "WATCH_LOG_CHANGED" ? (ko ? "다른 곳에서 기록이 바뀌었어요. 다시 확인해 주세요." : "This entry changed elsewhere. Review it again.")
        : (ko ? "삭제하지 못했어요. 기록은 그대로예요." : "Could not delete the entry."));
    } finally { setDeletingId(null); }
  };
  return <section className="title-watch-records" aria-labelledby="watch-record-heading">
    <div className="title-hub__section-heading"><h2 id="watch-record-heading">{ko ? "감상 기록" : "Watch records"}</h2>
      {album.tracking.isSaved && !editing && !editingLogId && !editingTitle && <button className="btn" onClick={() => { setEditing(true); setSaved(false); }}>{ko ? "감상 기록 남기기" : "Add watch record"}</button>}</div>
    {!album.tracking.isSaved ? <div className="title-watch-records__save-first"><p>{ko ? "새 감상을 남기려면 작품을 저장해 주세요. 기존 감상 기록은 아래에서 계속 볼 수 있어요." : "Save this title to add a reflection. Existing entries remain available below."}</p>
      <button className="btn" disabled={busy} onClick={onSaveTitle}>{ko ? "작품 저장하고 기록하기" : "Save title and start recording"}</button></div>
      : editing ? <WatchEditor album={album} service={service} locale={locale} onCancel={() => setEditing(false)} onSaved={(result) => {
        onSaved(result); setEditing(false); setSaved(true); setTrackingConflict(Boolean(result.trackingConflict));
      }} /> : null}
    {saved && <p role="status">{trackingConflict
      ? ko ? "감상은 저장됐어요. 다른 곳에서 바뀐 작품 상태는 유지했어요." : "The entry was saved. Newer title details were kept."
      : ko ? "감상 기록을 저장했어요." : "Watch record saved."}</p>}
    {managementMessage && <p role="status">{managementMessage}</p>}
    {album.tracking.isSaved && !editing && !editingLogId && (editingTitle
      ? <TitleCurrentDetailsEditor album={album} service={service} locale={locale} onCancel={() => setEditingTitle(false)}
        onSaved={() => { setEditingTitle(false); onTitleDetailsSaved(); setManagementMessage(ko ? "작품 정보를 수정했어요." : "Title details saved."); }} />
      : <button type="button" className="btn btn--subtle title-watch-records__details-action"
        onClick={() => { setManagementMessage(""); setEditingTitle(true); }}>{ko ? "현재 상태·작품 메모 수정" : "Edit status and title memo"}</button>)}
    {album.anilistId && album.tracking.isSaved && !editing && <details className="title-watch-records__management">
      <summary>{ko ? "이전 서재의 추가 설정" : "Additional settings in the older library"}</summary>
      <a className="btn btn--subtle" data-astro-reload href={`${base}library/?${new URLSearchParams({ animeId: String(album.anilistId), focus: "edit" })}`}>
        {ko ? "캐릭터·관계 설정 열기 →" : "Open character and relation settings →"}
      </a>
    </details>}
    {album.libraryItem?.memo && <section className="title-watch-records__legacy"><h3>{ko ? "기존 감상 메모" : "Earlier reflection"}</h3><p>{album.libraryItem.memo}</p></section>}
    <ol className="title-watch-records__timeline">{album.watchLogs.map((log) => <li key={log.id}>
      {editingLogId === log.id ? <HistoricalWatchLogEditor album={album} log={log} service={service} locale={locale}
        onCancel={() => setEditingLogId(null)} onSaved={updated => { onLogChanged(updated); setEditingLogId(null);
          setManagementMessage(ko ? "수정했어요." : "Changes saved."); }} /> : <>
      <header><strong>{eventLabel(log.eventType, ko)}</strong><span>{log.watchedAtPrecision === "unknown" ? ko ? "날짜 미상" : "Date unknown" : log.watchedAtValue}</span>
        {log.scoreAtThatTime != null && <span>{ko ? "별점" : "Rating"} {log.scoreAtThatTime}/5</span>}
        <span className="title-watch-records__row-actions"><button type="button" className="channel-text-button" disabled={Boolean(deletingId) || editing || editingTitle}
          onClick={() => { setManagementMessage(""); setEditingLogId(log.id); }}>{ko ? "수정" : "Edit"}</button>
          <button type="button" className="channel-text-button" disabled={Boolean(deletingId) || editing || editingTitle}
            onClick={() => removeLog(log)}>{deletingId === log.id ? (ko ? "삭제 중…" : "Deleting…") : (ko ? "삭제" : "Delete")}</button></span></header>
      {log.cue && <h3>{log.cue}</h3>}{log.note && <p>{log.note}</p>}
      {!!log.contextTags?.length && <p className="watch-record-help">{log.contextTags.join(" · ")}</p>}
      {!!log.characterRefs?.length && <p className="watch-record-help">{log.characterRefs.map((ref) => ref.nameSnapshot).join(" · ")}</p>}
      </>}
    </li>)}</ol>
    {!album.watchLogs.length && !editing && <p className="watch-record-help">{ko ? "시청을 시작한 날, 마친 날, 다시 본 감상을 차곡차곡 남겨 보세요." : "Keep a history of first viewings, completions and rewatches."}</p>}
  </section>;
}
