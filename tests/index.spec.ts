import { expect, test } from "@playwright/test";
import { installAppState } from "./helpers/appState";

test("seeded returning visitor sees the home shell", async ({ page }) => {
  await installAppState(page, {
    locale: "ko",
    list: [{ anilistId: 1, status: "완료", score: 9, memo: "fixture", addedAt: 1 }],
    watchLogs: [],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/");
  await expect(page.locator(".home-page")).toBeVisible();
  await expect(page.locator(".top-nav__links--routes")).toBeVisible();
});
