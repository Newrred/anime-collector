import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthSession } from '../../../hooks/useAuthSession.js';
import { isPrivateUserImage, privateImageTransfer, privateImageUiEnabled, hasPlatformPrivatePhotoIntent, drainPlatformPrivatePhotos } from '../runtime/platformPrivateImages.js';

const message = (code, ko) => {
  if (['ELIGIBILITY_REQUIRED','ELIGIBILITY_EXPIRED'].includes(code)) return ko ? '계정 확인이 필요해요. 사진은 이 기기에 보관돼 있어요.' : 'Your account needs verification. The photo is still on this device.';
  if (['ELIGIBILITY_POLICY_CHANGED','ELIGIBILITY_POLICY_UNAVAILABLE'].includes(code)) return ko ? '지금은 계정 확인을 완료할 수 없어요. 잠시 후 다시 시도해 주세요.' : 'Account verification is unavailable. Please try again later.';
  if (code === 'NOT_FOUND') return ko ? '아직 계정에 저장된 사진이 없어요.' : 'This photo has not been saved to your account yet.';
  if (/QUOTA|CAPACITY/.test(code || '')) return ko ? '사진 저장 한도에 도달했어요. 최근 사진을 지웠다면 잠시 후 다시 시도해 주세요.' : 'Photo storage is at its limit. If you recently deleted a photo, wait a moment and retry.';
  if (/DISABLED|PAUSED|POLICY_STALE/.test(code || '')) return ko ? '현재 이미지 연동을 사용할 수 없습니다. 원본은 유지됩니다.' : 'Image sync is currently unavailable. Your original is unchanged.';
  if (code === 'AUTH_REQUIRED') return ko ? '계정이 변경되었거나 로그인이 필요합니다.' : 'The account changed or sign-in is required.';
  if (/IMAGE_SIZE_LIMIT|IMAGE_TOO_LARGE|IMAGE_TOO_COMPLEX/.test(code || '')) return ko ? '사진을 줄이지 못했어요. 더 작은 사진으로 시도해 주세요.' : 'Could not resize this photo. Try a smaller image.';
  if (code === 'SOURCE_IMAGE_MISMATCH') return ko ? '원본이 기록과 다릅니다. 원본을 바꾸지 않고 중단했습니다.' : 'The original differs from this record. Nothing was replaced.';
  return ko ? '사진 동기화를 마치지 못했어요. 다시 시도해 주세요.' : 'Photo sync did not finish. Please try again.';
};

export default function MemoryPrivateImageSync({ runtime, bundle, locale, hasLocalPreview, disabled, onPreview, onBusyChange }) {
  const auth = useAuthSession(), ko = locale === 'ko';
  const eligible = privateImageUiEnabled() && isPrivateUserImage(bundle.asset) &&
    bundle.card.ownerId === `account:${auth.user?.id}` && bundle.asset.sync?.syncState === 'SYNCED' && bundle.asset.sync.remoteVersion > 0;
  const transfer = useMemo(() => eligible ? privateImageTransfer(runtime, bundle) : null,
    [eligible, runtime, bundle.card.id, bundle.card.ownerId, bundle.asset.id, bundle.asset.sync?.remoteVersion]);
  const [state, setState] = useState({ status: 'checking', busy: false, policy: null, error: null, pending: false, autoPending: false });
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
    setState({ status: 'checking', busy: false, policy: null, error: null, pending: false, autoPending: false });
    const timer = setTimeout(() => { abort.abort(); if (active) setState(s => ({ ...s, status: 'failed', error: 'PRIVATE_IMAGE_REQUEST_FAILED' })); }, 30000);
    (async () => {
      const [{ policy, blob }, pending, autoPending] = await Promise.all([
        transfer.readWithPolicy(abort.signal, { includeBlob: !hasLocalPreview }), transfer.pending(abort.signal),
        hasPlatformPrivatePhotoIntent(bundle.card.ownerId, bundle.asset.id),
      ]);
      if (!active || abort.signal.aborted) return;
      if (blob) showBlob(blob);
      setState(s => ({ ...s, policy, pending, autoPending, status: policy.representation ? 'ready' : 'local' }));
    })().catch(error => {
      if (active && !abort.signal.aborted) setState(s => ({ ...s, status: 'failed', error: error.code }));
    }).finally(() => { clearTimeout(timer); if (request.current === abort) request.current = null; });
    return () => {
      active = false; mounted.current = false; clearTimeout(timer); abort.abort(); request.current?.abort(); request.current = null;
      if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; onPreview(null); }
    };
  }, [transfer, hasLocalPreview, onPreview]);

  if (!privateImageUiEnabled() || !isPrivateUserImage(bundle.asset)) return null;
  if (!eligible) return <section className="memory-detail__field memory-photo-sync">
    <strong>{ko ? '사진 동기화' : 'Photo sync'}</strong>
    <p>{auth.user ? (ko ? '카드 정보를 계정에 반영하고 있어요. 새 사진도 이어서 저장해요.' : 'Card details are being saved to your account. Your new photo follows automatically.') : (ko ? '사진을 저장하려면 로그인해 주세요.' : 'Sign in to save a photo.')}</p>
  </section>;

  const run = async action => {
    if (request.current || disabled) return;
    const abort = new AbortController(); request.current = abort;
    setState(s => ({ ...s, busy: true, error: null })); onBusyChange(true);
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      if (action === 'cancel') await transfer.cancel(abort.signal);
      else if (action === 'upload') {
        await transfer.upload({ consented: true, signal: abort.signal });
        if (state.autoPending && auth.user) await drainPlatformPrivatePhotos(auth.user.id, bundle.card.id);
      }
      if (action !== 'cancel') {
        const blob = await transfer.read(abort.signal);
        if (!abort.signal.aborted && mounted.current && request.current === abort) showBlob(blob);
      }
      // A confirmed cancellation stays confirmed even when policy reads are subsequently paused.
      const policy = action === 'cancel' ? await transfer.policy(abort.signal).catch(() => null) : await transfer.policy(abort.signal);
      if (!abort.signal.aborted && mounted.current && request.current === abort) setState(s => ({ ...s, policy, pending: false, autoPending: false, status: action === 'cancel' ? 'local' : 'ready' }));
    } catch (error) {
      const pending = await transfer.pending().catch(() => false);
      if (mounted.current && request.current === abort) setState(s => ({ ...s, status: 'failed', error: error.code || 'PRIVATE_IMAGE_REQUEST_FAILED', pending }));
    } finally {
      clearTimeout(timer);
      if (mounted.current && request.current === abort) { request.current = null; setState(s => ({ ...s, busy: false })); onBusyChange(false); }
    }
  };
  const ready = state.status === 'ready';
  const canUpload = Boolean(bundle.asset.localRef);
  return <section className="memory-detail__field memory-photo-sync" aria-label={ko ? '사진 동기화' : 'Photo sync'}>
    <strong>{ko ? '사진 동기화' : 'Photo sync'}</strong>
    <p role="status">{state.busy ? (ko ? '사진 저장 중…' : 'Saving photo…') : state.status === 'checking' ? (ko ? '사진 확인 중…' : 'Checking photo…') : state.status === 'failed' ? (ko ? '사진 저장을 확인해 주세요' : 'Photo storage needs attention') : ready ? (ko ? '다른 기기에서도 볼 수 있어요' : 'Available on your other devices') : state.autoPending ? (ko ? '계정에 자동 저장 중이에요' : 'Saving to your account automatically') : (canUpload ? (ko ? '이 기기에만 있는 사진이에요' : 'This photo is only on this device') : (ko ? '이 기기에 사진이 없어요' : 'This photo is not on this device'))}</p>
    {state.error && <p role="alert">{message(state.error, ko)}</p>}
    {!ready && canUpload && !state.busy && <>
      {!state.autoPending && <p id="memory-photo-sync-consent">{ko ? '이전 사진을 계정에도 저장하려면 작은 비공개 사본 전송을 선택해 주세요.' : 'Choose to save a smaller private copy of this older photo to your account.'}</p>}
      <button type="button" className="btn" aria-describedby={!state.autoPending ? "memory-photo-sync-consent" : undefined} disabled={disabled || state.status === 'checking'} onClick={() => run('upload')}>{state.autoPending ? (ko ? '지금 다시 시도' : 'Retry now') : state.pending || state.error ? (ko ? '사진 저장 다시 시도' : 'Retry photo storage') : (ko ? '계정에 사진 저장' : 'Save photo to account')}</button>
    </>}
    {!ready && !canUpload && state.status !== 'checking' && <>
      <p>{ko ? '사진을 추가한 기기에서 이 카드를 열고 사진 동기화를 눌러주세요.' : 'Open this card on the device where you added the photo, then choose Sync photo.'}</p>
      <button type="button" className="btn btn--subtle" disabled={state.busy || disabled} onClick={() => run('read')}>{ko ? '사진 다시 불러오기' : 'Reload photo'}</button>
    </>}
    {state.busy && <button type="button" className="btn btn--subtle" onClick={() => request.current?.abort()}>{ko ? '중지' : 'Stop'}</button>}
    {(state.policy || state.pending) && <details className="memory-photo-sync__details">
      <summary>{ko ? '저장 정보' : 'Storage details'}</summary>
      {state.policy && <p>{ko ? '사진 저장 공간' : 'Photo storage'}: {(state.policy.usedBytes / 1_000_000).toFixed(2)} / {(state.policy.quotaBytes / 1_000_000).toFixed(2)} MB</p>}
      {state.pending && !state.busy && <button type="button" className="btn btn--subtle" disabled={disabled} onClick={() => run('cancel')}>{ko ? '대기 중인 전송 취소' : 'Cancel pending transfer'}</button>}
    </details>}
  </section>;
}
