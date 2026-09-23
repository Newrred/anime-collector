import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("ui:locale:v1", JSON.stringify("en")));
});

test("private title accepts a second memory through its hub and archive search persists", async ({page}) => {
  await page.goto("/memory/new/");
  await page.getByRole("button", {name: "Use system design"}).click();
  await page.getByLabel("Anime or card title").fill("Review private title");
  await page.getByLabel("Short reflection").fill("First reflection");
  await page.getByRole("button", {name: "Save card", exact: true}).click();
  await expect(page).toHaveURL(/\/archive\//);
  await page.getByRole("heading", {name: "Review private title"}).click();
  await page.locator('a[href*="title/?privateTitleId"]').click();
  await page.locator('.title-hub__actions').getByRole("link", {name: "Add Memory"}).click();
  await expect(page).toHaveURL(/privateTitleId=/);
  await expect(page.getByText("Existing private title", {exact: true})).toBeVisible();
  await page.getByRole("button", {name: "Use system design"}).click();
  await page.getByLabel("Short reflection").fill("Second reflection");
  await page.getByRole("button", {name: "Save card", exact: true}).click();
  await expect(page.locator('.memory-archive__card')).toHaveCount(2);
  const ids = await page.evaluate(async () => {
    const {getPlatformMemoryRuntime} = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    return (await (await getPlatformMemoryRuntime()).listArchive()).map(b => b.card.privateTitleId);
  });
  expect(new Set(ids).size).toBe(1);
  await page.getByLabel("Find memories").fill("Second");
  await expect(page.locator('.memory-archive__card')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel("Find memories")).toHaveValue("Second");
  await expect(page.locator('.memory-archive__card')).toHaveCount(1);
});

test("memory metadata backup restores in a new browser with exact relationships and blocks overwrite", async ({page, browser}) => {
  await page.goto('/favicon.svg');
  const snapshot = await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    const design = {version: 1, templateId: 'memory-gradient', paletteId: 'violet-dawn', patternSeed: 'review', titleLayout: 'BOTTOM_LEFT', genreTokens: []};
    const first = await runtime.createCard({titleChoice: {kind: 'PRIVATE_TITLE', displayTitle: 'Backup title'}, systemDesignSpec: design, note: 'One'});
    const second = await runtime.createCard({titleChoice: {kind: 'PRIVATE_TITLE', privateTitleId: first.privateTitleId}, systemDesignSpec: design, note: 'Two'});
    const board = await runtime.createBoard({title: 'Backup Board'});
    await runtime.addCardToBoard(board.id, first.cardId);
    await runtime.addCardToBoard(board.id, second.cardId);
    return runtime.exportMemoryBackup();
  });
  const clean = await browser.newContext();
  const target = await clean.newPage();
  await target.goto(new URL('/favicon.svg', page.url()).href);
  const result = await target.evaluate(async (backup) => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    const corrupt = structuredClone(backup); corrupt.data.memory_cards[0].visualAssetId = 'missing';
    let corruptRejected = false;
    try { await runtime.restoreMemoryBackup(corrupt); } catch { corruptRejected = true; }
    const before = (await runtime.listArchive()).length;
    const originalAdd = IDBObjectStore.prototype.add;
    let inserts = 0, aborted = false;
    IDBObjectStore.prototype.add = function (...args) {
      if (++inserts === 2) throw new DOMException('Injected storage failure', 'QuotaExceededError');
      return originalAdd.apply(this, args);
    };
    try { await runtime.restoreMemoryBackup(backup); } catch { aborted = true; }
    finally { IDBObjectStore.prototype.add = originalAdd; }
    const afterAbort = (await runtime.listArchive()).length;
    // Synced assets carry a cardId; both sides must be remapped on a new device.
    for (const card of backup.data.memory_cards) backup.data.visual_assets.find(asset => asset.id === card.visualAssetId).cardId = card.id;
    const restored = await runtime.restoreMemoryBackup(backup);
    let overwriteRejected = false;
    try { await runtime.restoreMemoryBackup(backup); } catch (e) { overwriteRejected = e.code === 'BACKUP_REQUIRES_EMPTY_ARCHIVE'; }
    const archive = await runtime.listArchive(); const boards = await runtime.listBoards();
    const board = await runtime.getBoard(boards[0].id);
    return {corruptRejected, before, aborted, afterAbort, restored, overwriteRejected, notes: archive.map(b => b.card.note).sort(), titles: new Set(archive.map(b => b.card.privateTitleId)).size, links: board.items.length, assetLinks: archive.every(b => b.asset.cardId === b.card.id)};
  }, snapshot);
  expect(result).toEqual({corruptRejected: true, before: 0, aborted: true, afterAbort: 0, restored: {cards: 2, boards: 1}, overwriteRejected: true, notes: ['One', 'Two'], titles: 1, links: 2, assetLinks: true});
  await clean.close();
});

test("catalog-only title tracking and backup preserve unrated, zero and stored state", async ({page, browser}) => {
  await page.goto('/favicon.svg');
  const backup = await page.evaluate(async () => {
    const {writeTitleLibrary, readTitleLibrary} = await import('/src/repositories/titleLibraryRepo.js');
    const {createTitleHubService} = await import('/src/features/titles/application/titleHubService.js');
    const {exportCatalogTitleBackup} = await import('/src/repositories/catalogTitleBackup.js');
    const id = 'anime:11111111-1111-4111-8111-000000000009';
    await writeTitleLibrary([{catalogAnimeId: id, anilistId: null, koTitle: 'Catalog-only review', status: '미분류', score: null}]);
    const service = createTitleHubService();
    const album = {titleRef: {kind: 'ANIME', animeId: id}, tracking: {isSaved: true}, anilistId: null};
    await service.updateTracking(album, {watchStatus: '완료', rating: 0});
    const zero = (await readTitleLibrary())[0].score;
    await service.updateTracking(album, {watchStatus: '보는중', rating: ''});
    return {zero, snapshot: await exportCatalogTitleBackup()};
  });
  expect(backup.zero).toBe(0);
  const clean = await browser.newContext(); const target = await clean.newPage();
  await target.goto(new URL('/favicon.svg', page.url()).href);
  const restored = await target.evaluate(async (snapshot) => {
    const {restoreCatalogTitleBackup} = await import('/src/repositories/catalogTitleBackup.js');
    const {readTitleLibrary} = await import('/src/repositories/titleLibraryRepo.js');
    await restoreCatalogTitleBackup(snapshot);
    let rejected = false; try { await restoreCatalogTitleBackup(snapshot); } catch { rejected = true; }
    return {rows: await readTitleLibrary(), rejected};
  }, backup.snapshot);
  expect(restored.rejected).toBe(true);
  expect(restored.rows).toHaveLength(1);
  expect(restored.rows[0]).toMatchObject({status: '보는중', score: null, koTitle: 'Catalog-only review'});
  await clean.close();
});

test("cover note rejection is atomic in IndexedDB, including direct repository writes", async ({page}) => {
  await page.goto('/favicon.svg');
  const result = await page.evaluate(async () => {
    const {getPlatformMemoryRuntime} = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const {IndexedDbMemoryRepository} = await import('/src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js');
    const runtime = await getPlatformMemoryRuntime(); const owner = await runtime.initialize();
    const animeId = 'anime:11111111-1111-4111-8111-000000154587';
    const saved = await runtime.createCard({titleChoice: {kind: 'ANIME_REF', animeId, displayTitle: 'Cover test', sourceBinding: {provider: 'ANILIST', externalId: '154587'}, verificationState: 'PROVIDER_CANDIDATE'}, note: 'Keep this',
      catalogCoverRef: {sourceKind: 'CATALOG_COVER', catalogAnimeId: animeId, catalogCoverId: 'cover:11111111-1111-4111-8111-000000154587', catalogCoverRevisionId: `asset:${'a'.repeat(40)}`, rightsBasis: 'EXPLICIT_PERMISSION', permissionVerifiedAt: '2026-09-03T00:00:00.000Z'}});
    const repo = await IndexedDbMemoryRepository.open();
    const codes = [];
    for (const action of [() => runtime.updateCard(saved.cardId, {note: ''}), () => repo.updateCardMetadata({ownerId: owner.id, cardId: saved.cardId, changes: {note: ''}, now: new Date().toISOString()})]) {
      try { await action(); } catch (e) { codes.push(e.code); }
    }
    return {codes, note: (await runtime.getCard(saved.cardId)).card.note};
  });
  expect(result.codes).toEqual(['CATALOG_COVER_PERSONAL_SIGNAL_REQUIRED', 'CATALOG_COVER_PERSONAL_SIGNAL_REQUIRED']);
  expect(result.note).toBe('Keep this');
});
