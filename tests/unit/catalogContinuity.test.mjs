import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCatalogContinuity } from '../../scripts/catalog-release-guard.mjs';
const a = 'anime:06115e96-7efa-404b-8233-6f92c8238818';
const b = 'anime:e8700a7d-79bb-4bed-ab38-0ee029e12c10';
const c = 'anime:453d8b17-2843-4795-b985-06f148de2edb';
const baseline = { releaseId: 'old', animeIds: [a, b] };
const candidate = ids => ({ releaseId: 'new', releaseHash: 'a'.repeat(64), targetCount: ids.length, entries: ids.map(animeId => ({ animeId })) });
test('catalog continuity catches lost seasons even when replacement keeps total count', () => {
  assert.deepEqual(checkCatalogContinuity(baseline, candidate([a, c])).missingIds, [b]);
  assert.equal(checkCatalogContinuity(baseline, candidate([a, b, c])).ok, true);
  assert.equal(checkCatalogContinuity(baseline, candidate([a, b, c])).addedCount, 1);
});
test('catalog continuity rejects duplicate, invalid and count-mismatched manifests', () => {
  assert.throws(() => checkCatalogContinuity(baseline, candidate([a, a])), /IDENTITY_INVALID/);
  assert.throws(() => checkCatalogContinuity(baseline, candidate(['123'])), /IDENTITY_INVALID/);
  assert.throws(() => checkCatalogContinuity(baseline, { ...candidate([a]), targetCount: 2 }), /MANIFEST_INVALID/);
});
