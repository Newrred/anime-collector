import { test, expect } from '@playwright/test';

test('write acknowledgement and conflict resolution never skip unread remote changes in IndexedDB', async ({ page }) => {
  await page.goto('/favicon.svg');
  const result = await page.evaluate(async () => {
    const { IndexedDbMemoryRepository } = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const store = await import('/src/features/memory/adapters/indexeddb/memorySyncStore.js');
    const repo = await IndexedDbMemoryRepository.open();
    const now = '2026-09-23T00:00:00.000Z';
    const userId = '11111111-1111-4111-8111-111111111111';
    const owner = await repo.ensureAccountOwner({ userId, now });
    await repo.activateOwner({ ownerId: owner.id, now });
    await store.writeDeviceSyncState(repo.database, { ownerId: owner.id, userId, installationId: crypto.randomUUID(), deviceId: crypto.randomUUID(), lastSyncSeq: 7, updatedAt: now });
    const operation = { id: crypto.randomUUID(), ownerId: owner.id, entityType: 'MEMORY_CARD', entityId: crypto.randomUUID(), operationType: 'UPSERT', baseVersion: 0, requestHash: 'a'.repeat(64), payload: { note: 'synthetic' }, state: 'PENDING', createdAt: now };
    await repo.enqueueMutation(operation);
    await repo.commitSyncMutation({ ownerId: owner.id, operation, result: { status: 'APPLIED', entityVersion: 1, syncSeq: 100 }, now });
    const cursorAfterWrite = (await store.readDeviceSyncState(repo.database, owner.id)).lastSyncSeq;
    const versions = await repo.readAcknowledgedSyncVersions(owner.id);
    const conflictOperation = { ...operation, id: crypto.randomUUID(), baseVersion: 1 };
    await repo.enqueueMutation(conflictOperation);
    await repo.commitSyncMutation({ ownerId: owner.id, operation: conflictOperation, result: { status: 'CONFLICT', entityVersion: 2, remoteEntity: { id: operation.entityId, version: 2 } }, now });
    const conflict = (await repo.listOpenSyncConflicts(owner.id))[0];
    // A real local row exercises the KEEP_LOCAL write branch.
    const tx = repo.database.transaction('memory_cards', 'readwrite');
    tx.objectStore('memory_cards').put({ id: operation.entityId, ownerId: owner.id, sync: {} });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    await repo.commitConflictResolution({ ownerId: owner.id, conflictId: conflict.id, selection: 'KEEP_LOCAL', operation: { operationId: crypto.randomUUID() }, result: { entityVersion: 3, syncSeq: 120 }, now });
    const cursorAfterResolution = (await store.readDeviceSyncState(repo.database, owner.id)).lastSyncSeq;
    const rejected = { ...operation, id: crypto.randomUUID(), entityId: crypto.randomUUID() };
    await repo.enqueueMutation(rejected);
    await repo.commitSyncMutation({ ownerId: owner.id, operation: rejected, result: { status: 'REJECTED', errorCode: 'POLICY_REJECTED' }, now });
    const titleId = crypto.randomUUID();
    const titleOperation = { ...operation, id: crypto.randomUUID(), entityType: 'PRIVATE_TITLE', entityId: titleId, payload: { displayTitle: 'Local draft' } };
    await repo.enqueueMutation(titleOperation);
    const remoteTitle = { entityType: 'PRIVATE_TITLE', id: titleId, userId, displayTitle: 'Remote', normalizedTitle: 'remote', optionalGenres: [], version: 2, createdAt: now, clientUpdatedAt: now, serverUpdatedAt: now, deletedAt: now };
    await repo.commitSyncMutation({ ownerId: owner.id, operation: titleOperation, result: { status: 'CONFLICT', entityVersion: 2, remoteEntity: remoteTitle }, now });
    await repo.enqueueMutation({ ...titleOperation, id: crypto.randomUUID() });
    await repo.commitFullResync({ ownerId: owner.id, entities: [remoteTitle], nextSyncSeq: 150, now });
    const pendingAfterDelete = await repo.countPendingSyncOperations(owner.id);
    const conflictsAfterDelete = (await repo.listOpenSyncConflicts(owner.id)).length;
    const deletedTitle = await new Promise<any>((resolve, reject) => {
      const request = repo.database.transaction("private_titles", "readonly").objectStore("private_titles").get(titleId);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    repo.close();
    const reopened = await IndexedDbMemoryRepository.open();
    const rejectedCount = await reopened.countRejectedSyncOperations(owner.id);
    reopened.close();
    return { cursorAfterWrite, cursorAfterResolution, version: versions[0][1], rejectedCount, pendingAfterDelete, conflictsAfterDelete, deleted: Boolean(deletedTitle?.deletedAt) };
  });
  expect(result).toEqual({ cursorAfterWrite: 7, cursorAfterResolution: 7, version: 1, rejectedCount: 1, pendingAfterDelete: 0, conflictsAfterDelete: 0, deleted: true });
});
