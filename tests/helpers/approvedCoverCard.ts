import { expect, type Page } from '@playwright/test';
import { jpegBytes } from '../catalog-lab/fixtures/cover-valid-images.mjs';

const coverPreviewUrl = `data:image/jpeg;base64,${Buffer.from(jpegBytes).toString('base64')}`;

function animeIdFor(title: string) {
  const suffix = Buffer.from(title).reduce((hash, byte) => ((hash * 31 + byte) >>> 0), 7).toString(16).padStart(12, '0');
  return `anime:11111111-1111-4111-8111-${suffix}`;
}

export async function installApprovedCoverResolver(page: Page, title: string) {
  const animeId = animeIdFor(title);
  const identityHash = animeId.slice(-12);
  const catalogCoverRef = {
    sourceKind: 'CATALOG_COVER',
    catalogAnimeId: animeId,
    catalogCoverId: `cover:${animeId.slice('anime:'.length)}`,
    catalogCoverRevisionId: `asset:${identityHash.padStart(40, 'b')}`,
    rightsBasis: 'EXPLICIT_PERMISSION',
    permissionVerifiedAt: '2026-09-03T00:00:00.000Z',
  };
  await page.addInitScript(({ displayTitle, id, ref, preview }) => {
    window.__MOEMOA_TEST_TITLE_RESOLVER__ = {
      search: async () => ({
        remoteStatus: 'READY',
        results: [{
          kind: 'ANIME_REF', animeId: id, displayTitle, aliases: [], genres: [],
          sourceBinding: { provider: 'ANILIST', externalId: String(Number.parseInt(id.slice(-12), 16)) },
          verificationState: 'PROVIDER_CANDIDATE',
          catalogSource: 'SUPABASE_SERVICE_PROJECTION_V2', readiness: 'READY',
          coverPreviewUrl: preview, catalogCoverRef: ref,
        }],
      }),
      resolveCover: async (candidateRef) => candidateRef?.catalogCoverRevisionId === ref.catalogCoverRevisionId
        ? { publicUrl: preview, width: 460, height: 640, catalogCoverRef: ref }
        : null,
    };
  }, { displayTitle: title, id: animeId, ref: catalogCoverRef, preview: coverPreviewUrl });
  return { animeId, catalogCoverRef, coverPreviewUrl };
}

export async function selectApprovedCover(page: Page, title: string, locale: 'en' | 'ko' = 'en') {
  const ko = locale === 'ko';
  const titleInput = page.getByLabel(ko ? '작품명' : 'Anime or card title');
  await titleInput.fill(title);
  await titleInput.press('Enter');
  await page.getByRole('button', { name: ko ? `${title} 선택` : `Select ${title}` }).click();
  await page.getByRole('button', { name: ko ? '작품 표지 사용' : 'Use official cover' }).click();
  await expect(page.locator('.memory-composer__cover-badge')).toBeVisible();
}

export async function createApprovedCoverCard(page: Page, title: string, note: string, locale: 'en' | 'ko' = 'en') {
  await installApprovedCoverResolver(page, title);
  await page.goto('/memory/new/');
  await selectApprovedCover(page, title, locale);
  await page.getByLabel(locale === 'ko' ? '짧은 감상' : 'Short reflection').fill(note);
  await page.getByRole('button', { name: locale === 'ko' ? '카드 저장' : 'Save card', exact: true }).click();
  await expect(page).toHaveURL(/\/archive\/(?:index\.html)?$/u);
}
