import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { cleanupPrivateImages } from '../../src/server/privateImages/handler.js';

export const PHONE_TEST_PROJECT = 'nmgkhknponvzcwliajyk';
export const PHONE_TEST_URL = `https://${PHONE_TEST_PROJECT}.supabase.co`;
const BUCKET = 'memory-private-representations';
const CLAIM = 'claim_memory_private_image_cleanup';
const COMPLETE = 'complete_memory_private_image_cleanup';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail = code => { throw new Error(code); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;

export function validatePhoneTestCleanup(env, args) {
  if (!Array.isArray(args) || args.filter(value => value === '--apply').length !== 1
    || args.some(value => value !== '--apply' && value !== `--project=${PHONE_TEST_PROJECT}`)
    || args.filter(value => value.startsWith('--project=')).length > 1
    || env.GITHUB_REPOSITORY !== 'Newrred/anime-collector'
    || env.GITHUB_REF !== 'refs/heads/codex/phone-test'
    || env.GITHUB_EVENT_NAME !== 'workflow_dispatch') fail('PHONE_TEST_CLEANUP_CONTEXT_INVALID');
  for (const name of ['SUPABASE_URL', 'MOEMOA_TEST_SUPABASE_URL']) {
    if (env[name] !== undefined && env[name] !== PHONE_TEST_URL) fail('PHONE_TEST_CLEANUP_TARGET_INVALID');
  }
  for (const name of ['MOEMOA_PRIVATE_IMAGE_CLEANUP_PROJECT', 'MOEMOA_TEST_PRIVATE_IMAGE_CLEANUP_PROJECT']) {
    if (env[name] !== undefined && env[name] !== PHONE_TEST_PROJECT) fail('PHONE_TEST_CLEANUP_TARGET_INVALID');
  }
  const key = env.MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY;
  // This is an accidental wrong-project/role guard, not JWT signature verification.
  // Supabase verifies the signature. Opaque keys cannot establish this local binding.
  try {
    if (typeof key !== 'string' || key.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) throw new Error();
    const [header, payload] = key.split('.').slice(0, 2).map(value => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    if (!plain(header) || header.alg !== 'HS256' || !plain(payload)
      || payload.role !== 'service_role' || payload.ref !== PHONE_TEST_PROJECT
      || !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error();
  } catch { fail('PHONE_TEST_CLEANUP_KEY_INVALID'); }
}

function createCleanupBackend(key, { createClientImpl, fetchImpl }) {
  const allowedRequests = new Map([
    [`/rest/v1/rpc/${CLAIM}`, 'POST'], [`/rest/v1/rpc/${COMPLETE}`, 'POST'],
    [`/storage/v1/object/${BUCKET}`, 'DELETE'],
  ]);
  const client = createClientImpl(PHONE_TEST_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (url.origin !== PHONE_TEST_URL || url.username || url.password || url.search || url.hash
        || allowedRequests.get(url.pathname) !== init?.method) fail('PHONE_TEST_CLEANUP_REQUEST_INVALID');
      return fetchImpl(input, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    } },
  });
  const bucket = client.storage.from(BUCKET);
  const claimed = new Set(), removed = new Set();
  let claimUsed = false;
  return {
    async rpc(name, args) {
      if (name === CLAIM) {
        if (claimUsed || !plain(args) || Object.keys(args).length !== 0) fail('PHONE_TEST_CLEANUP_REQUEST_INVALID');
        claimUsed = true;
        const result = await client.rpc(CLAIM, {});
        if (result?.error !== null || !Array.isArray(result.data)) fail('PHONE_TEST_CLEANUP_CLAIM_FAILED');
        // A saturated batch is outside this bounded test run; inspect it before deleting.
        if (result.data.length >= 50) fail('PHONE_TEST_CLEANUP_LIMIT_REACHED');
        for (const row of result.data) {
          if (!plain(row) || Object.keys(row).length !== 1 || typeof row.id !== 'string'
            || !UUID.test(row.id) || claimed.has(row.id)) fail('PHONE_TEST_CLEANUP_CLAIM_INVALID');
          claimed.add(row.id);
        }
        return result.data;
      }
      if (name !== COMPLETE || !plain(args) || Object.keys(args).length !== 1
        || !removed.has(args.p_id)) fail('PHONE_TEST_CLEANUP_REQUEST_INVALID');
      const result = await client.rpc(COMPLETE, { p_id: args.p_id });
      if (result?.error !== null || result.data !== null) fail('PHONE_TEST_CLEANUP_COMPLETE_FAILED');
      return null;
    },
    async remove(paths) {
      const id = Array.isArray(paths) && paths.length === 2 ? paths[0]?.split('/')[0] : null;
      if (!claimed.has(id) || paths[0] !== `${id}/main.webp` || paths[1] !== `${id}/thumb.webp`) fail('PHONE_TEST_CLEANUP_REQUEST_INVALID');
      const result = await bucket.remove(paths);
      if (result?.error !== null || !Array.isArray(result.data)) fail('PHONE_TEST_CLEANUP_STORAGE_FAILED');
      removed.add(id);
    },
  };
}

export async function runPhoneTestCleanup(env = process.env, args = process.argv.slice(2),
  { createClientImpl = createClient, fetchImpl = fetch } = {}) {
  validatePhoneTestCleanup(env, args);
  try {
    const result = await cleanupPrivateImages(createCleanupBackend(env.MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY, { createClientImpl, fetchImpl }));
    if (!plain(result) || !Number.isSafeInteger(result.deleted) || result.deleted < 0 || result.deleted >= 50
      || result.failed !== 0) fail('PHONE_TEST_CLEANUP_FAILED');
    return { deleted: result.deleted, failed: 0 };
  } catch { fail('PHONE_TEST_CLEANUP_FAILED'); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await runPhoneTestCleanup())); }
  catch {
    // SDK/network errors may contain keys, object names or response bodies.
    console.error('::error::PHONE_TEST_CLEANUP_FAILED');
    process.exitCode = 1;
  }
}
