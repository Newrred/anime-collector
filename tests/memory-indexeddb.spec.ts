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
    repository.close();

    const reopened = await repositoryModule.IndexedDbMemoryRepository.open();
    const sameOwner = await reopened.ensureGuestOwner({
      uuid: "22222222-2222-4222-8222-222222222222",
      now: "2026-08-12T02:00:00.000Z",
    });
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
  expect(result.animeRefBundle.title.sourceKey).toBe("ANILIST:154587");
  expect(result.animeRefBundle.title.coverImage).toBeUndefined();
  expect(result.archive.every(({ asset }) => asset.state === "READY")).toBe(true);
  expect(result.recovery).toEqual({ recovered: 1, failed: 0 });
  expect(result.otherArchive).toEqual([]);
  expect(result.stores).toEqual([
    "anime_refs",
    "media_operations",
    "memory_cards",
    "meta",
    "owners",
    "private_titles",
    "visual_assets",
  ]);
  expect(result.legacyMarker).toBe("unchanged");
});
