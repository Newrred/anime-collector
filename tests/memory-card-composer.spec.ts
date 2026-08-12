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
