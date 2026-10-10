import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {fetchOwnSignupReceipts,requestAccountDeletion,finishDeletedAccountSession} from '../../features/auth/accountPrivacy.js';
import {resolveSignupDocuments,needsAgeProcessingConsent} from '../../features/auth/signupDocuments.js';
import {clearPendingSignup} from '../../features/auth/simpleSignup.js';

export default function AccountPrivacyPanel({user,locale='ko',base='/',canDelete=false,onBeforeDelete,onCancelDelete,onDeleted}) {
  const owner=user?.id,live=useRef(true),busyRef=useRef(false);
  const [receipts,setReceipts]=useState(null),[receiptError,setReceiptError]=useState(false);
  const [stage,setStage]=useState('idle'),[error,setError]=useState('');
  const t=(ko,en)=>locale==='ko'?ko:en;
  const acceptedAgeProcessing=receipts?.some(row=>needsAgeProcessingConsent(row.country,resolveSignupDocuments(row,{allowTestDocuments:true})));
  const latestDocuments=receipts?.map(row=>resolveSignupDocuments(row,{allowTestDocuments:true})).find(Boolean);
  async function load() {
    setReceiptError(false);
    try { const rows=await fetchOwnSignupReceipts(supabase,owner);if(live.current)setReceipts(rows); }
    catch { if(live.current)setReceiptError(true); }
  }
  useEffect(()=>{live.current=true;load();return()=>{live.current=false;};},[owner]);
  async function cancel() {
    if(busyRef.current)return;
    busyRef.current=true;
    try {await onCancelDelete?.();if(live.current){setStage('idle');setError('');}}
    catch {if(live.current)setError('AUTH_REQUIRED');}
    finally {busyRef.current=false;}
  }
  async function leave() {
    if(busyRef.current)return;
    busyRef.current=true;setStage('deleting');setError('');
    try {
      await onBeforeDelete?.();
      await requestAccountDeletion(supabase,owner,{confirmed:true});
    } catch(e) {
      if(live.current){setStage('confirm');setError(e.code||'ACCOUNT_DELETE_UNCONFIRMED');}
      busyRef.current=false;return;
    }
    // Cloud deletion is irreversible even if the subsequent local logout fails.
    if(live.current)setStage('deleted');
    try {
      const result=await finishDeletedAccountSession(supabase,owner);
      if(result.signedOut) {
        try {clearPendingSignup(window.sessionStorage);}catch{}
        onDeleted?.();
      }
    } catch {
      if(live.current)setError('ACCOUNT_LOGOUT_FAILED');
    }
    busyRef.current=false;
  }
  const message=error==='ACCOUNT_LOGOUT_FAILED'
    ?t('계정은 삭제됐지만 이 기기의 로그아웃을 끝내지 못했습니다. 연결을 확인하고 아래에서 다시 로그아웃해 주세요.','Your account was deleted, but this device could not finish signing out. Check your connection and retry below.')
    :error==='ACCOUNT_CHANGED'||error==='AUTH_REQUIRED'
      ?t('로그인 상태가 바뀌었습니다. 현재 계정을 확인하고 다시 시도해 주세요.','Your sign-in changed. Check the current account and try again.')
      :error==='ACCOUNT_DELETE_DISABLED'||error==='ACCOUNT_DELETE_NOT_ALLOWED'
        ?t('이 환경에서는 직접 탈퇴를 사용할 수 없습니다. 개인정보 안내의 연락처로 요청할 수 있습니다.','Self-service deletion is not available here. Use the contact in the privacy notice.')
        :t('탈퇴 완료를 확인하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요. 동기화는 일시 중지했습니다.','Deletion was not confirmed. Check your connection and try again. Sync has been paused.');
  if(stage==='deleted')return <section id="account-privacy" className="surface-card list-stack" role="status">
    <h2 className="sectionTitle">{t('계정을 삭제했습니다','Account deleted')}</h2>
    <p className="small">{t('사진 파일은 정리 작업에서 삭제됩니다. 기기에 저장한 사본은 남아 있습니다.','Photo files will be removed by cleanup. Copies on your devices remain.')}</p>
    {error&&<><p role="alert">{message}</p><button className="btn btn--ghost" onClick={async()=>{try{const result=await finishDeletedAccountSession(supabase,owner);if(result.signedOut)onDeleted?.();}catch{setError('ACCOUNT_LOGOUT_FAILED');}}}>{t('로그아웃 다시 시도','Retry sign-out')}</button></>}
  </section>;
  return <section id="account-privacy" className="surface-card list-stack" aria-labelledby="account-privacy-heading">
    <h2 id="account-privacy-heading" className="sectionTitle">{t('가입 기록과 탈퇴','Signup records and account deletion')}</h2>
    <p className="small" style={{overflowWrap:'anywhere'}}>{user.email||t('현재 계정','Current account')}</p>
    {receiptError?<div><p className="small">{t('가입 기록을 불러오지 못했습니다.','Could not load your signup records.')}</p><button className="btn btn--ghost" onClick={load}>{t('다시 불러오기','Reload records')}</button></div>
      :receipts===null?<p className="small" role="status">{t('기록을 불러오는 중…','Loading records…')}</p>
      :receipts.length===0?<p className="small">{t('이 계정에 저장된 새 가입 기록이 없습니다.','No new signup records are stored for this account.')}</p>
      :<ul className="list-stack">{receipts.map((row,index)=>{
        const docs=resolveSignupDocuments(row,{allowTestDocuments:true});
        const time=Number.isFinite(Date.parse(row.recordedAt))?new Date(row.recordedAt).toLocaleDateString(locale==='ko'?'ko-KR':'en-US'):t('날짜 확인 불가','Date unavailable');
        return <li key={`${row.policyVersion}-${index}`} className="small"><span>{time} · </span>{docs?<>
          <a href={`${base}legal/${docs.termsVersion}/`}>{t('동의한 이용약관','Accepted terms')}</a>{' · '}<a href={`${base}legal/${docs.privacyVersion}/`}>{t('당시 개인정보 안내','Privacy notice at signup')}</a>
          {needsAgeProcessingConsent(row.country,docs)&&<span>{t(' · 가입 연령 정보 처리 동의',' · Signup age processing consent')}</span>}
          {docs.testOnly&&<span>{t(' (테스트)',' (test)')}</span>}
        </>:<span>{t('이 버전의 문서 링크는 준비 중입니다.','Links for this document version are not available.')}</span>}</li>;
      })}</ul>}
    {acceptedAgeProcessing&&<p className="small">{t('가입 연령 정보 처리 동의는 계정을 탈퇴해 철회할 수 있습니다. 기기에서만 사용하는 기능은 계속 이용할 수 있습니다.','You can withdraw consent to signup age processing by deleting your account. Local-only features remain available.')}</p>}
    <a className="small" href={latestDocuments?`${base}legal/${latestDocuments.privacyVersion}/#withdrawal`:`${base}privacy/`}>{t('개인정보 처리 안내와 연락처','Privacy notice and contact')}</a>
    {canDelete&&stage==='idle'&&<button className="btn btn--ghost" style={{width:'fit-content'}} onClick={()=>{setStage('confirm');setError('');}}>{t('계정 탈퇴','Delete account')}</button>}
    {canDelete&&(stage==='confirm'||stage==='deleting')&&<div className="list-stack" role="group" aria-labelledby="account-delete-title">
      <h3 id="account-delete-title" className="sectionTitle sectionTitle--small">{t('이 계정을 탈퇴할까요?','Delete this account?')}</h3>
      <p className="small">{t('계정의 기억·보드·작품 기록과 가입 기록을 삭제하며 되돌릴 수 없습니다. 필요한 기록은 먼저 내보내 주세요. Google 계정 자체는 삭제하지 않습니다.','This permanently deletes your account’s memories, boards, title records and signup records. Export anything you need first. Your Google account is not deleted.')}</p>
      <p className="small">{t('사진은 별도 정리 작업에서 삭제됩니다. 기기 사본·이미 내려받은 파일은 남으며, 보안·삭제 처리 기록과 백업 일부는 즉시 지워지지 않습니다.','Photos are removed separately by cleanup. Device copies and downloaded files remain; some security, deletion and backup records are not erased immediately.')}</p>
      <div className="sync-card__actions"><button className="btn btn--ghost" disabled={stage==='deleting'} onClick={cancel}>{t('취소','Cancel')}</button><button className="btn" disabled={stage==='deleting'} onClick={leave}>{stage==='deleting'?t('탈퇴 처리 중…','Deleting account…'):t('이 계정 삭제','Delete this account')}</button></div>
      {error&&<p className="small" role="alert">{message}</p>}
    </div>}
  </section>;
}
