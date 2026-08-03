import { expect, test } from "@playwright/test";

const MOCK_SESSION_KEY = "moemoa.e2e.mockSession.v1";
const MOCK_PROFILE_STORE_KEY = "moemoa.e2e.profileStore.v1";
const MOCK_SHOWCASE_LAYOUT_STORE_KEY = "moemoa.e2e.showcaseLayoutStore.v1";
const MOCK_PUBLIC_SHOWCASE_STORE_KEY = "moemoa.e2e.publicShowcaseStore.v1";

const MOCK_USER_ID = "e2e-user-1";

const MOCK_LAYOUT = {
  version: 2,
  widgets: [
    { id: "resonanceShelf", enabled: true, size: "wide" },
    { id: "memoryLineShelf", enabled: true, size: "wide" },
    { id: "thisTimeCapsule", enabled: true, size: "half" },
    { id: "tasteFingerprint", enabled: true, size: "half" },
    { id: "logDensityCalendar", enabled: true, size: "wide" },
    { id: "characterGravity", enabled: true, size: "wide" },
    { id: "genreWordHeatmap", enabled: true, size: "wide" },
    { id: "posterPalette", enabled: true, size: "half" },
  ],
};

async function seedMockAuth(page: import("@playwright/test").Page) {
  await page.addInitScript(
    ({ sessionKey, profileKey, layoutKey, publicKey, userId, layout }) => {
      localStorage.setItem(
        sessionKey,
        JSON.stringify({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          user: {
            id: userId,
            email: "playwright@example.com",
            aud: "authenticated",
            role: "authenticated",
            user_metadata: { name: "Playwright User" },
            app_metadata: { provider: "google" },
          },
        })
      );
      localStorage.setItem(
        profileKey,
        JSON.stringify({
          [userId]: {
            userId,
            handle: "playwright-user",
            displayName: "Playwright User",
            bio: "Authenticated minihome flow for Playwright.",
            profilePublic: false,
            createdAt: "2026-03-19T00:00:00.000Z",
            updatedAt: "2026-03-19T00:00:00.000Z",
          },
        })
      );
      localStorage.setItem(layoutKey, JSON.stringify({ [userId]: layout }));
      localStorage.removeItem(publicKey);
    },
    {
      sessionKey: MOCK_SESSION_KEY,
      profileKey: MOCK_PROFILE_STORE_KEY,
      layoutKey: MOCK_SHOWCASE_LAYOUT_STORE_KEY,
      publicKey: MOCK_PUBLIC_SHOWCASE_STORE_KEY,
      userId: MOCK_USER_ID,
      layout: MOCK_LAYOUT,
    }
  );
}

test.describe("Authenticated Minihome Flow", () => {
  test("logged-in profile shows editable minihome workbench", async ({ page }) => {
    await seedMockAuth(page);
    await page.goto("/profile/", { waitUntil: "networkidle" });

    await expect(page.locator(".profile-signin-card")).toHaveCount(0);
    await expect(page.locator(".minihome-hero-card")).toBeVisible();
    await expect(page.locator(".showcase-grid__item")).toHaveCount(8);
    await expect(page.locator(".showcase-editor-row")).toHaveCount(8);

    await page.locator(".minihome-settings__actions .btn").click();
    await expect(page.locator(".profile-form")).toBeVisible();

    const inputs = page.locator(".profile-form .input");
    await inputs.nth(0).fill("Playwright Minihome");
    await inputs.nth(1).fill("playwright-minihome");
    await page.locator(".profile-form textarea").fill("Testing the authenticated minihome editor.");
    await page.locator(".profile-form .action-row .btn").first().click();

    await expect(page.locator(".profile-link-box-stack")).toBeVisible();
    await expect(page.locator(".profile-link-box__value").first()).toContainText("Playwright Minihome");
    await expect(page.locator(".profile-link-box__value").nth(1)).toContainText("/u/?handle=playwright-minihome");

    const firstTitle = await page.locator(".showcase-editor-row__title").first().innerText();
    await page.locator(".showcase-editor-row").first().locator(".showcase-editor-row__icon-btn").nth(1).click();
    await page.locator(".minihome-controls .action-row .btn--subtle").click();
    await expect(page.locator(".showcase-editor-row__title").first()).not.toHaveText(firstTitle);

    await page.locator(".minihome-controls .action-row .btn").last().click();
    await page.waitForFunction(
      ({ key, userId }) => {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed?.[userId]?.layout || parsed?.[userId]?.profile || parsed?.[userId]?.widgets || parsed?.[userId]);
      },
      { key: MOCK_PUBLIC_SHOWCASE_STORE_KEY, userId: MOCK_USER_ID }
    );
  });
});
