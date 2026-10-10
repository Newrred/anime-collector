import { expect, test, type Locator, type Page } from '@playwright/test';
import { jpegBytes, nonSquareJpegBytes } from './catalog-lab/fixtures/cover-valid-images.mjs';
import { installSignedInPhotoAccount, openArchiveAfterPhotoSave } from './helpers/signedInPhotoAccount';

// Synthetic browser events and delayed local intake responses, not an OS
// clipboard test. No real accounts, remote media, or user image bytes are used.
test.skip(process.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 !== '1'
  || process.env.PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 !== '1', 'Authenticated Web photo flags required');

const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const preview = `data:image/jpeg;base64,${Buffer.from(jpegBytes).toString('base64')}`;
const incomingPreview = `data:image/jpeg;base64,${Buffer.from(nonSquareJpegBytes).toString('base64')}`;

async function installIntake(page: Page, { seedCard = false, delayedIngest = false } = {}) {
  const account = await installSignedInPhotoAccount(page);
  await page.addInitScript(({ seedCard, delayedIngest, preview, incomingPreview }) => {
    const control = (window as any).__desktopImageLifecycle = {
      ingests: [] as string[], discards: [] as string[], promotions: [] as string[],
      delayIngest: delayedIngest, delayDiscard: null as string | null, failDiscard: null as string | null,
      releaseIngest: null as (() => void) | null, releaseDiscard: null as (() => void) | null,
    };
    const ticket = (ticketId: string) => ({
      ticketId, mimeType: 'image/jpeg', byteSize: 42, width: 1, height: 1,
      createdAtEpochMs: 123, localOnly: true,
      previewDataUrl: ticketId === 'lifecycle-intake-2' ? incomingPreview : preview,
    });
    (window as any).__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({ ticket: seedCard ? ticket('lifecycle-seed') : null, processing: false, errorCode: null }),
      pick: async () => ({ ticket: null, cancelled: true }),
      ingestFile: async (file: File) => {
        control.ingests.push(file.name);
        const ticketId = `lifecycle-intake-${control.ingests.length}`;
        if (control.delayIngest) {
          control.delayIngest = false;
          await new Promise<void>(resolve => { control.releaseIngest = resolve; });
        }
        return { ticket: ticket(ticketId), cancelled: false };
      },
      discard: async (ticketId: string) => {
        control.discards.push(ticketId);
        if (control.delayDiscard === ticketId) {
          control.delayDiscard = null;
          await new Promise<void>(resolve => { control.releaseDiscard = resolve; });
        }
        return control.failDiscard !== ticketId;
      },
      promoteTicket: async ({ ticketId, assetId }: { ticketId: string; assetId: string }) => {
        control.promotions.push(ticketId);
        return { localRef: `asset:${assetId}`, checksumSha256: 'a'.repeat(64),
          mimeType: 'image/jpeg', byteSize: 42, width: 1, height: 1 };
      },
      getPreview: async () => preview,
      deleteAsset: async () => true,
    };
  }, { seedCard, delayedIngest, preview, incomingPreview });
  return account;
}

async function sendImages(target: Locator, kinds: Array<'paste' | 'drop'>) {
  return target.evaluate((element, { kinds, bytes }) => kinds.map(kind => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array(bytes)], `synthetic-${kind}.jpg`, { type: 'image/jpeg' }));
    const event = kind === 'paste'
      ? new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
      : new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }), { kinds, bytes: Array.from(jpegBytes) });
}

async function openReplacement(page: Page) {
  await installIntake(page, { seedCard: true });
  await page.goto('/memory/new/');
  await expect(page.locator('.memory-composer__preview')).toBeVisible();
  await page.getByLabel('Anime or card title').fill('Lifecycle baseline');
  await page.getByLabel(/I confirm that I have the right/).check();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await openArchiveAfterPhotoSave(page);
  await page.getByRole('link', { name: 'Lifecycle baseline', exact: true }).click();
  await page.getByRole('tab', { name: 'Manage', exact: true }).click();
  await page.locator('.memory-detail__tools > summary').click();
  const region = page.locator('.memory-detail__replacement.memory-image-input');
  await expect(region).toBeVisible();
  await sendImages(region, ['paste']);
  await expect(region.locator('.memory-detail__replacement-review img')).toHaveAttribute('src', preview);
  await region.getByRole('checkbox').check();
  return region;
}

test('same-tick paste and drop start only one intake and never save automatically', async ({ page }) => {
  const { uploads } = await installIntake(page, { delayedIngest: true });
  await page.goto('/memory/new/');
  await expect(page.getByRole('button', { name: 'Choose image', exact: true })).toBeEnabled();
  expect(await sendImages(page.locator('.memory-composer__visual-column'), ['paste', 'drop'])).toEqual([true, true]);
  expect(await page.evaluate(() => (window as any).__desktopImageLifecycle.ingests)).toHaveLength(1);
  await page.evaluate(() => (window as any).__desktopImageLifecycle.releaseIngest());
  await expect(page.locator('.memory-composer__preview')).toBeVisible();
  await expect(page.getByLabel(/I confirm that I have the right/)).not.toBeChecked();
  expect(await page.evaluate(() => (window as any).__desktopImageLifecycle.promotions)).toEqual([]);
  expect(uploads).toHaveLength(0);
});

test('late account-A intake is discarded after account-B remount without adopting A draft', async ({ page }) => {
  const { uploads } = await installIntake(page, { delayedIngest: true });
  await page.goto('/memory/new/');
  await expect(page.getByRole('button', { name: 'Choose image', exact: true })).toBeEnabled();
  await page.getByLabel('Anime or card title').fill('Account A unsaved title');
  await sendImages(page.locator('.memory-composer__visual-column'), ['paste']);
  await expect.poll(() => page.evaluate(() => typeof (window as any).__desktopImageLifecycle.releaseIngest)).toBe('function');
  await page.evaluate(async userId => {
    // Keep the shared fixture gateway tied to the current synthetic session.
    (window as any).__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__.gateway.ensureUserProfile = async () => ({
      userId: JSON.parse(localStorage.getItem('moemoa.e2e.mockSession.v1')!).user.id,
    });
    const { writeMockAuthSession } = await import('/src/repositories/mockAuthStorage.js');
    writeMockAuthSession({ user: { id: userId } });
  }, OTHER_USER);
  await expect.poll(() => page.evaluate(async () => {
    const { getPlatformMemoryAccountRuntime } = await import('/src/features/memory/runtime/platformMemoryAccountRuntime.js');
    const state = await (await getPlatformMemoryAccountRuntime()).getState();
    return { userId: state.userId, status: state.status };
  })).toEqual({ userId: OTHER_USER, status: 'ACCOUNT_READY' });
  await expect(page.getByRole('button', { name: 'Choose image', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Anime or card title')).toHaveValue('');
  await page.evaluate(() => (window as any).__desktopImageLifecycle.releaseIngest());
  await expect.poll(() => page.evaluate(() => (window as any).__desktopImageLifecycle.discards)).toContain('lifecycle-intake-1');
  await expect(page.locator('.memory-composer__preview')).toHaveCount(0);
  await expect(page.getByLabel('Anime or card title')).toHaveValue('');
  expect(await page.evaluate(() => (window as any).__desktopImageLifecycle.promotions)).toEqual([]);
  expect(uploads).toHaveLength(0);
});

test('closing replacement during old-ticket cleanup clears its stale preview and discards the incoming ticket', async ({ page }) => {
  const region = await openReplacement(page);
  await page.evaluate(() => { (window as any).__desktopImageLifecycle.delayDiscard = 'lifecycle-intake-1'; });
  await sendImages(region, ['drop']);
  await expect.poll(() => page.evaluate(() => typeof (window as any).__desktopImageLifecycle.releaseDiscard)).toBe('function');
  await page.locator('.memory-detail__tools > summary').click();
  await expect(region).toBeHidden();
  await page.evaluate(() => (window as any).__desktopImageLifecycle.releaseDiscard());
  await expect.poll(() => page.evaluate(() => (window as any).__desktopImageLifecycle.discards)).toContain('lifecycle-intake-2');
  await page.locator('.memory-detail__tools > summary').click();
  await expect(region).toBeVisible();
  await expect(region.locator('.memory-detail__replacement-review')).toHaveCount(0);
  await expect(region.getByRole('checkbox')).toHaveCount(0);
  await expect(region.getByRole('button', { name: 'Replace image', exact: true })).toBeEnabled();
  await expect(page.locator('.memory-detail__visual img')).toHaveAttribute('src', preview);
  expect(await page.evaluate(() => (window as any).__desktopImageLifecycle.promotions)).toEqual([]);
});

test('unconfirmed old-ticket cleanup retains the old selection but discards the unadopted new image', async ({ page }) => {
  const region = await openReplacement(page);
  await page.evaluate(() => { (window as any).__desktopImageLifecycle.failDiscard = 'lifecycle-intake-1'; });
  await sendImages(region, ['paste']);
  await expect.poll(() => page.evaluate(() => (window as any).__desktopImageLifecycle.discards)).toContain('lifecycle-intake-2');
  await expect(region.locator('.memory-detail__replacement-review img')).toHaveAttribute('src', preview);
  await expect(region.getByRole('checkbox')).toBeChecked();
  await expect(page.locator('.memory-detail__message')).toContainText('temporary image');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('moemoa:pending-ticket-cleanup:v1') || '[]'))).toContain('lifecycle-intake-1');
  expect(await page.evaluate(() => (window as any).__desktopImageLifecycle.promotions)).toEqual([]);
});
