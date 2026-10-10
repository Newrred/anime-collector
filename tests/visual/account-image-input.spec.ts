import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installSignedInPhotoAccount } from '../helpers/signedInPhotoAccount';

test('account menu and desktop image input visual review', async ({ page }) => {
  await installSignedInPhotoAccount(page, 'ko');
  const output = resolve('.cache/account-desktop-input');
  await mkdir(output, { recursive: true });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/memory/new/');
    await expect(page.getByRole('button', { name: '이미지 선택', exact: true })).toBeEnabled();
    await expect(page.getByText('이미지를 끌어놓거나 붙여넣으세요.', { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: resolve(output, `image-input-${width}.png`), fullPage: true });
    await page.locator(width > 900 ? '.auth-trigger:visible' : '.top-nav__mobile-menu-trigger:visible').click();
    const menu = page.locator('.data-menu-panel--manage');
    await expect(menu.getByRole('button', { name: '계정 및 데이터', exact: true })).toHaveCount(1);
    await menu.screenshot({ path: resolve(output, `account-menu-${width}.png`) });
  }
});
