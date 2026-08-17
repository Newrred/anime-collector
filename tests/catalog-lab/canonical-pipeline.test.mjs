import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { sha256, stableStringify } from '../../tools/catalog-lab/lib/hash.mjs';
import { toPathKey } from '../../tools/catalog-lab/lib/path-key.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import genreConfig from '../../tools/catalog-lab/config/core-genre-map.json' with { type: 'json' };
import { SOURCE_PROMOTION_POLICY } from '../../tools/catalog-lab/contracts/catalogContracts.mjs';
import { createAniLifePublicPageAdapter } from '../../tools/catalog-lab/sources/anilife-public-page-test.mjs';
import {
  CORE_GENRES,
  FIELD_STATES,
  FORMAT_VALUES,
  RELATION_VALUES,
  STUDIO_ROLE_VALUES,
  STATUS_VALUES,
  normalizeSourceRecord,
} from '../../tools/catalog-lab/pipeline/normalize.mjs';
import {
  CONFIDENCE_CLASSES,
  resolveIdentity,
} from '../../tools/catalog-lab/pipeline/identity.mjs';
import { buildFieldClaims } from '../../tools/catalog-lab/pipeline/claims.mjs';
import { buildCanonicalRevision } from '../../tools/catalog-lab/pipeline/canonical.mjs';
import { storeSourceEnvelope } from '../../tools/catalog-lab/pipeline/raw-store.mjs';
import { collectEnvelopes } from './helpers/collect-envelopes.mjs';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

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
const sourceRecordsById = new Map();

async function withWorkspace(run) {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-task6-integration-'));
  try {
    return await run(await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true }));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function reviewedIdentityEvidence(exactTitleCandidateCount, overrides = {}) {
  const content = {
    version: 'ANILIFE_IDENTITY_EVIDENCE_V1',
    targetKey: target.targetKey,
    contentId: '1',
    ruleId: 'EXACT_TITLE_CANDIDATE_COUNT_V1',
    candidateCountBasis: 'MANUAL_EXACT_TITLE_CANDIDATE_REVIEW',
    exactTitleCandidateCount,
    reviewedAt: '2026-08-16T00:00:00.000Z',
    reviewedBy: 'catalog-reviewer',
    reviewReference: 'bindings/anilife.json#ANILIST:1',
    ...overrides,
  };
  return { ...content, evidenceHash: sha256(content) };
}

function rehashClaim(claim, changes) {
  const { contentIntegrity: _previousIntegrity, ...previousContent } = claim;
  const content = { ...structuredClone(previousContent), ...structuredClone(changes) };
  const record = {
    ...content,
    contentIntegrity: {
      version: 'FIELD_CLAIM_CONTENT_V1',
      algorithm: 'SHA-256',
      contentHash: sha256({ version: 'FIELD_CLAIM_CONTENT_V1', content }),
    },
  };
  return record;
}

function sourceRecord(sourceId, inputPayload, overrides = {}) {
  const successDefaults = {
    anilist: {
      id: 1, idMal: null, title: { romaji: null, english: null, native: null }, synonyms: [],
      format: null, status: null, startDate: { year: null, month: null, day: null },
      endDate: { year: null, month: null, day: null }, season: null, seasonYear: null,
      episodes: null, source: null, genres: [], coverImage: {}, studios: { nodes: [] },
      relations: { edges: [] }, externalLinks: [], characters: [],
    },
    wikidata: {
      externalIds: {}, labels: {}, aliases: {},
      claims: { P8729: [{ mainsnak: { snaktype: 'value', datavalue: { value: '1', type: 'string' } } }] },
      sitelinks: {},
    },
    anilife_public: {
      contentId: '101', title: null, alternateName: null, datePublished: null,
      numberOfEpisodes: null, imageUrl: null, publicPageUrl: 'https://anilife1.tv/content/101',
      identityEvidence: null,
    },
  };
  const isAbsence = inputPayload?.fieldState === 'NOT_FETCHED'
    || inputPayload?.errorCode === 'SOURCE_NOT_AVAILABLE';
  const defaults = structuredClone(successDefaults[sourceId] ?? {});
  const payload = isAbsence ? structuredClone(inputPayload) : {
    ...defaults,
    ...structuredClone(inputPayload),
    ...(sourceId === 'wikidata' ? {
      claims: { ...defaults.claims, ...structuredClone(inputPayload.claims ?? {}) },
    } : {}),
  };
  const sourceEntityId = overrides.sourceEntityId
    ?? (sourceId === 'anilist' ? '1' : sourceId === 'wikidata' ? 'Q1' : '101');
  const responseStatus = overrides.responseStatus ?? 200;
  const envelopeIdentity = {
    sourceId,
    targetKey: overrides.targetKey ?? target.targetKey,
    sourceEntityId,
    responseStatus,
    requestFingerprint: overrides.requestFingerprint ?? `${sourceId}:fixture`,
    parserVersion: overrides.parserVersion ?? `${sourceId}-v1`,
    payload,
  };
  const sourceRecordId = overrides.sourceRecordId ?? sha256(envelopeIdentity);
  const record = {
    sourceRecordId,
    targetKey: envelopeIdentity.targetKey,
    sourceId,
    sourceEntityId,
    fetchStatus: overrides.fetchStatus
      ?? (responseStatus >= 200 && responseStatus < 300 ? 'FETCHED' : 'FAILED_PERMANENT'),
    fetchedAt: overrides.fetchedAt ?? '2026-08-17T01:02:03.000Z',
    requestFingerprint: envelopeIdentity.requestFingerprint,
    responseStatus,
    payloadHash: overrides.payloadHash ?? sha256(payload),
    parserVersion: envelopeIdentity.parserVersion,
    rawPayloadRef: overrides.rawPayloadRef
      ?? `raw/${toPathKey(sourceId)}/${toPathKey(envelopeIdentity.targetKey)}/${sourceRecordId}.json`,
    payload,
  };
  sourceRecordsById.set(sourceRecordId, structuredClone(record));
  return record;
}

function authenticatedCanonical(fieldClaims, {
  targetRecord = target,
  sourceRecords = [...new Map(fieldClaims.map((claim) => {
    const record = sourceRecordsById.get(claim.sourceRecordId);
    if (!record) throw new Error(`Missing test SourceRecord ${claim.sourceRecordId}`);
    return [claim.sourceRecordId, record];
  })).values()],
  normalizedRecords = sourceRecords.map((record) => normalizeSourceRecord(record)),
} = {}) {
  return buildCanonicalRevision({
    target: targetRecord, sourceRecords, normalizedRecords, fieldClaims,
  });
}

function assertDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child, seen);
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
  assert.deepEqual(STUDIO_ROLE_VALUES, [
    'ANIMATION_PRODUCTION', 'CO_PRODUCTION', 'PRODUCTION_ASSISTANCE', 'PLANNING',
    'PRODUCTION_COMMITTEE', 'DISTRIBUTOR', 'BROADCASTER', 'OTHER',
  ]);
  assert.deepEqual(CORE_GENRES, [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
    'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
  ]);
  assert.deepEqual(CORE_GENRES, genreConfig.genres);
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
    claims: { P577: [{ mainsnak: { snaktype: 'value', datavalue: { value: timeValue, type: 'time' } } }] },
    sitelinks: {},
  }));
  assert.equal(normalized.startDate, '1998-04-03');
  assert.equal(normalized.releaseYear, 1998);
  const claimInput = normalized.fieldValues.find((row) => row.fieldPath === 'startDate');
  assert.deepEqual(claimInput.rawValue, timeValue);
  assert.equal(claimInput.normalizedValue, '1998-04-03');
});

test('Wikidata date normalization keeps the raw value paired with the selected valid date', () => {
  const normalized = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' }, aliases: {},
    claims: { P577: [
      { mainsnak: { snaktype: 'value', datavalue: { value: { time: '+1998-00-00T00:00:00Z', precision: 9 }, type: 'time' } } },
      { mainsnak: { snaktype: 'value', datavalue: { value: { time: '+1998-04-03T00:00:00Z', precision: 11 }, type: 'time' } } },
    ] }, sitelinks: {},
  }));
  const claimInput = normalized.fieldValues.find((row) => row.fieldPath === 'startDate');
  assert.deepEqual(claimInput.rawValue, { time: '+1998-04-03T00:00:00Z', precision: 11 });
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
  const identityEvidence = reviewedIdentityEvidence(1, { contentId: '101' });
  const multipleEvidence = reviewedIdentityEvidence(2, { contentId: '101' });
  const candidate = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 26,
    identityEvidence,
  }));
  assert.deepEqual(resolveIdentity({
    target, candidate: { ...candidate, identityEvidence: multipleEvidence }, sourceId: 'anilife_public',
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
  const identityEvidence = reviewedIdentityEvidence(1, { contentId: '101' });
  const candidate = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: null, numberOfEpisodes: 26,
    identityEvidence,
  }));
  assert.deepEqual(resolveIdentity({
    target: targetWithoutYear, candidate: { ...candidate, identityEvidence: null },
    sourceId: 'anilife_public',
  }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'ANILIFE_UNIQUENESS_REQUIRED_V1',
  });
  assert.deepEqual(resolveIdentity({
    target: targetWithoutYear, candidate,
    sourceId: 'anilife_public',
  }), {
    status: 'MATCHED', confidenceClass: 'EXACT_RULE', ruleId: 'ANILIFE_TITLE_EPISODE_V1',
  });
});

test('AniLife episode-only identity evidence survives normalize clone and claim creation', () => {
  const targetWithoutYear = { ...target, releaseYear: null };
  const identityEvidence = reviewedIdentityEvidence(1, { contentId: '101' });
  const normalized = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: null, numberOfEpisodes: 26,
    identityEvidence,
  }));
  assert.deepEqual(normalized.identityEvidence, identityEvidence);
  const persisted = structuredClone(normalized);
  const claims = buildFieldClaims({ target: targetWithoutYear, normalizedRecords: [persisted] });
  assert.equal(claims.some((claim) => claim.fieldPath === 'episodeCount'
    && claim.ruleId === 'ANILIFE_TITLE_EPISODE_V1'), true);

  persisted.identityEvidence.exactTitleCandidateCount = 0;
  assert.throws(() => buildFieldClaims({
    target: targetWithoutYear, normalizedRecords: [persisted],
  }), { code: 'NORMALIZED_RECORD_INVALID' });
});

test('AniLife adapter raw-store evidence controls episode-only identity end to end', async () => {
  await withWorkspace(async (workspace) => {
    const [sitemap, content] = await Promise.all([
      readFile(new URL('./fixtures/anilife-sitemap.xml', import.meta.url), 'utf8'),
      readFile(new URL('./fixtures/anilife-content-1.html', import.meta.url), 'utf8'),
    ]);
    const targetWithoutYear = { ...target, releaseYear: null };
    async function collectStored(binding) {
      const adapter = createAniLifePublicPageAdapter();
      const http = {
        async request({ url }) {
          if (url.endsWith('/sitemap.xml')) return new Response(sitemap, { status: 200 });
          if (url.endsWith('/content/1')) return new Response(content, { status: 200 });
          throw new Error(`Unexpected URL: ${url}`);
        },
      };
      const [envelope] = await collectEnvelopes(adapter, {
        targets: [target], http, workspace, clock: {
          now: () => '2026-08-17T01:02:03.000Z',
        }, bindings: { [target.targetKey]: binding },
      });
      const stored = await storeSourceEnvelope({ workspace, envelope });
      const record = JSON.parse(await readFile(stored.path, 'utf8'));
      const normalized = structuredClone(normalizeSourceRecord(record));
      return { normalized, claims: buildFieldClaims({
        target: targetWithoutYear, normalizedRecords: [normalized],
      }) };
    }

    const generic = await collectStored({
      contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW',
    });
    assert.equal(generic.normalized.identityEvidence, null);
    assert.equal(generic.claims.some((claim) => claim.ruleId === 'ANILIFE_TITLE_EPISODE_V1'), false);

    const uniqueEvidence = reviewedIdentityEvidence(1);
    const unique = await collectStored({
      contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW', identityEvidence: uniqueEvidence,
    });
    assert.deepEqual(unique.normalized.identityEvidence, uniqueEvidence);
    assert.equal(unique.claims.some((claim) => claim.ruleId === 'ANILIFE_TITLE_EPISODE_V1'), true);

    const multiple = await collectStored({
      contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW',
      identityEvidence: reviewedIdentityEvidence(2),
    });
    assert.equal(multiple.claims.length, 0);
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
  assert.equal(titleClaim.sourceRecordId, normalized.sourceRecordId);
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

test('legacy Korean seed title becomes the canonical baseline without promoting legacy aliases', () => {
  const legacyTarget = Object.freeze({
    targetKey: 'ANILIST:227',
    moemoaAnimeId: 'anime:22222222-2222-4222-8222-222222222222',
    seedSource: 'legacy_aliases',
    seedExternalIds: Object.freeze([{ sourceId: 'anilist', value: '227' }]),
    seedTitles: Object.freeze([
      { locale: 'ko', value: '프리크리' },
      { locale: 'und', value: 'FLCL' },
      { locale: 'und', value: 'フリクリ' },
    ]),
    targetStatus: 'ACTIVE',
    createdAt: '2026-08-17T00:00:00.97Z',
  });
  const record = sourceRecord('anilist', {
    id: 227, title: { romaji: 'FLCL', english: 'FLCL', native: 'フリクリ' },
    synonyms: [], characters: [],
  }, { targetKey: legacyTarget.targetKey, sourceEntityId: '227' });
  const normalized = normalizeSourceRecord(record);
  const claims = buildFieldClaims({ target: legacyTarget, normalizedRecords: [normalized] });
  const legacyClaims = claims.filter((claim) => claim.sourceId === 'legacy_aliases');

  assert.equal(legacyClaims.length, 1);
  assert.equal(legacyClaims[0].fieldPath, 'titles');
  assert.deepEqual(legacyClaims[0].normalizedValue, { locale: 'ko', value: '프리크리' });
  assert.deepEqual(legacyClaims[0].rawValue, { anilistId: '227', ko: '프리크리' });
  assert.equal(legacyClaims[0].catalogPromotion, 'PROHIBITED');
  assert.equal(legacyClaims[0].confidenceClass, 'EXACT_ID');
  assert.equal(legacyClaims[0].ruleId, 'LEGACY_ALIAS_ANILIST_ID_V1');
  assert.equal(legacyClaims[0].retrievedAt, '2026-08-17T00:00:00.970Z');
  assert.equal(claims.some((claim) => claim.sourceId === 'legacy_aliases'
    && claim.normalizedValue?.locale === 'und'), false);

  const canonical = buildCanonicalRevision({
    target: legacyTarget,
    sourceRecords: [record],
    normalizedRecords: [normalized],
    fieldClaims: claims,
  });
  assert.equal(canonical.titles.state, 'VALUE');
  assert.deepEqual(canonical.titles.value[0], { locale: 'ko', value: '프리크리' });
  assert.equal(canonical.titles.value.some((title) => title.locale === 'ko'
    && title.value === '프리크리'), true);
});

test('legacy Korean baseline fails closed unless its AniList ID and title are unambiguous', () => {
  const record = sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], characters: [],
  });
  const normalized = normalizeSourceRecord(record);
  const manifestTarget = {
    ...target,
    seedSource: 'legacy_aliases',
    targetStatus: 'ACTIVE',
    createdAt: '2026-08-17T00:00:00.000Z',
  };
  assert.throws(() => buildFieldClaims({
    target: {
      ...manifestTarget,
      seedExternalIds: [{ sourceId: 'anilist', value: '999' }],
    },
    normalizedRecords: [normalized],
  }), { code: 'LEGACY_SEED_INVALID' });
  assert.throws(() => buildFieldClaims({
    target: {
      ...manifestTarget,
      seedTitles: [
        { locale: 'ko', value: '카우보이 비밥' },
        { locale: 'ko', value: '카우보이 비밥 TV' },
      ],
    },
    normalizedRecords: [normalized],
  }), { code: 'LEGACY_SEED_INVALID' });
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
  assert.equal(authenticatedCanonical([...single, ...single]).revision.contentHash,
    authenticatedCanonical(single).revision.contentHash);
});

test('a duplicate claim ID with different content is rejected', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: [], characters: [],
  }));
  const claims = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const changed = { ...claims[0], rawValue: 'different raw value' };
  assert.throws(() => authenticatedCanonical([...claims, changed]), {
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
  assert.equal(episodeClaims.every((row) => row.status === 'VALUE'), true);

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
  const first = authenticatedCanonical(claims);
  const second = authenticatedCanonical([...claims].reverse());

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
  const first = authenticatedCanonical(claims);
  const reordered = authenticatedCanonical([...claims].reverse());
  assert.equal(first.revision.contentHash, reordered.revision.contentHash);

  const changedNormalized = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 25,
  }));
  const changed = authenticatedCanonical(buildFieldClaims({
    target, normalizedRecords: [changedNormalized],
  }));
  assert.notEqual(first.revision.contentHash, changed.revision.contentHash);
});

test('source claims stay immutable when a later source introduces a scalar conflict', () => {
  const anilist = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, episodes: 26,
  }));
  const anilife = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03', numberOfEpisodes: 24,
  }));
  const partialClaims = buildFieldClaims({ target, normalizedRecords: [anilist] });
  const completeClaims = buildFieldClaims({ target, normalizedRecords: [anilist, anilife] });
  const partialEpisode = partialClaims.find((claim) => claim.fieldPath === 'episodeCount');
  const rebuiltEpisode = completeClaims.find((claim) => claim.claimId === partialEpisode.claimId);
  assert.deepEqual(rebuiltEpisode, partialEpisode);
  assert.equal(partialEpisode.status, 'VALUE');

  const canonical = authenticatedCanonical([...partialClaims, ...completeClaims]);
  assert.deepEqual(canonical.episodeCount, { state: 'CONFLICTED', values: [24, 26] });
});

test('canonical rights derive from authoritative claim policy and reject policy spoofing', () => {
  const anilist = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' },
  }));
  const anilistClaims = buildFieldClaims({ target, normalizedRecords: [anilist] });
  assert.equal(anilistClaims.every((claim) => (
    claim.catalogPromotion === SOURCE_PROMOTION_POLICY.anilist
  )), true);
  assert.equal(authenticatedCanonical(anilistClaims).distributionStatus, 'PROHIBITED');

  const wikidata = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
  }));
  const [wikidataClaim] = buildFieldClaims({ target, normalizedRecords: [wikidata] });
  assert.throws(() => authenticatedCanonical([
    { ...wikidataClaim, catalogPromotion: 'PROHIBITED' },
  ]), { code: 'FIELD_CLAIM_SOURCE_POLICY_INVALID' });
  assert.throws(() => authenticatedCanonical([
    { ...wikidataClaim, sourceId: 'future_source', catalogPromotion: 'PROHIBITED' },
  ]), { code: 'FIELD_CLAIM_SOURCE_POLICY_INVALID' });
});

test('FieldClaim full-content integrity rejects coherent relabel and lone provenance tamper', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' },
  }));
  const [claim] = buildFieldClaims({ target, normalizedRecords: [normalized] });
  assert.deepEqual(Object.keys(claim.contentIntegrity).sort(), ['algorithm', 'contentHash', 'version']);
  assert.deepEqual(claim.contentIntegrity, {
    version: 'FIELD_CLAIM_CONTENT_V1',
    algorithm: 'SHA-256',
    contentHash: claim.contentIntegrity.contentHash,
  });
  assert.match(claim.contentIntegrity.contentHash, /^[a-f0-9]{64}$/u);

  const tamperedClaims = [
    {
      ...claim,
      sourceId: 'wikidata',
      catalogPromotion: 'FIELD_REVIEW_REQUIRED',
    },
    { ...claim, rawValue: { relabeled: 'raw evidence' } },
    { ...claim, ruleId: 'WIKIDATA_P8729_V1' },
    { ...claim, confidenceClass: claim.confidenceClass === 'EXACT_ID' ? 'EXACT_RULE' : 'EXACT_ID' },
    { ...claim, retrievedAt: '2026-08-17T01:02:04.000Z' },
  ];
  for (const tampered of tamperedClaims) {
    assert.throws(() => authenticatedCanonical([tampered]), {
      code: 'FIELD_CLAIM_INTEGRITY_INVALID',
    });
  }
});

test('canonical rights authenticate exact claim versions against trusted SourceRecords', () => {
  const record = sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, episodes: 26,
  });
  const normalized = normalizeSourceRecord(record);
  const claims = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const request = {
    target,
    sourceRecords: [record],
    normalizedRecords: [structuredClone(normalized)],
    fieldClaims: [...claims].reverse(),
  };
  const canonical = buildCanonicalRevision(request);
  assert.equal(canonical.distributionStatus, 'PROHIBITED');
  for (const provenance of canonical.fieldProvenance) {
    assert.deepEqual(provenance.claimVersions, provenance.claims.map((claim) => ({
      claimId: claim.claimId, contentHash: claim.contentHash,
    })));
  }
  const { revision, ...core } = canonical;
  assert.equal(revision.contentHash, sha256(core));
  assert.throws(() => buildCanonicalRevision(claims), {
    code: 'CANONICAL_CLAIMS_UNTRUSTED',
  });

  const claim = claims[0];
  const relabeled = rehashClaim(claim, {
    sourceId: 'wikidata', catalogPromotion: 'FIELD_REVIEW_REQUIRED',
  });
  const changedRaw = rehashClaim(claim, { rawValue: { forged: 'evidence' } });
  assert.equal(relabeled.claimId, claim.claimId);
  assert.equal(changedRaw.claimId, claim.claimId);
  for (const tampered of [relabeled, changedRaw]) {
    const fieldClaims = claims.map((candidate) => candidate.claimId === claim.claimId
      ? tampered : candidate);
    assert.throws(() => buildCanonicalRevision({ ...request, fieldClaims }), {
      code: 'FIELD_CLAIM_AUTHENTICATION_INVALID',
    });
  }
});

test('canonical rejects normalized identity evidence edited away from retained binding evidence', () => {
  const identityEvidence = reviewedIdentityEvidence(1, { contentId: '101' });
  const record = sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: null, numberOfEpisodes: 26,
    identityEvidence,
  });
  const normalized = normalizeSourceRecord(record);
  const claims = buildFieldClaims({ target: { ...target, releaseYear: null }, normalizedRecords: [normalized] });
  const edited = structuredClone(normalized);
  const editedEvidence = { ...edited.identityEvidence, exactTitleCandidateCount: 2 };
  const { evidenceHash: _oldHash, ...editedContent } = editedEvidence;
  edited.identityEvidence = { ...editedContent, evidenceHash: sha256(editedContent) };
  assert.throws(() => buildCanonicalRevision({
    target: { ...target, releaseYear: null }, sourceRecords: [record],
    normalizedRecords: [edited], fieldClaims: claims,
  }), { code: 'NORMALIZED_RECORD_AUTHENTICATION_INVALID' });
});

test('collection natural-key collisions are conflicted and totally ordered', () => {
  const firstRecord = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, idMal: 2, title: { romaji: 'Cowboy Bebop' },
    studios: { nodes: [{ id: 14, name: 'Sunrise', isAnimationStudio: true }] },
    relations: { edges: [{
      relationType: 'SEQUEL', node: { id: 3, type: 'ANIME', title: { romaji: 'First' }, format: 'MOVIE' },
    }] },
    characters: [{
      role: 'MAIN', node: { id: 10, name: { full: 'Spike', native: null, alternative: [] } },
      voiceActors: [{
        id: 20, name: { full: 'Actor A', native: null, alternative: [] }, language: 'JAPANESE',
      }],
    }],
  }));
  const secondRecord = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, idMal: 3, title: { romaji: 'Cowboy Bebop' },
    studios: { nodes: [{ id: 14, name: 'Renamed Sunrise', isAnimationStudio: true }] },
    relations: { edges: [{
      relationType: 'SEQUEL', node: { id: 3, type: 'ANIME', title: { romaji: 'Second' }, format: 'MOVIE' },
    }] },
    characters: [{
      role: 'SUPPORTING', node: { id: 10, name: { full: 'Spike Spiegel', native: null, alternative: [] } },
      voiceActors: [{
        id: 20, name: { full: 'Actor B', native: null, alternative: [] }, language: 'JAPANESE',
      }],
    }],
  }));
  const claims = buildFieldClaims({ target, normalizedRecords: [firstRecord, secondRecord] });
  const forward = authenticatedCanonical(claims);
  const reverse = authenticatedCanonical([...claims].reverse());
  assert.equal(stableStringify(forward), stableStringify(reverse));
  for (const fieldPath of ['externalIds', 'studios', 'relations', 'characters', 'castings']) {
    assert.equal(forward[fieldPath].state, 'CONFLICTED', fieldPath);
    assert.equal(forward[fieldPath].values.length >= 2, true, fieldPath);
  }
});

test('Wikidata preserves every valid scalar candidate before canonical conflict assessment', () => {
  const firstDate = { time: '+1998-04-03T00:00:00Z', precision: 11 };
  const secondDate = { time: '+1999-04-03T00:00:00Z', precision: 11 };
  const normalized = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
    claims: {
      P577: [
        { mainsnak: { snaktype: 'value', datavalue: { value: firstDate, type: 'time' } } },
        { mainsnak: { snaktype: 'value', datavalue: { value: secondDate, type: 'time' } } },
      ],
      P856: [
        { mainsnak: { snaktype: 'value', datavalue: { value: 'https://example.test/one', type: 'string' } } },
        { mainsnak: { snaktype: 'value', datavalue: { value: 'https://example.test/two', type: 'string' } } },
      ],
    },
  }));
  assert.deepEqual(normalized.fieldValues.filter((row) => row.fieldPath === 'startDate')
    .map((row) => row.normalizedValue), ['1998-04-03', '1999-04-03']);
  assert.deepEqual(normalized.fieldValues.filter((row) => row.fieldPath === 'officialSiteUrl')
    .map((row) => row.normalizedValue), ['https://example.test/one', 'https://example.test/two']);
  const canonical = authenticatedCanonical(buildFieldClaims({ target, normalizedRecords: [normalized] }));
  assert.equal(canonical.startDate.state, 'CONFLICTED');
  assert.equal(canonical.officialSiteUrl.state, 'CONFLICTED');
});

test('Wikidata missing-value snaks preserve evidence without poisoning valid sibling fields', () => {
  const normalized = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
    claims: {
      P577: [
        { mainsnak: { snaktype: 'novalue' } },
        { mainsnak: { snaktype: 'value', datavalue: {
          value: { time: '+1998-04-03T00:00:00Z', precision: 11 }, type: 'time',
        } } },
      ],
      P856: [{ mainsnak: { snaktype: 'somevalue' } }],
      P136: [{ mainsnak: { snaktype: 'novalue' } }],
      P272: [{ mainsnak: { snaktype: 'somevalue' } }],
    },
  }));
  assert.equal(normalized.titles.some((title) => title.value === 'Cowboy Bebop'), true);
  assert.equal(normalized.startDate, '1998-04-03');
  const missingSite = normalized.fieldValues.find((row) => row.fieldPath === 'officialSiteUrl');
  assert.equal(missingSite.status, 'SOURCE_NOT_AVAILABLE');
  assert.deepEqual(missingSite.rawValue, { snaktype: 'somevalue' });
  const missingGenre = normalized.fieldValues.find((row) => row.fieldPath === 'sourceGenres');
  assert.equal(missingGenre.status, 'SOURCE_NOT_AVAILABLE');
  assert.deepEqual(missingGenre.rawValue, { snaktype: 'novalue' });
  const claims = buildFieldClaims({ target, normalizedRecords: [structuredClone(normalized)] });
  assert.equal(claims.some((claim) => claim.fieldPath === 'officialSiteUrl'
    && claim.status === 'SOURCE_NOT_AVAILABLE' && claim.rawValue.snaktype === 'somevalue'), true);

  const mixed = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
    claims: { P856: [
      { mainsnak: { snaktype: 'somevalue' } },
      { mainsnak: { snaktype: 'novalue' } },
    ] },
  }));
  const mixedSite = mixed.fieldValues.find((row) => row.fieldPath === 'officialSiteUrl');
  assert.equal(mixed.fieldStates.officialSiteUrl, 'SOURCE_NOT_AVAILABLE');
  assert.equal(mixedSite.status, 'SOURCE_NOT_AVAILABLE');
  assert.deepEqual(mixedSite.rawValue, [
    { snaktype: 'novalue' }, { snaktype: 'somevalue' },
  ]);

  for (const mainsnak of [
    { snaktype: 'novalue', datavalue: { value: 'https://example.test', type: 'string' } },
    { snaktype: 'value' },
  ]) {
    assert.throws(() => normalizeSourceRecord(sourceRecord('wikidata', {
      externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
      claims: { P856: [{ mainsnak }] },
    })), { code: 'SOURCE_SCHEMA_DRIFT' });
  }
});

test('partial-year evidence supports exact AniLife matching without inventing a full date', () => {
  const manifestTarget = {
    targetKey: target.targetKey,
    moemoaAnimeId: target.moemoaAnimeId,
    seedExternalIds: target.seedExternalIds,
    seedTitles: target.seedTitles,
  };
  const anilist = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, seasonYear: 1998,
    startDate: { year: 1998, month: null, day: null },
  }));
  const anilife = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998', numberOfEpisodes: 26,
  }));
  assert.deepEqual(anilist.releaseYearEvidence, [1998]);
  assert.deepEqual(anilife.releaseYearEvidence, [1998]);
  assert.equal(anilife.startDate, null);
  assert.deepEqual(resolveIdentity({
    target: manifestTarget, candidate: anilife, sourceId: 'anilife_public',
    referenceRecords: [anilist],
  }), { status: 'MATCHED', confidenceClass: 'EXACT_RULE', ruleId: 'ANILIFE_TITLE_YEAR_V1' });

  const conflictingReference = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, seasonYear: 1999,
    startDate: { year: 1998, month: 4, day: 3 },
  }));
  assert.deepEqual(resolveIdentity({
    target: manifestTarget, candidate: anilife, sourceId: 'anilife_public',
    referenceRecords: [conflictingReference],
  }), {
    status: 'PENDING_REVIEW', confidenceClass: 'AMBIGUOUS', ruleId: 'ANILIFE_REFERENCE_CONFLICT_V1',
  });
});

test('SourceRecord validation rejects integrity, state and per-source payload drift', () => {
  const validAniList = sourceRecord('anilist', { id: 1, title: { romaji: 'Cowboy Bebop' } });
  const rawRefKey = ['rawPayload', 'Ref'].join('');
  const invalidRawRef = ['raw/anilist/', 'wrong.json'].join('');
  const cases = [
    { name: 'payload hash', record: { ...validAniList, payloadHash: '0'.repeat(64) }, code: 'SOURCE_RECORD_INTEGRITY_INVALID' },
    { name: 'record id', record: { ...validAniList, sourceRecordId: '0'.repeat(64) }, code: 'SOURCE_RECORD_INTEGRITY_INVALID' },
    { name: 'raw ref', record: { ...validAniList, [rawRefKey]: invalidRawRef }, code: 'SOURCE_RECORD_INTEGRITY_INVALID' },
    {
      name: '5xx with values',
      record: sourceRecord('anilist', { id: 1, title: { romaji: 'Cowboy Bebop' } }, {
        responseStatus: 500, fetchStatus: 'FAILED_PERMANENT',
      }),
      code: 'SOURCE_RECORD_STATE_INVALID',
    },
    {
      name: 'AniLife schema drift',
      record: sourceRecord('anilife_public', {
        contentId: '101', title: 'Cowboy Bebop', errorCode: 'SOURCE_SCHEMA_DRIFT',
      }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
    {
      name: 'malformed collection',
      record: sourceRecord('anilist', { id: 1, title: { romaji: 'Cowboy Bebop' }, synonyms: {} }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
    {
      name: 'mismatched P8729',
      record: sourceRecord('wikidata', {
        externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
        claims: { P8729: [{ mainsnak: { snaktype: 'value', datavalue: { value: '2', type: 'string' } } }] },
      }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
    {
      name: 'P8729 bound to another target',
      record: sourceRecord('wikidata', {
        externalIds: { anilist: '2' }, labels: { en: 'Cowboy Bebop' },
        claims: { P8729: [{ mainsnak: { snaktype: 'value', datavalue: { value: '2', type: 'string' } } }] },
      }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
    {
      name: 'nested AniList schema drift',
      record: sourceRecord('anilist', {
        id: 1, title: { romaji: 'Cowboy Bebop', unexpected: 'drift' },
      }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
    {
      name: 'malformed Wikidata scalar candidate',
      record: sourceRecord('wikidata', {
        externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
        claims: { P577: [{ mainsnak: { snaktype: 'value', datavalue: { value: { precision: 11 }, type: 'time' } } }] },
      }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
    {
      name: 'timestamp without exact milliseconds',
      record: sourceRecord('anilist', { id: 1, title: { romaji: 'Cowboy Bebop' } }, {
        fetchedAt: '2026-08-17T01:02:03Z',
      }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
    {
      name: 'invalid exact-shaped timestamp',
      record: sourceRecord('anilist', { id: 1, title: { romaji: 'Cowboy Bebop' } }, {
        fetchedAt: '2026-99-17T01:02:03.000Z',
      }),
      code: 'SOURCE_SCHEMA_DRIFT',
    },
  ];
  for (const { name, record, code } of cases) {
    assert.throws(() => normalizeSourceRecord(record), { code }, name);
  }
  let payloadGetterInvoked = false;
  const accessorRecord = sourceRecord('anilist', { id: 1, title: { romaji: 'Cowboy Bebop' } });
  Object.defineProperty(accessorRecord.payload.title, 'romaji', {
    enumerable: true,
    get() { payloadGetterInvoked = true; return 'Cowboy Bebop'; },
  });
  assert.throws(() => normalizeSourceRecord(accessorRecord), { code: 'SOURCE_SCHEMA_DRIFT' });
  assert.equal(payloadGetterInvoked, false);
});

test('source-specific absence binding rejects wrong-target and unsupported records', () => {
  const wrongWikidata = sourceRecord('wikidata', {
    errorCode: 'SOURCE_NOT_AVAILABLE', externalIds: { anilist: '1' },
  }, { sourceEntityId: 'P8729:2', responseStatus: 404, fetchStatus: 'FAILED_PERMANENT' });
  assert.throws(() => normalizeSourceRecord(wrongWikidata), { code: 'SOURCE_SCHEMA_DRIFT' });

  const unsupported = sourceRecord('unsupported_source', { fieldState: 'NOT_FETCHED' }, {
    sourceEntityId: 'UNBOUND', responseStatus: 0, fetchStatus: 'FAILED_PERMANENT',
  });
  assert.throws(() => normalizeSourceRecord(unsupported), { code: 'SOURCE_SCHEMA_DRIFT' });
});

test('standalone normalization rejects malformed-target and non-exact source absences', () => {
  const cases = [
    sourceRecord('wikidata', {
      errorCode: 'SOURCE_NOT_AVAILABLE', externalIds: { anilist: null },
    }, {
      targetKey: 'MALFORMED', sourceEntityId: 'P8729:null', responseStatus: 404,
      fetchStatus: 'FAILED_PERMANENT',
    }),
    sourceRecord('wikidata', {
      errorCode: 'SOURCE_NOT_AVAILABLE', externalIds: { anilist: '1', wikidata: 'Q1' },
    }, { sourceEntityId: 'P8729:1', responseStatus: 404, fetchStatus: 'FAILED_PERMANENT' }),
    sourceRecord('anilife_public', { fieldState: 'NOT_FETCHED' }, {
      targetKey: 'MALFORMED', sourceEntityId: 'UNBOUND', responseStatus: 0,
      fetchStatus: 'FAILED_PERMANENT',
    }),
  ];
  for (const record of cases) {
    assert.throws(() => normalizeSourceRecord(record), { code: 'SOURCE_SCHEMA_DRIFT' });
  }
});

test('normalized and FieldClaim persistence inputs are strictly validated', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' },
  }));
  const malformedNormalized = structuredClone(normalized);
  malformedNormalized.fieldValues.push({
    fieldPath: 'unknownField', rawValue: 'x', normalizedValue: 'x', status: 'VALUE',
  });
  assert.throws(() => buildFieldClaims({
    target, normalizedRecords: [malformedNormalized],
  }), { code: 'NORMALIZED_RECORD_INVALID' });

  const inconsistentState = structuredClone(normalized);
  inconsistentState.fieldStates.titles = 'SOURCE_NOT_AVAILABLE';
  inconsistentState.titles = [];
  assert.throws(() => buildFieldClaims({
    target, normalizedRecords: [inconsistentState],
  }), { code: 'NORMALIZED_RECORD_INVALID' });

  const extraValueKey = structuredClone(normalized);
  extraValueKey.titles[0].unexpected = 'drift';
  assert.throws(() => buildFieldClaims({
    target, normalizedRecords: [extraValueKey],
  }), { code: 'NORMALIZED_RECORD_INVALID' });

  const mismatchedSourceEntity = structuredClone(normalized);
  mismatchedSourceEntity.sourceEntityId = '2';
  assert.throws(() => buildFieldClaims({
    target, normalizedRecords: [mismatchedSourceEntity],
  }), { code: 'NORMALIZED_RECORD_INVALID' });

  let fieldGetterInvoked = false;
  const accessorNormalized = structuredClone(normalized);
  Object.defineProperty(accessorNormalized.fieldValues, 0, {
    enumerable: true,
    get() { fieldGetterInvoked = true; return normalized.fieldValues[0]; },
  });
  assert.throws(() => buildFieldClaims({
    target, normalizedRecords: [accessorNormalized],
  }), { code: 'FIELD_CLAIM_INPUT_INVALID' });
  assert.equal(fieldGetterInvoked, false);

  const [claim] = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const invalidClaims = [
    { ...claim, entityType: 'Person' },
    { ...claim, fieldPath: 'unknownField' },
    { ...claim, status: 'PUBLISHED' },
    { ...claim, confidenceClass: 'SCORE_0_9' },
    { ...claim, catalogPromotion: 'ALLOWED' },
    { ...claim, retrievedAt: '2026-99-17T01:02:03.000Z' },
  ];
  for (const invalid of invalidClaims) {
    assert.throws(() => authenticatedCanonical([invalid]), { code: 'FIELD_CLAIM_INVALID' });
  }
  assert.throws(() => authenticatedCanonical([{ ...claim, normalizedValue: 'tampered' }]), {
    code: 'FIELD_CLAIM_ID_INVALID',
  });
});

test('persisted entity values enforce studio roles, qualified IDs and normalized names', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, idMal: 2, title: { romaji: 'Cowboy Bebop' },
    studios: { nodes: [{ id: 14, name: 'Sunrise', isAnimationStudio: true }] },
    relations: { edges: [{
      relationType: 'SEQUEL', node: {
        id: 3, type: 'ANIME', title: { romaji: 'Movie' }, format: 'MOVIE',
      },
    }] },
    characters: [{
      role: 'MAIN', node: { id: 10, name: { full: 'Spike', native: null, alternative: [] } },
      voiceActors: [{
        id: 20, name: { full: 'Actor', native: null, alternative: [] }, language: 'JAPANESE',
      }],
    }],
  }));
  const mutations = [
    ['studios', (value) => { value.role = 'OWNER'; }],
    ['studios', (value) => { value.id = '14'; }],
    ['studios', (value) => { value.name = ''; }],
    ['relations', (value) => { value.targetId = '3'; }],
    ['characters', (value) => { value.id = '10'; }],
    ['castings', (value) => { value.personId = '20'; }],
    ['externalIds', (value) => { value.value = 'not-an-id'; }, 1],
  ];
  for (const [fieldPath, mutate, index = 0] of mutations) {
    const malformed = structuredClone(normalized);
    mutate(malformed[fieldPath][index]);
    mutate(malformed.fieldValues.filter((row) => row.fieldPath === fieldPath)[index].normalizedValue);
    assert.throws(() => buildFieldClaims({ target, normalizedRecords: [malformed] }), {
      code: 'NORMALIZED_RECORD_INVALID',
    }, fieldPath);
  }
});

test('claim and canonical snapshot boundaries type throwing and revoked Proxy failures', () => {
  const record = sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' },
  });
  const normalized = normalizeSourceRecord(record);
  const claims = buildFieldClaims({ target, normalizedRecords: [normalized] });

  const revokedClaimInput = Proxy.revocable({ target, normalizedRecords: [normalized] }, {});
  revokedClaimInput.revoke();
  assert.throws(() => buildFieldClaims(revokedClaimInput.proxy), {
    code: 'FIELD_CLAIM_INPUT_INVALID',
  });

  const revokedRecords = Proxy.revocable([], {});
  revokedRecords.revoke();
  assert.throws(() => buildFieldClaims({ target, normalizedRecords: revokedRecords.proxy }), {
    code: 'FIELD_CLAIM_INPUT_INVALID',
  });

  const revokedClaims = Proxy.revocable([], {});
  revokedClaims.revoke();
  assert.throws(() => buildCanonicalRevision(revokedClaims.proxy), {
    code: 'FIELD_CLAIM_AUTH_INPUT_INVALID',
  });

  const throwingClaim = new Proxy(structuredClone(claims[0]), {
    ownKeys() { throw new Error('SYNTHETIC_TRAP'); },
  });
  assert.throws(() => buildCanonicalRevision({
    target, sourceRecords: [record], normalizedRecords: [normalized], fieldClaims: [throwingClaim],
  }), {
    code: 'FIELD_CLAIM_AUTH_INPUT_INVALID',
  });
});

test('normalized records, claims and canonical revisions are independent deep-frozen snapshots', () => {
  const normalized = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' },
    characters: [{
      role: 'MAIN', node: { id: 10, name: { full: 'Spike', native: null, alternative: [] } },
      voiceActors: [],
    }],
  }));
  const titleField = normalized.fieldValues.find((row) => row.fieldPath === 'titles');
  assert.notEqual(normalized.titles[0], titleField.normalizedValue);
  assertDeepFrozen(normalized);
  assert.throws(() => { normalized.titles[0].value = 'mutated'; }, TypeError);

  const claims = buildFieldClaims({ target, normalizedRecords: [normalized] });
  const titleClaim = claims.find((claim) => claim.fieldPath === 'titles');
  assert.notEqual(titleClaim.normalizedValue, normalized.titles[0]);
  assertDeepFrozen(claims);
  assert.throws(() => { titleClaim.normalizedValue.value = 'mutated'; }, TypeError);

  const canonical = authenticatedCanonical(claims);
  assert.notEqual(canonical.titles.value[0], titleClaim.normalizedValue);
  assertDeepFrozen(canonical);
  assert.throws(() => { canonical.fieldProvenance[0].claimIds.push('mutated'); }, TypeError);
});

test('FieldClaim rawValue retains the complete projected evidence used by normalization', () => {
  const timeValue = { time: '+1998-04-03T00:00:00Z', precision: 11, calendarmodel: 'Q1985727' };
  const wikidata = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
    claims: {
      P577: [{ mainsnak: { snaktype: 'value', datavalue: { value: timeValue, type: 'time' } } }],
      P136: [{ mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q201658' }, type: 'wikibase-entityid' } } }],
      P272: [{ mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q312103' }, type: 'wikibase-entityid' } } }],
    },
  }));
  assert.deepEqual(wikidata.fieldValues.find((row) => row.fieldPath === 'startDate').rawValue, timeValue);
  assert.deepEqual(wikidata.fieldValues.find((row) => row.fieldPath === 'sourceGenres').rawValue,
    { id: 'Q201658' });
  assert.deepEqual(wikidata.fieldValues.find((row) => row.fieldPath === 'studios').rawValue,
    { id: 'Q312103' });

  const characterEdge = {
    role: 'MAIN', node: { id: 10, name: { full: 'Spike', native: null, alternative: [] } },
    voiceActors: [{
      id: 20, name: { full: 'Actor', native: null, alternative: [] }, language: 'JAPANESE',
    }],
  };
  const anilist = normalizeSourceRecord(sourceRecord('anilist', {
    id: 1, title: { romaji: 'Cowboy Bebop' }, characters: [characterEdge],
  }));
  assert.deepEqual(anilist.fieldValues.find((row) => row.fieldPath === 'characters').rawValue, {
    role: characterEdge.role, node: characterEdge.node,
  });
  assert.deepEqual(anilist.fieldValues.find((row) => row.fieldPath === 'castings').rawValue, {
    character: { role: characterEdge.role, node: characterEdge.node },
    voiceActor: characterEdge.voiceActors[0],
  });
});

test('date and URL normalization are anchored and fail closed', () => {
  const malformedDate = normalizeSourceRecord(sourceRecord('anilife_public', {
    contentId: '101', title: 'Cowboy Bebop', datePublished: '1998-04-03garbage',
    imageUrl: 'https://user:secret@example.test/cover.jpg',
  }));
  assert.equal(malformedDate.startDate, null);
  assert.deepEqual(malformedDate.releaseYearEvidence, []);
  assert.equal(malformedDate.cover, null);

  const urls = normalizeSourceRecord(sourceRecord('wikidata', {
    externalIds: { anilist: '1' }, labels: { en: 'Cowboy Bebop' },
    claims: { P856: [
      { mainsnak: { snaktype: 'value', datavalue: { value: 'javascript:alert(1)', type: 'string' } } },
      { mainsnak: { snaktype: 'value', datavalue: { value: 'https://EXAMPLE.test:443/path', type: 'string' } } },
    ] },
  }));
  assert.deepEqual(urls.fieldValues.filter((row) => row.fieldPath === 'officialSiteUrl')
    .map((row) => row.normalizedValue), ['https://example.test/path']);
});
