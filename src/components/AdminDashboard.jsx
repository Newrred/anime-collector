import {useEffect, useRef, useState} from 'react';
import MemoryRouteShell, {useMemoryRouteUi} from '../features/memory/components/MemoryRouteShell.jsx';
import {useAuthSession} from '../hooks/useAuthSession.js';
import {supabase} from '../lib/supabaseClient.js';
import {resolveSignupDocuments} from '../features/auth/signupDocuments.js';
import {createAdminService} from '../features/admin/adminService.js';
import {useAdminStatus} from '../features/admin/useAdminStatus.js';
import {adminUiEnabled} from '../features/admin/AdminEntry.jsx';

const service = createAdminService(supabase);
const cleanupRuns = 'https://github.com/Newrred/anime-collector/actions/workflows/private-image-cleanup.yml';
const scopeLabels = {
  SYNC_MEMORY_PRIVATE_TITLES: ['개인 작품', 'Private titles'], SYNC_MEMORY_CARDS: ['기억', 'Memories'],
  SYNC_MEMORY_VISUAL_ASSETS: ['기억 이미지', 'Memory visuals'], SYNC_MEMORY_BOARDS: ['보드', 'Boards'],
  SYNC_MEMORY_BOARD_CARDS: ['보드에 담기', 'Board entries'], SYNC_USER_DEVICES: ['연결 기기', 'Connected devices'],
  PUBLIC_PREPARE: ['공개 준비', 'Prepare publishing'], PUBLIC_PUBLISH: ['공개 게시', 'Publishing'],
  FOLLOW_WRITE: ['팔로우', 'Following'], IMAGE_ATTEMPT: ['사진 저장 시도', 'Image save attempts'],
  IMAGE_DELIVERY: ['사진 불러오기', 'Image requests'], IMAGE_DELIVERY_BYTES: ['사진 전송량', 'Image delivery bytes'],
};
const errorCopy = {
  ADMIN_REQUIRED: ['이 계정에는 운영 권한이 없습니다.', 'This account does not have admin access.'],
  ADMIN_REVISION_CONFLICT: ['다른 곳에서 설정이 바뀌었습니다. 최신 상태를 확인한 뒤 다시 선택해 주세요.', 'Settings changed elsewhere. Review the refreshed status before choosing again.'],
  ADMIN_ACTIVATION_REQUIRED: ['가입 설정이 아직 연결되지 않았습니다. 이 화면에서는 처음 활성화할 수 없습니다.', 'Signup setup is not connected yet. Initial activation is not available here.'],
  ADMIN_RELEASE_NOT_READY: ['가입 정책과 약관을 확인해야 재개할 수 있습니다.', 'The signup policy and documents need review before resuming.'],
};

function Facts({rows}) {
  return <dl className="admin-facts">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function Workspace({status, ko, base}) {
  const {data, phase, error, notice, refresh, setPaused} = status;
  const [confirmation, setConfirmation] = useState(null);
  const confirmRef = useRef(null), triggerRef = useRef(null);
  useEffect(() => { setConfirmation(null); }, [data?.revision, phase]);
  useEffect(() => { if (confirmation !== null) confirmRef.current?.focus(); }, [confirmation]);
  const t = (a, b) => ko ? a : b;
  const enabled = value => value ? t('켜짐', 'On') : t('꺼짐', 'Off');
  const number = value => value.toLocaleString(ko ? 'ko-KR' : 'en-US');
  const bytes = value => `${(value / 1024 / 1024).toLocaleString(ko ? 'ko-KR' : 'en-US', {maximumFractionDigits: 1})} MiB`;
  const usageValue = (scope, value) => scope === 'IMAGE_DELIVERY_BYTES' ? bytes(value) : number(value);
  const time = value => new Date(value).toLocaleString(ko ? 'ko-KR' : 'en-GB');
  const cancel = () => { setConfirmation(null); triggerRef.current?.focus(); };
  const publicOn = data && Object.values(data.publication).filter(Boolean).length;
  return <>
    <div className="admin-toolbar">
      <p>{data ? t(`마지막 확인 ${time(data.checkedAt)}`, `Last checked ${time(data.checkedAt)}`) : t('운영 상태', 'Service status')}</p>
      <button className="btn btn--subtle" disabled={phase === 'loading'} onClick={() => { setConfirmation(null); refresh(); }}>{t('새로고침', 'Refresh')}</button>
    </div>
    {error && <p className="admin-message" role="alert">{(errorCopy[error] || [
      '상태를 확인하지 못했습니다. 연결을 확인하고 새로고침해 주세요.', 'Could not verify the status. Check your connection and refresh.',
    ])[ko ? 0 : 1]}</p>}
    {notice && <p className="admin-message" role="status">{notice === 'paused' ? t('새 가입을 일시중지했습니다.', 'New signups paused.') : t('새 가입을 재개했습니다.', 'New signups resumed.')}</p>}
    {phase === 'loading' && <p role="status">{t('권한과 운영 상태를 확인하고 있습니다.', 'Checking access and service status.')}</p>}
    {data && <div className="admin-sections">
      <section className="admin-signup" aria-labelledby="admin-signup-heading">
        <div className="admin-signup-top"><div className="admin-section-heading"><h2 id="admin-signup-heading">{t('신규 가입', 'New signups')}</h2><strong className="admin-state">{!data.signup.admissionEnabled ? t('운영 연결 전', 'Not connected') : data.signup.enabled ? t('가입 가능', 'Open') : t('일시중지', 'Paused')}</strong></div>
          <button className="btn btn--subtle" ref={triggerRef}
          disabled={data.signup.enabled ? !(data.signup.canPause && data.signup.admissionEnabled) : !(data.signup.canResume && data.signup.readyForResume && data.signup.admissionEnabled)}
          onClick={() => setConfirmation({revision: data.revision, paused: data.signup.enabled})}>
          {data.signup.enabled ? t('새 가입 일시중지', 'Pause new signups') : t('새 가입 재개', 'Resume new signups')}
          </button>
        </div>
        {(!data.signup.admissionEnabled || (!data.signup.enabled && !data.signup.readyForResume)) && <p className="admin-muted">{t('가입 설정과 약관 확인이 끝나야 재개할 수 있습니다.', 'Signup setup and document review must be complete before resuming.')}</p>}
        {confirmation && <div className="admin-confirm" role="group" aria-labelledby="admin-confirm-heading" onKeyDown={event => { if (event.key === 'Escape') cancel(); }}>
          <h3 id="admin-confirm-heading">{confirmation.paused ? t('새 가입을 일시중지할까요?', 'Pause new signups?') : t('새 가입을 재개할까요?', 'Resume new signups?')}</h3>
          <p>{confirmation.paused ? t('새 계정만 받지 않습니다. 기존 계정과 기록은 그대로 유지됩니다.', 'Only new signups stop. Existing accounts and memories are unchanged.') : t('현재 표시된 국가·연령 기준과 약관으로 가입을 다시 받습니다.', 'Signups reopen with the country, age and document settings shown here.')}</p>
          <div className="admin-actions"><button ref={confirmRef} className="btn" onClick={() => { const choice = confirmation; setConfirmation(null); setPaused(choice.revision, choice.paused); }}>{confirmation.paused ? t('일시중지 확인', 'Confirm pause') : t('재개 확인', 'Confirm resume')}</button>
            <button className="btn btn--subtle" onClick={cancel}>{t('취소', 'Cancel')}</button></div>
        </div>}
        <h3>{t('국가별 최소 연령', 'Minimum signup ages')}</h3>
        {data.signup.countries.length === 0 ? <p>{t('설정된 국가가 없습니다.', 'No countries configured.')}</p> : <ul className="admin-countries">{data.signup.countries.map(row => <li key={row.country}><span>{countryName(row.country, ko)}</span><strong>{t(`만 ${row.minimumAge}세`, `Age ${row.minimumAge}+`)}</strong></li>)}</ul>}
        <details className="admin-documents"><summary>{t('가입 정책·약관 보기', 'Signup policy and documents')}</summary><Facts rows={[
          [t('가입 정책', 'Signup policy'), data.signup.policyVersion],
          [t('이용약관', 'Terms'), <DocumentLink key="terms" data={data} kind="terms" base={base} />],
          [t('개인정보 처리방침', 'Privacy'), <DocumentLink key="privacy" data={data} kind="privacy" base={base} />],
        ]} /><p className="admin-muted">{t('현재 가입 설정에 연결된 문서입니다.', 'These documents are linked to the current signup settings.')}</p></details>
      </section>
      <section aria-labelledby="admin-counts-heading"><h2 id="admin-counts-heading">{t('계정 현황', 'Accounts')}</h2>
        <Facts rows={[[t('현재 계정', 'Current accounts'), number(data.counts.accounts)], [t('보관 중인 동의 기록', 'Stored acceptances'), number(data.counts.receipts)]]} />
        <p className="admin-muted">{t('현재 남아 있는 계정과 동의 기록 수입니다.', 'Accounts and acceptance records currently retained.')}</p>
        <details><summary>{t('가입·로그인 처리 대기', 'Pending signup and sign-in')}</summary><Facts rows={[
          [t('가입 대기', 'Pending signups'), number(data.counts.pendingAdmissions)], [t('로그인 대기', 'Pending sign-ins'), number(data.counts.pendingHandoffs)],
        ]} /></details>
      </section>
      <section aria-labelledby="admin-images-heading"><h2 id="admin-images-heading">{t('사진 저장·정리', 'Photo storage and cleanup')}</h2>
        <Facts rows={[[t('지금 정리할 사진 묶음', 'Due for cleanup'), number(data.images.private.due)],
          [t('비공개 예약 용량', 'Private reserved storage'), `${bytes(data.images.private.reservedBytes)} / ${bytes(data.costs.privateStorageLimitBytes)}`]]} />
        <p className="admin-muted">{t('예약 용량은 실제 파일 용량과 다를 수 있습니다.', 'Reserved storage may differ from actual file storage.')}</p>
        <a href={cleanupRuns} target="_blank" rel="noopener noreferrer">{t('정리 실행 기록', 'Cleanup run history')}</a>
        <p className="admin-muted">{t('대기 0건이 정리 작업의 실행 성공을 뜻하지는 않습니다.', 'An empty queue does not confirm a successful cleanup run.')}</p>
        <details><summary>{t('사진·전송 상세', 'Storage and delivery details')}</summary><Facts rows={[
          [t('정리 예정 사진 묶음', 'Waiting for cleanup'), number(data.images.private.waiting)],
          [t('탈퇴 후 남은 사진 묶음', 'Remaining after account deletion'), number(data.images.private.orphaned)],
          [t('공개 예약 용량', 'Public reserved storage'), `${bytes(data.images.public.reservedBytes)} / ${data.costs.publicStorageLimitBytes === null ? t('한도 미설정', 'Limit not configured') : bytes(data.costs.publicStorageLimitBytes)}`],
          [t('이번 달 비공개 전송', 'Private delivery this month'), `${bytes(data.costs.privateMonthlyReadBytes)} / ${bytes(data.costs.privateMonthlyReadLimitBytes)}`],
          [t('최근 용량 확인', 'Last storage observation'), data.costs.privateObservedAt ? time(data.costs.privateObservedAt) : t('확인 기록 없음', 'Not yet observed')],
        ]} /><p className="admin-muted">{t('사진 한 묶음에 표시용 사진과 미리보기가 함께 포함될 수 있습니다.', 'A photo entry may include display and preview files.')}</p></details>
      </section>
      <section aria-labelledby="admin-public-heading"><div className="admin-section-heading"><h2 id="admin-public-heading">{t('공개·신고', 'Public features and reports')}</h2><strong>{publicOn === 0 ? t('꺼짐', 'Off') : publicOn === 3 ? t('켜짐', 'On') : t('일부 켜짐', 'Partly on')}</strong></div>
        <p className="admin-muted">{t('공개 기능 활성화는 별도 권리·안전 검토가 필요합니다.', 'Enabling public features requires a separate rights and safety review.')}</p>
        {data.moderation.enabled ? <a href={`${base}moderation/`}>{t('콘텐츠 검토로 이동', 'Open content review')}</a> : <p>{t('콘텐츠 검토 권한이 없습니다.', 'No content-review access.')}</p>}
        <details><summary>{t('공개 상태·신고 내역', 'Public status and report totals')}</summary><Facts rows={[[t('공개 조회', 'Public reads'), enabled(data.publication.readsEnabled)], [t('공개 게시', 'Public publishing'), enabled(data.publication.writesEnabled)],
          [t('신고 접수', 'Report submissions'), enabled(data.publication.reportsEnabled)], [t('접수된 신고', 'Received reports'), number(data.moderation.reports.received)],
          [t('이의 신청', 'Appeals'), number(data.moderation.reports.appealed)], [t('처리 완료', 'Closed reports'), number(data.moderation.reports.closed)]]} />
        </details>
      </section>
      <section aria-labelledby="admin-audit-heading"><h2 id="admin-audit-heading">{t('최근 운영 변경', 'Recent service changes')}</h2>
        {data.audit.length ? <ol className="admin-audit">{data.audit.map((row, index) => <li key={`${row.createdAt}:${index}`}><strong>{row.action === 'SIGNUP_PAUSED' ? t('새 가입 일시중지', 'Signups paused') : t('새 가입 재개', 'Signups resumed')}</strong><time dateTime={row.createdAt}>{time(row.createdAt)}</time></li>)}</ol> : <p>{t('기록된 운영 변경이 없습니다.', 'No service changes recorded.')}</p>}
        {data.audit.length > 0 && <p className="admin-muted">{t('최근 20건', 'Latest 20 changes')}</p>}
      </section>
      <section className="admin-usage" aria-labelledby="admin-costs-heading"><details><summary id="admin-costs-heading">{t(`사용량·한도 ${data.costs.policies.length}개 항목`, `Usage and limits · ${data.costs.policies.length} items`)}</summary>
        <p className="admin-muted">{t('오늘 사용량은 전체 계정 합계(UTC), 한도는 계정별 기준입니다. 이 화면에서는 한도를 바꿀 수 없습니다.', 'Today’s usage is across all accounts (UTC); limits apply per account. Limits are read-only here.')}</p>
        {data.costs.policies.length ? <div className="admin-table-scroll" role="region" aria-labelledby="admin-costs-heading" tabIndex={0}><table className="admin-limits"><thead><tr>
          <th scope="col">{t('항목', 'Feature')}</th><th scope="col">{t('상태', 'Status')}</th><th scope="col">{t('오늘 전체 사용', 'Today, all accounts')}</th><th scope="col">{t('계정별 일일 한도', 'Daily limit per account')}</th><th scope="col">{t('계정별 보유 한도', 'Live limit per account')}</th>
        </tr></thead><tbody>{data.costs.policies.map(row => <tr key={row.scope}><th scope="row">{scopeLabels[row.scope]?.[ko ? 0 : 1] || row.scope}</th>
          <td>{row.paused ? t('일시중지', 'Paused') : enabled(row.enabled)}</td>
          <td>{usageValue(row.scope, data.costs.usage.find(item => item.scope === row.scope)?.used ?? 0)}</td>
          <td>{usageValue(row.scope, row.dailyLimit)}</td><td>{row.liveLimit === null ? t('별도 한도 없음', 'No separate limit') : usageValue(row.scope, row.liveLimit)}</td>
        </tr>)}</tbody></table></div> : <p>{t('설정된 한도가 없습니다.', 'No limits configured.')}</p>}
      </details></section>
    </div>}
  </>;
}

function countryName(country, ko) {
  try { return new Intl.DisplayNames([ko ? 'ko' : 'en'], {type: 'region'}).of(country) || country; }
  catch { return country; }
}
function DocumentLink({data, kind, base}) {
  const version = kind === 'terms' ? data.signup.termsVersion : data.signup.privacyVersion;
  const known = resolveSignupDocuments(data.signup, {allowTestDocuments: import.meta.env.DEV || import.meta.env.PUBLIC_SIGNUP_TEST_DOCUMENTS === '1'});
  return known ? <a href={`${base}legal/${version}/`}>{version}</a> : version;
}

function Content({base}) {
  const {locale} = useMemoryRouteUi(), ko = locale === 'ko';
  const auth = useAuthSession(`${base}admin/`);
  const status = useAdminStatus(adminUiEnabled ? auth.session : null, service);
  const [authBusy, setAuthBusy] = useState(false), [authError, setAuthError] = useState(false);
  useEffect(() => { setAuthBusy(false); setAuthError(false); }, [auth.user?.id]);
  async function accountAction(signOut) {
    setAuthBusy(true); setAuthError(false);
    if (signOut) status.clear();
    try { await (signOut ? auth.signOut() : auth.signIn()); }
    catch { setAuthError(true); }
    finally { setAuthBusy(false); }
  }
  return <main className="page-shell admin-page" aria-labelledby="admin-page-title">
    <header className="admin-heading"><h1 id="admin-page-title">{ko ? '서비스 관리' : 'Service management'}</h1><a href={`${base}data/`}>{ko ? '내 계정' : 'My account'}</a></header>
    {(authError || auth.error) && <p role="alert">{ko ? '로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.' : 'Could not verify your sign-in status. Please try again.'}</p>}
    {!adminUiEnabled ? <p>{ko ? '관리 화면을 아직 사용할 수 없습니다.' : 'Service management is not available yet.'}</p> : auth.loading ? <p role="status">{ko ? '계정을 확인하고 있습니다.' : 'Checking your account.'}</p> : !auth.user ? <section>
      <p>{ko ? '운영 권한이 있는 Google 계정으로 로그인해 주세요.' : 'Sign in with a Google account that has admin access.'}</p>
      <button className="btn" disabled={!auth.configured || authBusy} onClick={() => accountAction(false)}>{ko ? 'Google로 로그인' : 'Sign in with Google'}</button>
      {!auth.configured && <p>{ko ? '로그인이 아직 설정되지 않았습니다.' : 'Sign-in is not configured yet.'}</p>}
    </section> : <>
      <Workspace key={auth.user.id} status={status} ko={ko} base={base} />
      <footer className="admin-footer"><button className="btn btn--subtle" disabled={authBusy} onClick={() => accountAction(true)}>{ko ? '로그아웃' : 'Sign out'}</button></footer>
    </>}
  </main>;
}

export default function AdminDashboard({base = '/'}) {
  return <MemoryRouteShell base={base} currentRoute="admin" accountBoundary={false}><Content base={base} /></MemoryRouteShell>;
}
