import { expect, test } from "@playwright/test";
import { jpegBytes, nonSquareJpegBytes } from "./catalog-lab/fixtures/cover-valid-images.mjs";

// Project-owned 1×1 JPEG bytes keep the browser fixture aligned with the
// native bridge contract without introducing third-party artwork.
const SYNTHETIC_JPEG_BASE64 = Buffer.from(jpegBytes).toString("base64");
const SYNTHETIC_IMAGE_PREVIEW = `data:image/jpeg;base64,${SYNTHETIC_JPEG_BASE64}`;
const SYNTHETIC_IMAGE_PREVIEW_ALT = `data:image/jpeg;base64,${Buffer.from(nonSquareJpegBytes).toString("base64")}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("ui:locale:v1") == null) {
      localStorage.setItem("ui:locale:v1", JSON.stringify("ko"));
    }
  });
});

test("Memory routes follow the selected English locale from composer through detail", async ({ page }) => {
  await page.goto("/memory/new/");
  await expect(page.getByRole("heading", { name: "나만의 애니 메모리 카드" })).toBeVisible();

  await page.locator('button[aria-controls="locale-menu-panel"]:visible').click();
  await page.locator("#locale-menu-panel .data-menu-locale-option").filter({ hasText: "EN" }).click();

  await expect(page.getByRole("heading", { name: "My anime memory card" })).toBeVisible();
  await page.getByRole("button", { name: "Use system design" }).click();
  await page.getByLabel("Anime or card title").fill("Frieren");
  await page.getByLabel("Short reflection").fill("A quiet journey worth remembering.");
  await page.getByRole("button", { name: "Save card" }).click();

  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/);
  await expect(page.getByRole("heading", { name: "Memory Archive" })).toBeVisible();
  await expect(page.getByText("Revisit the scenes and reflections saved on this device.")).toBeVisible();
  await page.getByRole("link", { name: "Frieren" }).click();

  await expect(page.getByLabel("Short reflection")).toHaveValue("A quiet journey worth remembering.");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete card" })).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Changes saved on this device.")).toBeVisible();

  await page.locator('button[aria-controls="locale-menu-panel"]:visible').click();
  await page.locator("#locale-menu-panel .data-menu-locale-option").filter({ hasText: "KO" }).click();
  await expect(page.getByText("변경 내용을 이 기기에 저장했어요.")).toBeVisible();
});

test("changing locale does not re-claim or discard the prepared private image", async ({ page }) => {
  await page.addInitScript((previewDataUrl) => {
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => {
        const count = Number(sessionStorage.getItem("locale-claim-count") || "0") + 1;
        sessionStorage.setItem("locale-claim-count", String(count));
        return {
          ticket: {
            ticketId: "locale-ticket",
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
        };
      },
      pick: async () => ({ ticket: null, cancelled: true }),
      discard: async () => true,
    };
  }, SYNTHETIC_IMAGE_PREVIEW);

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.locator('button[aria-controls="locale-menu-panel"]:visible').click();
  await page.locator("#locale-menu-panel .data-menu-locale-option").filter({ hasText: "EN" }).click();

  await expect(page.getByAltText("Selected image preview")).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("locale-claim-count"))).toBe("1");
});

test("prepared image errors retranslate without retrying the native claim", async ({ page }) => {
  await page.addInitScript(() => {
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => {
        const count = Number(sessionStorage.getItem("locale-error-claim-count") || "0") + 1;
        sessionStorage.setItem("locale-error-claim-count", String(count));
        return { ticket: null, processing: false, errorCode: "IMAGE_TOO_LARGE" };
      },
      pick: async () => ({ ticket: null, cancelled: true }),
      discard: async () => true,
    };
  });

  await page.goto("/memory/new/");
  await expect(page.getByText("20MB 이하의 이미지를 선택해 주세요.")).toBeVisible();
  await page.locator('button[aria-controls="locale-menu-panel"]:visible').click();
  await page.locator("#locale-menu-panel .data-menu-locale-option").filter({ hasText: "EN" }).click();

  await expect(page.getByText("Choose an image up to 20MB.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("locale-error-claim-count"))).toBe("1");
});

test("browser route explains Android-only image intake without exposing a file input", async ({ page }) => {
  await page.goto("/memory/new/");

  await expect(page.getByRole("heading", { name: "나만의 애니 메모리 카드" })).toBeVisible();
  await expect(page.getByText("이미지 가져오기는 현재 Android 앱에서만 사용할 수 있어요.")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const save = page.getByRole("button", { name: "카드 저장" });
  await expect(save).toBeDisabled();
  await expect(page.locator("#memory-save-reason")).toContainText("먼저 이미지 또는 시스템 디자인을 선택해 주세요.");

  await page.getByRole("button", { name: "시스템 디자인 사용" }).click();
  await expect(page.locator("#memory-save-reason")).toContainText("작품 또는 카드 제목을 입력해 주세요.");
  await page.getByLabel("작품 또는 카드 제목").fill("Flow fixture");
  await expect(save).toBeEnabled();
  await expect(page.locator("#memory-save-reason")).toContainText("저장하면 이 기기의 비공개 Archive에서 바로 다시 볼 수 있어요.");
});

test("native card save opens the packaged Archive document", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { androidBridge?: Record<string, unknown> }).androidBridge = {};
  });
  await page.goto("/memory/new/");
  await page.getByRole("button", { name: "시스템 디자인 사용" }).click();
  await page.getByLabel("작품 또는 카드 제목").fill("Native route memory");

  await page.getByRole("button", { name: "카드 저장" }).click();

  await expect(page).toHaveURL(/\/archive\/index\.html$/u);
});

test("empty Archive exposes one page-level create action", async ({ page }) => {
  await page.goto("/archive/");

  await expect(page.getByRole("heading", { name: "Memory Archive" })).toBeVisible();
  await expect(page.getByText("아직 저장한 카드가 없어요.")).toBeVisible();
  await expect(page.locator('.memory-archive a[href$="memory/new/"]')).toHaveCount(1);
});

test("Archive turns an unavailable private preview into a recoverable visual state", async ({ page }) => {
  await page.addInitScript((previewDataUrl) => {
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({
        ticket: {
          ticketId: "missing-preview-ticket",
          mimeType: "image/jpeg",
          byteSize: 42,
          width: 800,
          height: 1000,
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
        checksumSha256: "c".repeat(64),
        mimeType: "image/jpeg",
        byteSize: 42,
        width: 800,
        height: 1000,
      }),
      getPreview: async () => null,
      deleteAsset: async () => true,
    };
  }, SYNTHETIC_IMAGE_PREVIEW);

  await page.goto("/memory/new/");
  await page.getByLabel("작품 또는 카드 제목").fill("Missing scene");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "카드 저장" }).click();

  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/u);
  await expect(page.getByRole("status", { name: "이미지를 불러올 수 없어요." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Missing scene", exact: true })).toBeVisible();
});

test("private card saves once and remains visible in Archive after reload", async ({ page }) => {
  await page.addInitScript((previewDataUrl) => {
    window.__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({
        ticket: {
          ticketId: "ticket-1",
          mimeType: "image/jpeg",
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
        mimeType: "image/jpeg",
        byteSize: 42,
        width: 1920,
        height: 1080,
      }),
      getPreview: async () => previewDataUrl,
      deleteAsset: async () => true,
    };
  }, SYNTHETIC_IMAGE_PREVIEW);

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.getByLabel("작품 또는 카드 제목").fill("Frieren");
  await page.getByLabel("짧은 감상").fill("The quiet journey stayed with me.");
  await expect(page.locator("#memory-save-reason")).toContainText("이미지 사용 권리를 확인해 주세요.");
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
  await expect(page.locator(".memory-detail__visual .memory-visual")).toBeVisible();
  expect(await page.evaluate(() => {
    const visual = document.querySelector(".memory-detail__visual");
    const utilities = document.querySelector(".memory-detail__body");
    return Boolean(visual && utilities && (visual.compareDocumentPosition(utilities) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.getByLabel("짧은 감상").fill("A quieter memory after revisiting.");
  await page.getByRole("button", { name: "변경 저장" }).click();
  await expect(page.getByText("변경 내용을 이 기기에 저장했어요.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("짧은 감상")).toHaveValue("A quieter memory after revisiting.");

  const deleteButton = page.getByRole("button", { name: "카드 삭제" });
  await deleteButton.click();
  const deleteDialog = page.getByRole("dialog", { name: "메모리 카드 삭제" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "취소" }).click();
  await expect(deleteDialog).toBeHidden();
  await expect(deleteButton).toBeFocused();

  await deleteButton.click();
  await deleteDialog.getByRole("button", { name: "카드 삭제 확인" }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/);
  await expect(page.getByRole("heading", { name: "Frieren" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Frieren" })).toHaveCount(0);
});

test("card detail replaces a local image only after explicit rights confirmation", async ({ page }) => {
  await page.addInitScript(({ oldPreview, newPreview }) => {
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
      deleteAsset: async () => sessionStorage.getItem("replacement-cleanup-fails") !== "true",
    };
  }, { oldPreview: SYNTHETIC_IMAGE_PREVIEW, newPreview: SYNTHETIC_IMAGE_PREVIEW_ALT });

  await page.goto("/memory/new/");
  await expect(page.getByAltText("선택한 이미지 미리보기")).toBeVisible();
  await page.getByLabel("작품 또는 카드 제목").fill("Frieren");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "카드 저장" }).click();
  await page.getByRole("link", { name: "Frieren" }).click();

  const currentImage = page.getByAltText("Frieren 메모리 카드");
  await expect(currentImage).toHaveAttribute("src", SYNTHETIC_IMAGE_PREVIEW);
  await page.getByRole("button", { name: "이미지 교체" }).click();
  await expect(page.getByAltText("새 이미지 미리보기")).toHaveAttribute(
    "src",
    SYNTHETIC_IMAGE_PREVIEW_ALT,
  );
  await expect(currentImage).toHaveAttribute("src", SYNTHETIC_IMAGE_PREVIEW);

  const applyReplacement = page.getByRole("button", { name: "이 이미지로 교체" });
  await expect(applyReplacement).toBeDisabled();
  await page.getByLabel("이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.").check();
  await expect(applyReplacement).toBeEnabled();
  await applyReplacement.click();

  await expect(currentImage).toHaveAttribute("src", SYNTHETIC_IMAGE_PREVIEW_ALT);
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

  await page.evaluate(() => sessionStorage.setItem("replacement-cleanup-fails", "true"));
  await page.getByRole("button", { name: "이미지 교체" }).click();
  await page.getByLabel("이 이미지를 개인 기록에 사용할 권리와 책임이 나에게 있음을 확인합니다.").check();
  await page.getByRole("button", { name: "이 이미지로 교체" }).click();
  await expect(page.getByText("새 이미지를 이 기기에 저장했어요. 이전 이미지 정리는 앱을 다시 열 때 마무리합니다.")).toBeVisible();
  await expect(currentImage).toHaveAttribute("src", SYNTHETIC_IMAGE_PREVIEW_ALT);
});

test("missing local image exposes recovery and delete actions", async ({ page }) => {
  await page.addInitScript((previewDataUrl) => {
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
  }, SYNTHETIC_IMAGE_PREVIEW);

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
  await page.addInitScript((previewDataUrl) => {
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
  }, SYNTHETIC_IMAGE_PREVIEW);

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

  expect(await page.evaluate(() => sessionStorage.getItem("picker-call-count"))).toBe("1");
  await expect.poll(() => page.evaluate(() => (
    sessionStorage.getItem("discarded-late-ticket")
  ))).toBe("ticket-late");
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
  await page.addInitScript(({ oldPreview, newPreview }) => {
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
  }, { oldPreview: SYNTHETIC_IMAGE_PREVIEW, newPreview: SYNTHETIC_IMAGE_PREVIEW_ALT });

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
  await expect(page.getByText("시스템 디자인 미리보기")).toBeVisible();

  await page.getByRole("button", { name: "카드 저장" }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/);
  await expect(
    page.getByRole("heading", { name: "A Place Further Than the Universe" }),
  ).toBeVisible();
  await expect(page.getByText("시스템 디자인 미리보기")).toBeVisible();
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
