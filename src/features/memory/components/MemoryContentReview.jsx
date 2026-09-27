import { useEffect, useId, useMemo, useState } from 'react';
import { useAuthSession } from '../../../hooks/useAuthSession.js';
import MemoryRouteShell, { useMemoryRouteUi } from './MemoryRouteShell.jsx';
import { useSafetyRequest } from './MemorySafety.jsx';
import { contentReviewUiEnabled, getPublicationServices } from '../runtime/platformPublication.js';
import { isPublicationId, publicationSnapshot } from '../domain/publicationView.js';
import PublicBoardSnapshot from './PublicBoardSnapshot.jsx';

function checkedReview(value) {
  if (!isPublicationId(value?.id) || !isPublicationId(value.target) || !['board', 'home'].includes(value.kind)
    || !['RECEIVED', 'APPEALED', 'CLOSED'].includes(value.status)
    || !Number.isSafeInteger(value.caseRevision) || value.caseRevision < 0
    || !Number.isSafeInteger(value.contentRevision) || value.contentRevision < 0
    || !/^[a-f0-9]{64}$/.test(value.reviewHash || '') || typeof value.policyRevision !== 'string'
    || !value.policyRevision.length || value.policyRevision.length > 120) throw new Error('INVALID_REVIEW');
  let snapshot;
  if (value.kind === 'board') snapshot = publicationSnapshot(value.snapshot);
  else {
    const home = value.snapshot;
    if (typeof home?.nickname !== 'string' || home.nickname.length > 60 || typeof home.bio !== 'string'
      || home.bio.length > 500 || !Array.isArray(home.entries) || home.entries.length > 100) throw new Error('INVALID_REVIEW');
    snapshot = { nickname: home.nickname, bio: home.bio };
  }
  return { id: value.id, target: value.target, kind: value.kind, status: value.status, caseRevision: value.caseRevision,
    contentRevision: value.contentRevision, reviewHash: value.reviewHash, policyRevision: value.policyRevision, snapshot };
}

function Decision({ review, ko, busy, onSave }) {
  const ratingId = useId();
  const [rating, setRating] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [ready, setReady] = useState(review.kind === 'home');
  const services = useMemo(() => {
    const base = getPublicationServices();
    return { ...base, previewImage: (id, signal) => base.contentReviewImage(review, id, signal) };
  }, [review]);
  return <section aria-label={ko ? '콘텐츠 검토' : 'Content review'}>
    {review.kind === 'board'
      ? <PublicBoardSnapshot snapshot={review.snapshot} publicationId={review.target} services={services} preview locale={ko ? 'ko' : 'en'} onReady={setReady} />
      : <><h2>{review.snapshot.nickname}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{review.snapshot.bio}</p>
        <p>{ko ? '미니홈 이름과 소개를 검토합니다. 연결된 보드는 각각 별도로 검토합니다.' : 'Review this home name and introduction. Linked boards are reviewed separately.'}</p></>}
    <form onSubmit={async e => { e.preventDefault(); if (ready && confirmed && rating) { await onSave(review, rating); setConfirmed(false); } }}>
      <fieldset disabled={busy || review.status === 'CLOSED'}>
        <label htmlFor={ratingId}>{ko ? '공개 분류' : 'Content classification'}</label><select id={ratingId} value={rating} onChange={e => { setRating(e.target.value); setConfirmed(false); }}>
          <option value="">{ko ? '분류 선택' : 'Choose classification'}</option>
          <option value="GENERAL">{ko ? '일반 공개' : 'General content'}</option>
          <option value="MATURE">{ko ? '성인용 — 공개 불가' : 'Adult content — public sharing unavailable'}</option>
          <option value="BLOCKED">{ko ? '공개 허용 범위 밖' : 'Outside public policy'}</option>
        </select>
        <label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{ko ? '표시된 내용과 선택한 분류를 확인했습니다.' : 'I reviewed the displayed content and selected classification.'}</label>
        {!ready && <p role="status">{ko ? '모든 이미지를 확인한 뒤 결정할 수 있습니다.' : 'All images must load before a decision can be submitted.'}</p>}
        <button className="btn" disabled={!ready || !confirmed || !rating}>{ko ? '검토 결과 저장' : 'Save review decision'}</button>
      </fieldset>
    </form>
  </section>;
}

function Workspace({ userId, ko }) {
  const { run, busy, error } = useSafetyRequest(userId);
  const [mode, setMode] = useState('board'), [rows, setRows] = useState([]), [next, setNext] = useState(null);
  const [review, setReview] = useState(null), [saved, setSaved] = useState(false);
  async function load(kind = mode, after = null) {
    setReview(null); setSaved(false);
    const result = await run(async (gateway, options) => {
      const value = kind === 'appeals' ? await gateway.moderationCases(after, options) : await gateway.pendingContent(kind, after, options);
      if (!Array.isArray(value?.items) || value.items.length > 20 || (value.next !== null && !isPublicationId(value.next))
        || value.items.some(row => !isPublicationId(row?.id))) throw new Error('INVALID_QUEUE');
      return { ...value, items: kind === 'appeals' ? value.items.filter(row => row.reviewType === 'CONTENT' && row.status === 'APPEALED') : value.items };
    });
    if (result) { setMode(kind); setRows(old => after ? [...old, ...result.items] : result.items); setNext(result.next); }
  }
  useEffect(() => { load('board'); }, [userId]);
  async function open(row) {
    setReview(null); setSaved(false);
    const result = await run(async (gateway, options) => checkedReview(mode === 'appeals'
      ? await gateway.contentReview(row.id, options) : await gateway.openContentReview(mode, row.id, options)));
    if (result) setReview(result);
  }
  async function save(value, rating) {
    const result = await run(async (gateway, options) => {
      const answer = await gateway.resolveContentReview(value, rating, options);
      if (answer?.id !== value.id || answer.status !== 'CLOSED' || answer.contentRevision !== value.contentRevision + 1) throw new Error('INVALID_RESULT');
      return answer;
    });
    if (result) { setReview(null); setSaved(true); setRows(old => old.filter(row => row.id !== (mode === 'appeals' ? value.id : value.target))); }
  }
  return <>
    <nav aria-label={ko ? '검토 목록' : 'Review queues'}>{[['board', ko ? '보드' : 'Boards'], ['home', ko ? '미니홈' : 'Homes'], ['appeals', ko ? '이의 신청' : 'Appeals']].map(([kind, label]) =>
      <button key={kind} className="btn" disabled={busy} aria-pressed={mode === kind} onClick={() => load(kind)}>{label}</button>)}</nav>
    <button className="btn btn--subtle" disabled={busy} onClick={() => load()}>{ko ? '목록 새로고침' : 'Refresh review queue'}</button>
    {error && <p role="alert">{ko ? '검토 내용을 확인하지 못했습니다. 권한을 확인하고 목록을 새로고침해 주세요.' : 'Could not complete review. Check your access and refresh the queue.'}</p>}
    {saved && <p role="status">{ko ? '검토 결과를 저장했습니다.' : 'Review decision saved.'}</p>}
    <ul>{rows.map(row => <li key={row.id}><button className="btn btn--subtle" disabled={busy} onClick={() => open(row)}>
      {typeof row.label === 'string' ? row.label : (ko ? '이의 신청 검토' : 'Review appeal')}</button></li>)}</ul>
    {next && <button className="btn" disabled={busy} onClick={() => load(mode, next)}>{ko ? '더 보기' : 'More review targets'}</button>}
    {review && <Decision key={`${review.id}:${review.reviewHash}:${review.contentRevision}`} review={review} ko={ko} busy={busy} onSave={save} />}
  </>;
}
function Content() {
  const { locale } = useMemoryRouteUi(), auth = useAuthSession(), ko = locale === 'ko';
  return <main className="page-shell page-shell--narrow"><h1>{ko ? '공개 콘텐츠 검토' : 'Public content review'}</h1>
    {!contentReviewUiEnabled() ? <p>{ko ? '검토 도구가 비활성 상태입니다.' : 'Review tools are disabled.'}</p>
      : !auth.user ? <p>{ko ? '운영자 계정으로 로그인해 주세요.' : 'Sign in with your moderator account.'}</p>
      : <Workspace key={auth.user.id} userId={auth.user.id} ko={ko} />}</main>;
}
export default function MemoryContentReview({ base = '/' }) {
  return <MemoryRouteShell base={base} currentRoute="boards"><Content /></MemoryRouteShell>;
}
