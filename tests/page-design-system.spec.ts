import { expect, test } from "@playwright/test";

const MOCK_SESSION_KEY = "moemoa.e2e.mockSession.v1";
const MOCK_PROFILE_STORE_KEY = "moemoa.e2e.profileStore.v1";

const ROUTES = [
  { route: "/", root: ".home-page", leadSelector: ".home-empty-state", cardSelector: ".surface-card", minPadding: 12, maxPadding: 24.5 },
  { route: "/library/", root: ".library-page", leadSelector: ".library-panel", cardSelector: ".library-panel, .library-card, .card", minPadding: 0, maxPadding: 24.5 },
  { route: "/tier/", root: ".tier-board", leadSelector: ".tier-board__header", cardSelector: ".surface-card", minPadding: 12, maxPadding: 24.5 },
  { route: "/profile/", root: ".profile-page", leadSelector: ".minihome-hero-card", auth: true, cardSelector: ".surface-card", minPadding: 12, maxPadding: 24.5 },
  { route: "/data/", root: ".data-grid", leadSelector: ".status-panel", cardSelector: ".surface-card", minPadding: 12, maxPadding: 24.5 },
  { route: "/help/", root: ".help-page", leadSelector: ".status-panel", cardSelector: ".surface-card", minPadding: 12, maxPadding: 24.5 },
  { route: "/u/?handle=playwright-user", root: ".profile-page", leadSelector: ".profile-hero-card", auth: true, cardSelector: ".surface-card", minPadding: 12, maxPadding: 24.5 },
];

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

async function seedMockAuth(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ sessionKey, profileKey }) => {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          user: {
            id: "e2e-user-1",
            email: "playwright@example.com",
            aud: "authenticated",
            role: "authenticated",
          },
        })
      );
      localStorage.setItem(
        profileKey,
        JSON.stringify({
          "e2e-user-1": {
            userId: "e2e-user-1",
            handle: "playwright-user",
            displayName: "Playwright User",
            bio: "Mock public profile for design-system checks.",
            profilePublic: true,
            createdAt: "2026-03-19T00:00:00.000Z",
            updatedAt: "2026-03-19T00:00:00.000Z",
          },
        })
      );
    },
    {
      sessionKey: MOCK_SESSION_KEY,
      profileKey: MOCK_PROFILE_STORE_KEY,
    }
  );
}

async function collectDesignMetrics(page: import("@playwright/test").Page, leadSelector: string, cardSelector: string) {
  return page.evaluate(({ selector, cardsSelector }) => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };

    const cards = Array.from(document.querySelectorAll(cardsSelector)).filter(isVisible);
    const buttons = Array.from(document.querySelectorAll(".btn")).filter(isVisible);
    const nav = document.querySelector(".top-nav");
    const lead = document.querySelector(selector);

    const radiusValues = cards.map((card) => Number.parseFloat(window.getComputedStyle(card).borderTopLeftRadius || "0"));
    const paddingValues = cards.map((card) => Number.parseFloat(window.getComputedStyle(card).paddingTop || "0"));
    const buttonHeights = buttons.map((button) => Number(button.getBoundingClientRect().height.toFixed(2)));

    let rhythmGap = -1;
    if (nav && lead) {
      const navRect = nav.getBoundingClientRect();
      const leadRect = lead.getBoundingClientRect();
      rhythmGap = Number((leadRect.top - navRect.bottom).toFixed(2));
    }

    return {
      docOverflow: Number((document.documentElement.scrollWidth - window.innerWidth).toFixed(2)),
      bodyOverflow: Number((document.body.scrollWidth - window.innerWidth).toFixed(2)),
      cardCount: cards.length,
      minRadius: radiusValues.length ? Math.min(...radiusValues) : 0,
      maxRadius: radiusValues.length ? Math.max(...radiusValues) : 0,
      minPadding: paddingValues.length ? Math.min(...paddingValues) : 0,
      maxPadding: paddingValues.length ? Math.max(...paddingValues) : 0,
      minButtonHeight: buttonHeights.length ? Math.min(...buttonHeights) : 0,
      maxButtonHeight: buttonHeights.length ? Math.max(...buttonHeights) : 0,
      rhythmGap,
    };
  }, { selector: leadSelector, cardsSelector: cardSelector });
}

test.describe("Page Design System Consistency", () => {
  for (const viewport of VIEWPORTS) {
    test(`shared layout rules stay aligned across routes (${viewport.name})`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const routeConfig of ROUTES) {
        const page = await context.newPage();
        if (routeConfig.auth) {
          await seedMockAuth(page);
        }

        await page.goto(routeConfig.route, { waitUntil: "networkidle" });
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.locator(".top-nav")).toBeVisible();
        await expect(page.locator(routeConfig.root)).toBeVisible();

        const metrics = await collectDesignMetrics(
          page,
          routeConfig.leadSelector,
          routeConfig.cardSelector || ".surface-card"
        );
        expect(metrics.docOverflow, `${viewport.name} ${routeConfig.route} document overflow`).toBeLessThanOrEqual(0.5);
        expect(metrics.bodyOverflow, `${viewport.name} ${routeConfig.route} body overflow`).toBeLessThanOrEqual(0.5);
        expect(metrics.cardCount, `${viewport.name} ${routeConfig.route} visible surface cards`).toBeGreaterThan(0);
        expect(metrics.minRadius, `${viewport.name} ${routeConfig.route} min card radius`).toBeGreaterThanOrEqual(8);
        expect(metrics.maxRadius, `${viewport.name} ${routeConfig.route} max card radius`).toBeLessThanOrEqual(12.5);
        expect(metrics.minPadding, `${viewport.name} ${routeConfig.route} min card padding`).toBeGreaterThanOrEqual(routeConfig.minPadding ?? 12);
        expect(metrics.maxPadding, `${viewport.name} ${routeConfig.route} max card padding`).toBeLessThanOrEqual(routeConfig.maxPadding ?? 24.5);
        expect(metrics.minButtonHeight, `${viewport.name} ${routeConfig.route} min button height`).toBeGreaterThanOrEqual(32);
        expect(metrics.maxButtonHeight, `${viewport.name} ${routeConfig.route} max button height`).toBeLessThanOrEqual(48);
        expect(metrics.rhythmGap, `${viewport.name} ${routeConfig.route} content rhythm gap`).toBeGreaterThanOrEqual(0);
        expect(metrics.rhythmGap, `${viewport.name} ${routeConfig.route} content rhythm gap`).toBeLessThanOrEqual(56);

        await page.close();
      }

      await context.close();
    });
  }
});
