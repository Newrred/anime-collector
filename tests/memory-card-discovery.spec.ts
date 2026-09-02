import { expect, test, type Page } from "@playwright/test";

const catalogAnimeId = "anime:11111111-1111-4111-8111-000000000001";

async function installCatalogSearchFixture(page: Page) {
  await page.addInitScript(({ animeId }) => {
    const initializedKey = "moemoa.e2e.memory-discovery.initialized";
    if (!sessionStorage.getItem(initializedKey)) {
      sessionStorage.setItem(initializedKey, "1");
      localStorage.clear();
      indexedDB.deleteDatabase("anime-collector-db");
      indexedDB.deleteDatabase("moemoa-memory-v1");
      localStorage.setItem("ui:locale:v1", JSON.stringify("en"));
    }

    const media = {
      id: 1,
      title: { english: "Cowboy Bebop", romaji: "Cowboy Bebop", native: "カウボーイビバップ" },
      synonyms: [],
      genres: ["Action", "Sci-Fi"],
      coverImage: { medium: "", large: "", extraLarge: "" },
      seasonYear: 1998,
      format: "TV",
    };
    const row = {
      kind: "remote",
      id: 1,
      catalogAnimeId: animeId,
      ko: "카우보이 비밥",
      media,
      src: "moemoa-catalog",
      title: "카우보이 비밥",
      subtitle: "Cowboy Bebop · 1998 · TV",
      poster: "",
    };
    (window as typeof window & {
      __MOEMOA_TEST_GLOBAL_SEARCH__?: { search: () => Promise<unknown[]> };
      __MOEMOA_TEST_CATALOG_TITLE_CHOICE__?: unknown;
    }).__MOEMOA_TEST_GLOBAL_SEARCH__ = { search: async () => [structuredClone(row)] };
    (window as typeof window & {
      __MOEMOA_TEST_CATALOG_TITLE_CHOICE__?: unknown;
    }).__MOEMOA_TEST_CATALOG_TITLE_CHOICE__ = {
      kind: "ANIME_REF",
      animeId,
      displayTitle: "카우보이 비밥",
      aliases: ["Cowboy Bebop", "カウボーイビバップ"],
      genres: ["Action", "Sci-Fi"],
      sourceBinding: { provider: "ANILIST", externalId: "1" },
      verificationState: "PROVIDER_CANDIDATE",
      catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
      readiness: "READY",
    };
  }, { animeId: catalogAnimeId });

  await page.route(/^https:\/\/graphql\.anilist\.co\/?$/u, (route) => (
    route.fulfill({ json: { data: { Page: { media: [] } } } })
  ));
}

async function memoryCardCount(page: Page) {
  return page.evaluate(async () => {
    const databases = typeof indexedDB.databases === "function" ? await indexedDB.databases() : [];
    if (databases.length > 0 && !databases.some((row) => row.name === "moemoa-memory-v1")) return 0;
    const request = indexedDB.open("moemoa-memory-v1");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!database.objectStoreNames.contains("memory_cards")) {
      database.close();
      return 0;
    }
    const transaction = database.transaction("memory_cards", "readonly");
    const countRequest = transaction.objectStore("memory_cards").count();
    const count = await new Promise<number>((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
    database.close();
    return count;
  });
}

async function searchCatalogResult(page: Page, path = "/") {
  await page.goto(path);
  const search = page.locator(".quick-action__input:visible");
  await search.fill("Cowboy Bebop");
  const row = page.locator(".quick-action-row").filter({
    has: page.getByRole("button", { name: "Add to Library" }),
  });
  await expect(row).toBeVisible();
  return row;
}

test("catalog search card action preserves the exact AnimeRef without changing Library or drafts", async ({ page }) => {
  await installCatalogSearchFixture(page);
  const row = await searchCatalogResult(page);

  await row.getByRole("button", { name: "Create memory card" }).click();

  await expect(page).toHaveURL(new RegExp(`/memory/new/\\?animeId=${encodeURIComponent(catalogAnimeId)}`));
  await expect(page.getByLabel("Anime or card title")).toHaveValue("카우보이 비밥");
  await expect(page.getByText("Catalog match")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]"))).toEqual([]);
  expect(await memoryCardCount(page)).toBe(0);
});

test("catalog result exposes one explicit Memory action and a separate Library-only action", async ({ page }) => {
  await installCatalogSearchFixture(page);
  const row = await searchCatalogResult(page);

  await expect(row.locator(".quick-action-row__create-action")).toHaveCount(1);
  await expect(row.locator(".quick-action-row__library-action")).toHaveCount(1);
  await expect(row.getByRole("group", { name: "Choose how to use this title" })).toBeVisible();
  await expect(row.getByRole("button")).toHaveCount(2);
  await expect(row.getByText("Starts a private card without adding this title to Library.", { exact: true })).toBeVisible();
  await expect(row.getByText("Adds this title to Library only. No Memory Card is created.", { exact: true })).toBeVisible();

  const hierarchy = await row.evaluate((element) => {
    const primary = element.querySelector(".quick-action-row__create-action");
    const secondary = element.querySelector(".quick-action-row__library-action");
    return {
      primaryBackground: primary ? getComputedStyle(primary).backgroundColor : "",
      secondaryBackground: secondary ? getComputedStyle(secondary).backgroundColor : "",
    };
  });
  expect(hierarchy.primaryBackground).not.toBe(hierarchy.secondaryBackground);
});

test("desktop and mobile search close on Escape and restore focus to their invoking control", async ({ page }) => {
  await installCatalogSearchFixture(page);
  await page.goto("/");

  const desktopInput = page.locator(".quick-action__input:visible");
  await desktopInput.fill("Cowboy Bebop");
  await expect(page.locator(".quick-action__desktop .quick-action-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".quick-action__desktop .quick-action-panel")).toHaveCount(0);
  await expect(desktopInput).toBeFocused();

  await page.setViewportSize({ width: 320, height: 720 });
  const mobileTrigger = page.locator(".quick-action__mobile-trigger:visible");
  await mobileTrigger.click();
  await expect(page.getByRole("dialog", { name: "Add title · Find my record" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Add title · Find my record" })).toHaveCount(0);
  await expect(mobileTrigger).toBeFocused();
});

test("native Home actions target packaged index documents instead of clean Web routes", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { androidBridge?: Record<string, unknown> }).androidBridge = {};
  });
  await installCatalogSearchFixture(page);
  await page.goto("/");

  await page.getByRole("link", { name: "Create memory card" }).first().click();

  await expect(page).toHaveURL(/\/memory\/new\/index\.html$/u);
});

test("native search actions preserve the selected title in the packaged composer route", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { androidBridge?: Record<string, unknown> }).androidBridge = {};
  });
  await installCatalogSearchFixture(page);
  const row = await searchCatalogResult(page);

  await row.getByRole("button", { name: "Create memory card" }).click();

  await expect(page).toHaveURL(new RegExp(
    `/memory/new/index\\.html\\?animeId=${encodeURIComponent(catalogAnimeId)}`,
  ));
});

test("native quick add exposes an actionable confirmation inside the mobile search sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    (window as typeof window & { androidBridge?: Record<string, unknown> }).androidBridge = {};
  });
  await installCatalogSearchFixture(page);
  await page.goto("/");
  await page.locator(".quick-action__mobile-trigger:visible").click();
  await page.locator(".quick-action__input:visible").fill("Cowboy Bebop");
  const row = page.locator(".quick-action-row").filter({
    has: page.getByRole("button", { name: "Add to Library" }),
  });
  await row.getByRole("button", { name: "Add to Library" }).click();

  const feedback = page.locator(".quick-action-panel__feedback");
  await expect(feedback).toContainText("Added to Library.");
  const openLibrary = feedback.getByRole("button", { name: "Open Library" });
  await expect(openLibrary).toBeVisible();
  await expect(openLibrary).toBeInViewport();
  await openLibrary.click();
  await expect(page).toHaveURL(/\/library\/index\.html\?animeId=1$/u);
});

test("native account settings button opens the packaged Data document", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    (window as typeof window & { androidBridge?: Record<string, unknown> }).androidBridge = {};
  });
  await installCatalogSearchFixture(page);
  await page.goto("/");
  await page.locator('.top-nav__mobile-menu-trigger:visible').click();

  await page.getByRole("button", { name: "Open account settings" }).click();

  await expect(page).toHaveURL(/\/data\/index\.html$/u);
});

test("catalog search Library action adds only the Library row and creates no Memory draft", async ({ page }) => {
  await installCatalogSearchFixture(page);
  const row = await searchCatalogResult(page, "/library/");
  await expect(page.locator(".library-card")).toHaveCount(0);

  await row.getByRole("button", { name: "Add to Library" }).click();

  await expect(page).toHaveURL(/\/library\/?$/u);
  await expect(page.getByRole("status")).toHaveText("Added to Library.");
  await expect(page.locator(".library-card")).toHaveCount(1);
  const library = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]"));
  expect(library).toHaveLength(1);
  expect(library[0].anilistId).toBe(1);
  expect(await memoryCardCount(page)).toBe(0);
});
