import { test, expect } from "@playwright/test";

test("UUID navigation opens an existing AniList-bound saved title when catalog access fails", async ({ page }) => {
  await page.goto("/title/");
  const result = await page.evaluate(async () => {
    const modulePath = "/src/features/titles/application/titleHubService.js";
    const { createTitleHubService } = await import(modulePath);
    const animeId = "anime:11111111-1111-4111-8111-000000000003";
    const service = createTitleHubService({
      memoryRuntime: { initialize: async () => {}, listArchive: async () => [] },
      readLibrary: async () => [{ anilistId: 3, catalogAnimeId: animeId, koTitle: "Offline title" }],
      readWatchLogs: async () => [], titleResolver: {},
      catalogRepository: { getDetail: async () => { throw new Error("offline"); } },
    });
    const album = await service.load({ kind: "ANIME", animeId });
    return { title: album?.displayTitle, saved: album?.tracking.isSaved };
  });
  expect(result).toEqual({ title: "Offline title", saved: true });
});

test("catalog-only title saves durably, reloads, and remains removable without AniList", async ({ page }) => {
  const animeId = "anime:11111111-1111-4111-8111-000000000002";
  await page.addInitScript(({ animeId }) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("ko"));
    let service;
    const getService = async () => {
      if (!service) {
        const modulePath = "/src/features/titles/application/titleHubService.js";
        const { createTitleHubService } = await import(modulePath);
        service = createTitleHubService({
          memoryRuntime: { initialize: async () => {}, listArchive: async () => [] },
          titleResolver: {}, readWatchLogs: async () => [],
          catalogRepository: { getDetail: async () => ({
            animeId, sourceBinding: null, preferredTitle: { value: "자체 ID 테스트 작품" },
            titles: [], release: {}, studios: [], genres: { core: [], source: [] }, cover: null,
          }) },
        });
      }
      return service;
    };
    window.__MOEMOA_TEST_TITLE_HUB_SERVICE__ = {
      load: async (request) => (await getService()).load(request),
      setSaved: async (album, shouldSave) => (await getService()).setSaved(album, shouldSave),
    };
  }, { animeId });
  await page.goto(`/title/?animeId=${encodeURIComponent(animeId)}`);
  await expect(page.getByRole("heading", { name: "자체 ID 테스트 작품" })).toBeVisible();
  await page.getByRole("button", { name: "작품 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: "작품 저장 해제" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "작품 저장 해제" })).toBeVisible();
  await expect(page.locator('a[href*="anilist.co"]')).toHaveCount(0);
  await page.getByRole("button", { name: "작품 저장 해제" }).click();
  await expect(page.getByRole("button", { name: "작품 저장", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "작품 저장", exact: true })).toBeVisible();
});
