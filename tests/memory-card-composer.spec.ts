import { expect, test } from "@playwright/test";

test("browser route explains Android-only image intake without exposing a file input", async ({ page }) => {
  await page.goto("/memory/new/");

  await expect(page.getByRole("heading", { name: "나만의 애니 메모리 카드" })).toBeVisible();
  await expect(page.getByText("이미지 가져오기는 현재 Android 앱에서만 사용할 수 있어요.")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "카드 저장" })).toBeDisabled();
});

test("private card saves once and remains visible in Archive after reload", async ({ page }) => {
  await page.addInitScript(() => {
    const previewDataUrl = "data:image/jpeg;base64,cHJldmlldw==";
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({
        ticket: {
          ticketId: "ticket-1",
          mimeType: "image/png",
          byteSize: 42,
          width: 1920,
          height: 1080,
          createdAtEpochMs: 123,
          previewDataUrl,
          localOnly: true,
        },
        processing: false,
        errorCode: null,
      }),
      pick: async () => ({ ticket: null, cancelled: true }),
      discard: async () => true,
      promoteTicket: async ({ assetId }) => ({
        localRef: `asset:${assetId}`,
        checksumSha256: "a".repeat(64),
        mimeType: "image/png",
        byteSize: 42,
        width: 1920,
        height: 1080,
      }),
      getPreview: async () => previewDataUrl,
      deleteAsset: async () => true,
    };
  });

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.getByLabel("작품 또는 카드 제목").fill("Frieren");
  await page.getByLabel("짧은 감상").fill("The quiet journey stayed with me.");
  await page.getByRole("checkbox").check();

  const save = page.getByRole("button", { name: "카드 저장" });
  await expect(save).toBeEnabled();
  await save.dblclick();

  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/);
  await expect(page.getByRole("heading", { name: "Frieren" })).toBeVisible();
  await expect(page.getByText("The quiet journey stayed with me.")).toBeVisible();
  await expect(page.getByAltText("Frieren 메모리 카드")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Frieren" })).toHaveCount(1);

  await page.getByRole("link", { name: "Frieren" }).click();
  await expect(page).toHaveURL(/\/memory\/card\/(?:index\.html)?\?id=/);
  await expect(page.getByRole("heading", { name: "Frieren" })).toBeVisible();
  await page.getByLabel("짧은 감상").fill("A quieter memory after revisiting.");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(page.getByText("변경 내용을 이 기기에 저장했어요.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("짧은 감상")).toHaveValue("A quieter memory after revisiting.");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "카드 삭제" }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/);
  await expect(page.getByRole("heading", { name: "Frieren" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Frieren" })).toHaveCount(0);
});

test("browser can create a deterministic system design card without an image upload", async ({ page }) => {
  await page.goto("/memory/new/");
  await page.getByLabel("작품 또는 카드 제목").fill("A Place Further Than the Universe");
  await page.getByRole("button", { name: "시스템 디자인 사용" }).click();
  await expect(page.getByText("System design preview")).toBeVisible();

  await page.getByRole("button", { name: "카드 저장" }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/);
  await expect(
    page.getByRole("heading", { name: "A Place Further Than the Universe" }),
  ).toBeVisible();
  await expect(page.getByText("System design preview")).toBeVisible();
});

test("selecting a catalog candidate stores an AnimeRef instead of a PrivateTitle", async ({ page }) => {
  await page.addInitScript(() => {
    window.__MOEMOA_TEST_TITLE_RESOLVER__ = {
      search: async () => ({
        remoteStatus: "READY",
        results: [{
          kind: "ANIME_REF",
          displayTitle: "Frieren: Beyond Journey's End",
          aliases: ["Sousou no Frieren", "葬送のフリーレン"],
          genres: ["Adventure", "Fantasy"],
          sourceBinding: { provider: "ANILIST", externalId: "154587" },
          verificationState: "PROVIDER_CANDIDATE",
        }],
      }),
    };
  });

  await page.goto("/memory/new/");
  await page.getByLabel("작품 또는 카드 제목").fill("Frieren");
  await page.getByRole("button", { name: "작품 검색" }).click();
  await expect(page.getByText("AniList candidate")).toBeVisible();
  await page.getByRole("button", { name: "Frieren: Beyond Journey's End 선택" }).click();
  await page.getByRole("button", { name: "시스템 디자인 사용" }).click();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await expect(page.getByRole("heading", { name: "Frieren: Beyond Journey's End" })).toBeVisible();

  const stored = await page.evaluate(async () => {
    const request = indexedDB.open("moemoa-memory-v1");
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["memory_cards", "anime_refs", "private_titles"], "readonly");
    const requestValue = <T,>(value: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      value.onsuccess = () => resolve(value.result);
      value.onerror = () => reject(value.error);
    });
    const [cards, animeRefs, privateTitles] = await Promise.all([
      requestValue(transaction.objectStore("memory_cards").getAll()),
      requestValue(transaction.objectStore("anime_refs").getAll()),
      requestValue(transaction.objectStore("private_titles").getAll()),
    ]);
    database.close();
    return { cards, animeRefs, privateTitles };
  });

  expect(stored.cards).toHaveLength(1);
  expect(stored.cards[0].animeRefId).toBe(stored.animeRefs[0].id);
  expect(stored.cards[0].privateTitleId).toBeNull();
  expect(stored.animeRefs[0].sourceKey).toBe("ANILIST:154587");
  expect(stored.privateTitles).toEqual([]);
});

test("provider unavailability keeps the typed PrivateTitle save path available", async ({ page }) => {
  await page.addInitScript(() => {
    window.__MOEMOA_TEST_TITLE_RESOLVER__ = {
      search: async () => ({ results: [], remoteStatus: "UNAVAILABLE" }),
    };
  });

  await page.goto("/memory/new/");
  await page.getByLabel("작품 또는 카드 제목").fill("My Offline Anime");
  await page.getByRole("button", { name: "작품 검색" }).click();
  await expect(page.getByText(/온라인 검색을 사용할 수 없어요/)).toBeVisible();
  await expect(page.getByText(/개인 제목으로 저장/)).toBeVisible();
  await page.getByRole("button", { name: "시스템 디자인 사용" }).click();
  await expect(page.getByRole("button", { name: "카드 저장" })).toBeEnabled();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await expect(page.getByRole("heading", { name: "My Offline Anime" })).toBeVisible();
});

test("a late title response cannot replace results after the query changes", async ({ page }) => {
  await page.addInitScript(() => {
    window.__MOEMOA_TEST_TITLE_RESOLVER__ = {
      search: async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return {
          remoteStatus: "READY",
          results: [{
            kind: "ANIME_REF",
            displayTitle: "Frieren: Beyond Journey's End",
            aliases: [],
            genres: ["Fantasy"],
            sourceBinding: { provider: "ANILIST", externalId: "154587" },
            verificationState: "PROVIDER_CANDIDATE",
          }],
        };
      },
    };
  });

  await page.goto("/memory/new/");
  const title = page.getByLabel("작품 또는 카드 제목");
  await title.fill("Frieren");
  await page.getByRole("button", { name: "작품 검색" }).click();
  await title.fill("Violet Evergarden");
  await page.waitForTimeout(250);

  await expect(page.getByRole("button", { name: "Frieren: Beyond Journey's End 선택" })).toHaveCount(0);
  await expect(page.getByText(/“Violet Evergarden”을 개인 제목으로 저장/)).toBeVisible();
});
