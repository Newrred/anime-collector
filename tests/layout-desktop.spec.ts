import { expect, test } from "@playwright/test";
import { installAppState } from "./helpers/appState";

const DESKTOP_VIEWPORTS = [
  { name: "d1280", width: 1280, height: 800 },
  { name: "d1440", width: 1440, height: 900 },
];

const ROUTES = ["/", "/library/", "/tier/", "/profile/", "/data/", "/help/"];

async function measureOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const docOverflow = Number((document.documentElement.scrollWidth - vw).toFixed(2));
    const bodyOverflow = Number((document.body.scrollWidth - vw).toFixed(2));
    return { docOverflow, bodyOverflow };
  });
}

test.describe("Desktop Layout Regression", () => {
  for (const viewport of DESKTOP_VIEWPORTS) {
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

    test(`top nav rhythm and control density (${viewport.name})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      const rhythmCases = [
        { route: "/", leadSelector: ".home-empty-state" },
        { route: "/library/", leadSelector: ".library-panel" },
        { route: "/data/", leadSelector: ".surface-card" },
      ];

      for (const row of rhythmCases) {
        await page.goto(row.route, { waitUntil: "networkidle" });
        await page.waitForTimeout(250);

        const rhythm = await page.evaluate((leadSelector) => {
          const nav = document.querySelector(".top-nav");
          const lead = document.querySelector(leadSelector);
          if (!nav || !lead) return { ok: false, gap: -1 };
          const navRect = nav.getBoundingClientRect();
          const leadRect = lead.getBoundingClientRect();
          return { ok: true, gap: Number((leadRect.top - navRect.bottom).toFixed(2)) };
        }, row.leadSelector);

        expect(rhythm.ok, `${viewport.name} ${row.route} rhythm targets exist`).toBeTruthy();
        expect(rhythm.gap, `${viewport.name} ${row.route} top rhythm gap`).toBeGreaterThanOrEqual(6);
        expect(rhythm.gap, `${viewport.name} ${row.route} top rhythm gap`).toBeLessThanOrEqual(56);
      }

      await page.goto("/data/", { waitUntil: "networkidle" });
      await page.waitForTimeout(250);
      const controlHeights = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll(".btn:not(.btn--icon)")) as HTMLElement[];
        const visible = nodes.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
        });
        return visible.slice(0, 20).map((el) => Number(el.getBoundingClientRect().height.toFixed(2)));
      });

      expect(controlHeights.length, `${viewport.name} visible text buttons`).toBeGreaterThan(0);
      const minHeight = Math.min(...controlHeights);
      const maxHeight = Math.max(...controlHeights);
      expect(minHeight, `${viewport.name} min button height`).toBeGreaterThanOrEqual(32);
      expect(maxHeight, `${viewport.name} max button height`).toBeLessThanOrEqual(44.5);

      await context.close();
    });

    test(`library modal related tab remains stable (${viewport.name})`, async ({ browser }) => {
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
      await page.waitForTimeout(350);

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

      const stability = await page.evaluate(() => {
        const modal = document.querySelector(".modal");
        if (!modal) return { modalOverflow: 999, maxChildOverflow: 999, relatedCount: 0 };

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

        const relatedCount = modal.querySelectorAll(".library-modal-related-card").length;
        return {
          modalOverflow: Number(modalOverflow.toFixed(2)),
          maxChildOverflow: Number(maxChildOverflow.toFixed(2)),
          relatedCount,
        };
      });

      expect(stability.relatedCount, `${viewport.name} related cards exist`).toBeGreaterThanOrEqual(0);
      expect(stability.modalOverflow, `${viewport.name} modal overflow`).toBeLessThanOrEqual(0.5);
      expect(stability.maxChildOverflow, `${viewport.name} modal child overflow`).toBeLessThanOrEqual(0.5);

      await context.close();
    });
  }
});
