import { createClient } from "@supabase/supabase-js";
import { PublicImageError } from "./processImage.js";

export const IMAGE_BUCKET = "memory-public-derivatives";
const SAFE = new Set(["AUTH_REQUIRED","PUBLICATION_DISABLED","PUBLIC_IMAGE_DISABLED","CONSENT_MISMATCH",
  "PUBLICATION_RESTRICTED","PUBLIC_VISUAL_NOT_READY","IMAGE_RIGHTS_REQUIRED","OPERATION_MISMATCH",
  "ASSET_OPERATION_UNAVAILABLE","IMAGE_QUOTA_EXCEEDED","ASSET_IN_USE","NOT_FOUND"]);
export async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new PublicImageError(SAFE.has(error.message) ? error.message : "IMAGE_SERVICE_FAILED", 409);
  return data;
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
    async user(token) {
      if (!token) throw new PublicImageError("AUTH_REQUIRED",401);
      const client = createClient(url,anon,{ ...options,global:{ ...options.global,headers:{ Authorization:`Bearer ${token}` } } });
      const { data,error } = await client.auth.getUser(token);
      if (error || !data.user) throw new PublicImageError("AUTH_REQUIRED",401);
      return { rpc:(name,args)=>rpc(client,name,args) };
    },
    rpc:(name,args)=>rpc(service,name,args),
    async put(path,bytes) { const { error }=await bucket.upload(path,bytes,{contentType:"image/webp",upsert:false,cacheControl:"0"}); if(error) throw new PublicImageError("IMAGE_STORAGE_FAILED",503); },
    async get(path) { const {data,error}=await bucket.download(path); if(error || !data) throw new PublicImageError("IMAGE_STORAGE_FAILED",503); return Buffer.from(await data.arrayBuffer()); },
    async remove(paths) { const {error}=await bucket.remove(paths); if(error) throw new PublicImageError("IMAGE_STORAGE_FAILED",503); },
  };
}
