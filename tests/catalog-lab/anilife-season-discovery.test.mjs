import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  approveAniLifeNewCandidates, buildAniLifeSeasonDiff, validateAniLifeSeasonCapture, validateIncrementReview,
  writeAniLifeSeasonDiscovery,
} from '../../tools/catalog-lab/discovery/anilife-season.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { buildFieldClaims } from '../../tools/catalog-lab/pipeline/claims.mjs';
import { materializeIncrementProfile } from '../../tools/catalog-lab/pipeline/increment-seed.mjs';
import {
  buildIncrementalTargetManifest, incrementManifestMatchesReview,
} from '../../tools/catalog-lab/pipeline/targets.mjs';

const capturedAt = '2026-09-02T23:45:50.892Z';
const reviewedAt = '2026-09-03T01:00:00.000Z';
const profile = 'increment-2026-09';

function item(contentId, koTitle) {
  return {
    contentId,
    koTitle,
    format: 'TV',
    episodeLabel: '12화',
    genres: ['판타지'],
    year: 2026,
    publicPageUrl: `https://anilife01.tv/content/${contentId}`,
  };
}

function capture() {
  return {
    schemaVersion: 1,
    sourceId: 'anilife_public',
    sourceUrl: 'https://anilife01.tv/season/2026',
    year: 2026,
    capturedAt,
    declaredTotal: 3,
    pageCount: 1,
    items: [
      item('701', '기존 작품'),
      item('702', '기존작품!'),
      item('703', '완전 신규 작품'),
    ],
  };
}

const aliases = [
  { anilistId: 10, ko: '기존 작품', aliases: [] },
];

test('season capture is strict and the diff never auto-approves title matches', () => {
  assert.equal(validateAniLifeSeasonCapture(capture()).items.length, 3);
  const diff = buildAniLifeSeasonDiff({
    capture: capture(), aliases,
    bindings: { 'ANILIST:10': { contentId: '701', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } },
  });
  assert.deepEqual(diff.candidates.map((row) => row.discoveryState), [
    'EXISTING_BOUND', 'POSSIBLE_EXISTING_TITLE_VARIANT', 'NEW_CANDIDATE',
  ]);
  assert.deepEqual(diff.candidates.map((row) => row.decision), [
    'CONFIRMED_EXISTING', 'PENDING_REVIEW', 'PENDING_REVIEW',
  ]);
  const poisoned = capture();
  poisoned.items[0].publicPageUrl = 'https://example.com/content/701';
  assert.throws(() => validateAniLifeSeasonCapture(poisoned), {
    code: 'ANILIFE_SEASON_CAPTURE_INVALID',
  });
});

test('season evidence keeps its captured origin while new imports must match the reviewed registry origin', () => {
  const rotated = capture();
  rotated.sourceUrl = 'https://anilife-next.example/season/2026';
  rotated.items = rotated.items.map((row) => ({
    ...row, publicPageUrl: `https://anilife-next.example/content/${row.contentId}`,
  }));

  assert.equal(validateAniLifeSeasonCapture(rotated).sourceUrl, rotated.sourceUrl);
  assert.equal(validateAniLifeSeasonCapture(rotated, {
    sourceConfig: { sourceId: 'anilife_public', baseUrl: 'https://anilife-next.example' },
  }).items.length, 3);
  assert.throws(() => validateAniLifeSeasonCapture(rotated, {
    sourceConfig: { sourceId: 'anilife_public', baseUrl: 'https://anilife01.tv' },
  }), { code: 'ANILIFE_SEASON_CAPTURE_INVALID' });
});

test('discovery evidence is content-addressed and preserves an unchanged manual decision', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-season-discovery-'));
  try {
    const workspace = await openCatalogWorkspace({ repoRoot: process.cwd(), workspaceRoot, create: true });
    const first = await writeAniLifeSeasonDiscovery({
      workspace, capture: capture(), aliases, profile, asOfDate: '2026-09-03',
    });
    const review = JSON.parse(await readFile(first.reviewPath, 'utf8'));
    const candidate = review.rows.find((row) => row.contentId === '703');
    Object.assign(candidate, {
      decision: 'APPROVED_NEW', anilistId: '999001', aliases: ['New Work'],
      reviewedAt, reviewedBy: 'catalog-reviewer',
    });
    await writeFile(first.reviewPath, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
    const second = await writeAniLifeSeasonDiscovery({
      workspace, capture: capture(), aliases, profile, asOfDate: '2026-09-03',
    });
    const preserved = second.review.rows.find((row) => row.contentId === '703');
    assert.equal(second.diff.contentHash, first.diff.contentHash);
    assert.equal(preserved.decision, 'APPROVED_NEW');
    assert.equal(preserved.anilistId, '999001');
    assert.deepEqual(preserved.aliases, ['New Work']);
    const changedCapture = capture();
    changedCapture.items[2].episodeLabel = '13화';
    const changed = await writeAniLifeSeasonDiscovery({
      workspace, capture: changedCapture, aliases, profile, asOfDate: '2026-09-03',
    });
    const reset = changed.review.rows.find((row) => row.contentId === '703');
    assert.equal(reset.decision, 'PENDING_REVIEW');
    assert.equal(reset.anilistId, null);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('only reviewed new rows become stable increment targets and seed claims', () => {
  const diff = buildAniLifeSeasonDiff({ capture: capture(), aliases });
  const review = {
    schemaVersion: 1,
    profile,
    sourceId: 'anilife_public',
    sourceHash: diff.contentHash,
    year: 2026,
    asOfDate: '2026-09-03',
    capturedAt,
    summary: diff.counts,
    rows: diff.candidates.map((candidate) => ({
      contentId: candidate.contentId,
      ko: candidate.koTitle,
      format: candidate.format,
      episodeLabel: candidate.episodeLabel,
      genres: [...candidate.genres],
      year: candidate.year,
      publicPageUrl: candidate.publicPageUrl,
      discoveryState: candidate.discoveryState,
      suggestedAniListIds: [...candidate.suggestedAniListIds],
      decision: candidate.contentId === '703' ? 'APPROVED_NEW' : 'PENDING_REVIEW',
      anilistId: candidate.contentId === '703' ? '999001' : null,
      aliases: candidate.contentId === '703' ? ['New Work'] : [],
      reviewedAt: candidate.contentId === '703' ? reviewedAt : null,
      reviewedBy: candidate.contentId === '703' ? 'catalog-reviewer' : null,
    })),
  };
  validateIncrementReview(review, { profile });
  const idMap = {};
  const manifest = buildIncrementalTargetManifest({
    profile, review, discovery: diff, existingRows: aliases, idMapStore: idMap,
    uuid: () => '00000000-0000-4000-8000-000000999001',
  });
  assert.equal(manifest.length, 1);
  assert.equal(manifest[0].targetKey, 'ANILIST:999001');
  assert.equal(manifest[0].incrementEvidence.contentId, '703');
  assert.equal(incrementManifestMatchesReview({ profile, review, manifest, idMap }), true);
  const claims = buildFieldClaims({ target: manifest[0], normalizedRecords: [] });
  assert.equal(claims.length, 5);
  assert.equal(claims.every((claim) => claim.sourceId === 'reviewed_increment'), true);
  assert.equal(claims.every((claim) => claim.reviewedBy === 'catalog-reviewer'), true);
  assert.equal(claims.find((claim) => claim.fieldPath === 'titles').normalizedValue.value, '완전 신규 작품');
  assert.throws(() => buildIncrementalTargetManifest({
    profile, review: { ...review, rows: review.rows.map((row) => (
      row.contentId === '703' ? { ...row, anilistId: '10' } : row
    )) }, discovery: diff, existingRows: aliases, idMapStore: {}, uuid: () => 'duplicate',
  }), { code: 'INCREMENT_TARGET_INVALID' });
});

test('source-reviewed new rows can be approved and targeted without AniList ids', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-season-optional-id-'));
  try {
    const workspace = await openCatalogWorkspace({ repoRoot: process.cwd(), workspaceRoot, create: true });
    const written = await writeAniLifeSeasonDiscovery({
      workspace, capture: capture(), aliases, profile, asOfDate: '2026-09-03',
    });
    const approval = await approveAniLifeNewCandidates({
      workspace, profile, reviewedBy: 'local-reviewer', clock: { now: () => reviewedAt },
    });
    assert.equal(approval.approvedCount, 1);
    const idMap = {};
    const manifest = buildIncrementalTargetManifest({
      profile, review: approval.review, discovery: written.diff, existingRows: aliases,
      idMapStore: idMap, uuid: () => '00000000-0000-4000-8000-000000000703',
    });
    assert.equal(manifest[0].targetKey, 'ANILIFE:703');
    assert.equal(manifest[0].identityState, 'SOURCE_REVIEWED');
    assert.deepEqual(manifest[0].seedExternalIds, [
      { sourceId: 'anilife_public', value: '703' },
    ]);
    assert.equal(incrementManifestMatchesReview({
      profile, review: approval.review, manifest, idMap,
    }), true);
    const seeded = await materializeIncrementProfile({ workspace, profile, targets: manifest });
    assert.equal(seeded.counts.targets, 1);
    assert.equal(seeded.counts.claims > 0, true);
    assert.equal(seeded.growth.claims, seeded.counts.claims);
    assert.equal(seeded.targets[0].targetKey, 'ANILIFE:703');
    const projection = JSON.parse(await readFile(workspace.resolve(
      'service-projections', 'anime-00000000-0000-4000-8000-000000000703.json',
    ), 'utf8'));
    assert.equal(projection.preferredTitle.value, '완전 신규 작품');
    assert.equal(projection.animeId, manifest[0].moemoaAnimeId);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
