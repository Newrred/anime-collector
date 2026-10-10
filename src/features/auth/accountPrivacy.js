const fail=code=>{throw Object.assign(new Error(code),{code});};
async function ownSession(client,expectedOwner) {
  if(!client || !expectedOwner) fail('AUTH_REQUIRED');
  const {data,error}=await client.auth.getSession();
  const session=data?.session;
  if(error || !session?.user?.id || session.user.is_anonymous || !session.access_token) fail('AUTH_REQUIRED');
  if(session.user.id!==expectedOwner) fail('ACCOUNT_CHANGED');
  return session;
}

export async function fetchOwnSignupReceipts(client,expectedOwner) {
  await ownSession(client,expectedOwner);
  const {data,error}=await client.rpc('get_my_simple_signup_receipts');
  await ownSession(client,expectedOwner);
  if(error || !Array.isArray(data?.receipts)) fail('RECEIPTS_UNAVAILABLE');
  return data.receipts.slice(0,20).map(row=>({
    policyVersion:typeof row.policyVersion==='string'?row.policyVersion:'',
    termsVersion:typeof row.termsVersion==='string'?row.termsVersion:'',
    privacyVersion:typeof row.privacyVersion==='string'?row.privacyVersion:'',
    country:typeof row.country==='string'?row.country:'',
    recordedAt:typeof row.recordedAt==='string'?row.recordedAt:'',
  }));
}

export async function verifyAccountStillExists(client,expectedOwner) {
  const session=await ownSession(client,expectedOwner);
  const {data,error}=await client.auth.getUser(session.access_token);
  if(error || data?.user?.id!==expectedOwner || data.user.is_anonymous) fail('AUTH_REQUIRED');
  await ownSession(client,expectedOwner);
}

export async function requestAccountDeletion(client,expectedOwner,{confirmed=false,fetchImpl=fetch}={}) {
  if(confirmed!==true) fail('CONFIRMATION_REQUIRED');
  const session=await ownSession(client,expectedOwner);
  let response,data;
  try {
    response=await fetchImpl('/api/account-delete',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
      body:JSON.stringify({expectedUserId:expectedOwner,confirmed:true}),signal:AbortSignal.timeout(30000)});
    data=await response.json();
  } catch { fail('ACCOUNT_DELETE_UNCONFIRMED'); }
  if(!response.ok || data?.deleted!==true) {
    const safe=['ACCOUNT_DELETE_DISABLED','INVALID_REQUEST','AUTH_REQUIRED','CONFIRMATION_REQUIRED','ACCOUNT_CHANGED',
      'ACCOUNT_DELETE_NOT_ALLOWED','ACCOUNT_DELETE_FAILED','ACCOUNT_DELETE_SERVICE_UNAVAILABLE'];
    fail(safe.includes(data?.error)?data.error:'ACCOUNT_DELETE_UNCONFIRMED');
  }
  return {deleted:true};
}

// This is only called after the server confirmed deletion. Do not sign out a
// different account that the user connected while the request was in flight.
export async function finishDeletedAccountSession(client,expectedOwner) {
  const {data,error}=await client.auth.getSession();
  if(error) fail('ACCOUNT_LOGOUT_FAILED');
  if(!data?.session) return {signedOut:true};
  if(data.session.user?.id!==expectedOwner) return {signedOut:false};
  const result=await client.auth.signOut({scope:'local'});
  if(result.error) fail('ACCOUNT_LOGOUT_FAILED');
  return {signedOut:true};
}
