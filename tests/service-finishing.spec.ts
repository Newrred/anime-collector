import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui:locale:v1', JSON.stringify('en')));
});

test('nested dialogs trap focus, dismiss only the top, and restore the trigger', async ({ page, request }) => {
  const harness = '/tests/fixtures/modalInteractionHarness.jsx';
  for (const suffix of ['', '?prewarm=ready']) {
    const response = await request.get(`${harness}${suffix}`);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toContain('mount');
  }
  // Vite may reload once when the test-only React root is optimized.
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('/');
    try {
      await page.evaluate(async ({ harness, attempt }) => (await import(`${harness}?attempt=${attempt}`)).mount(), { harness, attempt });
      break;
    } catch (error) { if (attempt === 2) throw error; }
  }
  await page.getByRole('button', { name: 'Open sheet', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Quick action' });
  await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(sheet.getByRole('button', { name: 'Last action' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(sheet.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await sheet.getByRole('button', { name: 'Open conflict' }).click();
  const conflict = page.getByRole('dialog', { name: 'Resolve conflict' });
  await expect(conflict.getByRole('button', { name: 'Close conflict' })).toBeFocused();
  await conflict.getByRole('button', { name: 'Keep local' }).click();
  await page.keyboard.press('Escape');
  await expect(conflict).toBeVisible();
  await page.evaluate(() => (window as any).finishModalWork());
  await expect(conflict.getByRole('button', { name: 'Close conflict' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(conflict).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Open conflict' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open sheet', exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.getByRole('button', { name: 'Open legacy conflict' }).click();
  await expect(conflict).toBeVisible();
  await conflict.getByRole('button', { name: 'Close conflict' }).click();
  await expect(page.getByRole('button', { name: 'Open legacy conflict' })).toBeFocused();
});

test('composer cancellation preserves a draft when declined and leaves when accepted', async ({ page }) => {
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: 'Use system design' }).click();
  await page.getByLabel('Anime or card title').fill('Unsaved sample');
  await page.getByLabel('Short reflection').fill('Keep this while cancelling');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Short reflection')).toHaveValue('Keep this while cancelling');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
});

test('Board cancellation resets edits and create rejects simultaneous submissions', async ({ page }) => {
  await page.goto('/boards/');
  await page.locator('summary').filter({ hasText: 'New Board' }).click();
  await page.getByLabel('Board title').fill('Original Board');
  await page.locator('.memory-boards__form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page).toHaveURL(/\/boards\/\?id=/);
  await expect(page.locator('.memory-boards__list a')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit Board', exact: true }).click();
  await page.getByLabel('Board title').fill('Discarded name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Board', exact: true }).click();
  await expect(page.getByLabel('Board title')).toHaveValue('Original Board');
  await page.getByLabel('Board title').fill('Saved Board');
  await page.locator('.memory-boards__edit button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'Saved Board', exact: true })).toBeVisible();
  await expect(page.locator('.memory-boards__edit')).toHaveCount(0);
});

test('legacy public routes stay closed and failed sign-in has a return action', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', req => { if (/user_follows|user_showcase|user_profiles/.test(req.url())) calls.push(req.url()); });
  await page.goto('/u/?handle=sample');
  await expect(page.getByText('Public profiles are not available yet.')).toBeVisible();
  await page.getByRole('link', { name: 'My Titles', exact: true }).last().click();
  await expect(page).toHaveURL(/\/titles\/$/);
  expect(calls).toEqual([]);
  await page.goto('/profile/');
  await page.getByRole('link', { name: 'Data management', exact: true }).last().click();
  await expect(page).toHaveURL(/\/data\/$/);
  await page.goto('/auth/callback/?error=access_denied');
  await expect(page.getByRole('alert')).toContainText('cancelled');
  await page.getByRole('link', { name: /Back to sign-in/ }).click();
  await expect(page).toHaveURL(/\/data\/$/);
});

test('backup cancellation allows selecting the same file again', async ({ page }) => {
  await page.goto('/data/');
  await page.locator('summary').filter({ hasText: 'Restore backup file' }).click();
  const file = { name: 'sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
    format: 'moemoa-catalog-saved-titles', version: 1, titles: [],
  })) };
  await page.getByLabel('Choose backup file').setInputFiles(file);
  await expect(page.getByRole('button', { name: 'Confirm restore' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm restore' })).toHaveCount(0);
  await page.getByLabel('Choose backup file').setInputFiles(file);
  await expect(page.getByRole('button', { name: 'Confirm restore' })).toBeVisible();
});

test('Memory editing can be cancelled and unsaved navigation keeps the original record', async ({ page }) => {
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: 'Use system design' }).click();
  await page.getByLabel('Anime or card title').fill('Edit sample');
  await page.getByLabel('Short reflection').fill('Original reflection');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await page.locator('.memory-archive__card').first().click();
  const note = page.locator('.memory-detail textarea');
  await note.fill('Unwanted edit');
  await page.getByRole('button', { name: 'Cancel reflection changes' }).click();
  await expect(note).toHaveValue('Original reflection');
  await note.fill('Unsaved edit');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('.memory-detail__header a').click();
  await expect(note).toHaveValue('Unsaved edit');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('.memory-detail__header a').click();
  await expect(page).toHaveURL(/\/archive\/$/);
  await page.locator('.memory-archive__card').first().click();
  await expect(note).toHaveValue('Original reflection');
});
