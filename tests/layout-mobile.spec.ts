import { expect, test } from "@playwright/test";
import { installAppState } from "./helpers/appState";

const MOBILE_VIEWPORTS = [
  { name: "m360", width: 360, height: 740 },
  { name: "m390", width: 390, height: 844 },
];

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
