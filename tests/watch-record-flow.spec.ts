import { expect, test, type Page } from "@playwright/test";

const animeId = "anime:11111111-1111-4111-8111-000000000029";
const ownTitle = "자체 작품 감상";
const oldTitle = "기존 애니 감상";
async function prepare(page: Page, saved = true) {
  await page.route("https://**/*", (route) => route.abort());
  await page.addInitScript(({ animeId, ownTitle, oldTitle, saved }) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("ko"));
    if (!localStorage.getItem("watch-fixture-29")) {
      localStorage.setItem("watch-fixture-29", "1");
      localStorage.setItem("anime:list:v1", JSON.stringify([{ anilistId: 3, koTitle: oldTitle, status: "보는중", score: 4.5, rewatchCount: 2, memo: "이전 긴 감상은 지우지 않는다", addedAt: 1 }]));
      localStorage.setItem("moemoa:catalog-saved-titles:v1", JSON.stringify(saved ? [{ catalogAnimeId: animeId, anilistId: null, koTitle: ownTitle, status: "미분류", score: null, rewatchCount: 0, memo: "", addedAt: 2 }] : []));
      localStorage.setItem("anime:watchLogs:v1", JSON.stringify([{ id: "legacy-event-29", anilistId: 3, eventType: "시작", watchedAtPrecision: "year", watchedAtValue: "2024", createdAt: 1, scoreAtThatTime: 4,
        note: "지난 시청 이력", cue: "처음 본 날", contextTags: ["친구와"], characterRefs: [{ characterId: 7, nameSnapshot: "기존 캐릭터", mediaId: 3, isPrimary: true }] }]));
      localStorage.setItem("anime:mediaCache:v1", JSON.stringify({ "3": { ts: Date.now(), media: { id: 3, title: { romaji: oldTitle }, genres: [] } } }));
    }
    const detail = { animeId, sourceBinding: null, preferredTitle: { value: ownTitle }, titles: [], release: {}, studios: [], genres: { core: [], source: [] }, cover: null };
    const runtime = { initialize: async () => {}, listArchive: async () => [] };
    const catalog = { getDetail: async () => detail, getCollectionDetailsByAnimeIds: async () => [detail] };
    let servicePromise;
    const service = () => servicePromise ||= import(`${location.origin}/src/features/titles/application/titleHubService.js`).then(({ createTitleHubService }) => createTitleHubService({ memoryRuntime: runtime, catalogRepository: catalog, titleResolver: {} }));
    window.__MOEMOA_TEST_TITLE_HUB_SERVICE__ = {
      load: async (request) => (await service()).load(request), setSaved: async (album, value) => (await service()).setSaved(album, value),
      saveWatchRecord: async (album, input) => (await service()).saveWatchRecord(album, input),
      editWatchLog: async (album, log, input) => (await service()).editWatchLog(album, log, input),
      deleteWatchLog: async (album, log) => (await service()).deleteWatchLog(album, log),
      updateTitleDetails: async (album, input) => (await service()).updateTitleDetails(album, input),
    };
    window.__MOEMOA_TEST_RECORD_START__ = {
      collection: { load: async () => { const { createTitleCollectionService } = await import(`${location.origin}/src/features/titles/application/titleCollectionService.js`); return createTitleCollectionService({ memoryRuntime: runtime, catalogRepository: catalog }).load(); } },
      resolver: { search: async (query) => { if (query === "실패") return { results: [], remoteStatus: "UNAVAILABLE" }; if (query === "느린") await new Promise(resolve => setTimeout(resolve, 500));
        return { results: query === "새 외부" ? [{ displayTitle: "새 제공처 작품", sourceBinding: { provider: "ANILIST", externalId: "5" }, verificationState: "PROVIDER_CANDIDATE" }]
          : query === "느린" ? [{ ...detail, displayTitle: "오래된 검색 결과", sourceBinding: null }] : [{ ...detail, displayTitle: ownTitle }], remoteStatus: "READY" }; } },
    };
  }, { animeId, ownTitle, oldTitle, saved });
}
const ownHref = () => `/title/?animeId=${encodeURIComponent(animeId)}&tab=watch&record=new`;
const readState = (page: Page) => page.evaluate(async () => {
  const { readTitleLibrary } = await import("/src/repositories/titleLibraryRepo.js");
  const { readAllWatchLogsPreferred } = await import("/src/repositories/watchLogRepo.js");
  return { titles: await readTitleLibrary(), logs: await readAllWatchLogsPreferred() };
});

test("watch flow: old management link reaches the same editable history in Title Hub", async ({ page }) => {
  await prepare(page); await page.goto("/library/?animeId=3&focus=edit");
  await expect(page).toHaveURL(/\/title\/\?anilistId=3&tab=watch$/);
  await expect(page.getByText("처음 본 날", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const editor = page.getByRole("form", { name: "감상 기록 수정" });
  await editor.getByLabel("한줄 감상").fill("수정한 시청 이력");
  await editor.getByRole("button", { name: "수정 저장" }).click();
  const rows = (await readState(page)).logs;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ id: "legacy-event-29", anilistId: 3, cue: "수정한 시청 이력", contextTags: ["친구와"] });
  expect(rows[0].characterRefs[0]).toMatchObject({ characterId: 7, nameSnapshot: "기존 캐릭터" });
  await page.goto("/title/?anilistId=3&tab=watch");
  await expect(page.getByText("수정한 시청 이력", { exact: true })).toBeVisible();
  await page.goto(ownHref().replace("&record=new", ""));
  await expect(page.locator(".title-watch-records__management")).toHaveCount(0);
});

test("watch flow: edit and delete the same legacy log in title detail, preserving season and metadata", async ({ page }) => {
  await prepare(page); await page.goto("/");
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]");
    rows[0].watchedAtPrecision = "season"; rows[0].watchedAtValue = "2024-Spring";
    localStorage.setItem("anime:watchLogs:v1", JSON.stringify(rows));
  });
  await page.goto("/title/?anilistId=3&tab=watch");
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const editor = page.getByRole("form", { name: "감상 기록 수정" });
  await expect(editor.getByLabel("연도", { exact: true })).toHaveValue("2024");
  await editor.getByLabel("한줄 감상").fill("같은 기록 수정");
  await editor.getByRole("button", { name: "수정 저장" }).click();
  const [updated] = (await readState(page)).logs;
  expect(updated).toMatchObject({ id: "legacy-event-29", cue: "같은 기록 수정", watchedAtPrecision: "season",
    watchedAtValue: "2024-Spring", contextTags: ["친구와"] });
  expect(updated.characterRefs[0]).toMatchObject({ characterId: 7, nameSnapshot: "기존 캐릭터" });
  expect((await readState(page)).titles.find(row => row.anilistId === 3)).toMatchObject({ status: "보는중", score: 4.5, rewatchCount: 2 });
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  expect((await readState(page)).logs).toHaveLength(1);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("감상 기록을 삭제했어요.")).toBeVisible();
  expect((await readState(page)).logs).toHaveLength(0);
  expect((await readState(page)).titles.find(row => row.anilistId === 3)).toBeTruthy();
});

test("watch flow: catalog-only history can be edited and deleted without an external ID", async ({ page }) => {
  await prepare(page); await page.goto("/");
  await page.evaluate(({ animeId }) => {
    const rows = JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]");
    rows.push({ id: "own-log", catalogAnimeId: animeId, anilistId: null, eventType: "NOTE", watchedAtPrecision: "unknown",
      watchedAtValue: "", cue: "첫 감상", note: "기존 메모", createdAt: 2, updatedAt: 2 });
    localStorage.setItem("anime:watchLogs:v1", JSON.stringify(rows));
  }, { animeId });
  await page.goto(`/title/?animeId=${encodeURIComponent(animeId)}&tab=watch`);
  await expect(page.locator(".title-watch-records__management")).toHaveCount(0);
  await page.getByRole("button", { name: "수정", exact: true }).click();
  const editor = page.getByRole("form", { name: "감상 기록 수정" });
  await editor.locator("textarea").fill("자체 작품 수정");
  await editor.getByRole("button", { name: "수정 저장" }).click();
  expect((await readState(page)).logs.find(row => row.id === "own-log")?.note).toBe("자체 작품 수정");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("감상 기록을 삭제했어요.")).toBeVisible();
  expect((await readState(page)).logs.map(row => row.id)).not.toContain("own-log");
});

test("watch flow: current title details edit leaves historical logs untouched", async ({ page }) => {
  await prepare(page); await page.goto("/title/?anilistId=3&tab=watch");
  await page.getByRole("button", { name: "현재 상태·작품 메모 수정" }).click();
  const editor = page.getByRole("form", { name: "현재 작품 정보 수정" });
  await editor.getByLabel("시청 상태").selectOption("완료");
  await editor.getByLabel("내 평점").fill("5");
  await editor.getByLabel("다시 정주행한 횟수").fill("3");
  await editor.locator("textarea").fill("새 작품 메모");
  await editor.getByRole("button", { name: "변경 저장" }).click();
  await expect(page.getByText("작품 정보를 수정했어요.")).toBeVisible();
  const state = await readState(page);
  expect(state.titles.find(row => row.anilistId === 3)).toMatchObject({ status: "완료", score: 5, rewatchCount: 3, memo: "새 작품 메모" });
  expect(state.logs[0]).toMatchObject({ id: "legacy-event-29", cue: "처음 본 날", scoreAtThatTime: 4 });
});

test("watch flow: return to the same title search without placing the query in the URL", async ({ page }) => {
  await prepare(page); await page.goto("/titles/");
  const search = page.locator(".channel-search input");
  await search.fill("자체 작품");
  await page.locator(".title-poster-tile").filter({ hasText: ownTitle }).locator("a").click();
  await expect(page).toHaveURL(url => url.pathname === "/title/" && /^\/titles\/\?view=[a-f0-9-]+$/iu.test(url.searchParams.get("returnTo") || ""));
  await page.locator(".title-hub__back").click();
  await expect(page).toHaveURL(url => url.pathname === "/titles/" && Boolean(url.searchParams.get("view")));
  await expect(search).toHaveValue("자체 작품");
  await expect(page.locator(".title-poster-tile")).toHaveCount(1);
});

test("watch flow: common entry restores legacy rating, rewatches and history without an image", async ({ page }) => {
  await prepare(page); await page.goto("/");
  await page.locator(".top-nav__memory-action").click();
  await expect(page).toHaveURL(/\/record\//);
  await expect(page.getByRole("heading", { name: "기억 남기기", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /장면·이미지 남기기/ })).toHaveAttribute("href", "/memory/new/");
  await page.getByRole("link", { name: new RegExp(oldTitle) }).click();
  const form = page.getByRole("form", { name: "감상 기록 작성" });
  await expect(form.getByLabel("평점 (0~5)", { exact: true })).toHaveValue("4.5");
  await expect(form.getByLabel("다시 정주행한 횟수", { exact: true })).toHaveValue("2");
  await expect(page.getByText("이전 긴 감상은 지우지 않는다")).toBeVisible();
  await expect(page.getByText("지난 시청 이력")).toBeVisible();
  await expect(page.getByText("기존 캐릭터", { exact: true })).toBeVisible();
  await form.getByLabel("기록 종류", { exact: true }).selectOption("재시청");
  await expect(form.getByLabel("다시 정주행한 횟수", { exact: true })).toHaveValue("3");
  await form.getByLabel("평점 (0~5)", { exact: true }).fill("0");
  await form.getByLabel("날짜 단위", { exact: true }).selectOption("month");
  await form.getByLabel("시청한 날짜", { exact: true }).fill("2026-10");
  await form.getByLabel("감상", { exact: true }).fill("다시 보니 다른 장면이 남았다");
  await form.getByRole("button", { name: "감상 기록 저장", exact: true }).click();
  await expect(page.locator(".title-watch-records").getByRole("status")).toContainText("감상 기록을 저장했어요.");
  await page.reload();
  await expect(page.getByText("다시 보니 다른 장면이 남았다")).toBeVisible();
  const state = await readState(page);
  expect(state.logs).toHaveLength(2); expect(state.titles.find(row => row.anilistId === 3)).toMatchObject({ rewatchCount: 3, score: 0, memo: "이전 긴 감상은 지우지 않는다", lastRewatchAt: null });
  await page.getByRole("link", { name: /^기억 이미지/ }).click();
  await expect(page.getByText("내 기억 0개", { exact: true })).toBeVisible();
});

test("watch flow: catalog-only save is explicit, cancel keeps data and backups preserve canonical history", async ({ page, browser }) => {
  await prepare(page, false); await page.goto(ownHref());
  await expect(page.getByRole("form", { name: "감상 기록 작성" })).toHaveCount(0);
  await page.getByRole("button", { name: "작품 저장하고 기록하기", exact: true }).click();
  const form = page.getByRole("form", { name: "감상 기록 작성" });
  await expect(form).toBeVisible();
  await form.getByLabel("기록 종류", { exact: true }).selectOption("재시청");
  await form.getByRole("button", { name: "취소", exact: true }).click();
  await expect(form).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await form.getByRole("button", { name: "취소", exact: true }).click();
  expect((await readState(page)).logs).toHaveLength(1);
  expect((await readState(page)).titles.find(row => row.catalogAnimeId === animeId)?.rewatchCount).toBe(0);
  await page.locator(".title-watch-records").getByRole("button", { name: "감상 기록 남기기", exact: true }).click();
  await form.getByLabel("시청 상태", { exact: true }).selectOption("완료");
  await form.getByRole("button", { name: "5점", exact: true }).click();
  await form.getByLabel("감상", { exact: true }).fill("이미지 없이 남긴 자체 작품 감상");
  await form.getByRole("button", { name: "감상 기록 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "감상 기록을 저장했어요." })).toBeVisible();
  const backup = await page.evaluate(async () => {
    const { exportSyncSnapshot, encodeSyncSnapshot, normalizeSyncSnapshot, applySyncSnapshot } = await import("/src/domain/snapshotCodec.js");
    const repo = await import("/src/repositories/watchLogRepo.js");
    const { buildWatchLogCloudRows } = await import("/src/domain/cloudSyncTables.js");
    const { exportCatalogTitleBackup } = await import("/src/repositories/catalogTitleBackup.js");
    const wire = encodeSyncSnapshot(await exportSyncSnapshot());
    const roundTrip = normalizeSyncSnapshot(wire);
    await repo.replaceWatchLogsDurable([], { skipSyncMark: true });
    await applySyncSnapshot(wire);
    const restored = await repo.listWatchLogsByAnimeId(null, { catalogAnimeId: "anime:11111111-1111-4111-8111-000000000029" });
    const cloud = buildWatchLogCloudRows("test", roundTrip.watchLogs);
    return { restored, cloud, all: await repo.readAllWatchLogsPreferred(), wire, titles: await exportCatalogTitleBackup() };
  });
  expect(backup.restored).toHaveLength(1); expect(backup.restored[0]).toMatchObject({ anilistId: null, catalogAnimeId: animeId, note: "이미지 없이 남긴 자체 작품 감상", watchedAtPrecision: "unknown", scoreAtThatTime: 5 });
  expect(backup.cloud).toHaveLength(1); expect(backup.cloud[0].anilist_id).toBe(3); expect(backup.all).toHaveLength(2);
  const clean = await browser.newContext();
  const destination = await clean.newPage(); await destination.goto(new URL("/favicon.svg", page.url()).href);
  const freshRestored = await destination.evaluate(async ({ wire, titles }) => {
    const { restoreCatalogTitleBackup } = await import("/src/repositories/catalogTitleBackup.js");
    const { readTitleLibrary } = await import("/src/repositories/titleLibraryRepo.js");
    const { applySyncSnapshot } = await import("/src/domain/snapshotCodec.js");
    const { readAllWatchLogsPreferred } = await import("/src/repositories/watchLogRepo.js");
    await restoreCatalogTitleBackup(titles); await applySyncSnapshot(wire);
    return { titles: await readTitleLibrary(), logs: await readAllWatchLogsPreferred() };
  }, { wire: backup.wire, titles: backup.titles });
  expect(freshRestored.titles.find(row => row.catalogAnimeId === animeId)).toMatchObject({ score: 5, status: "완료", rewatchCount: 0 });
  expect(freshRestored.logs.find(row => row.catalogAnimeId === animeId)).toMatchObject({ note: "이미지 없이 남긴 자체 작품 감상", anilistId: null });
  await clean.close();
  await page.reload(); await expect(page.getByText("이미지 없이 남긴 자체 작품 감상")).toBeVisible();
  await form.getByRole("button", { name: "미평가", exact: true }).click();
  await form.getByLabel("기록 종류", { exact: true }).selectOption("완료");
  await form.getByLabel("날짜 단위", { exact: true }).selectOption("day");
  await form.getByLabel("시청한 날짜", { exact: true }).fill("2026-10-07");
  await form.getByRole("button", { name: "감상 기록 저장", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "감상 기록을 저장했어요." })).toBeVisible();
  expect((await readState(page)).titles.find(row => row.catalogAnimeId === animeId)?.score).toBeNull();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "작품 저장 해제", exact: true }).click();
  await expect(page.getByRole("button", { name: "작품 저장", exact: true })).toBeVisible();
  expect((await readState(page)).logs).toHaveLength(3);
});

test("watch flow: new provider title can record privately without claiming catalog verification", async ({ page }) => {
  await prepare(page); await page.goto("/record/");
  await page.getByRole("searchbox", { name: "작품 찾기" }).fill("새 외부");
  await page.getByRole("link", { name: /새 제공처 작품/ }).click();
  await expect(page).toHaveURL(/anilistId=5/);
  await expect(page.getByText("작품 정보 미연결", { exact: true })).toBeVisible();
  expect((await readState(page)).titles.find(row => row.anilistId === 5)).toBeUndefined();
  await page.getByRole("button", { name: "작품 저장하고 기록하기", exact: true }).click();
  const form = page.getByRole("form", { name: "감상 기록 작성" });
  await form.getByRole("button", { name: "3점", exact: true }).click();
  await form.getByLabel("감상", { exact: true }).fill("검색한 작품에 이미지 없이 남긴 감상");
  await form.getByRole("button", { name: "감상 기록 저장", exact: true }).click();
  await expect(page.locator(".title-watch-records").getByRole("status")).toContainText("감상 기록을 저장했어요.");
  await page.reload();
  await expect(page.getByText("검색한 작품에 이미지 없이 남긴 감상")).toBeVisible();
  const state = await readState(page);
  expect(state.titles.find(row => row.anilistId === 5)).toMatchObject({ score: 3, koTitle: "새 제공처 작품" });
  expect(state.titles.find(row => row.anilistId === 5)?.catalogAnimeId).toBeUndefined();
  expect(state.logs.filter(row => row.anilistId === 5)).toHaveLength(1);
});

test("watch flow: catalog IDB-only history survives promotion and legacy remote apply", async ({ page }) => {
  await prepare(page); await page.goto("/favicon.svg");
  const result = await page.evaluate(async ({ animeId }) => {
    const repo = await import("/src/repositories/watchLogRepo.js");
    const { putWatchLogIdb } = await import("/src/storage/idb.js");
    const { applyRemoteSnapshot } = await import("/src/repositories/syncRepo.js");
    const own = { ...repo.createWatchLog({ catalogAnimeId: animeId, anilistId: null, eventType: "NOTE", scoreAtThatTime: null, note: "자체 작품의 미평가 이력" }), id: "idb-catalog-29" };
    const legacy = { ...repo.createWatchLog({ anilistId: 3, eventType: "완료", scoreAtThatTime: 0, watchedAtPrecision: "day", watchedAtValue: "2026-10-07" }), id: "idb-legacy-29" };
    await putWatchLogIdb(own); await putWatchLogIdb(legacy); localStorage.removeItem("anime:watchLogs:v1");
    const scoped = await repo.listWatchLogsByAnimeId(null, { catalogAnimeId: animeId });
    const all = await repo.readAllWatchLogsPreferred();
    await applyRemoteSnapshot({ snapshot: { watchLogs: [legacy] } });
    return { scoped, all, after: await repo.readAllWatchLogsPreferred() };
  }, { animeId });
  expect(result.scoped).toHaveLength(1); expect(result.scoped[0]).toMatchObject({ catalogAnimeId: animeId, anilistId: null, scoreAtThatTime: null });
  expect(result.all).toHaveLength(2); expect(result.after).toHaveLength(2);
  expect(result.after.find(row => row.catalogAnimeId === animeId)?.note).toBe("자체 작품의 미평가 이력");
});

test("watch flow: append quota and partial tracking failure retain drafts and retry once", async ({ page }) => {
  await prepare(page); await page.goto(ownHref());
  const form = page.getByRole("form", { name: "감상 기록 작성" });
  await form.getByLabel("기록 종류", { exact: true }).selectOption("재시청");
  await form.getByLabel("감상", { exact: true }).fill("실패해도 두 번 남지 않는 감상");
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === "anime:watchLogs:v1") throw new DOMException("quota", "QuotaExceededError"); return setItem.call(this, key, value); };
    window.restoreWatchStorage29 = () => { Storage.prototype.setItem = setItem; };
  });
  await form.getByRole("button", { name: "감상 기록 저장", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("저장하지 못했어요");
  await expect(form.getByLabel("감상", { exact: true })).toHaveValue("실패해도 두 번 남지 않는 감상");
  expect((await readState(page)).logs).toHaveLength(1);
  await form.getByLabel("감상", { exact: true }).fill("실패 후 수정한 감상도 한 번만 저장");
  await page.evaluate(async () => {
    window.restoreWatchStorage29();
    const { createTitleHubService } = await import("/src/features/titles/application/titleHubService.js");
    const { readTitleLibrary, writeTitleLibrary } = await import("/src/repositories/titleLibraryRepo.js");
    let failures = 1;
    const service = createTitleHubService({ memoryRuntime: { initialize: async () => {}, listArchive: async () => [] },
      readLibrary: readTitleLibrary, writeLibrary: async (rows) => { if (failures-- > 0) throw new Error("tracking write failed"); return writeTitleLibrary(rows); } });
    // The mounted hub keeps its service object; replace only the save adapter.
    window.__MOEMOA_TEST_TITLE_HUB_SERVICE__.saveWatchRecord = service.saveWatchRecord;
  });
  await form.getByRole("button", { name: "감상 기록 저장", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("감상 이력은 저장됐지만");
  await expect(form.getByLabel("감상", { exact: true })).toBeDisabled();
  expect((await readState(page)).logs).toHaveLength(2);
  await form.getByRole("button", { name: "다시 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("감상 기록을 저장했어요.");
  expect((await readState(page)).logs).toHaveLength(2);
  expect((await readState(page)).titles.find(row => row.catalogAnimeId === animeId)?.rewatchCount).toBe(1);
  expect((await readState(page)).logs.find(row => row.catalogAnimeId === animeId)?.note).toBe("실패 후 수정한 감상도 한 번만 저장");
});

test("watch flow: responsive entry, latest search, unsaved navigation and read-only history", async ({ page }) => {
  await prepare(page); await page.goto("/record/");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("link", { name: new RegExp(ownTitle) })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const search = page.getByRole("searchbox", { name: "작품 찾기" });
  await search.fill("느린"); await page.waitForTimeout(310); await search.fill("실패");
  await expect(page.getByText("온라인 검색에 연결하지 못했어요. 내 작품은 계속 선택할 수 있어요.")).toBeVisible();
  await page.waitForTimeout(550); await expect(page.getByText("오래된 검색 결과")).toHaveCount(0);
  await page.goto(ownHref());
  const form = page.getByRole("form", { name: "감상 기록 작성" });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 }); await expect(form).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await form.getByLabel("감상", { exact: true }).fill("아직 저장하지 않은 내용");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("link", { name: /^기억 이미지/ }).click();
  await expect(form).toBeVisible(); await expect(form.getByLabel("감상", { exact: true })).toHaveValue("아직 저장하지 않은 내용");
  await form.getByRole("button", { name: "취소", exact: true }).click();
  await expect(form).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await form.getByRole("button", { name: "취소", exact: true }).click();
  expect((await readState(page)).logs).toHaveLength(1);
  await page.getByRole("link", { name: /^기억 이미지/ }).click();
  await expect(page.getByText("내 기억 0개", { exact: true })).toBeVisible();
});
