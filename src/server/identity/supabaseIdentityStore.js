import { IdentityEvidenceError } from './completeIdentityEvidence.js';
const SAFE = new Set(['AUTH_REQUIRED','VERIFICATION_POLICY_CHANGED','VERIFICATION_NOT_FOUND','VERIFICATION_REQUEST_CHANGED',
  'VERIFICATION_NOT_PENDING','VERIFICATION_EXPIRED','VERIFICATION_RATE_LIMITED']);
// Server-only service client, supplied by the future authenticated HTTP adapter.
export function createIdentityStore(serviceClient) {
  async function rpc(name, args) {
    let response;
    try { response = await serviceClient.rpc(name, args); }
    catch { throw new IdentityEvidenceError('VERIFICATION_STORE_UNAVAILABLE'); }
    if (response?.error) throw new IdentityEvidenceError(SAFE.has(response.error.message) ? response.error.message : 'VERIFICATION_STORE_UNAVAILABLE');
    if (!response || !Object.hasOwn(response, 'data')) throw new IdentityEvidenceError('VERIFICATION_STORE_UNAVAILABLE');
    return response.data;
  }
  const context = value => ({ p_user: value.userId, p_session: value.sessionId, p_purpose: value.purpose });
  return {
    issue: value => rpc('issue_memory_identity_request', context(value)),
    load: value => rpc('get_memory_identity_request', { ...context(value), p_request: value.requestId }),
    currentPolicy: value => rpc('get_memory_identity_policy', { p_purpose: value.purpose }),
    recordAtomically: expected => rpc('complete_memory_identity_request', { p_expected: expected }),
  };
}
