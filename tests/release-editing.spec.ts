import { expect, test } from '@playwright/test';
import { installAppState } from './helpers/appState';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui:locale:v1', JSON.stringify('en')));
});

test('title-only editing is protected, while unchanged prefill and reverted text are clean', async ({ page }) => {
  await page.goto('/memory/new/?title=Prefilled');
  await expect(page.getByLabel('Anime or card title')).toHaveValue('Prefilled');
  let dialogs = 0;
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
  expect(dialogs).toBe(0);
  await page.goto('/memory/new/');
  await page.getByLabel('Anime or card title').fill('Only a title');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(dialogs).toBe(1);
  await expect(page.getByLabel('Anime or card title')).toHaveValue('Only a title');
  await page.getByLabel('Anime or card title').fill('');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
  expect(dialogs).toBe(1);
});

test('new Board text is protected and clearing it removes the warning', async ({ page }) => {
  await page.goto('/boards/');
  await page.locator('summary').filter({ hasText: 'New Board' }).click();
  await page.getByLabel('Board title').fill('Unsaved Board');
  let dialogs = 0;
  page.on('dialog', async dialog => { dialogs++; await dialog.dismiss(); });
  await page.locator('.memory-boards__header a').click();
  expect(dialogs).toBe(1);
  await expect(page.getByLabel('Board title')).toHaveValue('Unsaved Board');
  await page.getByLabel('Board title').fill('');
  await page.locator('.memory-boards__header a').click();
  await expect(page).toHaveURL(/\/archive\/$/);
  expect(dialogs).toBe(1);
});


async function createMemory(page, title = 'Editing fixture') {
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: 'Use system design' }).click();
  await page.getByLabel('Anime or card title').fill(title);
  await page.getByLabel('Short reflection').fill('Original reflection');
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
}

test('watch log X, Escape, backdrop and Cancel share draft-discard behavior', async ({ page }) => {
  await installAppState(page, { locale: 'en', list: [{ anilistId: 1, status: 'completed', score: 9, addedAt: 1 }], watchLogs: [],
    mediaById: { '1': { id: 1, title: { english: 'Fixture Anime' }, genres: [] } } });
  await page.goto('/library/?animeId=1&focus=quick-log');
  const sheet = page.locator('.log-sheet');
  await expect(sheet).toBeVisible();
  const note = sheet.locator('textarea');
  await note.fill('Unsaved log');
  let dialogs = 0;
  const decline = async dialog => { dialogs++; await dialog.dismiss(); };
  page.on('dialog', decline);
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator('.log-sheet-backdrop').click({ position: { x: 2, y: 2 } });
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(dialogs).toBe(4);
  await expect(note).toHaveValue('Unsaved log');
  page.off('dialog', decline);
  page.once('dialog', dialog => dialog.accept());
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('anime:watchLogs:v1') || '[]'))).toHaveLength(0);
});

test('pending reflection save locks inputs and navigation, rejects duplicates, and preserves a failed draft', async ({ page }) => {
  await createMemory(page);
  await page.locator('.memory-archive__card').first().click();
  const note = page.locator('.memory-detail textarea');
  await expect(note).toHaveValue('Original reflection');
  await page.evaluate(async () => {
    const { IndexedDbMemoryRepository } = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const original = IndexedDbMemoryRepository.prototype.updateCardMetadata;
    (window as any).saveCalls = 0;
    IndexedDbMemoryRepository.prototype.updateCardMetadata = async function (...args) {
      (window as any).saveCalls++;
      await new Promise((resolve, reject) => { (window as any).releaseSave = resolve; (window as any).rejectSave = () => reject(new Error('synthetic failure')); });
      return original.apply(this, args);
    };
  });
  await note.fill('Draft survives failure');
  const currentUrl = page.url();
  await page.locator('.memory-detail form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(note).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as any).saveCalls)).toBe(1);
  await page.locator('.memory-detail__header a').click();
  expect(page.url()).toBe(currentUrl);
  await page.evaluate(() => (window as any).rejectSave());
  await expect(note).toBeEnabled();
  await expect(note).toHaveValue('Draft survives failure');
  await page.locator('.memory-detail form button[type=submit]').click();
  await expect.poll(() => page.evaluate(() => (window as any).saveCalls)).toBe(2);
  await page.evaluate(() => (window as any).releaseSave());
  await expect(note).toBeEnabled();
  await page.reload();
  await expect(note).toHaveValue('Draft survives failure');
});

test('Archive filters and Board origin survive a Memory detail round trip', async ({ page }) => {
  await createMemory(page, 'Return fixture');
  await page.getByLabel('Find memories').fill('Return');
  await page.getByLabel('Sort', { exact: true }).selectOption('updated');
  await page.locator('.memory-archive__card').first().click();
  await expect(page).toHaveURL(/returnTo=/);
  await page.locator('.memory-detail__header a').click();
  await expect(page.getByLabel('Find memories')).toHaveValue('Return');
  await expect(page.getByLabel('Sort', { exact: true })).toHaveValue('updated');
  await page.goto('/boards/');
  await page.locator('summary').filter({ hasText: 'New Board' }).click();
  await page.getByLabel('Board title').fill('Return Board');
  await page.locator('.memory-boards__form button[type=submit]').click();
  await expect(page).toHaveURL(/\/boards\/\?id=/);
  const boardUrl = page.url();
  await page.locator('summary').filter({ hasText: 'Add from Archive' }).click();
  await page.locator('.memory-boards__add button').first().click();
  await page.locator('.memory-boards__cards .memory-preview__link').first().click();
  await page.locator('.memory-detail__header a').click();
  await expect(page).toHaveURL(boardUrl);
});

test('dirty navigation runs before the Android link adapter', async ({ page }) => {
  await page.goto('/memory/new/');
  await page.getByLabel('Anime or card title').fill('Native draft');
  await page.evaluate(async () => {
    const { handleNativeAppLinkClick } = await import('/src/domain/search/memoryCardNavigation.js');
    (window as any).nativeDestinations = [];
    document.addEventListener('click', event => handleNativeAppLinkClick(event, {
      native: true, origin: location.origin, assign: href => (window as any).nativeDestinations.push(href),
    }), true);
  });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).nativeDestinations)).toEqual([]);
  await expect(page.getByLabel('Anime or card title')).toHaveValue('Native draft');
});


test('composer pending save locks all editable fields and prevents a second card', async ({ page }) => {
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: 'Use system design' }).click();
  await page.getByLabel('Anime or card title').fill('Pending card');
  await page.getByLabel('Short reflection').fill('Pending note');
  await page.evaluate(async () => {
    const { IndexedDbMemoryRepository } = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const original = IndexedDbMemoryRepository.prototype.completeCreate;
    (window as any).createCalls = 0;
    IndexedDbMemoryRepository.prototype.completeCreate = async function (...args) {
      (window as any).createCalls++;
      await new Promise(resolve => { (window as any).completeCard = resolve; });
      return original.apply(this, args);
    };
  });
  await page.locator('.memory-composer__form').evaluate(form => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect(page.getByLabel('Short reflection')).toBeDisabled();
  await expect(page.getByLabel('Anime or card title')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => (window as any).createCalls)).toBe(1);
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/memory\/new\/$/);
  await page.evaluate(() => (window as any).completeCard());
  await expect(page).toHaveURL(/\/archive\/$/);
  await expect(page.locator('.memory-archive__card')).toHaveCount(1);
});

test('browser Back can keep a title-only draft and cancel returns to the valid source', async ({ page }) => {
  await page.goto('/archive/');
  await page.locator('.memory-archive__header a').click();
  await page.getByLabel('Anime or card title').fill('Back draft');
  page.once('dialog', dialog => dialog.dismiss());
  await page.goBack({ timeout: 2000, waitUntil: 'commit' }).catch(() => {});
  await expect(page.getByLabel('Anime or card title')).toHaveValue('Back draft');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
});

test('Board text cancel keeps immediate card membership changes', async ({ page }) => {
  await createMemory(page, 'Board action fixture');
  await page.goto('/boards/');
  await page.locator('summary').filter({ hasText: 'New Board' }).click();
  await page.getByLabel('Board title').fill('Original Board');
  await page.locator('.memory-boards__form button[type=submit]').click();
  await expect(page).toHaveURL(/\/boards\/\?id=/);
  await page.getByRole('button', { name: 'Edit Board', exact: true }).click();
  await page.getByLabel('Board title').fill('Unsaved name');
  await page.locator('summary').filter({ hasText: 'Add from Archive' }).click();
  await page.locator('.memory-boards__add button').first().click();
  await expect(page.locator('.memory-boards__cards .memory-preview')).toHaveCount(1);
  await expect(page.getByLabel('Board title')).toHaveValue('Unsaved name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Original Board', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('.memory-boards__cards .memory-preview')).toHaveCount(1);
});


test('mobile Archive restores scroll and composer layouts fit mobile and desktop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (let index = 0; index < 4; index++) await createMemory(page, `Scroll fixture ${index}`);
  await page.reload();
  await expect(page.locator('.memory-archive__card')).toHaveCount(4);
  const card = page.locator('.memory-archive__card').last();
  await page.evaluate(() => document.fonts.ready);
  // click() centers an off-screen hit target; capture the source after that layout/scroll.
  await card.evaluate(element => element.scrollIntoView({ block: 'center' }));
  const sourceY = await page.evaluate(() => window.scrollY);
  expect(sourceY).toBeGreaterThan(0);
  await card.click();
  await page.locator('.memory-detail__header a').click();
  await expect(page.locator('.memory-archive__card')).toHaveCount(4);
  // A shorter restored layout must clamp to its real scroll limit, as browsers do.
  await expect.poll(() => page.evaluate((requestedY) => {
    const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    return Math.abs(scrollY - Math.min(requestedY, limit));
  }, sourceY)).toBeLessThan(2);
  await expect(page).not.toHaveURL(/restoreY=/);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/memory/new/');
    await expect(page.getByLabel('Anime or card title')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath(`composer-${width}.png`), fullPage: true });
  }
});
