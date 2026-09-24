import { useEffect, useRef, useState } from "react";
import { useAuthSession } from "../../../hooks/useAuthSession.js";
import { useUnsavedNavigation } from "../../../hooks/useUnsavedNavigation.js";
import { getPublicationServices, safetyUiEnabled } from "../runtime/platformPublication.js";
import { isPublicationId } from "../domain/publicationView.js";

function useSafetyRequest(userId) {
  const services = getPublicationServices(), current = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => () => { current.current?.abort(); current.current = null; }, [userId]);
  async function run(task) {
    if (current.current) return;
    const request = new AbortController(); current.current = request;
    const timer = setTimeout(() => request.abort(), 20000);
    setBusy(true); setError("");
    try {
      if ((await services.getSession())?.user?.id !== userId || request.signal.aborted) throw new Error("AUTH_REQUIRED");
      const result = await task(services.gateway, { signal: request.signal });
      const user = (await services.getSession())?.user?.id;
      if (request.signal.aborted || user !== userId) throw new Error("AUTH_REQUIRED");
      return result;
    } catch (error) { if (current.current === request) setError(error?.code === "RATE_LIMITED" ? "limit" : "failed"); }
    finally { clearTimeout(timer); if (current.current === request) { current.current = null; setBusy(false); } }
  }
  return { run, busy, error };
}
function ErrorMessage({ error, ko }) {
  return error ? <p role="alert">{error === "limit" ? (ko ? "접수 한도에 도달했습니다. 나중에 다시 시도해 주세요." : "Report limit reached. Please try again later.") : (ko ? "처리하지 못했습니다. 다시 시도해 주세요." : "Unable to complete. Please try again.")}</p> : null;
}
function Report({ userId, kind, target, locale, base }) {
  const ko = locale === "ko", { run, busy, error } = useSafetyRequest(userId);
  const [open, setOpen] = useState(false), [category, setCategory] = useState("SAFETY"), [note, setNote] = useState(""), [receipt, setReceipt] = useState(null);
  const operation = useRef(null);
  useUnsavedNavigation(open && !receipt && Boolean(note || category !== "SAFETY"), locale, { busy });
  const submit = async (event) => {
    event.preventDefault(); operation.current ||= crypto.randomUUID();
    const result = await run(async (gateway, options) => {
      const value = await gateway.report({ kind, target, category, note, operation: operation.current }, options);
      if (!isPublicationId(value?.id) || !["RECEIVED", "APPEALED", "CLOSED"].includes(value.status)) throw new Error();
      return value;
    });
    if (result) { setReceipt(result); setNote(""); }
  };
  return <section aria-label={ko ? "공개 자료 신고" : "Report public content"}>
    {!open && <button className="btn btn--subtle" onClick={() => setOpen(true)}>{ko ? "신고" : "Report content"}</button>}
    {open && (receipt ? <p role="status">{ko ? "신고를 접수했습니다. 접수 번호: " : "Report received. Receipt: "}{receipt.id} <a href={`${base}minihome/#safety`}>{ko ? "내 접수 내역" : "My safety inbox"}</a></p> : <form onSubmit={submit}>
      <h2>{ko ? "공개 자료 신고" : "Report public content"}</h2>
      <p>{ko ? "공개 대상과 아래 설명만 전달합니다. 비밀번호나 비공개 기록은 적지 마세요." : "Only this public target and your description are submitted. Do not include passwords or private records."}</p>
      <fieldset disabled={busy}>
        <label>{ko ? "신고 분류" : "Report category"}<select value={category} onChange={(e) => { setCategory(e.target.value); operation.current = null; }}>{["SAFETY", "RIGHTS", "SPAM", "OTHER"].map((value, i) => <option key={value} value={value}>{(ko ? ["안전 문제", "권리 침해", "스팸", "기타"] : ["Safety", "Rights", "Spam", "Other"])[i]}</option>)}</select></label>
        <label>{ko ? "신고 설명 (선택)" : "Report details (optional)"}<textarea maxLength={1000} value={note} onChange={(e) => { setNote(e.target.value); operation.current = null; }} /></label>
        <button type="submit" className="btn">{ko ? "신고 접수" : "Submit report"}</button>
        <button type="button" className="btn btn--subtle" onClick={() => { if ((note || category !== "SAFETY") && !confirm(ko ? "작성한 신고를 취소할까요?" : "Discard this report draft?")) return; setOpen(false); setNote(""); setCategory("SAFETY"); operation.current = null; }}>{ko ? "취소" : "Cancel report"}</button>
      </fieldset><ErrorMessage error={error} ko={ko} />
    </form>)}
  </section>;
}
function Notice({ row, userId, ko, base, onAppealed }) {
  const [text, setText] = useState(""), { run, busy, error } = useSafetyRequest(userId);
  useUnsavedNavigation(Boolean(text), ko ? "ko" : "en", { busy });
  const actions = { HIDE: ko ? "공개 자료 임시 가림" : "Public content hidden", RESTORE: ko ? "운영 가림 해제" : "Moderation hide removed", KEEP: ko ? "검토 완료" : "Review completed", RESTRICT_ACCOUNT: ko ? "공개 쓰기 제한" : "Public writes restricted", RELEASE_ACCOUNT: ko ? "해당 사건의 쓰기 제한 해제" : "This case's write restriction released" };
  return <li><p>{actions[row.action] || (ko ? "운영 알림" : "Moderation notice")}</p><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{row.reason}</p>
    <p><a href={`${base}public/${row.targetKind}/?id=${encodeURIComponent(row.targetId)}`}>{row.targetKind === "home" ? (ko ? "대상 미니홈 보기" : "View reported home") : (ko ? "대상 공개 보드 보기" : "View reported Board")}</a></p>
    {row.appealed ? <p role="status">{ko ? "이의제기를 접수했습니다." : "Appeal received."}</p> : <form onSubmit={async (e) => {
      e.preventDefault(); const result = await run(async (gateway, options) => {
        const value = await gateway.appeal(row.id, text, options);
        if (value?.id !== row.id || value.appealed !== true) throw new Error(); return value;
      });
      if (result) { setText(""); onAppealed(row.id); }
    }}><label>{ko ? "이의제기 사유" : "Appeal reason"}<textarea required maxLength={1000} disabled={busy} value={text} onChange={(e) => setText(e.target.value)} /></label><button className="btn" disabled={busy || !text.trim()}>{ko ? "이의제기 접수" : "Submit appeal"}</button><ErrorMessage error={error} ko={ko} /></form>}
  </li>;
}
function Inbox({ userId, locale, base }) {
  const ko = locale === "ko", { run, busy, error } = useSafetyRequest(userId);
  const [data, setData] = useState(null);
  async function load(after = null) {
    const result = await run(async (gateway, options) => {
      const value = await gateway.safety(after, options);
      if (!Array.isArray(value?.items) || value.items.length > 20 || (value.next !== null && !isPublicationId(value.next))
        || value.items.some((r) => !isPublicationId(r.id) || !isPublicationId(r.targetId) || !["home", "board"].includes(r.targetKind) || !["REPORT", "NOTICE"].includes(r.type)
          || (r.type === "NOTICE" && (typeof r.reason !== "string" || r.reason.length > 500 || typeof r.appealed !== "boolean")))) throw new Error();
      return value;
    });
    if (result) setData((old) => after ? { ...result, items: [...new Map([...(old?.items || []), ...result.items].map((r) => [r.id, r])).values()] } : result);
  }
  useEffect(() => { load(); }, [userId]);
  return <section className="memory-safety" id="safety"><h2>{ko ? "내 신고·운영 알림" : "My safety inbox"}</h2>
    <button className="btn btn--subtle" disabled={busy} onClick={() => load()}>{ko ? "알림 새로고침" : "Refresh safety inbox"}</button><ErrorMessage error={error} ko={ko} />
    {data?.items.length === 0 && <p>{ko ? "접수 내역과 알림이 없습니다." : "No reports or notices."}</p>}
    <ul>{data?.items.map((row) => row.type === "NOTICE" ? <Notice key={row.id} row={row} ko={ko} base={base} userId={userId} onAppealed={(id) => setData((d) => ({ ...d, items: d.items.map((r) => r.id === id ? { ...r, appealed: true } : r) }))} />
      : <li key={row.id}>{ko ? "신고 접수" : "Report receipt"}: {row.id} — {row.status === "CLOSED" ? (ko ? "검토 완료" : "Reviewed") : (ko ? "검토 대기" : "Awaiting review")}</li>)}</ul>
    {data?.next && <button className="btn btn--subtle" disabled={busy} onClick={() => load(data.next)}>{ko ? "더 보기" : "More safety updates"}</button>}
  </section>;
}
export default function MemorySafety({ kind, target, locale, base = "/" }) {
  const auth = useAuthSession(), [failed, setFailed] = useState(false);
  if (!safetyUiEnabled() || auth.loading) return null;
  if (!auth.user) return kind ? <section><button className="btn btn--subtle" onClick={() => auth.signIn(`${base}public/${kind}/?id=${encodeURIComponent(target)}`).catch(() => setFailed(true))}>{locale === "ko" ? "로그인 후 신고" : "Sign in to report"}</button><ErrorMessage error={failed ? "failed" : ""} ko={locale === "ko"} /></section> : null;
  return kind ? <div className="memory-safety"><Report key={`${auth.user.id}:${kind}:${target}`} userId={auth.user.id} kind={kind} target={target} locale={locale} base={base} /></div>
    : <Inbox key={auth.user.id} userId={auth.user.id} locale={locale} base={base} />;
}
