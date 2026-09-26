import { IdentityEvidenceError } from './completeIdentityEvidence.js';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function authenticateVerifiedSession(auth, token, now=Date.now) {
  if(typeof token!=='string'||!token||token.length>8192)throw new IdentityEvidenceError('AUTH_REQUIRED');
  try {
    // getClaims verifies the JWT; never decode an unsigned client claim locally.
    const [claimsResult,userResult]=await Promise.all([auth.getClaims(token),auth.getUser(token)]);
    const c=claimsResult.data?.claims,u=userResult.data?.user;
    if(claimsResult.error||userResult.error||!u||u.is_anonymous||!c||c.sub!==u.id||c.role!=='authenticated'
      ||!UUID.test(c.sub)||!UUID.test(c.session_id||'')||!Number.isSafeInteger(c.exp)||c.exp*1000<=now())throw new Error('invalid');
    return {userId:c.sub,sessionId:c.session_id,expiresAtSeconds:c.exp};
  } catch {throw new IdentityEvidenceError('AUTH_REQUIRED');}
}
export async function authenticateIdentitySession(auth, token, now=Date.now) {
  const {userId,sessionId}=await authenticateVerifiedSession(auth,token,now);
  return {userId,sessionId};
}
