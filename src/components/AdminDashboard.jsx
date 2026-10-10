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
  ADMIN_REQUIRED: ['이 계정에는 운영 권한이 없습니다.', 'This account does not have service access.'],
  ADMIN_REVISION_CONFLICT: ['다른 곳에서 설정이 바뀌었습니다. 최신 상태를 확인한 뒤 다시 선택해 주세요.', 'Settings changed elsewhere. Review the refreshed status before choosing again.'],
  ADMIN_ACTIVATION_REQUIRED: ['아직 최초 운영 연결이 완료되지 않았습니다. 이 화면에서는 활성화할 수 없습니다.', 'The initial release is not connected. It cannot be activated here.'],
  ADMIN_RELEASE_NOT_READY: ['현재 문서와 국가 정책은 재개 준비가 되지 않았습니다.', 'The current documents and country policy are not ready to resume.'],
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
  return <>
    <div className="admin-toolbar">
      <p>{data ? t(`확인: ${time(data.checkedAt)}`, `Checked: ${time(data.checkedAt)}`) : t('운영 상태', 'Service status')}</p>
      <button className="btn btn--subtle" disabled={phase === 'loading'} onClick={() => { setConfirmation(null); refresh(); }}>{t('새로고침', 'Refresh')}</button>
    </div>
    {error && <p className="admin-message" role="alert">{(errorCopy[error] || [
      '상태를 확인하지 못했습니다. 연결을 확인하고 새로고침해 주세요.', 'Could not verify the status. Check your connection and refresh.',
    ])[ko ? 0 : 1]}</p>}
    {notice && <p className="admin-message" role="status">{notice === 'paused' ? t('새 가입을 일시중지했습니다.', 'New signups paused.') : t('새 가입을 재개했습니다.', 'New signups resumed.')}</p>}
    {phase === 'loading' && <p role="status">{t('권한과 운영 상태를 확인하고 있습니다.', 'Checking access and service status.')}</p>}
    {data && <div className="admin-sections">
      <section aria-labelledby="admin-signup-heading">
        <div className="admin-section-heading"><h2 id="admin-signup-heading">{t('신규 가입', 'New signups')}</h2><strong>{!data.signup.admissionEnabled ? t('운영 연결 전', 'Not connected') : data.signup.enabled ? t('가입 가능', 'Open') : t('일시중지', 'Paused')}</strong></div>
        <p>{t('기존 계정과 저장된 기록은 이 설정으로 삭제되지 않습니다.', 'This setting does not delete existing accounts or memories.')}</p>
        <button className="btn btn--subtle" ref={triggerRef}
          disabled={data.signup.enabled ? !(data.signup.canPause && data.signup.admissionEnabled) : !(data.signup.canResume && data.signup.readyForResume && data.signup.admissionEnabled)}
          onClick={() => setConfirmation({revision: data.revision, paused: data.signup.enabled})}>
          {data.signup.enabled ? t('새 가입 일시중지', 'Pause new signups') : t('새 가입 재개', 'Resume new signups')}
        </button>
        {(!data.signup.admissionEnabled || (!data.signup.enabled && !data.signup.readyForResume)) && <p className="admin-muted">{t('검증된 문서·국가 정책의 운영 연결을 마친 뒤 재개할 수 있습니다.', 'Resume is available after reviewed documents and country policy are connected.')}</p>}
        {confirmation && <div className="admin-confirm" role="group" aria-labelledby="admin-confirm-heading" onKeyDown={event => { if (event.key === 'Escape') cancel(); }}>
          <h3 id="admin-confirm-heading">{confirmation.paused ? t('새 가입을 일시중지할까요?', 'Pause new signups?') : t('새 가입을 재개할까요?', 'Resume new signups?')}</h3>
          <p>{confirmation.paused ? t('신규 계정 생성만 중지합니다. 기존 계정은 계속 이용할 수 있습니다.', 'Only new account creation stops. Existing accounts can continue using the service.') : t('아래에 표시된 국가 기준과 문서로 가입을 다시 받습니다.', 'New accounts will use the country policy and documents shown below.')}</p>
          <div className="admin-actions"><button ref={confirmRef} className="btn" onClick={() => { const choice = confirmation; setConfirmation(null); setPaused(choice.revision, choice.paused); }}>{confirmation.paused ? t('일시중지 확인', 'Confirm pause') : t('재개 확인', 'Confirm resume')}</button>
            <button className="btn btn--subtle" onClick={cancel}>{t('취소', 'Cancel')}</button></div>
        </div>}
        <h3>{t('적용된 문서', 'Connected documents')}</h3>
        <Facts rows={[
          [t('가입 정책', 'Signup policy'), data.signup.policyVersion],
          [t('이용약관', 'Terms'), <DocumentLink key="terms" data={data} kind="terms" base={base} />],
          [t('개인정보', 'Privacy'), <DocumentLink key="privacy" data={data} kind="privacy" base={base} />],
        ]} />
        <p className="admin-muted">{t('연구 권고와 실제 적용 상태는 다릅니다. 아래는 서버에 연결된 기준입니다.', 'Research recommendations differ from live settings. The following policy is connected on the server.')}</p>
        <details><summary>{t(`국가별 최소 연령 · ${data.signup.countries.length}개국`, `Minimum ages · ${data.signup.countries.length} countries`)}</summary>
          {data.signup.countries.length === 0 ? <p>{t('연결된 국가 기준이 없습니다.', 'No country policy is connected.')}</p> : <ul className="admin-countries">{data.signup.countries.map(row => <li key={row.country}><span>{countryName(row.country, ko)}</span><strong>{t(`만 ${row.minimumAge}세`, `Age ${row.minimumAge}+`)}</strong></li>)}</ul>}
        </details>
      </section>
      <section aria-labelledby="admin-counts-heading"><h2 id="admin-counts-heading">{t('계정 현황', 'Accounts')}</h2>
        <Facts rows={[[t('현재 계정', 'Current accounts'), number(data.counts.accounts)], [t('보관 중인 수락 기록', 'Retained acceptances'), number(data.counts.receipts)],
          [t('가입 준비 대기', 'Pending admissions'), number(data.counts.pendingAdmissions)], [t('로그인 전달 대기', 'Pending sign-in handoffs'), number(data.counts.pendingHandoffs)]]} />
        <p className="admin-muted">{t('현재 집계입니다. 누적 가입·탈퇴 수가 아니며 개인 기록은 표시하지 않습니다.', 'Current totals, not lifetime signups or deletions. Private content is not shown.')}</p>
      </section>
      <section aria-labelledby="admin-images-heading"><h2 id="admin-images-heading">{t('사진 정리와 용량', 'Image cleanup and capacity')}</h2>
        <Facts rows={[[t('지금 정리할 사진 묶음', 'Due for cleanup'), number(data.images.private.due)], [t('정리 예정 사진 묶음', 'Waiting for cleanup'), number(data.images.private.waiting)],
          [t('탈퇴 계정의 남은 사진 묶음', 'Remaining after account deletion'), number(data.images.private.orphaned)],
          [t('비공개 사진 예약 용량', 'Private reserved storage'), `${bytes(data.images.private.reservedBytes)} / ${bytes(data.costs.privateStorageLimitBytes)}`],
          [t('공개 사진 예약 용량', 'Public reserved storage'), `${bytes(data.images.public.reservedBytes)} / ${data.costs.publicStorageLimitBytes === null ? t('한도 미설정', 'Limit not configured') : bytes(data.costs.publicStorageLimitBytes)}`],
          [t('이번 달 비공개 전송 집계', 'Private delivery this month'), `${bytes(data.costs.privateMonthlyReadBytes)} / ${bytes(data.costs.privateMonthlyReadLimitBytes)}`],
          [t('최근 용량 관측', 'Capacity observation'), data.costs.privateObservedAt ? time(data.costs.privateObservedAt) : t('관측 기록 없음', 'No observation')]]} />
        <p className="admin-muted">{t('사진 묶음에는 표시용 사진·미리보기가 함께 포함될 수 있습니다. 예약 용량은 실제 파일 용량과 다를 수 있습니다. 대기 0건만으로 자동 정리가 정상 실행됐다고 판단하지 않습니다.', 'A photo entry may include display and preview files. Reserved storage can differ from actual storage. An empty queue does not confirm that scheduled cleanup ran successfully.')}</p>
        <a href={cleanupRuns} target="_blank" rel="noopener noreferrer">{t('정리 실행 기록 확인', 'View cleanup runs')}</a>
      </section>
      <section aria-labelledby="admin-public-heading"><h2 id="admin-public-heading">{t('공개 기능과 신고', 'Public features and reports')}</h2>
        <Facts rows={[[t('공개 조회', 'Public reads'), enabled(data.publication.readsEnabled)], [t('공개 게시', 'Public publishing'), enabled(data.publication.writesEnabled)],
          [t('신고 접수', 'Report submissions'), enabled(data.publication.reportsEnabled)], [t('접수된 신고', 'Received reports'), number(data.moderation.reports.received)],
          [t('이의 신청', 'Appeals'), number(data.moderation.reports.appealed)], [t('처리 완료', 'Closed reports'), number(data.moderation.reports.closed)]]} />
        <p className="admin-muted">{t('이 화면에서 공개 기능을 켤 수 없습니다. 공개 권리·안전 검토는 별도입니다.', 'Public features cannot be enabled here. Rights and safety review remain separate.')}</p>
        {data.moderation.enabled ? <a href={`${base}moderation/`}>{t('콘텐츠 검토로 이동', 'Open content review')}</a> : <p>{t('이 계정에는 콘텐츠 검토 권한이 없습니다.', 'This account has no content-review permission.')}</p>}
      </section>
      <section aria-labelledby="admin-costs-heading"><h2 id="admin-costs-heading">{t('사용량 제한', 'Usage limits')}</h2>
        <p className="admin-muted">{t('오늘 사용량은 UTC 기준입니다. 제한 변경은 이 화면에서 지원하지 않습니다.', 'Today’s usage follows UTC. Limits cannot be changed here.')}</p>
        {data.costs.policies.length ? <ul className="admin-limits">{data.costs.policies.map(row => <li key={row.scope}><h3>{scopeLabels[row.scope]?.[ko ? 0 : 1] || row.scope}</h3><Facts rows={[
          [t('상태', 'Status'), row.paused ? t('일시중지', 'Paused') : enabled(row.enabled)],
          [t('오늘 전체 사용', 'Today, all accounts'), usageValue(row.scope, data.costs.usage.find(item => item.scope === row.scope)?.used ?? 0)],
          [t('계정별 일일 한도', 'Daily limit per account'), usageValue(row.scope, row.dailyLimit)],
          [t('계정별 보유 한도', 'Live limit per account'), row.liveLimit === null ? t('별도 한도 없음', 'No separate limit') : usageValue(row.scope, row.liveLimit)],
        ]} /></li>)}</ul> : <p>{t('연결된 제한 정책이 없습니다.', 'No limit policies are connected.')}</p>}
      </section>
      <section aria-labelledby="admin-audit-heading"><h2 id="admin-audit-heading">{t('최근 운영 변경', 'Recent service changes')}</h2>
        {data.audit.length ? <ol className="admin-audit">{data.audit.map((row, index) => <li key={`${row.createdAt}:${index}`}><strong>{row.action === 'SIGNUP_PAUSED' ? t('새 가입 일시중지', 'Signups paused') : t('새 가입 재개', 'Signups resumed')}</strong><time dateTime={row.createdAt}>{time(row.createdAt)}</time></li>)}</ol> : <p>{t('기록된 운영 변경이 없습니다.', 'No service changes recorded.')}</p>}
        <p className="admin-muted">{t('최근 20건까지 표시합니다.', 'Up to 20 recent changes are shown.')}</p>
      </section>
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
    {(authError || auth.error) && <p role="alert">{ko ? '계정 연결을 확인하지 못했습니다. 다시 시도해 주세요.' : 'Could not verify the account connection. Please try again.'}</p>}
    {!adminUiEnabled ? <p>{ko ? '이 환경의 관리 화면은 아직 연결되지 않았습니다.' : 'Service management is not connected in this environment.'}</p> : auth.loading ? <p role="status">{ko ? '계정을 확인하고 있습니다.' : 'Checking your account.'}</p> : !auth.user ? <section>
      <p>{ko ? '운영 권한이 있는 Google 계정으로 로그인해 주세요.' : 'Sign in with a Google account that has service access.'}</p>
      <button className="btn" disabled={!auth.configured || authBusy} onClick={() => accountAction(false)}>{ko ? 'Google로 로그인' : 'Sign in with Google'}</button>
      {!auth.configured && <p>{ko ? '이 환경은 계정 연결이 설정되지 않았습니다.' : 'Account sign-in is not configured in this environment.'}</p>}
    </section> : <>
      <Workspace key={auth.user.id} status={status} ko={ko} base={base} />
      <footer className="admin-footer"><button className="btn btn--subtle" disabled={authBusy} onClick={() => accountAction(true)}>{ko ? '로그아웃' : 'Sign out'}</button></footer>
    </>}
  </main>;
}

export default function AdminDashboard({base = '/'}) {
  return <MemoryRouteShell base={base} currentRoute="admin" accountBoundary={false}><Content base={base} /></MemoryRouteShell>;
}
