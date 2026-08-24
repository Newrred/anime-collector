import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  createMissingImageCard,
  installVisualFixtureState,
  openMemoryDetail,
  seedSystemDesignCards,
} from './helpers/memoryVisualFixtures';

const LONG_MEMORY_TITLE = 'A deliberately long memory title that remains complete for assistive technology while the visual card keeps a stable two-line rhythm';
const SYSTEM_SPEC = Object.freeze({
  version: 1,
  templateId: 'memory-gradient',
  paletteId: 'violet-night',
  patternSeed: 'ui-readiness-shared-visual',
  titleLayout: 'BOTTOM_LEFT',
  genreTokens: ['Drama'],
});
const SYNTHETIC_IMAGE = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22300%22 viewBox=%220 0 600 300%22%3E%3Crect width=%22600%22 height=%22300%22 fill=%22%237d6be8%22/%3E%3C/svg%3E';

async function prepareReactClient(page: import('@playwright/test').Page) {
  try {
    await page.evaluate(() => import('/@id/react-dom/client').then(() => true));
  } catch (error) {
    if (!String(error).includes('Execution context was destroyed')) throw error;
  }
  await page.waitForLoadState('domcontentloaded');
}

async function renderMemoryDisplayFixtures(
  page: import('@playwright/test').Page,
  imageSrc = SYNTHETIC_IMAGE,
  featuredVisual: Record<string, unknown> = { kind: 'SYSTEM_DESIGN', designSpec: SYSTEM_SPEC },
) {
  await page.goto('/');
  await prepareReactClient(page);
  const render = () => page.evaluate(async ({ imageSrc, longTitle, featuredVisual }) => {
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const [{ default: MemoryCardPreview }, { default: MemoryVisual }] = await Promise.all([
      import('/src/features/memory/components/MemoryCardPreview.jsx'),
      import('/src/features/memory/components/MemoryVisual.jsx'),
    ]);
    const element = React.createElement;
    const root = document.createElement('div');
    root.id = 'shared-memory-display-fixture';
    document.body.replaceChildren(root);
    createRoot(root).render(element('main', { className: 'memory-visual-scope' }, [
      element(MemoryCardPreview, {
        key: 'image-grid',
        href: '/memory/card/?id=image-card',
        title: longTitle,
        cue: 'A two-line cue that belongs to this private memory and never becomes part of the link name.',
        dateLabel: '24 Aug 2026',
        badge: 'Private image',
        visual: { kind: 'IMAGE', src: imageSrc, alt: 'A violet scene saved with this memory' },
        variant: 'grid',
        missingLabel: 'Visual unavailable',
      }),
      element(MemoryCardPreview, {
        key: 'system-featured',
        href: '/memory/card/?id=system-card',
        title: 'A system-designed memory',
        cue: 'A quieter featured memory cue.',
        dateLabel: '23 Aug 2026',
        badge: 'System design',
        visual: featuredVisual,
        variant: 'featured',
        systemCopy: {
          label: 'System design preview',
          fallbackTitle: 'A system-designed memory',
          footer: 'MOEMOA · Private memory',
        },
        missingLabel: 'Visual unavailable',
      }),
      element('section', { key: 'missing', 'aria-label': 'Missing visual fixture' },
        element(MemoryVisual, { visual: { kind: 'MISSING' }, missingLabel: 'Visual unavailable' })),
      element('section', { key: 'detail', 'aria-label': 'Contained detail visual fixture' },
        element(MemoryVisual, {
          visual: { kind: 'IMAGE', src: imageSrc, alt: 'The complete saved scene' },
          fit: 'contain',
        })),
      element('section', { key: 'invalid-alt', 'aria-label': 'Undescribed image fixture' },
        element(MemoryVisual, {
          visual: { kind: 'IMAGE', src: imageSrc },
          missingLabel: 'Missing accessible visual description',
        })),
    ]));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { imageSrc, longTitle: LONG_MEMORY_TITLE, featuredVisual });

  try {
    await render();
  } catch (error) {
    if (!String(error).includes('Execution context was destroyed')) throw error;
    await page.waitForLoadState('domcontentloaded');
    await prepareReactClient(page);
    await render();
  }
}

async function seedSystemDesignArchive(page: import('@playwright/test').Page, count = 4) {
  await page.addInitScript(() => {
    localStorage.setItem('ui:locale:v1', JSON.stringify('en'));
  });
  await page.goto('/');
  await page.evaluate(async (cardCount) => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    for (let index = 1; index <= cardCount; index += 1) {
      await runtime.createCard({
        titleChoice: {
          kind: 'PRIVATE_TITLE',
          displayTitle: index === cardCount ? 'Violet Evergarden' : `Memory ${index}`,
        },
        systemDesignSpec: {
          version: 1,
          templateId: 'memory-gradient',
          paletteId: 'violet-night',
          patternSeed: `archive-gallery-${index}`,
          titleLayout: 'BOTTOM_LEFT',
          genreTokens: ['Drama'],
        },
        note: `Reflection ${index}`,
        rightsConfirmed: false,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }, count);
  await page.goto('/archive/');
  await expect(page.locator('.memory-archive__grid')).toBeVisible();
}

test('isolated visual test surface uses its owned server without the Astro toolbar', async ({ page }) => {
  test.skip(process.env.MOEMOA_VISUAL_TEST !== '1', 'This contract belongs to the isolated visual runner.');
  await page.goto('/');

  const current = new URL(page.url());
  expect(current.hostname).toBe('127.0.0.1');
  expect(current.port).not.toBe('4321');
  await expect(page.locator('astro-dev-toolbar')).toHaveCount(0);
});

test('shared memory displays cover every visual kind without owning save or delete behavior', async ({ page }) => {
  await renderMemoryDisplayFixtures(page);

  await expect(page.locator('.memory-preview--grid')).toHaveCount(1);
  await expect(page.locator('.memory-preview--featured')).toHaveCount(1);
  await expect(page.getByRole('link', { name: LONG_MEMORY_TITLE, exact: true })).toHaveAttribute(
    'href',
    '/memory/card/?id=image-card',
  );
  await expect(page.getByRole('img', { name: 'A violet scene saved with this memory' })).toBeVisible();
  await expect(page.locator('.memory-visual--system .system-design-preview')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Visual unavailable' })).toBeVisible();
  await expect(page.locator('.memory-visual--contain img')).toHaveCSS('object-fit', 'contain');
  await expect(page.getByRole('region', { name: 'Undescribed image fixture' }).locator('img')).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Missing accessible visual description' })).toBeVisible();
  await expect(page.locator('#shared-memory-display-fixture button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /save|delete|remove/iu })).toHaveCount(0);

  const componentSources = await Promise.all([
    readFile('src/features/memory/components/MemoryVisual.jsx', 'utf8'),
    readFile('src/features/memory/components/MemoryCardPreview.jsx', 'utf8'),
  ]);
  expect(componentSources.join('\n')).not.toMatch(
    /getPlatformMemoryRuntime|indexedDB|localStorage|deleteCard|saveCard|window\.location/u,
  );
});

test('Archive presents ordered 4:5 cards in the approved responsive columns', async ({ page }) => {
  await seedSystemDesignArchive(page);

  await expect(page.locator('.memory-preview--grid')).toHaveCount(4);
  const archiveCss = await readFile('src/features/memory/components/archive-view.css', 'utf8');
  expect(archiveCss).toMatch(/@media \(min-width: 1200px\)[\s\S]*?grid-template-columns: repeat\(4,/u);
  await expect(page.locator('.memory-preview__title')).toHaveText([
    'Violet Evergarden',
    'Memory 3',
    'Memory 2',
    'Memory 1',
  ]);
  await expect(page.getByRole('link', { name: 'Violet Evergarden', exact: true })).toHaveAttribute('href', /memory\/card\/\?id=/u);

  // Firefox subtracts the classic vertical scrollbar from media-query width
  // while reporting it in innerWidth. Remove that platform variable so this
  // assertion exercises the approved 1199/1200 CSS breakpoint itself.
  await page.evaluate(() => {
    document.documentElement.style.overflow = 'hidden';
  });

  for (const specimen of [
    { width: 320, height: 720, columns: 1 },
    { width: 360, height: 760, columns: 2 },
    { width: 768, height: 900, columns: 3 },
    { width: 1199, height: 900, columns: 3 },
    // Firefox reports a 1200px test viewport as 1199.916 visual CSS pixels;
    // 1201 proves the exact 1200px media-query side without engine rounding.
    { width: 1201, height: 900, columns: 4 },
  ]) {
    await page.setViewportSize(specimen);
    const responsive = await page.locator('.memory-archive__grid').evaluate((grid) => ({
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      wideQuery: matchMedia('(min-width: 1200px)').matches,
    }));
    expect(responsive.columns, JSON.stringify({ specimen, responsive })).toBe(specimen.columns);
    const geometry = await page.locator('.memory-archive__grid').evaluate((grid) => {
      const cards = [...grid.querySelectorAll('.memory-archive__card')];
      const firstCard = cards[0]?.getBoundingClientRect();
      const firstVisual = cards[0]?.querySelector('.memory-visual')?.getBoundingClientRect();
      const systemTitle = cards[0]?.querySelector('.system-design-preview strong');
      return {
        viewportWidth: innerWidth,
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        cardWidth: firstCard?.width || 0,
        visualRatio: firstVisual ? firstVisual.width / firstVisual.height : 0,
        systemTitleFits: systemTitle ? systemTitle.scrollWidth <= systemTitle.clientWidth + 0.5 : false,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.columns, JSON.stringify({ specimen, viewportWidth: geometry.viewportWidth })).toBe(specimen.columns);
    expect(geometry.cardWidth).toBeGreaterThanOrEqual(148);
    expect(geometry.visualRatio).toBeCloseTo(0.8, 1);
    expect(geometry.systemTitleFits).toBe(true);
    expect(geometry.overflow).toBeLessThanOrEqual(0.5);
  }

  const firstLink = page.getByRole('link', { name: 'Violet Evergarden', exact: true });
  await firstLink.focus();
  await expect(firstLink).toBeFocused();
  expect(await firstLink.evaluate((link) => parseFloat(getComputedStyle(link).outlineWidth))).toBeGreaterThanOrEqual(2.5);
  await expect(page.locator('.memory-archive a[href$="memory/new/"]')).toHaveCount(1);
});

test('Archive card text remains readable in the light theme', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ui:theme:v1', JSON.stringify('light'));
  });
  await seedSystemDesignArchive(page, 1);

  const colors = await page.locator('.memory-preview__body').evaluate((body) => {
    const primaryProbe = document.createElement('span');
    const secondaryProbe = document.createElement('span');
    primaryProbe.style.color = 'var(--text-primary)';
    secondaryProbe.style.color = 'var(--text-secondary)';
    body.append(primaryProbe, secondaryProbe);
    const result = {
      title: getComputedStyle(body.querySelector('.memory-preview__title') as Element).color,
      cue: getComputedStyle(body.querySelector('.memory-preview__cue') as Element).color,
      meta: getComputedStyle(body.querySelector('.memory-preview__meta') as Element).color,
      primary: getComputedStyle(primaryProbe).color,
      secondary: getComputedStyle(secondaryProbe).color,
    };
    primaryProbe.remove();
    secondaryProbe.remove();
    return result;
  });

  expect(colors.title).toBe(colors.primary);
  expect(colors.cue).toBe(colors.secondary);
  expect(colors.meta).toBe(colors.secondary);
});

test('Home archive loading and error states never render an empty-archive claim', async ({ page }) => {
  await page.goto('/');
  await prepareReactClient(page);
  await page.evaluate(async () => {
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const { default: HomeMemoryOverview } = await import('/src/components/home/HomeMemoryOverview.jsx');
    const copy = {
      eyebrow: 'Private · Local only',
      title: 'Memory Archive',
      loading: 'Loading your memory cards…',
      errorTitle: 'Memory Archive is unavailable',
      errorLead: 'Retry the private card storage.',
      emptyTitle: 'No memory cards yet',
      emptyLead: 'Start a private memory.',
      latest: 'Latest memory card',
      count: (count) => `${count} memories`,
      openArchive: 'Open Archive',
      createCard: 'Create memory card',
      createAnother: 'Create another memory',
      imageAlt: (title) => `${title} memory card`,
      imageMissing: 'Preview unavailable',
      systemLabel: 'System design preview',
      systemFooter: 'MOEMOA · Private memory',
    };
    const root = document.createElement('div');
    root.id = 'home-memory-state-fixture';
    document.body.replaceChildren(root);
    const clientRoot = createRoot(root);
    window.renderHomeMemoryState = (status) => clientRoot.render(React.createElement(HomeMemoryOverview, {
      base: '/',
      copy,
      memory: { status, count: 0, latest: null },
    }));
    window.renderHomeMemoryState('loading');
  });

  await expect(page.locator('.home-memory-state--loading')).toBeVisible();
  await expect(page.getByText('No memory cards yet', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.renderHomeMemoryState('error'));
  await expect(page.locator('.home-memory-state--error')).toBeVisible();
  await expect(page.locator('.home-memory-state--loading')).toHaveCount(0);
  await expect(page.getByText('No memory cards yet', { exact: true })).toHaveCount(0);
});

test('composer system design keeps its vertical composition inside the mobile frame', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: 'Use system design', exact: true }).click();

  const layout = await page.locator('.system-design-preview').evaluate((element) => {
    const root = element.getBoundingClientRect();
    const children = Array.from(element.children).map((child) => child.getBoundingClientRect());
    const style = getComputedStyle(element);
    return {
      display: style.display,
      direction: style.flexDirection,
      rootRight: root.right,
      viewportWidth: innerWidth,
      childrenInside: children.every((child) => (
        child.left >= root.left - 0.5
        && child.right <= root.right + 0.5
        && child.top >= root.top - 0.5
        && child.bottom <= root.bottom + 0.5
      )),
    };
  });

  expect(layout.display).toBe('flex');
  expect(layout.direction).toBe('column');
  expect(layout.rootRight).toBeLessThanOrEqual(layout.viewportWidth + 0.5);
  expect(layout.childrenInside).toBe(true);
});

test('composer keeps the visual beside the form only when desktop height can support it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: 'Use system design', exact: true }).click();

  const spacious = await page.evaluate(() => {
    const visual = document.querySelector('.memory-composer__visual-column');
    const fields = document.querySelector('.memory-composer__form-column');
    const visualRect = visual?.getBoundingClientRect();
    const fieldsRect = fields?.getBoundingClientRect();
    return {
      sideBySide: Boolean(visualRect && fieldsRect && visualRect.right < fieldsRect.left),
      position: visual ? getComputedStyle(visual).position : '',
    };
  });
  expect(spacious.sideBySide).toBe(true);
  expect(spacious.position).toBe('sticky');

  await page.setViewportSize({ width: 1024, height: 768 });
  const compact = await page.locator('.memory-composer__visual-column').evaluate((element) => ({
    position: getComputedStyle(element).position,
    right: element.getBoundingClientRect().right,
    viewportWidth: innerWidth,
  }));
  expect(compact.position).toBe('static');
  expect(compact.right).toBeLessThanOrEqual(compact.viewportWidth + 0.5);
});

test('approved and supplemental viewport widths retain one-axis reflow and the primary Home action', async ({ page }) => {
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark' });

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.home-empty-state')).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('main h1')).toHaveCount(1);
    const geometry = await page.evaluate(() => {
      const primary = document.querySelector('.home-empty-state__actions .btn');
      const rect = primary?.getBoundingClientRect();
      return {
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
        bodyOverflow: document.body.scrollWidth - innerWidth,
        primaryWidth: rect?.width || 0,
        primaryHeight: rect?.height || 0,
        primaryLeft: rect?.left || -1,
        primaryRight: rect?.right || innerWidth + 1,
      };
    });
    expect(geometry.documentOverflow, JSON.stringify(viewport)).toBeLessThanOrEqual(0.5);
    expect(geometry.bodyOverflow, JSON.stringify(viewport)).toBeLessThanOrEqual(0.5);
    expect(geometry.primaryLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.primaryRight).toBeLessThanOrEqual(viewport.width + 0.5);
    if (viewport.width <= 720) {
      expect(geometry.primaryWidth).toBeGreaterThanOrEqual(44);
      expect(geometry.primaryHeight).toBeGreaterThanOrEqual(44);
    }
  }
});

test('200% zoom retains one-axis reflow and an operable primary action', async ({ page }) => {
  // A 640px physical viewport at 200% browser zoom exposes a 320 CSS-pixel
  // layout viewport. Playwright models that reflow boundary directly.
  await page.setViewportSize({ width: 320, height: 720 });
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark' });
  await page.goto('/');
  await expect(page.locator('.home-empty-state')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const action = document.querySelector('.home-empty-state__actions .btn');
    const rect = action?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      actionLeft: rect?.left ?? -1,
      actionRight: rect?.right ?? innerWidth + 1,
      actionWidth: rect?.width ?? 0,
      actionHeight: rect?.height ?? 0,
    };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(0.5);
  expect(geometry.actionLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.actionRight).toBeLessThanOrEqual(320.5);
  expect(geometry.actionWidth).toBeGreaterThanOrEqual(44);
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.home-empty-state__actions .btn').first()).toBeEnabled();
});

test('dark and light Memory surfaces meet numerical WCAG text contrast', async ({ page }) => {
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark' });
  await page.goto('/memory/new/');
  await page.getByRole('button', { name: 'Use system design', exact: true }).click();

  for (const theme of ['dark', 'light']) {
    if (theme === 'light') await page.locator('.data-menu-theme-trigger:visible').click();
    const samples = await page.locator('.memory-composer').evaluate((root) => {
      const parse = (value: string) => (value.match(/[\d.]+/gu) || []).slice(0, 3).map(Number);
      const linear = (value: number) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (rgb: number[]) => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
      const resolveColor = (value: string) => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
      };
      const ratio = (foreground: string, background: string) => {
        const values = [luminance(parse(resolveColor(foreground))), luminance(parse(resolveColor(background)))].sort((a, b) => b - a);
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      const rootStyle = getComputedStyle(document.documentElement);
      return [
        { selector: '.pageTitle', backgroundToken: '--bg-app' },
        { selector: '.pageLead', backgroundToken: '--bg-app' },
        { selector: '.memory-composer__step-heading', backgroundToken: '--bg-surface' },
        { selector: '.memory-composer__save-gate .btn', backgroundToken: '--bg-surface-2' },
      ].map(({ selector, backgroundToken }) => {
          const element = root.querySelector(selector);
          if (!element) return { selector, ratio: 0 };
          const style = getComputedStyle(element);
          return { selector, ratio: ratio(style.color, rootStyle.getPropertyValue(backgroundToken)) };
        });
    });
    for (const sample of samples) expect(sample.ratio, `${theme} ${sample.selector}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('composer keeps heading, field, error, and KO/EN long-copy associations at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark', imageMode: 'save-error' });
  await page.goto('/memory/new/');
  await page.locator('#memory-title-input').fill('A deliberately long private anime memory title that must remain editable without clipping or page overflow');
  await page.locator('#memory-reflection-input').fill('A long English reflection '.repeat(18));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.locator('#memory-composer-error[role="alert"]')).toBeVisible();

  const assertSemantics = async () => {
    const result = await page.evaluate(() => {
      const headings = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')];
      const levels = headings.map((heading) => Number(heading.tagName.slice(1)));
      return {
        mainCount: document.querySelectorAll('main').length,
        h1Count: document.querySelectorAll('main h1').length,
        headingOrderValid: levels.every((level, index) => index === 0 || level <= levels[index - 1] + 1),
        titleLabels: (document.querySelector('#memory-title-input') as HTMLInputElement | null)?.labels?.length || 0,
        noteLabels: (document.querySelector('#memory-reflection-input') as HTMLTextAreaElement | null)?.labels?.length || 0,
        saveDescription: document.querySelector('button[type="submit"]')?.getAttribute('aria-describedby'),
        visualDescription: document.querySelector('.memory-composer__visual-column')?.getAttribute('aria-describedby'),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(result.mainCount).toBe(1);
    expect(result.h1Count).toBe(1);
    expect(result.headingOrderValid).toBe(true);
    expect(result.titleLabels).toBeGreaterThan(0);
    expect(result.noteLabels).toBeGreaterThan(0);
    expect(result.saveDescription).toBe('memory-save-reason');
    expect(result.visualDescription).toBe('memory-composer-error');
    expect(result.overflow).toBeLessThanOrEqual(0.5);
  };
  await assertSemantics();

  await page.locator('.top-nav__mobile-menu-trigger:visible').click();
  await page.locator('.top-nav-mobile-locale-row button').filter({ hasText: 'KO' }).click();
  await page.locator('#memory-title-input').fill('길이가 매우 긴 한국어 애니메이션 감상 기록 제목도 작은 화면에서 잘리지 않고 끝까지 편집할 수 있어야 합니다');
  await page.locator('#memory-reflection-input').fill('오래 기억하고 싶은 장면과 감정을 적어 두는 긴 한국어 감상문입니다. '.repeat(10));
  await assertSemantics();
});

test('composer announces saving and detail announces the saved state', async ({ page }) => {
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark', imageMode: 'slow-save' });
  await page.goto('/memory/new/');
  await page.locator('#memory-title-input').fill('Saving state memory');
  await page.locator('#memory-reflection-input').fill('The save state remains readable while local image promotion finishes.');
  await page.getByRole('checkbox').check();
  const save = page.locator('.memory-composer__save-gate button[type="submit"]');
  await save.click();
  await expect(page.locator('.memory-composer__live[role="status"]')).toHaveText('Saving card…');
  await expect(save).toBeDisabled();
  await expect.poll(() => page.evaluate(() => typeof window.__MOEMOA_TEST_RESOLVE_SAVE__)).toBe('function');
  await page.evaluate(() => window.__MOEMOA_TEST_RESOLVE_SAVE__?.());
  await expect(page).toHaveURL(/\/archive\//u);
  await page.getByRole('link', { name: 'Saving state memory', exact: true }).click();
  const detailNote = page.getByLabel('Short reflection');
  await expect(detailNote).toBeVisible();
  await detailNote.fill('Saved state confirmation remains explicit.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved on this device.')).toBeVisible();
});

test('featured card geometry remains stable after its fonts and image settle', async ({ page }) => {
  const imageUrl = 'https://fixture.moemoa.invalid/delayed-memory.svg';
  const fontUrl = 'https://fixture.moemoa.invalid/delayed-memory.ttf';
  const fontBytes = await readFile('src/assets/fonts/noto/NotoSans-Variable.ttf');
  let releaseImage: (() => Promise<void>) | null = null;
  let releaseFont: (() => Promise<void>) | null = null;
  await page.route(imageUrl, (route) => {
    releaseImage = () => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#7d6be8"/></svg>',
    });
  });
  await page.route(fontUrl, (route) => {
    releaseFont = () => route.fulfill({ contentType: 'font/ttf', body: fontBytes });
  });

  await renderMemoryDisplayFixtures(page, SYNTHETIC_IMAGE, {
    kind: 'IMAGE',
    src: imageUrl,
    alt: 'A delayed featured memory image',
  });
  await page.evaluate((delayedFontUrl) => {
    const face = new FontFace('MOEMOA Delayed Settle', `url(${delayedFontUrl})`);
    document.fonts.add(face);
    const measured = document.querySelector('.memory-preview--featured') as HTMLElement | null;
    if (measured) measured.style.fontFamily = '"MOEMOA Delayed Settle", sans-serif';
    void face.load();
  }, fontUrl);
  await expect.poll(() => Boolean(releaseImage && releaseFont)).toBe(true);

  const measuredCard = page.locator('.memory-preview--featured');
  const precondition = await measuredCard.evaluate((element) => {
    const image = element.querySelector('img');
    const delayedFace = [...document.fonts].find((face) => face.family.includes('MOEMOA Delayed Settle'));
    return {
      imageComplete: image?.complete ?? true,
      imageNaturalWidth: image?.naturalWidth || 0,
      fontStatus: delayedFace?.status || 'missing',
    };
  });
  expect(precondition).toEqual({ imageComplete: false, imageNaturalWidth: 0, fontStatus: 'loading' });

  const measure = () => measuredCard.evaluate((element) => {
    const visual = element.querySelector('.memory-visual')?.getBoundingClientRect();
    const root = element.getBoundingClientRect();
    return { width: root.width, height: root.height, visualWidth: visual?.width || 0, visualHeight: visual?.height || 0 };
  });
  const before = await measure();
  await Promise.all([releaseImage!(), releaseFont!()]);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => (
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true });
            image.addEventListener('error', () => resolve(), { once: true });
          })
    )));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const settled = await measuredCard.evaluate((element) => {
    const image = element.querySelector('img');
    const delayedFace = [...document.fonts].find((face) => face.family.includes('MOEMOA Delayed Settle'));
    return {
      imageComplete: image?.complete ?? false,
      imageNaturalWidth: image?.naturalWidth || 0,
      fontStatus: delayedFace?.status || 'missing',
    };
  });
  expect(settled.imageComplete).toBe(true);
  expect(settled.imageNaturalWidth).toBeGreaterThan(0);
  expect(settled.fontStatus).toBe('loaded');
  const after = await measure();
  for (const key of Object.keys(before) as Array<keyof typeof before>) {
    expect(
      Math.abs(before[key] - after[key]),
      `${key} ${JSON.stringify({ before, after })}`,
    ).toBeLessThanOrEqual(0.5);
  }
});

test('composer exposes provider-unavailable and failed-save states without losing the private-title path', async ({ page }) => {
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark', imageMode: 'save-error' });
  await page.addInitScript(() => {
    window.__MOEMOA_TEST_TITLE_RESOLVER__ = {
      search: async () => ({ results: [], remoteStatus: 'UNAVAILABLE' }),
    };
  });
  await page.goto('/memory/new/');
  await expect(page.locator('.memory-composer__preview')).toBeVisible();
  await page.locator('#memory-title-input').fill('My Offline Anime');
  await page.getByRole('button', { name: 'Search anime' }).click();
  await expect(page.locator('.memory-composer__title-status').filter({ hasText: /online search is unavailable/iu })).toBeVisible();
  await page.locator('#memory-reflection-input').fill('A local memory remains possible while the provider is unavailable.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save card' }).click();
  await expect(page.locator('.memory-composer__error[role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/memory\/new\//u);
});

test('missing image detail remains operable and explains recovery', async ({ page }) => {
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark', imageMode: 'missing' });
  await createMissingImageCard(page, { locale: 'en' });
  await expect(page.locator('.memory-visual--missing[role="status"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /recover image/iu })).toBeVisible();
  await expect(page.getByRole('button', { name: /delete card/iu })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0.5);
});

test('detail delete dialog traps focus, cancels safely, and confirms deletion', async ({ page }) => {
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark' });
  const [cardId] = await seedSystemDesignCards(page, [{
    title: 'Delete dialog memory',
    note: 'The cancel path must preserve this card.',
    paletteId: 'violet-night',
  }]);
  await openMemoryDetail(page, cardId);

  const trigger = page.getByRole('button', { name: 'Delete card' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Delete memory card' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Confirm card deletion' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole('button', { name: 'Confirm card deletion' }).click();
  await expect(page).toHaveURL(/\/archive\//u);
  await expect(page.getByRole('link', { name: 'Delete dialog memory', exact: true })).toHaveCount(0);
});

test('mobile search closes with Escape and restores focus to its invoker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installVisualFixtureState(page, { locale: 'en', theme: 'dark' });
  await page.goto('/');
  const trigger = page.locator('.quick-action__mobile-trigger:visible');
  await trigger.click();
  await expect(page.locator('.quick-action-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.quick-action-sheet')).toBeHidden();
  await expect(trigger).toBeFocused();
});
