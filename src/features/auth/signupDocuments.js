// A policy is meaningful only with its exact, immutable document pair.
// Never accept server-supplied URLs or reinterpret an older receipt's scope.
export const SIGNUP_POLICY_VERSION = 'simple-signup-2026-10-09';
export const TERMS_VERSION = 'terms-2026-10-09-draft';
export const PRIVACY_VERSION = 'privacy-2026-10-09-draft';
export const TEST_SIGNUP_POLICY_VERSION = 'simple-signup-2026-10-10-test';
export const TEST_TERMS_VERSION = 'terms-2026-10-10-test';
export const TEST_PRIVACY_VERSION = 'privacy-2026-10-10-test';
export const PRODUCTION_SIGNUP_POLICY_VERSION = 'simple-signup-2026-10-10';
export const PRODUCTION_TERMS_VERSION = 'terms-2026-10-10';
export const PRODUCTION_PRIVACY_VERSION = 'privacy-2026-10-10';

const documents = Object.freeze([
  Object.freeze({policyVersion:SIGNUP_POLICY_VERSION, termsVersion:TERMS_VERSION,
    privacyVersion:PRIVACY_VERSION, testOnly:false, ageProcessingConsent:false}),
  Object.freeze({policyVersion:TEST_SIGNUP_POLICY_VERSION, termsVersion:TEST_TERMS_VERSION,
    privacyVersion:TEST_PRIVACY_VERSION, testOnly:true, ageProcessingConsent:true}),
  Object.freeze({policyVersion:PRODUCTION_SIGNUP_POLICY_VERSION, termsVersion:PRODUCTION_TERMS_VERSION,
    privacyVersion:PRODUCTION_PRIVACY_VERSION, testOnly:false, ageProcessingConsent:true, guardianNotice:true}),
]);

export function resolveSignupDocuments(policy, {allowTestDocuments=false}={}) {
  return documents.find(row => row.policyVersion === (policy?.version ?? policy?.policyVersion)
    && row.termsVersion === policy?.termsVersion && row.privacyVersion === policy?.privacyVersion
    && (!row.testOnly || allowTestDocuments)) || null;
}

export function needsAgeProcessingConsent(country, documentSet) {
  return country === 'PH' && documentSet?.ageProcessingConsent === true;
}
