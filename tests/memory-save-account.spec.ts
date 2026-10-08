import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';

const userId = '11111111-1111-4111-8111-111111111111';

test.skip(process.env.PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 !== '1' || process.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 !== '1', 'Private photo and Web picker flags required');

test('Save card automatically retries the same private photo after navigation without making another card', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'Windows Playwright WebKit cannot persist Blob records in IndexedDB');
  test.setTimeout(90000);
  const source = await sharp({ create: { width: 800, height: 800, channels: 3, background: '#a746d0' } }).png().toBuffer();
  await page.route('https://**', route => route.abort());
  await page.addInitScript(id => {
    localStorage.setItem('ui:locale:v1', JSON.stringify('en'));
    localStorage.setItem('moemoa.e2e.mockSession.v1', JSON.stringify({ user: { id } }));
    let repositoryPromise;
    const repository = () => repositoryPromise ||= import(location.origin + '/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js')
      .then(module => module.IndexedDbMemoryRepository.open());
    const requests = [];
    (window as any).__SAVE_ACCOUNT_REQUESTS__ = requests;
    (window as any).__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__ = {
      enabled: true,
      repository: new Proxy({}, { get: (_, name) => async (...args) => (await repository())[name](...args) }),
      gateway: {
        ensureUserProfile: async () => ({ userId: id }),
        registerDevice: async data => ({ id: data.deviceId, installationId: data.installationId, lastSyncSeq: 0 }),
        promoteGuest: async () => { throw new Error('Guest promotion not requested'); },
        applyCardMutation: async request => {
          requests.push({ entityType: request.entityType, entityId: request.entityId });
          return { status: 'APPLIED', entityVersion: 1, syncSeq: requests.length };
        },
        applyBoardMutation: async request => {
          requests.push({ entityType: request.entityType, entityId: request.entityId });
          return { status: 'APPLIED', entityVersion: 1, syncSeq: requests.length };
        },
        pullChanges: async ({ afterSeq }) => ({ changes: [], nextSyncSeq: afterSeq, requiresFullResync: false }),
      },
      readDeviceSyncState: async ownerId => (await import(location.origin + '/src/features/memory/adapters/indexeddb/memorySyncStore.js'))
        .readDeviceSyncState((await repository()).database, ownerId),
      writeDeviceSyncState: async state => (await import(location.origin + '/src/features/memory/adapters/indexeddb/memorySyncStore.js'))
        .writeDeviceSyncState((await repository()).database, state),
      uuid: () => crypto.randomUUID(),
      clock: { now: () => new Date().toISOString() },
    };
  }, userId);

  let posts = 0;
  await page.route('**/api/private-image**', async route => {
    const request = route.request();
    if (request.url().includes('policy=1')) {
      return route.fulfill({ json: {
        revision: 'SAVE_TEST_POLICY', quotaBytes: 50_000_000, usedBytes: 0,
        mainMaxBytes: 1_000_000, transportBodyMaxBytes: 1_500_000, representation: null,
      } });
    }
    if (request.method() === 'POST') {
      posts++;
      if (posts === 1) return route.abort('failed');
      const bytes = request.postDataBuffer()!;
      return route.fulfill({ json: {
        state: 'READY', sourceVersion: 1, mainBytes: bytes.length,
        mainHash: createHash('sha256').update(bytes).digest('hex'),
      } });
    }
    return route.abort();
  });

  await page.goto('/memory/new/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose image', exact: true }).click();
  await (await chooser).setFiles({ name: 'private-test.png', mimeType: 'image/png', buffer: source });
  await expect(page.getByAltText('Selected image preview')).toBeVisible();
  await page.getByLabel('Anime or card title').fill('Save account test');
  await page.getByLabel(/I confirm that I have the right/).check();
  await expect(page.getByText('Saving also stores a smaller private copy in your account. The original stays on this device.')).toBeVisible();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page.getByText('Card details are in your account. Photo transfer will retry automatically.')).toBeVisible();
  expect(posts).toBe(1);
  const requests = await page.evaluate(() => (window as any).__SAVE_ACCOUNT_REQUESTS__);
  expect(requests.some(row => row.entityType === 'MEMORY_CARD')).toBe(true);
  expect(requests.some(row => row.entityType === 'VISUAL_ASSET')).toBe(true);
  await page.getByRole('link', { name: 'View saved card' }).click();
  await expect(page).toHaveURL(/\/memory\/card\//);
  await expect.poll(() => posts).toBe(2);
  await expect.poll(() => page.evaluate(async () => {
    const { createPrivatePhotoAutoSaveStore } = await import('/src/features/memory/adapters/indexeddb/privatePhotoAutoSaveStore.js');
    return (await createPrivatePhotoAutoSaveStore().list(`account:${'11111111-1111-4111-8111-111111111111'}`)).length;
  })).toBe(0);
  const saved = await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    return runtime.listArchive();
  });
  expect(saved).toHaveLength(1);
});
