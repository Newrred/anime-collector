import { test, expect } from '@playwright/test';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

test('late private detail response from A cannot appear after switching to B', async ({ page }) => {
  await page.goto('/favicon.svg');
  const cardId = await page.evaluate(async (userId) => {
    const { IndexedDbMemoryRepository } = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const repo = await IndexedDbMemoryRepository.open();
    const now = new Date().toISOString();
    await repo.ensureInstallationIdentity({ uuid: crypto.randomUUID(), now });
    const account = await repo.ensureAccountOwner({ userId, now });
    await repo.activateOwner({ ownerId: account.id, now });
    const store = await import("/src/features/memory/adapters/indexeddb/memorySyncStore.js");
    await store.writeDeviceSyncState(repo.database, { ownerId: account.id, userId, installationId: crypto.randomUUID(), deviceId: crypto.randomUUID(), lastSyncSeq: 0, updatedAt: now });
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    const card = await runtime.createCard({ titleChoice: { kind: 'PRIVATE_TITLE', displayTitle: 'A private title' }, note: 'A private reflection', systemDesignSpec: { version: 1, templateId: 'memory-gradient', paletteId: 'violet-dawn', patternSeed: 'owner-test', titleLayout: 'BOTTOM_LEFT', genreTokens: [] } });
    repo.close(); return card.cardId;
  }, A);
  await page.addInitScript(({ a }) => {
    localStorage.setItem('ui:locale:v1', JSON.stringify('en'));
    localStorage.setItem('moemoa.e2e.mockSession.v1', JSON.stringify({ user: { id: a } }));
    let repositoryPromise;
    const repository = () => repositoryPromise ||= import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js').then(async ({ IndexedDbMemoryRepository }) => {
      const read = IndexedDbMemoryRepository.prototype.getCardBundle;
      IndexedDbMemoryRepository.prototype.getCardBundle = async function(ownerId, id) {
        const bundle = await read.call(this, ownerId, id);
        if (ownerId === `account:${a}` && bundle) {
          (window as any).waitingForA = true;
          await new Promise(resolve => { (window as any).releaseA = resolve; });
        }
        return bundle;
      };
      return IndexedDbMemoryRepository.open();
    });
    const proxy = new Proxy({}, { get(_target, method) { return async (...args) => (await repository())[method](...args); } });
    (window as any).__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__ = {
      enabled: true, repository: proxy,
      gateway: {
        ensureUserProfile: async () => ({ userId: JSON.parse(localStorage.getItem('moemoa.e2e.mockSession.v1')).user.id }),
        registerDevice: async data => ({ id: data.deviceId, installationId: data.installationId, lastSyncSeq: 0 }),
        promoteGuest: async () => { throw new Error('not requested'); },
      },
      readDeviceSyncState: async id => {
        const store = await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js');
        return store.readDeviceSyncState((await repository()).database, id);
      },
      writeDeviceSyncState: async state => {
        const store = await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js');
        return store.writeDeviceSyncState((await repository()).database, state);
      },
      uuid: () => crypto.randomUUID(), clock: { now: () => new Date().toISOString() },
    };
  }, { a: A });
  await page.goto(`/memory/card/?id=${cardId}`);
  await expect.poll(() => page.evaluate(() => Boolean((window as any).waitingForA))).toBe(true);
  await page.evaluate(async userId => {
    const { writeMockAuthSession } = await import('/src/repositories/mockAuthStorage.js');
    writeMockAuthSession({ user: { id: userId } });
  }, B);
  await expect.poll(async () => page.evaluate(async () => {
    const { getPlatformMemoryAccountRuntime } = await import('/src/features/memory/runtime/platformMemoryAccountRuntime.js');
    return (await (await getPlatformMemoryAccountRuntime()).getState()).userId;
  })).toBe(B);
  await page.evaluate(() => (window as any).releaseA());
  await expect(page.getByText('A private reflection', { exact: true })).toHaveCount(0);
  await expect(page.getByText('A private title', { exact: true })).toHaveCount(0);
  await expect(page.locator('.memory-detail textarea')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Card not found.', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to Memories', exact: true })).toBeVisible();
});
