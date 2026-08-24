import { expect, test, type Page } from '@playwright/test';
import {
  CATALOG_ANIME_ID,
  createMissingImageCard,
  installVisualFixtureState,
  openCatalogSearch,
  openMemoryDetail,
  seedSystemDesignCards,
  type VisualLocale,
  type VisualTheme,
} from '../helpers/memoryVisualFixtures';
import { assertPrimaryTargets, expectGoldenScreenshot } from '../helpers/visualAssertions';

type GoldenSetup = {
  width: number;
  height: number;
  locale: VisualLocale;
  theme: VisualTheme;
  imageMode?: 'missing' | 'save-error';
};

async function prepare(page: Page, setup: GoldenSetup) {
  await page.setViewportSize({ width: setup.width, height: setup.height });
  await installVisualFixtureState(page, setup);
}

async function expectReadyPage(page: Page, root: string, screenshot: string) {
  await expect(page.locator(root)).toBeVisible();
  await expect(page.locator('astro-dev-toolbar')).toHaveCount(0);
  await assertPrimaryTargets(page);
  await expectGoldenScreenshot(page, screenshot);
}

const archiveCards = [
  { title: 'Cowboy Bebop', note: 'A quiet blue hour between stars.', animeRef: true, paletteId: 'violet-night' },
  { title: 'Violet Evergarden', note: 'Words that finally found their destination.', paletteId: 'violet-dawn' },
  { title: 'Frieren', note: 'A small memory from a very long journey.', paletteId: 'moss-light' },
  { title: 'Mob Psycho 100', note: 'Choosing kindness when power would be easier.', paletteId: 'coral-night' },
];

test('navigation — 320 EN dark compact search', async ({ page }) => {
  await prepare(page, { width: 320, height: 720, locale: 'en', theme: 'dark' });
  await page.goto('/');
  await openCatalogSearch(page, { mobile: true });
  await expectReadyPage(page, '.quick-action-sheet', 'navigation-en-dark-320x720.png');
});

test('navigation — 1440 KO light desktop search result', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'ko', theme: 'light' });
  await page.goto('/');
  await openCatalogSearch(page, { mobile: false });
  await expectReadyPage(page, '.quick-action-panel', 'navigation-ko-light-1440x900.png');
});

test('Home — 390 EN dark empty', async ({ page }) => {
  await prepare(page, { width: 390, height: 844, locale: 'en', theme: 'dark' });
  await page.goto('/');
  await expectReadyPage(page, '.home-empty-state', 'home-empty-en-dark-390x844.png');
});

test('Home — 1440 KO light empty', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'ko', theme: 'light' });
  await page.goto('/');
  await expectReadyPage(page, '.home-empty-state', 'home-empty-ko-light-1440x900.png');
});

test('Home — 390 KO dark active', async ({ page }) => {
  await prepare(page, { width: 390, height: 844, locale: 'ko', theme: 'dark' });
  await seedSystemDesignCards(page, archiveCards.slice(0, 2));
  await page.goto('/');
  await expectReadyPage(page, '.home-memory-overview', 'home-active-ko-dark-390x844.png');
});

test('Home — 1440 EN dark active', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'en', theme: 'dark' });
  await seedSystemDesignCards(page, archiveCards.slice(0, 3));
  await page.goto('/');
  await expectReadyPage(page, '.home-memory-overview', 'home-active-en-dark-1440x900.png');
});

test('Composer — 320 EN dark empty', async ({ page }) => {
  await prepare(page, { width: 320, height: 720, locale: 'en', theme: 'dark' });
  await page.goto('/memory/new/');
  await expect(page.locator('.memory-composer__save-gate button')).toBeDisabled();
  await expectReadyPage(page, '.memory-composer', 'composer-empty-en-dark-320x720.png');
});

test('Composer — 390 KO light system design selected', async ({ page }) => {
  await prepare(page, { width: 390, height: 844, locale: 'ko', theme: 'light' });
  await page.goto('/memory/new/');
  await page.locator('#memory-title-input').fill('바이올렛 에버가든');
  await page.locator('.memory-composer__image-actions button').last().click();
  await expect(page.locator('.memory-composer__system-preview')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectReadyPage(page, '.memory-composer', 'composer-system-ko-light-390x844.png');
});

test('Composer — 1440 EN dark catalog title selected', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'en', theme: 'dark' });
  await page.goto(`/memory/new/?animeId=${encodeURIComponent(CATALOG_ANIME_ID)}&title=temporary`);
  await expect(page.locator('#memory-title-input')).toHaveValue('카우보이 비밥');
  await expect(page.locator('.memory-composer__selected-title')).toBeVisible();
  await expectReadyPage(page, '.memory-composer', 'composer-title-en-dark-1440x900.png');
});

test('Composer — 1440 KO dark save error', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'ko', theme: 'dark', imageMode: 'save-error' });
  await page.goto('/memory/new/');
  await expect(page.locator('.memory-composer__preview')).toBeVisible();
  await page.locator('#memory-title-input').fill('테스트 기억');
  await page.locator('#memory-reflection-input').fill('저장 실패 상태도 다음 행동을 명확히 알려줘야 한다.');
  await page.locator('.memory-composer__rights input').check();
  await page.locator('.memory-composer__save-gate button').click();
  await expect(page.locator('.memory-composer__error')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectReadyPage(page, '.memory-composer', 'composer-error-ko-dark-1440x900.png');
});

test('Archive — 320 KO dark empty', async ({ page }) => {
  await prepare(page, { width: 320, height: 720, locale: 'ko', theme: 'dark' });
  await page.goto('/archive/');
  await expect(page.locator('.memory-archive__state')).toBeVisible();
  await expectReadyPage(page, '.memory-archive', 'archive-empty-ko-dark-320x720.png');
});

test('Archive — 390 EN dark populated', async ({ page }) => {
  await prepare(page, { width: 390, height: 844, locale: 'en', theme: 'dark' });
  await seedSystemDesignCards(page, archiveCards);
  await page.goto('/archive/');
  await expect(page.locator('.memory-archive__card')).toHaveCount(4);
  await expectReadyPage(page, '.memory-archive', 'archive-populated-en-dark-390x844.png');
});

test('Archive — 1440 KO light populated', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'ko', theme: 'light' });
  await seedSystemDesignCards(page, archiveCards);
  await page.goto('/archive/');
  await expect(page.locator('.memory-archive__card')).toHaveCount(4);
  await expectReadyPage(page, '.memory-archive', 'archive-populated-ko-light-1440x900.png');
});

test('Detail — 390 EN dark READY', async ({ page }) => {
  await prepare(page, { width: 390, height: 844, locale: 'en', theme: 'dark' });
  const [cardId] = await seedSystemDesignCards(page, archiveCards.slice(0, 1));
  await openMemoryDetail(page, cardId);
  await expectReadyPage(page, '.memory-detail', 'detail-ready-en-dark-390x844.png');
});

test('Detail — 320 KO dark MISSING', async ({ page }) => {
  await prepare(page, { width: 320, height: 720, locale: 'ko', theme: 'dark', imageMode: 'missing' });
  await createMissingImageCard(page, { locale: 'ko' });
  await expect(page.locator('.memory-visual--missing')).toBeVisible();
  await expectReadyPage(page, '.memory-detail', 'detail-missing-ko-dark-320x720.png');
});

test('Detail — 1440 KO light READY', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'ko', theme: 'light' });
  const [cardId] = await seedSystemDesignCards(page, archiveCards.slice(1, 2));
  await openMemoryDetail(page, cardId);
  await expectReadyPage(page, '.memory-detail', 'detail-ready-ko-light-1440x900.png');
});

test('Library/Memory split — 390 EN dark search actions', async ({ page }) => {
  await prepare(page, { width: 390, height: 844, locale: 'en', theme: 'dark' });
  await page.goto('/library/');
  await openCatalogSearch(page, { mobile: true });
  await expect(page.locator('.quick-action-row__create-action')).toBeVisible();
  await expect(page.locator('.quick-action-row__library-action')).toBeVisible();
  await expectReadyPage(page, '.quick-action-sheet', 'library-search-en-dark-390x844.png');
});

test('Library/Memory split — 1440 KO light added-to-Library status', async ({ page }) => {
  await prepare(page, { width: 1440, height: 900, locale: 'ko', theme: 'light' });
  await page.goto('/library/');
  await openCatalogSearch(page, { mobile: false });
  await page.locator('.quick-action-row__library-action').click();
  await expect(page.locator('.quick-action-panel__feedback[role="status"]')).toBeVisible();
  const storedCover = page.locator('.library-grid .library-card img').first();
  await expect(storedCover).toBeVisible();
  await expect.poll(() => storedCover.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expectReadyPage(page, '.quick-action-panel', 'library-added-ko-light-1440x900.png');
});
