import { expect, test } from "@playwright/test";
import { clearAppState, installAppState } from "./helpers/appState";

test("new visitor sees one primary add-title action", async ({ page }) => {
  await clearAppState(page);
  await installAppState(page, { locale: "en" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add your first title" })).toHaveCount(1);
  await expect(page.locator(".library-card")).toHaveCount(0);
});

test("visitor with one logged title is asked to add more titles", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, status: "completed", addedAt: 1 }],
    watchLogs: [{ id: "log-1", anilistId: 1, createdAt: 1, updatedAt: 1 }],
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Add two more titles" })).toHaveCount(1);
});

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
