import { expect, test } from "@playwright/test";

test("memory database survives reopen and does not mutate the legacy database", async ({ page }) => {
  // A static same-origin asset establishes IndexedDB access without mounting either app runtime.
  await page.goto("/favicon.svg");

  const result = await page.evaluate(async () => {
    const memoryDb = await import("/src/features/memory/adapters/indexeddb/memoryDb.js");
    const repositoryModule = await import(
      "/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js"
    );
    const commandModule = await import("/src/features/memory/application/createMemoryCard.js");
    const reconcileModule = await import(
      "/src/features/memory/application/reconcileMemoryOperations.js"
    );

    const deleteDatabase = (name: string) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error(`blocked delete: ${name}`));
    });
    const writeLegacyMarker = () => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("anime-collector-db", 99);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("codex_memory_guard")) {
          request.result.createObjectStore("codex_memory_guard", { keyPath: "id" });
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("codex_memory_guard", "readwrite");
        transaction.objectStore("codex_memory_guard").put({ id: "marker", value: "unchanged" });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    const readLegacyMarker = () => new Promise<string|null>((resolve, reject) => {
      const request = indexedDB.open("anime-collector-db");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("codex_memory_guard", "readonly");
        const get = transaction.objectStore("codex_memory_guard").get("marker");
        get.onsuccess = () => resolve(get.result?.value || null);
        get.onerror = () => reject(get.error);
        transaction.oncomplete = () => database.close();
      };
    });

    await deleteDatabase(memoryDb.MEMORY_DB_NAME);
    await deleteDatabase("anime-collector-db");
    await writeLegacyMarker();

    const repository = await repositoryModule.IndexedDbMemoryRepository.open();
    const owner = await repository.ensureGuestOwner({
      uuid: "11111111-1111-4111-8111-111111111111",
      now: "2026-08-12T00:00:00.000Z",
    });
    const command = commandModule.createMemoryCardCommand({
      repository,
      localMedia: {
        promoteTicket: async () => ({
          localRef: "asset:asset-1",
          checksumSha256: "a".repeat(64),
          mimeType: "image/png",
          byteSize: 2048,
          width: 1200,
          height: 675,
        }),
      },
      telemetry: { track: () => {} },
      clock: { now: () => "2026-08-12T01:00:00.000Z" },
      ids: { next: (kind: string) => ({ card: "card-1", asset: "asset-1", privateTitle: "title-1" })[kind] },
    });
    await command.execute({
      operationId: "operation-1",
      ownerId: owner.id,
      titleChoice: { kind: "PRIVATE_TITLE", displayTitle: "Frieren" },
      intakeTicketId: "ticket-1",
      note: "private note",
      rightsConfirmed: true,
    });
    const catalogCommand = commandModule.createMemoryCardCommand({
      repository,
      localMedia: { promoteTicket: async () => { throw new Error("system design must not import media"); } },
      telemetry: { track: () => {} },
      clock: { now: () => "2026-08-12T01:15:00.000Z" },
      ids: { next: (kind: string) => ({
        card: "card-catalog",
        asset: "asset-catalog",
        animeRef: "anime-ref-catalog",
      })[kind] },
    });
    await catalogCommand.execute({
      operationId: "operation-catalog",
      ownerId: owner.id,
      titleChoice: {
        kind: "ANIME_REF",
        animeId: "anime:11111111-1111-4111-8111-000000154587",
        displayTitle: "Frieren: Beyond Journey's End",
        aliases: ["Sousou no Frieren"],
        genres: ["Adventure", "Fantasy"],
        sourceBinding: { provider: "ANILIST", externalId: "154587" },
        verificationState: "PROVIDER_CANDIDATE",
      },
      systemDesignSpec: {
        version: 1,
        templateId: "memory-gradient",
        paletteId: "violet-dawn",
        patternSeed: "catalog-seed",
        titleLayout: "BOTTOM_LEFT",
        genreTokens: ["Adventure", "Fantasy"],
      },
    });
    await repository.reserveCreate({
      title: {
        id: "title-2",
        ownerId: owner.id,
        displayTitle: "Violet Evergarden",
        normalizedTitle: "violet evergarden",
        optionalGenres: [],
        createdAt: "2026-08-12T01:30:00.000Z",
        updatedAt: "2026-08-12T01:30:00.000Z",
      },
      card: {
        id: "card-2",
        ownerId: owner.id,
        animeRefId: null,
        privateTitleId: "title-2",
        visualAssetId: "asset-2",
        status: "DRAFT",
        note: null,
        createdAt: "2026-08-12T01:30:00.000Z",
        updatedAt: "2026-08-12T01:30:00.000Z",
      },
      asset: {
        id: "asset-2",
        ownerId: owner.id,
        state: "IMPORTING",
        storageScope: "LOCAL_ONLY",
        visibility: "PRIVATE",
        createdAt: "2026-08-12T01:30:00.000Z",
        updatedAt: "2026-08-12T01:30:00.000Z",
      },
      operation: {
        id: "operation-2",
        ownerId: owner.id,
        cardId: "card-2",
        assetId: "asset-2",
        kind: "IMPORT",
        state: "PLANNED",
        attemptCount: 1,
        intakeTicketId: "ticket-2",
        createdAt: "2026-08-12T01:30:00.000Z",
        updatedAt: "2026-08-12T01:30:00.000Z",
      },
    });
    const accountOwner = await repository.ensureAccountOwner({
      userId: "33333333-3333-4333-8333-333333333333",
      now: "2026-08-12T01:45:00.000Z",
    });
    await repository.activateOwner({
      ownerId: accountOwner.id,
      now: "2026-08-12T01:45:00.000Z",
    });
    repository.close();

    const reopened = await repositoryModule.IndexedDbMemoryRepository.open();
    const sameOwner = await reopened.ensureGuestOwner({
      uuid: "22222222-2222-4222-8222-222222222222",
      now: "2026-08-12T02:00:00.000Z",
    });
    const activeOwner = await reopened.getActiveOwner();
    const recovery = await reconcileModule.createMemoryOperationReconciler({
      repository: reopened,
      localMedia: {
        promoteTicket: async () => ({
          localRef: "asset:asset-2",
          checksumSha256: "b".repeat(64),
          mimeType: "image/jpeg",
          byteSize: 4096,
          width: 1000,
          height: 1000,
        }),
      },
      clock: { now: () => "2026-08-12T02:30:00.000Z" },
    }).execute(owner.id);
    const archive = await reopened.listArchive(owner.id);
    const otherArchive = await reopened.listArchive(
      "guest:22222222-2222-4222-8222-222222222222",
    );
    const stores = [...reopened.database.objectStoreNames];
    reopened.close();

    const animeRefBundle = archive.find(({ card }) => card.id === "card-catalog");
    return {
      ownerId: owner.id,
      sameOwnerId: sameOwner.id,
      activeOwnerId: activeOwner?.id || null,
      archive,
      otherArchive,
      stores,
      recovery,
      animeRefBundle,
      legacyMarker: await readLegacyMarker(),
    };
  });

  expect(result.ownerId).toBe("guest:11111111-1111-4111-8111-111111111111");
  expect(result.sameOwnerId).toBe(result.ownerId);
  expect(result.activeOwnerId).toBe(
    "account:33333333-3333-4333-8333-333333333333",
  );
  expect(result.archive).toHaveLength(3);
  expect(result.archive.every(({ card }) => card.status === "COMPLETE_PRIVATE")).toBe(true);
  expect(result.archive.map(({ title }) => title.displayTitle).sort()).toEqual([
    "Frieren",
    "Frieren: Beyond Journey's End",
    "Violet Evergarden",
  ]);
  expect(result.animeRefBundle.card.privateTitleId).toBeNull();
  expect(result.animeRefBundle.card.animeRefId).toBe("anime-ref-catalog");
  expect(result.animeRefBundle.title.verificationState).toBe("PROVIDER_CANDIDATE");
  expect(result.animeRefBundle.title.catalogAnimeId).toBe(
    "anime:11111111-1111-4111-8111-000000154587",
  );
  expect(result.animeRefBundle.title.sourceKey).toBe("ANILIST:154587");
  expect(result.animeRefBundle.title.coverImage).toBeUndefined();
  expect(result.archive.every(({ asset }) => asset.state === "READY")).toBe(true);
  expect(result.recovery).toEqual({ recovered: 1, failed: 0 });
  expect(result.otherArchive).toEqual([]);
  expect(result.stores).toEqual([
    "account_promotions",
    "anime_refs",
    "device_sync_state",
    "media_operations",
    "memory_board_cards",
    "memory_boards",
    "memory_cards",
    "meta",
    "owners",
    "private_titles",
    "sync_conflicts",
    "sync_outbox",
    "visual_assets",
  ]);
  expect(result.legacyMarker).toBe("unchanged");
});

test("Guest promotion keeps local image refs while atomically moving every owner-scoped row", async ({ page }) => {
  await page.goto("/favicon.svg");
  const result = await page.evaluate(async () => {
    const memoryDb = await import("/src/features/memory/adapters/indexeddb/memoryDb.js");
    const repositoryModule = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const createModule = await import("/src/features/memory/application/createMemoryCard.js");
    const manifestModule = await import("/src/features/memory/application/buildGuestPromotionManifest.js");
    const syncStore = await import("/src/features/memory/adapters/indexeddb/memorySyncStore.js");
    const deleteDatabase = (name: string) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error(`blocked delete: ${name}`));
    });
    const requestValue = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const now = "2026-09-02T03:00:00.000Z";
    const userId = "11111111-1111-4111-8111-111111111111";
    const guestUuid = "22222222-2222-4222-8222-222222222222";
    const deviceId = "33333333-3333-4333-8333-333333333333";
    const promotionId = "44444444-4444-4444-8444-444444444444";
    const nextGuestUuid = "55555555-5555-4555-8555-555555555555";
    const catalogId = "anime:66666666-6666-4666-8666-666666666666";
    await deleteDatabase(memoryDb.MEMORY_DB_NAME);
    const repository = await repositoryModule.IndexedDbMemoryRepository.open();
    const identity = await repository.ensureInstallationIdentity({ uuid: guestUuid, now });
    const guestOwnerId = identity.guestOwner.id;
    const account = await repository.ensureAccountOwner({ userId, now });
    await syncStore.writeDeviceSyncState(repository.database, {
      ownerId: account.id, userId, installationId: identity.installationId,
      deviceId, lastSyncSeq: 0, updatedAt: now,
    });

    const createCard = async ({ cardId, assetId, animeRefId, operationId, externalId, title }: any) => {
      const command = createModule.createMemoryCardCommand({
        repository,
        localMedia: {
          promoteTicket: async () => ({
            localRef: `asset:${assetId}`, checksumSha256: assetId[0].repeat(64),
            mimeType: "image/png", byteSize: 2048, width: 800, height: 1000,
          }),
        },
        telemetry: { track: () => {} },
        clock: { now: () => now },
        ids: { next: (kind: string) => ({ card: cardId, asset: assetId, animeRef: animeRefId })[kind] },
      });
      await command.execute({
        operationId, ownerId: guestOwnerId, intakeTicketId: `ticket-${externalId}`,
        rightsConfirmed: true,
        titleChoice: {
          kind: "ANIME_REF", displayTitle: title, aliases: [], genres: ["Action"],
          sourceBinding: { provider: "ANILIST", externalId }, verificationState: "PROVIDER_CANDIDATE",
        },
      });
    };
    const first = {
      cardId: "77777777-7777-4777-8777-777777777777",
      assetId: "88888888-8888-4888-8888-888888888888",
      animeRefId: "99999999-9999-4999-8999-999999999999",
      operationId: "create-first", externalId: "20", title: "Naruto",
    };
    const second = {
      cardId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      animeRefId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      operationId: "create-second", externalId: "154587", title: "Frieren",
    };
    await createCard(first);
    await createCard(second);
    await repository.resolvePromotionTitleChoice({
      guestOwnerId, animeRefId: first.animeRefId,
      choice: { kind: "CATALOG", catalogAnimeId: catalogId }, now,
    });
    await repository.resolvePromotionTitleChoice({
      guestOwnerId, animeRefId: second.animeRefId,
      choice: { kind: "KEEP_PRIVATE" }, now,
    });
    const boardId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    await repository.createBoard({ id: boardId, ownerId: guestOwnerId, title: "Favorites", description: "", createdAt: now });
    await repository.addCardToBoard({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", ownerId: guestOwnerId,
      boardOwnerId: guestOwnerId, cardOwnerId: guestOwnerId, boardId, cardId: first.cardId,
      positionKey: "h".repeat(24), createdAt: now,
    });

    const manifest = await manifestModule.buildGuestPromotionManifest({ repository, guestOwnerId });
    const journal = await repository.beginPromotionJournal({
      operationId: promotionId, userId, accountOwnerId: account.id, guestOwnerId,
      deviceId, sourceHash: manifest.sourceHash, startedAt: now,
    });
    const remoteResult = { status: "COMPLETED", importedCounts: manifest.counts, nextSyncSeq: 11 };
    await repository.markPromotionRemoteCompleted({
      operationId: promotionId, sourceHash: manifest.sourceHash, result: remoteResult, now,
    });
    await repository.commitPromotionToAccount({
      operationId: promotionId, userId, accountOwnerId: account.id, guestOwnerId,
      deviceId, sourceHash: manifest.sourceHash, result: remoteResult, newGuestUuid: nextGuestUuid, now,
    });

    const stores = ["private_titles", "memory_cards", "visual_assets", "media_operations", "memory_boards", "memory_board_cards"];
    const transaction = repository.database.transaction([...stores, "account_promotions", "device_sync_state"], "readonly");
    const rows = Object.fromEntries(await Promise.all(stores.map(async (storeName) => [
      storeName,
      await requestValue(transaction.objectStore(storeName).getAll()),
    ])));
    const completedJournal = await requestValue(transaction.objectStore("account_promotions").get(promotionId));
    const device = await requestValue(transaction.objectStore("device_sync_state").get(account.id));
    const activeOwner = await repository.getActiveOwner();
    const nextIdentity = await repository.ensureInstallationIdentity({ uuid: "ffffffff-ffff-4fff-8fff-ffffffffffff", now });
    repository.close();
    return {
      journalStarted: journal.status,
      counts: manifest.counts,
      remoteHasLocalRef: JSON.stringify(manifest.remoteBundle).includes("localRef"),
      allMoved: Object.values(rows).flat().every((row: any) => row.ownerId === account.id),
      localRefs: rows.visual_assets.map((row: any) => row.localRef).sort(),
      completedStatus: completedJournal.status,
      activeOwnerId: activeOwner.id,
      nextGuestOwnerId: nextIdentity.guestOwner.id,
      lastSyncSeq: device.lastSyncSeq,
    };
  });

  expect(result.journalStarted).toBe("STARTED");
  expect(result.counts).toEqual({ privateTitles: 1, cards: 2, visualAssets: 2, boards: 1, boardCards: 1 });
  expect(result.remoteHasLocalRef).toBe(false);
  expect(result.allMoved).toBe(true);
  expect(result.localRefs).toEqual([
    "asset:88888888-8888-4888-8888-888888888888",
    "asset:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ]);
  expect(result.completedStatus).toBe("COMPLETED");
  expect(result.activeOwnerId).toBe("account:11111111-1111-4111-8111-111111111111");
  expect(result.nextGuestOwnerId).toBe("guest:55555555-5555-4555-8555-555555555555");
  expect(result.lastSyncSeq).toBe(11);
});

test("sync conflict keeps the local row until an explicit cloud selection commits with a backup", async ({ page }) => {
  await page.goto("/favicon.svg");
  const result = await page.evaluate(async () => {
    const memoryDb = await import("/src/features/memory/adapters/indexeddb/memoryDb.js");
    const repositoryModule = await import("/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js");
    const syncStore = await import("/src/features/memory/adapters/indexeddb/memorySyncStore.js");
    const remove = () => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(memoryDb.MEMORY_DB_NAME);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
    });
    await remove();
    const repository = await repositoryModule.IndexedDbMemoryRepository.open();
    const now = "2026-09-02T05:00:00.000Z";
    const userId = "11111111-1111-4111-8111-111111111111";
    const owner = await repository.ensureAccountOwner({ userId, now });
    await repository.activateOwner({ ownerId: owner.id, now });
    await syncStore.writeDeviceSyncState(repository.database, {
      ownerId: owner.id, userId, installationId: "22222222-2222-4222-8222-222222222222",
      deviceId: "33333333-3333-4333-8333-333333333333", lastSyncSeq: 0, updatedAt: now,
    });
    const cardId = "44444444-4444-4444-8444-444444444444";
    const transaction = repository.database.transaction("memory_cards", "readwrite");
    transaction.objectStore("memory_cards").put({
      id: cardId, ownerId: owner.id, catalogAnimeId: "anime:55555555-5555-4555-8555-555555555555",
      animeRefId: null, privateTitleId: null, titleSnapshot: "Naruto", visualAssetId: null,
      status: "COMPLETE_PRIVATE", note: "local note", watchedAt: null, watchedAtPrecision: "UNKNOWN",
      episode: null, sceneCue: null, emotionTags: [], rewatchIntent: null,
      createdAt: now, updatedAt: now, deletedAt: null,
      sync: { remoteVersion: 1, syncState: "PENDING", clientUpdatedAt: now, serverUpdatedAt: now, lastOperationId: null },
    });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    const operation = {
      id: "66666666-6666-4666-8666-666666666666", ownerId: owner.id, entityType: "MEMORY_CARD",
      entityId: cardId, operationType: "UPSERT", baseVersion: 1, requestHash: "a".repeat(64),
      payload: { id: cardId, titleSnapshot: "Naruto", note: "local note" }, state: "PENDING", createdAt: now,
    };
    await repository.enqueueMutation(operation);
    const remote = {
      entityType: "MEMORY_CARD", id: cardId, userId, catalogAnimeId: "anime:55555555-5555-4555-8555-555555555555",
      privateTitleId: null, titleSnapshot: "Naruto", status: "COMPLETE_PRIVATE", note: "cloud note",
      watchedAt: null, watchedAtPrecision: "UNKNOWN", episode: null, sceneCue: null, emotionTags: [],
      rewatchIntent: null, visibility: "PRIVATE", version: 2, createdAt: now, clientUpdatedAt: now,
      serverUpdatedAt: now, deletedAt: null,
    };
    await repository.commitSyncMutation({
      ownerId: owner.id, operation,
      result: { status: "CONFLICT", entityVersion: 2, syncSeq: null, errorCode: "BASE_VERSION_MISMATCH", remoteEntity: remote }, now,
    });
    const conflict = (await repository.listOpenSyncConflicts(owner.id))[0];
    const before = await new Promise<any>((resolve, reject) => {
      const tx = repository.database.transaction("memory_cards", "readonly"); const request = tx.objectStore("memory_cards").get(cardId);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    await repository.commitConflictResolution({ ownerId: owner.id, conflictId: conflict.id, selection: "USE_CLOUD", operation: null, result: null, now });
    const afterConflict = await repository.getSyncConflict(owner.id, conflict.id);
    const after = await new Promise<any>((resolve, reject) => {
      const tx = repository.database.transaction("memory_cards", "readonly"); const request = tx.objectStore("memory_cards").get(cardId);
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    repository.close();
    return { beforeNote: before.note, beforeState: before.sync.syncState, afterNote: after.note, afterState: after.sync.syncState, conflictState: afterConflict.state, backupNote: afterConflict.localBackup.note };
  });
  expect(result).toEqual({ beforeNote: "local note", beforeState: "CONFLICT", afterNote: "cloud note", afterState: "SYNCED", conflictState: "RESOLVED", backupNote: "local note" });
});

test("image replacement atomically switches the card and scrubs the previous asset", async ({ page }) => {
  await page.goto("/favicon.svg");

  const result = await page.evaluate(async () => {
    const memoryDb = await import("/src/features/memory/adapters/indexeddb/memoryDb.js");
    const repositoryModule = await import(
      "/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js"
    );
    const createModule = await import("/src/features/memory/application/createMemoryCard.js");
    const replaceModule = await import(
      "/src/features/memory/application/replaceMemoryCardImage.js"
    );
    const deleteDatabase = (name: string) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error(`blocked delete: ${name}`));
    });
    const requestValue = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await deleteDatabase(memoryDb.MEMORY_DB_NAME);
    const repository = await repositoryModule.IndexedDbMemoryRepository.open();
    const owner = await repository.ensureGuestOwner({
      uuid: "11111111-1111-4111-8111-111111111111",
      now: "2026-08-12T00:00:00.000Z",
    });
    const createCommand = createModule.createMemoryCardCommand({
      repository,
      localMedia: {
        promoteTicket: async () => ({
          localRef: "asset:old",
          checksumSha256: "a".repeat(64),
          mimeType: "image/jpeg",
          byteSize: 1024,
          width: 800,
          height: 600,
        }),
      },
      telemetry: { track: () => {} },
      clock: { now: () => "2026-08-12T01:00:00.000Z" },
      ids: { next: (kind: string) => ({
        card: "card-1",
        asset: "asset-old",
        privateTitle: "title-1",
      })[kind] },
    });
    await createCommand.execute({
      operationId: "create-op",
      ownerId: owner.id,
      titleChoice: { kind: "PRIVATE_TITLE", displayTitle: "Frieren" },
      intakeTicketId: "ticket-old",
      note: "keep this note",
      rightsConfirmed: true,
    });
    const original = await repository.getCardBundle(owner.id, "card-1");

    const deletedRefs: string[] = [];
    let concurrentReservationCode: string|null = null;
    const replaceCommand = replaceModule.createReplaceMemoryCardImageCommand({
      repository,
      localMedia: {
        promoteTicket: async () => {
          const concurrentCard = {
            ...original.card,
            note: "edited during image promotion",
            updatedAt: "2026-08-12T01:30:00.000Z",
          };
          await repository.updateCardMetadata({
            ownerId: owner.id,
            cardId: concurrentCard.id,
            changes: { note: concurrentCard.note },
            now: concurrentCard.updatedAt,
          });
          try {
            await repository.reserveReplace({
              card: concurrentCard,
              previousAsset: original.asset,
              replacementAsset: {
                ...original.asset,
                id: "asset-concurrent",
                state: "IMPORTING",
                localRef: null,
                checksumSha256: null,
              },
              operation: {
                id: "replace-op-concurrent",
                ownerId: owner.id,
                assetId: "asset-concurrent",
                previousAssetId: original.asset.id,
                cardId: original.card.id,
                kind: "REPLACE",
                state: "PLANNED",
                attemptCount: 1,
                intakeTicketId: "ticket-concurrent",
                createdAt: "2026-08-12T01:30:00.000Z",
                updatedAt: "2026-08-12T01:30:00.000Z",
              },
            });
          } catch (error) {
            concurrentReservationCode = String(error?.code || "");
          }
          return {
            localRef: "asset:new",
            checksumSha256: "b".repeat(64),
            mimeType: "image/png",
            byteSize: 2048,
            width: 1280,
            height: 720,
          };
        },
        deleteAsset: async ({ localRef }: { localRef: string }) => {
          deletedRefs.push(localRef);
          return true;
        },
      },
      telemetry: { track: () => {} },
      clock: { now: () => "2026-08-12T02:00:00.000Z" },
      ids: { next: () => "asset-new" },
    });
    const replaceResult = await replaceCommand.execute({
      ownerId: owner.id,
      cardId: "card-1",
      intakeTicketId: "ticket-new",
      rightsConfirmed: true,
      operationId: "replace-op",
    });
    const bundleAfterPromotionEdit = await repository.getCardBundle(owner.id, "card-1");
    await repository.updateCardMetadata({
      ownerId: owner.id,
      cardId: original.card.id,
      changes: { note: "late metadata save after replacement" },
      now: "2026-08-12T02:30:00.000Z",
    });
    const bundle = await repository.getCardBundle(owner.id, "card-1");
    const transaction = repository.database.transaction(
      ["visual_assets", "media_operations"],
      "readonly",
    );
    const oldAsset = await requestValue(transaction.objectStore("visual_assets").get("asset-old"));
    const operation = await requestValue(transaction.objectStore("media_operations").get("replace-op"));
    repository.close();
    return {
      replaceResult,
      bundle,
      oldAsset,
      operation,
      deletedRefs,
      concurrentReservationCode,
      bundleAfterPromotionEdit,
    };
  });

  expect(result.replaceResult).toEqual({
    operationId: "replace-op",
    cardId: "card-1",
    visualAssetId: "asset-new",
    previousAssetId: "asset-old",
    cleanupPending: false,
  });
  expect(result.bundle.card.visualAssetId).toBe("asset-new");
  expect(result.bundleAfterPromotionEdit.card.note).toBe("edited during image promotion");
  expect(result.bundleAfterPromotionEdit.card.visualAssetId).toBe("asset-new");
  expect(result.bundle.card.note).toBe("late metadata save after replacement");
  expect(result.bundle.card.visualAssetId).toBe("asset-new");
  expect(result.bundle.asset.state).toBe("READY");
  expect(result.bundle.asset.localRef).toBe("asset:new");
  expect(result.oldAsset.state).toBe("DELETED");
  expect(result.oldAsset.localRef).toBeNull();
  expect(result.oldAsset.checksumSha256).toBeNull();
  expect(result.operation.state).toBe("COMPLETED");
  expect(result.operation.intakeTicketId).toBeNull();
  expect(result.deletedRefs).toEqual(["asset:old"]);
  expect(result.concurrentReservationCode).toBe("OPERATION_IN_PROGRESS");
});

test("replacement cleanup resumes from IndexedDB after restart without promoting again", async ({ page }) => {
  await page.goto("/favicon.svg");

  const result = await page.evaluate(async () => {
    const memoryDb = await import("/src/features/memory/adapters/indexeddb/memoryDb.js");
    const repositoryModule = await import(
      "/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js"
    );
    const createModule = await import("/src/features/memory/application/createMemoryCard.js");
    const replaceModule = await import(
      "/src/features/memory/application/replaceMemoryCardImage.js"
    );
    const reconcileModule = await import(
      "/src/features/memory/application/reconcileMemoryOperations.js"
    );
    const deleteDatabase = (name: string) => new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error(`blocked delete: ${name}`));
    });
    const requestValue = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    await deleteDatabase(memoryDb.MEMORY_DB_NAME);
    const repository = await repositoryModule.IndexedDbMemoryRepository.open();
    const owner = await repository.ensureGuestOwner({
      uuid: "11111111-1111-4111-8111-111111111111",
      now: "2026-08-12T00:00:00.000Z",
    });
    const createCommand = createModule.createMemoryCardCommand({
      repository,
      localMedia: {
        promoteTicket: async () => ({
          localRef: "asset:old",
          checksumSha256: "a".repeat(64),
          mimeType: "image/jpeg",
          byteSize: 1024,
          width: 800,
          height: 600,
        }),
      },
      telemetry: { track: () => {} },
      clock: { now: () => "2026-08-12T01:00:00.000Z" },
      ids: { next: (kind: string) => ({
        card: "card-1",
        asset: "asset-old",
        privateTitle: "title-1",
      })[kind] },
    });
    await createCommand.execute({
      operationId: "create-op",
      ownerId: owner.id,
      titleChoice: { kind: "PRIVATE_TITLE", displayTitle: "Frieren" },
      intakeTicketId: "ticket-old",
      rightsConfirmed: true,
    });
    const replaceCommand = replaceModule.createReplaceMemoryCardImageCommand({
      repository,
      localMedia: {
        promoteTicket: async () => ({
          localRef: "asset:new",
          checksumSha256: "b".repeat(64),
          mimeType: "image/png",
          byteSize: 2048,
          width: 1280,
          height: 720,
        }),
        deleteAsset: async () => {
          throw Object.assign(new Error("private old path"), { code: "MEDIA_DELETE_FAILED" });
        },
      },
      telemetry: { track: () => {} },
      clock: { now: () => "2026-08-12T02:00:00.000Z" },
      ids: { next: () => "asset-new" },
    });
    const pendingResult = await replaceCommand.execute({
      ownerId: owner.id,
      cardId: "card-1",
      intakeTicketId: "ticket-new",
      rightsConfirmed: true,
      operationId: "replace-op",
    });
    repository.close();

    const reopened = await repositoryModule.IndexedDbMemoryRepository.open();
    const mediaCalls: string[] = [];
    const recovery = await reconcileModule.createMemoryOperationReconciler({
      repository: reopened,
      localMedia: {
        promoteTicket: async () => { throw new Error("must not promote committed replacement"); },
        deleteAsset: async ({ localRef }: { localRef: string }) => {
          mediaCalls.push(localRef);
          return true;
        },
      },
      clock: { now: () => "2026-08-12T03:00:00.000Z" },
    }).execute(owner.id);
    const bundle = await reopened.getCardBundle(owner.id, "card-1");
    const transaction = reopened.database.transaction(
      ["visual_assets", "media_operations"],
      "readonly",
    );
    const oldAsset = await requestValue(transaction.objectStore("visual_assets").get("asset-old"));
    const operation = await requestValue(transaction.objectStore("media_operations").get("replace-op"));
    reopened.close();
    return { pendingResult, recovery, bundle, oldAsset, operation, mediaCalls };
  });

  expect(result.pendingResult.cleanupPending).toBe(true);
  expect(result.recovery).toEqual({ recovered: 1, failed: 0 });
  expect(result.bundle.card.visualAssetId).toBe("asset-new");
  expect(result.bundle.asset.localRef).toBe("asset:new");
  expect(result.oldAsset.state).toBe("DELETED");
  expect(result.oldAsset.localRef).toBeNull();
  expect(result.operation.state).toBe("COMPLETED");
  expect(result.operation.result.cleanupPending).toBe(false);
  expect(result.mediaCalls).toEqual(["asset:old"]);
});
