import { expect, test, type Page } from "@playwright/test";
import { installAppState } from "./helpers/appState";

async function seedTitles(page: Page) {
  await installAppState(page, { locale: "ko" });
  await page.route("https://**/*", route => route.abort());
  await page.goto("/");
  await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime();
    for (const title of ["첫 번째 작품", "두 번째 작품", "표지 없는 작품"]) {
      await runtime.createCard({ titleChoice: { kind: "PRIVATE_TITLE", displayTitle: title }, note: "합성 선반 검증", systemDesignSpec: { version: 1, templateId: "memory-gradient", paletteId: "mint-dusk", patternSeed: title, titleLayout: "BOTTOM_LEFT", genreTokens: [] } });
    }
  });
  await page.reload();
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
  await page.getByRole("button", { name: "선반 추가", exact: true }).click();
}
const storedShelves = (page: Page) => page.evaluate(() => {
  const key = Object.keys(localStorage).find(key => key.startsWith("moemoa:bookshelf:v1:"));
  return key ? JSON.parse(localStorage.getItem(key)!) : null;
});

test("shelf editor keeps title selections independent through search, shelf switching, cancel and reload", async ({ page }) => {
  await seedTitles(page);
  const editor = page.getByRole("region", { name: "컬렉션 편집 화면" });
  await page.getByLabel("선반 이름", { exact: true }).fill("장면 모음");
  await editor.getByLabel("첫 번째 작품", { exact: true }).check();
  await editor.getByLabel("두 번째 작품", { exact: true }).check();
  await editor.getByRole("button", { name: "선택됨", exact: true }).click();
  await expect(editor.locator('.bookshelf-picker input')).toHaveCount(2);
  await editor.getByLabel("진열할 작품 찾기", { exact: true }).fill("없는 이름");
  await expect(editor.getByText("검색 결과가 없어요.", { exact: true })).toBeVisible();
  await expect(editor.getByRole("status")).toHaveText("2개 선택 · 0개 표시");
  await editor.getByRole("button", { name: "전체 작품 보기", exact: true }).click();
  await expect(editor.locator('.bookshelf-picker input')).toHaveCount(3);
  expect(await storedShelves(page)).toBeNull();
  await editor.getByRole("button", { name: "선반 추가", exact: true }).click();
  await page.getByLabel("선반 이름", { exact: true }).fill("다시 볼 작품");
  await editor.getByLabel("두 번째 작품", { exact: true }).check();
  await editor.getByRole("button", { name: "장면 모음 편집", exact: true }).click();
  await expect(editor.getByLabel("첫 번째 작품", { exact: true })).toBeChecked();
  await expect(editor.getByLabel("두 번째 작품", { exact: true })).toBeChecked();
  await expect(editor.getByLabel("표지 없는 작품", { exact: true })).not.toBeChecked();
  await expect(editor.getByRole("status")).toHaveText("2개 선택 · 3개 표시");
  await expect(editor.locator('.bookshelf-picker-cover')).toHaveCount(3);
  await expect(editor.locator('.bookshelf-picker-cover img')).toHaveCount(0);
  await expect(editor.locator('.bookshelf-picker-cover').last()).toContainText("표지 없음");
  for (const [width, theme] of [[1440, "light"], [390, "dark"], [320, "light"]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await editor.locator('.bookshelf-picker-title').evaluateAll(rows => rows.every(row => {
      const bounds = row.getBoundingClientRect(), cover = row.querySelector('.bookshelf-picker-cover')!.getBoundingClientRect();
      return cover.width >= 40 && cover.left >= bounds.left && cover.right <= bounds.right && row.scrollWidth <= row.clientWidth;
    }))).toBe(true);
    await editor.screenshot({ path: `.cache/v84-service/shelf-editor-${width}-${theme}-28.png` });
  }
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page.reload();
  await expect(page.locator('.bookshelf-tile')).toHaveCount(2);
  const saved = await storedShelves(page);
  expect(saved.shelves.map((row: { name: string }) => row.name)).toEqual(["장면 모음", "다시 볼 작품"]);
  expect(saved.shelves[0].titleKeys).toHaveLength(2);
  expect(saved.shelves[1].titleKeys).toHaveLength(1);
  expect(saved.shelves[0].titleKeys).toContain(saved.shelves[1].titleKeys[0]);
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
  await editor.getByRole("button", { name: "다시 볼 작품 편집", exact: true }).click();
  await expect(editor.getByLabel("첫 번째 작품", { exact: true })).not.toBeChecked();
  await expect(editor.getByLabel("두 번째 작품", { exact: true })).toBeChecked();
  await editor.getByRole("button", { name: "선택됨", exact: true }).click();
  await editor.getByLabel("진열할 작품 찾기", { exact: true }).fill("두 번째");
  await editor.getByRole("button", { name: "선반 제거", exact: true }).click();
  await expect(page.getByLabel("선반 이름", { exact: true })).toHaveValue("장면 모음");
  await expect(editor.getByLabel("진열할 작품 찾기", { exact: true })).toHaveValue("");
  await expect(editor.locator('.bookshelf-picker input')).toHaveCount(3);
  await editor.getByRole("button", { name: "취소", exact: true }).click();
  await page.reload();
  expect(await storedShelves(page)).toEqual(saved);
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
  await editor.getByRole("button", { name: "다시 볼 작품 편집", exact: true }).click();
  await editor.getByRole("button", { name: "선반 제거", exact: true }).click();
  await editor.getByRole("button", { name: "적용", exact: true }).click();
  await page.reload();
  expect((await storedShelves(page)).shelves).toEqual([saved.shelves[0]]);
  expect(await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    return (await (await getPlatformMemoryRuntime()).listArchive()).length;
  })).toBe(3);
});

test("shelf editor retains staged selections after storage failure and can discard them", async ({ page }) => {
  await seedTitles(page);
  await page.getByLabel("선반 이름", { exact: true }).fill("저장된 선반");
  await page.locator('.bookshelf-picker').getByLabel("첫 번째 작품", { exact: true }).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  const saved = await storedShelves(page);
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
  await page.getByLabel("선반 이름", { exact: true }).fill("아직 저장 안 된 선반");
  await page.locator('.bookshelf-picker').getByLabel("두 번째 작품", { exact: true }).check();
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith("moemoa:bookshelf:v1:")) throw new DOMException("Synthetic test quota", "QuotaExceededError");
      return setItem.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "저장하지 못했어요." })).toBeVisible();
  await expect(page.getByLabel("선반 이름", { exact: true })).toHaveValue("아직 저장 안 된 선반");
  await expect(page.locator('.bookshelf-picker').getByLabel("두 번째 작품", { exact: true })).toBeChecked();
  expect(await storedShelves(page)).toEqual(saved);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.reload();
  expect(await storedShelves(page)).toEqual(saved);
  await expect(page.locator('.bookshelf-tile')).toHaveCount(1);
});
