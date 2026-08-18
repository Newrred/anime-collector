import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { pngBytes } from './fixtures/cover-valid-images.mjs';
import { sha256 } from '../../tools/catalog-lab/lib/hash.mjs';
import { toPathKey } from '../../tools/catalog-lab/lib/path-key.mjs';
import { openCatalogWorkspace } from '../../tools/catalog-lab/lib/workspace.mjs';
import { createCatalogArtifactStore } from '../../tools/catalog-lab/pipeline/artifact-store.mjs';
import {
  createDevelopmentCatalogReadModel,
} from '../../tools/dev-catalog/read-model.mjs';
import {
  createDevelopmentCatalogMiddleware,
} from '../../tools/dev-catalog/astro-integration.mjs';

const repoRoot = join(import.meta.dirname, '..', '..');
const target = Object.freeze({
  targetKey: 'ANILIST:154587',
  moemoaAnimeId: 'anime:11111111-1111-4111-8111-111111111111',
  seedSource: 'legacy_aliases',
  seedTitles: Object.freeze([{ locale: 'ko', value: '장송의 프리렌' }]),
});

function projection(overrides = {}) {
  const core = {
    schemaVersion: 1,
    policyVersion: 'SERVICE_PROJECTION_V2_AUTOMATED_REVIEW',
    semanticAutomationPolicyVersion: 'SEMANTIC_AUTOMATION_V1',
    targetKey: target.targetKey,
    animeId: target.moemoaAnimeId,
    canonicalHash: 'a'.repeat(64),
    preferredTitle: { locale: 'ko', value: '장송의 프리렌' },
    searchTitles: [
      { locale: 'ko', value: '장송의 프리렌' },
      { locale: 'en', value: "Frieren: Beyond Journey's End" },
    ],
    autoAcceptedTitleAliases: [],
    quarantinedTitles: [],
    officialLinks: [],
    primaryOfficialSiteUrl: null,
    fieldTiers: { required: {}, recommended: {}, optional: {} },
    reviewItems: [],
    qualityWarnings: [],
    readiness: { status: 'READY_WITH_GAPS', requiredBlockers: [], recommendedGaps: [], optionalGaps: [] },
    ...overrides,
  };
  return { ...core, projectionHash: sha256(core) };
}

async function withWorkspace(callback) {
  const root = await mkdtemp(join(tmpdir(), 'moemoa-dev-catalog-'));
  try {
    const workspace = await openCatalogWorkspace({ repoRoot, workspaceRoot: root, create: true });
    const store = createCatalogArtifactStore({ workspace });
    await store.writeManifest('full3998', [target]);
    await store.writeServiceProjection(target, projection());
    const checksum = createHash('sha256').update(pngBytes).digest('hex');
    const localRef = `images/covers/${toPathKey(target.moemoaAnimeId)}/${checksum}.png`;
    const imagePath = workspace.resolve(...localRef.split('/'));
    await mkdir(dirname(imagePath), { recursive: true });
    await writeFile(imagePath, pngBytes);
    await store.writeCoverObservation(target, {
      status: 'STORED', sourceId: 'anilist', sourceRecordId: 'b'.repeat(64), checksum,
      byteSize: pngBytes.byteLength, width: 1, height: 1, localRef, created: true,
    });
    await callback({ workspace, store, root, checksum });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('development read model projects only safe searchable catalog data and validated cover bytes', async () => {
  await withWorkspace(async ({ workspace }) => {
    const reader = createDevelopmentCatalogReadModel({ workspace, refreshTtlMs: 0 });
    const results = await reader.search('프리렌', { limit: 8 });

    assert.deepEqual(results, [{
      kind: 'ANIME_REF',
      displayTitle: '장송의 프리렌',
      aliases: ["Frieren: Beyond Journey's End"],
      genres: [],
      sourceBinding: { provider: 'ANILIST', externalId: '154587' },
      verificationState: 'PROVIDER_CANDIDATE',
      catalogSource: 'LOCAL_TEST_SERVICE_PROJECTION',
      readiness: 'READY_WITH_GAPS',
      coverPreviewUrl: '/__moemoa-dev/catalog/cover/154587',
    }]);
    assert.doesNotMatch(JSON.stringify(results), /rawPayloadRef|localRef|checksum|https?:|[A-Z]:\\/iu);

    const cover = await reader.readCover('154587');
    assert.equal(cover.mimeType, 'image/png');
    assert.deepEqual(cover.bytes, pngBytes);
  });
});

test('development read model drops a tampered projection and refuses an unsafe cover observation', async () => {
  await withWorkspace(async ({ workspace, store }) => {
    let time = 0;
    const reader = createDevelopmentCatalogReadModel({ workspace, refreshTtlMs: 1, now: () => time });
    assert.equal((await reader.search('프리렌')).length, 1);

    const projectionPath = workspace.resolve('service-projections', 'anime-11111111-1111-4111-8111-111111111111.json');
    const current = JSON.parse(await readFile(projectionPath, 'utf8'));
    await writeFile(projectionPath, JSON.stringify({ ...current, preferredTitle: { locale: 'ko', value: '변조' } }));
    time = 2;
    assert.deepEqual(await reader.search('프리렌'), []);

    await store.writeCoverObservation(target, {
      status: 'STORED', sourceId: 'anilist', sourceRecordId: 'b'.repeat(64), checksum: 'c'.repeat(64),
      byteSize: pngBytes.byteLength, width: 1, height: 1, localRef: '../outside.png', created: true,
    });
    assert.equal(await reader.readCover('154587'), null);
  });
});

function responseHarness() {
  let body = Buffer.alloc(0);
  const headers = new Map();
  return {
    response: {
      statusCode: 200,
      setHeader(name, value) { headers.set(name.toLowerCase(), String(value)); },
      end(value = '') { body = Buffer.from(value); },
    },
    result: () => ({ body, headers, statusCode: this?.response?.statusCode }),
    read(response) { return { body, headers, statusCode: response.statusCode }; },
  };
}

test('development middleware is loopback-only and returns non-disclosing JSON', async () => {
  const reader = {
    search: async () => [{
      kind: 'ANIME_REF', displayTitle: '장송의 프리렌', aliases: [], genres: [],
      sourceBinding: { provider: 'ANILIST', externalId: '154587' },
      verificationState: 'PROVIDER_CANDIDATE', catalogSource: 'LOCAL_TEST_SERVICE_PROJECTION',
      readiness: 'READY', coverPreviewUrl: null,
    }],
    readCover: async () => null,
  };
  const middleware = createDevelopmentCatalogMiddleware({ reader });

  const denied = responseHarness();
  await middleware({ method: 'GET', url: '/__moemoa-dev/catalog/search?q=test', headers: { host: 'localhost:4321' }, socket: { remoteAddress: '192.168.1.4' } }, denied.response, () => {});
  assert.equal(denied.read(denied.response).statusCode, 403);

  const allowed = responseHarness();
  await middleware({ method: 'GET', url: '/__moemoa-dev/catalog/search?q=%ED%94%84%EB%A6%AC%EB%A0%8C', headers: { host: '127.0.0.1:4321' }, socket: { remoteAddress: '127.0.0.1' } }, allowed.response, () => {});
  const output = allowed.read(allowed.response);
  assert.equal(output.statusCode, 200);
  assert.equal(output.headers.get('cache-control'), 'no-store');
  assert.equal(JSON.parse(output.body).results.length, 1);
  assert.doesNotMatch(output.body.toString('utf8'), /rawPayloadRef|localRef|checksum|[A-Z]:\\/iu);
});
