import { expect, type Page } from '@playwright/test';
import { jpegBytes } from '../catalog-lab/fixtures/cover-valid-images.mjs';

export type VisualLocale = 'en' | 'ko';
export type VisualTheme = 'dark' | 'light';
export type VisualImageMode = 'missing' | 'save-error' | 'slow-save';

export const FIXED_VISUAL_TIME = '2026-08-24T05:00:00.000Z';
export const CATALOG_ANIME_ID = 'anime:11111111-1111-4111-8111-000000000001';

const SYNTHETIC_JPEG = `data:image/jpeg;base64,${Buffer.from(jpegBytes).toString('base64')}`;
const SYNTHETIC_CATALOG_COVER = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#17132f"/>
        <stop offset="0.52" stop-color="#5846a8"/>
        <stop offset="1" stop-color="#e98891"/>
      </linearGradient>
    </defs>
    <rect width="600" height="900" fill="url(#sky)"/>
    <circle cx="454" cy="204" r="128" fill="#ffdba8" opacity=".92"/>
    <path d="M0 632 176 428l98 112 106-128 220 260v228H0z" fill="#110f27" opacity=".9"/>
    <path d="M0 694 146 558l96 92 96-78 262 174v154H0z" fill="#29234d"/>
    <text x="48" y="92" fill="#fff7ee" font-family="Arial,sans-serif" font-size="34" font-weight="700" letter-spacing="8">MOEMOA</text>
    <text x="48" y="810" fill="#fff7ee" font-family="Arial,sans-serif" font-size="54" font-weight="800">MEMORY</text>
    <text x="50" y="852" fill="#eadff8" font-family="Arial,sans-serif" font-size="22" letter-spacing="5">SYNTHETIC COVER</text>
  </svg>
`)}`;

const catalogMedia = Object.freeze({
  id: 1,
  title: { english: 'Cowboy Bebop', romaji: 'Cowboy Bebop', native: 'カウボーイビバップ' },
  synonyms: [],
  genres: ['Action', 'Sci-Fi'],
  coverImage: {
    medium: SYNTHETIC_CATALOG_COVER,
    large: SYNTHETIC_CATALOG_COVER,
    extraLarge: SYNTHETIC_CATALOG_COVER,
  },
  seasonYear: 1998,
  format: 'TV',
});

const catalogRow = Object.freeze({
  kind: 'remote',
  id: 1,
  catalogAnimeId: CATALOG_ANIME_ID,
  ko: '카우보이 비밥',
  media: catalogMedia,
  src: 'moemoa-catalog',
  title: '카우보이 비밥',
  subtitle: 'Cowboy Bebop · 1998 · TV',
  poster: SYNTHETIC_CATALOG_COVER,
});

const catalogChoice = Object.freeze({
  kind: 'ANIME_REF',
  animeId: CATALOG_ANIME_ID,
  displayTitle: '카우보이 비밥',
  aliases: ['Cowboy Bebop', 'カウボーイビバップ'],
  genres: ['Action', 'Sci-Fi'],
  sourceBinding: { provider: 'ANILIST', externalId: '1' },
  verificationState: 'PROVIDER_CANDIDATE',
  catalogSource: 'SUPABASE_SERVICE_PROJECTION_V2',
  readiness: 'READY',
});

export async function installVisualFixtureState(
  page: Page,
  {
    locale,
    theme,
    imageMode = null,
  }: { locale: VisualLocale; theme: VisualTheme; imageMode?: VisualImageMode | null },
) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.route('https://**/*', (route) => route.abort('blockedbyclient'));
  await page.addInitScript(
    ({ fixedTime, localeValue, themeValue, row, choice, previewDataUrl, previewByteSize, intakeMode }) => {
      const fixedEpoch = new Date(fixedTime).getTime();
      const NativeDate = Date;
      class FixedDate extends NativeDate {
        constructor(...args: any[]) {
          if (args.length === 0) super(fixedEpoch);
          else if (args.length === 1) super(args[0]);
          else if (args.length === 2) super(args[0], args[1]);
          else if (args.length === 3) super(args[0], args[1], args[2]);
          else if (args.length === 4) super(args[0], args[1], args[2], args[3]);
          else if (args.length === 5) super(args[0], args[1], args[2], args[3], args[4]);
          else if (args.length === 6) super(args[0], args[1], args[2], args[3], args[4], args[5]);
          else super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        }

        static now() {
          return fixedEpoch;
        }
      }
      Object.setPrototypeOf(FixedDate, NativeDate);
      globalThis.Date = FixedDate as DateConstructor;

      let uuidSequence = 0;
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        configurable: true,
        value: () => {
          uuidSequence += 1;
          return `00000000-0000-4000-8000-${String(uuidSequence).padStart(12, '0')}`;
        },
      });

      localStorage.clear();
      localStorage.setItem('ui:locale:v1', JSON.stringify(localeValue));
      localStorage.setItem('ui:theme:v1', JSON.stringify(themeValue));
      localStorage.setItem('anime:list:v1', '[]');
      localStorage.setItem('anime:watchLogs:v1', '[]');
      localStorage.setItem('anime:mediaCache:v1', JSON.stringify({
        [row.id]: { ts: fixedEpoch, media: row.media },
      }));

      const testWindow = window as typeof window & {
        __MOEMOA_TEST_GLOBAL_SEARCH__?: { search: () => Promise<unknown[]> };
        __MOEMOA_TEST_CATALOG_TITLE_CHOICE__?: unknown;
        __MOEMOA_TEST_IMAGE_INTAKE__?: unknown;
        __MOEMOA_TEST_RESOLVE_SAVE__?: () => void;
      };
      testWindow.__MOEMOA_TEST_GLOBAL_SEARCH__ = {
        search: async () => [structuredClone(row)],
      };
      testWindow.__MOEMOA_TEST_CATALOG_TITLE_CHOICE__ = structuredClone(choice);

      if (intakeMode) {
        const ticket = {
          ticketId: 'visual-fixture-ticket',
          mimeType: 'image/jpeg',
          byteSize: previewByteSize,
          width: 1,
          height: 1,
          createdAtEpochMs: fixedEpoch,
          previewDataUrl,
          localOnly: true,
        };
        testWindow.__MOEMOA_TEST_IMAGE_INTAKE__ = {
          available: true,
          claim: async () => ({ ticket: structuredClone(ticket), processing: false, errorCode: null }),
          pick: async () => ({ ticket: structuredClone(ticket), cancelled: false }),
          discard: async () => true,
          promoteTicket: async ({ assetId }: { assetId: string }) => {
            if (intakeMode === 'save-error') {
              throw Object.assign(new Error('Synthetic visual fixture failure'), { code: 'IMAGE_WRITE_FAILED' });
            }
            if (intakeMode === 'slow-save') {
              await new Promise<void>((resolve) => {
                testWindow.__MOEMOA_TEST_RESOLVE_SAVE__ = resolve;
              });
            }
            return {
              localRef: `asset:${assetId}`,
              checksumSha256: 'a'.repeat(64),
              mimeType: 'image/jpeg',
              byteSize: previewByteSize,
              width: 1,
              height: 1,
            };
          },
          getPreview: async () => null,
          deleteAsset: async () => true,
        };
      }
    },
    {
      fixedTime: FIXED_VISUAL_TIME,
      localeValue: locale,
      themeValue: theme,
      row: catalogRow,
      choice: catalogChoice,
      previewDataUrl: SYNTHETIC_JPEG,
      previewByteSize: jpegBytes.byteLength,
      intakeMode: imageMode,
    },
  );
}

export async function seedSystemDesignCards(
  page: Page,
  cards: Array<{
    title: string;
    note: string;
    animeRef?: boolean;
    paletteId?: string;
  }>,
) {
  await page.goto('/');
  const cardIds = await page.evaluate(async ({ rows, animeId }) => {
    const { getPlatformMemoryRuntime } = await import('/src/features/memory/runtime/platformMemoryRuntime.js');
    const runtime = await getPlatformMemoryRuntime();
    const ids: string[] = [];
    for (const [index, row] of rows.entries()) {
      const result = await runtime.createCard({
        titleChoice: row.animeRef
          ? {
              kind: 'ANIME_REF',
              displayTitle: row.title,
              aliases: ['Cowboy Bebop', '카우보이 비밥'],
              genres: ['Action', 'Sci-Fi'],
              sourceBinding: { provider: 'ANILIST', externalId: '1' },
              verificationState: 'PROVIDER_CANDIDATE',
              animeId,
            }
          : { kind: 'PRIVATE_TITLE', displayTitle: row.title },
        systemDesignSpec: {
          version: 1,
          templateId: 'memory-gradient',
          paletteId: row.paletteId || 'violet-night',
          patternSeed: `golden-memory-${index + 1}`,
          titleLayout: 'BOTTOM_LEFT',
          genreTokens: row.animeRef ? ['Action', 'Sci-Fi'] : ['Memory'],
        },
        note: row.note,
        rightsConfirmed: false,
      });
      ids.push(result.cardId);
    }
    return ids;
  }, { rows: cards, animeId: CATALOG_ANIME_ID });
  return cardIds;
}

export async function createMissingImageCard(page: Page, { locale }: { locale: VisualLocale }) {
  await page.goto('/memory/new/');
  await page.locator('#memory-title-input').fill(locale === 'ko' ? '바이올렛 에버가든' : 'Violet Evergarden');
  await page.locator('#memory-reflection-input').fill(
    locale === 'ko' ? '이미지를 다시 연결할 수 있도록 남겨 둔 기억.' : 'A memory waiting for its image to be reconnected.',
  );
  await page.locator('.memory-composer__rights input[type="checkbox"]').check();
  await page.locator('.memory-composer__save-gate button[type="submit"]').click();
  await expect(page).toHaveURL(/\/archive\//u);
  const href = await page.locator('.memory-archive__card a[href*="/memory/card/"]').first().getAttribute('href');
  if (!href) throw new Error('Missing image fixture did not create a detail route');
  await page.goto(href);
  await expect(page.locator('.memory-detail__visual')).toBeVisible();
}

export async function openMemoryDetail(page: Page, cardId: string) {
  await page.goto(`/memory/card/?id=${encodeURIComponent(cardId)}`);
  await expect(page.locator('.memory-detail__card')).toBeVisible();
}

export async function openCatalogSearch(page: Page, { mobile }: { mobile: boolean }) {
  if (mobile) await page.locator('.quick-action__mobile-trigger:visible').click();
  const input = page.locator('.quick-action__input:visible');
  await input.fill('Cowboy Bebop');
  await expect(page.locator('.quick-action-row')).toBeVisible();
}
