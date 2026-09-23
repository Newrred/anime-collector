import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';

import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';
import { createAniLifeReviewedCaptureEnvelope } from '../sources/anilife-public-page-test.mjs';
import { createCatalogArtifactStore } from './artifact-store.mjs';
import { buildCanonicalRevision } from './canonical.mjs';
import { buildFieldClaims } from './claims.mjs';
import {
  createChromiumLifecycleTestHarness,
  createCoverStorageTestHarness,
  createPinnedCoverTransport,
  downloadCoverCandidate,
  getApprovedCoverSourcePolicy,
  inspectImageBytes,
} from './covers.mjs';
import { resolveIdentity } from './identity.mjs';
import { normalizeSourceRecord } from './normalize.mjs';
import { storeSourceEnvelope } from './raw-store.mjs';
import { buildServiceProjection } from './service-projection.mjs';
import { createStateStore } from './state-store.mjs';
import { isIncrementProfile } from './targets.mjs';

const CAPTURE_METHOD = 'IAB_PUBLIC_RENDERED_PAGE_MINIMAL';
const HASH = /^[a-f0-9]{64}$/u;
const CONTENT_ID = /^[1-9]\d*$/u;
const SAFE_IMAGE_MIMES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

function typedError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function errorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]+$/u.test(error.code)
    ? error.code : 'BROWSER_CAPTURE_IMPORT_FAILED';
}

function frozen(value) {
  return Object.freeze(value);
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function exactImageUrl(value, { sourceConfig, contentId }) {
  try {
    const parsed = new URL(value);
    const match = new RegExp(
      `^(?:/images/anime/${contentId}(?:\\.poster)?\\.(jpg|jpeg|png|webp)|/posters/${contentId}-[a-z0-9_-]{1,128}\\.(jpg|jpeg|png|webp))$`,
      'iu',
    ).exec(parsed.pathname);
    if (!match || parsed.protocol !== 'https:' || parsed.username || parsed.password
      || parsed.search || parsed.hash || !sourceConfig.coverOrigins.includes(parsed.origin)) {
      throw new TypeError('invalid image URL');
    }
    return frozen({
      url: parsed.href, pathname: parsed.pathname, extension: (match[1] ?? match[2]).toLowerCase(),
    });
  } catch {
    throw typedError('CAPTURE_IMAGE_IDENTITY_MISMATCH', 'Captured cover URL is not an approved exact work asset');
  }
}

async function regularFile(path, code) {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new TypeError('not a regular file');
    return info;
  } catch (error) {
    if (error?.code === code) throw error;
    throw typedError(code, 'Browser capture artifact is missing or unsafe');
  }
}

async function readCapture({ workspace, profile, target }) {
  const contentId = target.incrementEvidence?.contentId;
  if (!CONTENT_ID.test(contentId ?? '') || target.targetKey !== `ANILIFE:${contentId}`) {
    throw typedError('CAPTURE_TARGET_INVALID', 'Increment target does not have an exact AniLife identity');
  }
  const entryPath = workspace.resolve(
    'imports', 'anilife-detail-browser', profile, 'entries', `${contentId}.json`,
  );
  await regularFile(entryPath, 'CAPTURE_ENTRY_MISSING');
  let capture;
  try {
    capture = JSON.parse(await readFile(entryPath, 'utf8'));
  } catch {
    throw typedError('CAPTURE_ENTRY_INVALID', 'Browser capture entry is not valid JSON');
  }
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)
    || capture.schemaVersion !== 1 || capture.profile !== profile
    || capture.targetKey !== target.targetKey || capture.moemoaAnimeId !== target.moemoaAnimeId
    || capture.contentId !== contentId || capture.captureMethod !== CAPTURE_METHOD
    || typeof capture.imageFile !== 'string'
    || !new RegExp(`^images/${contentId}\\.(?:jpg|jpeg|png|webp)$`, 'iu').test(capture.imageFile)
    || !HASH.test(capture.imageSha256 ?? '') || !Number.isSafeInteger(capture.imageByteSize)
    || capture.imageByteSize < 1 || typeof capture.imageMime !== 'string'
    || !HASH.test(capture.captureSha256 ?? '')) {
    throw typedError('CAPTURE_ENTRY_INVALID', 'Browser capture entry does not match its approved target');
  }
  const { captureSha256, ...captureContent } = capture;
  if (digest(Buffer.from(JSON.stringify(captureContent), 'utf8')) !== captureSha256) {
    throw typedError('CAPTURE_ENTRY_INTEGRITY_INVALID', 'Browser capture entry metadata does not match its checksum');
  }
  const imagePath = workspace.resolve('imports', 'anilife-detail-browser', profile, ...capture.imageFile.split('/'));
  const imageInfo = await regularFile(imagePath, 'CAPTURE_IMAGE_MISSING');
  const imageBytes = await readFile(imagePath);
  if (imageInfo.size !== capture.imageByteSize || imageBytes.byteLength !== capture.imageByteSize
    || digest(imageBytes) !== capture.imageSha256) {
    throw typedError('CAPTURE_IMAGE_INTEGRITY_INVALID', 'Captured cover bytes do not match immutable metadata');
  }
  return frozen({ capture, imageBytes });
}

function capturedEnvelopeInput(capture) {
  return frozen({
    captureMethod: capture.captureMethod,
    contentId: capture.contentId,
    pageUrl: capture.pageUrl,
    capturedAt: capture.capturedAt,
    rawJsonLd: capture.rawJsonLd,
    badges: capture.badges,
  });
}

function exactReviewedCaptureIdentity({ target, capture, envelope }) {
  const expectedTitle = target.seedTitles?.find((entry) => entry?.locale === 'ko')?.value;
  const actualTitle = envelope.payload?.title;
  const normalize = (value) => typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : null;
  if (!expectedTitle || normalize(actualTitle) !== normalize(expectedTitle)
    || envelope.payload?.imageUrl !== capture.imageSourceUrl) {
    throw typedError('CAPTURE_IDENTITY_MISMATCH', 'Captured page title or cover does not match its reviewed target');
  }
}

function syntheticCaptureTransport({ bytes, mimeType }) {
  return createPinnedCoverTransport({
    resolve: async () => [{ address: '8.8.8.8', family: 4 }],
    request: async ({ url, address }) => ({
      url,
      connectedAddress: address,
      redirected: false,
      status: 200,
      headers: new Headers({ 'content-type': mimeType, 'content-length': String(bytes.byteLength) }),
      body: new Response(bytes).body,
    }),
  });
}

function inspectCapturedImage(bytes) {
  const matches = [];
  for (const declaredMime of SAFE_IMAGE_MIMES) {
    try {
      matches.push(inspectImageBytes({ declaredMime, bytes }));
    } catch {
      // The signature parser accepts at most one of the finite supported MIME types.
    }
  }
  if (matches.length !== 1) {
    throw typedError('CAPTURE_IMAGE_STRUCTURE_INVALID', 'Captured cover is not one unambiguous supported image');
  }
  return matches[0];
}

async function defaultDecode(record) {
  const decoder = createChromiumLifecycleTestHarness({ loadChromium: () => import('@playwright/test') });
  await decoder.run({ record, timeoutMs: 5_000, cleanupTimeoutMs: 250 });
}

async function importCover({
  capture, imageBytes, sourceConfig, target, sourceRecordId, identity, workspace,
  decode = defaultDecode, storage = createCoverStorageTestHarness(),
}) {
  const original = exactImageUrl(capture.imageSourceUrl, { sourceConfig, contentId: capture.contentId });
  const fetched = exactImageUrl(capture.imageFetchedUrl, { sourceConfig, contentId: capture.contentId });
  if (original.pathname !== fetched.pathname) {
    throw typedError('CAPTURE_IMAGE_METADATA_INVALID', 'Captured cover URL and MIME metadata disagree');
  }
  if (!SAFE_IMAGE_MIMES.includes(capture.imageMime)) {
    throw typedError('CAPTURE_IMAGE_METADATA_INVALID', 'Captured cover MIME metadata is unsupported');
  }
  const inspected = inspectCapturedImage(imageBytes);
  if (inspected.byteSize !== capture.imageByteSize) {
    throw typedError('CAPTURE_IMAGE_METADATA_INVALID', 'Captured cover structure disagrees with metadata');
  }
  const candidate = frozen({
    identity,
    sourceId: 'anilife_public',
    sourceUrl: fetched.url,
    sourceRecordId,
    retrievedAt: capture.capturedAt,
  });
  const sniffed = await downloadCoverCandidate({
    candidate,
    policy: getApprovedCoverSourcePolicy('anilife_public', { sourceConfig }),
    transport: syntheticCaptureTransport({ bytes: imageBytes, mimeType: inspected.mimeType }),
  });
  await decode(sniffed);
  const stored = await storage.storeFixture({
    bytes: imageBytes,
    declaredMime: inspected.mimeType,
    workspace,
    animeId: target.moemoaAnimeId,
  });
  return frozen({
    status: 'STORED',
    sourceId: 'anilife_public',
    sourceRecordId,
    checksum: stored.checksum,
    byteSize: stored.byteSize,
    width: inspected.width,
    height: inspected.height,
    localRef: stored.localRef,
    created: stored.created,
  });
}

async function reusableStoredCover({ store, target, sourceRecordId, imageBytes, workspace }) {
  const cover = await store.writeCoverObservation(target);
  if (!cover || cover.status !== 'STORED' || cover.sourceId !== 'anilife_public'
    || cover.sourceRecordId !== sourceRecordId || cover.checksum !== digest(imageBytes)
    || cover.byteSize !== imageBytes.byteLength || !Number.isSafeInteger(cover.width)
    || !Number.isSafeInteger(cover.height) || typeof cover.localRef !== 'string'
    || !/^images\/covers\/[a-z0-9-]+\/[a-f0-9]{64}\.(?:jpg|jpeg|png|webp)$/iu.test(cover.localRef)) return null;
  const storedPath = workspace.resolve(...cover.localRef.split('/'));
  try {
    const storedInfo = await regularFile(storedPath, 'CAPTURE_STORED_COVER_INVALID');
    const storedBytes = await readFile(storedPath);
    if (storedInfo.size !== cover.byteSize || digest(storedBytes) !== cover.checksum) return null;
  } catch {
    return null;
  }
  return frozen({ ...cover, created: false });
}

/** Imports exact reviewed browser captures without making any additional network request. */
export async function importAniLifeBrowserCaptures({
  workspace, profile, targets, registry, bindings, decodeCover, coverStorage,
} = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  if (!isIncrementProfile(profile) || !Array.isArray(targets) || targets.length < 1 || targets.length > 500
    || !Array.isArray(registry) || !bindings || typeof bindings !== 'object') {
    throw typedError('BROWSER_CAPTURE_IMPORT_INPUT_INVALID', 'Browser capture import input is invalid');
  }
  const sourceConfig = registry.find((entry) => entry?.sourceId === 'anilife_public');
  if (!sourceConfig || sourceConfig.status !== 'approved') {
    throw typedError('SOURCE_NOT_REGISTERED', 'Approved AniLife source configuration is required');
  }
  const store = createCatalogArtifactStore({ workspace });
  const stateStore = createStateStore({ workspace });
  const rows = [];
  const growth = { sourceRecords: 0, claims: 0, canonicalRevisions: 0, images: 0, serviceProjections: 0 };
  const errors = {};

  for (const target of targets) {
    let sourceRecordId = null;
    try {
      const { capture, imageBytes } = await readCapture({ workspace, profile, target });
      const binding = bindings[target.targetKey];
      await stateStore.write({ sourceId: 'anilife_public', targetKey: target.targetKey, state: { stage: 'PENDING' } });
      const envelope = createAniLifeReviewedCaptureEnvelope({
        target,
        binding,
        capture: capturedEnvelopeInput(capture),
        sourceConfig,
      });
      exactReviewedCaptureIdentity({ target, capture, envelope });
      const persisted = await storeSourceEnvelope({ workspace, envelope });
      sourceRecordId = persisted.sourceRecordId;
      growth.sourceRecords += Number(persisted.created);
      await stateStore.write({
        sourceId: 'anilife_public', targetKey: target.targetKey,
        state: { stage: 'FETCHED', sourceRecordId },
      });
      const sourceRecord = await store.readSourceRecord({
        sourceId: 'anilife_public', targetKey: target.targetKey, sourceRecordId,
      });
      const normalized = normalizeSourceRecord(sourceRecord);
      await store.writeNormalized(normalized);
      await stateStore.write({
        sourceId: 'anilife_public', targetKey: target.targetKey,
        state: { stage: 'NORMALIZED', sourceRecordId },
      });
      const identity = resolveIdentity({
        target, candidate: normalized, sourceId: 'anilife_public', referenceRecords: [normalized],
      });
      if (identity.status !== 'MATCHED' || !['EXACT_ID', 'EXACT_RULE'].includes(identity.confidenceClass)) {
        throw typedError('IDENTITY_PENDING_REVIEW', 'Browser capture identity is not exact');
      }
      await stateStore.write({
        sourceId: 'anilife_public', targetKey: target.targetKey,
        state: { stage: 'MATCHED', sourceRecordId },
      });
      const normalizedRecords = [normalized];
      const claims = buildFieldClaims({ target, normalizedRecords });
      const canonical = buildCanonicalRevision({
        target, sourceRecords: [sourceRecord], normalizedRecords, fieldClaims: claims,
      });
      const written = await store.writeCanonical({
        target, sourceRecords: [sourceRecord], normalizedRecords, claims, canonical,
      });
      growth.claims += written.claimsCreated;
      growth.canonicalRevisions += Number(written.created);
      await stateStore.write({
        sourceId: 'anilife_public', targetKey: target.targetKey,
        state: { stage: 'CLAIMS_BUILT', sourceRecordId },
      });
      const cover = await reusableStoredCover({
        store, target, sourceRecordId, imageBytes, workspace,
      }) ?? await importCover({
        capture, imageBytes, sourceConfig, target, sourceRecordId, identity, workspace,
        ...(decodeCover ? { decode: decodeCover } : {}),
        ...(coverStorage ? { storage: coverStorage } : {}),
      });
      await store.writeCoverObservation(target, cover);
      growth.images += Number(cover.created);
      await stateStore.write({
        sourceId: 'anilife_public', targetKey: target.targetKey,
        state: { stage: 'IMAGE_VALIDATED', sourceRecordId },
      });
      const projection = buildServiceProjection({ target, canonical, cover });
      const projectionWrite = await store.writeServiceProjection(target, projection);
      growth.serviceProjections += Number(projectionWrite.created);
      await stateStore.write({
        sourceId: 'anilife_public', targetKey: target.targetKey,
        state: { stage: 'COMPLETED', sourceRecordId },
      });
      rows.push(frozen({
        targetKey: target.targetKey,
        moemoaAnimeId: target.moemoaAnimeId,
        sources: frozen({ anilife_public: frozen({ stage: 'COMPLETED', sourceRecordId }) }),
        cover,
        serviceReadiness: projection.readiness.status,
        currentCanonicalHash: written.contentHash,
      }));
    } catch (error) {
      const code = errorCode(error);
      errors[code] = (errors[code] ?? 0) + 1;
      await stateStore.write({
        sourceId: 'anilife_public', targetKey: target.targetKey,
        state: { stage: 'PENDING_REVIEW', ...(sourceRecordId ? { sourceRecordId } : {}), errorCode: code },
      });
      const current = await store.readCurrent(target.moemoaAnimeId);
      const cover = await store.writeCoverObservation(target);
      const projection = await store.readServiceProjection(target);
      rows.push(frozen({
        targetKey: target.targetKey,
        moemoaAnimeId: target.moemoaAnimeId,
        sources: frozen({ anilife_public: frozen({ stage: 'PENDING_REVIEW', errorCode: code }) }),
        cover: cover ?? frozen({ status: 'NOT_STORED', localRef: null }),
        serviceReadiness: projection?.readiness?.status ?? null,
        currentCanonicalHash: current?.contentHash ?? null,
      }));
    }
  }

  const summary = frozen({
    profile,
    mode: 'REVIEWED_BROWSER_CAPTURE_IMPORT',
    generatedAt: new Date().toISOString(),
    counts: frozen({
      targets: rows.length,
      canonical: rows.filter((row) => row.currentCanonicalHash).length,
      covers: rows.filter((row) => row.cover?.status === 'STORED').length,
      completed: rows.filter((row) => row.sources.anilife_public.stage === 'COMPLETED').length,
      pendingReview: rows.filter((row) => row.sources.anilife_public.stage === 'PENDING_REVIEW').length,
    }),
    growth: frozen(growth),
    errors: frozen(errors),
    targets: frozen(rows),
  });
  await store.writeRunSnapshot(profile, summary);
  return summary;
}
