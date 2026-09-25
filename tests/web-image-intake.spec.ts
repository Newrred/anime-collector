import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { pngBytes } from './catalog-lab/fixtures/cover-valid-images.mjs';

test.skip(process.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 !== '1', 'Explicit local Web intake flag required');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui:locale:v1', JSON.stringify('en')));
});

async function pick(page, name = 'Choose image', invalid = false) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name, exact: true }).click();
  await (await chooser).setFiles({ name: invalid ? 'broken.png' : 'synthetic.png', mimeType: 'image/png', buffer: invalid ? Buffer.from('not an image') : Buffer.from(pngBytes) });
}

test('real Web picker saves local original and preview across reload and removes media on card deletion', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', req => { if (req.method() === 'POST' && /storage|public-image|private-image/.test(req.url())) uploads.push(req.url()); });
  await page.goto('/memory/new/');
  await pick(page);
  await expect(page.getByAltText('Selected image preview')).toBeVisible();
  await page.getByLabel('Anime or card title').fill('Local Web image');
  await page.getByLabel(/I confirm that I have the right/).check();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
  await page.reload();
  await page.getByRole('link', { name: 'Local Web image' }).click();
  await expect(page.locator('img[src^="data:image/jpeg"]')).toBeVisible();
  const records = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('moemoa-web-media-v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const rows = await new Promise<any[]>((resolve) => { const r = db.transaction('assets').objectStore('assets').getAll(); r.onsuccess = () => resolve(r.result); });
    db.close();
    return Promise.all(rows.map(async row => ({ hash: row.hash, bytes: Array.from(new Uint8Array(await row.blob.arrayBuffer())) })));
  });
  expect(records).toEqual([{ hash: createHash('sha256').update(pngBytes).digest('hex'), bytes: Array.from(pngBytes) }]);
  expect(uploads).toEqual([]);
  await page.getByRole('button', { name: 'Delete card', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm card deletion', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
  const count = await page.evaluate(() => new Promise<number>(resolve => { const r = indexedDB.open('moemoa-web-media-v1', 1); r.onsuccess = () => { const db = r.result; const q = db.transaction('assets').objectStore('assets').count(); q.onsuccess = () => { resolve(q.result); db.close(); }; }; }));
  expect(count).toBe(0);
});

test('invalid replacement and picker cancellation preserve selection; new image resets consent', async ({ page }) => {
  await page.goto('/memory/new/');
  await pick(page);
  await page.getByLabel(/I confirm that I have the right/).check();
  const preview = await page.getByAltText('Selected image preview').getAttribute('src');
  await pick(page, 'Choose another image', true);
  await expect(page.getByRole('alert')).toContainText('Only JPEG, PNG, and WebP');
  await expect(page.getByAltText('Selected image preview')).toHaveAttribute('src', preview!);
  await expect(page.getByLabel(/I confirm that I have the right/)).toBeChecked();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose another image' }).click();
  await chooser;
  await page.locator('input[type="file"]').dispatchEvent('cancel');
  await expect(page.getByRole('button', { name: 'Choose another image' })).toBeEnabled();
  await expect(page.getByAltText('Selected image preview')).toHaveAttribute('src', preview!);
  await pick(page, 'Choose another image');
  await expect(page.getByLabel(/I confirm that I have the right/)).not.toBeChecked();
});

test('IndexedDB media promotion replay is atomic and rejects a different operation', async ({ page }) => {
  await page.goto('/memory/new/');
  await pick(page);
  await expect(page.getByAltText('Selected image preview')).toBeVisible();
  const observed = await page.evaluate(async () => {
    const modulePath = '/src/features/memory/adapters/platform/webImageIntake.js';
    const { createWebMediaStore, createWebImageIntake } = await import(/* @vite-ignore */ modulePath);
    const id = await new Promise<string>(resolve => {
      const r = indexedDB.open('moemoa-web-media-v1', 1);
      r.onsuccess = () => { const db = r.result; const q = db.transaction('tickets').objectStore('tickets').getAllKeys(); q.onsuccess = () => { resolve(String(q.result[0])); db.close(); }; };
    });
    const store = createWebMediaStore(), intake = createWebImageIntake({ store });
    const args = { ticketId: id, assetId: 'retry-asset', operationId: 'retry-op' };
    const results = await Promise.all([intake.promoteTicket(args), intake.promoteTicket(args)]);
    const replay = await intake.promoteTicket(args);
    let conflict;
    try { await intake.promoteTicket({ ...args, operationId: 'other-op' }); } catch (e: any) { conflict = e.code; }
    return { results, replay, conflict, preserved: (await store.get('retry-asset')).operationId };
  });
  expect(observed.results[0]).toEqual(observed.results[1]);
  expect(observed.replay).toEqual(observed.results[0]);
  expect(observed.conflict).toBe('INVALID_MEDIA_PROMOTION');
  expect(observed.preserved).toBe('retry-op');
});
