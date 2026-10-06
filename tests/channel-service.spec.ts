import { expect, test, type Page } from "@playwright/test";
import { installAppState } from "./helpers/appState";

const evidence = ".cache/v84-service";
async function seed(page: Page) {
  await page.goto("/");
  return page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime();
    const cards: string[] = [];
    for (let i = 0; i < 7; i++) {
      const result = await runtime.createCard({
        titleChoice: i < 2 ? { kind: "ANIME_REF", animeId: "anime:11111111-1111-4111-8111-000000000001", displayTitle: "테스트 작품", sourceBinding: { provider: "ANILIST", externalId: "1" }, verificationState: "PROVIDER_CANDIDATE", genres: [], aliases: [] } : { kind: "PRIVATE_TITLE", displayTitle: `테스트 작품 ${i}` },
        note: `합성 테스트 감상 ${i}`,
        systemDesignSpec: { version: 1, templateId: "memory-gradient", paletteId: i % 2 ? "violet-night" : "mint-dusk", patternSeed: `channel-${i}`, titleLayout: "BOTTOM_LEFT", genreTokens: [] },
      });
      cards.push(result.cardId);
    }
    return cards;
  });
}
async function expand(page: Page) {
  await expect(page.locator(".channel-header")).toBeVisible();
  const button = page.locator(".channel-expand");
  if (await button.isVisible() && await button.getAttribute("aria-expanded") === "false") await button.click();
}
test.beforeEach(async ({ page }) => {
  await installAppState(page, { locale: "ko", watchLogs: [{ id: "log-channel", anilistId: 1, characterRefs: [
    { characterId: 10, nameSnapshot: "테스트 캐릭터 A", affinity: "최애", reasonTags: ["성장"] },
    { characterId: 20, nameSnapshot: "테스트 캐릭터 B", affinity: "기억남음", reasonTags: ["연출"] },
  ] }] });
  await page.route("https://**/*", route => route.abort());
});

test("real shelves persist, expand below their poster row and preserve card/title/Board identity", async ({ page }) => {
  const cards = await seed(page);
  await page.reload();
  await expect(page.getByText("아직 진열한 작품이 없어요.")).toBeVisible();
  await page.getByRole("button", { name: "책장 꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "선반 추가", exact: true }).click();
  await page.getByLabel("선반 이름").fill("오래 머무는 장면들");
  const choices = page.locator(".bookshelf-picker input");
  expect(await choices.count()).toBe(6);
  for (let i = 0; i < 6; i++) await choices.nth(i).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page.reload();
  await expect(page.locator(".bookshelf-tile")).toHaveCount(6);
  await page.getByRole("button", { name: "책장 꾸미기", exact: true }).click();
  await page.getByLabel("선반 이름").fill("취소할 변경");
  await page.locator(".bookshelf-picker input").first().uncheck();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator(".bookshelf-tile")).toHaveCount(6);
  await page.reload();
  await expect(page.getByRole("button", { name: "오래 머무는 장면들", exact: true })).toBeVisible();
  expect(await page.locator(".channel-wordmark").evaluate(node => node.getBoundingClientRect().top >= 0)).toBe(true);
  await page.getByRole("button", { name: "테스트 작품 기억 필름", exact: true }).click();
  const film = page.locator(".bookshelf-film");
  await expect(film).toBeVisible();
  const row = await page.locator(".bookshelf-grid").evaluate(grid => {
    const children = [...grid.children], filmIndex = children.findIndex(node => node.classList.contains("bookshelf-film"));
    const tiles = children.filter(node => node.classList.contains("bookshelf-tile"));
    return { filmIndex, selected: tiles.findIndex(node => node.querySelector('[aria-expanded="true"]')), tiles: tiles.length, cols: Number.parseInt(getComputedStyle(grid).getPropertyValue("--channel-columns")), width: children[filmIndex].getBoundingClientRect().width, gridWidth: grid.getBoundingClientRect().width };
  });
  expect(row.filmIndex).toBe(Math.min((Math.floor(row.selected / row.cols) + 1) * row.cols, row.tiles));
  expect(row.width).toBeCloseTo(row.gridWidth, 0);
  const alignment = () => film.locator(".title-album-card__previews").evaluate(rail => {
    const r = rail.getBoundingClientRect(), items = [...rail.querySelectorAll(".title-album-card__preview")].map(node => node.getBoundingClientRect());
    return { left: items[0].left - r.left, widthRatio: items[0].width / r.width, count: items.length };
  });
  expect(await alignment()).toMatchObject({ left: 0, count: 2 });
  expect((await alignment()).widthRatio).toBeLessThan(.4);
  await page.getByRole("button", { name: "테스트 작품 2 기억 필름", exact: true }).click();
  expect(await alignment()).toMatchObject({ left: 0, count: 1 });
  expect((await alignment()).widthRatio).toBeLessThan(.4);
  await page.screenshot({ path: `${evidence}/film-left-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await alignment()).toMatchObject({ left: 0, count: 1 });
  expect((await alignment()).widthRatio).toBeLessThan(.51);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidence}/film-left-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "테스트 작품 기억 필름", exact: true }).click();
  await page.screenshot({ path: `${evidence}/bookshelf-1280.png`, fullPage: true });
  await expand(page);
  await page.getByRole("button", { name: "오래 머무는 장면들", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("내 책장 / 오래 머무는 장면들");
  await page.getByRole("button", { name: "테스트 작품 기억 필름", exact: true }).click();
  const href = await film.locator(".title-album-card__identity").getAttribute("href");
  await film.locator(".title-album-card__preview").first().click();
  await expect(page.locator(".memory-detail__title-link")).toHaveAttribute("href", href!);
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await page.locator(".memory-detail textarea").fill("수정한 실제 감상");
  await page.locator('.memory-detail form button[type="submit"]').click();
  await page.reload();
  await expect(page.locator(".memory-detail__reflection")).toContainText("수정한 실제 감상");
  const boardId = await page.evaluate(async cardId => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    const runtime = await getPlatformMemoryRuntime(), board = await runtime.createBoard({ title: "실제 테스트 보드" });
    await runtime.addCardToBoard(board.id, cardId); return board.id;
  }, new URL(page.url()).searchParams.get("id"));
  await page.locator(".memory-board-picker > summary").click();
  await expect(page.locator(".memory-connected-boards a")).toHaveAttribute("href", `/boards/?id=${boardId}`);
  await page.screenshot({ path: `${evidence}/detail-1280.png`, fullPage: true });
  await page.locator(".memory-detail__title-link").click();
  await expect(page.locator(".title-hub__memory")).toHaveCount(2);
  const count = await page.evaluate(async () => { const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js"); return (await (await getPlatformMemoryRuntime()).listArchive()).length; });
  expect(count).toBe(cards.length);
});

test("a title added while the bookshelf is open becomes available without reloading", async ({ page }) => {
  await seed(page); await page.reload();
  await page.getByRole("button", { name: "책장 꾸미기", exact: true }).click();
  await page.getByRole("button", { name: "선반 추가", exact: true }).click();
  await expect(page.locator(".bookshelf-picker input")).toHaveCount(6);
  await page.evaluate(async () => {
    const { getPlatformMemoryRuntime } = await import("/src/features/memory/runtime/platformMemoryRuntime.js");
    await (await getPlatformMemoryRuntime()).createCard({ titleChoice: { kind: "PRIVATE_TITLE", displayTitle: "방금 저장한 작품" }, note: "합성 추가 기록", systemDesignSpec: { version: 1, templateId: "memory-gradient", paletteId: "mint-dusk", patternSeed: "fresh-shelf", titleLayout: "BOTTOM_LEFT", genreTokens: [] } });
    window.dispatchEvent(new Event("moemoa:library-updated"));
  });
  await expect(page.locator(".bookshelf-picker input")).toHaveCount(7);
  await page.locator(".bookshelf-picker").getByLabel("방금 저장한 작품", { exact: true }).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await expect(page.getByRole("button", { name: "방금 저장한 작품 기억 필름", exact: true })).toBeVisible();
});

test("archive uses stored title character facets, clears them, and restores them from a detail visit", async ({ page }) => {
  await seed(page); await page.goto("/archive/");
  await expect(page.locator(".memory-archive__card")).toHaveCount(7);
  await page.getByRole("group", { name: "포인트 태그", exact: true }).getByRole("button", { name: "서사", exact: true }).click();
  await expect(page.locator(".memory-archive__card")).toHaveCount(2);
  await page.getByRole("group", { name: "캐릭터", exact: true }).getByRole("button", { name: "테스트 캐릭터 B", exact: true }).click();
  await expect(page.locator(".memory-archive__card")).toHaveCount(0);
  await expect(page.getByText("검색 결과가 없어요.")).toBeVisible();
  await page.getByRole("button", { name: "전체 보기 ↗", exact: true }).click();
  await expect(page.locator(".memory-archive__card")).toHaveCount(7);
  await page.screenshot({ path: `${evidence}/archive-1280.png`, fullPage: true });
  await page.getByRole("group", { name: "캐릭터", exact: true }).getByRole("button", { name: "테스트 캐릭터 A", exact: true }).click();
  await page.locator(".memory-archive__card a").first().click();
  await page.locator(".memory-detail__header > a").click();
  await expect(page).toHaveURL(/character=10/);
  await expect(page.locator(".memory-archive__card")).toHaveCount(2);
  await page.getByRole("group", { name: "기억 보기", exact: true }).getByRole("button", { name: "표", exact: true }).click();
  await expect(page.locator(".channel-table tbody tr")).toHaveCount(2);
});

test("actual local image bytes retain their aspect ratio in archive and detail at desktop/mobile widths", async ({ page }) => {
  test.skip(process.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 !== "1", "Local Web image intake required");
  const uploads: string[] = []; page.on("request", request => { if (request.method() === "POST" && /storage|public-image|private-image/.test(request.url())) uploads.push(request.url()); });
  for (const [name, width, height] of [["가로 이미지", 900, 450], ["세로 이미지", 400, 600]] as const) {
    await page.goto("/memory/new/");
    const data = await page.evaluate(({ width, height }) => { const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const c = canvas.getContext("2d")!; const gradient = c.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, "#e60068"); gradient.addColorStop(1, "#191919"); c.fillStyle = gradient; c.fillRect(0, 0, width, height); c.fillStyle = "white"; c.font = "28px sans-serif"; c.fillText("SYNTHETIC TEST IMAGE", 20, 60); return canvas.toDataURL("image/png").split(",")[1]; }, { width, height });
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "이미지 선택", exact: true }).click();
    await (await chooser).setFiles({ name: "synthetic.png", mimeType: "image/png", buffer: Buffer.from(data, "base64") });
    await page.getByLabel("작품명", { exact: true }).fill(name);
    await page.locator(".memory-composer__rights input").check();
    await page.getByRole("button", { name: "카드 저장", exact: true }).click();
    await expect(page).toHaveURL(/\/archive\//);
  }
  await page.reload();
  await expect(page.locator(".memory-archive__card")).toHaveCount(2);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator(".channel-masonry img").evaluateAll(images => images.every((image: HTMLImageElement) => image.naturalWidth > 0 && Math.abs(image.clientWidth / image.clientHeight - image.naturalWidth / image.naturalHeight) < .02))).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/images-${width}.png`, fullPage: true });
  }
  await page.getByRole("link", { name: "가로 이미지", exact: true }).click();
  await expect(page.locator(".memory-detail__visual img")).toBeVisible();
  await page.screenshot({ path: `${evidence}/image-detail-320.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${evidence}/image-detail-1440.png`, fullPage: true });
  await page.getByRole("button", { name: "다크 모드로 전환", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => page.locator(".memory-detail__title-link").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(36, 36, 36)");
  await expect(page.locator(".memory-detail__title-link")).toHaveCSS("color", "rgb(237, 237, 237)");
  await page.screenshot({ path: `${evidence}/image-detail-dark.png`, fullPage: true });
  expect(uploads).toEqual([]);
});

test("320px controls expand, respond to keyboard input, and expose one common Memory action", async ({ page }) => {
  await seed(page); await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/titles/");
  await expand(page);
  const mode = page.getByRole("radio", { name: "기억 함께 보기", exact: true });
  await mode.focus(); await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("radio", { name: "표지 보기", exact: true })).toBeFocused();
  await expect(page.getByRole("radio", { name: "표지 보기", exact: true })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator(".top-nav__memory-action")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator(".channel-wordmark").evaluate(node => node.getBoundingClientRect().top >= 0)).toBe(true);
  await page.screenshot({ path: `${evidence}/titles-320.png`, fullPage: true });
});
