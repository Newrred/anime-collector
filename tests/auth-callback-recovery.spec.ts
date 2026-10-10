import {expect, test} from '@playwright/test';

test.skip(process.env.MOEMOA_CALLBACK_E2E !== '1', 'Run with the isolated signup-enabled callback fixture.');

async function prepare(page: any, {locale = 'en', exchangeFails = false, retryFails = false} = {}) {
  await page.addInitScript(({locale}: any) => localStorage.setItem('ui:locale:v1', JSON.stringify(locale)), {locale});
  const signupRequests: string[] = [];
  await page.route('**/api/signup**', (route: any) => {
    signupRequests.push(route.request().url());
    return route.fulfill({status: 503, json: {error: 'UNEXPECTED_SIGNUP_REQUEST'}});
  });
  await page.route('**/src/lib/supabaseClient.js*', (route: any) => route.fulfill({contentType: 'text/javascript', body: `
    export const isSupabaseConfigured = true, isMemoryAccountSyncEnabled = false;
    export const supabase = {auth: {
      exchangeCodeForSession: async () => {
        sessionStorage.setItem('callback.exchanges', String(Number(sessionStorage.getItem('callback.exchanges') || 0) + 1));
        return ${exchangeFails} ? {error: Object.assign(new Error('PRIVATE_EXCHANGE_DETAIL'), {code: 'toString'})}
          : {data: {session: {user: {id: '11111111-1111-4111-8111-111111111111'}}}};
      },
      signInWithOAuth: async options => {
        sessionStorage.setItem('callback.oauth', JSON.stringify(options));
        return {error: ${retryFails} ? new Error('PRIVATE_PROVIDER_DETAIL') : null};
      },
      getSession: async () => ({data: {session: null}}),
      onAuthStateChange: () => ({data: {subscription: {unsubscribe() {}}}})
    }};
  `}));
  return {signupRequests};
}

test('blocked or cancelled OAuth offers signup while existing-account retry stays separate', async({page}) => {
  const fixture = await prepare(page);
  const target = '/admin/';
  await page.goto(`/auth/callback/?error=access_denied&error_description=PRIVATE_PROVIDER_DETAIL&next=${encodeURIComponent(target)}`);
  await expect(page.getByRole('alert')).toContainText('cancelled');
  await expect(page).toHaveURL(/\/auth\/callback\/$/);
  await expect(page.locator('body')).not.toContainText('PRIVATE_PROVIDER_DETAIL');
  await expect(page.getByRole('link', {name: 'Create an account', exact: true})).toHaveAttribute('href', '/auth/start/?next=%2Fadmin%2F');
  await page.getByRole('button', {name: 'Retry sign-in', exact: true}).click();
  const options = await page.evaluate(() => JSON.parse(sessionStorage.getItem('callback.oauth') || 'null'));
  expect(options).toEqual({provider: 'google', options: {redirectTo: new URL('/auth/callback/', page.url()).href, queryParams: {prompt: 'select_account'}}});
  expect(await page.evaluate(() => localStorage.getItem('auth.redirect.next'))).toBe(target);
  expect(fixture.signupRequests).toEqual([]);
});

test('Korean recovery and language switch never expose provider or protocol details', async({page}) => {
  await prepare(page, {locale: 'ko', exchangeFails: true, retryFails: true});
  await page.goto('/auth/callback/?code=SYNTHETIC_PRIVATE_CODE');
  await expect(page.getByRole('alert')).toContainText('같은 브라우저');
  await expect(page.getByRole('link', {name: '가입하기', exact: true})).toBeVisible();
  await page.getByRole('button', {name: '다시 로그인', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('로그인을 시작하지 못했습니다');
  await page.getByRole('button', {name: 'English', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Unable to start sign-in');
  await expect(page.locator('body')).not.toContainText('PRIVATE_EXCHANGE_DETAIL');
  await expect(page.locator('body')).not.toContainText('PRIVATE_PROVIDER_DETAIL');
  await expect(page.locator('body')).not.toContainText('SYNTHETIC_PRIVATE_CODE');
  await expect(page.locator('body')).not.toContainText('PKCE');
  await expect(page.locator('body')).not.toContainText('one-time');
});

test('duplicate codes remain rejected and unsafe return paths do not enter the signup link', async({page}) => {
  await prepare(page);
  await page.goto('/auth/callback/?code=first&code=second&next=https%3A%2F%2Fevil.test');
  await expect(page.getByRole('alert')).toContainText('start sign-in again');
  expect(await page.evaluate(() => sessionStorage.getItem('callback.exchanges'))).toBeNull();
  await expect(page.getByRole('link', {name: 'Create an account', exact: true})).toHaveAttribute('href', '/auth/start/?next=%2Fdata%2F');
  await expect(page.getByRole('link', {name: 'Return to page', exact: true})).toHaveCount(0);
  await expect(page).toHaveURL(/\/auth\/callback\/$/);
});

test('valid callback still exchanges exactly once and returns to the saved page', async({page}) => {
  await prepare(page);
  await page.goto('/auth/callback/?code=synthetic-success&next=%2Fdata%2F');
  await expect(page).toHaveURL(/\/data\/$/);
  expect(await page.evaluate(() => sessionStorage.getItem('callback.exchanges'))).toBe('1');
});
