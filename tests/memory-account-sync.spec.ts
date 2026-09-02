import { expect, test, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_ID = "22222222-2222-4222-8222-222222222222";
const DEVICE_ID = "33333333-3333-4333-8333-333333333333";
const GUEST_OWNER_ID = `guest:${INSTALLATION_ID}`;
const MOCK_SESSION_KEY = "moemoa.e2e.mockSession.v1";

async function installAccountAdapters(page: Page, options: { signedIn?: boolean; guestCards?: number; fail?: boolean; activeAccount?: boolean } = {}) {
  await page.addInitScript(({ signedIn, guestCards, fail, activeAccount, userId, installationId, deviceId, guestOwnerId, sessionKey }) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("en"));
    if (signedIn) {
      localStorage.setItem(sessionKey, JSON.stringify({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        user: { id: userId, email: "memory@example.test" },
      }));
    }

    const calls: string[] = [];
    const guestOwner: any = { id: guestOwnerId, kind: "GUEST", createdAt: "2026-09-02T00:00:00.000Z" };
    const accountOwner: any = { id: `account:${userId}`, kind: "ACCOUNT", userId, createdAt: "2026-09-02T00:00:00.000Z" };
    let activeOwner: any = activeAccount ? accountOwner : guestOwner;
    const owners = new Map([[guestOwnerId, guestOwner], [accountOwner.id, accountOwner]]);
    const deviceStates = new Map();
    (window as any).__MOEMOA_TEST_MEMORY_CALLS__ = calls;
    (window as any).__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__ = {
      enabled: true,
      repository: {
        async ensureInstallationIdentity() {
          return { installationId, guestOwner: owners.get(guestOwnerId) };
        },
        async getActiveOwner() { return structuredClone(activeOwner); },
        async ensureAccountOwner({ userId: nextUserId }: any) {
          const owner = { id: `account:${nextUserId}`, kind: "ACCOUNT", userId: nextUserId, createdAt: "2026-09-02T00:00:00.000Z" };
          owners.set(owner.id, owner);
          return structuredClone(owner);
        },
        async activateOwner({ ownerId }: any) {
          activeOwner = owners.get(ownerId);
          return structuredClone(activeOwner);
        },
        async rotateGuestOwnerAfterPromotion({ uuid }: any) {
          calls.push("rotate_guest_owner");
          const owner = { id: `guest:${uuid}`, kind: "GUEST", createdAt: "2026-09-02T00:00:00.000Z" };
          owners.set(owner.id, owner);
          activeOwner = owner;
          return structuredClone(owner);
        },
        async countCompleteCards(ownerId: string) { return ownerId === guestOwnerId ? guestCards : 0; },
      },
      gateway: {
        async ensureUserProfile(input: any) {
          calls.push("ensure_user_profile");
          if (fail) throw Object.assign(new Error("select private.secret"), { code: "MEMORY_GATEWAY_FAILED" });
          return { userId, ...input, minimumRetainedSyncSeq: 0 };
        },
        async registerDevice(input: any) {
          calls.push("register_user_device");
          return { ...input, id: input.deviceId, lastSyncSeq: 0 };
        },
      },
      readDeviceSyncState: async (ownerId: string) => structuredClone(deviceStates.get(ownerId) || null),
      writeDeviceSyncState: async (state: any) => { deviceStates.set(state.ownerId, structuredClone(state)); },
      uuid: () => deviceId,
      clock: { now: () => "2026-09-02T00:00:00.000Z" },
      appVersion: "e2e",
      locale: "en",
      timeZone: "UTC",
    };
  }, {
    signedIn: Boolean(options.signedIn),
    guestCards: Number(options.guestCards || 0),
    fail: Boolean(options.fail),
    activeAccount: Boolean(options.activeAccount),
    userId: USER_ID,
    installationId: INSTALLATION_ID,
    deviceId: DEVICE_ID,
    guestOwnerId: GUEST_OWNER_ID,
    sessionKey: MOCK_SESSION_KEY,
  });
}

test("Data Center shows local-only Memory state without legacy cloud calls", async ({ page }) => {
  await installAccountAdapters(page);
  await page.goto("/data/");
  await expect(page.getByRole("heading", { name: "Memory account" })).toBeVisible();
  await expect(page.getByText("Local only", { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as any).__MOEMOA_TEST_MEMORY_CALLS__)).toEqual([]);
});

test("signed-in Memory account reports promotion available", async ({ page }) => {
  await installAccountAdapters(page, { signedIn: true, guestCards: 2 });
  await page.goto("/data/");
  await expect(page.getByText("Signed in — promotion available", { exact: true })).toBeVisible();
  await expect(page.getByText("2 private Memory Cards are ready for review.")).toBeVisible();
  const calls = await page.evaluate(() => (window as any).__MOEMOA_TEST_MEMORY_CALLS__);
  expect(calls).toEqual(["ensure_user_profile", "register_user_device"]);
  expect(calls).not.toEqual(expect.arrayContaining([
    "user_snapshots", "user_library_items", "user_watch_logs", "user_character_pins",
  ]));
});

test("signed-in Memory account distinguishes an empty Guest namespace", async ({ page }) => {
  await installAccountAdapters(page, { signedIn: true, guestCards: 0 });
  await page.goto("/data/");
  await expect(page.getByText("Signed in — no Guest data", { exact: true })).toBeVisible();
  await expect(page.getByText("Metadata sync has not started yet.")).toBeVisible();
});

test("restoring an existing Auth session does not misread loading as sign-out", async ({ page }) => {
  await installAccountAdapters(page, { signedIn: true, guestCards: 0, activeAccount: true });
  await page.goto("/data/");
  await expect(page.getByText("Signed in — no Guest data", { exact: true })).toBeVisible();
  const calls = await page.evaluate(() => (window as any).__MOEMOA_TEST_MEMORY_CALLS__);
  expect(calls).toEqual(["ensure_user_profile", "register_user_device"]);
  expect(calls).not.toContain("rotate_guest_owner");
});

test("account initialization failure stays retryable and hides raw database errors", async ({ page }) => {
  await installAccountAdapters(page, { signedIn: true, guestCards: 1, fail: true });
  await page.goto("/data/");
  await expect(page.getByText("Account initialization failed — retry", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry account setup" })).toBeVisible();
  await expect(page.getByText("select private.secret")).toHaveCount(0);
});
