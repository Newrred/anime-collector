import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adminErrorCode, createAdminService, createAdminRequestScope, parseAdminStatus} from '../../src/features/admin/adminService.js';
import {adminFixture} from './adminFixture.mjs';

test('admin aggregate decoder accepts exact contract and drops unrequested private data', () => {
  const value = adminFixture(); value.privateNotes = 'never render'; value.signup.email = 'private';
  const decoded = parseAdminStatus(value);
  assert.equal(decoded.signup.enabled, true);
  assert.equal(decoded.counts.accounts, 12);
  assert.ok(!JSON.stringify(decoded).includes('never render'));
  assert.equal(decoded.signup.email, undefined);
});
test('invalid admin responses fail closed instead of treating unavailable as zero or granting controls', () => {
  for (const mutate of [
    value => { value.version = 2; }, value => { value.revision = 'old'; },
    value => { value.counts.accounts = -1; }, value => { delete value.counts; },
    value => { value.signup.canResume = 'true'; }, value => { value.signup.countries.push(value.signup.countries[0]); },
    value => { value.signup.countries[0].minimumAge = 12; }, value => { value.signup.countries[0].minimumAge = 21; },
    value => { value.signup.termsVersion = 'https://outside.test'; }, value => { value.audit = [{action: 'RAW_SQL'}]; },
    value => { value.costs.privateObservedAt = 'unknown'; }, value => { value.images.private.states = null; },
  ]) {
    const value = adminFixture(); mutate(value);
    assert.throws(() => parseAdminStatus(value), /ADMIN_UNAVAILABLE/);
  }
});
test('missing optional public storage policy is unknown, never zero capacity', () => {
  const value = adminFixture(); value.costs.publicStorageLimitBytes = null;
  assert.equal(parseAdminStatus(value).costs.publicStorageLimitBytes, null);
  delete value.costs.publicStorageLimitBytes;
  assert.throws(() => parseAdminStatus(value), /ADMIN_UNAVAILABLE/);
});
test('admin client only uses authenticated RPC and exact expected-revision arguments', async () => {
  const calls = [];
  const service = createAdminService({rpc: async (...args) => { calls.push(args); return {data: adminFixture(), error: null}; }});
  await service.read(); await service.setPaused('b'.repeat(64), true);
  assert.deepEqual(calls, [['get_moemoa_admin_status', undefined], ['set_moemoa_signup_paused', {p_expected_revision: 'b'.repeat(64), p_paused: true}]]);
  await assert.rejects(service.setPaused('bad', true), /ADMIN_INVALID_REQUEST/);
  assert.equal(calls.length, 2);
});
test('admin failures preserve only allowlisted codes, never backend details', async () => {
  assert.equal(adminErrorCode({message: 'ADMIN_REQUIRED'}), 'ADMIN_REQUIRED');
  for (const error of [{message: 'secret detail'}, new TypeError('connection token'), null]) {
    const service = createAdminService({rpc: async () => { throw error; }});
    await assert.rejects(service.read(), {message: 'ADMIN_UNAVAILABLE'});
  }
  await assert.rejects(createAdminService(null).read(), {message: 'ADMIN_UNAVAILABLE'});
});
test('new admin requests and session invalidation isolate old read/write replies', () => {
  const scope = createAdminRequestScope(), oldRead = scope.next(), write = scope.next();
  assert.equal(scope.current(oldRead), false); assert.equal(scope.current(write), true);
  scope.invalidate(); assert.equal(scope.current(write), false);
  const nextAccount = scope.next(); assert.equal(scope.current(nextAccount), true);
});
test('admin RPC is bounded by a 20 second abort and clears its timer', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  let signal;
  const service = createAdminService({rpc: () => ({abortSignal: input => {
    signal = input;
    return new Promise((resolve, reject) => input.addEventListener('abort', () => reject(new Error('private timeout'))));
  }})});
  const pending = assert.rejects(service.read(), {message: 'ADMIN_UNAVAILABLE'});
  t.mock.timers.tick(19999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); await pending; assert.equal(signal.aborted, true);
  let completedSignal;
  const successful = createAdminService({rpc: () => ({abortSignal: input => {
    completedSignal = input;
    return Promise.resolve({data: adminFixture(), error: null});
  }})});
  await successful.read(); t.mock.timers.tick(20000); assert.equal(completedSignal.aborted, false);
});
test('admin UI uses dedicated flag, never an email or public publication gate', async () => {
  const source = await readFile(new URL('../../src/components/AdminDashboard.jsx', import.meta.url), 'utf8');
  const entry = await readFile(new URL('../../src/features/admin/AdminEntry.jsx', import.meta.url), 'utf8');
  assert.ok(!source.includes('godburgundy') && !entry.includes('godburgundy'));
  assert.ok(!source.includes('publicationUiEnabled'));
  assert.ok(entry.includes('PUBLIC_SERVICE_ADMIN_V1'));
  assert.ok(entry.includes('service.read()'));
  assert.ok(source.includes('accountBoundary={false}'));
  const shell = await readFile(new URL('../../src/features/memory/components/MemoryRouteShell.jsx', import.meta.url), 'utf8');
  assert.ok(shell.includes('accountBoundary = true'));
  assert.ok(shell.includes('function OwnerBoundRouteShell'));
});
