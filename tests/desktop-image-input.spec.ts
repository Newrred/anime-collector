import { createHash } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { jpegBytes, pngBytes } from './catalog-lab/fixtures/cover-valid-images.mjs';
import { installSignedInPhotoAccount, openArchiveAfterPhotoSave } from './helpers/signedInPhotoAccount';

// These are browser File/DataTransfer/ClipboardEvent regressions, not evidence
// of a physical Windows/macOS clipboard or OS screenshot shortcut being tested.
test.skip(process.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 !== '1'
  || process.env.PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 !== '1', 'Authenticated Web photo flags required');

type TransferFile = { name: string; type: string; bytes: number[] };
const png: TransferFile = { name: 'synthetic.png', type: 'image/png', bytes: Array.from(pngBytes) };
const jpeg: TransferFile = { name: 'synthetic.jpg', type: 'image/jpeg', bytes: Array.from(jpegBytes) };
const broken: TransferFile = { name: 'broken.png', type: 'image/png', bytes: Array.from(Buffer.from('not an image')) };

async function transfer(target: Locator, kind: 'drop' | 'paste', files: TransferFile[] = [], text: Record<string, string> = {}) {
  return target.evaluate((element, input) => {
    const data = new DataTransfer();
    for (const item of input.files) data.items.add(new File([new Uint8Array(item.bytes)], item.name, { type: item.type }));
    for (const [type, value] of Object.entries(input.text)) data.setData(type, value);
    const event = input.kind === 'drop'
      ? new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data })
      : new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, { kind, files, text });
}

async function mediaRecords(page: Page, store: 'tickets' | 'assets') {
  return page.evaluate(async (storeName) => {
    // Abort an absent database's creation: ignored events must not create media.
    const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
      const request = indexedDB.open('moemoa-web-media-v1');
      request.onupgradeneeded = () => request.transaction!.abort();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => request.error?.name === 'AbortError' ? resolve(null) : reject(request.error);
    });
    if (!db) return [];
    if (!db.objectStoreNames.contains(storeName)) { db.close(); return []; }
    try {
      const rows = await new Promise<any[]>((resolve, reject) => {
        const request = db.transaction(storeName).objectStore(storeName).getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return await Promise.all(rows.map(async row => ({
        id: row.id, hash: row.hash, mimeType: row.mimeType,
        bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())),
      })));
    } finally { db.close(); }
  }, store);
}

async function openComposer(page: Page) {
  const account = await installSignedInPhotoAccount(page);
  await page.goto('/memory/new/');
  await expect(page.getByRole('button', { name: 'Choose image', exact: true })).toBeEnabled();
  return account;
}

async function savePhoto(page: Page, title: string) {
  await page.getByLabel('Anime or card title').fill(title);
  await page.getByLabel(/I confirm that I have the right/).check();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await openArchiveAfterPhotoSave(page);
}

for (const kind of ['drop', 'paste'] as const) {
  test(`${kind} previews locally, then explicit Save keeps original bytes and starts account upload`, async ({ page }) => {
    const { uploads } = await openComposer(page);
    const region = page.locator('.memory-composer__visual-column');
    // Body-targeted paste models focus after returning from a screenshot tool.
    expect(await transfer(kind === 'paste' ? page.locator('body') : region, kind, [png])).toBe(true);
    await expect(page.locator('.memory-composer__preview')).toBeVisible();
    expect(uploads).toHaveLength(0);
    expect(await mediaRecords(page, 'assets')).toEqual([]);
    expect(await mediaRecords(page, 'tickets')).toEqual([expect.objectContaining({
      hash: createHash('sha256').update(pngBytes).digest('hex'), bytes: png.bytes,
    })]);
    await page.getByLabel('Anime or card title').fill(`Desktop ${kind} image`);
    await page.getByLabel(/I confirm that I have the right/).check();
    expect(uploads).toHaveLength(0);
    await page.getByRole('button', { name: 'Save card', exact: true }).click();
    await openArchiveAfterPhotoSave(page);
    await expect.poll(() => uploads.length).toBe(1);
    await page.reload();
    await page.getByRole('link', { name: `Desktop ${kind} image`, exact: true }).click();
    await expect(page.locator('.memory-detail__visual img')).toBeVisible();
    expect(await mediaRecords(page, 'tickets')).toEqual([]);
    expect(await mediaRecords(page, 'assets')).toEqual([expect.objectContaining({
      hash: createHash('sha256').update(pngBytes).digest('hex'), bytes: png.bytes,
    })]);
    // Chromium's private-image encoder uses WebP. Original-byte integrity is
    // asserted against the local asset, not against its optimized server copy.
    expect(uploads[0].subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(uploads[0].subarray(8, 12).toString('ascii')).toBe('WEBP');
  });
}

test('invalid and multiple images preserve the prior preview and rights; a valid replacement resets rights', async ({ page }) => {
  const { uploads } = await openComposer(page);
  const region = page.locator('.memory-composer__visual-column');
  await transfer(region, 'drop', [png]);
  const preview = page.locator('.memory-composer__preview');
  await expect(preview).toBeVisible();
  const rights = page.getByLabel(/I confirm that I have the right/);
  await rights.check();
  const originalSrc = await preview.getAttribute('src');
  const originalTickets = await mediaRecords(page, 'tickets');

  expect(await transfer(region, 'paste', [broken])).toBe(true);
  await expect(page.locator('#memory-composer-error')).toContainText('Only JPEG, PNG, and WebP');
  await expect(preview).toHaveAttribute('src', originalSrc!);
  await expect(rights).toBeChecked();
  expect(await mediaRecords(page, 'tickets')).toEqual(originalTickets);

  // Equal metadata must not collapse two distinct File objects into one file.
  expect(await transfer(region, 'drop', [png, png])).toBe(true);
  await expect(page.locator('#memory-composer-error')).toHaveText('Add one image at a time.');
  await expect(preview).toHaveAttribute('src', originalSrc!);
  await expect(rights).toBeChecked();
  expect(await mediaRecords(page, 'tickets')).toEqual(originalTickets);

  expect(await transfer(region, 'paste', [jpeg])).toBe(true);
  await expect(rights).not.toBeChecked();
  await expect.poll(async () => (await mediaRecords(page, 'tickets')).map(row => row.mimeType)).toEqual(['image/jpeg']);
  const replacements = await mediaRecords(page, 'tickets');
  expect(replacements[0].id).not.toBe(originalTickets[0].id);
  expect(replacements[0].bytes).toEqual(jpeg.bytes);
  expect(uploads).toHaveLength(0);
});

test('text, HTML, URLs and editable-target paste are not intercepted or ingested', async ({ page }) => {
  const { uploads } = await openComposer(page);
  const region = page.locator('.memory-composer__visual-column');
  await transfer(region, 'drop', [png]);
  await expect(page.locator('.memory-composer__preview')).toBeVisible();
  await page.getByLabel(/I confirm that I have the right/).check();
  const originalTickets = await mediaRecords(page, 'tickets');
  const originalSrc = await page.locator('.memory-composer__preview').getAttribute('src');
  let urlRequests = 0;
  await page.route('https://example.invalid/clipboard-image.png', route => { urlRequests += 1; return route.abort(); });
  const text = {
    'text/plain': 'A remembered scene',
    'text/html': '<img src="https://example.invalid/clipboard-image.png">',
    'text/uri-list': 'https://example.invalid/clipboard-image.png',
  };
  for (const kind of ['drop', 'paste'] as const) {
    expect(await transfer(region, kind, [], text)).toBe(false);
  }

  const title = page.getByLabel('Anime or card title');
  await title.fill('Text stays editable');
  expect(await transfer(title, 'paste', [jpeg], { 'text/plain': 'ordinary paste' })).toBe(false);
  await expect(title).toHaveValue('Text stays editable');
  await region.evaluate(element => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.dataset.testid = 'clipboard-editable';
    const child = document.createElement('span');
    child.textContent = 'Editable selection';
    editor.append(child);
    element.append(editor);
  });
  expect(await transfer(page.getByTestId('clipboard-editable').locator('span'), 'paste', [jpeg], text)).toBe(false);
  await expect(page.getByTestId('clipboard-editable')).toHaveText('Editable selection');
  // An unrelated control outside the image region must not replace a photo.
  expect(await transfer(page.getByRole('button', { name: 'Save card', exact: true }), 'paste', [jpeg])).toBe(false);
  await expect(page.locator('.memory-composer__preview')).toHaveAttribute('src', originalSrc!);
  await expect(page.getByLabel(/I confirm that I have the right/)).toBeChecked();
  expect(await mediaRecords(page, 'tickets')).toEqual(originalTickets);
  expect(uploads).toHaveLength(0);
  expect(urlRequests).toBe(0);
  // Synthetic events do not perform native text insertion. defaultPrevented=false
  // proves the app leaves the browser's normal editable-paste behavior alone.
});

test('guest drop and paste require sign-in without creating image tickets or uploads', async ({ page }) => {
  let uploads = 0;
  await page.route('https://**', route => route.abort());
  await page.route('**/api/private-image**', route => {
    if (route.request().method() === 'POST') uploads += 1;
    return route.fulfill({ status: 401, json: { error: 'AUTH_REQUIRED' } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('ui:locale:v1', JSON.stringify('en'));
    localStorage.setItem('moemoa.e2e.mockSession.v1', JSON.stringify({ user: null }));
  });
  await page.goto('/memory/new/');
  await expect(page.getByRole('button', { name: 'Sign in to add a photo', exact: true })).toBeVisible();
  const region = page.locator('.memory-composer__visual-column');
  await expect(region).toHaveAttribute('tabindex', '0');
  for (const kind of ['drop', 'paste'] as const) {
    await transfer(region, kind, [png]);
    await expect(page.locator('#memory-composer-error')).toHaveText('Sign in to add your own photo.');
    await expect(page.locator('.memory-composer__preview')).toHaveCount(0);
    expect(await mediaRecords(page, 'tickets')).toEqual([]);
    expect(await mediaRecords(page, 'assets')).toEqual([]);
  }
  expect(uploads).toBe(0);
});

test('only visible image management accepts paste; replacement drop and cancel preserve the saved original', async ({ page }) => {
  const { uploads } = await openComposer(page);
  await transfer(page.locator('.memory-composer__visual-column'), 'drop', [png]);
  await expect(page.locator('.memory-composer__preview')).toBeVisible();
  await savePhoto(page, 'Preserved desktop original');
  await expect.poll(() => uploads.length).toBe(1);
  await page.getByRole('link', { name: 'Preserved desktop original', exact: true }).click();
  const originalImage = page.locator('.memory-detail__visual img');
  await expect(originalImage).toBeVisible();
  const originalSrc = await originalImage.getAttribute('src');
  const originalAssets = await mediaRecords(page, 'assets');
  const region = page.locator('.memory-detail__replacement');

  await expect(page.getByRole('tab', { name: 'Memory', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(await transfer(page.locator('body'), 'paste', [jpeg])).toBe(false);
  expect(await mediaRecords(page, 'tickets')).toEqual([]);
  await page.getByRole('tab', { name: 'Manage', exact: true }).click();
  await expect(region).toBeHidden();
  expect(await transfer(page.locator('body'), 'paste', [jpeg])).toBe(false);
  expect(await mediaRecords(page, 'tickets')).toEqual([]);

  await page.locator('.memory-detail__tools > summary').click();
  await expect(region.getByRole('button', { name: 'Replace image', exact: true })).toBeEnabled();
  expect(await transfer(page.locator('body'), 'paste', [jpeg])).toBe(true);
  await expect(region.getByAltText('New image preview')).toBeVisible();
  const pendingTickets = await mediaRecords(page, 'tickets');
  expect(pendingTickets).toEqual([expect.objectContaining({ mimeType: 'image/jpeg', bytes: jpeg.bytes })]);
  const replacementRights = region.getByLabel(/I confirm that I have the right/);
  await expect(replacementRights).not.toBeChecked();
  expect(uploads).toHaveLength(1);
  expect(await mediaRecords(page, 'assets')).toEqual(originalAssets);

  await page.getByRole('tab', { name: 'Memory', exact: true }).click();
  expect(await transfer(page.locator('body'), 'paste', [png])).toBe(false);
  expect(await mediaRecords(page, 'tickets')).toEqual(pendingTickets);
  await page.getByRole('tab', { name: 'Manage', exact: true }).click();
  await replacementRights.check();
  expect(await transfer(region, 'drop', [png])).toBe(true);
  await expect(replacementRights).not.toBeChecked();
  await expect.poll(async () => (await mediaRecords(page, 'tickets')).map(row => row.mimeType)).toEqual(['image/png']);
  expect(await mediaRecords(page, 'assets')).toEqual(originalAssets);
  expect(uploads).toHaveLength(1);
  await region.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(region.getByAltText('New image preview')).toHaveCount(0);
  await expect.poll(() => mediaRecords(page, 'tickets')).toEqual([]);
  await expect(originalImage).toHaveAttribute('src', originalSrc!);
  expect(await mediaRecords(page, 'assets')).toEqual(originalAssets);
  expect(uploads).toHaveLength(1);
});
