import { useEffect, useId, useState } from 'react';
import { useSafetyRequest } from './MemorySafety.jsx';
import { isPublicationId } from '../domain/publicationView.js';

function checkedCase(row) {
  if (!isPublicationId(row?.id) || !isPublicationId(row.target) || !['board', 'home'].includes(row.kind)
    || row.reviewType !== 'REPORT' || !['RECEIVED', 'APPEALED', 'CLOSED'].includes(row.status)
    || !Number.isSafeInteger(row.revision) || row.revision < 0
    || !Number.isSafeInteger(row.targetRevision) || row.targetRevision < 0
    || typeof row.note !== 'string' || row.note.length > 1000 || !Array.isArray(row.appeals)
    || row.appeals.some(a => typeof a?.text !== 'string' || a.text.length > 1000)) throw new Error('INVALID_REPORT');
  return row;
}

export default function MemoryReportReview({ userId, ko, base = '/' }) {
  const { run, busy, error } = useSafetyRequest(userId);
  const actionId = useId();
  const [rows, setRows] = useState([]), [next, setNext] = useState(null), [selected, setSelected] = useState(null);
  const [audit, setAudit] = useState([]), [action, setAction] = useState(''), [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false), [saved, setSaved] = useState(false);
  const clear = () => { setSelected(null); setAudit([]); setAction(''); setReason(''); setConfirmed(false); };
  async function load(after = null) {
    clear(); setSaved(false);
    const result = await run(async (gateway, options) => {
      const value = await gateway.moderationCases(after, options);
      if (!Array.isArray(value?.items) || value.items.length > 20 || (value.next !== null && !isPublicationId(value.next))) throw new Error('INVALID_QUEUE');
      return { ...value, items: value.items.filter(row => row.reviewType === 'REPORT').map(checkedCase) };
    });
    if (result) { setRows(old => after ? [...old, ...result.items] : result.items); setNext(result.next); }
    else { setRows([]); setNext(null); }
  }
  useEffect(() => { load(); }, [userId]);
  async function open(row) {
    clear(); setSaved(false);
    const result = await run(async (gateway, options) => {
      const value = await gateway.moderationAudit(row.id, options);
      if (!Array.isArray(value) || value.length > 50 || value.some(item => typeof item?.action !== 'string' || typeof item.reason !== 'string')) throw new Error('INVALID_AUDIT');
      return value;
    });
    if (result) { setSelected(row); setAudit(result); }
  }
  async function save(event) {
    event.preventDefault();
    if (!selected || !confirmed || !['KEEP', 'HIDE', 'RESTORE'].includes(action) || !reason.trim()) return;
    const result = await run(async (gateway, options) => {
      const value = await gateway.reviewReport(selected, action, reason.trim(), options);
      if (value?.id !== selected.id || value.status !== 'CLOSED' || value.revision !== selected.revision + 1
        || value.targetRevision !== selected.targetRevision + 1) throw new Error('INVALID_RESULT');
      return value;
    });
    // A lost response may have committed: never submit again with this stale case.
    clear(); setRows([]); setNext(null); setSaved(Boolean(result));
  }
  return <section aria-label={ko ? '신고 처리' : 'Report review'} style={{ marginTop: '1rem', minWidth: 0, overflowWrap: 'anywhere' }}>
    <button className="btn" disabled={busy} onClick={() => load()}>{ko ? '신고 목록 새로고침' : 'Refresh reports'}</button>
    {error && <p role="alert">{ko ? '처리 결과를 확인하지 못했습니다. 목록을 새로고침해 최신 상태를 확인한 뒤 다시 선택해 주세요.' : 'Could not confirm the result. Refresh the reports and select the current case before continuing.'}</p>}
    {saved && <p role="status">{ko ? '조치를 저장했습니다. 목록을 새로고침하면 최신 상태를 확인할 수 있습니다.' : 'Action saved. Refresh reports to see the current state.'}</p>}
    {!rows.length && !busy && !error && !saved && <p>{ko ? '이 페이지에 일반 신고가 없습니다.' : 'No general reports on this page.'}</p>}
    <ul>{rows.map(row => <li key={row.id}><button className="btn btn--subtle" style={{ maxWidth: '100%', whiteSpace: 'normal', textAlign: 'start', overflowWrap: 'anywhere' }} disabled={busy} onClick={() => open(row)}>{ko ? '신고' : 'Report'} {row.id} · {row.status}</button></li>)}</ul>
    {next && <button className="btn" disabled={busy} onClick={() => load(next)}>{ko ? '신고 더 보기' : 'More reports'}</button>}
    {selected && <section aria-label={ko ? '선택한 신고' : 'Selected report'}>
      <h2>{ko ? '신고 내용' : 'Report details'}</h2>
      <p>{selected.category} · {selected.status}</p><p style={{ whiteSpace: 'pre-wrap' }}>{selected.note}</p>
      <a href={base + 'public/' + selected.kind + '/?id=' + selected.target} target="_blank" rel="noopener noreferrer">{ko ? '신고된 공개 자료 열기' : 'Open reported public content'}</a>
      {selected.appeals.map((appeal, i) => <p key={i} style={{ whiteSpace: 'pre-wrap' }}>{ko ? '이의 신청: ' : 'Appeal: '}{appeal.text}</p>)}
      <h3>{ko ? '조치 이력' : 'Action history'}</h3>
      <ul>{audit.map((item, i) => <li key={i}>{item.action} · {item.reason}</li>)}</ul>
      <form onSubmit={save}><fieldset disabled={busy} style={{ display: 'grid', gap: '0.75rem', minWidth: 0, padding: '1rem', border: '1px solid var(--border-color, #ddd)' }}>
        <label htmlFor={actionId}>{ko ? '신고 조치' : 'Report action'}</label><select id={actionId} style={{ width: '100%', minWidth: 0, padding: '0.6rem', font: 'inherit' }} value={action} onChange={e => { setAction(e.target.value); setConfirmed(false); }}>
          <option value="">{ko ? '조치 선택' : 'Choose action'}</option>
          <option value="KEEP">{ko ? '검토 완료 — 현 상태 유지' : 'Complete review — keep current state'}</option>
          <option value="HIDE">{ko ? '공개 자료 임시 가림' : 'Temporarily hide public content'}</option>
          <option value="RESTORE">{ko ? '운영 가림 해제' : 'Remove moderation hide'}</option>
        </select>
        <label>{ko ? '작성자에게 전달할 사유' : 'Reason sent to the author'}<textarea rows={4} style={{ display: 'block', boxSizing: 'border-box', width: '100%', marginTop: '0.5rem', padding: '0.6rem', font: 'inherit' }} maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
        <p>{ko ? '가림 해제는 작성자가 철회하거나 삭제한 자료를 다시 게시하지 않습니다.' : 'Removing a moderation hide does not republish content withdrawn or deleted by its author.'}</p>
        <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{ko ? '신고 대상과 조치·사유를 확인했습니다.' : 'I reviewed the target, action and reason.'}</label>
        <button className="btn" style={{ justifySelf: 'start' }} disabled={!action || !reason.trim() || !confirmed}>{ko ? '신고 조치 저장' : 'Save report action'}</button>
      </fieldset></form>
    </section>}
  </section>;
}
