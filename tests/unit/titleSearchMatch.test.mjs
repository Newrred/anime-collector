import test from 'node:test';
import assert from 'node:assert/strict';
import { titleSearchMatchRank, strictTitleSearchKey } from '../../src/domain/search/titleSearchMatch.js';
import { createLegacyAliasTitleResolver } from '../../src/features/memory/adapters/catalog/legacyAliasTitleResolver.js';

test('decoration may be omitted in ordinary searches without changing strict identity keys', async () => {
  assert.equal(titleSearchMatchRank('오! 나의 여신님', '오나의여신님'), 3);
  assert.equal(titleSearchMatchRank('바람의 검심 -메이지 검객 낭만기- 추억편', '바람의검심메이지검객낭만기추억편'), 3);
  const resolver = createLegacyAliasTitleResolver({ rows: [{ anilistId: 50, ko: '오! 나의 여신님', aliases: [] }] });
  assert.equal((await resolver.search('오나의여신님'))[0].sourceBinding.externalId, '50');
  assert.notEqual(strictTitleSearchKey('Nisekoi'), strictTitleSearchKey('Nisekoi:'));
});

test('explicit sequel symbols cannot fall back to the unmarked first-season title', () => {
  for (const [title, query] of [['5등분의 신부', '5등분의 신부 ∬'], ['Nisekoi', 'Nisekoi:'], ['Dog Days', "Dog Days'"], ['Cells at Work!', 'Cells at Work!!']]) {
    assert.equal(titleSearchMatchRank(title, query), 0);
  }
  assert.equal(titleSearchMatchRank('5등분의 신부 ∫∫', '5등분의 신부 ∬'), 3);
  assert.equal(titleSearchMatchRank('오! 나의 여신님', ''), 0);
});
