import { expect, test } from "@playwright/test";
import { clearAppState, installAppState } from "./helpers/appState";

test("fresh browser uses English shell and primary navigation", async ({ page }) => {
  await clearAppState(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const primary = page.locator(".top-nav__links--routes");
  await expect(primary.getByRole("link", { name: "Collection", exact: true })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Titles" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Memories" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Boards →", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add Memory", exact: true }).first()).toBeVisible();
  await expect(primary.getByRole("link", { name: "Minihome" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});

test("mobile menu identifies the current route accessibly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await clearAppState(page);
  await page.goto("/library/");
  await page.locator(".top-nav__mobile-menu-trigger:visible").click();
  const current = page.locator(".top-nav-mobile-links").getByRole("link", { name: "Titles" });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".top-nav-mobile-links").getByRole("link", { name: "Memories" })).toBeVisible();
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

test("new visitor can record from an empty Collection without creating data", async ({ page }) => {
  await clearAppState(page);
  await installAppState(page, { locale: "en" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your shelves are empty.", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add Memory", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Add Memory", exact: true })).toHaveAttribute("href", "/record/");
  await expect(page.getByRole("link", { name: "My titles →", exact: true })).toBeVisible();
  await expect(page.locator(".bookshelf-tile")).toHaveCount(0);
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
  await page.getByRole("button", { name: "Edit collection", exact: true }).click();
  await page.getByRole("button", { name: "Add shelf", exact: true }).click();
  await page.locator(".bookshelf-picker").getByLabel("Home Memory Fixture", { exact: true }).check();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const cover = page.getByRole("button", { name: "Home Memory Fixture open memories", exact: true });
  await expect(cover).toBeVisible();
  await cover.click();
  const memory = page.locator(".collection-memory-fan");
  await expect(memory).toBeVisible();
  await expect(memory.getByRole("link", { name: /Home Memory Fixture/ }).first()).toBeVisible();
  await expect(memory.getByRole("link", { name: "View all 1 memories →", exact: true })).toBeVisible();
  await expect(memory.locator(".title-album-card__preview")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Find a title" })).toHaveCount(0);
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
  await expect(createCard).toHaveAccessibleName("Add Memory");
  await expect(createCard).toContainText("Memory");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await createCard.click();
  await expect(page).toHaveURL(url => url.pathname === '/record/' && url.searchParams.get('returnTo') === '/');
  await page.getByRole('link', { name: /Keep a scene or image/ }).click();
  await expect(page).toHaveURL(url => url.pathname === '/memory/new/' && url.searchParams.get('returnTo') === '/');
});

test("unconfigured cloud stays local-only and never claims a cloud backup", async ({ page }) => {
  await clearAppState(page);
  await page.goto("/data/");
  const syncCard = page.locator(".sync-card");
  await expect(syncCard).toHaveAttribute('data-memory-account-status', 'LOCAL_ONLY');
  await expect(syncCard).toContainText("Saved on this device");
  await expect(syncCard).not.toContainText("Cloud backup found");
  await expect(syncCard.getByText('Records and photos are saved on this device.')).toBeVisible();
  await expect(page.getByText(/Memory Cards and their images are not included/u)).toBeVisible();
});

test("saved titles and watch logs do not become Memory Cards in Collection", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, status: "completed", addedAt: 1 }],
    watchLogs: [{ id: "log-1", anilistId: 1, createdAt: 1, updatedAt: 1 }],
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Add Memory", exact: true })).toBeVisible();
  await expect(page.locator(".bookshelf-tile")).toHaveCount(0);
  await expect(page.locator(".bookshelf-tile.has-memories")).toHaveCount(0);
  await page.getByRole("link", { name: "Memories", exact: true }).click();
  await expect(page.locator(".memory-archive__list li")).toHaveCount(0);
});

test("empty Home primary CTA opens the card composer without creating a legacy log", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [{ anilistId: 1, status: "completed", addedAt: 1 }],
    watchLogs: [],
    mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Add Memory", exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/record/' && url.searchParams.get('returnTo') === '/');
  await page.getByRole('link', { name: /Keep a scene or image/ }).click();
  await expect(page).toHaveURL(url => url.pathname === '/memory/new/' && url.searchParams.get('returnTo') === '/');
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
  await expect(page.locator(".bookshelf-page")).toBeVisible();
  await expect(page.locator(".top-nav__links--routes")).toBeVisible();
});
