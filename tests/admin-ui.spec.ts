import {test, expect} from '@playwright/test';
import {adminFixture} from './unit/adminFixture.mjs';

test.skip(process.env.MOEMOA_ADMIN_E2E !== '1', 'Run scripts/run-admin-e2e.mjs with the isolated mock backend.');
const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
function user(id = owner) { return {id, email: 'synthetic@example.test', role: 'authenticated', aud: 'authenticated', app_metadata: {provider: 'google'}, user_metadata: {}}; }
function token(id = owner) {
  return [{alg: 'HS256', typ: 'JWT'}, {sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600}, 'signature']
    .map(value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')).join('.');
}
function session(id = owner) { return {access_token: token(id), refresh_token: 'synthetic-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: user(id)}; }
async function setup(page: any, {signedIn = true, denied = false, malformed = false, paused = false, ready = true, conflict = false, delayedRead = false, delayedWrite = false, storageMissing = false} = {}) {
  const calls: any[] = [];
  let snapshot: any = adminFixture(), currentUser = user(), accessDenied = denied, unavailable = false;
  snapshot.signup = {...snapshot.signup, enabled: !paused, canPause: !paused, canResume: paused && ready, readyForResume: ready};
  if (storageMissing) snapshot.costs.publicStorageLimitBytes = null;
  let releaseRead: any, releaseWrite: any;
  const readWait = new Promise<void>(resolve => { releaseRead = resolve; });
  const writeWait = new Promise<void>(resolve => { releaseWrite = resolve; });
  await page.addInitScript(({authSession}: any) => {
    if (authSession) localStorage.setItem('sb-127-auth-token', JSON.stringify(authSession));
    localStorage.setItem('ui:locale:v1', JSON.stringify('ko'));
    localStorage.setItem('ui:theme:v1', JSON.stringify('light'));
  }, {authSession: signedIn ? session() : null});
  await page.route('http://127.0.0.1:54399/**', async(route: any) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    calls.push({path, body: request.postData()});
    if (path === '/auth/v1/user') return route.fulfill({json: currentUser});
    if (path === '/auth/v1/logout') return route.fulfill({status: 204, body: ''});
    if (path.endsWith('/get_moemoa_admin_status')) {
      const reply = structuredClone(snapshot);
      if (delayedRead && currentUser.id === owner) await readWait;
      if (accessDenied || currentUser.id !== owner) return route.fulfill({status: 400, json: {code: 'P0001', message: 'ADMIN_REQUIRED'}});
      if (unavailable) return route.fulfill({status: 503, json: {message: 'RAW_PRIVATE_BACKEND_DETAIL'}});
      return route.fulfill({json: malformed ? {private: 'DO_NOT_SHOW_RAW_ERROR'} : reply});
    }
    if (path.endsWith('/set_moemoa_signup_paused')) {
      const body = request.postDataJSON();
      if (delayedWrite) await writeWait;
      if (conflict) return route.fulfill({status: 400, json: {message: 'ADMIN_REVISION_CONFLICT'}});
      snapshot = {...snapshot, revision: 'b'.repeat(64), signup: {...snapshot.signup, enabled: !body.p_paused, canPause: !body.p_paused, canResume: body.p_paused},
        audit: [{action: body.p_paused ? 'SIGNUP_PAUSED' : 'SIGNUP_RESUMED', createdAt: '2026-10-10T09:01:00Z', enabledBefore: body.p_paused, enabledAfter: !body.p_paused}]};
      return route.fulfill({json: snapshot});
    }
    return route.fulfill({json: []});
  });
  await page.goto('/admin/');
  await expect(page.getByRole('heading', {name: '서비스 관리', exact: true})).toBeVisible({timeout: 15000});
  return {calls, releaseRead, releaseWrite, deny: () => { accessDenied = true; }, fail: () => { unavailable = true; },
    switchAccount: async() => {
      currentUser = user(otherOwner);
      await page.evaluate(async({accessToken}: any) => {
        // Real local Supabase SDK auth event; network responses remain synthetic.
        const {supabase} = await import('/src/lib/supabaseClient.js');
        await supabase.auth.setSession({access_token: accessToken, refresh_token: 'other-synthetic-refresh'});
      }, {accessToken: token(otherOwner)});
    },
  };
}

test('signed out users see login without an admin request', async({page}) => {
  const backend = await setup(page, {signedIn: false});
  const signIn = page.getByRole('button', {name: 'Google로 로그인', exact: true});
  await expect(signIn).toBeEnabled();
  expect(backend.calls.some(call => call.path.includes('moemoa_admin'))).toBe(false);
  await signIn.click();
  await expect(page).toHaveURL(/\/auth\/start\/\?next=%2Fadmin%2F/);
});

test('ordinary accounts fail closed without aggregates or controls', async({page}) => {
  await setup(page, {denied: true});
  await expect(page.getByRole('alert')).toContainText('운영 권한이 없습니다');
  await expect(page.getByRole('heading', {name: '계정 현황'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: '새 가입 일시중지', exact: true})).toHaveCount(0);
});

test('malformed status is not exposed or interpreted as zero', async({page}) => {
  await setup(page, {malformed: true});
  await expect(page.getByRole('alert')).toContainText('상태를 확인하지 못했습니다');
  await expect(page.locator('body')).not.toContainText('DO_NOT_SHOW_RAW_ERROR');
  await expect(page.getByRole('heading', {name: '계정 현황'})).toHaveCount(0);
});

test('admin works with Public off, shows linked documents, and fits desktop and 320px', async({page}, info) => {
  await page.setViewportSize({width: 1440, height: 1000});
  const backend = await setup(page);
  await expect(page.getByRole('heading', {name: '계정 현황'})).toBeVisible();
  // The shared navigation may check personal account status; its failed synthetic
  // response must not gate the independent operator dashboard.
  expect(backend.calls.some(call => call.path.endsWith('/get_moemoa_admin_status'))).toBe(true);
  await expect(page.getByRole('link', {name: '콘텐츠 검토로 이동'})).toHaveAttribute('href', '/moderation/');
  await expect(page.getByRole('link', {name: 'terms-2026-10-10-test', exact: true})).toHaveAttribute('href', '/legal/terms-2026-10-10-test/');
  await expect(page.locator('.admin-page')).toContainText('대기 0건만으로 자동 정리가 정상 실행됐다고 판단하지 않습니다.');
  await page.screenshot({path: info.outputPath('admin-desktop.png'), fullPage: true});
  await page.setViewportSize({width: 320, height: 780});
  await page.locator('.admin-page summary').click();
  await expect(page.locator('.admin-countries')).toContainText('만 14세');
  await expect(page.locator('.admin-countries')).toContainText('필리핀');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: info.outputPath('admin-mobile.png'), fullPage: true});
});

test('pause requires explicit keyboard confirmation and sends the exact revision once', async({page}) => {
  const backend = await setup(page);
  const trigger = page.getByRole('button', {name: '새 가입 일시중지', exact: true});
  await trigger.focus(); await page.keyboard.press('Enter');
  const confirm = page.getByRole('button', {name: '일시중지 확인', exact: true});
  await expect(confirm).toBeFocused();
  expect(backend.calls.filter(call => call.path.endsWith('/set_moemoa_signup_paused'))).toHaveLength(0);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter'); await expect(confirm).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('새 가입을 일시중지했습니다');
  const writes = backend.calls.filter(call => call.path.endsWith('/set_moemoa_signup_paused'));
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0].body)).toEqual({p_expected_revision: 'a'.repeat(64), p_paused: true});
  await expect(page.getByRole('button', {name: '새 가입 재개', exact: true})).toBeEnabled();
});

test('ready paused release resumes only after confirmation', async({page}) => {
  const backend = await setup(page, {paused: true});
  await page.getByRole('button', {name: '새 가입 재개', exact: true}).click();
  await page.getByRole('button', {name: '재개 확인', exact: true}).click();
  await expect(page.getByRole('status')).toContainText('새 가입을 재개했습니다');
  expect(JSON.parse(backend.calls.find(call => call.path.endsWith('/set_moemoa_signup_paused')).body).p_paused).toBe(false);
});

test('unready rollout cannot resume', async({page}) => {
  const backend = await setup(page, {paused: true, ready: false});
  await expect(page.getByRole('button', {name: '새 가입 재개', exact: true})).toBeDisabled();
  expect(backend.calls.filter(call => call.path.endsWith('/set_moemoa_signup_paused'))).toHaveLength(0);
});

test('a missing public storage policy is shown as unconfigured without hiding other status', async({page}) => {
  await setup(page, {storageMissing: true});
  await expect(page.getByRole('heading', {name: '계정 현황'})).toBeVisible();
  await expect(page.locator('.admin-page')).toContainText('한도 미설정');
});

test('operator content review is reachable while public features remain off', async({page}) => {
  await setup(page);
  const credential = await page.evaluate(() => JSON.parse(localStorage.getItem('sb-127-auth-token') || '{}').access_token);
  await page.route('**/rest/v1/rpc/ensure_user_profile', route => route.fulfill({json: {
    userId: owner, displayName: 'Synthetic operator', locale: 'ko', timeZone: 'Asia/Seoul', minimumRetainedSyncSeq: 0,
  }}));
  await page.route('**/rest/v1/rpc/register_user_device', route => {
    const body = route.request().postDataJSON();
    return route.fulfill({json: {id: body.p_device_id, installationId: body.p_installation_id, platform: body.p_platform, appVersion: body.p_app_version, lastSyncSeq: 0}});
  });
  await page.route('**/rest/v1/rpc/pull_memory_changes', route => route.fulfill({status: 503, json: {message: 'SYNTHETIC_SYNC_UNAVAILABLE'}}));
  let reviews = 0;
  await page.route('**/rest/v1/rpc/list_memory_pending_content', route => {
    reviews++;
    expect(route.request().headers().authorization).toBe(`Bearer ${credential}`);
    return route.fulfill({json: {items: [], next: null}});
  });
  await page.getByRole('link', {name: '콘텐츠 검토로 이동'}).click();
  await expect(page.getByRole('heading', {name: '공개 콘텐츠 검토'})).toBeVisible();
  await expect(page.getByRole('button', {name: '목록 새로고침'})).toBeEnabled();
  await expect.poll(() => reviews).toBeGreaterThan(0);
  const flags = await page.evaluate(async() => {
    const runtime = await import('/src/features/memory/runtime/platformPublication.js');
    return {public: runtime.publicationUiEnabled(), review: runtime.contentReviewUiEnabled()};
  });
  expect(flags).toEqual({public: false, review: true});
});

test('stale revision refreshes status without replaying a mutation', async({page}) => {
  const backend = await setup(page, {conflict: true});
  await page.getByRole('button', {name: '새 가입 일시중지', exact: true}).click();
  await page.getByRole('button', {name: '일시중지 확인', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('다른 곳에서 설정이 바뀌었습니다');
  expect(backend.calls.filter(call => call.path.endsWith('/set_moemoa_signup_paused'))).toHaveLength(1);
  expect(backend.calls.filter(call => call.path.endsWith('/get_moemoa_admin_status')).length).toBeGreaterThan(1);
  await expect(page.getByRole('button', {name: '일시중지 확인', exact: true})).toHaveCount(0);
});

test('role revocation clears existing aggregates on refresh', async({page}) => {
  const backend = await setup(page);
  await expect(page.getByRole('heading', {name: '계정 현황'})).toBeVisible();
  backend.deny(); await page.getByRole('button', {name: '새로고침', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('운영 권한이 없습니다');
  await expect(page.getByRole('heading', {name: '계정 현황'})).toHaveCount(0);
});

test('network failure clears the previous data and never prints provider details', async({page}) => {
  const backend = await setup(page);
  await expect(page.getByRole('heading', {name: '계정 현황'})).toBeVisible();
  backend.fail(); await page.getByRole('button', {name: '새로고침', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('상태를 확인하지 못했습니다');
  await expect(page.getByRole('heading', {name: '계정 현황'})).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('RAW_PRIVATE_BACKEND_DETAIL');
});

test('sign out during a pending request never restores old admin data', async({page}) => {
  const backend = await setup(page, {delayedRead: true});
  await expect(page.getByRole('status')).toContainText('권한과 운영 상태');
  await page.getByRole('button', {name: '로그아웃', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Google로 로그인', exact: true})).toBeVisible();
  const reply = page.waitForResponse(response => response.url().endsWith('/get_moemoa_admin_status'));
  backend.releaseRead(); await reply;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('heading', {name: '계정 현황'})).toHaveCount(0);
});

test('account switch discards confirmation and late mutation success', async({page}) => {
  const backend = await setup(page, {delayedWrite: true});
  await page.getByRole('button', {name: '새 가입 일시중지', exact: true}).click();
  await page.getByRole('button', {name: '일시중지 확인', exact: true}).click();
  await backend.switchAccount();
  await expect(page.getByRole('alert')).toContainText('운영 권한이 없습니다');
  const reply = page.waitForResponse(response => response.url().endsWith('/set_moemoa_signup_paused'));
  backend.releaseWrite(); await reply;
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('heading', {name: '계정 현황'})).toHaveCount(0);
  await expect(page.locator('.admin-page')).not.toContainText('새 가입을 일시중지했습니다.');
});

test('switching accounts cancels an unsubmitted confirmation without a write', async({page}) => {
  const backend = await setup(page);
  await page.getByRole('button', {name: '새 가입 일시중지', exact: true}).click();
  await expect(page.getByRole('button', {name: '일시중지 확인', exact: true})).toBeVisible();
  await backend.switchAccount();
  await expect(page.getByRole('alert')).toContainText('운영 권한이 없습니다');
  await expect(page.getByRole('button', {name: '일시중지 확인', exact: true})).toHaveCount(0);
  expect(backend.calls.filter(call => call.path.endsWith('/set_moemoa_signup_paused'))).toHaveLength(0);
});
