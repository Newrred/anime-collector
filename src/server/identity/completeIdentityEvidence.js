// Server orchestration only. No public route or production provider is wired yet.
// A recorded identity proof does NOT grant adult access or guardian consent.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PURPOSES = new Set(['ADULT_IDENTITY', 'GUARDIAN_IDENTITY']);
export class IdentityEvidenceError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new IdentityEvidenceError(code); };
function validate(request, context, now) {
  if (!request || request.id !== context.requestId || request.userId !== context.userId) fail('VERIFICATION_NOT_FOUND');
  if (request.sessionId !== context.sessionId) fail('VERIFICATION_NOT_FOUND');
  if (request.purpose !== context.purpose) fail('VERIFICATION_PURPOSE_MISMATCH');
  if (!Number.isSafeInteger(request.revision) || request.revision < 0 || request.status !== 'PENDING') fail('VERIFICATION_NOT_PENDING');
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(request.expiresAt) || now >= request.expiresAt) fail('VERIFICATION_EXPIRED');
  for (const key of ['provider', 'channel', 'policyRevision', 'providerRequestId']) {
    if (typeof request[key] !== 'string' || request[key].length < 1 || request[key].length > 200) fail('VERIFICATION_INVALID');
  }
}

/**
 * store.load must use authenticated server identity, never client metadata.
 * provider.lookup must retrieve a trusted server-side result, not a callback body.
 * store.recordAtomically MUST recheck live session, request status/revision/expiry,
 * current policy and purpose under a transaction, then consume the request once.
 * Persistent adapters and request issuance remain a separate unfinished slice.
 */
export async function completeIdentityEvidence({ session, requestId, purpose }, { store, provider, now = Date.now }) {
  if (!session || !UUID.test(session.userId || '') || !UUID.test(session.sessionId || '')) fail('AUTH_REQUIRED');
  if (!UUID.test(requestId || '') || !PURPOSES.has(purpose)) fail('VERIFICATION_INVALID');
  const context = { userId: session.userId, sessionId: session.sessionId, requestId, purpose };
  const request = await store.load(context);
  validate(request, context, now());
  const policy = await store.currentPolicy(context);
  if (!policy?.enabled || policy.revision !== request.policyRevision || policy.provider !== request.provider || policy.channel !== request.channel) fail('VERIFICATION_POLICY_CHANGED');
  let result;
  try { result = await provider.lookup({ provider: request.provider, channel: request.channel, id: request.providerRequestId }); }
  catch { fail('VERIFICATION_PROVIDER_UNAVAILABLE'); }
  if (!result || result.status !== 'VERIFIED' || result.id !== request.providerRequestId || result.provider !== request.provider || result.channel !== request.channel) fail('VERIFICATION_RESULT_MISMATCH');
  validate(request, context, now());
  // Raw names, DOB, phone numbers, CI/DI and provider payloads are not persisted
  // or returned here. A separate approved policy evaluator may consume facts.
  const expected = { ...context, revision: request.revision, policyRevision: request.policyRevision,
    provider: request.provider, channel: request.channel, providerRequestId: request.providerRequestId, expiresAt: request.expiresAt };
  const receipt = await store.recordAtomically(expected);
  if (!receipt || receipt.requestId !== requestId || receipt.status !== 'RECORDED') fail('VERIFICATION_RECORD_FAILED');
  return { requestId, purpose, status: 'IDENTITY_EVIDENCE_RECORDED' };
}
