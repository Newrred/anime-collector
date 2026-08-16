import assert from 'node:assert/strict';
import test from 'node:test';

import { stableStringify } from '../../tools/catalog-lab/lib/hash.mjs';
import {
  CORE_GENRES,
  FIELD_STATES,
  FORMAT_VALUES,
  RELATION_VALUES,
  STATUS_VALUES,
  normalizeSourceRecord,
} from '../../tools/catalog-lab/pipeline/normalize.mjs';
import {
  CONFIDENCE_CLASSES,
  resolveIdentity,
} from '../../tools/catalog-lab/pipeline/identity.mjs';
import { buildFieldClaims } from '../../tools/catalog-lab/pipeline/claims.mjs';
import { buildCanonicalRevision } from '../../tools/catalog-lab/pipeline/canonical.mjs';

const target = Object.freeze({
  targetKey: 'ANILIST:1',
  moemoaAnimeId: 'anime:11111111-1111-4111-8111-111111111111',
  seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: '1' }]),
  seedTitles: Object.freeze([
    { locale: 'ko', value: '카우보이 비밥' },
    { locale: 'und', value: 'Cowboy Bebop' },
  ]),
  releaseYear: 1998,
  episodeCount: 26,
});

function sourceRecord(sourceId, payload, overrides = {}) {
  return {
    sourceRecordId: `${sourceId}-record`,
    targetKey: target.targetKey,
    sourceId,
    sourceEntityId: sourceId === 'anilist' ? '1' : sourceId === 'wikidata' ? 'Q1' : '101',
    fetchStatus: 'FETCHED',
    fetchedAt: '2026-08-17T01:02:03.000Z',
    requestFingerprint: `${sourceId}:fixture`,
    responseStatus: 200,
    payloadHash: `${sourceId}-payload-hash`,
    parserVersion: `${sourceId}-v1`,
    rawPayloadRef: `raw/${sourceId}/record.json`,
    payload,
    ...overrides,
  };
}

test('normalization exports the explicit finite vocabularies', () => {
  assert.deepEqual(FIELD_STATES, [
    'VALUE', 'SOURCE_NOT_AVAILABLE', 'NOT_FETCHED', 'CONFLICTED',
  ]);
  assert.deepEqual(CONFIDENCE_CLASSES, [
    'EXACT_ID', 'EXACT_RULE', 'REVIEWED', 'AMBIGUOUS',
  ]);
  assert.deepEqual(FORMAT_VALUES, [
    'TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL', 'MUSIC', 'WEB_SHORT', 'OTHER', 'UNKNOWN',
  ]);
  assert.deepEqual(STATUS_VALUES, [
    'ANNOUNCED', 'UPCOMING', 'AIRING', 'FINISHED', 'PAUSED', 'CANCELLED', 'UNKNOWN',
  ]);
  assert.deepEqual(RELATION_VALUES, [
    'SEQUEL', 'PREQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ADAPTATION', 'REMAKE', 'RECAP',
    'ALTERNATIVE_VERSION', 'SHARED_UNIVERSE', 'CHARACTER_CROSSOVER', 'OTHER',
  ]);
  assert.deepEqual(CORE_GENRES, [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
  ]);
});

test('AniList normalization applies Unicode NFKC, enum maps, core genres and preserves zero', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1,
    idMal: 1,
    title: { romaji: '  Ｃｏｗｂｏｙ Bebop  ', english: null, native: 'カウボーイビバップ' },
    synonyms: [' Cowboy\u00a0Bebop '],
    format: 'TV_SHORT',
    status: 'RELEASING',
    startDate: { year: 1998, month: 4, day: 3 },
    endDate: { year: null, month: null, day: null },
    season: 'SPRING',
    seasonYear: 1998,
    episodes: 0,
    source: 'VIDEO_GAME',
    genres: ['Action', 'Award Winning', 'Sci-Fi'],
    coverImage: { extraLarge: 'https://img.example/cover.jpg', large: null, medium: null },
    studios: { nodes: [] },
    relations: { edges: [] },
    externalLinks: [],
    characters: [],
  }));

  assert.deepEqual(normalized.titles.map(({ locale, value }) => ({ locale, value })), [
    { locale: 'ja-Latn', value: 'Cowboy Bebop' },
    { locale: 'ja', value: 'カウボーイビバップ' },
    { locale: 'und', value: 'Cowboy Bebop' },
  ]);
  assert.equal(normalized.format, 'WEB_SHORT');
  assert.equal(normalized.status, 'AIRING');
  assert.equal(normalized.startDate, '1998-04-03');
  assert.equal(normalized.endDate, null);
  assert.equal(normalized.episodeCount, 0);
  assert.equal(normalized.fieldStates.episodeCount, 'VALUE');
  assert.equal(normalized.sourceMaterialType, 'GAME');
  assert.deepEqual(normalized.sourceGenres, ['Action', 'Award Winning', 'Sci-Fi']);
  assert.deepEqual(normalized.coreGenres, ['Action', 'Sci-Fi']);
  const titleField = normalized.fieldValues.find((row) => row.fieldPath === 'titles'
    && row.normalizedValue.locale === 'ja-Latn');
  assert.equal(titleField.rawValue.value, '  Ｃｏｗｂｏｙ Bebop  ');
  assert.equal(titleField.normalizedValue.value, 'Cowboy Bebop');
});

test('normalization keeps null distinct from zero and carries source omission states', () => {
  const nullEpisodes = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03',
    numberOfEpisodes: null, publicPageUrl: 'https://anilife1.tv/content/101',
  }));
  assert.equal(nullEpisodes.episodeCount, null);
  assert.equal(nullEpisodes.fieldStates.episodeCount, 'SOURCE_NOT_AVAILABLE');

  const notFetched = normalizeSourceRecord(sourceRecord('anilife_public', {
    fieldState: 'NOT_FETCHED',
  }, { sourceEntityId: 'UNBOUND', responseStatus: 0 }));
  assert.equal(notFetched.episodeCount, null);
  assert.equal(notFetched.fieldStates.episodeCount, 'NOT_FETCHED');
  assert.equal(notFetched.fieldValues.every((row) => row.status === 'NOT_FETCHED'), true);
});

test('missing enums stay unavailable while present unrecognized enums map to UNKNOWN', () => {
  const missing = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], format: null, status: null,
    source: null, characters: [],
  }));
  assert.equal(missing.format, null);
  assert.equal(missing.fieldStates.format, 'SOURCE_NOT_AVAILABLE');
  assert.equal(missing.status, null);
  assert.equal(missing.fieldStates.status, 'SOURCE_NOT_AVAILABLE');
  assert.equal(missing.sourceMaterialType, null);
  assert.equal(missing.fieldStates.sourceMaterialType, 'SOURCE_NOT_AVAILABLE');

  const unknown = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], format: 'UNEXPECTED_FORMAT',
    status: 'UNEXPECTED_STATUS', source: 'UNEXPECTED_SOURCE', characters: [],
  }));
  assert.equal(unknown.format, 'UNKNOWN');
  assert.equal(unknown.fieldStates.format, 'VALUE');
  assert.equal(unknown.status, 'UNKNOWN');
  assert.equal(unknown.sourceMaterialType, 'UNKNOWN');
});

test('normalization rejects payload identities that disagree with their immutable SourceRecord', () => {
  assert.throws(() => normalizeSourceRecord(sourceRecord('anilist', {
    id: 2, title: { romaji: 'Cowboy Bebop' }, synonyms: [], characters: [],
  })), { code: 'SOURCE_SCHEMA_DRIFT' });
  assert.throws(() => normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '102', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 26,
  })), { code: 'SOURCE_SCHEMA_DRIFT' });
});

test('AniList normalization retains only MAIN/SUPPORTING characters and Japanese castings', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1,
    title: { romaji: 'Cowboy Bebop', english: null, native: null },
    synonyms: [], format: 'TV', status: 'FINISHED', startDate: { year: 1998, month: 4, day: 3 },
    endDate: { year: 1999, month: 4, day: 24 }, season: 'SPRING', seasonYear: 1998,
    episodes: 26, source: 'ORIGINAL', genres: [], coverImage: {}, studios: { nodes: [] },
    relations: { edges: [] }, externalLinks: [],
    characters: [
      {
        role: 'MAIN', node: { id: 10, name: { full: 'Spike Spiegel', native: 'スパイク', alternative: [] } },
        voiceActors: [
          { id: 20, name: { full: 'Koichi Yamadera', native: '山寺宏一', alternative: [] }, language: 'JAPANESE' },
          { id: 21, name: { full: 'English Actor', native: null, alternative: [] }, language: 'ENGLISH' },
        ],
      },
      { role: 'BACKGROUND', node: { id: 11, name: { full: 'Extra', native: null, alternative: [] } }, voiceActors: [] },
    ],
  }));

  assert.deepEqual(normalized.characters.map(({ id, role }) => ({ id, role })), [
    { id: 'anilist:10', role: 'MAIN' },
  ]);
  assert.deepEqual(normalized.castings.map(({ characterId, personId, language, creditedName }) => ({
    characterId, personId, language, creditedName,
  })), [{
    characterId: 'anilist:10', personId: 'anilist:20', language: 'ja', creditedName: '山寺宏一',
  }]);
});

test('Wikidata normalization accepts signed precision-day timestamps without losing provenance', () => {
  const timeValue = { time: '+1998-04-03T00:00:00Z', precision: 11 };
  const normalized = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' }, aliases: {},
    claims: { P577: [{ mainsnak: { datavalue: { value: timeValue, type: 'time' } } }] },
    sitelinks: {},
  }));
  assert.equal(normalized.startDate, '1998-04-03');
  assert.equal(normalized.releaseYear, 1998);
  const claimInput = normalized.fieldValues.find((row) => row.fieldPath === 'startDate');
  assert.equal(claimInput.rawValue, '+1998-04-03T00:00:00Z');
  assert.equal(claimInput.normalizedValue, '1998-04-03');
});

test('Wikidata date normalization keeps the raw value paired with the selected valid date', () => {
  const normalized = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' }, aliases: {},
    claims: { P577: [
      { mainsnak: { datavalue: { value: { time: '+1998-00-00T00:00:00Z', precision: 9 } } } },
      { mainsnak: { datavalue: { value: { time: '+1998-04-03T00:00:00Z', precision: 11 } } } },
    ] }, sitelinks: {},
  }));
  const claimInput = normalized.fieldValues.find((row) => row.fieldPath === 'startDate');
  assert.equal(claimInput.rawValue, '+1998-04-03T00:00:00Z');
  assert.equal(claimInput.normalizedValue, '1998-04-03');
});

test('AniList and Wikidata identities require exact AniList identifiers', () => {
  const anilistCandidate = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Different title' }, synonyms: [], characters: [],
  }));
  assert.deepEqual(resolveIdentity({ target, candidate: anilistCandidate, sourceId: 'anilist' }), {
    status: 'MATCHED', confidenceClass: 'EXACT_ID', ruleId: 'ANILIST_ID_V1',
  });

  const wikidataCandidate = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Different title' }, aliases: {}, claims: {}, sitelinks: {},
  }));
  assert.deepEqual(resolveIdentity({ target, candidate: wikidataCandidate, sourceId: 'wikidata' }), {
    status: 'MATCHED', confidenceClass: 'EXACT_ID', ruleId: 'WIKIDATA_P8729_V1',
  });

  const mismatch = { ...wikidataCandidate, externalIds: [{ sourceId: 'anilist', value: '2' }] };
  assert.deepEqual(resolveIdentity({ target, candidate: mismatch, sourceId: 'wikidata' }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'WIKIDATA_ID_MISMATCH_V1',
  });
});

test('AniLife exact normalized title plus year is auto-matched', () => {
  const candidate = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: '  Ｃｏｗｂｏｙ Bebop ', alternateName: '카우보이 비밥',
    datePublished: '1998-04-03', numberOfEpisodes: 26,
    publicPageUrl: 'https://anilife1.tv/content/101',
  }));
  const result = resolveIdentity({ target, candidate, sourceId: 'anilife_public' });
  assert.deepEqual(result, {
    status: 'MATCHED', confidenceClass: 'EXACT_RULE', ruleId: 'ANILIFE_TITLE_YEAR_V1',
  });
});

test('AniLife uses an exact-ID AniList reference for a real manifest-shaped target', () => {
  const manifestTarget = {
    targetKey: target.targetKey,
    moemoaAnimeId: target.moemoaAnimeId,
    seedExternalIds: target.seedExternalIds,
    seedTitles: target.seedTitles,
  };
  const anilistReference = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [],
    startDate: { year: 1998, month: 4, day: 3 }, episodes: 26, characters: [],
  }));
  const candidate = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 26,
  }));
  assert.deepEqual(resolveIdentity({
    target: manifestTarget, candidate, sourceId: 'anilife_public',
    referenceRecords: [anilistReference],
  }), {
    status: 'MATCHED', confidenceClass: 'EXACT_RULE', ruleId: 'ANILIFE_TITLE_YEAR_V1',
  });
  const claims = buildFieldClaims({
    target: manifestTarget, normalizedRecords: [anilistReference, candidate],
  });
  assert.equal(claims.some((claim) => claim.sourceId === 'anilife_public'
    && claim.fieldPath === 'episodeCount' && claim.normalizedValue === 26), true);
});

test('AniLife title ambiguity and near matches are review-only', () => {
  const candidate = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 26,
  }));
  assert.deepEqual(resolveIdentity({
    target, candidate: { ...candidate, exactTitleCandidateCount: 2 }, sourceId: 'anilife_public',
  }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'ANILIFE_MULTIPLE_CANDIDATES_V1',
  });
  assert.deepEqual(resolveIdentity({
    target, candidate: { ...candidate, titles: [{ locale: 'und', value: 'Cowboy Be-bop' }] },
    sourceId: 'anilife_public',
  }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'ANILIFE_TITLE_MISMATCH_V1',
  });
  assert.deepEqual(resolveIdentity({
    target, candidate: { ...candidate, releaseYear: 1999 }, sourceId: 'anilife_public',
  }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'ANILIFE_YEAR_MISMATCH_V1',
  });
});

test('AniLife episode rule requires explicit single-candidate evidence', () => {
  const targetWithoutYear = { ...target, releaseYear: null };
  const candidate = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: null, numberOfEpisodes: 26,
  }));
  assert.deepEqual(resolveIdentity({
    target: targetWithoutYear, candidate, sourceId: 'anilife_public',
  }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'ANILIFE_UNIQUENESS_REQUIRED_V1',
  });
  assert.deepEqual(resolveIdentity({
    target: targetWithoutYear, candidate: { ...candidate, exactTitleCandidateCount: 1 },
    sourceId: 'anilife_public',
  }), {
    status: 'MATCHED', confidenceClass: 'EXACT_RULE', ruleId: 'ANILIFE_TITLE_EPISODE_V1',
  });
});

test('identity rejects a candidate collected for a different target key', () => {
  const candidate = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], characters: [],
  }, { targetKey: 'ANILIST:999' }));
  assert.deepEqual(resolveIdentity({ target, candidate, sourceId: 'anilist' }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'IDENTITY_TARGET_MISMATCH_V1',
  });
  assert.deepEqual(buildFieldClaims({ target, normalizedRecords: [candidate] }), []);
});

test('FieldClaims have deterministic IDs and preserve raw provenance for every claim', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: '  Ｃｏｗｂｏｙ Bebop ', alternateName: '카우보이 비밥',
    datePublished: '1998-04-03', numberOfEpisodes: 26,
  }));
  const first = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const second = buildFieldClaims({ target, normalizedRecords: [structuredClone(normalized)] });
  assert.deepEqual(first, second);
  assert.equal(first.every((claim) => /^[a-f0-9]{64}$/.test(claim.claimId)), true);
  assert.equal(new Set(first.map((claim) => claim.claimId)).size, first.length);
  const titleClaim = first.find((claim) => claim.fieldPath === 'titles'
    && claim.normalizedValue.locale === 'und');
  assert.deepEqual(titleClaim.rawValue, { locale: 'und', value: '  Ｃｏｗｂｏｙ Bebop ' });
  assert.equal(titleClaim.sourceId, 'anilife_public');
  assert.equal(titleClaim.sourceRecordId, 'anilife_public-record');
  assert.equal(titleClaim.retrievedAt, '2026-08-17T01:02:03.000Z');
  assert.equal(titleClaim.confidenceClass, 'EXACT_RULE');
  assert.equal(titleClaim.ruleId, 'ANILIFE_TITLE_YEAR_V1');
});

test('every claim carries source promotion policy and prohibited sources cannot lose it', () => {
  const anilist = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], characters: [],
  }));
  const anilife = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 26,
  }));
  const wikidata = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' }, aliases: {}, claims: {}, sitelinks: {},
  }));
  const claims = buildFieldClaims({ target, normalizedRecords: [anilist, anilife, wikidata] });
  assert.equal(claims.filter((claim) => ['anilist', 'anilife_public'].includes(claim.sourceId))
    .every((claim) => claim.catalogPromotion === 'PROHIBITED'), true);
  assert.equal(claims.filter((claim) => claim.sourceId === 'wikidata')
    .every((claim) => claim.catalogPromotion === 'FIELD_REVIEW_REQUIRED'), true);
});

test('absence-only source records retain target-bound provenance claims', () => {
  const wikidataUnavailable = normalizeSourceRecord(sourceRecord('wikidata', {
    errorCode: 'SOURCE_NOT_AVAILABLE', externalIds: { anilist: '1' },
  }, { sourceEntityId: 'P8729:1', responseStatus: 404, fetchStatus: 'FAILED_PERMANENT' }));
  const anilifeNotFetched = normalizeSourceRecord(sourceRecord('anilife_public', {
    fieldState: 'NOT_FETCHED',
  }, { sourceEntityId: 'UNBOUND', responseStatus: 0 }));
  const claims = buildFieldClaims({
    target, normalizedRecords: [wikidataUnavailable, anilifeNotFetched],
  });
  assert.equal(claims.filter((claim) => claim.sourceId === 'wikidata').length, 17);
  assert.equal(claims.filter((claim) => claim.sourceId === 'wikidata')
    .every((claim) => claim.status === 'SOURCE_NOT_AVAILABLE'), true);
  assert.equal(claims.filter((claim) => claim.sourceId === 'anilife_public').length, 17);
  assert.equal(claims.filter((claim) => claim.sourceId === 'anilife_public')
    .every((claim) => claim.status === 'NOT_FETCHED'), true);
});

test('duplicate normalized records and duplicate canonical claims are idempotent', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], characters: [],
  }));
  const single = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const duplicate = buildFieldClaims({ target, normalizedRecords: [normalized, structuredClone(normalized)] });
  assert.deepEqual(duplicate, single);
  assert.equal(buildCanonicalRevision([...single, ...single]).revision.contentHash,
    buildCanonicalRevision(single).revision.contentHash);
});

test('a duplicate claim ID with different content is rejected', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], characters: [],
  }));
  const claims = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const changed = { ...claims[0], rawValue: 'different raw value' };
  assert.throws(() => buildCanonicalRevision([...claims, changed]), {
    code: 'FIELD_CLAIM_ID_COLLISION',
  });
});

test('ambiguous normalized records do not become canonical claims', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'A merely similar title', datePublished: '1998-04-03',
    numberOfEpisodes: 26,
  }));
  assert.deepEqual(buildFieldClaims({ target, normalizedRecords: [normalized] }), []);
});

test('conflicting episode counts remain conflicted while source absence does not erase zero', () => {
  const anilist = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], format: 'TV', status: 'FINISHED',
    startDate: { year: 1998, month: 4, day: 3 }, endDate: {}, season: 'SPRING', seasonYear: 1998,
    episodes: 0, source: 'ORIGINAL', genres: [], coverImage: {}, studios: { nodes: [] },
    relations: { edges: [] }, externalLinks: [], characters: [],
  }));
  const anilifeConflict = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 26,
  }));
  const claims = buildFieldClaims({ target, normalizedRecords: [anilist, anilifeConflict] });
  const episodeClaims = claims.filter((row) => row.fieldPath === 'episodeCount');
  assert.deepEqual(episodeClaims.map((row) => row.normalizedValue).sort((a, b) => a - b), [0, 26]);
  assert.equal(episodeClaims.every((row) => row.status === 'CONFLICTED'), true);

  const unavailable = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: null,
  }));
  const noConflictClaims = buildFieldClaims({ target, normalizedRecords: [anilist, unavailable] });
  assert.equal(noConflictClaims.find((row) => row.fieldPath === 'episodeCount'
    && row.normalizedValue === 0).status, 'VALUE');
  assert.equal(noConflictClaims.find((row) => row.fieldPath === 'episodeCount'
    && row.normalizedValue === null).status, 'SOURCE_NOT_AVAILABLE');
});

test('canonical revision preserves conflicts, orders collections and is input-order deterministic', () => {
  const anilist = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, idMal: 1,
    title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop', native: 'カウボーイビバップ' },
    synonyms: [], format: 'TV', status: 'FINISHED', startDate: { year: 1998, month: 4, day: 3 },
    endDate: { year: 1999, month: 4, day: 24 }, season: 'SPRING', seasonYear: 1998,
    episodes: 26, source: 'ORIGINAL', genres: ['Sci-Fi', 'Action'], coverImage: {},
    studios: { nodes: [{ id: 14, name: 'Sunrise', isAnimationStudio: true }] },
    relations: { edges: [
      { relationType: 'SIDE_STORY', node: { id: 5, type: 'ANIME', title: { romaji: 'B' }, format: 'MOVIE' } },
      { relationType: 'SEQUEL', node: { id: 3, type: 'ANIME', title: { romaji: 'A' }, format: 'MOVIE' } },
      { relationType: 'SUMMARY', node: { id: 7, type: 'ANIME', title: { romaji: 'C' }, format: 'MOVIE' } },
      { relationType: 'CHARACTER', node: { id: 8, type: 'ANIME', title: { romaji: 'D' }, format: 'SPECIAL' } },
    ] }, externalLinks: [],
    characters: [
      { role: 'SUPPORTING', node: { id: 2, name: { full: 'B', native: null, alternative: [] } }, voiceActors: [] },
      { role: 'MAIN', node: { id: 3, name: { full: 'C', native: null, alternative: [] } }, voiceActors: [
        { id: 9, name: { full: 'Z', native: null, alternative: [] }, language: 'JAPANESE' },
        { id: 8, name: { full: 'Y', native: null, alternative: [] }, language: 'JAPANESE' },
      ] },
    ],
  }));
  const anilife = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', alternateName: '카우보이 비밥',
    datePublished: '1998-04-03', numberOfEpisodes: 24,
  }));
  const claims = buildFieldClaims({ target, normalizedRecords: [anilist, anilife] });
  const first = buildCanonicalRevision(claims);
  const second = buildCanonicalRevision([...claims].reverse());

  assert.equal(stableStringify(first), stableStringify(second));
  assert.equal(first.id, target.moemoaAnimeId);
  assert.deepEqual(first.episodeCount, { state: 'CONFLICTED', values: [24, 26] });
  assert.deepEqual(first.titles.value.map(({ locale, value }) => `${locale}:${value}`), [
    'en:Cowboy Bebop', 'ja:カウボーイビバップ', 'ja-Latn:Cowboy Bebop', 'ko:카우보이 비밥',
    'und:Cowboy Bebop',
  ]);
  assert.deepEqual(first.externalIds.value.map(({ sourceId, value }) => `${sourceId}:${value}`), [
    'anilife_public:101', 'anilist:1', 'mal:1',
  ]);
  assert.deepEqual(first.relations.value.map(({ targetId, type }) => `${targetId}:${type}`), [
    'anilist:3:SEQUEL', 'anilist:5:SIDE_STORY',
    'anilist:7:RECAP', 'anilist:8:CHARACTER_CROSSOVER',
  ]);
  assert.deepEqual(first.characters.value.map(({ role, id }) => `${role}:${id}`), [
    'MAIN:anilist:3', 'SUPPORTING:anilist:2',
  ]);
  assert.deepEqual(first.castings.value.map(({ characterId, personId }) => `${characterId}:${personId}`), [
    'anilist:3:anilist:8', 'anilist:3:anilist:9',
  ]);
  assert.equal(first.reviewState, 'TEST_ONLY');
  assert.equal(first.distributionStatus, 'PROHIBITED');
  assert.match(first.revision.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(first.fieldProvenance.find((row) => row.fieldPath === 'episodeCount').claimIds.length, 2);
});

test('canonical content hash changes when a claim value changes but not when claim order changes', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 26,
  }));
  const claims = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const first = buildCanonicalRevision(claims);
  const reordered = buildCanonicalRevision([...claims].reverse());
  assert.equal(first.revision.contentHash, reordered.revision.contentHash);

  const changedClaims = claims.map((claim) => claim.fieldPath === 'episodeCount'
    ? { ...claim, normalizedValue: 25, rawValue: 25 }
    : claim);
  const changed = buildCanonicalRevision(changedClaims);
  assert.notEqual(first.revision.contentHash, changed.revision.contentHash);
});
