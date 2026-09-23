import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { loadSourceRegistry } from '../../tools/catalog-lab/contracts/catalogContracts.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { createCatalogArtifactStore } from '../../tools/catalog-lab/pipeline/artifact-store.mjs';
import { importAniLifeBrowserCaptures } from '../../tools/catalog-lab/pipeline/browser-capture-import.mjs';
import { approvedImageLocation } from '../../tools/catalog-lab/capture/anilife-detail-browser.mjs';
import { runInAppAniLifeCapture } from '../../tools/catalog-lab/capture/anilife-in-app-browser.mjs';
import { webpBytes } from './fixtures/cover-valid-images.mjs';

const profile = 'increment-2026-09';
const capturedAt = '2026-09-03T00:00:00.000Z';
const target = Object.freeze({
  targetKey: 'ANILIFE:1036',
  moemoaAnimeId: 'anime:00000000-0000-4000-8000-000000001036',
  seedSource: 'reviewed_increment',
  seedExternalIds: Object.freeze([{ sourceId: 'anilife_public', value: '1036' }]),
  seedTitles: Object.freeze([{ locale: 'ko', value: '상세 수집 테스트' }]),
  incrementEvidence: Object.freeze({
    sourceId: 'anilife_public',
    contentId: '1036',
    sourceHash: 'a'.repeat(64),
    capturedAt,
    format: 'TV',
    episodeLabel: '12화',
    genres: Object.freeze(['로맨스']),
    year: 2026,
    publicPageUrl: 'https://anilife01.tv/content/1036',
    reviewedAt: capturedAt,
    reviewedBy: 'catalog-reviewer',
  }),
  seedReleaseYear: 2026,
  seedEpisodeCount: 12,
  identityState: 'SOURCE_REVIEWED',
  targetStatus: 'ACTIVE',
  createdAt: capturedAt,
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('AniLife detail script accepts only target-bound reviewed cover path variants', () => {
  const sourceConfig = {
    coverOrigins: ['https://anilife1.tv', 'https://anilife01.tv'],
  };
  assert.equal(approvedImageLocation('https://anilife1.tv/images/anime/1036.poster.webp', {
    sourceConfig, contentId: '1036',
  }).extension, 'webp');
  assert.equal(approvedImageLocation('https://anilife01.tv/posters/1036-lv999-official-20260814.jpg', {
    sourceConfig, contentId: '1036',
  }).extension, 'jpg');
  assert.throws(() => approvedImageLocation('https://anilife01.tv/posters/9999-vertical.jpg', {
    sourceConfig, contentId: '1036',
  }), { code: 'CAPTURE_IMAGE_IDENTITY_MISMATCH' });
  assert.throws(() => approvedImageLocation('https://example.com/posters/1036-vertical.jpg', {
    sourceConfig, contentId: '1036',
  }), { code: 'CAPTURE_IMAGE_IDENTITY_MISMATCH' });
});

test('in-app browser collector refuses a workspace without the TEST_ONLY sentinel', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-in-app-capture-unsafe-'));
  try {
    await assert.rejects(runInAppAniLifeCapture({
      tab: { goto() {}, playwright: { evaluate() {} } },
      workspaceRoot,
      profile,
      manifest: [target],
      sourceConfig: {
        sourceId: 'anilife_public', status: 'approved', baseUrl: 'https://anilife01.tv',
        coverOrigins: ['https://anilife1.tv', 'https://anilife01.tv'],
      },
    }), { code: 'CATALOG_WORKSPACE_REQUIRED' });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

async function writeCapture(workspace) {
  const imageFile = 'images/1036.webp';
  const entry = {
    schemaVersion: 1,
    profile,
    targetKey: target.targetKey,
    moemoaAnimeId: target.moemoaAnimeId,
    contentId: '1036',
    pageUrl: 'https://anilife01.tv/content/1036',
    capturedAt,
    captureMethod: 'IAB_PUBLIC_RENDERED_PAGE_MINIMAL',
    rawJsonLd: [JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      name: '상세 수집 테스트',
      url: 'https://anilife01.tv/content/1036',
      image: 'https://anilife1.tv/posters/1036-lv999-official-20260814.jpg',
      datePublished: '2026',
      numberOfEpisodes: 12,
    })],
    badges: ['완결', 'TV'],
    heading: '상세 수집 테스트',
    pageTitle: '상세 수집 테스트 - AniLife',
    imageSourceUrl: 'https://anilife1.tv/posters/1036-lv999-official-20260814.jpg',
    imageFetchedUrl: 'https://anilife01.tv/posters/1036-lv999-official-20260814.jpg',
    imageFile,
    imageMime: 'image/jpeg',
    imageByteSize: webpBytes.byteLength,
    imageSha256: sha256(webpBytes),
  };
  entry.captureSha256 = sha256(Buffer.from(JSON.stringify(entry), 'utf8'));
  await mkdir(workspace.resolve('imports', 'anilife-detail-browser', profile, 'entries'), { recursive: true });
  await mkdir(workspace.resolve('imports', 'anilife-detail-browser', profile, 'images'), { recursive: true });
  await writeFile(workspace.resolve('imports', 'anilife-detail-browser', profile, 'entries', '1036.json'),
    `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  await writeFile(workspace.resolve('imports', 'anilife-detail-browser', profile, 'images', '1036.webp'), webpBytes);
}

test('reviewed AniLife browser captures import offline and rerun idempotently', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-browser-capture-import-'));
  try {
    const repoRoot = process.cwd();
    const workspace = await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true });
    const registry = await loadSourceRegistry({ repoRoot });
    const bindings = { 'ANILIFE:1036': { contentId: '1036', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } };
    await writeCapture(workspace);

    let decodeCalls = 0;
    const input = {
      workspace, profile, targets: [target], registry, bindings,
      decodeCover: async () => { decodeCalls += 1; },
    };
    const first = await importAniLifeBrowserCaptures(input);
    assert.deepEqual(first.counts, {
      targets: 1, canonical: 1, covers: 1, completed: 1, pendingReview: 0,
    });
    assert.deepEqual(first.errors, {});
    assert.equal(first.growth.sourceRecords, 1);
    assert.equal(first.growth.canonicalRevisions, 1);
    assert.equal(first.growth.images, 1);
    assert.equal(first.growth.serviceProjections, 1);
    assert.equal(decodeCalls, 1);

    const store = createCatalogArtifactStore({ workspace });
    const projection = await store.readServiceProjection(target);
    const cover = await store.writeCoverObservation(target);
    assert.equal(projection.preferredTitle.value, '상세 수집 테스트');
    assert.equal(projection.fieldTiers.required.cover, 'VALUE');
    assert.match(cover.localRef, /^images\/covers\//u);
    assert.equal(cover.status, 'STORED');
    assert.equal(cover.sourceId, 'anilife_public');

    const second = await importAniLifeBrowserCaptures(input);
    assert.equal(second.counts.completed, 1);
    assert.deepEqual(second.growth, {
      sourceRecords: 0, claims: 0, canonicalRevisions: 0, images: 0, serviceProjections: 0,
    });
    assert.equal(decodeCalls, 1);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test('browser capture import quarantines metadata whose checksum no longer matches', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'moemoa-browser-capture-tamper-'));
  try {
    const repoRoot = process.cwd();
    const workspace = await openCatalogWorkspace({ repoRoot, workspaceRoot, create: true });
    const registry = await loadSourceRegistry({ repoRoot });
    const bindings = { 'ANILIFE:1036': { contentId: '1036', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } };
    await writeCapture(workspace);
    const entryPath = workspace.resolve(
      'imports', 'anilife-detail-browser', profile, 'entries', '1036.json',
    );
    const tampered = JSON.parse(await readFile(entryPath, 'utf8'));
    tampered.badges = ['방영중', 'TV'];
    await writeFile(entryPath, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8');

    const summary = await importAniLifeBrowserCaptures({
      workspace, profile, targets: [target], registry, bindings, decodeCover: async () => {},
    });
    assert.equal(summary.counts.completed, 0);
    assert.equal(summary.counts.pendingReview, 1);
    assert.deepEqual(summary.errors, { CAPTURE_ENTRY_INTEGRITY_INVALID: 1 });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});
