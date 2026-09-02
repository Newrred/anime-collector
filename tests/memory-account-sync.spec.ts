import { expect, test, type Page } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_ID = "22222222-2222-4222-8222-222222222222";
const DEVICE_ID = "33333333-3333-4333-8333-333333333333";
const GUEST_OWNER_ID = `guest:${INSTALLATION_ID}`;
const MOCK_SESSION_KEY = "moemoa.e2e.mockSession.v1";

async function installAccountAdapters(page: Page, options: { signedIn?: boolean; guestCards?: number; fail?: boolean; activeAccount?: boolean; conflict?: boolean } = {}) {
  await page.addInitScript(({ signedIn, guestCards, fail, activeAccount, conflict, userId, installationId, deviceId, guestOwnerId, sessionKey }) => {
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
    let currentGuestOwnerId = guestOwnerId;
    let promotionJournal: any = null;
    let openConflict: any = conflict ? {
      id: "memory-conflict-1", ownerId: accountOwner.id, entityType: "MEMORY_CARD",
      entityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", state: "OPEN", remoteVersion: 2,
      localEntity: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", titleSnapshot: "Naruto", note: "Local private note" },
      remoteEntity: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", titleSnapshot: "Naruto", note: "Cloud private note", version: 2 },
    } : null;
    const animeRefId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const cardIds = ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"];
    const assetIds = ["dddddddd-dddd-4ddd-8ddd-dddddddddddd", "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"];
    const sync = { remoteVersion: 0, syncState: "LOCAL_ONLY", clientUpdatedAt: "2026-09-02T00:00:00.000Z", serverUpdatedAt: null, lastOperationId: null };
    let animeRef: any = {
      id: animeRefId, catalogAnimeId: null, displayTitle: "Naruto", normalizedTitle: "naruto",
      aliases: [], genres: ["Action"], sourceKey: "ANILIST:20",
      sourceBinding: { provider: "ANILIST", externalId: "20" }, verificationState: "PROVIDER_CANDIDATE",
      createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z",
    };
    let promoted = false;
    const promotionBundle = () => {
      const cards = cardIds.slice(0, guestCards).map((id, index) => ({
        id, ownerId: guestOwnerId, animeRefId, privateTitleId: null, visualAssetId: assetIds[index],
        status: "COMPLETE_PRIVATE", note: `Memory ${index + 1}`, watchedAt: null,
        watchedAtPrecision: "UNKNOWN", episode: null, sceneCue: null, emotionTags: [], rewatchIntent: null,
        createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z", deletedAt: null, sync,
      }));
      const visualAssets = assetIds.slice(0, guestCards).map((id) => ({
        id, ownerId: guestOwnerId, imageType: "UNKNOWN", state: "READY", storageScope: "LOCAL_ONLY",
        visibility: "PRIVATE", rightsBasis: "UNKNOWN", localRef: `asset:${id}`, checksumSha256: "a".repeat(64),
        mimeType: "image/png", byteSize: 1024, width: 800, height: 1000, designSpec: null, isCurrent: true,
        createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T00:00:00.000Z", deletedAt: null, sync,
      }));
      return {
        owner: owners.get(guestOwnerId), animeRefs: guestCards ? [animeRef] : [], privateTitles: [], cards,
        visualAssets, mediaOperations: cards.map((card, index) => ({ id: `operation-${index}`, ownerId: guestOwnerId, cardId: card.id, assetId: card.visualAssetId })),
        boards: [], boardCards: [],
      };
    };
    const owners = new Map([[guestOwnerId, guestOwner], [accountOwner.id, accountOwner]]);
    const deviceStates = new Map();
    (window as any).__MOEMOA_TEST_MEMORY_CALLS__ = calls;
    (window as any).__MOEMOA_TEST_MEMORY_ACCOUNT_ADAPTERS__ = {
      enabled: true,
      repository: {
        async ensureInstallationIdentity() {
          return { installationId, guestOwner: owners.get(currentGuestOwnerId) };
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
        async readOwnerPromotionBundle() { return structuredClone(promotionBundle()); },
        async resolvePromotionTitleChoice({ choice }: any) {
          calls.push("resolve_promotion_title");
          if (choice.kind === "CATALOG") animeRef = { ...animeRef, catalogAnimeId: choice.catalogAnimeId };
          return structuredClone(choice);
        },
        async beginPromotionJournal(input: any) {
          promotionJournal ||= { ...input, status: "STARTED", remoteResult: null };
          if (promotionJournal.sourceHash !== input.sourceHash) throw Object.assign(new Error("changed"), { code: "PROMOTION_SOURCE_HASH_MISMATCH" });
          return structuredClone(promotionJournal);
        },
        async markPromotionRemoteCompleted({ result }: any) {
          promotionJournal = { ...promotionJournal, status: "REMOTE_COMPLETED", remoteResult: structuredClone(result) };
        },
        async listRecoverablePromotions() { return []; },
        async commitPromotionToAccount({ accountOwnerId, newGuestUuid }: any) {
          promoted = true;
          activeOwner = owners.get(accountOwnerId);
          const nextGuest = { id: `guest:${newGuestUuid}`, kind: "GUEST", createdAt: "2026-09-02T00:00:00.000Z" };
          owners.set(nextGuest.id, nextGuest);
          currentGuestOwnerId = nextGuest.id;
          promotionJournal = { ...promotionJournal, status: "COMPLETED" };
          return { accountOwnerId, guestOwnerId: nextGuest.id };
        },
        async listPendingSyncOperations() { calls.push("list_sync_outbox"); return []; },
        async countPendingSyncOperations() { return 0; },
        async listOpenSyncConflicts() { return openConflict ? [structuredClone(openConflict)] : []; },
        async getSyncConflict(_ownerId: string, conflictId: string) { return openConflict?.id === conflictId ? structuredClone(openConflict) : null; },
        async commitConflictResolution({ selection }: any) { calls.push(`resolve_${selection}`); openConflict = null; },
        async hasPendingEntityOperation() { return false; },
        async commitPulledChange() {},
        async commitFullResync() {},
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
        async promoteGuest(input: any) {
          calls.push("promote_guest_memory");
          if (JSON.stringify(input.bundle).includes("localRef")) throw new Error("localRef leaked");
          return {
            status: "COMPLETED",
            importedCounts: {
              privateTitles: input.bundle.privateTitles.length,
              cards: input.bundle.cards.length,
              visualAssets: input.bundle.visualAssets.length,
              boards: input.bundle.boards.length,
              boardCards: input.bundle.boardCards.length,
            },
            nextSyncSeq: 7,
          };
        },
        async pullChanges({ afterSeq }: any) {
          calls.push("pull_memory_changes");
          return { changes: [], nextSyncSeq: afterSeq, minimumRetainedSyncSeq: 0, requiresFullResync: false };
        },
        async readEntities() { return []; },
        async readAllEntities() { return []; },
        async resolveConflict() {
          calls.push("resolve_memory_conflict");
          return { status: "APPLIED", entityVersion: 3, syncSeq: 3, errorCode: null, remoteEntity: null };
        },
      },
      readDeviceSyncState: async (ownerId: string) => structuredClone(deviceStates.get(ownerId) || null),
      writeDeviceSyncState: async (state: any) => { deviceStates.set(state.ownerId, structuredClone(state)); },
      uuid: () => deviceId,
      clock: { now: () => "2026-09-02T00:00:00.000Z" },
      appVersion: "e2e",
      locale: "en",
      timeZone: "UTC",
      resolveCatalogBinding: async () => ({
        kind: "ANIME_REF", animeId: "anime:ffffffff-ffff-4fff-8fff-ffffffffffff", displayTitle: "Naruto",
        sourceBinding: { provider: "ANILIST", externalId: "20" },
      }),
    };
  }, {
    signedIn: Boolean(options.signedIn),
    guestCards: Number(options.guestCards || 0),
    fail: Boolean(options.fail),
    activeAccount: Boolean(options.activeAccount),
    conflict: Boolean(options.conflict),
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

test("promotion preview is explicit, cancellable, and moves metadata only after one confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await installAccountAdapters(page, { signedIn: true, guestCards: 2 });
  await page.goto("/data/");
  await page.getByRole("button", { name: "Review Guest records" }).click();
  await expect(page.getByRole("heading", { name: "Move Guest records to this account" })).toBeVisible();
  await expect(page.getByText("Original image files stay only on this device.", { exact: false })).toBeVisible();
  await expect(page.getByText("2", { exact: true }).first()).toBeVisible();
  const previewReflow = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[data-memory-account-status]");
    const preview = document.querySelector<HTMLElement>(".promotion-preview");
    return {
      panelFits: Boolean(panel && panel.scrollWidth <= panel.clientWidth),
      previewFits: Boolean(preview && preview.scrollWidth <= preview.clientWidth),
    };
  });
  expect(previewReflow).toEqual({ panelFits: true, previewFits: true });

  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await page.evaluate(() => (window as any).__MOEMOA_TEST_MEMORY_CALLS__)).toEqual([
    "ensure_user_profile", "register_user_device",
  ]);

  await page.getByRole("button", { name: "Review Guest records" }).click();
  await page.getByLabel("Use exact catalog match: Naruto").check();
  await page.getByRole("button", { name: "Move records" }).click();
  await expect(page.getByText("Signed in — no Guest data", { exact: true })).toBeVisible();
  const calls = await page.evaluate(() => (window as any).__MOEMOA_TEST_MEMORY_CALLS__);
  expect(calls).toEqual([
    "ensure_user_profile", "register_user_device", "resolve_promotion_title", "promote_guest_memory",
  ]);
});

test("explicit sync exposes local and cloud notes without logging either value", async ({ page }) => {
  await installAccountAdapters(page, { signedIn: true, guestCards: 0, conflict: true });
  await page.goto("/data/");
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("heading", { name: "Review Memory conflict" })).toBeVisible();
  await expect(page.getByText("Local private note", { exact: true })).toBeVisible();
  await expect(page.getByText("Cloud private note", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save comparison JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("moemoa-memory-conflict");
  const callsBefore = await page.evaluate(() => (window as any).__MOEMOA_TEST_MEMORY_CALLS__);
  expect(JSON.stringify(callsBefore)).not.toContain("private note");
  await page.getByRole("button", { name: "Use cloud version" }).click();
  await expect(page.getByRole("heading", { name: "Review Memory conflict" })).toHaveCount(0);
  const callsAfter = await page.evaluate(() => (window as any).__MOEMOA_TEST_MEMORY_CALLS__);
  expect(callsAfter).toContain("resolve_USE_CLOUD");
  expect(callsAfter).not.toContain("resolve_KEEP_LOCAL");
});
