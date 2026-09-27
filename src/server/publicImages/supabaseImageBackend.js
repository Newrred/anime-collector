import { createClient } from "@supabase/supabase-js";
import { PublicImageError } from "./processImage.js";
import { authenticateVerifiedSession } from '../identity/authenticateIdentitySession.js';

export const IMAGE_BUCKET = "memory-public-derivatives";
const SAFE = new Set(["AUTH_REQUIRED","PUBLICATION_DISABLED","PUBLIC_IMAGE_DISABLED","CONSENT_MISMATCH",
  "ELIGIBILITY_REQUIRED","ELIGIBILITY_EXPIRED","ELIGIBILITY_POLICY_CHANGED","ELIGIBILITY_POLICY_UNAVAILABLE",
  "PUBLICATION_RESTRICTED","PUBLIC_VISUAL_NOT_READY","IMAGE_RIGHTS_REQUIRED","OPERATION_MISMATCH","SOURCE_IMAGE_MISMATCH",
  "ASSET_OPERATION_UNAVAILABLE","IMAGE_QUOTA_EXCEEDED","ASSET_IN_USE","NOT_FOUND","RATE_LIMITED",
  "MODERATOR_REQUIRED","CONTENT_POLICY_CHANGED","PUBLICATION_CONFLICT"]);
export async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const code=SAFE.has(error.message) ? error.message : "IMAGE_SERVICE_FAILED";
    const status=code==='RATE_LIMITED' ? 429
      : ['MODERATOR_REQUIRED','ELIGIBILITY_REQUIRED','ELIGIBILITY_EXPIRED'].includes(code) ? 403
      : code==='ELIGIBILITY_POLICY_UNAVAILABLE' ? 503 : 409;
    throw new PublicImageError(code,status);
  }
  return data;
}

export async function resolveViewerImage(service, token, args) {
  let viewer;
  try { viewer=await authenticateVerifiedSession(service.auth,token); }
  catch { throw new PublicImageError('AUTH_REQUIRED',401); }
  return rpc(service,'resolve_memory_viewer_image',{
    p_publication_id:args.p_publication_id,p_asset_id:args.p_asset_id,p_variant:args.p_variant,
    p_viewer:viewer.userId,p_session:viewer.sessionId,p_expires:viewer.expiresAtSeconds,
  });
}

export function createSupabaseImageBackend(env = process.env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = env.SUPABASE_ANON_KEY;
  if (!url || !key || !anon) throw new PublicImageError("IMAGE_SERVICE_UNAVAILABLE",503);
  const signal = AbortSignal.timeout(20_000);
  const options = { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal }) } };
  const service = createClient(url,key,options);
  const bucket = service.storage.from(IMAGE_BUCKET);
  return {
    viewerImage:(token,args)=>resolveViewerImage(service,token,args),
    async user(token) {
      if (!token) throw new PublicImageError("AUTH_REQUIRED",401);
      const client = createClient(url,anon,{ ...options,global:{ ...options.global,headers:{ Authorization:`Bearer ${token}` } } });
      const { data,error } = await client.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) throw new PublicImageError("AUTH_REQUIRED",401);
      return { rpc:(name,args)=>rpc(client,name,args) };
    },
    rpc:(name,args)=>rpc(service,name,args),
    async put(path,bytes) { const { error }=await bucket.upload(path,bytes,{contentType:"image/webp",upsert:false,cacheControl:"0"}); if(error) throw new PublicImageError("IMAGE_STORAGE_FAILED",503); },
    async get(path) { const {data,error}=await bucket.download(path); if(error || !data) throw new PublicImageError("IMAGE_STORAGE_FAILED",503); return Buffer.from(await data.arrayBuffer()); },
    async getPrivate(path) { const {data,error}=await service.storage.from('memory-private-representations').download(path); if(error || !data) throw new PublicImageError('IMAGE_STORAGE_FAILED',503); return Buffer.from(await data.arrayBuffer()); },
    async remove(paths) { const {error}=await bucket.remove(paths); if(error) throw new PublicImageError("IMAGE_STORAGE_FAILED",503); },
  };
}
