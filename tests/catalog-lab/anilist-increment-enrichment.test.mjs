import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyApprovedAniListBindings,
  formatCompatible,
  MATCH_POLICY_VERSION,
  meanAbsoluteError,
  validateAniListBindingDocument,
} from '../../tools/catalog-lab/enrichment/anilist-increment.mjs';
import { sha256 } from '../../tools/catalog-lab/lib/hash.mjs';

const profile = 'increment-2026-09';
const targets = Object.freeze([
  Object.freeze({
    targetKey: 'ANILIFE:1036',
    moemoaAnimeId: 'anime:11111111-1111-4111-8111-111111111111',
    seedExternalIds: Object.freeze([{ sourceId: 'anilife_public', value: '1036' }]),
    seedTitles: Object.freeze([{ locale: 'ko', value: '테스트 작품' }]),
  }),
]);

function bindingDocument(changes = {}) {
  const core = {
    schemaVersion: 1,
    policyVersion: MATCH_POLICY_VERSION,
    profile,
    generatedAt: '2026-09-03T16:28:23+09:00',
    sourceId: 'anilist',
    bindings: [{
      targetKey: targets[0].targetKey,
      moemoaAnimeId: targets[0].moemoaAnimeId,
      anilistId: 201817,
      ruleId: 'COVER_YEAR_FORMAT_V2',
      evidenceHash: 'a'.repeat(64),
    }],
    ...changes,
  };
  return { ...core, contentHash: sha256(core) };
}

test('approved AniList bindings enrich increment targets without changing stable identity', () => {
  const document = bindingDocument();
  assert.deepEqual(validateAniListBindingDocument(document, { profile, targets }), document);
  const [enriched] = applyApprovedAniListBindings({ profile, targets, document });
  assert.equal(enriched.targetKey, targets[0].targetKey);
  assert.equal(enriched.moemoaAnimeId, targets[0].moemoaAnimeId);
  assert.deepEqual(enriched.seedExternalIds, [
    { sourceId: 'anilife_public', value: '1036' },
    { sourceId: 'anilist', value: '201817' },
  ]);
  assert.deepEqual(targets[0].seedExternalIds, [{ sourceId: 'anilife_public', value: '1036' }]);
});

test('AniList binding validation rejects content tampering and duplicate identities', () => {
  const tampered = bindingDocument();
  tampered.bindings[0].anilistId = 201818;
  assert.throws(() => validateAniListBindingDocument(tampered, { profile, targets }), {
    code: 'ANILIST_BINDING_INVALID',
  });

  const duplicatedBindings = [
    bindingDocument().bindings[0],
    { ...bindingDocument().bindings[0] },
  ];
  const duplicate = bindingDocument({ bindings: duplicatedBindings });
  assert.throws(() => validateAniListBindingDocument(duplicate, { profile, targets }), {
    code: 'ANILIST_BINDING_INVALID',
  });
});

test('cover fingerprint distance is deterministic and bounded', () => {
  assert.equal(meanAbsoluteError(Buffer.from([0, 10, 255]), Buffer.from([0, 20, 245])), 6.6667);
  assert.equal(meanAbsoluteError(Buffer.from([1]), Buffer.from([1, 2])), null);
});

test('AniLife and AniList format spellings compare in the same normalized vocabulary', () => {
  assert.equal(formatCompatible('Movie', 'MOVIE'), true);
  assert.equal(formatCompatible('TV', 'TV_SHORT'), true);
  assert.equal(formatCompatible('Movie', 'SPECIAL'), false);
});
