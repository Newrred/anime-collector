import { expect, test } from "@playwright/test";

const animeId = "anime:11111111-1111-4111-8111-000000154587";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ id }) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("ko"));
    const baseAlbum = {
      key: "ANILIST:154587",
      titleRef: { kind: "ANIME", animeId: id },
      anilistId: 154587,
      displayTitle: "장송의 프리렌",
      isPrivateTitle: false,
      aliases: ["Frieren: Beyond Journey's End"],
      genres: ["Adventure", "Fantasy"],
      officialCover: { src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='100%25' height='100%25' fill='%237765aa'/%3E%3C/svg%3E" },
      catalogDetail: {
        release: { format: "TV", episodeCount: 28, startDate: "2023-09-29" },
        studios: [{ name: "Madhouse" }],
      },
      tracking: { isSaved: true, watchStatus: "보는중", rating: 4.5 },
      memoryCount: 1,
      presence: "SAVED_WITH_MEMORY",
      memories: [{
        card: { id: "card-one", note: "조용한 여정이 오래 남았다.", updatedAt: "2026-09-03T00:00:00.000Z" },
        title: { displayTitle: "장송의 프리렌" },
        sourceKind: "SYSTEM_DESIGN",
        asset: { designSpec: { version: 1, templateId: "memory-gradient", paletteId: "violet-dawn", patternSeed: "frieren", titleLayout: "BOTTOM_LEFT", genreTokens: ["fantasy"] } },
        visual: { kind: "SYSTEM_DESIGN", designSpec: { version: 1, templateId: "memory-gradient", paletteId: "violet-dawn", patternSeed: "frieren", titleLayout: "BOTTOM_LEFT", genreTokens: ["fantasy"] } },
      }],
      watchLogs: [],
    };
    window.__MOEMOA_TEST_TITLE_HUB_SERVICE__ = {
      load: async () => ({
        ...baseAlbum,
        tracking: { ...baseAlbum.tracking, isSaved: sessionStorage.getItem("title-saved") !== "false" },
      }),
      setSaved: async (_album: unknown, shouldSave: boolean) => {
        sessionStorage.setItem("title-saved", String(shouldSave));
        return shouldSave;
      },
    };
  }, { id: animeId });
});

test("Title Hub keeps saved state and Memories independent and opens the exact composer", async ({ page }) => {
  await page.goto(`/title/?animeId=${encodeURIComponent(animeId)}&title=${encodeURIComponent("장송의 프리렌")}`);

  await expect(page.getByRole("heading", { name: "장송의 프리렌", level: 1 })).toBeVisible();
  await expect(page.getByText("내 기억 1개")).toBeVisible();
  await expect(page.getByText("조용한 여정이 오래 남았다.")).toBeVisible();
  await expect(page.getByText("Madhouse")).toBeVisible();

  await page.getByRole("button", { name: "작품 저장 해제" }).click();
  await expect(page.getByText("미저장", { exact: true })).toBeVisible();
  await expect(page.getByText("내 기억 1개")).toBeVisible();
  await expect(page.getByText("조용한 여정이 오래 남았다.")).toBeVisible();

  await page.locator(".title-hub__actions").getByRole("link", { name: "기억 남기기" }).click();
  await expect(page).toHaveURL(new RegExp(`/memory/new/(?:index\\.html)?\\?animeId=${encodeURIComponent(animeId)}`));
});

test("Title Hub fits a 320px viewport without horizontal clipping", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/title/?animeId=${encodeURIComponent(animeId)}`);
  await expect(page.getByRole("heading", { name: "장송의 프리렌", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator(".title-hub__memory").evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth)).toBe(true);
});

test("global search opens the same Title Hub instead of the legacy detail modal", async ({ page }) => {
  await page.addInitScript(({ id }) => {
    window.__MOEMOA_TEST_GLOBAL_SEARCH__ = {
      search: async () => [{
        kind: "remote",
        id: 154587,
        catalogAnimeId: id,
        title: "장송의 프리렌",
        subtitle: "Frieren · TV",
        poster: "",
        media: { id: 154587, title: { english: "Frieren" } },
      }],
    };
  }, { id: animeId });
  await page.goto("/");
  const search = page.getByLabel("작품 추가 또는 내 기록 검색");
  await search.fill("프리렌");
  await page.getByRole("button", { name: /장송의 프리렌/ }).click();
  await expect(page).toHaveURL(new RegExp(`/title/(?:index\\.html)?\\?animeId=${encodeURIComponent(animeId)}`));
  await expect(page.getByRole("heading", { name: "장송의 프리렌", level: 1 })).toBeVisible();
});
