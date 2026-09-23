import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyReviewedAliases } from '../../src/domain/search/applyReviewedAliases.js';
import { createLegacyAliasTitleResolver } from '../../src/features/memory/adapters/catalog/legacyAliasTitleResolver.js';

const source = JSON.parse(await readFile(new URL('../../src/data/aliases.json', import.meta.url)));
const reviews = JSON.parse(await readFile(new URL('../../src/data/reviewed-alias-overrides.json', import.meta.url)));

test('actual reviewed roster fixes first-season titles without altering source identities', async () => {
  const before = structuredClone(source);
  const rows = applyReviewedAliases(source, reviews);
  assert.equal(rows.length, source.length);
  assert.deepEqual(rows.map(row => row.anilistId), source.map(row => row.anilistId));
  assert.equal(rows.find(row => row.anilistId === 103572).ko, '5등분의 신부');
  assert.equal(rows.find(row => row.anilistId === 20755).ko, '암살교실 1기');
  const resolver = createLegacyAliasTitleResolver({ rows });
  const first = await resolver.search('5등분');
  assert.equal(first.find(row => row.sourceBinding.externalId === '103572').displayTitle, '5등분의 신부');
  assert.equal((await resolver.search('5등분의 신부 ∬')).some(row => row.sourceBinding.externalId === '103572'), false);
  assert.equal((await resolver.search('Nisekoi:')).some(row => row.sourceBinding.externalId === '18897'), false);
  assert.equal((await resolver.search('Overlord III')).some(row => row.sourceBinding.externalId === '98437'), false);
  assert.deepEqual(source, before);
});

test('stale reviewed rows are withheld while untouched rows remain available', () => {
  const rows = structuredClone(source);
  rows.find(row => row.anilistId === 103572).aliases.push('unexpected new alias');
  const result = applyReviewedAliases(rows, reviews);
  assert.ok(!result.some(row => row.anilistId === 103572));
  assert.ok(result.some(row => row.anilistId === 1));
});

test('a pending Korean title uses its precise original title without claiming full verification', async () => {
  const rows = applyReviewedAliases(source, reviews);
  assert.equal(rows.find(row => row.anilistId === 21569).ko, null);
  const result = await createLegacyAliasTitleResolver({ rows }).search('Alice in Deadly School');
  const item = result.find(row => row.sourceBinding.externalId === '21569');
  assert.equal(item.displayTitle, 'Alice in Deadly School');
  assert.equal(item.verificationState, 'LEGACY_UNVERIFIED');
});
