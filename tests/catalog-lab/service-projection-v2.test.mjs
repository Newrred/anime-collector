import assert from 'node:assert/strict';
import test from 'node:test';

import { sha256 } from '../../tools/catalog-lab/lib/hash.mjs';
import {
  buildServiceProjectionV2,
  validateServiceProjectionV2Bundle,
} from '../../tools/catalog-lab/pipeline/service-projection-v2.mjs';
import { buildCatalogDbRows } from '../../tools/catalog-preview/export-v2.mjs';

const target = Object.freeze({
  targetKey: 'ANILIST:1',
  moemoaAnimeId: 'anime:11111111-1111-4111-8111-000000000001',
  seedSource: 'legacy_aliases',
  seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: '1' }]),
  seedTitles: Object.freeze([{ locale: 'ko', value: '카우보이 비밥' }]),
});

function field(state, value, values) {
  return { state, ...(state === 'CONFLICTED' ? { values } : { value }) };
}

function canonical() {
  const core = {
    id: target.moemoaAnimeId,
    externalIds: field('VALUE', [{ sourceId: 'anilist', value: '1' }]),
    titles: field('VALUE', [
      { locale: 'ko', value: '카우보이 비밥' },
      { locale: 'en', value: 'Cowboy Bebop' },
      { locale: 'ja', value: 'カウボーイビバップ' },
    ]),
    format: field('VALUE', 'TV'), status: field('VALUE', 'FINISHED'),
    season: field('VALUE', 'SPRING'), startDate: field('VALUE', '1998-04-03'),
    endDate: field('VALUE', '1999-04-24'), episodeCount: field('VALUE', 26),
    sourceMaterialType: field('VALUE', 'ORIGINAL'),
    officialSiteUrl: field('VALUE', 'https://example.test/cowboy-bebop'),
    studios: field('VALUE', [{ id: 'studio:1', name: 'Sunrise', role: 'ANIMATION_PRODUCTION' }]),
    sourceGenres: field('VALUE', ['Action', 'Drama', 'Sci-Fi']),
    coreGenres: field('VALUE', ['Action', 'Drama', 'Sci-Fi']),
    characters: field('VALUE', [
      { id: 'character:1', role: 'MAIN', canonicalName: 'Spike Spiegel', localizedNames: [] },
      { id: 'character:2', role: 'SUPPORTING', canonicalName: 'Jet Black', localizedNames: [] },
    ]),
    castings: field('VALUE', [
      { characterId: 'character:1', personId: 'person:1', language: 'JAPANESE', roleType: 'VOICE', creditedName: 'Koichi Yamadera' },
      { characterId: 'character:2', personId: 'person:2', language: 'JAPANESE', roleType: 'VOICE', creditedName: 'Unsho Ishizuka' },
    ]),
    relations: field('VALUE', [{ targetId: 'anilist:5', type: 'MOVIE', title: 'Cowboy Bebop: The Movie', format: 'MOVIE' }]),
    cover: field('VALUE', { rightsStatus: 'TEST_ONLY_UNKNOWN', distributionStatus: 'PROHIBITED' }),
    fieldProvenance: [], reviewState: 'TEST_ONLY', distributionStatus: 'PROHIBITED',
  };
  return { ...core, revision: { algorithm: 'SHA-256', contentHash: sha256(core) } };
}

function serviceV1(canonicalHash) {
  const core = {
    schemaVersion: 1,
    policyVersion: 'SERVICE_PROJECTION_V2_AUTOMATED_REVIEW',
    semanticAutomationPolicyVersion: 'test',
    targetKey: target.targetKey,
    animeId: target.moemoaAnimeId,
    canonicalHash,
    preferredTitle: { locale: 'ko', value: '카우보이 비밥' },
    searchTitles: [
      { locale: 'ko', value: '카우보이 비밥' },
      { locale: 'en', value: 'Cowboy Bebop' },
      { locale: 'ja', value: 'カウボーイビバップ' },
    ],
    autoAcceptedTitleAliases: [], quarantinedTitles: [],
    officialLinks: [{ url: 'https://example.test/cowboy-bebop', host: 'example.test', locale: 'und', role: 'PRIMARY_OFFICIAL', selectionState: 'AUTO_PRIMARY' }],
    primaryOfficialSiteUrl: 'https://example.test/cowboy-bebop',
    fieldTiers: { required: {}, recommended: {}, optional: {} },
    reviewItems: [], qualityWarnings: [],
    readiness: { status: 'READY', requiredBlockers: [], recommendedGaps: [], optionalGaps: [] },
  };
  return { ...core, projectionHash: sha256(core) };
}

const coverAsset = Object.freeze({
  sourceProvider: 'ANILIST', checksum: 'a'.repeat(64), byteSize: 1024,
  width: 460, height: 650, mimeType: 'image/jpeg', extension: 'jpg',
});

test('v2 separates bounded search, detail, people, and permission-bound cover asset records', () => {
  const record = canonical();
  const bundle = buildServiceProjectionV2({ target, canonical: record, serviceProjection: serviceV1(record.revision.contentHash), coverAsset, peoplePageSize: 1 });

  assert.equal(bundle.search.preferredTitle, '카우보이 비밥');
  assert.equal(bundle.search.releaseYear, 1998);
  assert.deepEqual(bundle.search.studios, ['Sunrise']);
  assert.deepEqual(bundle.search.genres, ['Action', 'Drama', 'Sci-Fi']);
  assert.equal(bundle.detail.people.characterCount, 2);
  assert.equal(bundle.people.length, 2);
  assert.equal(bundle.people[0].entries[0].castings[0].creditedName, 'Koichi Yamadera');
  assert.equal(bundle.asset.kind, 'COVER_IMAGE');
  assert.equal(bundle.asset.rightsBasis, 'USER_CONFIRMED_PREVIEW_PERMISSION');
  assert.equal(bundle.asset.objectPath, `covers/anime-11111111-1111-4111-8111-000000000001/${'a'.repeat(64)}.jpg`);
  assert.equal(validateServiceProjectionV2Bundle(bundle), true);
});

test('v2 output is deterministic and rejects canonical/v1 identity drift', () => {
  const record = canonical();
  const input = { target, canonical: record, serviceProjection: serviceV1(record.revision.contentHash), coverAsset };
  assert.deepEqual(buildServiceProjectionV2(input), buildServiceProjectionV2(input));
  assert.throws(() => buildServiceProjectionV2({ ...input, serviceProjection: { ...input.serviceProjection, animeId: 'anime:22222222-2222-4222-8222-222222222222' } }), /identity/i);
});

test('v2 exposes only service object identity and never local cover references or canonical provenance', () => {
  const record = canonical();
  const serialized = JSON.stringify(buildServiceProjectionV2({
    target,
    canonical: record,
    serviceProjection: serviceV1(record.revision.contentHash),
    coverAsset,
  }));
  assert.doesNotMatch(serialized, /localRef|rawPayloadRef|sourceRecordId|images\/covers/u);
  assert.match(serialized, /USER_CONFIRMED_PREVIEW_PERMISSION/u);
});

test('database rows preserve bounded projections without source or filesystem evidence', () => {
  const record = canonical();
  const bundle = buildServiceProjectionV2({ target, canonical: record, serviceProjection: serviceV1(record.revision.contentHash), coverAsset });
  const rows = buildCatalogDbRows('catalog-v2-test', bundle);
  assert.equal(rows.search.anilist_id, 1);
  assert.match(rows.search.search_text, /카우보이 비밥/u);
  assert.equal(rows.detail.payload.animeId, target.moemoaAnimeId);
  assert.equal(rows.asset.kind, 'COVER_IMAGE');
  assert.equal(rows.asset.bucket_id, 'catalog-covers-preview');
  assert.equal(rows.asset.checksum, 'a'.repeat(64));
  assert.doesNotMatch(JSON.stringify(rows), /localRef|rawPayloadRef|sourceRecordId/u);
});
