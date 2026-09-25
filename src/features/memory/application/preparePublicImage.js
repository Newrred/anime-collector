export class PublicImagePreparationError extends Error {
  constructor(code) { super(code); this.code=code; }
}
const fail=(code)=>{ throw new PublicImagePreparationError(code); };

// Caller supplies the explicitly selected original. Never use a preview or substitute a cover.
export async function prepareSelectedPublicImage({ sourceAssetId,sourceVersion,operationId,accessToken,policyRevision,
  consented=false,readOriginal,privateRepresentation,signal,fetchImpl=globalThis.fetch }) {
  if(!consented || !policyRevision) fail("IMAGE_CONSENT_REQUIRED");
  if(!accessToken) fail("AUTH_REQUIRED");
  if(signal?.aborted) fail("REQUEST_ABORTED");
  if(privateRepresentation && (!/^[a-f0-9-]{36}$/i.test(privateRepresentation.id || '') || !/^[a-f0-9]{64}$/.test(privateRepresentation.hash || ''))) fail('PUBLIC_VISUAL_NOT_READY');
  if(!privateRepresentation && typeof readOriginal!=="function") fail("ORIGINAL_IMAGE_UNAVAILABLE");
  let original;
  if(!privateRepresentation) {
    try { original=await readOriginal(); } catch { fail(signal?.aborted ? "REQUEST_ABORTED" : "ORIGINAL_IMAGE_UNAVAILABLE"); }
    if(!(original instanceof Blob) || !original.size) fail("ORIGINAL_IMAGE_UNAVAILABLE");
    if(original.size>4*1024*1024) fail("IMAGE_SIZE_LIMIT");
  }
  if(signal?.aborted) fail("REQUEST_ABORTED");
  let response;
  try {
    response=await fetchImpl("/api/public-image",{method:"POST",signal,cache:"no-store",
      headers:{"Content-Type":"application/octet-stream",Authorization:`Bearer ${accessToken}`,
        "X-Moemoa-Asset":sourceAssetId,"X-Moemoa-Version":String(sourceVersion),"X-Moemoa-Operation":operationId,"X-Moemoa-Consent":policyRevision,
        ...(privateRepresentation ? {'X-Moemoa-Private-Representation':privateRepresentation.id,'X-Moemoa-Representation-Hash':privateRepresentation.hash} : {})},body:privateRepresentation ? undefined : original});
  } catch { fail(signal?.aborted ? "REQUEST_ABORTED" : "IMAGE_REQUEST_FAILED"); }
  const result=await response.json().catch(()=>null);
  if(!response.ok) {
    const allowed=new Set(["AUTH_REQUIRED","PUBLIC_IMAGE_DISABLED","PUBLICATION_DISABLED","RATE_LIMITED","IMAGE_RIGHTS_REQUIRED","IMAGE_QUOTA_EXCEEDED","PUBLIC_VISUAL_NOT_READY",
      "SOURCE_IMAGE_MISMATCH","IMAGE_SIZE_LIMIT","IMAGE_FORMAT_UNSUPPORTED","IMAGE_DECODE_FAILED","ASSET_OPERATION_UNAVAILABLE","ASSET_OPERATION_FAILED","PUBLICATION_RESTRICTED","CONSENT_MISMATCH"]);
    const error=new PublicImagePreparationError(allowed.has(result?.error) ? result.error : "IMAGE_REQUEST_FAILED");
    error.retryable=result?.retryable===true;
    throw error;
  }
  if(result?.state!=="READY" || !/^[a-f0-9-]{36}$/i.test(result?.id || "")) fail("IMAGE_REQUEST_FAILED");
  return { id:result.id,state:"READY" };
}
