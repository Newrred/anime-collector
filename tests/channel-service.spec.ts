import { expect, test, type Page } from "@playwright/test";
import { installAppState } from "./helpers/appState";
import { installSignedInPhotoAccount } from './helpers/signedInPhotoAccount';

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

test("real shelves persist, unfold beside their cover and preserve card/title/Board identity", async ({ page }) => {
  const cards = await seed(page);
  await page.reload();
  await expect(page.getByText("아직 진열한 작품이 없어요.")).toBeVisible();
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
  await page.getByRole("button", { name: "선반 추가", exact: true }).click();
  await page.getByLabel("선반 이름").fill("오래 머무는 장면들");
  const choices = page.locator(".bookshelf-picker input");
  expect(await choices.count()).toBe(6);
  for (let i = 0; i < 6; i++) await choices.nth(i).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  await page.reload();
  await expect(page.locator(".bookshelf-tile")).toHaveCount(6);
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
  await page.getByLabel("선반 이름").fill("취소할 변경");
  await page.locator(".bookshelf-picker input").first().uncheck();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator(".bookshelf-tile")).toHaveCount(6);
  await page.reload();
  await expect(page.getByRole("button", { name: "오래 머무는 장면들", exact: true })).toBeVisible();
  expect(await page.locator(".channel-wordmark").evaluate(node => node.getBoundingClientRect().top >= 0)).toBe(true);
  const cover = page.getByRole("button", { name: "테스트 작품 기억 펼치기", exact: true });
  const coverWidth = await cover.boundingBox();
  await cover.click();
  const film = page.locator(".bookshelf-film");
  await expect(film).toBeVisible();
  const row = await page.locator(".bookshelf-grid").evaluate(grid => {
    const selected = grid.querySelector('.bookshelf-tile.is-expanded')!, cover = selected.querySelector('.bookshelf-cover-area')!.getBoundingClientRect(), fan = selected.querySelector('.collection-memory-fan')!.getBoundingClientRect();
    return { width: selected.getBoundingClientRect().width, gridWidth: grid.getBoundingClientRect().width, side: fan.left >= cover.right, topDifference: Math.abs(fan.top - cover.top) };
  });
  expect(row.width).toBeCloseTo(row.gridWidth, 0);
  expect(row.side).toBe(true); expect(row.topDifference).toBeLessThan(1);
  expect((await cover.boundingBox())!.width).toBeCloseTo(coverWidth!.width, 0);
  const alignment = () => film.locator(".title-album-card__previews").evaluate(rail => {
    const r = rail.getBoundingClientRect(), items = [...rail.querySelectorAll(".title-album-card__preview")].map(node => node.getBoundingClientRect());
    return { left: items[0].left - r.left, widthRatio: items[0].width / r.width, count: items.length };
  });
  await expect.poll(alignment).toMatchObject({ left: 0, count: 2 });
  expect((await alignment()).widthRatio).toBeLessThan(.4);
  await page.getByRole("button", { name: "테스트 작품 2 기억 펼치기", exact: true }).click();
  await expect.poll(alignment).toMatchObject({ left: 0, count: 1 });
  expect((await alignment()).widthRatio).toBeLessThan(.4);
  await page.screenshot({ path: `${evidence}/collection-side-fan-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.locator('.bookshelf-tile.is-expanded').evaluate(tile => ({ cover: tile.querySelector('.bookshelf-cover-area')!.getBoundingClientRect().bottom, fan: tile.querySelector('.collection-memory-fan')!.getBoundingClientRect().top }));
  expect(mobile.fan).toBeGreaterThan(mobile.cover);
  expect(await alignment()).toMatchObject({ left: 0, count: 1 });
  expect((await alignment()).widthRatio).toBeLessThan(.65);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${evidence}/collection-side-fan-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "테스트 작품 기억 펼치기", exact: true }).click();
  await page.screenshot({ path: `${evidence}/bookshelf-1280.png`, fullPage: true });
  await expand(page);
  await page.getByRole("button", { name: "오래 머무는 장면들", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("컬렉션 / 오래 머무는 장면들");
  await page.getByRole("button", { name: "테스트 작품 기억 펼치기", exact: true }).click();
  const href = await film.locator(".title-album-card__identity").getAttribute("href");
  await film.locator(".title-album-card__preview").first().click();
  await expect(page.locator(".memory-detail__title-link")).toHaveAttribute("href", href!);
  await page.getByRole("button", { name: "기억 수정", exact: true }).click();
  await page.locator(".memory-detail textarea").fill("수정한 실제 감상");
  await page.locator('.memory-detail form button[type="submit"]').click();
  await expect(page.locator(".memory-detail__reflection")).toContainText("수정한 실제 감상");
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
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
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
  await expect(page.getByRole("button", { name: "방금 저장한 작품 기억 펼치기", exact: true })).toBeVisible();
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

test("Collection previews its own saved memories behind each cover and keeps every cover selectable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page); await page.reload();
  await page.getByRole("button", { name: "컬렉션 편집", exact: true }).click();
  await page.getByRole("button", { name: "선반 추가", exact: true }).click();
  const choices = page.locator(".bookshelf-picker input");
  for (let i = 0; i < await choices.count(); i++) await choices.nth(i).check();
  await page.getByRole("button", { name: "적용", exact: true }).click();
  const remembered = page.locator('.bookshelf-tile').filter({ has: page.getByRole('button', { name: '테스트 작품 기억 펼치기', exact: true }) });
  const first = remembered.locator('.title-cover-stack__front');
  const backs = remembered.locator('.title-cover-stack__memory');
  const rememberedTrigger = remembered.locator('.bookshelf-cover-trigger');
  await expect(backs).toHaveCount(2);
  await expect(page.getByRole('button', { name: '겹쳐보기', exact: true })).toHaveCount(0);
  await expect(first).toHaveCSS('transform', 'none');
  expect(await page.locator('.bookshelf-tile .title-cover').evaluateAll(nodes => {
    const [a, b] = nodes.map(n => n.getBoundingClientRect()); return a.right <= b.left;
  })).toBe(true);
  const triggers = page.locator(".bookshelf-cover-trigger");
  for (let i = 0; i < await triggers.count(); i++) {
    const trigger = triggers.nth(i);
    await trigger.scrollIntoViewIfNeeded();
    expect(await trigger.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(".bookshelf-film")).toHaveCount(1);
    const title = await trigger.getAttribute("aria-label");
    await expect(page.locator(".bookshelf-film .title-album-card__title")).toHaveText(title!.replace(" 기억 펼치기", ""));
  }
  await page.locator('.film-close').click();
  await rememberedTrigger.scrollIntoViewIfNeeded();
  const exposed = await remembered.evaluate(tile => {
    const front = tile.querySelector('.title-cover')!.getBoundingClientRect();
    const rear = tile.querySelector('.title-cover-stack__memory:last-child')!.getBoundingClientRect();
    const point = { x: (front.right + rear.right) / 2, y: (front.top + front.bottom) / 2 };
    return { ...point, hit: tile.querySelector('.bookshelf-cover-trigger')!.contains(document.elementFromPoint(point.x, point.y)) };
  });
  expect(exposed.hit).toBe(true);
  await page.mouse.click(exposed.x, exposed.y);
  await expect(rememberedTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.bookshelf-film .title-album-card__title')).toHaveText('테스트 작품');
  await expect(page.locator('.collection-memory-fan .title-album-card__preview').last()).toHaveCSS('transform', 'none');
  await expect(rememberedTrigger).toHaveAttribute('aria-controls', await page.locator('.collection-memory-fan').getAttribute('id') as string);
  const previews = page.locator(".title-album-card__previews");
  expect(await previews.evaluate(node => getComputedStyle(node, "::before").content)).toBe("none");
  await page.screenshot({ path: `${evidence}/collection-memory-stack-1440.png`, fullPage: true });
  await remembered.screenshot({ path: `${evidence}/collection-side-fan-open-1440.png` });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator('.collection-memory-fan .title-album-card__preview').first()).toHaveCSS('animation-name', 'none');
  await expect(first).toHaveCSS("transform", "none");
  await expect(backs.first()).toHaveCSS('transition-duration', '0s');
  const stillPose = await backs.first().evaluate(node => getComputedStyle(node).transform);
  await rememberedTrigger.focus();
  await expect(first).toHaveCSS('transform', 'none');
  await expect(backs.first()).toHaveCSS('transform', stillPose);
  await page.keyboard.press('Escape');
  await expect(page.locator('.collection-memory-fan')).toHaveCount(0);
  await expect(rememberedTrigger).toBeFocused();
  await rememberedTrigger.click();
  await expect(page.locator('.collection-memory-fan')).toBeVisible();
  await rememberedTrigger.click();
  await expect(page.locator('.collection-memory-fan')).toHaveCount(0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await rememberedTrigger.click();
    const rail = page.locator('.collection-memory-fan .title-album-card__previews');
    expect(await rail.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await rail.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    expect(await rail.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await page.screenshot({ path: `${evidence}/collection-side-fan-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await expect(first).toHaveCSS("transform", "none");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expand(page);
  await page.getByRole("group", { name: "컬렉션 보기", exact: true }).getByRole("button", { name: "표", exact: true }).click();
  await expect(page.locator(".channel-table tbody tr")).toHaveCount(6);
});

test("actual local image bytes retain their aspect ratio in archive and detail at desktop/mobile widths", async ({ page }) => {
  test.skip(process.env.PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1 !== '1' || process.env.PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 !== '1', 'Authenticated Web photo flags required');
  const { uploads } = await installSignedInPhotoAccount(page, 'ko');
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
  await page.goto('/');
  await page.getByRole('button', {name:'컬렉션 편집',exact:true}).click();
  await page.getByRole('button', {name:'선반 추가',exact:true}).click();
  for (const name of ['가로 이미지', '세로 이미지']) await page.locator('.bookshelf-picker').getByLabel(name, {exact:true}).check();
  await page.getByRole('button', {name:'적용',exact:true}).click();
  await expect.poll(() => page.locator('.title-cover-stack__memory img').evaluateAll(images => images.length === 2 && images.every((image: HTMLImageElement) => image.naturalWidth > 0))).toBe(true);
  const tile = page.locator('.bookshelf-tile').filter({has:page.getByRole('button',{name:'가로 이미지 기억 펼치기',exact:true})});
  const source = await tile.locator('.title-cover-stack__memory img').getAttribute('src');
  await tile.getByRole('button',{name:'가로 이미지 기억 펼치기',exact:true}).click();
  const image = tile.locator('.collection-memory-fan img');
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute('src',source!);
  await expect(image).toHaveCSS('object-fit','contain');
  await expect(tile.locator('.collection-memory-fan .title-album-card__preview')).toHaveCSS('transform','none');
  await tile.screenshot({path:`${evidence}/collection-side-fan-local-image-dark.png`});
  expect(uploads).toHaveLength(2);
});

test('Collection unfolds at most three real previews and keeps all four memories in Title Hub', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await seed(page);
  await page.evaluate(async () => {
    const {getPlatformMemoryRuntime} = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    for (let i=0;i<2;i++) await runtime.createCard({
      titleChoice:{kind:'ANIME_REF',animeId:'anime:11111111-1111-4111-8111-000000000001',displayTitle:'테스트 작품',sourceBinding:{provider:'ANILIST',externalId:'1'},verificationState:'PROVIDER_CANDIDATE',genres:[],aliases:[]},
      note:`합성 추가 기억 ${i}`,systemDesignSpec:{version:1,templateId:'memory-gradient',paletteId:'mint-dusk',patternSeed:`fan-cap-${i}`,titleLayout:'BOTTOM_LEFT',genreTokens:[]}
    });
  });
  await page.reload();
  await page.getByRole('button',{name:'컬렉션 편집',exact:true}).click();
  await page.getByRole('button',{name:'선반 추가',exact:true}).click();
  await page.locator('.bookshelf-picker').getByLabel('테스트 작품',{exact:true}).check();
  await page.getByRole('button',{name:'적용',exact:true}).click();
  await expect(page.locator('.title-cover-stack__memory')).toHaveCount(3);
  const cardIds = await page.locator('.title-cover-stack__memory').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-memory-card-id')));
  await page.getByRole('button',{name:'테스트 작품 기억 펼치기',exact:true}).click();
  const previews = page.locator('.collection-memory-fan .title-album-card__preview');
  await expect(previews).toHaveCount(3);
  expect(await previews.evaluateAll(nodes => nodes.map(node => new URL((node as HTMLAnchorElement).href).searchParams.get('id')))).toEqual(cardIds);
  await expect(page.locator('.title-album-card__extra')).toHaveText('+1');
  await expect(previews.last()).toHaveCSS('transform','none');
  await page.locator('.bookshelf-tile.is-expanded').screenshot({path:`${evidence}/collection-side-fan-three-1440.png`});
  await page.getByRole('link',{name:'기억 4개 모두 보기 →',exact:true}).click();
  await expect(page.locator('.title-hub__memory')).toHaveCount(4);
  expect(await page.evaluate(async () => {const {getPlatformMemoryRuntime}=await import('/src/features/memory/runtime/platformMemoryRuntime.js');return (await (await getPlatformMemoryRuntime()).listArchive()).length;})).toBe(9);
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
