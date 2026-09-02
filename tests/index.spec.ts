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

test("mobile menu closes on Escape and returns focus to its trigger", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await clearAppState(page);
  await page.goto("/library/");

  const trigger = page.locator(".top-nav__mobile-menu-trigger:visible");
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Manage" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Manage" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("new visitor sees memory card creation as the primary action", async ({ page }) => {
  await clearAppState(page);
  await installAppState(page, { locale: "en" });
  await page.goto("/");
  const emptyHome = page.locator(".home-empty-state");
  const createCard = emptyHome.getByRole("link", { name: "Create memory card", exact: true });
  await expect(createCard.first()).toBeVisible();
  await expect(emptyHome.getByRole("button", { name: "Search or add a title" })).toHaveCount(1);
  await expect(emptyHome.locator(".memory-visual--system .system-design-preview")).toBeVisible();
  await expect(emptyHome.getByText("Saved only on this device for now. Creating a card does not publish it.")).toBeVisible();
  const readingOrder = await emptyHome.locator(
    ".home-empty-state__promise, .home-empty-state__specimen, .home-empty-state__actions, .home-empty-state__local-note",
  ).evaluateAll((nodes) => nodes.map((node) => [
    "home-empty-state__promise",
    "home-empty-state__specimen",
    "home-empty-state__actions",
    "home-empty-state__local-note",
  ].find((className) => node.classList.contains(className))));
  expect(readingOrder).toEqual([
    "home-empty-state__promise",
    "home-empty-state__specimen",
    "home-empty-state__actions",
    "home-empty-state__local-note",
  ]);
  await expect(page.locator(".library-card")).toHaveCount(0);
});

test("saved Memory Card becomes Home's archive source without a legacy Library or log", async ({ page }) => {
  await clearAppState(page);
  await installAppState(page, { locale: "en", list: [], watchLogs: [] });

  await page.goto("/memory/new/");
  await page.getByLabel("Anime or card title").fill("Home Memory Fixture");
  await page.getByLabel("Short reflection").fill("A real card, separate from the legacy log.");
  await page.getByRole("button", { name: "Use system design" }).click();
  await page.getByRole("button", { name: "Save card" }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/u);

  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  const memory = page.getByRole("region", { name: "Memory Archive" });
  await expect(memory).toBeVisible();
  await expect(memory).toContainText("1 memory card");
  await expect(memory).toContainText("Latest memory card");
  await expect(memory.getByRole("link", { name: "Home Memory Fixture" })).toBeVisible();
  await expect(memory.getByRole("link", { name: "Open Archive" })).toBeVisible();
  await expect(memory.getByRole("link", { name: "Create another memory" })).toBeVisible();
  await expect(memory.locator(".memory-preview--featured")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Search or add a title" })).toHaveCount(0);
  await expect(page.getByText("Add your first anime", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const legacyLogs = await page.evaluate(() => JSON.parse(
    localStorage.getItem("anime:watchLogs:v1") || "[]",
  ));
  expect(legacyLogs).toEqual([]);
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
  await expect(syncCard).not.toContainText("Cloud backup found");
  await expect(page.getByText(/Private Memory Cards and images remain in this device's Guest namespace/u)).toBeVisible();
  await expect(page.getByText(/Memory Cards and their images are not included/u)).toBeVisible();
});

test("visitor without a Memory Card keeps the memory-led empty Home", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, status: "completed", addedAt: 1 }],
    watchLogs: [{ id: "log-1", anilistId: 1, createdAt: 1, updatedAt: 1 }],
  });
  await page.goto("/");
  const emptyHome = page.locator(".home-empty-state");
  await expect(emptyHome.getByRole("link", { name: "Create memory card", exact: true })).toBeVisible();
  await expect(emptyHome.getByRole("button", { name: "Search or add a title" })).toBeVisible();
});

test("empty Home primary CTA opens the card composer without creating a legacy log", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, status: "completed", addedAt: 1 }],
    watchLogs: [],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/");
  await page.locator(".home-empty-state").getByRole("link", { name: "Create memory card", exact: true }).click();
  await expect(page).toHaveURL(/\/memory\/new\/?$/u);
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toEqual([]);
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
