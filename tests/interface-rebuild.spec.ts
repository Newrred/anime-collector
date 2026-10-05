import { expect, test, type Page } from '@playwright/test';
import { seedSystemDesignCards } from './helpers/memoryVisualFixtures';

// These are synthetic private records in disposable browser contexts, never service data.
async function seedCollection(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('ui:locale:v1')) localStorage.setItem('ui:locale:v1', JSON.stringify('ko'));
    if (!localStorage.getItem('ui:theme:v1')) localStorage.setItem('ui:theme:v1', JSON.stringify('light'));
  });
  const cards = await seedSystemDesignCards(page, [
    { title: '여름의 끝에서', note: '엔딩이 끝나도 한참을 앉아 있었다.' },
    { title: '별을 따라 걷는 밤', note: '언젠가 다시 보고 싶은 밤하늘.' },
    { title: '다음 역, 우리 집', note: '별일 없는 하루가 좋아지는 이야기.' },
    { title: '초록빛 오후', note: '이 장면의 색이 오래 기억에 남았다.' },
    { title: '작은 행성의 편지', note: '마지막 편지를 다시 읽으며.' },
    { title: '여름의 끝에서', note: '두 번째로 보니 다르게 느껴진 장면.' },
  ]);
  const boards = await page.evaluate(async (ids) => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    const result: string[] = [];
    for (const [title, description, indexes] of [
      ['오래 남는 여름', '햇빛과 바람, 여름에 다시 꺼내볼 장면들', [0, 1, 3]],
      ['다시 보고 싶은 밤', '잠들기 전 생각나는 이야기', [1, 4, 5]],
      ['일상의 작은 순간', '평범한 하루를 좋아하게 되는 작품', [2, 3]],
    ] as const) {
      const board = await runtime.createBoard({ title, description });
      for (const index of indexes) await runtime.addCardToBoard(board.id, ids[index]);
      result.push(board.id);
    }
    return result;
  }, cards);
  return { cards, boards };
}

test('board collage uses saved members and stays connected to archive, title and home', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { cards } = await seedCollection(page);
  await page.goto('/boards/');
  await expect(page.locator('.board-collection')).toHaveCount(3);
  const summer = page.getByRole('link', { name: '오래 남는 여름', exact: true });
  await expect(summer.locator('.board-collection__image')).toHaveCount(3);
  await expect(summer).toContainText('기억 3개');
  await page.screenshot({ path: testInfo.outputPath('boards-desktop.png'), fullPage: true });
  await summer.click();
  await expect(page.locator('.memory-boards__cards .memory-preview')).toHaveCount(3);
  await page.screenshot({ path: testInfo.outputPath('board-detail.png'), fullPage: true });
  await page.goto('/');
  await expect(page.locator('.home-board-collections .board-collection')).toHaveCount(3);
  await page.locator('.home-board-collections').scrollIntoViewIfNeeded();
  await expect(page.locator('.home-board-collections .board-collection__image')).toHaveCount(8);
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png'), fullPage: true });
  await page.goto('/archive/');
  await expect(page.locator('.memory-archive__card')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('archive-desktop.png'), fullPage: true });
  await page.goto(`/memory/card/?id=${cards[0]}`);
  await expect(page.getByLabel('짧은 감상')).toHaveValue('엔딩이 끝나도 한참을 앉아 있었다.');
  await page.screenshot({ path: testInfo.outputPath('memory-detail.png'), fullPage: true });
  await page.goto('/titles/');
  await expect(page.locator('.title-collection')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('titles-desktop.png'), fullPage: true });
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: '디자인으로 만들기' }).click();
  await page.getByLabel('작품명').fill('봄을 기다리며');
  await page.getByLabel('짧은 감상').fill('오늘의 기분과 닮은 장면.');
  const previewRatio = await page.locator('.memory-composer__system-preview').evaluate(element => {
    const { width, height } = element.getBoundingClientRect();
    return width / height;
  });
  expect(previewRatio).toBeCloseTo(0.8, 1);
  await page.screenshot({ path: testInfo.outputPath('composer-desktop.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('collection routes reflow with usable navigation at narrow widths in both themes', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await seedCollection(page);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => localStorage.setItem('ui:theme:v1', JSON.stringify(value)), theme);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ['/', '/boards/', '/archive/', '/titles/', '/memory/new/']) {
        await page.goto(route);
        await expect(page.locator('main h1')).toBeVisible();
        const nav = page.locator('.top-nav__links--routes');
        await expect(nav).toBeVisible();
        expect(await nav.locator('a').count()).toBe(4);
        const geometry = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          sizes: Array.from(document.querySelectorAll('.top-nav__links--routes a')).map(a => a.getBoundingClientRect().height),
        }));
        expect(geometry.overflow, `${theme} ${width} ${route}`).toBeLessThanOrEqual(1);
        expect(geometry.sizes.every(height => height >= 44)).toBe(true);
        if (width === 390 && (route === '/boards/' || route === '/')) {
          if (route === '/boards/') await expect(page.locator('.board-collection__image').first()).toBeVisible();
          await page.screenshot({ path: testInfo.outputPath(`${theme}-${route === '/' ? 'home' : 'boards'}-mobile.png`), fullPage: true });
        }
      }
    }
  }
});

test('measured board hierarchy and multi-row image grid match the adopted reference rules', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  const { boards } = await seedCollection(page);
  const extraCards = await seedSystemDesignCards(page, Array.from({ length: 15 }, (_, index) => ({
    title: `수집한 장면 ${index + 1}`, note: index % 2 ? '다시 꺼내 보고 싶은 장면.' : '',
  })));
  await page.evaluate(async ({ boardId, cardIds }) => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    for (const id of cardIds) await runtime.addCardToBoard(boardId, id);
  }, { boardId: boards[0], cardIds: extraCards });
  const measurements = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => localStorage.setItem('ui:theme:v1', JSON.stringify(value)), theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.goto('/boards/');
      await expect(page.locator('.board-collection__cover').first()).toBeVisible();
      const cover = await page.locator('.board-collection__cover').first().evaluate(el => {
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        return { width: r.width, radius: s.borderRadius, gap: s.gap, contentWidth: document.body.clientWidth };
      });
      expect(cover.radius).toBe('16px');
      expect(cover.gap).toBe('2px');
      // The app reserves a scrollbar gutter, so use the actual layout width.
      expect(cover.width).toBeCloseTo(width === 1440 ? (cover.contentWidth - 64 - 96) / 4 : (cover.contentWidth - 48) / 2, 0);
      await page.goto(`/boards/?id=${boards[0]}`);
      await expect(page.locator('.memory-boards__cards > li')).toHaveCount(18);
      const detail = await page.evaluate(() => {
        const grid = document.querySelector('.memory-boards__cards')!;
        const title = document.querySelector('.memory-boards__detail h1')!;
        const frame = grid.querySelector('.memory-visual')!;
        const gs = getComputedStyle(grid), ts = getComputedStyle(title), fs = getComputedStyle(frame);
        return { columns: gs.gridTemplateColumns.split(' ').length, gap: gs.columnGap,
          title: { size: ts.fontSize, line: ts.lineHeight, weight: ts.fontWeight },
          frame: { width: frame.getBoundingClientRect().width, radius: fs.borderRadius, border: fs.borderTopWidth },
          left: grid.getBoundingClientRect().left, overflow: document.documentElement.scrollWidth - innerWidth };
      });
      expect(detail.columns).toBe(width === 1440 ? 5 : 2);
      expect(detail.gap).toBe(width === 1440 ? '32px' : '16px');
      expect(detail.left).toBe(width === 1440 ? 32 : 16);
      expect(detail.title).toEqual({ size: '26px', line: '32px', weight: '500' });
      expect(detail.frame.radius).toBe('3px');
      expect(detail.frame.border).toBe('1px');
      expect(detail.overflow).toBeLessThanOrEqual(1);
      measurements.push({ theme, width, cover, detail });
      await page.screenshot({ path: testInfo.outputPath(`measured-board-${theme}-${width}.png`), fullPage: true });
    }
  }
  await testInfo.attach('applied-layout-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
});
