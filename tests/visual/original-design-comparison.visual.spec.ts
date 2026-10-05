import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { installVisualFixtureState, seedSystemDesignCards } from '../helpers/memoryVisualFixtures';

// Explicit, disposable local comparison only. Never uses an existing browser profile.
test('original commit and current design with identical records and viewport', async ({ browser }) => {
  test.skip(process.env.MOEMOA_ORIGINAL_COMPARISON !== '1');
  test.setTimeout(180000);
  const output = resolve('deliverables/design-comparison-5bd1b3f');
  await mkdir(output, { recursive: true });
  const records = [
    { title: '여름의 끝에서', note: '엔딩이 끝나도 한참을 앉아 있었다.' },
    { title: '별을 따라 걷는 밤', note: '언젠가 다시 보고 싶은 밤하늘.' },
    { title: '다음 역, 우리 집', note: '별일 없는 하루가 좋아지는 이야기.' },
    { title: '초록빛 오후', note: '이 장면의 색이 오래 기억에 남았다.' },
    { title: '작은 행성의 편지', note: '마지막 편지를 다시 읽으며.' },
    { title: '여름의 끝에서', note: '두 번째로 보니 다르게 느껴진 장면.' },
    { title: '다음 역, 우리 집', note: '비 오는 날 다시 보고 싶은 이야기.' },
    { title: '별을 따라 걷는 밤', note: '함께 올려다본 별들.' },
    { title: '초록빛 오후', note: '창문으로 들어온 바람.' },
    { title: '작은 행성의 편지', note: '책갈피 사이에 남겨두고 싶다.' },
  ];
  const manifest: any = { baseline: '5bd1b3fb132baaafbcb6cf892ece0793139fc7ce', after: 'current uncommitted working tree',
    locale: 'ko', theme: 'light', records: '10 synthetic private cards; 3 boards; same fixed time and deterministic IDs',
    noRealUserData: true, noExternalNetwork: true, devToolbar: false, captures: [] };
  for (const [version, baseURL] of [['before', 'http://127.0.0.1:4323'], ['after', 'http://127.0.0.1:4324']] as const) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await installVisualFixtureState(page, { locale: 'ko', theme: 'light' });
      const cards = await seedSystemDesignCards(page, records);
      const boards = await page.evaluate(async ids => {
        const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
        const runtime = await getPlatformMemoryRuntime();
        const result = [];
        for (const [title, description, indexes] of [
          ['오래 남는 여름', '햇빛과 바람, 여름에 다시 꺼내볼 장면들', [0, 1, 2, 3, 4, 5, 6, 7]],
          ['다시 보고 싶은 밤', '잠들기 전 생각나는 이야기', [1, 4, 5, 7]],
          ['일상의 작은 순간', '평범한 하루를 좋아하게 되는 작품', [2, 3, 6, 8, 9]],
        ] as const) {
          const board = await runtime.createBoard({ title, description });
          for (const index of indexes) await runtime.addCardToBoard(board.id, ids[index]);
          result.push(board.id);
        }
        return result;
      }, cards);
      const capture = async (name: string, route: string, ready: string, width = 1440, height = 1000, prepare?: () => Promise<void>) => {
        await page.setViewportSize({ width, height });
        await page.goto(route);
        await expect(page.locator(ready).first()).toBeVisible();
        if (route === '/') await expect(page.locator('.home-rediscovery')).toBeVisible();
        if (version === 'after' && (route === '/' || route === '/boards/')) {
          // Each of the three fixture boards has at least three cards. Do not
          // photograph the lazy-loading placeholder as the completed design.
          await expect(page.locator('.board-collection__image')).toHaveCount(9);
        }
        if (prepare) await prepare();
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('astro-dev-toolbar')).toHaveCount(0);
        await page.screenshot({ path: resolve(output, `${name}-${version}.png`), animations: 'disabled' });
        await page.screenshot({ path: resolve(output, `${name}-${version}-full.png`), fullPage: true, animations: 'disabled' });
        manifest.captures.push({ version, name, route, viewport: [width, height], file: `${name}-${version}.png`,
          contentHeight: await page.evaluate(() => document.documentElement.scrollHeight) });
      };
      await capture('home-desktop', '/', '.home-memory-overview');
      await capture('boards-desktop', '/boards/', '.memory-boards__layout');
      await capture('board-detail-desktop', `/boards/?id=${boards[0]}`, '.memory-boards__cards');
      await capture('archive-desktop', '/archive/', '.memory-archive__card');
      await capture('titles-desktop', '/titles/', '.title-collection');
      await capture('titles-posters-desktop', '/titles/', '.title-collection', 1440, 1000, async () => {
        await page.getByRole('radio', { name: '표지 보기', exact: true }).click();
        await expect(page.locator('.title-poster-tile').first()).toBeVisible();
      });
      await capture('composer-desktop', '/memory/new/', '.memory-composer', 1440, 1000, async () => {
        await page.getByRole('button', { name: /디자인/ }).first().click();
        await page.locator('#memory-title-input').fill('봄을 기다리며');
        await page.locator('#memory-reflection-input').fill('오늘의 기분과 닮은 장면.');
      });
      await capture('boards-mobile', '/boards/', '.memory-boards__layout', 390, 844);
      await capture('board-detail-mobile', `/boards/?id=${boards[0]}`, '.memory-boards__cards', 390, 844);
      expect(errors).toEqual([]);
    } finally { await context.close(); }
  }
  await writeFile(resolve(output, 'capture-manifest.json'), JSON.stringify(manifest, null, 2));
});
