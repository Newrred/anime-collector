import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildReviewedAliasOverrides } from '../../tools/catalog-lab/reports/export-reviewed-aliases.mjs';

const rows = JSON.parse(await readFile(new URL('../../src/data/aliases.json', import.meta.url)));
const reviews = JSON.parse(await readFile(new URL('../../tools/catalog-lab/config/title-identity-reviews.json', import.meta.url))).records;

test('shipped runtime corrections match the reviewed evidence and omit audit internals', async () => {
  const generated = buildReviewedAliasOverrides(rows, reviews);
  const shipped = JSON.parse(await readFile(new URL('../../src/data/reviewed-alias-overrides.json', import.meta.url)));
  assert.deepEqual(shipped, generated);
  assert.equal(shipped.length, 35);
  assert.equal(shipped.some(row => row.anilistId === 3514), false);
  assert.doesNotMatch(JSON.stringify(shipped), /canonicalPath|expectedCanonicalHash|reviewedBy|webReferences/);
});

test('runtime export rejects modified seed aliases instead of blessing stale decisions', () => {
  const changed = structuredClone(rows);
  changed.find(row => row.anilistId === 103572).aliases.push('unreviewed');
  assert.throws(() => buildReviewedAliasOverrides(changed, reviews), /Stale reviewed seed 103572/);
});

test('legacy export ignores catalog additions but rejects loss of a required legacy seed', () => {
  assert.ok(reviews.some(row => row.targetKey === 'ANILIST:20876'));
  assert.equal(buildReviewedAliasOverrides(rows, reviews).some(row => row.anilistId === 20876), false);
  assert.throws(() => buildReviewedAliasOverrides(rows.filter(row => row.anilistId !== 103572), reviews), /Missing reviewed seed 103572/);
});
