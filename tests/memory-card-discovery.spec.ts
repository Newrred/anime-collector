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

async function searchCatalogResult(page: Page) {
  await page.goto("/");
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

  await row.getByRole("button", { name: "Create card" }).click();

  await expect(page).toHaveURL(new RegExp(`/memory/new/\\?animeId=${encodeURIComponent(catalogAnimeId)}`));
  await expect(page.getByLabel("작품 또는 카드 제목")).toHaveValue("카우보이 비밥");
  await expect(page.getByText("작품 정보 있음")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]"))).toEqual([]);
  expect(await memoryCardCount(page)).toBe(0);
});

test("catalog search Library action adds only the Library row and creates no Memory draft", async ({ page }) => {
  await installCatalogSearchFixture(page);
  const row = await searchCatalogResult(page);

  await row.getByRole("button", { name: "Add to Library" }).click();

  await expect(page).toHaveURL(/\/library\/\?animeId=1/u);
  const library = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]"));
  expect(library).toHaveLength(1);
  expect(library[0].anilistId).toBe(1);
  expect(await memoryCardCount(page)).toBe(0);
});
