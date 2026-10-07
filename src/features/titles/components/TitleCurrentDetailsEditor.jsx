import { useMemo, useState } from "react";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { WATCH_STATUSES, normalizeWatchStatus } from "../domain/titleWatchRecord.js";

export default function TitleCurrentDetailsEditor({ album, service, locale, onSaved, onCancel }) {
  const ko = locale === "ko";
  const initial = useMemo(() => ({ status: normalizeWatchStatus(album.libraryItem?.status), score: album.tracking.rating ?? "",
    rewatchCount: album.tracking.rewatchCount || 0, lastRewatchAt: album.tracking.lastRewatchAt || "",
    memo: album.libraryItem?.memo || "" }), [album]);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const allowLeave = useUnsavedNavigation(dirty, locale, { busy });
  const patch = update => setDraft(current => ({ ...current, ...update }));
  const cancel = () => {
    if (dirty && !window.confirm(ko ? "수정 중인 내용을 버릴까요?" : "Discard your changes?")) return;
    allowLeave(); onCancel();
  };
  const save = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await service.updateTitleDetails(album, draft);
      allowLeave(); onSaved();
    } catch (error) {
      setMessage(error.message === "TITLE_TRACKING_CONFLICT"
        ? (ko ? "다른 곳에서 작품 정보가 바뀌었어요. 최신 내용을 확인한 뒤 다시 열어 주세요." : "Title details changed elsewhere. Review them and reopen this editor.")
        : (ko ? "저장하지 못했어요. 입력은 남아 있어요." : "Could not save. Your changes are still here."));
    } finally { setBusy(false); }
  };
  return <form className="watch-record-editor watch-record-editor--historical" onSubmit={save}
    aria-label={ko ? "현재 작품 정보 수정" : "Edit current title details"}>
    <h3>{ko ? "현재 작품 정보" : "Current title details"}</h3>
    <p className="watch-record-help">{ko ? "여기서 바꾼 상태는 과거 감상 기록을 수정하지 않아요." : "Changes here do not edit earlier watch records."}</p>
    <div className="watch-record-editor__event-row">
      <label>{ko ? "시청 상태" : "Watch status"}<select disabled={busy} value={draft.status}
        onChange={event => patch({ status: event.target.value })}>
        {WATCH_STATUSES.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      <label>{ko ? "내 평점" : "Current rating"}<input disabled={busy} type="number" min="0" max="5" step="0.5"
        value={draft.score} onChange={event => patch({ score: event.target.value })} /></label>
      <label>{ko ? "다시 정주행한 횟수" : "Rewatch count"}<input disabled={busy} type="number" min="0" max="999" step="1"
        value={draft.rewatchCount} onChange={event => patch({ rewatchCount: event.target.value })} /></label>
    </div>
    <label>{ko ? "최근 다시 본 날" : "Last rewatch date"}<input disabled={busy} type="date"
      value={draft.lastRewatchAt} onChange={event => patch({ lastRewatchAt: event.target.value })} /></label>
    <label>{ko ? "작품 메모" : "Title memo"}<textarea disabled={busy} rows={4} maxLength={10000}
      value={draft.memo} onChange={event => patch({ memo: event.target.value })} /></label>
    {message && <p role="alert">{message}</p>}
    <div className="watch-record-editor__actions"><button className="btn" disabled={busy}>{busy ? (ko ? "저장 중…" : "Saving…") : (ko ? "변경 저장" : "Save changes")}</button>
      <button type="button" className="btn btn--subtle" disabled={busy} onClick={cancel}>{ko ? "취소" : "Cancel"}</button></div>
  </form>;
}
