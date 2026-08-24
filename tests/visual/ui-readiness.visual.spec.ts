import { expect, test } from '@playwright/test';

test('visual suite runs on the isolated review surface', async ({ page }) => {
  await page.goto('/');

  const current = new URL(page.url());
  expect(current.hostname).toBe('127.0.0.1');
  expect(current.port).not.toBe('4321');
  await expect(page.locator('astro-dev-toolbar')).toHaveCount(0);
});
