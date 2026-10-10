import { expect, test, type Page } from '@playwright/test';
import { installAppState } from './helpers/appState';
import { installSignedInPhotoAccount } from './helpers/signedInPhotoAccount';

const labels = {
  ko: { account: '계정 및 데이터', signIn: 'Google로 로그인', signOut: '로그아웃', status: '계정 상태' },
  en: { account: 'Account and data', signIn: 'Continue with Google', signOut: 'Sign out', status: 'Account status' },
};

async function openAccountMenu(page: Page, width: number) {
  const trigger = page.locator(width > 900
    ? '.auth-trigger:visible'
    : '.top-nav__mobile-menu-trigger:visible');
  await trigger.click();
  const menu = page.locator('.data-menu-panel--manage');
  await expect(menu).toBeVisible();
  return { menu, trigger };
}

async function expectWithinViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const menu = page.locator('.data-menu-panel--manage');
  const rect = await menu.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.x).toBeGreaterThanOrEqual(0);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
}

for (const locale of ['ko', 'en'] as const) {
  for (const width of [1280, 390, 320]) {
    test(`${locale} guest account menu has one data entry at ${width}px`, async ({ page }) => {
      await installAppState(page, { locale });
      await page.route('https://**', route => route.abort());
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/archive/');
      const { menu, trigger } = await openAccountMenu(page, width);
      const entry = menu.getByRole('button', { name: labels[locale].account, exact: true });
      await expect(entry).toHaveCount(1);
      await expect(menu.locator('a[href$="/data/"]')).toHaveCount(0);
      await expect(menu.getByRole('button', { name: labels[locale].signIn, exact: true })).toBeVisible();
      await expectWithinViewport(page);

      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await trigger.click();
      await entry.click();
      await expect(page).toHaveURL(/\/data\/$/);
      await expect(page.getByRole('heading', { level: 1, name: labels[locale].account, exact: true })).toBeVisible();
      await expect(page.locator('.sync-card')).toBeVisible();
      await expect(page.locator('#manual-tools')).toBeVisible();
      const current = await openAccountMenu(page, width);
      await expect(current.menu.getByRole('button', { name: labels[locale].account, exact: true }))
        .toHaveAttribute('aria-current', 'page');
      await expectWithinViewport(page);
    });
  }

  test(`${locale} signed-in menu keeps account status, one email and sign out`, async ({ page }) => {
    const width = locale === 'ko' ? 390 : 320;
    const { userId } = await installSignedInPhotoAccount(page, locale);
    const email = 'menu-account-with-a-long-address@example.test';
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/archive/');
    await page.evaluate(async ({ email, userId, locale }) => {
      const { writeMockAuthSession } = await import('/src/repositories/mockAuthStorage.js');
      writeMockAuthSession({ user: { id: userId, email,
        user_metadata: locale === 'ko' ? { name: 'Menu fixture' } : {},
      } });
      localStorage.setItem('account-menu-preserved-record', 'local-record-fixture');
    }, { email, userId, locale });
    const { menu } = await openAccountMenu(page, width);
    await expect(menu.getByRole('button', { name: labels[locale].account, exact: true })).toHaveCount(1);
    await expect(menu.locator('a[href$="/data/"]')).toHaveCount(0);
    await expect(menu.getByText(email, { exact: true })).toHaveCount(1);
    await expect(menu.getByRole('status')).toContainText(labels[locale].status);
    await expect(menu.locator('.auth-sheet__summary-value')).not.toBeEmpty();
    await expect(menu.getByRole('button', { name: labels[locale].signIn, exact: true })).toHaveCount(0);
    await expectWithinViewport(page);

    await menu.getByRole('button', { name: labels[locale].signOut, exact: true }).click();
    await expect(menu.getByRole('button', { name: labels[locale].signOut, exact: true })).toHaveCount(0);
    await expect(menu.getByRole('button', { name: labels[locale].signIn, exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: labels[locale].account, exact: true })).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('moemoa.e2e.mockSession.v1'))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('account-menu-preserved-record'))).toBe('local-record-fixture');
  });
}
