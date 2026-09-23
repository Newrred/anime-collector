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

test("old numeric title links open Title Hub and keep watch record editing available", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, koTitle: "Fixture Anime", status: "완료", score: 4, memo: "preserved", addedAt: 1 }],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/library/?animeId=1");
  await expect(page).toHaveURL(/\/title\/\?anilistId=1$/);
  await expect(page.getByRole("heading", { name: "Fixture Anime", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit status & watch records" }).click();
  await expect(page).toHaveURL(/\/library\/\?animeId=1&focus=edit$/);
  await expect(page.getByRole("dialog", { name: "Fixture Anime" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]")[0].memo)).toBe("preserved");
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
