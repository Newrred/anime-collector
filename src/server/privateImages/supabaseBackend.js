import { createClient } from '@supabase/supabase-js';
import { PrivateImageError, hash } from './processImage.js';

export const PRIVATE_BUCKET = 'memory-private-representations';
const safeCodes = new Set(['AUTH_REQUIRED','NOT_FOUND','INVALID_REQUEST','OPERATION_MISMATCH','IMAGE_SIZE_LIMIT',
  'PRIVATE_IMAGE_DISABLED','PRIVATE_IMAGE_PAUSED','PRIVATE_IMAGE_POLICY_STALE','PRIVATE_IMAGE_RETIRED','PRIVATE_IMAGE_CONFLICT',
  'PRIVATE_IMAGE_QUOTA_EXCEEDED','PRIVATE_IMAGE_CAPACITY_EXCEEDED','PRIVATE_IMAGE_RATE_LIMITED']);
export async function privateRpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const code = safeCodes.has(error.message) ? error.message : 'PRIVATE_IMAGE_SERVICE_FAILED';
    const status = code === 'NOT_FOUND' ? 404 : code === 'AUTH_REQUIRED' ? 401 : /EXCEEDED|LIMITED/.test(code) ? 429 : 409;
    throw new PrivateImageError(code, status);
  }
  return data;
}

export function createPrivateImageBackend(env = process.env) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_ANON_KEY: anon } = env;
  if (!url || !key || !anon) throw new PrivateImageError('PRIVATE_IMAGE_SERVICE_UNAVAILABLE', 503);
  const signal = AbortSignal.timeout(20_000);
  const options = { auth: { persistSession: false, autoRefreshToken: false }, global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal }),
  } };
  const service = createClient(url, key, options), bucket = service.storage.from(PRIVATE_BUCKET);
  const get = async path => {
    const { data, error } = await bucket.download(path);
    if (error || !data || data.size > 1_000_000) throw new PrivateImageError('PRIVATE_IMAGE_STORAGE_FAILED', 503);
    return Buffer.from(await data.arrayBuffer());
  };
  return {
    async user(token) {
      if (!token) throw new PrivateImageError('AUTH_REQUIRED', 401);
      const client = createClient(url, anon, { ...options, global: { ...options.global, headers: { Authorization: `Bearer ${token}` } } });
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) throw new PrivateImageError('AUTH_REQUIRED', 401);
      return { id: data.user.id, rpc: (name, args) => privateRpc(client, name, args) };
    },
    rpc: (name, args) => privateRpc(service, name, args),
    get,
    async put(path, bytes) {
      const { error } = await bucket.upload(path, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '0' });
      if (!error) return;
      // An identical concurrent/retried upload is safe. Never overwrite a different stored object.
      // Storage duplicate errors can use 400 or 409. Only byte identity establishes success.
      try { if (hash(await get(path)) === hash(bytes)) return; } catch { /* retain reservation for recovery */ }
      throw new PrivateImageError('PRIVATE_IMAGE_STORAGE_FAILED', 503);
    },
    async remove(paths) {
      const { error } = await bucket.remove(paths);
      if (error) throw new PrivateImageError('PRIVATE_IMAGE_STORAGE_FAILED', 503);
    },
  };
}
