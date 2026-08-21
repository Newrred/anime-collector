import { expect, test } from "@playwright/test";
import { clearAppState, installAppState } from "./helpers/appState";

test("fresh browser uses English shell and primary navigation", async ({ page }) => {
  await clearAppState(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const primary = page.locator(".top-nav__links--routes");
  await expect(primary.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Library" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Archive" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Tier" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create memory card", exact: true }).first()).toBeVisible();
  await expect(primary.getByRole("link", { name: "Minihome" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});

test("mobile menu identifies the current route accessibly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clearAppState(page);
  await page.goto("/library/");
  await page.locator(".top-nav__mobile-menu-trigger:visible").click();
  const current = page.locator(".top-nav-mobile-links").getByRole("link", { name: "Library" });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".top-nav-mobile-links").getByRole("link", { name: "Archive" })).toBeVisible();
});

test("new visitor sees memory card creation as the primary action", async ({ page }) => {
  await clearAppState(page);
  await installAppState(page, { locale: "en" });
  await page.goto("/");
  const createCard = page.locator(".home-empty-state").getByRole("link", { name: "Create memory card", exact: true });
  await expect(createCard.first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add your first title" })).toHaveCount(1);
  await expect(page.locator(".library-card")).toHaveCount(0);
});

test("mobile exposes memory card creation without opening the overflow menu", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await clearAppState(page);
  await installAppState(page, { locale: "en" });
  await page.goto("/");

  const createCard = page.locator(".top-nav__memory-action:visible");
  await expect(createCard).toHaveAccessibleName("Create memory card");
  await expect(createCard).toContainText("Card");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await createCard.click();
  await expect(page).toHaveURL(/\/memory\/new\/?$/u);
});

test("unconfigured cloud stays local-only and never claims a cloud backup", async ({ page }) => {
  await clearAppState(page);
  await page.goto("/data/");
  const syncCard = page.locator(".sync-card");
  await expect(syncCard).toContainText("Local only");
  await expect(syncCard).toContainText("Unavailable");
  await expect(syncCard).not.toContainText("Cloud backup found");
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

test("home first-memory CTA creates one log only after save", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, status: "completed", addedAt: 1 }],
    watchLogs: [],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Write your first memory" }).click();
  const sheet = page.locator(".log-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Save" }).click();
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toHaveLength(1);
});

test("seeded returning visitor sees the home shell", async ({ page }) => {
  await installAppState(page, {
    locale: "ko",
    list: [{ anilistId: 1, status: "완료", score: 9, memo: "fixture", addedAt: 1 }],
    watchLogs: [],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator(".home-page")).toBeVisible();
  await expect(page.locator(".top-nav__links--routes")).toBeVisible();
});
