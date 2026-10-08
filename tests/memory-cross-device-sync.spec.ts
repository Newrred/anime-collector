import { expect, test, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = `account:${USER_ID}`;
const ANIME_ID = "anime:11111111-1111-4111-8111-000000154587";
const NOW = "2026-10-09T00:00:00.000Z";

type RemoteEntity = Record<string, any> & { entityType: string; id: string; version: number };

function sharedAccountGateway() {
  const rows = new Map<string, RemoteEntity>();
  const changes: any[] = [];
  const responses = new Map<string, any>();
  const offlineDevices = new Set<string>();
  const calls: any[] = [];
  const key = (entityType: string, id: string) => `${entityType}:${id}`;

  async function call(deviceId: string, action: string, input: any) {
    if (offlineDevices.has(deviceId)) throw new Error("Synthetic network outage");
    if (action === "apply") {
      calls.push({ action, deviceId, operationId: input.operationId, entityType: input.entityType, operationType: input.operationType });
      if (responses.has(input.operationId)) return structuredClone(responses.get(input.operationId));
      const entityKey = key(input.entityType, input.entityId);
      const previous = rows.get(entityKey);
      if (input.baseVersion !== (previous?.version || 0)) {
        return { status: "CONFLICT", entityVersion: previous?.version || 0, syncSeq: null,
          errorCode: "VERSION_CONFLICT", remoteEntity: structuredClone(previous || null) };
      }
      const version = (previous?.version || 0) + 1;
      const row = { ...structuredClone(input.payload), entityType: input.entityType, userId: USER_ID,
        version, serverUpdatedAt: NOW };
      rows.set(entityKey, row);
      const syncSeq = changes.length + 1;
      changes.push({ syncSeq, entityType: input.entityType, entityId: input.entityId,
        operationType: input.operationType, entityVersion: version, changedAt: NOW });
      const response = { status: "APPLIED", entityVersion: version, syncSeq, errorCode: null, remoteEntity: null };
      responses.set(input.operationId, response);
      return structuredClone(response);
    }
    if (action === "pull") {
      const page = changes.filter((change) => change.syncSeq > input.afterSeq).slice(0, input.limit);
      return { changes: structuredClone(page), nextSyncSeq: page.at(-1)?.syncSeq || input.afterSeq,
        minimumRetainedSyncSeq: 0, requiresFullResync: false };
    }
    if (action === "read") return structuredClone(rows.get(key(input.entityType, input.entityIds[0])) ? [rows.get(key(input.entityType, input.entityIds[0]))] : []);
    if (action === "readAll") return structuredClone([...rows.values()].filter((row) => row.entityType === input.entityType));
    throw new Error(`Unexpected gateway action: ${action}`);
  }

  return { call, offlineDevices, rows, calls };
}

async function attachDevice(page: Page, gateway: ReturnType<typeof sharedAccountGateway>, deviceId: string) {
  await page.exposeFunction("__testAccountGateway", (action: string, input: any) => gateway.call(deviceId, action, input));
  await page.goto("/favicon.svg");
  const initialize = async () => page.evaluate(async ({ userId, ownerId, id, now }) => {
    const { IndexedDbMemoryRepository } = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const { writeDeviceSyncState } = await import("/src/features/memory/adapters/indexeddb/memorySyncStore.js");
    const { createMemoryMetadataSync } = await import("/src/features/memory/application/syncMemoryMetadata.js");
    const repository = await IndexedDbMemoryRepository.open();
    const installation = await repository.ensureInstallationIdentity({ uuid: crypto.randomUUID(), now });
    await repository.ensureAccountOwner({ userId, now });
    await repository.activateOwner({ ownerId, now });
    if (!await repository.readDeviceSyncState(ownerId)) {
      await writeDeviceSyncState(repository.database, { ownerId, userId, installationId: installation.installationId,
        deviceId: id, lastSyncSeq: 0, updatedAt: now });
    }
    const remote = (action: string, input: any) => (window as any).__testAccountGateway(action, input);
    const gateway = {
      applyCardMutation: (input: any) => remote("apply", input),
      applyBoardMutation: (input: any) => remote("apply", input),
      pullChanges: (input: any) => remote("pull", input),
      readEntities: (input: any) => remote("read", input),
      readAllEntities: (input: any) => remote("readAll", input),
    };
    (window as any).__testDevice = {
      repository,
      sync: createMemoryMetadataSync({ repository, gateway, clock: { now: () => now } }),
      ownerId,
      userId,
      deviceId: id,
    };
  }, { userId: USER_ID, ownerId: OWNER_ID, id: deviceId, now: NOW });
  await initialize();
  return initialize;
}

async function syncDevice(page: Page) {
  return page.evaluate(async () => {
    const device = (window as any).__testDevice;
    return device.sync.syncNow({ ownerId: device.ownerId, userId: device.userId, deviceId: device.deviceId });
  });
}

async function archiveState(page: Page, cardId: string) {
  return page.evaluate(async (id) => {
    const { repository, ownerId } = (window as any).__testDevice;
    const archive = await repository.listArchive(ownerId);
    const bundle = await repository.getCardBundle(ownerId, id);
    const cursor = (await repository.readDeviceSyncState(ownerId)).lastSyncSeq;
    return { count: archive.length, note: bundle?.card.note ?? null,
      imageType: bundle?.asset.imageType ?? null, cardId: bundle?.card.id ?? null,
      pending: await repository.countPendingSyncOperations(ownerId), cursor };
  }, cardId);
}

test("two isolated devices converge after edit, offline retry, and delete", async ({ browser, baseURL }) => {
  const gateway = sharedAccountGateway();
  const first = await browser.newContext({ baseURL });
  const second = await browser.newContext({ baseURL });
  try {
    const phone = await first.newPage();
    const desktop = await second.newPage();
    const phoneId = "22222222-2222-4222-8222-222222222222";
    const desktopId = "33333333-3333-4333-8333-333333333333";
    const restorePhone = await attachDevice(phone, gateway, phoneId);
    await attachDevice(desktop, gateway, desktopId);

    const cardId = await phone.evaluate(async ({ animeId, now }) => {
      const { createMemoryCardCommand } = await import("/src/features/memory/application/createMemoryCard.js");
      const { repository, ownerId } = (window as any).__testDevice;
      const command = createMemoryCardCommand({ repository, localMedia: {}, telemetry: { track: () => {} },
        clock: { now: () => now }, ids: { next: () => crypto.randomUUID() } });
      const result = await command.execute({ operationId: crypto.randomUUID(), ownerId,
        titleChoice: { kind: "ANIME_REF", animeId, displayTitle: "Synthetic approved cover",
          sourceBinding: null, verificationState: "PROVIDER_CANDIDATE" },
        catalogCoverRef: { sourceKind: "CATALOG_COVER", catalogAnimeId: animeId,
          catalogCoverId: animeId.replace("anime:", "cover:"),
          catalogCoverRevisionId: `asset:${"a".repeat(40)}`, rightsBasis: "EXPLICIT_PERMISSION",
          permissionVerifiedAt: now }, note: "First thought" });
      return result.cardId;
    }, { animeId: ANIME_ID, now: NOW });

    expect((await archiveState(phone, cardId)).count).toBe(1);
    expect((await archiveState(desktop, cardId)).count).toBe(0);
    expect((await syncDevice(phone)).status).toBe("SYNCED");
    expect((await syncDevice(desktop)).status).toBe("SYNCED");
    expect(await archiveState(desktop, cardId)).toMatchObject({ count: 1, note: "First thought", imageType: "CATALOG_COVER", cardId });

    await phone.evaluate(async (id) => {
      const { createUpdateMemoryCardCommand } = await import("/src/features/memory/application/updateMemoryCard.js");
      const { repository, ownerId } = (window as any).__testDevice;
      await createUpdateMemoryCardCommand({ repository, telemetry: { track: () => {} },
        clock: { now: () => new Date().toISOString() }, ids: { next: () => crypto.randomUUID() } })
        .execute({ ownerId, cardId: id, note: "Changed on phone" });
    }, cardId);
    expect(await archiveState(phone, cardId)).toMatchObject({ note: "Changed on phone", pending: 1 });

    gateway.offlineDevices.add(phoneId);
    expect((await syncDevice(phone)).status).toBe("ERROR");
    expect(await archiveState(desktop, cardId)).toMatchObject({ note: "First thought" });
    await phone.reload();
    await restorePhone();
    expect(await archiveState(phone, cardId)).toMatchObject({ note: "Changed on phone", pending: 1 });
    gateway.offlineDevices.delete(phoneId);
    expect((await syncDevice(phone)).status).toBe("SYNCED");
    expect((await syncDevice(desktop)).status).toBe("SYNCED");
    expect(await archiveState(desktop, cardId)).toMatchObject({ note: "Changed on phone", pending: 0 });

    await desktop.evaluate(async (id) => {
      const { createDeleteMemoryCardCommand } = await import("/src/features/memory/application/deleteMemoryCard.js");
      const { repository, ownerId } = (window as any).__testDevice;
      await createDeleteMemoryCardCommand({ repository, localMedia: { deleteAsset: async () => true },
        telemetry: { track: () => {} }, clock: { now: () => new Date().toISOString() },
        ids: { next: () => crypto.randomUUID() } }).execute({ ownerId, cardId: id, operationId: crypto.randomUUID() });
    }, cardId);
    expect(await archiveState(desktop, cardId)).toMatchObject({ count: 0, cardId: null, pending: 2 });
    expect((await syncDevice(desktop)).status).toBe("SYNCED");
    expect((await syncDevice(phone)).status).toBe("SYNCED");
    expect(await archiveState(phone, cardId)).toMatchObject({ count: 0, cardId: null, pending: 0 });
    expect(gateway.rows.get(`MEMORY_CARD:${cardId}`)).toMatchObject({ status: "DELETED" });
    expect(gateway.calls.filter((call) => call.deviceId === phoneId && call.operationType === "UPSERT"
      && call.entityType === "MEMORY_CARD")).toHaveLength(3);
  } finally {
    await first.close();
    await second.close();
  }
});
