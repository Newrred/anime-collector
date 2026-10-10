import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {startGoogleOAuth,startExistingGoogleOAuth} from '../../repositories/authRepo.js';
import {resolveWebOAuthNext} from '../../features/auth/webOAuth.js';
import {TERMS_VERSION,PRIVACY_VERSION,COUNTRIES,ageOnDate,createDeclaration,fetchSignupPolicy,clearPendingSignup,signupAvailability} from '../../features/auth/simpleSignup.js';
import {parseBirthDateParts} from '../../features/auth/birthDateInput.js';
import {resolveSignupDocuments,needsAgeProcessingConsent} from '../../features/auth/signupDocuments.js';

const errors={
 COUNTRY_REQUIRED:['거주 국가를 선택해 주세요.','Select your country of residence.'],
 BIRTH_YEAR_REQUIRED:['태어난 연도를 네 자리로 입력해 주세요.','Enter your four-digit birth year.'],
 BIRTH_MONTH_REQUIRED:['태어난 월을 1~12 사이로 입력해 주세요.','Enter your birth month, from 1 to 12.'],
 BIRTH_DAY_REQUIRED:['태어난 일을 1~31 사이로 입력해 주세요.','Enter your birth day, from 1 to 31.'],
 BIRTH_DAY_INVALID:['해당 월에 없는 날짜입니다. 날짜를 확인해 주세요.','That day does not exist in this month. Check the date.'],
 BIRTH_DATE_FUTURE:['생년월일은 오늘 이후일 수 없습니다.','Your birth date cannot be in the future.'],
 INVALID_BIRTH_DATE:['생년월일을 정확히 입력해 주세요.','Enter a valid date of birth.'],
 TERMS_REQUIRED:['이용약관을 확인하고 동의해 주세요.','Read and agree to the terms to continue.'],
 BELOW_MINIMUM_AGE:['이 국가의 최소 가입 연령에 해당하지 않습니다.','You do not meet the minimum signup age for this country.'],
 COUNTRY_NOT_READY:['이 국가에서는 아직 새로 가입할 수 없습니다.','New signup is not available in this country yet.'],
 SIGNUP_SERVICE_UNAVAILABLE:['새 가입이 잠시 중단되었습니다. 나중에 다시 시도해 주세요.','New signup is paused. Please try again later.'],
 SIGNUP_STORAGE_UNAVAILABLE:['브라우저의 임시 저장을 허용한 뒤 다시 시도해 주세요.','Allow session storage in your browser, then try again.'],
 SIGNUP_POLICY_CHANGED:['가입 기준이 변경됐습니다. 새로고침 후 확인해 주세요.','Signup requirements changed. Refresh and review them again.'],
 SERVICE:['연결하지 못했습니다. 다시 시도해 주세요.','Could not connect. Please try again.'],
};
const emptyBirthday=()=>({year:'',month:'',day:''});
const dateFields=[['year','연도','Year','YYYY',4],['month','월','Month','MM',2],['day','일','Day','DD',2]];

export default function SimpleSignup({base='/',enabled=false,allowTestDocuments=false}) {
 const [lang,setLang]=useState('ko'),[country,setCountry]=useState(''),[birthday,setBirthday]=useState(emptyBirthday);
 const [accepted,setAccepted]=useState(false),[policy,setPolicy]=useState(null),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[birthError,setBirthError]=useState(null);
 const countryRef=useRef(null),dateRefs=useRef({}),agreementRef=useRef(null);
 const en=lang==='en',t=(ko,enText)=>en?enText:ko;
 const errorText=code=>(errors[code]||errors.SERVICE)[en?1:0];
 const documentSet=resolveSignupDocuments(policy,{allowTestDocuments});
 const ageConsent=needsAgeProcessingConsent(country,documentSet);
 const parsedBirthday=parseBirthDateParts(birthday);
 const age=parsedBirthday.birthDate?ageOnDate(parsedBirthday.birthDate):null;
 const guardianNotice=ageConsent && documentSet?.guardianNotice && age!==null && age>=13 && age<18;
 const termsPath=`${base}legal/${documentSet?.termsVersion || TERMS_VERSION}/`;
 const privacyPath=`${base}legal/${documentSet?.privacyVersion || PRIVACY_VERSION}/`;
 const unavailable=signupAvailability(country,policy,{allowTestDocuments});
 const canEnterDetails=!loading && !!policy && !unavailable;
 const availabilityMessage=!loading && policy && (country || unavailable!=='COUNTRY_NOT_READY') ? unavailable : null;
 const load=async()=>{
  setLoading(true);setError('');
  try {if(!supabase)throw new Error();setPolicy(await fetchSignupPolicy(supabase));}
  catch {setError('SERVICE');}finally {setLoading(false);}
 };
 useEffect(()=>{if(enabled)load();else setLoading(false);},[enabled]);
 const next=()=>resolveWebOAuthNext({rawNext:new URLSearchParams(window.location.search).get('next'),origin:window.location.origin,base});
 const names=new Intl.DisplayNames([en?'en':'ko'],{type:'region'});
 const changeBirthday=(field,value)=>{
  setBirthday(previous=>({...previous,[field]:value}));setAccepted(false);setBirthError(null);setError('');
 };
 const checkBirthdayOnBlur=field=>{
  if(parsedBirthday.code && birthday[field] && (parsedBirthday.field===field || Object.values(birthday).every(Boolean)))setBirthError(parsedBirthday);
 };
 const clearLocalDeclaration=()=>{
  try {clearPendingSignup(window.sessionStorage);}catch { /* Storage access itself may be blocked. */ }
 };
 const existingLogin=async()=>{
  if(busy)return;setError('');setBusy(true);
  clearLocalDeclaration();
  try {await startExistingGoogleOAuth(next());}
  catch {setError('SERVICE');setBusy(false);}
 };
 const submit=async event=>{
  event.preventDefault();if(busy||loading)return;setError('');setBirthError(null);
  if(!country){setError('COUNTRY_REQUIRED');countryRef.current?.focus();return;}
  if(!canEnterDetails)return;
  if(parsedBirthday.code){setBirthError(parsedBirthday);dateRefs.current[parsedBirthday.field]?.focus();return;}
  if(!accepted){setError('TERMS_REQUIRED');agreementRef.current?.focus();return;}
  setBusy(true);
  try {
   const declaration=createDeclaration({country,birthDate:parsedBirthday.birthDate,accepted},policy,Date.now(),{allowTestDocuments});
   clearLocalDeclaration();
   await startGoogleOAuth(next(),declaration);
  }catch(e){
   clearLocalDeclaration();setBusy(false);
   if(e.code==='BELOW_MINIMUM_AGE'||e.code==='INVALID_BIRTH_DATE'){
    setBirthError({code:e.code,field:'year'});dateRefs.current.year?.focus();
   }else {setError(e.code||'SERVICE');}
  }
 };
 const globalError=error && !['COUNTRY_REQUIRED','TERMS_REQUIRED'].includes(error);

 return <section className="signup-panel signup-entry" lang={lang}>
  <div className="signup-heading"><span>MOEMOA</span><button type="button" onClick={()=>setLang(en?'ko':'en')} disabled={busy}>{en?'한국어':'English'}</button></div>
  <h1>{enabled?t('계정 만들기','Create your account'):t('로그인','Sign in')}</h1>
  <p className="signup-intro">{t('Google 계정으로 기록을 보관하고 다른 기기에서도 이어보세요.','Save your memories with Google and pick up on another device.')}</p>
  {!enabled?<button className="signup-primary" type="button" onClick={existingLogin} disabled={busy}>{busy?t('Google로 이동 중…','Opening Google…'):t('Google로 계속','Continue with Google')}</button>:
  <form onSubmit={submit} noValidate>
   <label htmlFor="signup-country">{t('거주 국가','Country of residence')}</label>
   <select ref={countryRef} id="signup-country" required value={country} onChange={e=>{setCountry(e.target.value);setBirthday(emptyBirthday());setAccepted(false);setBirthError(null);setError('');}} disabled={busy||loading} aria-invalid={error==='COUNTRY_REQUIRED'||undefined} aria-describedby={error==='COUNTRY_REQUIRED'?'signup-country-error':'signup-availability'}>
    <option value="">{t('국가 선택','Select your country')}</option>
    {COUNTRIES.map(code=><option key={code} value={code}>{names.of(code)}</option>)}
   </select>
   <p id="signup-availability" className="signup-hint" role="status">{availabilityMessage?errorText(availabilityMessage):''}</p>
   {error==='COUNTRY_REQUIRED'&&<p id="signup-country-error" className="signup-error" role="alert">{errorText(error)}</p>}
   <fieldset id="signup-birthday" className="signup-birthday" disabled={busy||!canEnterDetails} aria-describedby={`signup-birthday-help${birthError?' signup-birthday-error':''}`}>
    <legend>{t('생년월일','Date of birth')}</legend>
    <div className="signup-date-fields">
     {dateFields.map(([field,ko,label,placeholder,maxLength])=><div key={field}>
      <label htmlFor={`signup-birth-${field}`}>{t(ko,label)}</label>
      <input ref={node=>{dateRefs.current[field]=node;}} id={`signup-birth-${field}`} name={`birth-${field}`} type="text" inputMode="numeric" autoComplete={`bday-${field}`} placeholder={placeholder} maxLength={maxLength} required value={birthday[field]} onChange={e=>changeBirthday(field,e.target.value)} onBlur={()=>checkBirthdayOnBlur(field)} aria-invalid={birthError?.field===field||undefined} aria-describedby={birthError?'signup-birthday-error signup-birthday-help':'signup-birthday-help'} />
     </div>)}
    </div>
   </fieldset>
   {birthError&&<p id="signup-birthday-error" className="signup-error" role="alert">{errorText(birthError.code)}</p>}
   <p id="signup-birthday-help" className="signup-hint">{t('생년월일은 이 기기에서 나이를 확인하는 데만 사용합니다.','We calculate your age here without sending your full birth date.')}</p>
   {documentSet?.testOnly && <p className="signup-hint">{t('테스트용 가입 문서입니다. 운영에는 적용되지 않습니다.','These signup documents are for testing only.')}</p>}
   {ageConsent && <p id="signup-age-processing" className="signup-hint">{t('가입 연령 확인을 위해 국가·나이·확인일을 처리합니다. 국가·연령 구간·동의 기록은 탈퇴할 때까지 보관합니다. 동의하지 않아도 기기에서 계속 사용할 수 있습니다.','We process your country, age and declaration date to check signup eligibility. Your country, age band and acceptance record are kept until account deletion. You can keep using local features without agreeing.')}</p>}
   {guardianNotice && <p id="signup-guardian-notice" className="signup-hint">{t('보호자와 함께 아래 문서를 확인해 주세요. 보호자는 가입과 위 목적의 연령 정보 처리에 동의할 경우 아래 항목을 선택해 주세요.','Review the documents below with your parent or guardian. Your parent or guardian should select the agreement below if they agree to signup and the age-data processing described above.')}</p>}
   <div className="signup-agreement">
    <label className="signup-consent" htmlFor="signup-accepted"><input ref={agreementRef} id="signup-accepted" type="checkbox" checked={accepted} onChange={e=>{setAccepted(e.target.checked);if(error==='TERMS_REQUIRED')setError('');}} disabled={busy||!canEnterDetails} aria-invalid={error==='TERMS_REQUIRED'||undefined} aria-describedby={[ageConsent?'signup-age-processing':'',guardianNotice?'signup-guardian-notice':'',error==='TERMS_REQUIRED'?'signup-terms-error':''].filter(Boolean).join(' ')||undefined} /><span><a href={termsPath} target="_blank" rel="noreferrer">{t('이용약관','Terms')}</a>{ageConsent?<>{t('과 ',' and ')}<a href={`${privacyPath}#age-processing`} target="_blank" rel="noreferrer">{t('가입 연령 정보 처리','signup age information processing')}</a></>:null}{t('에 동의합니다.',' — I agree.')}</span></label>
    {error==='TERMS_REQUIRED'&&<p id="signup-terms-error" className="signup-error" role="alert">{errorText(error)}</p>}
    <p className="signup-hint signup-privacy"><a href={privacyPath} target="_blank" rel="noreferrer">{t('개인정보 처리 안내','Privacy notice')}</a>{t('에서 기록 보관과 삭제 방법을 확인할 수 있습니다.',' covers how your records are stored and deleted.')}</p>
   </div>
   <button className="signup-primary" type="submit" disabled={busy||!canEnterDetails}>{busy?t('Google로 이동 중…','Opening Google…'):loading?t('불러오는 중…','Loading…'):t('Google로 계속','Continue with Google')}</button>
  </form>}
  {globalError&&<p className="signup-error" role="alert">{errorText(error)}</p>}
  {enabled && error==='SERVICE'&&!policy?<button className="signup-retry" type="button" onClick={load} disabled={loading}>{t('다시 연결','Try again')}</button>:null}
  {enabled&&<p className="signup-existing">{t('이미 계정이 있나요?','Already have an account?')} <button type="button" onClick={existingLogin} disabled={busy}>{t('로그인','Sign in')}</button></p>}
  <a className="signup-back" href={`${base}data/`} onClick={clearLocalDeclaration}>{t('돌아가기','Go back')}</a>
 </section>;
}
