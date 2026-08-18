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

const storedCover = Object.freeze({
  status: 'STORED', checksum: 'a'.repeat(64),
  localRef: 'images/covers/anime/cover.png', width: 460, height: 650, byteSize: 123,
});

test('service projection keeps the legacy Korean title and quarantines source Korean candidates', () => {
  const projection = buildServiceProjection({ target, canonical: canonical(), cover: storedCover });

  assert.deepEqual(projection.preferredTitle, { locale: 'ko', value: '카노콘' });
  assert.deepEqual(projection.searchTitles, [
    { locale: 'ko', value: '카노콘' },
    { locale: 'en', value: 'Kanokon' },
    { locale: 'ja', value: 'かのこん' },
  ]);
  assert.deepEqual(projection.quarantinedTitles, [
    { locale: 'ko', value: '카논', reasonCode: 'SOURCE_KOREAN_TITLE_REVIEW_REQUIRED' },
  ]);
  assert.equal(projection.reviewItems.some((row) => row.reasonCode === 'KOREAN_TITLE_CANDIDATES_QUARANTINED'), true);
  assert.equal(projection.readiness.status, 'READY_WITH_REVIEW');
});

test('service projection groups locale and scheme variants but reviews distinct official sites', () => {
  const equivalent = canonical({
    officialSiteUrl: field('CONFLICTED', undefined, [
      'http://example.test/ja/show',
      'https://example.test/en/show',
    ]),
  });
  const grouped = buildServiceProjection({ target, canonical: equivalent, cover: storedCover });
  assert.equal(grouped.officialLinks.length, 2);
  assert.equal(grouped.officialLinks.every((row) => row.reviewState === 'AUTO_EQUIVALENT'), true);
  assert.equal(grouped.primaryOfficialSiteUrl, 'https://example.test/en/show');

  const distinct = canonical({
    officialSiteUrl: field('CONFLICTED', undefined, [
      'https://official.example/show',
      'https://stream.example/watch',
    ]),
  });
  const reviewed = buildServiceProjection({ target, canonical: distinct, cover: storedCover });
  assert.equal(reviewed.primaryOfficialSiteUrl, null);
  assert.equal(reviewed.officialLinks.every((row) => row.reviewState === 'PENDING_REVIEW'), true);
  assert.equal(reviewed.reviewItems.some((row) => row.reasonCode === 'OFFICIAL_LINK_SELECTION_REQUIRED'), true);
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

test('known incomplete legacy Korean titles stay preferred but enter the manual review queue', () => {
  const incompleteTarget = Object.freeze({
    ...target,
    targetKey: 'ANILIST:204432',
    seedTitles: Object.freeze([
      { locale: 'ko', value: '원피스 캐릭터 로그: 쵸파의' },
      { locale: 'und', value: "Chopper's Kingdom" },
    ]),
  });
  const projection = buildServiceProjection({
    target: incompleteTarget,
    canonical: canonical({
      titles: field('VALUE', [
        { locale: 'ko', value: '원피스 캐릭터 로그: 쵸파의' },
        { locale: 'en', value: "Chopper's Kingdom" },
      ]),
    }),
    cover: storedCover,
  });
  assert.equal(projection.preferredTitle.value, '원피스 캐릭터 로그: 쵸파의');
  assert.equal(projection.reviewItems.some((row) => row.reasonCode === 'INCOMPLETE_LEGACY_KOREAN_TITLE'), true);
  assert.equal(projection.readiness.status, 'READY_WITH_REVIEW');
});
