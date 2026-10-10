import {useEffect,useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {startGoogleOAuth} from '../../repositories/authRepo.js';
import {resolveWebOAuthNext} from '../../features/auth/webOAuth.js';
import {TERMS_VERSION,PRIVACY_VERSION,COUNTRIES,calendarDay,ageOnDate,createDeclaration,fetchSignupPolicy,clearPendingSignup,signupAvailability} from '../../features/auth/simpleSignup.js';
import {resolveSignupDocuments,needsAgeProcessingConsent} from '../../features/auth/signupDocuments.js';
const errors={
 INVALID_BIRTH_DATE:['생년월일을 정확히 입력해 주세요.','Enter a valid date of birth.'],
 TERMS_REQUIRED:['이용약관을 확인하고 동의해 주세요.','Please agree to the terms.'],
 BELOW_MINIMUM_AGE:['입력한 생년월일은 이 국가의 최소 가입 연령에 미달합니다.','You do not meet the minimum age for this country.'],
 COUNTRY_NOT_READY:['이 국가의 가입 기준을 확인 중입니다.','Signup requirements for this country are being reviewed.'],
 SIGNUP_SERVICE_UNAVAILABLE:['지금은 새 가입을 준비 중입니다. 잠시 후 다시 확인해 주세요.','New signup is being prepared. Please check back later.'],
 SIGNUP_STORAGE_UNAVAILABLE:['이 브라우저에서 임시 저장을 허용한 뒤 다시 시도해 주세요.','Allow session storage in this browser, then try again.'],
 SIGNUP_POLICY_CHANGED:['가입 기준이 변경됐습니다. 새로고침 후 확인해 주세요.','Requirements changed. Refresh and review them again.'],
};
export default function SimpleSignup({base='/',enabled=false,allowTestDocuments=false}) {
 const [lang,setLang]=useState('ko'), [country,setCountry]=useState(''), [birthDate,setBirthDate]=useState('');
 const [accepted,setAccepted]=useState(false),[policy,setPolicy]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const en=lang==='en',t=(ko,enText)=>en?enText:ko;
 const documentSet=resolveSignupDocuments(policy,{allowTestDocuments});
 const ageConsent=needsAgeProcessingConsent(country,documentSet);
 let guardianNotice=false;
 if(ageConsent && documentSet?.guardianNotice && birthDate) {
  try { const age=ageOnDate(birthDate);guardianNotice=age>=13 && age<18; } catch { /* Date validation is handled on submit. */ }
 }
 const termsPath=`${base}legal/${documentSet?.termsVersion || TERMS_VERSION}/`;
 const privacyPath=`${base}legal/${documentSet?.privacyVersion || PRIVACY_VERSION}/`;
 const unavailable=signupAvailability(country,policy,{allowTestDocuments});
 const canEnterDetails=!loading && !!policy && !unavailable;
 const availabilityMessage=!loading && policy && (country || unavailable!=='COUNTRY_NOT_READY') ? unavailable : null;
 const load=async()=>{setLoading(true);setError('');try {if(!supabase)throw new Error();setPolicy(await fetchSignupPolicy(supabase));}catch {setError('SERVICE');}finally{setLoading(false);}};
 useEffect(()=>{if(enabled)load();else setLoading(false);},[enabled]);
 const next=()=>resolveWebOAuthNext({rawNext:new URLSearchParams(window.location.search).get('next'),origin:window.location.origin,base});
 const names=new Intl.DisplayNames([en?'en':'ko'],{type:'region'});
 const submit=async event=>{
  event.preventDefault(); if(busy||!canEnterDetails)return; setError('');setBusy(true);
  try {
   const declaration=createDeclaration({country,birthDate,accepted},policy,Date.now(),{allowTestDocuments});
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
   <select id="signup-country" required value={country} onChange={e=>{setCountry(e.target.value);setBirthDate('');setAccepted(false);setError('');}} disabled={busy||loading} aria-describedby="signup-availability">
    <option value="">{t('국가 선택','Select your country')}</option>
    {COUNTRIES.map(code=><option key={code} value={code}>{names.of(code)}</option>)}
   </select>
   <p id="signup-availability" className="signup-hint" role="status">{availabilityMessage ? errors[availabilityMessage][en?1:0] : !country&&!loading&&policy ? t('거주 국가를 선택하면 가입 가능 여부를 안내합니다.','Select your country of residence to check signup availability.') : ''}</p>
   <label htmlFor="signup-birthday">{t('생년월일','Date of birth')}</label>
   <input id="signup-birthday" type="date" required autoComplete="bday" min="1900-01-01" max={calendarDay()} value={birthDate} onChange={e=>{setBirthDate(e.target.value);setAccepted(false);setError('');}} disabled={busy||!canEnterDetails} aria-describedby="signup-birthday-help" />
   <p id="signup-birthday-help" className="signup-hint">{t('실제 생년월일을 입력해 주세요. 이 화면에서 나이를 계산하며, 생년월일 원문은 서버에 보내지 않습니다. 국가와 연령 구간 등 가입 확인 기록은 계정에 보관합니다.','Enter your actual date of birth. This form calculates your age without sending your full birth date to our server. Your account keeps a signup receipt including your country and age band.')}</p>
   {documentSet?.testOnly && <p className="signup-hint">{t('테스트용 가입 문서입니다. 운영 서비스에는 적용되지 않습니다.','These signup documents are for testing, not the production service.')}</p>}
   {ageConsent && <p id="signup-age-processing" className="signup-hint">{t('가입 연령 확인을 위해 국가·나이·확인일을 처리합니다. 계정에는 국가·연령 구간·동의 기록을 남깁니다. 탈퇴하면 이 기록이 삭제되며, 동의하지 않아도 기기에서 계속 사용할 수 있습니다.','We process your country, age and declaration date to check signup eligibility. Your account keeps your country, age band and acceptance record until account deletion. You can keep using local features without agreeing.')}</p>}
   {guardianNotice && <p id="signup-guardian-notice" className="signup-hint">{t('보호자와 함께 아래 문서를 확인해 주세요. 보호자는 가입과 위 목적의 연령 정보 처리에 동의할 경우 아래 항목을 선택해 주세요.','Review the documents below with your parent or guardian. Your parent or guardian should select the agreement below if they agree to signup and the age-data processing described above.')}</p>}
   <label className="signup-consent"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} disabled={busy||!canEnterDetails} aria-describedby={ageConsent?`signup-age-processing${guardianNotice?' signup-guardian-notice':''}`:undefined} /><span><a href={termsPath} target="_blank" rel="noreferrer">{t('이용약관','Terms')}</a>{ageConsent?<>{t('과 ',' and ')}<a href={`${privacyPath}#age-processing`} target="_blank" rel="noreferrer">{t('가입 연령 정보 처리','signup age information processing')}</a></>:null}{t('에 동의합니다.',' — I agree.')}</span></label>
   <p className="signup-hint"><a href={privacyPath} target="_blank" rel="noreferrer">{t('개인정보 처리 안내','Privacy notice')}</a>{t('에서 계정·기록의 저장과 삭제 방법을 확인하세요. 공개 게시는 별도로 선택합니다.',' explains account storage and deletion. Publishing is a separate choice.')}</p>
   {error&&<p role="alert">{(errors[error]||['연결을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.','Connection failed. Please try again.'])[en?1:0]}</p>}
   {error==='SERVICE'&&!policy?<button type="button" onClick={load} disabled={loading}>{t('연결 다시 확인','Retry connection')}</button>:null}
   <button className="signup-primary" type="submit" disabled={busy||!canEnterDetails}>{busy?t('Google로 이동 중…','Opening Google…'):loading?t('준비 중…','Loading…'):t('Google로 계속','Continue with Google')}</button>
  </form>}
  <a className="signup-back" href={`${base}data/`} onClick={()=>clearPendingSignup(window.sessionStorage)}>{t('돌아가기','Go back')}</a>
 </section>;
}
