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

test("card detail replaces a local image only after explicit rights confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    const oldPreview = "data:image/jpeg;base64,b2xkLXByZXZpZXc=";
    const newPreview = "data:image/jpeg;base64,bmV3LXByZXZpZXc=";
    const ticket = (ticketId: string, previewDataUrl: string) => ({
      ticketId,
      mimeType: "image/jpeg",
      byteSize: 42,
      width: 1280,
      height: 720,
      createdAtEpochMs: 123,
      previewDataUrl,
      localOnly: true,
    });
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({
        ticket: ticket("ticket-old", oldPreview),
        processing: false,
        errorCode: null,
      }),
      pick: async () => ({ ticket: ticket("ticket-new", newPreview), cancelled: false }),
      discard: async () => true,
      promoteTicket: async ({ ticketId, assetId }) => {
        const localRef = `asset:${assetId}`;
        sessionStorage.setItem(
          `moemoa-test-preview:${localRef}`,
          ticketId === "ticket-new" ? newPreview : oldPreview,
        );
        return {
          localRef,
          checksumSha256: ticketId === "ticket-new" ? "b".repeat(64) : "a".repeat(64),
          mimeType: "image/jpeg",
          byteSize: 42,
          width: 1280,
          height: 720,
        };
      },
      getPreview: async (localRef: string) => (
        sessionStorage.getItem(`moemoa-test-preview:${localRef}`)
      ),
      deleteAsset: async () => true,
    };
  });

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.getByLabel("작품 또는 카드 제목").fill("Frieren");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await page.getByRole("link", { name: "Frieren" }).click();

  const currentImage = page.getByAltText("Frieren 메모리 카드");
  await expect(currentImage).toHaveAttribute("src", "data:image/jpeg;base64,b2xkLXByZXZpZXc=");
  await page.getByRole("button", { name: "이미지 교체" }).click();
  await expect(page.getByAltText("새 이미지 미리보기")).toHaveAttribute(
    "src",
    "data:image/jpeg;base64,bmV3LXByZXZpZXc=",
  );
  await expect(currentImage).toHaveAttribute("src", "data:image/jpeg;base64,b2xkLXByZXZpZXc=");

  const applyReplacement = page.getByRole("button", { name: "이 이미지로 교체" });
  await expect(applyReplacement).toBeDisabled();
  await page.getByLabel("이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.").check();
  await expect(applyReplacement).toBeEnabled();
  await applyReplacement.click();

  await expect(currentImage).toHaveAttribute("src", "data:image/jpeg;base64,bmV3LXByZXZpZXc=");
  await expect(page.getByText("새 이미지를 이 기기에 저장했어요.")).toBeVisible();

  const stored = await page.evaluate(async () => {
    const request = indexedDB.open("moemoa-memory-v1");
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      ["memory_cards", "visual_assets", "media_operations"],
      "readonly",
    );
    const requestValue = <T,>(value: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
      value.onsuccess = () => resolve(value.result);
      value.onerror = () => reject(value.error);
    });
    const [cards, assets, operations] = await Promise.all([
      requestValue(transaction.objectStore("memory_cards").getAll()),
      requestValue(transaction.objectStore("visual_assets").getAll()),
      requestValue(transaction.objectStore("media_operations").getAll()),
    ]);
    database.close();
    return { cards, assets, operations };
  });
  const replacement = stored.operations.find(({ kind }) => kind === "REPLACE");
  expect(replacement.state).toBe("COMPLETED");
  expect(stored.cards[0].visualAssetId).toBe(replacement.assetId);
  expect(stored.assets.find(({ id }) => id === replacement.assetId).state).toBe("READY");
  const oldAsset = stored.assets.find(({ id }) => id === replacement.previousAssetId);
  expect(oldAsset.state).toBe("DELETED");
  expect(oldAsset.localRef).toBeNull();
});

test("missing local image exposes recovery and delete actions", async ({ page }) => {
  await page.addInitScript(() => {
    const previewDataUrl = "data:image/jpeg;base64,cHJldmlldw==";
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({
        ticket: {
          ticketId: "ticket-old",
          mimeType: "image/jpeg",
          byteSize: 42,
          width: 1280,
          height: 720,
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
        mimeType: "image/jpeg",
        byteSize: 42,
        width: 1280,
        height: 720,
      }),
      getPreview: async () => null,
      deleteAsset: async () => true,
    };
  });

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.getByLabel("작품 또는 카드 제목").fill("Missing Image Card");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await page.getByRole("link", { name: "Missing Image Card" }).click();

  await expect(page.getByText("이미지를 불러올 수 없어요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "이미지 복구" })).toBeVisible();
  await expect(page.getByRole("button", { name: "카드 삭제" })).toBeVisible();
});

test("late picker result is discarded after leaving detail and rapid clicks open only one picker", async ({ page }) => {
  await page.addInitScript(() => {
    const previewDataUrl = "data:image/jpeg;base64,cHJldmlldw==";
    const ticket = (ticketId: string) => ({
      ticketId,
      mimeType: "image/jpeg",
      byteSize: 42,
      width: 1280,
      height: 720,
      createdAtEpochMs: 123,
      previewDataUrl,
      localOnly: true,
    });
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({ ticket: ticket("ticket-old"), processing: false, errorCode: null }),
      pick: async () => {
        const count = Number(sessionStorage.getItem("picker-call-count") || "0") + 1;
        sessionStorage.setItem("picker-call-count", String(count));
        await new Promise((resolve) => setTimeout(resolve, 120));
        return { ticket: ticket("ticket-late"), cancelled: false };
      },
      discard: async (ticketId: string) => {
        sessionStorage.setItem("discarded-late-ticket", ticketId);
        return sessionStorage.getItem("allow-late-ticket-cleanup") === "true";
      },
      promoteTicket: async ({ assetId }) => ({
        localRef: `asset:${assetId}`,
        checksumSha256: "a".repeat(64),
        mimeType: "image/jpeg",
        byteSize: 42,
        width: 1280,
        height: 720,
      }),
      getPreview: async () => previewDataUrl,
      deleteAsset: async () => true,
    };
  });

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.getByLabel("작품 또는 카드 제목").fill("Picker Ownership");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await page.getByRole("link", { name: "Picker Ownership" }).click();

  await page.getByRole("button", { name: "이미지 교체" }).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await page.getByRole("link", { name: "← Memory Archive" }).click();
  await page.waitForTimeout(200);

  expect(await page.evaluate(() => sessionStorage.getItem("picker-call-count"))).toBe("1");
  expect(await page.evaluate(() => sessionStorage.getItem("discarded-late-ticket"))).toBe("ticket-late");
  expect(await page.evaluate(() => JSON.parse(
    localStorage.getItem("moemoa:pending-ticket-cleanup:v1") || "[]",
  ))).toEqual(["ticket-late"]);

  await page.evaluate(() => sessionStorage.setItem("allow-late-ticket-cleanup", "true"));
  await page.reload();
  await expect.poll(() => page.evaluate(() => (
    localStorage.getItem("moemoa:pending-ticket-cleanup:v1")
  ))).toBeNull();
});

test("pre-reservation replacement rejection keeps the ticket until discard is confirmed", async ({ page }) => {
  await page.addInitScript(() => {
    const oldPreview = "data:image/jpeg;base64,b2xkLXByZXZpZXc=";
    const newPreview = "data:image/jpeg;base64,bmV3LXByZXZpZXc=";
    const ticket = (ticketId: string, previewDataUrl: string) => ({
      ticketId,
      mimeType: "image/jpeg",
      byteSize: 42,
      width: 1280,
      height: 720,
      createdAtEpochMs: 123,
      previewDataUrl,
      localOnly: true,
    });
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({
        ticket: ticket("ticket-old", oldPreview),
        processing: false,
        errorCode: null,
      }),
      pick: async () => ({ ticket: ticket("ticket-rejected", newPreview), cancelled: false }),
      discard: async (ticketId: string) => {
        const count = Number(sessionStorage.getItem("rejected-discard-count") || "0") + 1;
        sessionStorage.setItem("rejected-discard-count", String(count));
        sessionStorage.setItem("rejected-discard-ticket", ticketId);
        return count > 1;
      },
      promoteTicket: async ({ assetId }) => ({
        localRef: `asset:${assetId}`,
        checksumSha256: "a".repeat(64),
        mimeType: "image/jpeg",
        byteSize: 42,
        width: 1280,
        height: 720,
      }),
      getPreview: async () => oldPreview,
      deleteAsset: async () => true,
    };
  });

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.getByLabel("작품 또는 카드 제목").fill("Rejected Replacement");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await page.getByRole("link", { name: "Rejected Replacement" }).click();
  await page.evaluate(async () => {
    const request = indexedDB.open("moemoa-memory-v1");
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("visual_assets", "readwrite");
    const assets = transaction.objectStore("visual_assets");
    const all: any[] = await new Promise((resolve, reject) => {
      const get = assets.getAll();
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    assets.put({ ...all[0], state: "DELETE_PENDING" });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.getByRole("button", { name: "이미지 교체" }).click();
  await page.getByLabel("이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.").check();
  await page.getByRole("button", { name: "이 이미지로 교체" }).click();
  await expect(page.getByAltText("새 이미지 미리보기")).toBeVisible();

  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByAltText("새 이미지 미리보기")).toBeVisible();
  await expect(page.getByText("선택한 임시 이미지를 정리하지 못했어요. 다시 시도해 주세요.")).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByAltText("새 이미지 미리보기")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("rejected-discard-ticket"))).toBe(
    "ticket-rejected",
  );
  expect(await page.evaluate(() => localStorage.getItem(
    "moemoa:pending-ticket-cleanup:v1",
  ))).toBeNull();
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
  await expect(page.getByText("온라인 작품 후보")).toBeVisible();
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

test("catalog detail deep-link restores the exact AnimeRef before saving", async ({ page }) => {
  await page.addInitScript(() => {
    window.__MOEMOA_TEST_CATALOG_TITLE_CHOICE__ = {
      kind: "ANIME_REF",
      animeId: "anime:11111111-1111-4111-8111-000000000001",
      displayTitle: "카우보이 비밥",
      aliases: ["Cowboy Bebop", "カウボーイビバップ"],
      genres: ["Action", "Sci-Fi"],
      sourceBinding: { provider: "ANILIST", externalId: "1" },
      verificationState: "PROVIDER_CANDIDATE",
      catalogSource: "SUPABASE_SERVICE_PROJECTION_V2",
      readiness: "READY",
    };
  });

  await page.goto("/memory/new/?animeId=anime%3A11111111-1111-4111-8111-000000000001&title=temporary");
  await expect(page.getByLabel("작품 또는 카드 제목")).toHaveValue("카우보이 비밥");
  await expect(page.getByText("작품 정보 있음")).toBeVisible();
  await expect(page.getByText("일치하는 작품이 없어도 개인 제목으로 계속할 수 있어요.")).toBeHidden();
  await page.getByRole("button", { name: "시스템 디자인 사용" }).click();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await expect(page.getByRole("heading", { name: "카우보이 비밥" })).toBeVisible();

  const stored = await page.evaluate(async () => {
    const request = indexedDB.open("moemoa-memory-v1");
    const database: IDBDatabase = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(["memory_cards", "anime_refs", "private_titles"], "readonly");
    const readAll = (store: string) => new Promise<unknown[]>((resolve, reject) => {
      const read = transaction.objectStore(store).getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    const [cards, animeRefs, privateTitles] = await Promise.all([
      readAll("memory_cards"), readAll("anime_refs"), readAll("private_titles"),
    ]);
    database.close();
    return { cards, animeRefs, privateTitles };
  });

  expect(stored.cards).toHaveLength(1);
  expect(stored.animeRefs).toHaveLength(1);
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
