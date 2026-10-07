import { expect, test } from "@playwright/test";
import { installAppState } from "./helpers/appState";

for (const locale of ["en", "ko"] as const) {
  test(`${locale} navigation maps the legacy index and preserves accessible mobile navigation`, async ({ page }) => {
    await installAppState(page, { locale });
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/library/");
    await expect(page).toHaveURL(/\/titles\/$/);
    await expect(page.getByRole("heading", { name: locale === "ko" ? "내 작품" : "My Titles", exact: true })).toBeVisible();
    await page.locator(".top-nav__mobile-menu-trigger:visible").click();
    const menu = page.locator(".top-nav-mobile-links");
    await expect(menu.getByRole("link", { name: locale === "ko" ? "작품" : "Titles", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".data-menu-utility-grid").getByRole("link", { name: locale === "ko" ? "티어" : "Tier", exact: true })).toHaveAttribute("href", "/tier/");
    await page.screenshot({ path: `test-results/phase5-menu-${locale}-320.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await menu.getByRole("link", { name: locale === "ko" ? "기억" : "Memories", exact: true }).click();
    await expect(page).toHaveURL(/\/archive\/$/);
    await expect(page.getByRole("heading", { name: locale === "ko" ? "기억 아카이브" : "Memory Archive", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/titles\/$/);
    await expect(page.locator(".data-menu-panel--manage")).toHaveCount(0);
  });
}

test("old numeric title links open Title Hub and watch-management deep links follow it", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, koTitle: "Fixture Anime", status: "완료", score: 4, memo: "preserved", addedAt: 1 }],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/library/?animeId=1");
  await expect(page).toHaveURL(/\/title\/\?anilistId=1$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
  await page.goto("/library/?animeId=1&focus=edit");
  await expect(page).toHaveURL(/\/title\/\?anilistId=1&tab=watch$/);
  await expect(page.getByRole("heading", { name: "Watch records" })).toBeVisible();
  await page.goto("/library/?animeId=1&focus=quick-log");
  await expect(page).toHaveURL(/\/title\/\?anilistId=1&tab=watch&record=new$/);
  await expect(page.getByRole("form", { name: "Write a watch record" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]")[0].memo)).toBe("preserved");
});

test("Title Hub pins a character and adds a related series without opening the old library", async ({ page }) => {
  await installAppState(page, { locale: "ko", list: [{ anilistId: 1, koTitle: "첫 작품", status: "완료", addedAt: 1 }],
    mediaById: { "1": { id: 1, title: { romaji: "첫 작품" }, genres: [],
      characters: { edges: [{ role: "MAIN", node: { id: 7, name: { full: "주인공" }, image: {} } }] },
      relations: { edges: [
        { relationType: "SEQUEL", node: { id: 2, title: { english: "다음 작품" }, format: "TV" } },
        { relationType: "SOURCE", node: { id: 3, title: { english: "원작 만화" }, format: "MANGA" } },
      ] } } } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/title/?anilistId=1&tab=watch");
  await page.getByRole("button", { name: /즐겨찾는 캐릭터/ }).click();
  await page.getByRole("button", { name: "고정", exact: true }).click();
  await expect(page.getByRole("button", { name: "고정 해제" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:characterPins:v1") || "[]"))).toMatchObject([
    { characterId: 7, mediaId: 1, nameSnapshot: "주인공" },
  ]);
  await page.getByRole("button", { name: "고정 해제" }).click();
  await expect(page.getByRole("button", { name: "고정 해제" })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:characterPins:v1") || "[]"))).toHaveLength(0);
  await page.getByRole("button", { name: /관련 시리즈/ }).click();
  await expect(page.getByText("원작 만화")).toBeVisible();
  await expect(page.getByRole("link", { name: "작품 보기" })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "작품 보기" })).toHaveAttribute("href", "/title/?anilistId=2&title=%EB%8B%A4%EC%9D%8C+%EC%9E%91%ED%92%88");
  await page.getByRole("button", { name: "내 작품에 추가" }).click();
  await expect(page.getByText("내 작품에 추가했어요.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]").filter(row => row.anilistId === 2))).toHaveLength(1);
  await page.getByRole("button", { name: "내 작품에 추가" }).click();
  await expect(page.getByText("이미 내 작품에 있어요.")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]").filter(row => row.anilistId === 2))).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("search finds an unsaved title with a Memory and displays its independent count", async ({ page }) => {
  await installAppState(page, { locale: "en" });
  await page.addInitScript(() => { window.__MOEMOA_TEST_GLOBAL_SEARCH__ = { search: async () => [] }; });
  await page.goto("/titles/");
  await expect(page.getByRole("heading", { name: "My Titles", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime();
    await runtime.createCard({
      titleChoice: { kind: "ANIME_REF", displayTitle: "Memory Only Title", sourceBinding: { provider: "ANILIST", externalId: "999" }, verificationState: "PROVIDER_CANDIDATE" },
      systemDesignSpec: { version: 1, templateId: "memory-gradient", paletteId: "violet-night", patternSeed: "search-memory", titleLayout: "BOTTOM_LEFT", genreTokens: [] },
      note: "A private cue",
    });
  });
  await page.reload();
  await expect(page.locator(".title-album-card")).toHaveCount(1);
  await page.locator(".quick-action__input:visible").fill("Memory Only");
  const row = page.locator(".quick-action-row").filter({ hasText: "Memory Only Title" });
  await expect(row).toContainText("Not saved · 1 Memory");
  await expect(row).not.toContainText("A private cue");
  await page.screenshot({ path: "test-results/phase5-search-desktop.png", fullPage: true });
  await row.locator(".quick-action-row__main").click();
  await expect(page).toHaveURL(/\/title\/\?anilistId=999&title=/);
  await expect(page.locator(".quick-action-panel")).toHaveCount(0);
});
