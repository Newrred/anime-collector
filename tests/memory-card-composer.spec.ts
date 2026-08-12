import { expect, test } from "@playwright/test";

test("browser route explains Android-only image intake without exposing a file input", async ({ page }) => {
  await page.goto("/memory/new/");

  await expect(page.getByRole("heading", { name: "나만의 애니 메모리 카드" })).toBeVisible();
  await expect(page.getByText("이미지 가져오기는 현재 Android 앱에서만 사용할 수 있어요.")).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "카드 저장은 다음 단계에서 연결" })).toBeDisabled();
});
