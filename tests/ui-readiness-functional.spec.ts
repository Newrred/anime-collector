import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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

async function renderMemoryDisplayFixtures(page: import('@playwright/test').Page) {
  await page.goto('/');
  await prepareReactClient(page);
  const render = () => page.evaluate(async ({ imageSrc, longTitle, systemSpec }) => {
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
        visual: { kind: 'SYSTEM_DESIGN', designSpec: systemSpec },
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
  }, { imageSrc: SYNTHETIC_IMAGE, longTitle: LONG_MEMORY_TITLE, systemSpec: SYSTEM_SPEC });

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
  await expect(page.locator('.memory-preview__title')).toHaveText([
    'Violet Evergarden',
    'Memory 3',
    'Memory 2',
    'Memory 1',
  ]);
  await expect(page.getByRole('link', { name: 'Violet Evergarden', exact: true })).toHaveAttribute('href', /memory\/card\/\?id=/u);

  for (const specimen of [
    { width: 320, height: 720, columns: 1 },
    { width: 360, height: 760, columns: 2 },
    { width: 768, height: 900, columns: 3 },
    { width: 1200, height: 900, columns: 4 },
  ]) {
    await page.setViewportSize(specimen);
    const geometry = await page.locator('.memory-archive__grid').evaluate((grid) => {
      const cards = [...grid.querySelectorAll('.memory-archive__card')];
      const firstCard = cards[0]?.getBoundingClientRect();
      const firstVisual = cards[0]?.querySelector('.memory-visual')?.getBoundingClientRect();
      const systemTitle = cards[0]?.querySelector('.system-design-preview strong');
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        cardWidth: firstCard?.width || 0,
        visualRatio: firstVisual ? firstVisual.width / firstVisual.height : 0,
        systemTitleFits: systemTitle ? systemTitle.scrollWidth <= systemTitle.clientWidth + 0.5 : false,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.columns).toBe(specimen.columns);
    expect(geometry.cardWidth).toBeGreaterThanOrEqual(148);
    expect(geometry.visualRatio).toBeCloseTo(0.8, 1);
    expect(geometry.systemTitleFits).toBe(true);
    expect(geometry.overflow).toBeLessThanOrEqual(0.5);
  }

  const firstLink = page.getByRole('link', { name: 'Violet Evergarden', exact: true });
  await firstLink.focus();
  await expect(firstLink).toBeFocused();
  expect(await firstLink.evaluate((link) => parseFloat(getComputedStyle(link).outlineWidth))).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.memory-archive a[href$="memory/new/"]')).toHaveCount(1);
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
