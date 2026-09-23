import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditRecord, duplicateExternalIds, identityTitleKey, seasonSignals, runIdentityAudit, buildReviewQueue } from '../../tools/catalog-lab/reports/identity-audit.mjs';
import { sha256 } from '../../tools/catalog-lab/lib/hash.mjs';

const animeId = 'anime:11111111-1111-4111-8111-111111111111';
const field = (value) => ({ state: 'VALUE', value });
function fixture() {
  const target = { targetKey: 'ANILIST:103572', moemoaAnimeId: animeId, seedSource: 'legacy_aliases', seedExternalIds: [{ sourceId: 'anilist', value: '103572' }], seedTitles: [{ locale: 'ko', value: '5등분의 신부 ∬' }, { locale: 'und', value: 'Go-toubun no Hanayome ∬' }] };
  const canonical = { id: animeId, externalIds: field([{ sourceId: 'anilist', value: '103572' }]), titles: field([{ locale: 'en', value: 'The Quintessential Quintuplets' }, { locale: 'ja-Latn', value: 'Go-toubun no Hanayome' }]), format: field('TV'), relations: field([{ targetId: 'anilist:109261', type: 'SEQUEL', title: 'Go-toubun no Hanayome ∫∫', format: 'TV' }]) };
  canonical.revision = { algorithm: 'SHA-256', contentHash: sha256(canonical) };
  const projection = { animeId, canonicalHash: canonical.revision.contentHash, preferredTitle: target.seedTitles[0] };
  return { target, canonical, projection };
}

test('season symbols survive identity normalization, including NFKC double-integral expansion', () => {
  assert.notEqual(identityTitleKey('花嫁'), identityTitleKey('花嫁 ∬'));
  assert.equal(identityTitleKey('花嫁 ∬'), identityTitleKey('花嫁 ∫∫'));
  assert.deepEqual(seasonSignals('5등분의 신부 ∬'), ['symbol:double-integral']);
  assert.deepEqual(seasonSignals('제2기 Season 2 Part 3'), ['part:3', 'season:2']);
});
test('mixed first-season ID and sequel aliases produce separate evidence-backed findings', () => {
  const result = auditRecord(fixture());
  assert.ok(result.some((row) => row.code === 'SEED_TITLE_MATCHES_RELATED_WORK' && row.evidence.matches[0].targetId === 'anilist:109261'));
  assert.ok(result.some((row) => row.code === 'PREFERRED_SEASON_SIGNAL_MATCHES_RELATED_WORK'));
});
test('adaptation IDs are never treated as another anime season', () => {
  const input = fixture(); input.canonical.relations.value[0].type = 'ADAPTATION';
  assert.ok(!auditRecord(input).some((row) => row.code === 'SEED_TITLE_MATCHES_RELATED_WORK'));
});
test('same official primary title across related works is not sufficient to infer contamination', () => {
  const input = fixture(); input.canonical.titles.value.push({ locale: 'ja-Latn', value: 'Go-toubun no Hanayome ∬' });
  assert.ok(!auditRecord(input).some((row) => ['SEED_TITLE_MATCHES_RELATED_WORK', 'PREFERRED_SEASON_SIGNAL_MATCHES_RELATED_WORK'].includes(row.code)));
});
test('film marker, cover ID, and seed ID mismatch are independent findings', () => {
  const input = fixture(); input.projection.preferredTitle.value = '극장판 예시'; input.canonical.cover = field({ sourceUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx109261-abc.jpg' });
  input.target.seedExternalIds[0].value = '99';
  const codes = auditRecord(input).map((row) => row.code);
  for (const code of ['PREFERRED_MOVIE_LABEL_FORMAT_MISMATCH', 'ANILIST_COVER_ID_MISMATCH', 'SEED_CANONICAL_ID_MISMATCH']) assert.ok(codes.includes(code));
});
test('provider IDs shared by two records are reported without treating different providers as duplicates', () => {
  assert.deepEqual(duplicateExternalIds([{ animeId: 'a', externalIds: [{ sourceId: 'anilist', value: '1' }, { sourceId: 'mal', value: '1' }] }, { animeId: 'b', externalIds: [{ sourceId: 'anilist', value: '1' }] }]), [{ externalId: 'anilist:1', animeIds: ['a', 'b'] }]);
});
test('missing relation evidence stays a coverage gap, not a clean identity result', () => {
  const input = fixture(); input.canonical.relations = { state: 'NOT_FETCHED' };
  assert.ok(auditRecord(input).some((row) => row.code === 'RELATION_EVIDENCE_UNAVAILABLE' && row.severity === 'COVERAGE'));
});

test('review queue retains clean rows as unverified and binds decisions to the inspected revision', () => {
  const records = [
    { animeId: 'a', targetKey: 'A', canonicalHash: 'old', findings: [] },
    { animeId: 'b', targetKey: 'B', canonicalHash: 'other', findings: [{ code: 'SEED_TITLE_MATCHES_RELATED_WORK', severity: 'REVIEW' }] },
    { animeId: 'c', targetKey: 'C', findings: [{ code: 'READ_OR_INTEGRITY_FAILURE', severity: 'BLOCKER' }] },
  ];
  const queue = buildReviewQueue(records);
  assert.deepEqual(queue.map((row) => row.animeId), ['c', 'b', 'a']);
  assert.ok(queue.every((row) => row.status === 'PENDING_EVIDENCE_REVIEW' && !row.evidenceReferences.length));
  assert.equal(queue[2].expectedCanonicalHash, 'old');
  assert.ok(queue[2].requiredChecks.includes('KOREAN_TITLE_AND_ALIASES'));
  assert.equal(queue[0].expectedCanonicalHash, null);
});
test('full audit exposes tampered canonical data and preserves source pointer', async () => {
  const base = await mkdtemp(join(tmpdir(), 'moemoa-identity-audit-'));
  const workspaceRoot = join(base, 'workspace'); const repoRoot = join(base, 'repo'); const outputRoot = join(base, 'report');
  await mkdir(repoRoot); await mkdir(join(workspaceRoot, 'manifests'), { recursive: true });
  await mkdir(join(workspaceRoot, 'current')); await mkdir(join(workspaceRoot, 'canonical', animeId.replace(':', '-')), { recursive: true });
  await writeFile(join(workspaceRoot, 'TEST_ONLY.json'), JSON.stringify({ kind: 'MOEMOA_CATALOG_LAB', schemaVersion: 1 }));
  const input = fixture(); const pointer = JSON.stringify({ animeId, contentHash: input.canonical.revision.contentHash });
  await writeFile(join(workspaceRoot, 'manifests', 'full3998.json'), JSON.stringify([input.target]));
  const pointerPath = join(workspaceRoot, 'current', animeId.replace(':', '-') + '.json');
  await writeFile(pointerPath, pointer);
  input.canonical.format.value = 'MOVIE';
  await writeFile(join(workspaceRoot, 'canonical', animeId.replace(':', '-'), input.canonical.revision.contentHash + '.json'), JSON.stringify(input.canonical));
  const summary = await runIdentityAudit({ repoRoot, workspaceRoot, outputRoot });
  assert.equal(summary.blockerRecords, 1); assert.equal(summary.integrityVerified, 0);
  assert.equal(summary.counts.READ_OR_INTEGRITY_FAILURE, 1);
  assert.equal(await readFile(pointerPath, 'utf8'), pointer);
});
