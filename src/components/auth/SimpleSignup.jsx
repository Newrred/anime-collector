import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {startGoogleOAuth} from '../../repositories/authRepo.js';
import {resolveWebOAuthNext} from '../../features/auth/webOAuth.js';
import {TERMS_VERSION,PRIVACY_VERSION,COUNTRIES,calendarDay,createDeclaration,fetchSignupPolicy,clearPendingSignup} from '../../features/auth/simpleSignup.js';
const errors={
 INVALID_BIRTH_DATE:['생년월일을 정확히 입력해 주세요.','Enter a valid date of birth.'],
 TERMS_REQUIRED:['이용약관을 확인하고 동의해 주세요.','Please agree to the terms.'],
 BELOW_MINIMUM_AGE:['입력한 생년월일은 이 국가의 최소 가입 연령에 미달합니다.','You do not meet the minimum age for this country.'],
 COUNTRY_NOT_READY:['이 국가의 가입 기준을 확인 중입니다.','Signup requirements for this country are being reviewed.'],
 SIGNUP_STORAGE_UNAVAILABLE:['이 브라우저에서 임시 저장을 허용한 뒤 다시 시도해 주세요.','Allow session storage in this browser, then try again.'],
 SIGNUP_POLICY_CHANGED:['가입 기준이 변경됐습니다. 새로고침 후 확인해 주세요.','Requirements changed. Refresh and review them again.'],
};
export default function SimpleSignup({base='/',enabled=false}) {
 const [lang,setLang]=useState('ko'), [country,setCountry]=useState(''), [birthDate,setBirthDate]=useState('');
 const [accepted,setAccepted]=useState(false),[policy,setPolicy]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const en=lang==='en',t=(ko,enText)=>en?enText:ko;
 const load=async()=>{setLoading(true);setError('');try {if(!supabase)throw new Error();setPolicy(await fetchSignupPolicy(supabase));}catch {setError('SERVICE');}finally{setLoading(false);}};
 useEffect(()=>{if(enabled)load();else setLoading(false);},[enabled]);
 const next=()=>resolveWebOAuthNext({rawNext:new URLSearchParams(window.location.search).get('next'),origin:window.location.origin,base});
 const names=new Intl.DisplayNames([en?'en':'ko'],{type:'region'});
 const submit=async event=>{
  event.preventDefault(); if(busy)return; setError('');setBusy(true);
  try {
   const declaration=createDeclaration({country,birthDate,accepted},policy);
   clearPendingSignup(window.sessionStorage);
   await startGoogleOAuth(next(),declaration);
  }catch(e){try{clearPendingSignup(window.sessionStorage);}catch{}setError(e.code||'SERVICE');setBusy(false);}
 };
 return <section className="signup-panel" lang={lang}>
  <div className="signup-heading"><span>MOEMOA</span><button type="button" onClick={()=>setLang(en?'ko':'en')} disabled={busy||loading}>{en?'한국어':'English'}</button></div>
  <h1>{t('내 기억을 계정에 보관하기','Keep your memories together')}</h1>
  <p>{t('기기에 남긴 기록은 그대로 두고, Google 계정으로 이어서 사용하세요.','Keep your existing records and continue with Google.')}</p>
  {!enabled?<><p>{t('현재 로그인으로 계속할 수 있습니다.','Continue with the current sign-in flow.')}</p><button className="signup-primary" onClick={()=>startGoogleOAuth(next()).catch(()=>setError('SERVICE'))}>Google{t('로 계속',' · Continue')}</button></>:
  <form onSubmit={submit}>
   <label htmlFor="signup-country">{t('거주 국가','Country of residence')}</label>
   <select id="signup-country" required value={country} onChange={e=>{setCountry(e.target.value);setError('');}} disabled={busy||loading}>
    <option value="">{t('국가 선택','Select your country')}</option>
    {COUNTRIES.map(code=><option key={code} value={code}>{names.of(code)}</option>)}
   </select>
   <label htmlFor="signup-birthday">{t('생년월일','Date of birth')}</label>
   <input id="signup-birthday" type="date" required autoComplete="bday" min="1900-01-01" max={calendarDay()} value={birthDate} onChange={e=>{setBirthDate(e.target.value);setError('');}} disabled={busy||loading} aria-describedby="signup-birthday-help" />
   <p id="signup-birthday-help" className="signup-hint">{t('실제 생년월일을 입력해 주세요. 이 화면에서 나이를 계산하며, 생년월일 원문은 서버에 보내지 않습니다. 국가와 연령 구간 등 가입 확인 기록은 계정에 보관합니다.','Enter your actual date of birth. This form calculates your age without sending your full birth date to our server. Your account keeps a signup receipt including your country and age band.')}</p>
   <label className="signup-consent"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} disabled={busy||loading} /><span><a href={`${base}legal/${TERMS_VERSION}/`} target="_blank" rel="noreferrer">{t('이용약관','Terms')}</a>{t('에 동의합니다.',' — I agree.')}</span></label>
   <p className="signup-hint"><a href={`${base}legal/${PRIVACY_VERSION}/`} target="_blank" rel="noreferrer">{t('개인정보 처리 안내','Privacy notice')}</a>{t('에서 계정·기록의 저장과 삭제 방법을 확인하세요. 공개 게시는 별도로 선택합니다.',' explains account storage and deletion. Publishing is a separate choice.')}</p>
   {error&&<p role="alert">{(errors[error]||['연결을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.','Connection failed. Please try again.'])[en?1:0]}</p>}
   {error==='SERVICE'&&!policy?<button type="button" onClick={load} disabled={loading}>{t('연결 다시 확인','Retry connection')}</button>:null}
   <button className="signup-primary" type="submit" disabled={busy||loading||!policy}>{busy?t('Google로 이동 중…','Opening Google…'):loading?t('준비 중…','Loading…'):t('Google로 계속','Continue with Google')}</button>
  </form>}
  <a className="signup-back" href={`${base}data/`} onClick={()=>clearPendingSignup(window.sessionStorage)}>{t('돌아가기','Go back')}</a>
 </section>;
}
