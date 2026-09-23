import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewedTitleIdentity } from '../../tools/catalog-lab/pipeline/title-identity-review.mjs';
import { applyTitleIdentityReview, hasRelatedTitleConflict } from '../../tools/catalog-lab/pipeline/title-identity-review.mjs';

const followup = JSON.parse(readFileSync(new URL('../../tools/catalog-lab/config/title-identity-reviews.json', import.meta.url))).records
  .filter(row => ['ANILIST:1707', 'ANILIST:8456', 'ANILIST:125367', 'ANILIFE:3514'].includes(row.targetKey));
test('four source-backed reviews retain legitimate numbering and isolate only the ambiguous OVA alias', () => {
  assert.equal(followup.length, 4);
  for (const row of followup) {
    const target = { targetKey: row.targetKey, seedTitles: row.evidence.seedTitles };
    const canonical = { id: row.animeId, revision: { contentHash: row.expectedCanonicalHash },
      titles: { state: 'VALUE', value: row.evidence.primaryTitles },
      relations: { state: 'VALUE', value: row.evidence.relations } };
    assert.equal(hasRelatedTitleConflict(target, canonical, row.preferredTitle, row.evidence.reviewedSearchTitles), true);
    const review = reviewedTitleIdentity(target, canonical);
    const output = applyTitleIdentityReview({ preferredTitle: row.preferredTitle,
      searchTitles: row.evidence.reviewedSearchTitles, quarantinedTitles: [], autoAcceptedTitleAliases: [] }, review);
    assert.deepEqual(output.preferredTitle, row.preferredTitle);
    if (row.targetKey === 'ANILIST:8456') {
      assert.equal(output.searchTitles.some(title => title.value === "Queen's Blade OVA"), false);
      assert.equal(output.quarantinedTitles.length, 1);
      assert.equal(output.quarantinedTitles[0].reasonCode, 'REVIEWED_AMBIGUOUS_TITLE');
    } else assert.deepEqual(output.searchTitles, row.evidence.reviewedSearchTitles);
    const stale = structuredClone(canonical);
    stale.revision.contentHash = '0'.repeat(64);
    assert.throws(() => reviewedTitleIdentity(target, stale), { code: 'TITLE_IDENTITY_REVIEW_STALE' });
  }
});

test('reviewed title replaces a wrong title, removes NFKC-equivalent aliases, and preserves source evidence', () => {
  const input = { preferredTitle: { locale: 'ko', value: '신부 ∬' }, searchTitles: [
    { locale: 'ko', value: '신부 ∫∫' }, { locale: 'en', value: 'Bride' }, { locale: 'und', value: 'Bride ∬' },
  ], quarantinedTitles: [], autoAcceptedTitleAliases: [] };
  const before = structuredClone(input);
  const review = { preferredTitle: { locale: 'ko', value: '신부' }, excludedTitles: [
    { locale: 'ko', value: '신부 ∬' }, { locale: 'und', value: 'Bride ∫∫' },
  ], koreanTitlePending: false };
  const output = applyTitleIdentityReview(input, review);
  assert.deepEqual(output.searchTitles, [{ locale: 'ko', value: '신부' }, { locale: 'en', value: 'Bride' }]);
  assert.equal(output.quarantinedTitles.length, 2);
  assert.deepEqual(input, before);
});

test('identity gate ignores manga adaptations and shared primary titles', () => {
  const target = { seedTitles: [{ locale: 'und', value: 'Example II' }] };
  const canonical = { titles: { state: 'VALUE', value: [{ locale: 'en', value: 'Example' }] },
    relations: { state: 'VALUE', value: [{ type: 'ADAPTATION', targetId: 'anilist:2', title: 'Example II' }] } };
  assert.equal(hasRelatedTitleConflict(target, canonical), false);
  canonical.relations.value[0].type = 'SEQUEL';
  assert.equal(hasRelatedTitleConflict(target, canonical), true);
  canonical.titles.value.push({ locale: 'en', value: 'Example II' });
  assert.equal(hasRelatedTitleConflict(target, canonical), false);
});
