// Self-declaration only: never use this receipt as identity or guardian verification.
export const SIGNUP_POLICY_VERSION = 'simple-signup-2026-10-09';
export const TERMS_VERSION = 'terms-2026-10-09-draft';
export const PRIVACY_VERSION = 'privacy-2026-10-09-draft';
export const PENDING_SIGNUP_KEY = 'moemoa.signup.pending.v1';
export const PENDING_SIGNUP_TTL = 30 * 60 * 1000;
const fail = code => { throw Object.assign(new Error(code), { code }); };
export const COUNTRIES = Object.freeze(['KR','PH','TH','US','GB','AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','IS','LI','NO','CH']);
// Availability can be checked before asking for a birth date or acceptance.
// This is a UI hint, never a replacement for server admission checks.
export function signupAvailability(country, policy) {
  if (!policy?.enabled) return 'SIGNUP_SERVICE_UNAVAILABLE';
  if (policy.termsVersion!==TERMS_VERSION || policy.privacyVersion!==PRIVACY_VERSION) return 'SIGNUP_POLICY_CHANGED';
  const rule=policy.countries?.find(row=>row.country===country);
  if (!COUNTRIES.includes(country) || !rule || !Number.isInteger(rule.minimumAge) || rule.minimumAge<13 || rule.minimumAge>20) return 'COUNTRY_NOT_READY';
  return null;
}
export function calendarDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function ageOnDate(birthDate, day = calendarDay()) {
  const parse = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('INVALID_BIRTH_DATE');
    const [y,m,d] = value.split('-').map(Number), date = new Date(Date.UTC(y,m-1,d));
    if (y < 1900 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m-1 || date.getUTCDate() !== d) fail('INVALID_BIRTH_DATE');
    return [y,m,d];
  };
  const [y,m,d] = parse(birthDate), [ty,tm,td] = parse(day);
  if (birthDate > day) fail('INVALID_BIRTH_DATE');
  const age = ty-y-Number(tm<m || (tm===m && td<d));
  if (age>120) fail('INVALID_BIRTH_DATE');
  return age;
}
export function validateDeclaration(value, policy, now = Date.now()) {
  if (!value || value.version !== 1 || !COUNTRIES.includes(value.country)
      || !Number.isInteger(value.age) || value.age<0 || value.age>120
      || !Number.isSafeInteger(value.createdAt) || value.createdAt>now || now-value.createdAt>=PENDING_SIGNUP_TTL
      || !/^\d{4}-\d{2}-\d{2}$/.test(value.declaredOn || '')
      || value.termsVersion!==TERMS_VERSION || value.privacyVersion!==PRIVACY_VERSION || value.accepted!==true) fail('SIGNUP_DETAILS_EXPIRED');
  const rule = policy?.countries?.find(row => row.country===value.country);
  if (!policy?.enabled || !rule || !Number.isInteger(rule.minimumAge) || rule.minimumAge<13 || rule.minimumAge>20) fail('COUNTRY_NOT_READY');
  if (value.policyVersion !== policy.version || policy.termsVersion!==TERMS_VERSION || policy.privacyVersion!==PRIVACY_VERSION) fail('SIGNUP_POLICY_CHANGED');
  if (value.age<rule.minimumAge) fail('BELOW_MINIMUM_AGE');
  return {version:1,country:value.country,age:value.age,declaredOn:value.declaredOn,createdAt:value.createdAt,
    policyVersion:value.policyVersion,termsVersion:value.termsVersion,privacyVersion:value.privacyVersion,accepted:true};
}
export function createDeclaration({country,birthDate,accepted}, policy, now = Date.now()) {
  if (!accepted) fail('TERMS_REQUIRED');
  const declaredOn=calendarDay(new Date(now));
  return validateDeclaration({version:1,country,age:ageOnDate(birthDate,declaredOn),declaredOn,createdAt:now,
    policyVersion:policy?.version,termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION,accepted:true},policy,now);
}
export function readPendingSignup(storage, now=Date.now()) {
  try {
    const v=JSON.parse(storage.getItem(PENDING_SIGNUP_KEY) || 'null');
    if (!v) return null;
    if (!Number.isSafeInteger(v.createdAt) || v.createdAt>now || now-v.createdAt>=PENDING_SIGNUP_TTL) {
      storage.removeItem(PENDING_SIGNUP_KEY); return null;
    }
    return v;
  } catch { return null; }
}
export function clearPendingSignup(storage) { try { storage.removeItem(PENDING_SIGNUP_KEY); } catch { /* no raw data logging */ } }
export function writePendingSignup(storage, declaration) {
  try { storage.setItem(PENDING_SIGNUP_KEY,JSON.stringify(declaration)); }
  catch { fail('SIGNUP_STORAGE_UNAVAILABLE'); }
}
export async function fetchSignupPolicy(client) {
  const {data,error}=await client.rpc('get_simple_signup_policy');
  if(error || !data) fail('SIGNUP_SERVICE_UNAVAILABLE');
  return data;
}
export async function recordPendingSignup(client, storage, now=Date.now(), expectedOwner) {
  const pending=readPendingSignup(storage,now);
  if(!pending) fail('SIGNUP_DETAILS_EXPIRED');
  const {data:authData,error:authError}=await client.auth.getUser();
  const owner=authData?.user?.id;
  if(authError || !owner || authData.user.is_anonymous || (expectedOwner && owner!==expectedOwner)
    || (pending.ownerId && pending.ownerId!==owner)) fail('SIGNUP_ACCOUNT_CHANGED');
  writePendingSignup(storage,{...pending,ownerId:owner});
  const policy=await fetchSignupPolicy(client);
  const value=validateDeclaration(pending,policy,now);
  const {data,error}=await client.rpc('record_simple_signup_declaration',{
    p_expected_user_id:owner,
    p_country:value.country,p_declared_age:value.age,p_declared_on:value.declaredOn,
    p_policy_version:value.policyVersion,p_terms_version:value.termsVersion,p_privacy_version:value.privacyVersion,p_accept_terms:true,
  });
  if(error || !data?.recorded) {
    const safe=['SIGNUP_POLICY_CHANGED','COUNTRY_NOT_READY','BELOW_MINIMUM_AGE','SIGNUP_DETAILS_EXPIRED','SIGNUP_DECLARATION_CONFLICT','SIGNUP_ACCOUNT_CHANGED'];
    fail(safe.includes(error?.message)?error.message:'SIGNUP_RECEIPT_FAILED');
  }
  clearPendingSignup(storage);
  return data;
}
