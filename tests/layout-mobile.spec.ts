import { expect, test } from "@playwright/test";
import { installAppState } from "./helpers/appState";

const MOBILE_VIEWPORTS = [
  { name: "m360", width: 360, height: 740 },
  { name: "m390", width: 390, height: 844 },
];

test("empty Home keeps its primary action in view at 320px and 390px", async ({ browser }) => {
  for (const viewport of [
    { width: 320, height: 720 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await installAppState(page, { locale: "en", list: [], watchLogs: [] });
    await page.goto("/");
    await expect(page.locator(".home-empty-state")).toBeVisible();

    const geometry = await page.evaluate(() => {
      const home = document.querySelector(".home-page");
      const copy = document.querySelector(".home-empty-state__copy");
      const cta = document.querySelector(".home-empty-state__actions .btn");
      const homeRect = home?.getBoundingClientRect();
      const copyRect = copy?.getBoundingClientRect();
      const ctaRect = cta?.getBoundingClientRect();
      return {
        homeWidth: homeRect?.width || 0,
        copyWidth: copyRect?.width || 0,
        ctaTop: ctaRect?.top || -1,
        ctaBottom: ctaRect?.bottom || 9999,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });

    expect(geometry.homeWidth).toBeLessThanOrEqual(Math.min(1200, geometry.viewportWidth));
    expect(geometry.copyWidth).toBeLessThanOrEqual(680);
    expect(geometry.ctaTop).toBeGreaterThanOrEqual(0);
    expect(geometry.ctaBottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.overflow).toBeLessThanOrEqual(0.5);
    await context.close();
  }
});

test("320px header keeps primary controls separate and at least 44px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await installAppState(page, { locale: "en", list: [], watchLogs: [] });
  await page.goto("/");
  await expect(page.locator(".top-nav")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const selectors = [
      ".top-nav__brand",
      ".top-nav__memory-action",
      ".quick-action__mobile-trigger",
      ".top-nav__mobile-menu-trigger",
    ];
    const rects = selectors.map((selector) => {
      const element = document.querySelector(`${selector}:not([hidden])`);
      const rect = element?.getBoundingClientRect();
      return rect ? { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    }).filter(Boolean);
    const overlaps = [];
    for (let first = 0; first < rects.length; first += 1) {
      for (let second = first + 1; second < rects.length; second += 1) {
        const a = rects[first];
        const b = rects[second];
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
          && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) {
          overlaps.push(`${a.selector}:${b.selector}`);
        }
      }
    }
    return { rects, overlaps, viewport: innerWidth };
  });

  expect(metrics.rects).toHaveLength(4);
  expect(metrics.rects.every((rect) => rect.width >= 44 && rect.height >= 44)).toBe(true);
  expect(metrics.rects.every((rect) => rect.left >= -0.5 && rect.right <= metrics.viewport + 0.5)).toBe(true);
  expect(metrics.overlaps).toEqual([]);
  await expect(page.locator(".quick-action__mobile-trigger:visible")).toHaveAccessibleName(
    "Open add title / find record search",
  );
});

const ROUTES = [
  "/",
  "/library/",
  "/tier/",
  "/profile/",
  "/data/",
  "/help/",
  "/memory/new/",
  "/archive/",
  "/memory/card/",
];

async function measureOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const docOverflow = Number((document.documentElement.scrollWidth - vw).toFixed(2));
    const bodyOverflow = Number((document.body.scrollWidth - vw).toFixed(2));
    return { docOverflow, bodyOverflow };
  });
}

test.describe("Mobile Layout Regression", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`no horizontal overflow across routes (${viewport.name})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);

        const { docOverflow, bodyOverflow } = await measureOverflow(page);
        expect(docOverflow, `${viewport.name} ${route} document overflow`).toBeLessThanOrEqual(0.5);
        expect(bodyOverflow, `${viewport.name} ${route} body overflow`).toBeLessThanOrEqual(0.5);
      }

      await context.close();
    });

    test(`library modal related tab keeps layout stable (${viewport.name})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      await installAppState(page, {
        locale: "en",
        list: [{ anilistId: 1, status: "완료", score: 9, memo: "fixture", addedAt: 1 }],
        watchLogs: [],
      });
      await page.goto("/library/", { waitUntil: "networkidle" });
      await page.waitForTimeout(400);

      const firstCard = page.locator(".library-grid .card").first();
      await expect(firstCard).toBeVisible();
      await firstCard.click();

      const modal = page.locator(".modal");
      await expect(modal).toBeVisible();

      const tabs = page.locator(".library-modal-tab");
      const tabCount = await tabs.count();
      expect(tabCount).toBeGreaterThanOrEqual(4);
      await tabs.nth(3).click();
      await page.waitForTimeout(250);

      const overflow = await page.evaluate(() => {
        const modal = document.querySelector(".modal");
        if (!modal) return { modalOverflow: 999, maxChildOverflow: 999 };

        const modalRect = modal.getBoundingClientRect();
        const modalOverflow = Math.max(modalRect.right - window.innerWidth, 0, 0 - modalRect.left);

        let maxChildOverflow = 0;
        const children = Array.from(modal.querySelectorAll("*"));
        for (const el of children) {
          const cs = window.getComputedStyle(el as Element);
          if (cs.position === "fixed") continue;
          const r = (el as Element).getBoundingClientRect();
          const ov = Math.max(r.right - window.innerWidth, 0, 0 - r.left);
          if (ov > maxChildOverflow) maxChildOverflow = ov;
        }

        return {
          modalOverflow: Number(modalOverflow.toFixed(2)),
          maxChildOverflow: Number(maxChildOverflow.toFixed(2)),
        };
      });

      expect(overflow.modalOverflow, `${viewport.name} modal overflow`).toBeLessThanOrEqual(0.5);
      expect(overflow.maxChildOverflow, `${viewport.name} modal child overflow`).toBeLessThanOrEqual(0.5);

      await context.close();
    });
  }
});
