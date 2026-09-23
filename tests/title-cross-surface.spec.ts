import { expect, test, type Page } from "@playwright/test";
import { installAppState } from "./helpers/appState";

async function saveFirstCard(page: Page, locale: "en" | "ko" = "en", title = "A remembered scene") {
  await page.goto("/memory/new/");
  await page.getByRole("button", { name: locale === "ko" ? "시스템 디자인 사용" : "Use system design", exact: true }).click();
  await page.getByLabel(locale === "ko" ? "작품 또는 카드 제목" : "Anime or card title", { exact: true }).fill(title);
  await page.getByRole("button", { name: locale === "ko" ? "카드 저장" : "Save card", exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/);
}

for (const locale of ["en", "ko"] as const) {
  test(`${locale} first-Memory guidance respects Poster View, can be dismissed, and never repeats`, async ({ page }) => {
    await installAppState(page, { locale });
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/titles/");
    await expect(page.getByRole("heading", { name: locale === "ko" ? "내 작품" : "My Titles", exact: true })).toBeVisible();
    await page.evaluate(() => localStorage.setItem("moemoa:titles:view:v1", "POSTER"));
    await saveFirstCard(page, locale);
    const suggestion = page.locator(".first-memory-view-suggestion");
    await expect(suggestion).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("moemoa:titles:view:v1"))).toBe("POSTER");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/phase6-first-memory-${locale}-320.png`, fullPage: true });
    await suggestion.getByRole("button", { name: locale === "ko" ? "나중에" : "Later" }).click();
    await expect(suggestion).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".memory-archive__card")).toHaveCount(1);
    await expect(suggestion).toHaveCount(0);
    await saveFirstCard(page, locale, "Another remembered scene");
    await expect(page.locator(".memory-archive__card")).toHaveCount(2);
    await expect(suggestion).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("anime:list:v1") || "[]"))).toEqual([]);
  });
}

for (const native of [false, true]) {
test(`accepting first-Memory guidance opens Memory View without adding data (native=${native})`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  if (native) await page.addInitScript(() => { (window as any).androidBridge = {}; });
  await installAppState(page, { locale: "en" });
  await saveFirstCard(page);
  await page.getByRole("button", { name: "Open Memory View", exact: true }).click();
  await expect(page).toHaveURL(native ? /\/titles\/index\.html$/ : /\/titles\/$/);
  await expect(page.getByRole("radio", { name: "Memory View", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".title-album-card")).toHaveCount(1);
  await expect(page.locator(".title-album-card")).toContainText("Not saved · 1 Memory");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".title-collection__filter button").evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth))).toBe(true);
  await page.goBack();
  await expect(page.locator(".memory-archive__card")).toHaveCount(1);
  await expect(page.locator(".first-memory-view-suggestion")).toHaveCount(0);
});
}

test("Home and Board preserve the same Memory and Title Hub, with title summaries below the Memory", async ({ page }) => {
  await installAppState(page, {
    locale: "en",
    list: [1, 2, 3].map((anilistId) => ({ anilistId, koTitle: `Saved title ${anilistId}`, status: "보는중", addedAt: anilistId })),
    watchLogs: [{ id: "log-1", anilistId: 1, eventType: "NOTE", createdAt: new Date().toISOString(), cue: "Legacy cue" }],
    mediaById: Object.fromEntries([1, 2, 3].map((id) => [id, { id, title: { english: `Saved title ${id}` }, genres: [] }])),
  });
  await saveFirstCard(page);
  await page.goto("/");
  const memory = page.locator(".home-memory-overview");
  await expect(memory).toBeVisible();
  await expect(page.locator(".home-page h1")).toHaveCount(1);
  const hubHref = await memory.getByRole("link", { name: "View this title" }).getAttribute("href");
  expect(hubHref).toMatch(/^\/title\/\?privateTitleId=/);
  await expect(page.locator(".home-resurfacing-list-card").first()).toHaveAttribute("href", /^\/title\/\?anilistId=/);
  const memoryBox = await memory.boundingBox();
  const summaryBox = await page.locator(".home-focus-card").boundingBox();
  expect(summaryBox!.y).toBeGreaterThan(memoryBox!.y + memoryBox!.height);
  await page.screenshot({ path: "test-results/phase6-home-desktop.png", fullPage: true });
  await memory.getByRole("link", { name: "A remembered scene", exact: true }).click();
  await expect(page.locator(".memory-detail__title-link")).toHaveAttribute("href", hubHref!);
  const cardId = new URL(page.url()).searchParams.get("id");
  const boardId = await page.evaluate(async (id) => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime();
    const board = await runtime.createBoard({ title: "A private collection" });
    await runtime.addCardToBoard(board.id, id);
    return board.id;
  }, cardId);
  await page.goto(`/boards/?id=${boardId}`);
  await page.locator(".memory-boards__cards").getByRole("link", { name: "A remembered scene" }).click();
  expect(new URL(page.url()).searchParams.get("id")).toBe(cardId);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(`/boards/?id=${boardId}`);
  await page.locator(".memory-detail__title-link").click();
  await expect(page).toHaveURL(new URL(hubHref!, page.url()).href);
  await expect(page.getByRole("heading", { name: "A remembered scene", exact: true }).first()).toBeVisible();
  const counts = await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    return { memories: (await (await getPlatformMemoryRuntime()).listArchive()).length, titles: JSON.parse(localStorage.getItem("anime:list:v1") || "[]").length };
  });
  expect(counts).toEqual({ memories: 1, titles: 3 });
});
