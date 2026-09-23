import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';
import { createCatalogArtifactStore } from './artifact-store.mjs';
import { buildCanonicalRevision } from './canonical.mjs';
import { buildFieldClaims } from './claims.mjs';
import { normalizeSourceRecord } from './normalize.mjs';
import { storeSourceEnvelope } from './raw-store.mjs';
import { buildServiceProjection } from './service-projection.mjs';
import { isIncrementProfile } from './targets.mjs';

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function episodeCount(label) {
  const match = typeof label === 'string' ? label.match(/^([1-9]\d*)화$/u) : null;
  const value = match ? Number(match[1]) : null;
  return Number.isSafeInteger(value) ? value : null;
}

function seedEnvelope(target) {
  const evidence = target.incrementEvidence;
  const contentId = target.seedExternalIds?.find((row) => row?.sourceId === 'anilife_public')?.value;
  const koreanTitle = target.seedTitles?.find((row) => row?.locale === 'ko')?.value;
  if (target.seedSource !== 'reviewed_increment'
    || !/^(?:ANILIST|ANILIFE):[1-9]\d*$/u.test(target.targetKey ?? '')
    || String(contentId ?? '') !== evidence?.contentId
    || typeof koreanTitle !== 'string' || !koreanTitle.trim()
    || typeof evidence?.capturedAt !== 'string' || typeof evidence?.sourceHash !== 'string') {
    throw typedError('INCREMENT_SEED_INVALID', 'Reviewed increment target cannot be materialized');
  }
  return Object.freeze({
    sourceId: 'anilife_public',
    targetKey: target.targetKey,
    sourceEntityId: evidence.contentId,
    responseStatus: 200,
    fetchedAt: evidence.capturedAt,
    requestFingerprint: `season-capture:${evidence.sourceHash}:${evidence.contentId}`,
    parserVersion: 'anilife-season-capture-v1',
    payload: Object.freeze({
      contentId: evidence.contentId,
      title: koreanTitle,
      alternateName: null,
      datePublished: null,
      format: evidence.format,
      status: null,
      numberOfEpisodes: episodeCount(evidence.episodeLabel),
      imageUrl: null,
      publicPageUrl: evidence.publicPageUrl,
      identityEvidence: null,
    }),
  });
}

/** Materializes reviewed public-season evidence through the normal authenticated catalog stages. */
export async function materializeIncrementProfile({ workspace, profile, targets } = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  if (!isIncrementProfile(profile) || !Array.isArray(targets) || targets.length < 1 || targets.length > 500) {
    throw typedError('INCREMENT_SEED_INVALID', 'Increment materialization input is invalid');
  }
  const store = createCatalogArtifactStore({ workspace });
  const rows = [];
  const growth = { sourceRecords: 0, claims: 0, canonicalRevisions: 0, images: 0 };
  let claimCount = 0;
  for (const target of targets) {
    const persisted = await storeSourceEnvelope({ workspace, envelope: seedEnvelope(target) });
    growth.sourceRecords += Number(persisted.created);
    const sourceRecord = await store.readSourceRecord({
      sourceId: 'anilife_public', targetKey: target.targetKey, sourceRecordId: persisted.sourceRecordId,
    });
    const normalized = normalizeSourceRecord(sourceRecord);
    const claims = buildFieldClaims({ target, normalizedRecords: [normalized] });
    const canonical = buildCanonicalRevision({
      target, sourceRecords: [sourceRecord], normalizedRecords: [normalized], fieldClaims: claims,
    });
    const written = await store.writeCanonical({
      target, sourceRecords: [sourceRecord], normalizedRecords: [normalized], claims, canonical,
    });
    claimCount += claims.length;
    growth.claims += written.claimsCreated;
    growth.canonicalRevisions += Number(written.created);
    const cover = await store.writeCoverObservation(target);
    const projection = buildServiceProjection({ target, canonical, cover });
    await store.writeServiceProjection(target, projection);
    rows.push(Object.freeze({
      targetKey: target.targetKey,
      moemoaAnimeId: target.moemoaAnimeId,
      sourceRecordId: persisted.sourceRecordId,
      currentCanonicalHash: written.contentHash,
      projectionHash: projection.projectionHash,
      serviceReadiness: projection.readiness.status,
      sources: Object.freeze({ anilife_public: Object.freeze({ stage: 'COMPLETED' }) }),
      cover: cover ?? Object.freeze({ status: 'NOT_STORED', localRef: null }),
    }));
  }
  const summary = Object.freeze({
    profile,
    mode: 'REVIEWED_INCREMENT_SEED',
    counts: Object.freeze({ targets: rows.length, canonical: rows.length, covers: 0, claims: claimCount }),
    growth: Object.freeze(growth),
    targets: Object.freeze(rows),
  });
  await store.writeRunSnapshot(profile, summary);
  return summary;
}
