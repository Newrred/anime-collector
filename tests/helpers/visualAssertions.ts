import { expect, type Page } from '@playwright/test';

export async function settleVisualState(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((image) => !image.complete)
        .map((image) => new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        })),
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

export async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0.5);
}

export async function expectGoldenScreenshot(page: Page, name: string) {
  await settleVisualState(page);
  await assertNoHorizontalOverflow(page);
  await expect(page).toHaveScreenshot(name, {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.001,
  });
}

export async function assertPrimaryTargets(page: Page) {
  const mobile = await page.evaluate(() => window.innerWidth <= 720);
  if (!mobile) return;
  const primarySelector = [
    'a.btn:not(.btn--subtle):not(.btn--ghost):not(.btn--icon):not(.btn--sm):visible',
    'button.btn:not(.btn--subtle):not(.btn--ghost):not(.btn--icon):not(.btn--sm):visible',
  ].join(', ');
  const undersized = await page.locator(primarySelector).evaluateAll((controls) => (
    controls
      .map((control) => {
        const rect = control.getBoundingClientRect();
        return { text: control.textContent?.trim() || '', width: rect.width, height: rect.height };
      })
      .filter((control) => control.width < 44 || control.height < 44)
  ));
  expect(undersized).toEqual([]);
}
