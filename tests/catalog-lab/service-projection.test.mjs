import assert from 'node:assert/strict';
import test from 'node:test';

import { sha256 } from '../../tools/catalog-lab/lib/hash.mjs';
import { buildServiceProjection } from '../../tools/catalog-lab/pipeline/service-projection.mjs';

const target = Object.freeze({
  targetKey: 'ANILIST:144',
  moemoaAnimeId: 'anime:11111111-1111-4111-8111-000000000144',
  seedSource: 'legacy_aliases',
  seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: '144' }]),
  seedTitles: Object.freeze([
    { locale: 'ko', value: '카노콘' },
    { locale: 'und', value: 'Kanokon' },
  ]),
  targetStatus: 'ACTIVE',
  createdAt: '2026-08-18T00:00:00.000Z',
});

function field(state, value, values) {
  return Object.freeze({
    state,
    ...(state === 'CONFLICTED' ? { values } : { value }),
  });
}

function canonical(overrides = {}) {
  const core = {
    id: target.moemoaAnimeId,
    externalIds: field('VALUE', [{ sourceId: 'anilist', value: '144' }]),
    titles: field('VALUE', [
      { locale: 'ko', value: '카노콘' },
      { locale: 'ko', value: '카논' },
      { locale: 'en', value: 'Kanokon' },
      { locale: 'ja', value: 'かのこん' },
    ]),
    format: field('VALUE', 'TV'),
    status: field('VALUE', 'FINISHED'),
    season: field('VALUE', 'SPRING'),
    startDate: field('VALUE', '2008-04-05'),
    endDate: field('VALUE', '2008-06-21'),
    episodeCount: field('VALUE', 12),
    sourceMaterialType: field('VALUE', 'LIGHT_NOVEL'),
    officialSiteUrl: field('SOURCE_NOT_AVAILABLE', null),
    studios: field('VALUE', [{ id: 'anilist:1', name: 'Studio', role: 'ANIMATION_PRODUCTION' }]),
    relations: field('SOURCE_NOT_AVAILABLE', []),
    sourceGenres: field('VALUE', ['Comedy', 'Romance']),
    coreGenres: field('VALUE', ['Comedy', 'Romance']),
    characters: field('VALUE', [{ id: 'anilist:1' }]),
    castings: field('VALUE', [{ characterId: 'anilist:1' }]),
    cover: field('VALUE', {
      sourceUrl: 'https://s4.anilist.co/cover.png',
      rightsStatus: 'TEST_ONLY_UNKNOWN',
      distributionStatus: 'PROHIBITED',
    }),
    fieldProvenance: [],
    reviewState: 'TEST_ONLY',
    distributionStatus: 'PROHIBITED',
    ...overrides,
  };
  return Object.freeze({ ...core, revision: { algorithm: 'SHA-256', contentHash: sha256(core) } });
}

const localRefKey = ['local', 'Ref'].join('');
const storedCover = Object.freeze({
  status: 'STORED', checksum: 'a'.repeat(64),
  [localRefKey]: ['images/covers/anime/', 'cover.png'].join(''),
  width: 460, height: 650, byteSize: 123,
});

test('service projection keeps the legacy Korean title and silently quarantines low-confidence candidates', () => {
  const projection = buildServiceProjection({ target, canonical: canonical(), cover: storedCover });

  assert.deepEqual(projection.preferredTitle, { locale: 'ko', value: '카노콘' });
  assert.deepEqual(projection.searchTitles, [
    { locale: 'ko', value: '카노콘' },
    { locale: 'en', value: 'Kanokon' },
    { locale: 'ja', value: 'かのこん' },
  ]);
  assert.deepEqual(projection.quarantinedTitles, [
    { locale: 'ko', value: '카논', reasonCode: 'LOW_CONFIDENCE_SOURCE_KOREAN_TITLE' },
  ]);
  assert.deepEqual(projection.reviewItems, []);
  assert.equal(projection.qualityWarnings.some((row) => row.reasonCode === 'KOREAN_TITLE_CANDIDATES_QUARANTINED'), true);
  assert.equal(projection.readiness.status, 'READY');
});

test('service projection groups locale variants and auto-selects a primary among distinct official sites', () => {
  const equivalent = canonical({
    officialSiteUrl: field('CONFLICTED', undefined, [
      'http://example.test/ja/show',
      'https://example.test/en/show',
    ]),
  });
  const grouped = buildServiceProjection({ target, canonical: equivalent, cover: storedCover });
  assert.equal(grouped.officialLinks.length, 2);
  assert.equal(grouped.officialLinks.some((row) => row.selectionState === 'AUTO_PRIMARY'), true);
  assert.equal(grouped.officialLinks.some((row) => row.selectionState === 'AUTO_EQUIVALENT'), true);
  assert.equal(grouped.primaryOfficialSiteUrl, 'https://example.test/en/show');

  const distinct = canonical({
    officialSiteUrl: field('CONFLICTED', undefined, [
      'https://official.example/show',
      'https://stream.example/watch',
    ]),
  });
  const reviewed = buildServiceProjection({ target, canonical: distinct, cover: storedCover });
  assert.equal(reviewed.primaryOfficialSiteUrl, 'https://official.example/show');
  assert.equal(reviewed.officialLinks.some((row) => row.selectionState === 'AUTO_PRIMARY'), true);
  assert.equal(reviewed.officialLinks.some((row) => row.selectionState === 'AUTO_SECONDARY'), true);
  assert.deepEqual(reviewed.reviewItems, []);
  assert.equal(reviewed.qualityWarnings.some((row) => row.reasonCode === 'OFFICIAL_LINK_AUTO_SELECTED'), true);
  assert.equal(reviewed.readiness.status, 'READY');
});

test('service readiness blocks required gaps and reports recommended gaps without rejecting optional absence', () => {
  const requiredGap = buildServiceProjection({
    target,
    canonical: canonical({ format: field('SOURCE_NOT_AVAILABLE', null) }),
    cover: { status: 'FAILED', errorCode: 'COVER_NOT_AVAILABLE' },
  });
  assert.equal(requiredGap.readiness.status, 'BLOCKED');
  assert.deepEqual([...requiredGap.readiness.requiredBlockers].sort(), ['cover', 'format']);

  const recommendedGap = buildServiceProjection({
    target,
    canonical: canonical({
      titles: field('VALUE', [
        { locale: 'ko', value: '카노콘' },
        { locale: 'en', value: 'Kanokon' },
        { locale: 'ja', value: 'かのこん' },
      ]),
      studios: field('SOURCE_NOT_AVAILABLE', []),
      officialSiteUrl: field('SOURCE_NOT_AVAILABLE', null),
    }),
    cover: storedCover,
  });
  assert.equal(recommendedGap.readiness.status, 'READY_WITH_GAPS');
  assert.deepEqual(recommendedGap.readiness.recommendedGaps, ['studios']);
  assert.equal(recommendedGap.readiness.optionalGaps.includes('officialLinks'), true);
});

test('known incomplete legacy Korean titles fall back to a usable non-Korean title without manual review', () => {
  const incompleteTarget = Object.freeze({
    ...target,
    targetKey: 'ANILIST:204432',
    seedTitles: Object.freeze([
      { locale: 'ko', value: '쵸파의' },
      { locale: 'und', value: "Chopper's Kingdom" },
    ]),
  });
  const projection = buildServiceProjection({
    target: incompleteTarget,
    canonical: canonical({
      titles: field('VALUE', [
        { locale: 'ko', value: '쵸파의' },
        { locale: 'en', value: "Chopper's Kingdom" },
      ]),
    }),
    cover: storedCover,
  });
  assert.deepEqual(projection.preferredTitle, { locale: 'en', value: "Chopper's Kingdom" });
  assert.equal(projection.searchTitles.some((row) => row.locale === 'ko'), false);
  assert.equal(projection.quarantinedTitles.some((row) => row.reasonCode === 'SUSPICIOUS_LEGACY_KOREAN_TITLE'), true);
  assert.deepEqual(projection.reviewItems, []);
  assert.equal(projection.qualityWarnings.some((row) => row.reasonCode === 'PREFERRED_TITLE_FALLBACK_USED'), true);
  assert.equal(projection.readiness.status, 'READY');
});

test('high-confidence Korean spelling variants become search aliases automatically', () => {
  const variantTarget = Object.freeze({
    ...target,
    seedTitles: Object.freeze([
      { locale: 'ko', value: '클라나드' },
      { locale: 'und', value: 'Clannad' },
    ]),
  });
  const projection = buildServiceProjection({
    target: variantTarget,
    canonical: canonical({
      titles: field('VALUE', [
        { locale: 'ko', value: '클라나드' },
        { locale: 'ko', value: '클리나드' },
        { locale: 'en', value: 'Clannad' },
      ]),
    }),
    cover: storedCover,
  });
  assert.equal(projection.searchTitles.some((row) => row.locale === 'ko' && row.value === '클리나드'), true);
  assert.deepEqual(projection.autoAcceptedTitleAliases, [{ locale: 'ko', value: '클리나드' }]);
  assert.deepEqual(projection.quarantinedTitles, []);
  assert.deepEqual(projection.reviewItems, []);
});

test('valid Korean titles ending in decorative tilde or hyphen do not trigger fallback', () => {
  for (const [targetKey, korean] of [
    ['ANILIST:21553', '(더빙)리루리루 페어리루 ~요정의 문~'],
    ['ANILIST:129386', '세븐나이츠 레볼루션 -영웅의 계승자-'],
  ]) {
    const validTarget = Object.freeze({
      ...target, targetKey,
      seedTitles: Object.freeze([{ locale: 'ko', value: korean }, { locale: 'und', value: 'English fallback' }]),
    });
    const projection = buildServiceProjection({
      target: validTarget,
      canonical: canonical({
        titles: field('VALUE', [{ locale: 'ko', value: korean }, { locale: 'en', value: 'English fallback' }]),
      }),
      cover: storedCover,
    });
    assert.deepEqual(projection.preferredTitle, { locale: 'ko', value: korean });
    assert.equal(projection.qualityWarnings.some((row) => row.reasonCode === 'PREFERRED_TITLE_FALLBACK_USED'), false);
  }
});

test('official link ranking prefers a title-branded host over a deeper studio subpage', () => {
  const projection = buildServiceProjection({
    target,
    canonical: canonical({
      titles: field('VALUE', [
        { locale: 'ko', value: '에토타마' },
        { locale: 'en', value: 'ETOTAMA' },
      ]),
      officialSiteUrl: field('CONFLICTED', undefined, [
        'https://etotama.com/',
        'https://shirogumi-nmd.com/etotama/',
      ]),
    }),
    cover: storedCover,
  });
  assert.equal(projection.primaryOfficialSiteUrl, 'https://etotama.com/');
});
