import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { installAppState } from "./helpers/appState";

const quickLogFixture = {
  locale: "en" as const,
  list: [{ anilistId: 1, status: "completed", score: 9, memo: "fixture", addedAt: 1 }],
  watchLogs: [],
  mediaById: { "1": { id: 1, title: { english: "Fixture Anime", romaji: "Fixture Anime" }, genres: [] } },
};

test("closing a Library deep link clears it so reload does not reopen the detail", async ({ page }) => {
  await installAppState(page, quickLogFixture);
  await page.goto("/library/?animeId=1");
  await expect(page.locator(".modal")).toBeVisible();

  await page.locator(".modalCloseBtn").click();

  await expect(page.locator(".modal")).toBeHidden();
  await expect(page).toHaveURL(/\/library\/?$/u);
  await page.reload();
  await expect(page.locator(".modal")).toBeHidden();
});

test("opening and cancelling quick log does not persist a row", async ({ page }) => {
  await installAppState(page, quickLogFixture);
  await page.goto("/library/?animeId=1&focus=quick-log");
  const sheet = page.locator(".log-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Close", { exact: true }).click();
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toHaveLength(0);
});

test("saving then editing a quick log keeps one row", async ({ page }) => {
  await installAppState(page, quickLogFixture);
  await page.goto("/library/?animeId=1&focus=quick-log");
  const sheet = page.locator(".log-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  let logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toHaveLength(1);

  await page.locator(".modal .library-modal-tab").nth(1).click();
  await page.locator(".library-modal-log-actions .btn").first().click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toHaveLength(1);
});

test("failed quick log save keeps the draft available for retry", async ({ page }) => {
  await installAppState(page, quickLogFixture);
  await page.goto("/library/?animeId=1&focus=quick-log");
  const sheet = page.locator(".log-sheet");
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("One-line impression").fill("Retry me");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let failOnce = true;
    Storage.prototype.setItem = function scopedWatchLogFailure(key, value) {
      if (key === "anime:watchLogs:v1" && failOnce) {
        failOnce = false;
        throw new Error("simulated watch-log write failure");
      }
      return original.call(this, key, value);
    };
  });
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("alert")).toHaveText("Couldn't save this log. Try again.");
  await expect(sheet.getByLabel("One-line impression")).toHaveValue("Retry me");
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toHaveLength(0);

  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  const retriedLogs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(retriedLogs).toHaveLength(1);
  expect(retriedLogs[0]).toMatchObject({ cue: "Retry me" });
});

test("rapid repeated save clicks create exactly one quick log", async ({ page }) => {
  await installAppState(page, quickLogFixture);
  await page.goto("/library/?animeId=1&focus=quick-log");
  const sheet = page.locator(".log-sheet");
  const save = sheet.getByRole("button", { name: "Save" });
  await expect(save).toBeVisible();
  await sheet.evaluate((sheetElement: HTMLElement) => {
    const state = window as typeof window & {
      __sawQuickLogSaving?: boolean;
      __sawQuickLogCloseDisabled?: boolean;
      __sawQuickLogCloseDisabledStyle?: boolean;
    };
    state.__sawQuickLogSaving = false;
    state.__sawQuickLogCloseDisabled = false;
    state.__sawQuickLogCloseDisabledStyle = false;
    const saveButton = [...sheetElement.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Save") as HTMLButtonElement | undefined;
    const closeButton = sheetElement.querySelector('button[aria-label="Close"]') as HTMLButtonElement | null;
    const observer = new MutationObserver(() => {
      if (saveButton?.disabled && saveButton.textContent?.includes("Saving")) {
        state.__sawQuickLogSaving = true;
      }
      if (closeButton?.disabled) {
        state.__sawQuickLogCloseDisabled = true;
        const style = getComputedStyle(closeButton);
        state.__sawQuickLogCloseDisabledStyle =
          Number.parseFloat(style.opacity || "1") < 1 && style.cursor === "not-allowed";
      }
      if (state.__sawQuickLogSaving && state.__sawQuickLogCloseDisabledStyle) {
        observer.disconnect();
      }
    });
    observer.observe(sheetElement, { attributes: true, childList: true, subtree: true });
  });
  await save.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(sheet).toBeHidden();
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]"));
  expect(logs).toHaveLength(1);
  expect(await page.evaluate(() =>
    (window as typeof window & { __sawQuickLogSaving?: boolean }).__sawQuickLogSaving,
  )).toBe(true);
  expect(await page.evaluate(() =>
    (window as typeof window & { __sawQuickLogCloseDisabled?: boolean }).__sawQuickLogCloseDisabled,
  )).toBe(true);
  expect(await page.evaluate(() =>
    (window as typeof window & { __sawQuickLogCloseDisabledStyle?: boolean }).__sawQuickLogCloseDisabledStyle,
  )).toBe(true);
});

test("a failed IndexedDB mirror cannot hide a successful local quick log after reload", async ({ page }) => {
  await installAppState(page, quickLogFixture);
  await page.goto("/library/?animeId=1&focus=quick-log");
  const sheet = page.locator(".log-sheet");
  await expect(sheet).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("anime-collector-db", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction("watch_logs", "readwrite");
    tx.objectStore("watch_logs").put({
      id: "stale-idb-row",
      anilistId: 1,
      eventType: "completed",
      watchedAtPrecision: "day",
      watchedAtValue: "2026-07-01",
      watchedAtSort: 1,
      cue: "Stale IDB value",
      note: "",
      createdAt: 1,
      updatedAt: 1,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();

    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function failWatchLogMirror(value, key) {
      if (this.name === "watch_logs") throw new Error("simulated IndexedDB mirror failure");
      return originalPut.call(this, value, key);
    };
  });
  await sheet.getByLabel("One-line impression").fill("Local source survives");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();

  const reloadedPage = await page.context().newPage();
  await reloadedPage.goto("/library/?animeId=1");
  await expect(reloadedPage.locator(".modal")).toBeVisible();
  await reloadedPage.locator(".modal .library-modal-tab").nth(1).click();
  const rows = reloadedPage.locator(".library-modal-log-card");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Local source survives");
  await expect(rows.first()).not.toContainText("Stale IDB value");
  await reloadedPage.close();
});

type AddAttempt = {
  locale: "KO" | "EN";
  query: string;
  added: boolean;
  title?: string;
  reason?: string;
};

type FlowMetrics = {
  sectionCount: number;
  noMemoryRows: number;
  recentRows: number;
  thisTimeRows: number;
  maxCardOverflow: number;
  minCardGap: number;
};

const KO_QUERIES = [
  "\uC57D\uC0AC\uC758 \uD63C\uC7A3\uB9D0",
  "\uB2E8\uB2E4\uB2E8",
  "\uC8FC\uC220\uD68C\uC804",
];

const EN_QUERIES = [
  "Frieren",
  "Kaiju No. 8",
  "Blue Lock",
];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

const LIVE_E2E = process.env.MOEMOA_E2E_LIVE === "1";

const SEARCH_FIXTURE_BY_QUERY: Record<string, { id: number; title: string }> = {
  "약사의 혼잣말": { id: 101, title: "The Apothecary Diaries" },
  "단다단": { id: 102, title: "DAN DA DAN" },
  "주술회전": { id: 103, title: "Jujutsu Kaisen" },
  "Frieren": { id: 104, title: "Frieren: Beyond Journey's End" },
  "Kaiju No. 8": { id: 105, title: "Kaiju No. 8" },
  "Blue Lock": { id: 106, title: "Blue Lock" },
};

function fixtureMedia(id: number, title: string) {
  return {
    id,
    siteUrl: `https://anilist.co/anime/${id}`,
    title: { romaji: title, english: title, native: title },
    synonyms: [],
    genres: ["Adventure"],
    coverImage: { extraLarge: "", large: "", medium: "" },
    bannerImage: "",
    seasonYear: 2024,
    format: "TV",
    episodes: 12,
    characters: { edges: [] },
    relations: { edges: [] },
  };
}

const SEARCH_FIXTURE_MEDIA = new Map(
  Object.values(SEARCH_FIXTURE_BY_QUERY).map(({ id, title }) => [id, fixtureMedia(id, title)]),
);

async function installSearchFixtures(page: Page) {
  await page.route(/^https:\/\/graphql\.anilist\.co\/?$/, async (route) => {
    const variables = route.request().postDataJSON()?.variables || {};
    const search = String(variables.search || "");
    const ids = Array.isArray(variables.ids) ? variables.ids.map(Number) : [];
    const media = search
      ? (() => {
          const row = SEARCH_FIXTURE_BY_QUERY[search];
          return row ? [fixtureMedia(row.id, row.title)] : [];
        })()
      : ids.map((id) => SEARCH_FIXTURE_MEDIA.get(id)).filter(Boolean);

    await route.fulfill({ json: { data: { Page: { media } } } });
  });

  await page.route(/^https:\/\/(?:www\.)?wikidata\.org\//, (route) =>
    route.fulfill({ json: { search: [], entities: {}, query: { search: [] } } }),
  );
  await page.route(/^https:\/\/query\.wikidata\.org\//, (route) =>
    route.fulfill({ json: { head: { vars: [] }, results: { bindings: [] } } }),
  );
}

async function installFreshState(page: Page) {
  await page.addInitScript(() => {
    const initializedKey = "moemoa.e2e.fresh-state.initialized";
    if (sessionStorage.getItem(initializedKey)) return;
    sessionStorage.setItem(initializedKey, "1");
    localStorage.clear();
    indexedDB.deleteDatabase("anime-collector-db");
  });
}

async function openGlobalSearch(page: Page) {
  const mobileTrigger = page.locator(".quick-action__mobile-trigger:visible");
  if (await mobileTrigger.count()) await mobileTrigger.click();

  const searchInput = page.locator(".quick-action__input:visible");
  await expect(searchInput).toBeVisible();
  return searchInput;
}

async function switchLocale(page: Page, code: "KO" | "EN") {
  const localeTrigger = page.locator('button[aria-controls="locale-menu-panel"]:visible');
  if (await localeTrigger.count()) {
    await localeTrigger.click();
    const panel = page.locator("#locale-menu-panel");
    await expect(panel).toBeVisible();
    await panel.locator(".data-menu-locale-option").filter({ hasText: code }).first().click();
    await expect(panel).toBeHidden();
    return;
  }

  await page.locator(".top-nav__mobile-menu-trigger:visible").click();
  const mobileMenu = page.locator("#data-menu-panel");
  await expect(mobileMenu).toBeVisible();
  await mobileMenu.locator(".top-nav-mobile-locale-row .btn").filter({ hasText: code }).click();
  await expect(mobileMenu).toBeHidden();
}

async function addByQuery(
  page: Page,
  locale: "KO" | "EN",
  query: string,
  expectedTitle?: string,
): Promise<AddAttempt> {
  try {
    const input = await openGlobalSearch(page);
    await input.fill(query);

    const addLabel = locale === "KO" ? "기록장에 추가" : "Add to Library";
    const remoteRow = page.locator(".quick-action-section").filter({
      has: page.getByRole("button", { name: addLabel }),
    }).last();
    const addButton = remoteRow.getByRole("button", { name: addLabel }).first();
    await expect(addButton).toBeVisible({ timeout: 20000 });
    const title = (await remoteRow.locator(".quick-action-row__title").first().innerText()).trim();
    if (expectedTitle) expect(title, `${query} fixture result title`).toBe(expectedTitle);
    const libraryCountBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]").length);

    await addButton.click();
    await expect.poll(
      () => page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]").length),
    ).toBe(libraryCountBefore + 1);
    await expect(page.getByRole("status")).toBeVisible();
    const addedAnimeId = await page.evaluate(() => {
      const rows = JSON.parse(localStorage.getItem("anime:list:v1") || "[]");
      return rows[rows.length - 1]?.anilistId;
    });
    await page.goto(`/library/?animeId=${addedAnimeId}`);
    await expect(page.locator(".modal")).toBeVisible();
    await page.locator(".modalCloseBtn").click();
    await expect(page.locator(".modal")).toBeHidden();

    return { locale, query, added: true, title };
  } catch (error) {
    return {
      locale,
      query,
      added: false,
      reason: error instanceof Error ? error.message : "unknown-error",
    };
  }
}

async function readWatchLogCount(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("anime:watchLogs:v1") || "[]").length);
}

async function createQuickLogs(page: Page, count: number): Promise<number> {
  const cards = page.locator(".library-grid .library-card");
  await expect(cards.first()).toBeVisible();
  const totalCards = await cards.count();
  const target = Math.min(count, totalCards);
  let created = 0;

  for (let i = 0; i < target; i += 1) {
    const card = page.locator(".library-grid .library-card").nth(i);
    await card.click();
    await expect(page.locator(".modal")).toBeVisible();

    const tabs = page.locator(".modal .library-modal-tab");
    await tabs.nth(1).click();

    const addLogButton = page.locator(".modal .library-modal-inline-actions .btn").first();
    await expect(addLogButton).toBeVisible();
    await addLogButton.click();

    const sheet = page.locator(".log-sheet");
    await expect(sheet).toBeVisible();
    const logsBeforeSave = await readWatchLogCount(page);
    await sheet.locator("textarea.textarea").fill(`Playwright UX flow log ${i + 1}`);
    expect(await readWatchLogCount(page), `log ${i + 1} should not persist before Save`).toBe(logsBeforeSave);
    await sheet.locator(".log-sheet__footer .btn").last().click();
    await expect(sheet).toBeHidden();
    await expect.poll(() => readWatchLogCount(page)).toBe(logsBeforeSave + 1);

    await page.locator(".modalCloseBtn").click();
    await expect(page.locator(".modal")).toBeHidden();
    created += 1;
  }

  expect(await readWatchLogCount(page), "quick-log helper should persist exactly its created rows").toBe(target);
  return created;
}

async function assertFreshEnglishNavigation(page: Page, viewport: (typeof VIEWPORTS)[number]) {
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  if (viewport.width > 900) {
    const primary = page.locator(".top-nav__links--routes");
    await expect(primary.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Library" })).toBeVisible();
    await expect(primary.getByRole("link", { name: "Tier" })).toBeVisible();
    return;
  }

  await page.locator(".top-nav__mobile-menu-trigger:visible").click();
  const mobileMenu = page.locator("#data-menu-panel");
  const primary = mobileMenu.locator(".top-nav-mobile-links");
  await expect(primary.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Library" })).toBeVisible();
  await expect(primary.getByRole("link", { name: "Tier" })).toBeVisible();
  await page.locator(".top-nav__mobile-menu-trigger:visible").click();
  await expect(mobileMenu).toBeHidden();
}

async function assertUnconfiguredCloudInEnglish(page: Page) {
  await page.goto("/data/", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const syncCard = page.locator(".sync-card");
  await expect(syncCard).toContainText("Local only");
  await expect(syncCard).toContainText("Unavailable");
  await expect(syncCard).not.toContainText("Cloud backup found");
}

async function evaluateHomeDiscovery(page: Page): Promise<FlowMetrics> {
  return page.evaluate(() => {
    const sectionBlocks = Array.from(document.querySelectorAll(".home-resurfacing-grid .home-section-block"));
    const noMemoryRows = document.querySelectorAll(".home-resurfacing-grid .home-section-block:nth-child(1) .list-stack .list-card").length;
    const recentRows = document.querySelectorAll(".home-resurfacing-grid .home-section-block:nth-child(2) .list-stack .list-card").length;
    const thisTimeRows = document.querySelectorAll(".home-resurfacing-grid .home-section-block:nth-child(3) .list-stack .list-card").length;

    const cards = Array.from(document.querySelectorAll(".home-resurfacing-grid .list-card")) as HTMLElement[];
    let maxCardOverflow = 0;
    let minCardGap = Number.POSITIVE_INFINITY;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const overflow = Math.max(rect.right - window.innerWidth, 0, -rect.left);
      if (overflow > maxCardOverflow) maxCardOverflow = overflow;
    }

    const stacks = Array.from(document.querySelectorAll(".home-resurfacing-grid .list-stack")) as HTMLElement[];
    for (const stack of stacks) {
      const stackCards = Array.from(stack.querySelectorAll(":scope > .list-card")) as HTMLElement[];
      for (let i = 1; i < stackCards.length; i += 1) {
        const prev = stackCards[i - 1].getBoundingClientRect();
        const current = stackCards[i].getBoundingClientRect();
        const gap = current.top - prev.bottom;
        if (gap < minCardGap) minCardGap = gap;
      }
    }

    return {
      sectionCount: sectionBlocks.length,
      noMemoryRows,
      recentRows,
      thisTimeRows,
      maxCardOverflow: Number(maxCardOverflow.toFixed(2)),
      minCardGap: Number((Number.isFinite(minCardGap) ? minCardGap : 0).toFixed(2)),
    };
  });
}

async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
}

async function runFlow(
  browser: Browser,
  testInfo: TestInfo,
  width: number,
  height: number,
  mode: "fixture" | "live",
) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const addAttempts: AddAttempt[] = [];

  await installFreshState(page);
  if (mode === "fixture") await installSearchFixtures(page);

  await page.goto("/library/", { waitUntil: "networkidle" });
  await expect(page.locator(".library-page")).toBeVisible();

  const viewport = { name: width <= 900 ? "mobile" : "desktop", width, height } as const;
  if (mode === "fixture") {
    await assertFreshEnglishNavigation(page, viewport);
  }

  const cardsBefore = await page.locator(".library-grid .library-card").count();
  if (mode === "fixture") {
    expect(cardsBefore, "fresh fixture flow starts with an empty library").toBe(0);
    await assertUnconfiguredCloudInEnglish(page);
    await page.goto("/library/", { waitUntil: "networkidle" });
    await expect(page.locator(".library-page")).toBeVisible();
  }

  await switchLocale(page, "KO");
  for (const query of KO_QUERIES) {
    addAttempts.push(await addByQuery(page, "KO", query, mode === "fixture" ? SEARCH_FIXTURE_BY_QUERY[query]?.title : undefined));
  }
  await screenshot(page, testInfo, "library-after-ko-add.png");

  await switchLocale(page, "EN");
  for (const query of EN_QUERIES) {
    addAttempts.push(await addByQuery(page, "EN", query, mode === "fixture" ? SEARCH_FIXTURE_BY_QUERY[query]?.title : undefined));
  }
  await screenshot(page, testInfo, "library-after-en-add.png");

  const cardsAfter = await page.locator(".library-grid .library-card").count();
  expect(await readWatchLogCount(page), "adding unsorted titles should not create watch logs").toBe(0);
  const logsCreated = await createQuickLogs(page, 3);
  const persistedWatchLogs = await readWatchLogCount(page);

  await page.goto("/", { waitUntil: "networkidle" });
  const discovery = await evaluateHomeDiscovery(page);
  await screenshot(page, testInfo, "home-after-logs.png");

  const report = {
    viewport: { width, height },
    cardsBefore,
    cardsAfter,
    logsCreated,
    persistedWatchLogs,
    addedCount: addAttempts.filter((row) => row.added).length,
    addedByCardDelta: Math.max(cardsAfter - cardsBefore, 0),
    addAttempts,
    discovery,
  };

  await testInfo.attach("ux-flow-report", {
    body: Buffer.from(JSON.stringify(report, null, 2), "utf-8"),
    contentType: "application/json",
  });
  await writeFile(testInfo.outputPath("ux-flow-report.json"), JSON.stringify(report, null, 2), "utf-8");
  // Keep a human-readable trace in stdout for quick debugging in local runs.
  console.log("[library-userflow]", JSON.stringify(report));

  await context.close();
  return report;
}

async function expectFlowContract(browser: Browser, testInfo: TestInfo, viewport: (typeof VIEWPORTS)[number], mode: "fixture" | "live") {
  const report = await runFlow(browser, testInfo, viewport.width, viewport.height, mode);

  expect(report.cardsAfter, `${viewport.name} card count should not decrease`).toBeGreaterThanOrEqual(report.cardsBefore);
  expect(report.logsCreated, `${viewport.name} should create the three requested quick logs`).toBe(3);
  expect(report.persistedWatchLogs, `${viewport.name} should persist exactly the three saved quick logs`).toBe(3);

  expect(report.discovery.sectionCount, `${viewport.name} discovery section blocks`).toBeGreaterThanOrEqual(2);
  expect(report.discovery.recentRows, `${viewport.name} recent discovery rows`).toBeGreaterThanOrEqual(1);
  expect(report.discovery.maxCardOverflow, `${viewport.name} discovery card overflow`).toBeLessThanOrEqual(0.5);
  expect(report.discovery.minCardGap, `${viewport.name} discovery card vertical gap`).toBeGreaterThanOrEqual(4);
  expect(report.addAttempts.length, `${viewport.name} query attempt count`).toBe(KO_QUERIES.length + EN_QUERIES.length);
  expect(report.addedCount, `${viewport.name} searches should add every fixture title`).toBe(KO_QUERIES.length + EN_QUERIES.length);
  if (mode === "fixture") {
    expect(report.addedByCardDelta, `${viewport.name} should add exactly six fixture cards`).toBe(6);
  }
}

test.describe("Library UX fixture flow", () => {
  test.skip(LIVE_E2E, "The explicit live command runs the external-network variant instead.");
  test.setTimeout(120000);

  for (const viewport of VIEWPORTS) {
    test(`search/add/log/discovery flow works (${viewport.name})`, async ({ browser, browserName }, testInfo) => {
      test.skip(browserName !== "chromium", "flow test is validated on chromium");
      await expectFlowContract(browser, testInfo, viewport, "fixture");
    });
  }
});

test.describe("Library UX live flow", () => {
  test.skip(!LIVE_E2E, "Set MOEMOA_E2E_LIVE=1 through the live-only command to call AniList and Wikidata.");
  test.setTimeout(240000);

  for (const viewport of VIEWPORTS) {
    test(`search/add/log/discovery flow works (${viewport.name})`, async ({ browser, browserName }, testInfo) => {
      test.skip(browserName !== "chromium", "flow test is validated on chromium");
      await expectFlowContract(browser, testInfo, viewport, "live");
    });
  }
});
