import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runPhoneTestCleanup, validatePhoneTestCleanup, PHONE_TEST_PROJECT, PHONE_TEST_URL } from '../../tools/private-images/run-phone-test-cleanup.mjs';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const key = (payload = {}, header = {}) => `${encode({ alg: 'HS256', typ: 'JWT', ...header })}.${encode({ ref: PHONE_TEST_PROJECT, role: 'service_role', exp: 4102444800, ...payload })}.synthetic_signature_never_a_real_key`;
const environment = (changes = {}) => ({
  GITHUB_REPOSITORY: 'Newrred/anime-collector', GITHUB_REF: 'refs/heads/codex/phone-test',
  GITHUB_EVENT_NAME: 'workflow_dispatch', MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY: key(), ...changes,
});
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

function sdkHarness({ rows = [{ id }], storageError = false, completeError = false, claimError = false, missingObjects = false } = {}) {
  const events = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.origin, PHONE_TEST_URL);
    assert.equal(init.redirect, 'error');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal instanceof AbortSignal);
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), key());
    assert.equal(headers.get('authorization'), `Bearer ${key()}`);
    events.push({ path: url.pathname, method: init.method, body: JSON.parse(init.body) });
    if (url.pathname === '/rest/v1/rpc/claim_memory_private_image_cleanup') return response(claimError ? { message: 'private provider details' } : rows, claimError ? 500 : 200);
    if (url.pathname === '/storage/v1/object/memory-private-representations') return response(storageError ? { message: 'private storage details' } : missingObjects ? [] : [{ name: `${id}/main.webp` }, { name: `${id}/thumb.webp` }], storageError ? 500 : 200);
    if (url.pathname === '/rest/v1/rpc/complete_memory_private_image_cleanup') return response(completeError ? { message: 'private complete details' } : null, completeError ? 500 : 200);
    throw new Error('Unexpected request');
  };
  return { events, run: () => runPhoneTestCleanup(environment(), ['--apply'], { fetchImpl }) };
}

test('phone-test cleanup requires explicit apply and exact repository, branch and manual event before client creation', async () => {
  const createClientImpl = () => assert.fail('must not create a client');
  for (const changes of [
    { GITHUB_REPOSITORY: 'someone/anime-collector' }, { GITHUB_REPOSITORY: '' },
    { GITHUB_REF: 'refs/heads/master' }, { GITHUB_REF: 'refs/tags/codex/phone-test' },
    { GITHUB_EVENT_NAME: 'schedule' }, { GITHUB_EVENT_NAME: 'push' },
  ]) await assert.rejects(runPhoneTestCleanup(environment(changes), ['--apply'], { createClientImpl }), /CONTEXT_INVALID/);
  for (const args of [[], ['--apply', '--apply'], ['--apply', '--project=production'], ['--apply', '--url=https://example.com'], ['--apply', '--project=' + PHONE_TEST_PROJECT, '--project=' + PHONE_TEST_PROJECT]]) {
    await assert.rejects(runPhoneTestCleanup(environment(), args, { createClientImpl }), /CONTEXT_INVALID/);
  }
  assert.doesNotThrow(() => validatePhoneTestCleanup(environment(), ['--apply', '--project=' + PHONE_TEST_PROJECT]));
});

test('phone-test cleanup rejects every different project/URL override and keeps the exact fixed target', () => {
  for (const name of ['SUPABASE_URL', 'MOEMOA_TEST_SUPABASE_URL']) {
    for (const value of ['https://production.supabase.co', PHONE_TEST_URL + '/', '', PHONE_TEST_URL + '?secret=bad']) {
      assert.throws(() => validatePhoneTestCleanup(environment({ [name]: value }), ['--apply']), /TARGET_INVALID/);
    }
    assert.doesNotThrow(() => validatePhoneTestCleanup(environment({ [name]: PHONE_TEST_URL }), ['--apply']));
  }
  for (const name of ['MOEMOA_PRIVATE_IMAGE_CLEANUP_PROJECT', 'MOEMOA_TEST_PRIVATE_IMAGE_CLEANUP_PROJECT']) {
    assert.throws(() => validatePhoneTestCleanup(environment({ [name]: 'production' }), ['--apply']), /TARGET_INVALID/);
  }
});

test('phone-test cleanup accepts only unexpired legacy service-role JWTs bound to the test project', () => {
  for (const value of [undefined, '', 'sb_secret_opaque_test_key', 'not-a-key', key({ role: 'anon' }), key({ ref: 'production' }), key({ exp: 1 }), key({ exp: '4102444800' }), key({}, { alg: 'none' }), 'x'.repeat(8193), 'e30.invalid.signature']) {
    assert.throws(() => validatePhoneTestCleanup(environment({ MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY: value }), ['--apply']), /KEY_INVALID/);
  }
});

test('actual installed SDK removes only the two claimed private objects and then completes, with aggregates only', async () => {
  const h = sdkHarness();
  assert.deepEqual(await h.run(), { deleted: 1, failed: 0 });
  assert.deepEqual(h.events, [
    { path: '/rest/v1/rpc/claim_memory_private_image_cleanup', method: 'POST', body: {} },
    { path: '/storage/v1/object/memory-private-representations', method: 'DELETE', body: { prefixes: [`${id}/main.webp`, `${id}/thumb.webp`] } },
    { path: '/rest/v1/rpc/complete_memory_private_image_cleanup', method: 'POST', body: { p_id: id } },
  ]);
});

test('empty queue succeeds without touching Storage and a subsequent empty run is idempotent', async () => {
  const h = sdkHarness({ rows: [] });
  assert.deepEqual(await h.run(), { deleted: 0, failed: 0 });
  assert.deepEqual(await h.run(), { deleted: 0, failed: 0 });
  assert.equal(h.events.length, 2);
  assert.ok(h.events.every(event => event.path.endsWith('claim_memory_private_image_cleanup')));
});

test('malformed, duplicate or saturated claims fail before any object removal', async () => {
  for (const rows of [null, {}, [{ id: '../other-bucket' }], [{ id: [id] }], [{ id }, { id }], [{ id, extra: true }], [{ id }, null], Array.from({ length: 50 }, (_, n) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}` }))]) {
    const h = sdkHarness({ rows });
    await assert.rejects(h.run(), /^Error: PHONE_TEST_CLEANUP_FAILED$/);
    assert.equal(h.events.length, 1);
  }
});

test('claim failure never removes objects; Storage failure never finalizes the manifest', async () => {
  for (const options of [{ claimError: true }, { storageError: true }]) {
    const h = sdkHarness(options);
    await assert.rejects(h.run(), /^Error: PHONE_TEST_CLEANUP_FAILED$/);
    assert.equal(h.events.length, options.claimError ? 1 : 2);
    assert.ok(!h.events.some(event => event.path.endsWith('complete_memory_private_image_cleanup')));
  }
});

test('completion failure is not success and a later missing-object removal can safely finalize the retry', async () => {
  const failed = sdkHarness({ completeError: true });
  await assert.rejects(failed.run(), /^Error: PHONE_TEST_CLEANUP_FAILED$/);
  assert.equal(failed.events.length, 3);
  const retry = sdkHarness({ missingObjects: true });
  assert.deepEqual(await retry.run(), { deleted: 1, failed: 0 });
});

test('network exceptions and redirect responses never expose provider content or finalize', async () => {
  for (const fetchImpl of [async () => { throw new Error('private-secret-and-object-path'); }, async () => new Response(null, { status: 307, headers: { location: 'https://example.com/private' } })]) {
    await assert.rejects(runPhoneTestCleanup(environment(), ['--apply'], { fetchImpl }), /^Error: PHONE_TEST_CLEANUP_FAILED$/);
  }
});

test('transport rejects a different host, arbitrary RPC, method, query and storage bucket before fetch', async () => {
  for (const [url, method] of [
    ['https://example.com/rest/v1/rpc/claim_memory_private_image_cleanup', 'POST'],
    [PHONE_TEST_URL + '/rest/v1/rpc/delete_users', 'POST'],
    [PHONE_TEST_URL + '/rest/v1/rpc/claim_memory_private_image_cleanup?extra=1', 'POST'],
    [PHONE_TEST_URL + '/rest/v1/rpc/claim_memory_private_image_cleanup', 'GET'],
    [PHONE_TEST_URL + '/storage/v1/object/memory-public-derivatives', 'DELETE'],
  ]) {
    const createClientImpl = (target, secret, options) => {
      assert.equal(target, PHONE_TEST_URL);
      assert.equal(secret, key());
      assert.equal(options.auth.persistSession, false);
      assert.equal(options.auth.autoRefreshToken, false);
      return { storage: { from: () => ({}) }, rpc: () => options.global.fetch(url, { method }) };
    };
    await assert.rejects(runPhoneTestCleanup(environment(), ['--apply'], { createClientImpl, fetchImpl: () => assert.fail('must not fetch') }), /^Error: PHONE_TEST_CLEANUP_FAILED$/);
  }
});

test('partial deletion failure is an overall failure and does not complete that failed object', async () => {
  const completed = [];
  const createClientImpl = () => ({
    rpc: async (name, args) => {
      if (name === 'claim_memory_private_image_cleanup') return { data: [{ id }, { id: other }], error: null };
      completed.push(args.p_id); return { data: null, error: null };
    },
    storage: { from: bucket => {
      assert.equal(bucket, 'memory-private-representations');
      return { remove: async paths => ({ data: [], error: paths[0].startsWith(other) ? { message: 'private' } : null }) };
    } },
  });
  await assert.rejects(runPhoneTestCleanup(environment(), ['--apply'], { createClientImpl }), /^Error: PHONE_TEST_CLEANUP_FAILED$/);
  assert.deepEqual(completed, [id]);
});

test('CLI failure emits a fixed code only, never its key or payload', () => {
  const secret = key({ ref: 'wrong-secret-project' });
  const result = spawnSync(process.execPath, ['tools/private-images/run-phone-test-cleanup.mjs', '--apply'], {
    env: { ...process.env, ...environment({ MOEMOA_TEST_SUPABASE_SERVICE_ROLE_KEY: secret }) }, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), '::error::PHONE_TEST_CLEANUP_FAILED');
  assert.ok(!result.stderr.includes(secret) && !result.stderr.includes('wrong-secret-project'));
});
