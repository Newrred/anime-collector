import { expect, test } from '@playwright/test';

test('signed-out composer offers official cover but asks for sign-in before choosing a personal photo', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ui:locale:v1', JSON.stringify('en')));
  await page.goto('/memory/new/');
  await expect(page.getByRole('button', { name: 'Use system design' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Choose image' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in to add a photo' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save card' })).toBeDisabled();
});

test('a signed-out prepared photo cannot be saved as a local-only card', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ui:locale:v1', JSON.stringify('en'));
    (window as any).__MOEMOA_TEST_IMAGE_INTAKE__ = {
      available: true,
      claim: async () => ({ ticket: { ticketId: 'guest-photo', previewDataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 1, height: 1, byteSize: 20 }, processing: false }),
      pick: async () => ({ cancelled: true }),
      discard: async () => true,
    };
  });
  await page.goto('/memory/new/');
  await page.getByLabel('Anime or card title').fill('Guest photo');
  await page.getByLabel(/I confirm that I have the right/).check();
  await expect(page.getByRole('button', { name: 'Save card' })).toBeDisabled();
  await expect(page.getByText('Sign in, then choose your photo again.').first()).toBeVisible();
});
