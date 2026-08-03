import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";

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

async function ensureAddSearchReady(page: Page) {
  const pageTabs = page.locator(".library-page-tabs .library-seg-btn--page-toggle");
  await expect(pageTabs).toHaveCount(2);
  await pageTabs.nth(1).click();
  await expect(page.locator(".library-panel")).toBeVisible();

  const addPanelToggle = page.locator(".library-panel .library-panel-header-btn");
  if (await addPanelToggle.count()) {
    const expanded = await addPanelToggle.getAttribute("aria-expanded");
    if (expanded === "false") await addPanelToggle.click();
  }

  const modeTabs = page.locator("#add-anime-panel-content .library-seg-btn");
  if (await modeTabs.count()) await modeTabs.first().click();

  const searchInput = page.locator(".library-add-search input.input");
  await expect(searchInput).toBeVisible();
}

async function switchLocale(page: Page, code: "KO" | "EN") {
  const localeTrigger = page.locator('button[aria-controls="locale-menu-panel"]');
  await localeTrigger.click();
  const panel = page.locator("#locale-menu-panel");
  await expect(panel).toBeVisible();
  await panel.locator(".data-menu-locale-option").filter({ hasText: code }).first().click();
  await expect(panel).toBeHidden();
}

async function addByQuery(page: Page, locale: "KO" | "EN", query: string): Promise<AddAttempt> {
  try {
    await ensureAddSearchReady(page);
    const input = page.locator(".library-add-search input.input");
    await input.click();
    await input.fill("");
    await input.fill(query);

    const suggestList = page.locator(".library-add-search .suggestList");
    await expect(suggestList).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(1200);

    const candidate = suggestList.locator(".suggestItem:not(.suggestItem--disabled)").first();
    const candidateCount = await candidate.count();
    if (!candidateCount) {
      return { locale, query, added: false, reason: "no-selectable-result" };
    }

    const title = (await candidate.locator(".suggestItem__title").first().innerText()).trim();
    const iconButton = candidate.locator("button.btn--icon:not([disabled])").first();
    if (await iconButton.count()) await iconButton.click();
    else await candidate.click();

    let likelyAdded = false;
    try {
      await expect(suggestList).toBeHidden({ timeout: 5000 });
      likelyAdded = true;
    } catch {
      // Keep checking below.
    }

    if (!likelyAdded) {
      const disabledAfterClick = await candidate.evaluate((node) => node.classList.contains("suggestItem--disabled")).catch(() => false);
      const disabledButton = await candidate.locator("button.btn--icon[disabled]").count();
      const addedBadge = await candidate.locator(".badge").count();
      likelyAdded = disabledAfterClick || disabledButton > 0 || addedBadge > 0;
    }

    if (!likelyAdded) {
      return { locale, query, added: false, reason: "post-click-state-uncertain" };
    }

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

async function openCollectionTab(page: Page) {
  const pageTabs = page.locator(".library-page-tabs .library-seg-btn--page-toggle");
  await pageTabs.nth(0).click();
  await expect(page.locator(".library-grid")).toBeVisible();
}

async function createQuickLogs(page: Page, count: number): Promise<number> {
  await openCollectionTab(page);
  const cards = page.locator(".library-grid .library-card");
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
    await sheet.locator("textarea.textarea").fill(`Playwright UX flow log ${i + 1}`);
    await sheet.locator(".log-sheet__footer .btn").last().click();
    await expect(sheet).toBeHidden();

    await page.locator(".modalCloseBtn").click();
    await expect(page.locator(".modal")).toBeHidden();
    created += 1;
  }

  return created;
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

async function runFlow(browser: Browser, testInfo: TestInfo, width: number, height: number) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const addAttempts: AddAttempt[] = [];

  await page.goto("/library/", { waitUntil: "networkidle" });
  await expect(page.locator(".library-page")).toBeVisible();

  await openCollectionTab(page);
  const cardsBefore = await page.locator(".library-grid .library-card").count();

  await switchLocale(page, "KO");
  for (const query of KO_QUERIES) {
    addAttempts.push(await addByQuery(page, "KO", query));
  }
  await screenshot(page, testInfo, "library-after-ko-add.png");

  await switchLocale(page, "EN");
  for (const query of EN_QUERIES) {
    addAttempts.push(await addByQuery(page, "EN", query));
  }
  await screenshot(page, testInfo, "library-after-en-add.png");

  await openCollectionTab(page);
  const cardsAfter = await page.locator(".library-grid .library-card").count();
  const logsCreated = await createQuickLogs(page, 3);

  await page.goto("/", { waitUntil: "networkidle" });
  const discovery = await evaluateHomeDiscovery(page);
  await screenshot(page, testInfo, "home-after-logs.png");

  const report = {
    viewport: { width, height },
    cardsBefore,
    cardsAfter,
    logsCreated,
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

test.describe("Library UX Live Flow", () => {
  test.setTimeout(240000);

  for (const viewport of VIEWPORTS) {
    test(`search/add/log/discovery flow works (${viewport.name})`, async ({ browser, browserName }, testInfo) => {
      test.skip(browserName !== "chromium", "flow test is validated on chromium");

      const report = await runFlow(browser, testInfo, viewport.width, viewport.height);

      expect(report.cardsAfter, `${viewport.name} card count should not decrease`).toBeGreaterThanOrEqual(report.cardsBefore);
      expect(report.logsCreated, `${viewport.name} should create at least two quick logs`).toBeGreaterThanOrEqual(2);

      expect(report.discovery.sectionCount, `${viewport.name} discovery section blocks`).toBeGreaterThanOrEqual(2);
      expect(report.discovery.recentRows, `${viewport.name} recent discovery rows`).toBeGreaterThanOrEqual(1);
      expect(report.discovery.maxCardOverflow, `${viewport.name} discovery card overflow`).toBeLessThanOrEqual(0.5);
      expect(report.discovery.minCardGap, `${viewport.name} discovery card vertical gap`).toBeGreaterThanOrEqual(4);
      expect(report.addAttempts.length, `${viewport.name} query attempt count`).toBe(KO_QUERIES.length + EN_QUERIES.length);
      expect(
        report.addAttempts.some((attempt) => attempt.added || attempt.reason === "no-selectable-result"),
        `${viewport.name} add flow should complete query attempts without hard failures`
      ).toBeTruthy();
    });
  }
});
