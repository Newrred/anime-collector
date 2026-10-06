import { expect, test } from "@playwright/test";

const cover = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='100%25' height='100%25' fill='%235f6c91'/%3E%3C/svg%3E";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((coverUrl) => {
    localStorage.setItem("ui:locale:v1", JSON.stringify("ko"));
    const memory = (id: string, title: string, note: string, updatedAt: string) => ({
      card: { id, note, updatedAt },
      title: { displayTitle: title },
      sourceKind: "CATALOG_COVER",
      visual: { kind: "IMAGE", src: coverUrl.replace("5f6c91", id === "memory-1" ? "e88598" : id === "memory-3" ? "80ae95" : "edbe70"), alt: `${title} 메모리` },
    });
    window.__MOEMOA_TEST_TITLE_COLLECTION_SERVICE__ = {
      load: async () => [{
        key: "ANILIST:154587",
        titleRef: { kind: "ANIME", animeId: "anime:11111111-1111-4111-8111-000000154587" },
        anilistId: 154587,
        displayTitle: "장송의 프리렌",
        aliases: ["Frieren"],
        genres: ["Adventure", "Fantasy"],
        catalogDetail: { release: { startDate: "2023-09-29" } },
        isPrivateTitle: false,
        officialCover: { src: coverUrl, width: 200, height: 300 },
        tracking: { isSaved: true, watchStatus: "보는중", rating: 5 },
        libraryItem: { addedAt: 30 },
        memoryCount: 3,
        latestMemoryAt: "2026-09-03T03:00:00.000Z",
        memories: [memory("memory-1", "장송의 프리렌", "눈 내리던 장면이 오래 남았다.", "2026-09-03T03:00:00.000Z"), memory("memory-3", "장송의 프리렌", "합성 기억3", "2026-09-02T03:00:00.000Z"), memory("memory-4", "장송의 프리렌", "합성 기억4", "2026-09-01T03:00:00.000Z")],
        previewMemories: [memory("memory-1", "장송의 프리렌", "눈 내리던 장면이 오래 남았다.", "2026-09-03T03:00:00.000Z"), memory("memory-3", "장송의 프리렌", "합성 기억3", "2026-09-02T03:00:00.000Z"), memory("memory-4", "장송의 프리렌", "합성 기억4", "2026-09-01T03:00:00.000Z")],
      }, {
        key: "ANILIST:153518",
        titleRef: { kind: "ANIME", animeId: "anime:22222222-2222-4222-8222-000000153518" },
        anilistId: 153518,
        displayTitle: "던전밥",
        aliases: ["Delicious in Dungeon"],
        genres: ["Comedy", "Fantasy"],
        catalogDetail: { release: { startDate: "2024-01-04" } },
        isPrivateTitle: false,
        officialCover: { src: coverUrl, width: 200, height: 300 },
        tracking: { isSaved: true, watchStatus: "완료", rating: 4 },
        libraryItem: { addedAt: 20 },
        memoryCount: 0,
        latestMemoryAt: null,
        memories: [],
        previewMemories: [],
      }, {
        key: "PRIVATE:private-one",
        titleRef: { kind: "PRIVATE_TITLE", privateTitleId: "private-one" },
        anilistId: null,
        displayTitle: "나만의 여름 애니",
        aliases: [],
        genres: ["Slice of Life"],
        catalogDetail: null,
        isPrivateTitle: true,
        officialCover: null,
        tracking: { isSaved: false, watchStatus: null },
        libraryItem: null,
        memoryCount: 1,
        latestMemoryAt: "2026-09-02T03:00:00.000Z",
        memories: [memory("memory-2", "나만의 여름 애니", "여름밤의 색감.", "2026-09-02T03:00:00.000Z")],
        previewMemories: [memory("memory-2", "나만의 여름 애니", "여름밤의 색감.", "2026-09-02T03:00:00.000Z")],
      }],
    };
  }, cover);
});

test("My Titles keeps one album set across both views and restores the preference", async ({ page }) => {
  await page.goto("/titles/");
  await expect(page.getByRole("heading", { name: "내 작품", level: 1 })).toBeVisible();
  await expect(page.getByRole("radio", { name: "기억 함께 보기" })).toHaveAttribute("aria-checked", "true");
  await page.screenshot({ path: "test-results/title-collection-desktop.png", fullPage: true });

  const memoryKeys = await page.locator("[data-title-key]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-title-key")));
  await page.getByRole("radio", { name: "표지 보기" }).click();
  const posterKeys = await page.locator("[data-title-key]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-title-key")));
  expect(posterKeys).toEqual(memoryKeys);
  await page.screenshot({ path: "test-results/title-collection-poster-desktop.png", fullPage: true });

  await page.reload();
  await expect(page.getByRole("radio", { name: "표지 보기" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("link", { name: /장송의 프리렌/ }).click();
  await expect(page).toHaveURL(/\/title\/(?:index\.html)?\?animeId=anime%3A11111111/);
});

test("My Titles search and filters preserve saved and Memory meanings", async ({ page }) => {
  await page.goto("/titles/");
  await page.getByRole("button", { name: "저장됨" }).click();
  await expect(page.locator("[data-title-key]")) .toHaveCount(2);
  await page.getByRole("button", { name: "기억 있음" }).click();
  await expect(page.locator("[data-title-key]")) .toHaveCount(2);
  await page.getByRole("searchbox", { name: "내 작품 검색" }).fill("Frieren");
  await expect(page.locator("[data-title-key]")) .toHaveCount(1);
  await expect(page.getByText("장송의 프리렌", { exact: true })).toBeVisible();
});

test("My Titles restores genre tags and the saved responsive column control", async ({ page }) => {
  await page.goto("/titles/");
  const filterPanel = page.locator(".channel-explore");
  await expect(filterPanel.locator(".channel-choices")).toBeHidden();
  await filterPanel.locator("summary").click();
  await expect(filterPanel.getByRole("combobox")).toHaveCount(0);
  await filterPanel.getByRole("button", { name: "판타지", exact: true }).click();
  await expect(page.locator("[data-title-key]")) .toHaveCount(2);
  await page.getByRole("searchbox", { name: "내 작품 검색" }).fill("코미디");
  await expect(page.locator("[data-title-key]")) .toHaveCount(1);
  await expect(page.getByText("던전밥", { exact: true })).toBeVisible();

  await page.getByRole("searchbox", { name: "내 작품 검색" }).fill("");
  await filterPanel.getByRole("button", { name: "전체", exact: true }).click();
  await page.getByRole("radio", { name: "표지 보기" }).click();
  const slider = page.getByRole("slider");
  await slider.fill("8");
  await expect(page.getByText(/기준 8 · 현재/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("anime:grid:perRowBase:v1"))).toBe("8");
  const columnCount = await page.locator(".title-collection__poster-grid").evaluate((node) => (
    getComputedStyle(node).gridTemplateColumns.split(" ").length
  ));
  expect(columnCount).toBeGreaterThanOrEqual(7);
  await page.reload();
  await expect(page.getByRole("slider")).toHaveValue("8");
});

test("My Titles remains usable at 320px without horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/titles/");
  await expect(page.getByRole("heading", { name: "내 작품", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "정보와 탐색 펼치기" }).click();
  const compactControls = page.getByRole("radiogroup", { name: "작품 보기 방식" }).getByRole("radio");
  for (let index = 0; index < await compactControls.count(); index += 1) {
    expect(await compactControls.nth(index).evaluate((node) => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: "test-results/title-collection-mobile.png", fullPage: true });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  const expand = page.getByRole("button", { name: "정보와 탐색 펼치기" });
  if (await expand.isVisible()) await expand.click();
  await expect(page.getByRole("radio", { name: "표지 보기" })).toBeVisible();
  await page.getByRole("radio", { name: "표지 보기" }).click();
  await expect(page.getByRole("radio", { name: "표지 보기" })).toHaveAttribute("aria-checked", "true");
});

for (const width of [1440, 390, 320]) test(`Title exploration and per-title memory stacks preserve the same filtered titles at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/titles/");
  if (width < 700) await page.getByRole("button", { name: "정보와 탐색 펼치기" }).click();
  await page.getByRole("radio", { name: "표지 보기", exact: true }).click();
  const before = await page.locator("[data-title-key]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-title-key")));
  const frieren = page.locator('[data-title-key="ANILIST:154587"]');
  const dungeon = page.locator('[data-title-key="ANILIST:153518"]');
  const privateTitle = page.locator('[data-title-key="PRIVATE:private-one"]');
  await expect(frieren.locator('.title-cover-stack__memory')).toHaveCount(3);
  await expect(dungeon.locator('.title-cover-stack__memory')).toHaveCount(0);
  await expect(privateTitle.locator('.title-cover-stack__memory')).toHaveCount(1);
  expect(await frieren.locator('.title-cover-stack__memory').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-memory-card-id')))).toEqual(['memory-1', 'memory-3', 'memory-4']);
  await expect(page.getByRole('button', {name:'겹쳐보기',exact:true})).toHaveCount(0);
  await expect(frieren.locator('.title-cover')).toHaveCSS('transform','none');
  const geometry = await frieren.locator('.title-cover-stack').evaluate(stack => {
    const front = stack.querySelector('.title-cover')!.getBoundingClientRect();
    const back = stack.querySelector('.title-cover-stack__memory:last-child')!.getBoundingClientRect();
    return { front: front.right, back: back.right, layered: getComputedStyle(stack.querySelector('.title-cover')!).zIndex > getComputedStyle(stack.querySelector('.title-cover-stack__memory')!).zIndex };
  });
  expect(geometry.back).toBeGreaterThan(geometry.front); expect(geometry.layered).toBe(true);
  const coverSizes = await page.locator('.title-poster-tile .title-cover').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  expect(Math.max(...coverSizes) - Math.min(...coverSizes)).toBeLessThan(1);
  expect(await page.locator("[data-title-key]").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-title-key")))).toEqual(before);
  const explore = page.locator(".channel-section").filter({ has: page.getByRole("heading", { name: "탐색", exact: true }) });
  expect(await explore.evaluate(node => Boolean(node.closest(".channel-metadata")))).toBe(true);
  if (width === 1440) {
    const view = page.locator(".channel-section").filter({ has: page.getByRole("heading", { name: "보기", exact: true }) });
    const v = await view.boundingBox(), e = await explore.boundingBox();
    expect(Math.abs(e!.y - v!.y)).toBeLessThan(2); expect(e!.x).toBeGreaterThan(v!.x);
  }
  await explore.locator("summary").click();
  await explore.getByRole("button", { name: "판타지", exact: true }).click();
  await expect(page.locator("[data-title-key]")).toHaveCount(2);
  for (const title of ["장송의 프리렌", "던전밥"]) {
    const link = page.getByRole("link", { name: title, exact: true });
    await link.focus();
    const rect = await link.locator(".title-cover").boundingBox();
    expect(await link.evaluate((node, r) => node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), rect!)).toBe(true);
  }
  await page.screenshot({ path: `.cache/v84-service/titles-memory-stack-${width}.png`, fullPage: true });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(frieren.locator('.title-cover')).toHaveCSS('transform','none');
  await expect(frieren.locator('.title-cover-stack__memory').first()).toHaveCSS('transition-duration','0s');
  await explore.getByRole("button", { name: "전체", exact: true }).click();
  await page.getByRole("radio", { name: "기억 함께 보기", exact: true }).click();
  await expect(page.locator("[data-title-key]")).toHaveCount(3);
  await page.getByRole("radio", { name: "표지 보기", exact: true }).click();
  await page.getByRole("link", { name: "장송의 프리렌", exact: true }).click();
  await expect(page).toHaveURL(/animeId=anime%3A11111111/);
});
