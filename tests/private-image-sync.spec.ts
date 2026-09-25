import { expect, test, Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

test.skip(process.env.PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 !== '1' || process.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 !== '1', 'Explicit development flags required');
const A = '11111111-1111-4111-8111-111111111111';
const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

async function account(page: Page) {
  await page.route('https://**', route => route.abort());
  await page.goto('/favicon.svg');
  await page.evaluate(async userId => {
    const { IndexedDbMemoryRepository } = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const repo = await IndexedDbMemoryRepository.open(), now = new Date().toISOString();
    await repo.ensureInstallationIdentity({ uuid: crypto.randomUUID(), now });
    const owner = await repo.ensureAccountOwner({ userId, now });
    await repo.activateOwner({ ownerId: owner.id, now });
    const store = await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js');
    await store.writeDeviceSyncState(repo.database, { ownerId: owner.id, userId, installationId: crypto.randomUUID(), deviceId: crypto.randomUUID(), lastSyncSeq: 0, updatedAt: now });
    repo.close();
  }, A);
  await page.addInitScript(a => {
    localStorage.setItem('ui:locale:v1', JSON.stringify('en'));
    localStorage.setItem('moemoa.e2e.mockSession.v1', JSON.stringify({ user: { id: a } }));
    let promise;
    const repo = () => promise ||= import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js').then(m => m.IndexedDbMemoryRepository.open());
    (window as any).__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__ = {
      enabled: true, repository: new Proxy({}, { get: (_, method) => async (...args) => (await repo())[method](...args) }),
      gateway: { ensureUserProfile: async () => ({ userId: JSON.parse(localStorage.getItem('moemoa.e2e.mockSession.v1')).user.id }), registerDevice: async data => ({ id: data.deviceId, installationId: data.installationId, lastSyncSeq: 0 }), promoteGuest: async () => { throw new Error('not requested'); } },
      readDeviceSyncState: async id => (await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js')).readDeviceSyncState((await repo()).database, id),
      writeDeviceSyncState: async state => (await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js')).writeDeviceSyncState((await repo()).database, state),
      uuid: () => crypto.randomUUID(), clock: { now: () => new Date().toISOString() },
    };
  }, A);
}

async function originalHashes(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('moemoa-web-media-v1'); r.onsuccess = () => resolve(r.result); });
    const rows = await new Promise<any[]>(resolve => { const r = db.transaction('assets').objectStore('assets').getAll(); r.onsuccess = () => resolve(r.result); }); db.close();
    return Promise.all(rows.map(async row => ({ hash: row.hash, actual: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await row.blob.arrayBuffer()))).map(x => x.toString(16).padStart(2, '0')).join(''), size: row.blob.size })));
  });
}

test('actual Web picker/optimizer/journal preserve original through ambiguous HTTP retry and remote-only reload', async ({ page }) => {
  test.setTimeout(90000);
  await account(page);
  const pixels = Buffer.alloc(1800 * 1000 * 3); let seed = 19;
  for (let i = 0; i < pixels.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
  const source = await sharp(pixels, { raw: { width: 1800, height: 1000, channels: 3 } }).png().toBuffer();
  expect(source.length).toBeGreaterThan(1_000_000);
  const posts: { bytes: Buffer, operation: string }[] = []; let representation = null, remote: Buffer, thumb: Buffer;
  const reads: string[] = [];
  await page.route('**/api/private-image**', async route => {
    const req = route.request();
    expect(req.headers().authorization).toBe('Bearer mock-access-token');
    if (req.method() === 'POST') {
      const bytes = req.postDataBuffer()!; posts.push({ bytes, operation: req.headers()['x-moemoa-operation'] });
      if (posts.length === 1) return route.abort('failed'); // Unknown completion; mocked network, not hosted Storage.
      remote = await sharp(bytes).webp({ quality: 85 }).toBuffer();
      thumb = await sharp(bytes).resize({ width: 400 }).webp({ quality: 75 }).toBuffer();
      representation = { state: 'READY', sourceVersion: 1, mainBytes: remote.length, mainHash: hash(remote), thumbnailBytes: thumb.length, thumbnailHash: hash(thumb) };
      return route.fulfill({ json: representation });
    }
    if (req.url().includes('policy=1')) return route.fulfill({ json: { revision: 'BROWSER_TEST_ONLY', quotaBytes: 50_000_000, usedBytes: representation ? remote.length : 0, mainMaxBytes: 1_000_000, transportBodyMaxBytes: 1_500_000, representation } });
    reads.push(req.url());
    return route.fulfill({ contentType: 'image/webp', body: req.url().includes('variant=thumb') ? thumb : remote });
  });
  await page.goto('/memory/new/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose image', exact: true }).click();
  await (await chooser).setFiles({ name: 'synthetic-noise.png', mimeType: 'image/png', buffer: source });
  await expect(page.getByAltText('Selected image preview')).toBeVisible();
  await page.getByLabel('Anime or card title').fill('Private sync test');
  await page.getByLabel(/I confirm that I have the right/).check();
  await page.getByRole('button', { name: 'Save card', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/$/);
  // Only metadata sync/Auth/HTTP are fixture boundaries. File picker, original store, canvas and UI are real.
  await page.evaluate(async () => {
    const { IndexedDbMemoryRepository } = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const repo = await IndexedDbMemoryRepository.open();
    await new Promise<void>((resolve, reject) => {
      const tx = repo.database.transaction('visual_assets', 'readwrite');
      const r = tx.objectStore('visual_assets').openCursor(); r.onsuccess = () => { const c = r.result; if (!c) return; c.update({ ...c.value, sync: { ...c.value.sync, syncState: 'SYNCED', remoteVersion: 1 } }); c.continue(); };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); repo.close();
  });
  await page.getByRole('link', { name: 'Private sync test', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Private image sync', exact: true });
  await expect(panel.getByText('Private copy not synced', { exact: true })).toBeVisible();
  expect(posts.length).toBe(0);
  await expect(panel.getByRole('button', { name: 'Sync private copy', exact: true })).toBeDisabled();
  await panel.getByRole('checkbox').check();
  await panel.getByRole('button', { name: 'Sync private copy', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Completion could not be confirmed');
  await page.reload();
  await expect(panel.getByRole('button', { name: 'Retry same request', exact: true })).toBeDisabled();
  await panel.getByRole('checkbox').check();
  await panel.getByRole('button', { name: 'Retry same request', exact: true }).click();
  await expect(panel.getByText('Private copy synced', { exact: true })).toBeVisible();
  await expect(page.locator('.memory-detail img[src^="blob:"]')).toBeVisible();
  expect(posts.length).toBe(2); expect(posts[1].operation).toBe(posts[0].operation);
  expect(posts[1].bytes.equals(posts[0].bytes)).toBe(true); expect(posts[0].bytes.length).toBeLessThanOrEqual(1_000_000);
  const meta = await sharp(posts[0].bytes).metadata(); expect(meta.width).toBe(1600);
  expect(await originalHashes(page)).toEqual([{ hash: hash(source), actual: hash(source), size: source.length }]);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open('moemoa-web-media-v1'); r.onsuccess = () => resolve(r.result); });
    await new Promise<void>(resolve => { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').clear(); tx.oncomplete = () => resolve(); }); db.close();
  });
  await page.reload();
  await expect(page.locator('.memory-detail img[src^="blob:"]')).toBeVisible();
  expect(posts.length).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel.getByRole('button', { name: 'View server copy' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const detailUrl = page.url();
  const boardId = await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime(), cardId = new URLSearchParams(location.search).get('id');
    const board = await runtime.createBoard({ title: 'Private remote board', description: '' });
    await runtime.addCardToBoard(board.id, cardId); return board.id;
  });
  await page.goto('/archive/');
  await expect(page.locator('.memory-archive img[src^="blob:"]')).toBeVisible();
  expect(reads.at(-1)).toContain('variant=thumb');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`/boards/?id=${boardId}`);
  await expect(page.locator('.memory-preview img[src^="blob:"]')).toBeVisible();
  expect(reads.at(-1)).toContain('variant=thumb'); expect(posts.length).toBe(2);
  await page.goto(detailUrl);
  await expect(page.locator('.memory-detail img[src^="blob:"]')).toBeVisible();
  let release;
  const held = new Promise<void>(resolve => { release = resolve; }); let waiting = false;
  await page.route('**/api/private-image**', async route => {
    if (route.request().url().includes('policy=1')) return route.fallback();
    waiting = true; await held;
    await route.fulfill({ contentType: 'image/webp', body: remote }).catch(() => {});
  });
  await page.reload();
  await expect.poll(() => waiting).toBe(true);
  await page.evaluate(async () => {
    const { writeMockAuthSession } = await import('/src/repositories/mockAuthStorage.js');
    writeMockAuthSession({ user: { id: '22222222-2222-4222-8222-222222222222' } });
  });
  await expect(page.getByRole('heading', { name: 'Card not found.', exact: true })).toBeVisible();
  release();
  await expect(page.locator('.memory-detail img[src^="blob:"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Private sync test', exact: true })).toHaveCount(0);
});

test('IndexedDB journal atomically retains one retry and isolates owner keys', async ({ page }) => {
  await page.goto('/favicon.svg');
  const result = await page.evaluate(async () => {
    const { createPrivateImageJournal } = await import('/src/features/memory/adapters/indexeddb/privateImageJournal.js');
    const journal = createPrivateImageJournal(), blob = new Blob(['synthetic']);
    const a = { key: 'A:asset:1', assetId: 'asset', ownerId: 'A', operationId: 'first', blob };
    const [one, two] = await Promise.all([journal.putIfAbsent(a), journal.putIfAbsent({ ...a, operationId: 'second' })]);
    await journal.putIfAbsent({ ...a, key: 'B:assetB:1', ownerId: 'B', assetId: 'assetB' });
    await journal.remove(a.key, 'wrong-op'); const retained = await journal.get(a.key);
    await journal.removeAsset('asset');
    return { same: one.operationId === two.operationId, retained: !!retained, removed: !(await journal.get(a.key)), b: !!(await journal.get('B:assetB:1')) };
  });
  expect(result).toEqual({ same: true, retained: true, removed: true, b: true });
});

test('Archive lazily bounds thumbnail reads and drops queued A images after account change', async ({ page }) => {
  await account(page);
  await page.goto('/favicon.svg');
  await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    for (let i = 0; i < 12; i++) await runtime.createCard({ titleChoice: { kind: 'PRIVATE_TITLE', displayTitle: `Remote A ${i}` },
      systemDesignSpec: { version: 1, templateId: 'memory-gradient', paletteId: 'violet-dawn', patternSeed: 'remote-list-test', titleLayout: 'BOTTOM_LEFT', genreTokens: [] } });
    // Synthetic synced metadata for a remote-only device, not an actual hosted sync claim.
    const { IndexedDbMemoryRepository } = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const repo = await IndexedDbMemoryRepository.open();
    await new Promise<void>((resolve, reject) => {
      const tx = repo.database.transaction('visual_assets', 'readwrite');
      tx.objectStore('visual_assets').openCursor().onsuccess = e => {
        const c = (e.target as IDBRequest).result; if (!c) return;
        c.update({ ...c.value, imageType: 'UNKNOWN', designSpec: null, localRef: null, checksumSha256: 'a'.repeat(64), sync: { ...c.value.sync, syncState: 'SYNCED', remoteVersion: 1 } }); c.continue();
      }; tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }); repo.close();
  });
  const bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#aabbcc' } }).webp().toBuffer();
  let reads = 0, policies = 0, release;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/private-image**', async route => {
    expect(route.request().method()).toBe('GET');
    if (route.request().url().includes('policy=1')) {
      policies++;
      return route.fulfill({ json: { revision: 'BROWSER_TEST_ONLY', quotaBytes: 50_000_000, usedBytes: bytes.length * 24, mainMaxBytes: 1_000_000, transportBodyMaxBytes: 1_500_000,
        representation: { state: 'READY', sourceVersion: 1, mainHash: hash(bytes), mainBytes: bytes.length, thumbnailHash: hash(bytes), thumbnailBytes: bytes.length } } });
    }
    expect(route.request().url()).toContain('variant=thumb'); reads++;
    await held; await route.fulfill({ contentType: 'image/webp', body: bytes }).catch(() => {});
  });
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/archive/');
  await expect(page.locator('.memory-preview')).toHaveCount(12);
  await expect.poll(() => reads).toBeGreaterThan(0);
  expect(reads).toBeLessThan(4); // Only the first viewport, not the entire archive.
  await page.setViewportSize({ width: 1440, height: 10000 });
  await expect.poll(() => reads).toBe(4);
  expect(policies).toBe(4);
  await page.evaluate(async () => {
    const { writeMockAuthSession } = await import('/src/repositories/mockAuthStorage.js');
    writeMockAuthSession({ user: { id: '22222222-2222-4222-8222-222222222222' } });
  });
  await expect(page.locator('.memory-preview')).toHaveCount(0);
  release();
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(0);
  expect(reads).toBe(4); expect(policies).toBe(4);
});
