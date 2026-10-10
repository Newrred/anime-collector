import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { authenticateVerifiedSession } from '../identity/authenticateIdentitySession.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail = code => { throw Object.assign(new Error(code), { code }); };

export function createAccountDeleteBackend(env = process.env, {
  createClientImpl = createClient, now = Date.now,
} = {}) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, SUPABASE_ANON_KEY: anonKey } = env;
  if (!url || !serviceKey || !anonKey) fail('ACCOUNT_DELETE_SERVICE_UNAVAILABLE');
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
      }),
    },
  };
  const verifier = createClientImpl(url, anonKey, options);
  const service = createClientImpl(url, serviceKey, options);
  return {
    async authenticate(token) {
      let user;
      // Capture exactly the live getUser result validated by the shared verifier.
      // Cached JWT validity alone cannot authorize a deleted Auth account.
      const session = await authenticateVerifiedSession({
        getClaims: value => verifier.auth.getClaims(value),
        getUser: async value => {
          const result = await verifier.auth.getUser(value);
          user = result.data?.user;
          return result;
        },
      }, token, now);
      const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
      const emailHash = email && email.length <= 320 && user.email_confirmed_at
        ? createHash('sha256').update(email).digest('hex') : null;
      return { id: session.userId, emailHash };
    },
    async deleteUser(userId) {
      if (typeof userId !== 'string' || !UUID.test(userId)) fail('ACCOUNT_DELETE_FAILED');
      try {
        // Hard delete invokes the existing database cascades/retirement triggers.
        // Do not fall back to direct SQL or remove Storage files before Auth succeeds.
        const result = await service.auth.admin.deleteUser(userId, false);
        if (result.error || result.data?.user?.id !== userId) fail('ACCOUNT_DELETE_FAILED');
        return true;
      } catch {
        // A timeout may follow a committed deletion; it is not a confirmed success.
        fail('ACCOUNT_DELETE_FAILED');
      }
    },
  };
}
