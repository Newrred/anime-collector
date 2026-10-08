import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';

/** Local-only account fixture: real browser/IndexedDB/photo intake, mocked account gateway and HTTP. */
export async function installSignedInPhotoAccount(page: Page, locale: 'en' | 'ko' = 'en') {
  const uploads: Buffer[] = [];
  await page.route('https://**', route => route.abort());
  await page.addInitScript(({ userId, language }) => {
    localStorage.setItem('ui:locale:v1', JSON.stringify(language));
    localStorage.setItem('moemoa.e2e.mockSession.v1', JSON.stringify({ user: { id: userId } }));
    let repositoryPromise: Promise<any> | undefined;
    const repository = () => repositoryPromise ||= import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js')
      .then(module => module.IndexedDbMemoryRepository.open());
    (window as any).__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__ = {
      enabled: true,
      repository: new Proxy({}, { get: (_target, method) => async (...args: unknown[]) => (await repository())[method](...args) }),
      gateway: {
        ensureUserProfile: async () => ({ userId }),
        registerDevice: async data => ({ id: data.deviceId, installationId: data.installationId, lastSyncSeq: 0 }),
        promoteGuest: async () => { throw new Error('Guest promotion is outside this fixture'); },
        applyCardMutation: async () => ({ status: 'APPLIED', entityVersion: 1, syncSeq: 1 }),
        applyBoardMutation: async () => ({ status: 'APPLIED', entityVersion: 1, syncSeq: 1 }),
        pullChanges: async ({ afterSeq }) => ({ changes: [], nextSyncSeq: afterSeq, requiresFullResync: false }),
      },
      readDeviceSyncState: async ownerId => (await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js'))
        .readDeviceSyncState((await repository()).database, ownerId),
      writeDeviceSyncState: async state => (await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js'))
        .writeDeviceSyncState((await repository()).database, state),
      uuid: () => crypto.randomUUID(),
      clock: { now: () => new Date().toISOString() },
    };
    (window as any).__MOEMOA_TEST_PUBLICATION_ADAPTERS__ = {
      client: { rpc(name: string) {
        const response = { data: name === 'retire_memory_card_publications' ? { status: 'RETIRED' } : null, error: null, status: 200 };
        const request = {
          abortSignal: () => request,
          then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
        };
        return request;
      } },
    };
  }, { userId: TEST_USER_ID, language: locale });
  await page.route('**/api/private-image**', async route => {
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer mock-access-token');
    if (request.url().includes('policy=1')) {
      return route.fulfill({ json: {
        revision: 'E2E_PHOTO_POLICY', quotaBytes: 50_000_000, usedBytes: uploads.reduce((sum, row) => sum + row.length, 0),
        mainMaxBytes: 1_000_000, transportBodyMaxBytes: 1_500_000, representation: null,
      } });
    }
    if (request.method() === 'POST') {
      const bytes = request.postDataBuffer()!;
      uploads.push(bytes);
      return route.fulfill({ json: {
        state: 'READY', sourceVersion: 1, mainBytes: bytes.length,
        mainHash: createHash('sha256').update(bytes).digest('hex'),
      } });
    }
    if (uploads.length) return route.fulfill({ contentType: 'image/jpeg', body: uploads.at(-1)! });
    return route.fulfill({ status: 404, json: { error: 'NOT_FOUND' } });
  });
  return { uploads, userId: TEST_USER_ID };
}

export async function openArchiveAfterPhotoSave(page: Page, locale: 'en' | 'ko' = 'en') {
  const savedCard = page.getByRole('link', { name: locale === 'ko' ? '저장한 카드 보기' : 'View saved card' });
  await expect.poll(async () => /\/archive\//.test(page.url()) || await savedCard.isVisible()).toBe(true);
  if (!/\/archive\//.test(page.url())) await page.goto('/archive/');
}
