import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '../../../hooks/useAuthSession.js';
import { isPrivateUserImage, privateImageTransfer, privateImageUiEnabled } from '../runtime/platformPrivateImages.js';

const message = (code, ko) => {
  if (code === 'NOT_FOUND') return ko ? '아직 이 이미지의 서버 사본이 없습니다. 먼저 카드 정보를 동기화해 주세요.' : 'No server copy is available. Sync the card information first.';
  if (/QUOTA|CAPACITY/.test(code || '')) return ko ? '저장 공간 또는 서비스 한도에 도달했습니다. 원본은 이 기기에 그대로 있습니다.' : 'Storage or service capacity has been reached. Your local original is unchanged.';
  if (/DISABLED|PAUSED|POLICY_STALE/.test(code || '')) return ko ? '현재 이미지 연동을 사용할 수 없습니다. 원본은 유지됩니다.' : 'Image sync is currently unavailable. Your original is unchanged.';
  if (code === 'AUTH_REQUIRED') return ko ? '계정이 변경되었거나 로그인이 필요합니다.' : 'The account changed or sign-in is required.';
  if (/IMAGE_SIZE_LIMIT|IMAGE_TOO_LARGE|IMAGE_TOO_COMPLEX/.test(code || '')) return ko ? '안전한 크기의 사본을 만들지 못했습니다. 더 작은 이미지를 선택해 주세요.' : 'A bounded copy could not be created. Choose a smaller image.';
  if (code === 'SOURCE_IMAGE_MISMATCH') return ko ? '원본이 기록과 다릅니다. 원본을 바꾸지 않고 중단했습니다.' : 'The original differs from this record. Nothing was replaced.';
  return ko ? '완료 여부를 확인하지 못했습니다. 원본은 유지되며 같은 요청으로 다시 시도할 수 있습니다.' : 'Completion could not be confirmed. Your original is safe; retry uses the same request.';
};

export default function MemoryPrivateImageSync({ runtime, bundle, locale, hasLocalPreview, disabled, onPreview, onBusyChange }) {
  const auth = useAuthSession(), ko = locale === 'ko';
  const eligible = privateImageUiEnabled() && isPrivateUserImage(bundle.asset) &&
    bundle.card.ownerId === `account:${auth.user?.id}` && bundle.asset.sync?.syncState === 'SYNCED' && bundle.asset.sync.remoteVersion > 0;
  const transfer = useMemo(() => eligible ? privateImageTransfer(runtime, bundle) : null,
    [eligible, runtime, bundle.card.id, bundle.card.ownerId, bundle.asset.id, bundle.asset.sync?.remoteVersion]);
  const [state, setState] = useState({ status: 'checking', busy: false, consented: false, policy: null, error: null, pending: false });
  const request = useRef(null), objectUrl = useRef(null), mounted = useRef(false);
  const showBlob = blob => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(blob); onPreview(objectUrl.current);
  };
  useEffect(() => {
    mounted.current = true;
    if (!transfer) return () => { mounted.current = false; };
    let active = true;
    const abort = new AbortController(); request.current = abort;
    setState({ status: 'checking', busy: false, consented: false, policy: null, error: null, pending: false });
    const timer = setTimeout(() => { abort.abort(); if (active) setState(s => ({ ...s, status: 'failed', error: 'PRIVATE_IMAGE_REQUEST_FAILED' })); }, 30000);
    (async () => {
      const policy = await transfer.policy(abort.signal), pending = await transfer.pending(abort.signal);
      let blob;
      if (!hasLocalPreview && policy.representation) blob = await transfer.read(abort.signal);
      if (!active || abort.signal.aborted) return;
      if (blob) showBlob(blob);
      setState(s => ({ ...s, policy, pending, status: policy.representation ? 'ready' : 'local' }));
    })().catch(error => {
      if (active && !abort.signal.aborted) setState(s => ({ ...s, status: 'failed', error: error.code }));
    }).finally(() => { clearTimeout(timer); if (request.current === abort) request.current = null; });
    return () => {
      active = false; mounted.current = false; clearTimeout(timer); abort.abort(); request.current?.abort(); request.current = null;
      if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; onPreview(null); }
    };
  }, [transfer, hasLocalPreview, onPreview]);

  if (!privateImageUiEnabled() || !isPrivateUserImage(bundle.asset)) return null;
  if (!eligible) return <section className="memory-detail__field"><strong>{ko ? '비공개 이미지 연동' : 'Private image sync'}</strong>
    <p>{ko ? '로그인 후 이 카드의 정보를 먼저 동기화해 주세요. 사진은 자동으로 전송되지 않습니다.' : 'Sign in and sync this card first. Images are never uploaded automatically.'}</p></section>;

  const run = async action => {
    if (request.current || disabled) return;
    const abort = new AbortController(); request.current = abort;
    setState(s => ({ ...s, busy: true, error: null })); onBusyChange(true);
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      if (action === 'cancel') await transfer.cancel(abort.signal);
      else if (action === 'upload') await transfer.upload({ consented: state.consented, signal: abort.signal });
      if (action !== 'cancel') {
        const blob = await transfer.read(abort.signal);
        if (!abort.signal.aborted && mounted.current && request.current === abort) showBlob(blob);
      }
      // A confirmed cancellation stays confirmed even when policy reads are subsequently paused.
      const policy = action === 'cancel' ? await transfer.policy(abort.signal).catch(() => null) : await transfer.policy(abort.signal);
      if (!abort.signal.aborted && mounted.current && request.current === abort) setState(s => ({ ...s, policy, pending: false, consented: false, status: action === 'cancel' ? 'local' : 'ready' }));
    } catch (error) {
      const pending = await transfer.pending().catch(() => false);
      if (mounted.current && request.current === abort) setState(s => ({ ...s, status: 'failed', error: error.code || 'PRIVATE_IMAGE_REQUEST_FAILED', pending }));
    } finally {
      clearTimeout(timer);
      if (mounted.current && request.current === abort) { request.current = null; setState(s => ({ ...s, busy: false })); onBusyChange(false); }
    }
  };
  return <section className="memory-detail__field" aria-label={ko ? '비공개 이미지 연동' : 'Private image sync'}>
    <strong>{ko ? '비공개 이미지 연동' : 'Private image sync'}</strong>
    <p>{ko ? '선택한 이미지의 작은 사본만 내 계정에 저장합니다. 원본은 이 기기에 남고 공개되지 않습니다.' : 'Save a smaller copy to your account. The original stays on this device; this does not publish it.'}</p>
    <p role="status">{state.busy ? (ko ? '처리 중…' : 'Working…') : state.status === 'checking' ? (ko ? '연동 상태 확인 중…' : 'Checking image sync…') : state.status === 'ready' ? (ko ? '비공개 사본 연동 완료' : 'Private copy synced') : (ko ? '서버 사본 연동 미완료' : 'Private copy not synced')}</p>
    {state.policy && <p>{ko ? '사용 중' : 'Used'}: {(state.policy.usedBytes / 1_000_000).toFixed(2)} / {(state.policy.quotaBytes / 1_000_000).toFixed(2)} MB</p>}
    {state.error && <p role="alert">{message(state.error, ko)}</p>}
    {state.status !== 'ready' && bundle.asset.localRef && <>
      <label><input type="checkbox" checked={state.consented} disabled={state.busy || disabled} onChange={e => setState(s => ({ ...s, consented: e.target.checked }))} />
        {ko ? '이 이미지의 최적화 사본을 내 계정에 비공개로 저장합니다.' : 'Save an optimized copy of this image privately to my account.'}</label>
      <button className="btn" disabled={!state.consented || state.busy || disabled || state.status === 'checking'} onClick={() => run('upload')}>{state.pending ? (ko ? '같은 요청으로 다시 시도' : 'Retry same request') : (ko ? '비공개 사본 연동' : 'Sync private copy')}</button>
    </>}
    {state.status === 'ready' && <button className="btn" disabled={state.busy || disabled} onClick={() => run('read')}>{ko ? '서버 사본 확인' : 'View server copy'}</button>}
    {state.busy && <button className="btn" onClick={() => request.current?.abort()}>{ko ? '전송 멈추기' : 'Stop transfer'}</button>}
    {state.pending && !state.busy && <button className="btn" disabled={disabled} onClick={() => run('cancel')}>{ko ? '서버 사본 준비 취소 (원본 유지)' : 'Cancel server copy preparation (keep original)'}</button>}
  </section>;
}
