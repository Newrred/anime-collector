import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { createAccountDeleteHandler } from '../../src/server/accountDelete/handler.js';
import { createAccountDeleteBackend } from '../../src/server/accountDelete/backend.js';

const origin = 'https://account.example.test';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const time = Date.parse('2026-10-10T00:00:00Z');
const hash = value => createHash('sha256').update(value).digest('hex');
const emailHash = hash('fixture@example.test');
const body = { expectedUserId: owner, confirmed: true };

function harness(options = {}, backendOverrides = {}) {
  const calls = [];
  const backend = {
    authenticate: async token => { calls.push(['authenticate', token]); return { id: owner, emailHash }; },
    deleteUser: async id => { calls.push(['deleteUser', id]); return true; },
    ...backendOverrides,
  };
  const handler = createAccountDeleteHandler({
    enabled: true, origin, createBackend: () => { calls.push(['backend']); return backend; }, ...options,
  });
  async function request({ method = 'POST', headers = {}, input = body, stream } = {}) {
    const req = stream ? Readable.from(stream) : {};
    Object.assign(req, { method, headers: {
      origin, authorization: 'Bearer fixture-token', 'content-type': 'application/json',
      'sec-fetch-site': 'same-origin', ...headers,
    } });
    if (!stream) req.body = input;
    const res = {
      statusCode: 200, headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      end(value) { this.body = JSON.parse(value); },
    };
    await handler(req, res);
    return res;
  }
  return { request, calls, handler };
}

test('account deletion is disabled by default and accepts POST only without CORS preflight', async () => {
  const disabled = harness({ enabled: undefined });
  assert.equal((await disabled.request()).statusCode, 404);
  assert.deepEqual(disabled.calls, []);
  for (const method of ['GET', 'HEAD', 'DELETE', 'OPTIONS']) {
    const h = harness(), res = await h.request({ method });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'POST');
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
    assert.deepEqual(h.calls, []);
  }
});

test('successful deletion uses the verified user only and proves Auth deletion only', async () => {
  const h = harness(), res = await h.request();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { deleted: true });
  assert.deepEqual(h.calls, [['backend'], ['authenticate', 'fixture-token'], ['deleteUser', owner]]);
  for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
    assert.match(res.headers[header], /no-store/);
  }
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.match(res.headers.Vary, /Authorization/);
});

test('CSRF, absent Origin, wrong content type and missing bearer stop before backend creation', async () => {
  for (const headers of [
    { origin: 'https://evil.test' }, { origin: undefined }, { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' }, { 'sec-fetch-site': 'same-site' },
    { 'content-type': 'text/plain' }, { 'content-type': 'application/jsonp' },
    { authorization: undefined }, { authorization: 'Bearer ' },
    { authorization: 'Bearer a b' }, { authorization: ['Bearer fixture-token'] },
    { authorization: 'Bearer ' + 'a'.repeat(8193) },
  ]) {
    const h = harness(), res = await h.request({ headers });
    assert([400, 401].includes(res.statusCode));
    assert.deepEqual(h.calls, []);
  }
});

test('explicit confirmation, exact bounded object and valid expected user are required', async () => {
  for (const input of [null, [], 'not json', 'null', {}, { expectedUserId: owner },
    { ...body, confirmed: false }, { ...body, confirmed: 'true' },
    { ...body, expectedUserId: 'invalid' }, { ...body, userId: other },
    { ...body, email: 'unneeded@example.test' }, ' '.repeat(1025),
    { ...body, expectedUserId: 'x'.repeat(1025) }, Buffer.alloc(1025)]) {
    const h = harness(), res = await h.request({ input });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(h.calls, []);
  }
  const cyclic = { ...body }; cyclic.self = cyclic;
  assert.equal((await harness().request({ input: cyclic })).statusCode, 400);
  for (const length of ['1025', '-1', 'NaN', ['100']]) {
    const h = harness();
    assert.equal((await h.request({ headers: { 'content-length': length } })).statusCode, 400);
    assert.deepEqual(h.calls, []);
  }
});

test('raw JSON and bounded streams work; oversized or malformed streams never authenticate', async () => {
  for (const input of [JSON.stringify(body), Buffer.from(JSON.stringify(body))]) {
    assert.equal((await harness().request({ input })).statusCode, 200);
  }
  assert.equal((await harness().request({ stream: ['{"expectedUserId":', `"${owner}","confirmed":true}`] })).statusCode, 200);
  for (const stream of [['{'], [Buffer.alloc(600), Buffer.alloc(600)]]) {
    const h = harness();
    assert.equal((await h.request({ stream })).statusCode, 400);
    assert.deepEqual(h.calls, []);
  }
});

test('expected account mismatch and failed live authentication cannot delete any user', async () => {
  const mismatch = harness(), res = await mismatch.request({ input: { ...body, expectedUserId: other } });
  assert.deepEqual(res.body, { error: 'ACCOUNT_CHANGED' });
  assert.equal(res.statusCode, 409);
  assert(!mismatch.calls.some(call => call[0] === 'deleteUser'));
  for (const authenticate of [async () => null, async () => ({ id: 'invalid' }),
    async () => { throw Object.assign(new Error('secret-provider-detail'), { code: 'AUTH_REQUIRED' }); }]) {
    const h = harness({}, { authenticate });
    assert.deepEqual((await h.request()).body, { error: 'AUTH_REQUIRED' });
    assert(!h.calls.some(call => call[0] === 'deleteUser'));
  }
});

test('Preview requires a valid allowlist and checks the verified account email hash', async () => {
  for (const allowedEmailHashes of [undefined, '', 'invalid', ['a'.repeat(64)]]) {
    const h = harness({ preview: true, allowedEmailHashes });
    assert.equal((await h.request()).statusCode, 503);
    assert.deepEqual(h.calls, []);
  }
  for (const user of [{ id: owner, emailHash: hash('other@example.test') }, { id: owner, emailHash: null }]) {
    const h = harness({ preview: true, allowedEmailHashes: emailHash }, { authenticate: async () => user });
    assert.equal((await h.request()).statusCode, 403);
    assert(!h.calls.some(call => call[0] === 'deleteUser'));
  }
  assert.equal((await harness({ preview: true, allowedEmailHashes: ` ${hash('other@example.test')}, ${emailHash} ` }).request()).statusCode, 200);
  const constrained = harness({ allowedEmailHashes: hash('other@example.test') });
  assert.equal((await constrained.request()).statusCode, 403);
});

test('invalid server origin and arbitrary failures are safe, and deletion failure is never success', async () => {
  for (const configuredOrigin of [undefined, '', 'http://account.example.test', `${origin}/`, 'not a URL']) {
    const h = harness({ origin: configuredOrigin });
    assert.deepEqual((await h.request()).body, { error: 'ACCOUNT_DELETE_SERVICE_UNAVAILABLE' });
    assert.deepEqual(h.calls, []);
  }
  for (const deleteUser of [async () => false, async () => undefined,
    async () => { throw Object.assign(new Error('service-secret email token'), { code: 'ACCOUNT_DELETE_FAILED' }); },
    async () => { throw new Error('service-secret email token'); }]) {
    const res = await harness({}, { deleteUser }).request();
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.deleted, undefined);
    assert(!JSON.stringify(res).includes('service-secret'));
    assert.equal(Object.keys(res.body).length, 1);
  }
});

function sdkFixture({ userPatch = {}, claimsPatch = {}, userError = null, claimsError = null, deleteResult, deleteThrows } = {}) {
  const calls = [], clients = [];
  let live = true;
  const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' };
  const backend = createAccountDeleteBackend(env, {
    now: () => time,
    createClientImpl(url, key, options) {
      clients.push({ url, key, options });
      if (key === env.SUPABASE_SERVICE_ROLE_KEY) return { auth: { admin: { deleteUser: async (id, soft) => {
        calls.push(['deleteUser', id, soft]);
        if (deleteThrows) throw deleteThrows;
        if (deleteResult !== undefined) return deleteResult;
        live = false;
        return { data: { user: { id } }, error: null };
      } } } };
      return { auth: {
        getUser: async token => {
          calls.push(['getUser', token]);
          return { data: { user: live ? { id: owner, is_anonymous: false, email: '  FIXTURE@example.test ', email_confirmed_at: '2026-10-09T00:00:00Z', ...userPatch } : null }, error: userError };
        },
        getClaims: async token => {
          calls.push(['getClaims', token]);
          return { data: { claims: { sub: owner, role: 'authenticated', session_id: sessionId, exp: time / 1000 + 300, ...claimsPatch } }, error: claimsError };
        },
      } };
    },
  });
  return { backend, calls, clients };
}

test('backend validates JWT plus live user, uses server-only hard delete and ignores stale JWT after deletion', async () => {
  const h = sdkFixture();
  assert.deepEqual(await h.backend.authenticate('fixture-token'), { id: owner, emailHash });
  assert.equal(await h.backend.deleteUser(owner), true);
  assert(h.calls.some(call => call[0] === 'getUser'));
  assert(h.calls.some(call => call[0] === 'getClaims'));
  assert.deepEqual(h.calls.find(call => call[0] === 'deleteUser'), ['deleteUser', owner, false]);
  // Claims remain synthetically valid, but the Auth user no longer exists.
  await assert.rejects(h.backend.authenticate('fixture-token'), { code: 'AUTH_REQUIRED' });
  for (const client of h.clients) {
    assert.deepEqual(client.options.auth, { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  }
});

test('backend rejects anonymous, expired, forged/mismatched, unverified and missing live identities', async () => {
  for (const fixture of [
    { userPatch: { is_anonymous: true } }, { userPatch: { id: other } },
    { claimsPatch: { exp: time / 1000 } }, { claimsPatch: { sub: other } },
    { claimsPatch: { role: 'anon' } }, { claimsPatch: { session_id: '' } },
    { userError: { message: 'private-user-body' } }, { claimsError: { message: 'forged-signature' } },
  ]) {
    const h = sdkFixture(fixture);
    await assert.rejects(h.backend.authenticate('fixture-token'), { code: 'AUTH_REQUIRED' });
    assert(!h.calls.some(call => call[0] === 'deleteUser'));
  }
  for (const userPatch of [{ email_confirmed_at: null }, { email: null }]) {
    assert.equal((await sdkFixture({ userPatch }).backend.authenticate('fixture-token')).emailHash, null);
  }
});

test('backend rejects unsuccessful/ambiguous Auth responses without SQL or storage fallback', async () => {
  for (const options of [
    { deleteResult: { data: { user: null }, error: { message: 'storage ownership secret' } } },
    { deleteResult: { data: { user: { id: other } }, error: null } },
    { deleteResult: { data: { user: null }, error: null } },
    { deleteThrows: new Error('response lost secret') },
  ]) {
    const h = sdkFixture(options);
    await assert.rejects(h.backend.deleteUser(owner), { code: 'ACCOUNT_DELETE_FAILED', message: 'ACCOUNT_DELETE_FAILED' });
    assert.deepEqual(h.calls, [['deleteUser', owner, false]]);
  }
  const h = sdkFixture();
  await assert.rejects(h.backend.deleteUser('invalid'), { code: 'ACCOUNT_DELETE_FAILED' });
  assert.deepEqual(h.calls, []);
  assert.throws(() => createAccountDeleteBackend({}), { code: 'ACCOUNT_DELETE_SERVICE_UNAVAILABLE' });
});

test('handler and real backend adapter reject stale JWT and forged email claims before administrative deletion', async () => {
  const valid = sdkFixture();
  const endpoint = harness({ preview: true, allowedEmailHashes: emailHash, createBackend: () => valid.backend });
  assert.deepEqual((await endpoint.request()).body, { deleted: true });
  assert.equal((await endpoint.request()).statusCode, 401);
  assert.equal(valid.calls.filter(call => call[0] === 'deleteUser').length, 1);

  const unlisted = sdkFixture({ userPatch: { email: 'other@example.test' }, claimsPatch: { email: 'fixture@example.test' } });
  const denied = harness({ preview: true, allowedEmailHashes: emailHash, createBackend: () => unlisted.backend });
  assert.equal((await denied.request()).statusCode, 403);
  assert(!unlisted.calls.some(call => call[0] === 'deleteUser'));

  const expired = sdkFixture({ claimsPatch: { exp: time / 1000 } });
  assert.equal((await harness({ createBackend: () => expired.backend }).request()).statusCode, 401);
  assert(!expired.calls.some(call => call[0] === 'deleteUser'));
});
