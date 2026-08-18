import { createHttpClient } from '../lib/http.mjs';
import { assertCatalogWorkspaceMutation } from '../lib/workspace.mjs';
import { assertSourceExecution } from '../contracts/catalogContracts.mjs';
import {
  createPinnedCoverTransport,
  decodeCoverWithChromium,
  downloadCoverCandidate,
  getApprovedCoverSourcePolicy,
  selectCanonicalCover,
  storeValidatedCover,
} from './covers.mjs';
import { buildCanonicalRevision } from './canonical.mjs';
import { buildFieldClaims } from './claims.mjs';
import { resolveIdentity } from './identity.mjs';
import { normalizeSourceRecord } from './normalize.mjs';
import { storeSourceEnvelope } from './raw-store.mjs';
import { createStateStore } from './state-store.mjs';
import { createCatalogArtifactStore } from './artifact-store.mjs';
import { TARGET_PROFILE_COUNTS } from './targets.mjs';

export const JOB_STATES = Object.freeze([
  'PENDING', 'FETCHED', 'NORMALIZED', 'MATCHED', 'CLAIMS_BUILT',
  'IMAGE_VALIDATED', 'COMPLETED', 'FAILED_RETRYABLE',
  'FAILED_PERMANENT', 'PENDING_REVIEW', 'SOURCE_PAUSED',
]);

const EXECUTABLE_SOURCES = Object.freeze(['anilist', 'wikidata', 'anilife_public']);

function typedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function frozen(value) {
  return Object.freeze(structuredClone(value));
}

/** Serializes starts, including overlapping callers, without modifying the delegated HTTP client. */
export function createRateLimitedHttpClient({ http, minIntervalMs, now = Date.now, sleep }) {
  if (!http || typeof http.request !== 'function' || !Number.isInteger(minIntervalMs) || minIntervalMs < 0
    || typeof now !== 'function' || typeof sleep !== 'function') {
    throw new TypeError('Rate-limited HTTP client requires a request client and clock');
  }
  let lastStart = null;
  let queue = Promise.resolve();
  const schedule = (operation) => {
    const next = queue.then(async () => {
      const elapsed = lastStart === null ? minIntervalMs : now() - lastStart;
      const wait = Math.max(0, minIntervalMs - elapsed);
      if (wait) await sleep(wait);
      lastStart = now();
      return operation();
    });
    queue = next.catch(() => {});
    return next;
  };
  return Object.freeze({
    schedule,
    request(input) {
      return schedule(() => http.request(input));
    },
  });
}

function sourceFailureState(error) {
  if (error?.code === 'SOURCE_PAUSED') return 'SOURCE_PAUSED';
  if (error?.code === 'SOURCE_RETRY_EXHAUSTED' || error?.recoverable === true) return 'FAILED_RETRYABLE';
  if (error?.code === 'IDENTITY_AMBIGUOUS' || error?.code === 'IDENTITY_PENDING_REVIEW') return 'PENDING_REVIEW';
  return 'FAILED_PERMANENT';
}

function errorCode(error) {
  return typeof error?.code === 'string' && /^[A-Z0-9_]+$/u.test(error.code)
    ? error.code : 'CATALOG_SOURCE_FAILED';
}

function sourceState(stage, extra = {}) {
  return { stage, ...extra };
}

function ensureInputs({ profile, targets, registry, selectedSources }) {
  const expectedCount = TARGET_PROFILE_COUNTS[profile];
  if (!expectedCount || !Array.isArray(targets) || targets.length !== expectedCount) {
    throw typedError('SOURCE_SCOPE_EXCEEDED', 'Catalog runner target count does not match its approved profile');
  }
  if (!Array.isArray(selectedSources) || selectedSources.length === 0
    || new Set(selectedSources).size !== selectedSources.length) {
    throw typedError('SOURCE_NOT_REGISTERED', 'Catalog runner requires a unique selected source subset');
  }
  for (const sourceId of selectedSources) {
    if (!EXECUTABLE_SOURCES.includes(sourceId)) {
      throw typedError('SOURCE_NOT_REGISTERED', 'Catalog source is not registered for collection');
    }
    const entry = Array.isArray(registry) ? registry.find((row) => row?.sourceId === sourceId) : null;
    assertSourceExecution(entry, targets.length);
  }
}

async function collectOne(adapter, input) {
  if (!adapter || typeof adapter.collect !== 'function') {
    throw typedError('SOURCE_ADAPTER_UNAVAILABLE', 'Selected source adapter is unavailable');
  }
  const rows = [];
  for await (const envelope of adapter.collect(input)) rows.push(envelope);
  if (rows.length !== 1) throw typedError('SOURCE_ENVELOPE_COUNT_INVALID', 'Source adapter must produce exactly one target envelope');
  return rows[0];
}

async function availableRecords({ stateStore, store, target }) {
  const result = [];
  for (const sourceId of EXECUTABLE_SOURCES) {
    const state = await stateStore.read({ sourceId, targetKey: target.targetKey });
    if (!state?.sourceRecordId) continue;
    const record = await store.readSourceRecord({ sourceId, targetKey: target.targetKey, sourceRecordId: state.sourceRecordId });
    if (record) result.push(record);
  }
  return result;
}

function coverCandidates({ target, normalizedRecords }) {
  return normalizedRecords.flatMap((record) => {
    if (record.fieldStates.cover !== 'VALUE' || !record.cover?.sourceUrl) return [];
    const identity = resolveIdentity({ target, candidate: record, sourceId: record.sourceId, referenceRecords: normalizedRecords });
    if (identity.status !== 'MATCHED' || !['EXACT_ID', 'EXACT_RULE'].includes(identity.confidenceClass)) return [];
    return [{
      sourceId: record.sourceId,
      sourceRecordId: record.sourceRecordId,
      retrievedAt: record.retrievedAt,
      sourceUrl: record.cover.sourceUrl,
      identity,
    }];
  }).sort((left, right) => left.identity.confidenceClass.localeCompare(right.identity.confidenceClass)
    || left.sourceId.localeCompare(right.sourceId)
    || left.sourceRecordId.localeCompare(right.sourceRecordId)
    || left.sourceUrl.localeCompare(right.sourceUrl));
}

/** Uses only exact normalized cover fields and the approved production download/decode/storage chain. */
export function createDefaultCoverPipeline() {
  const transport = createPinnedCoverTransport();
  return async ({ target, normalizedRecords, workspace, clients }) => {
    const failures = [];
    let candidates;
    try { candidates = coverCandidates({ target, normalizedRecords }); } catch (error) {
      return frozen({ status: 'FAILED', errorCode: errorCode(error), failures: [errorCode(error)] });
    }
    for (const candidate of candidates) {
      try {
        const client = clients?.get?.(candidate.sourceId);
        if (!client?.schedule) throw typedError('COVER_SOURCE_NOT_SELECTED', 'Cover source is not selected for this run');
        const download = () => downloadCoverCandidate({
          candidate, policy: getApprovedCoverSourcePolicy(candidate.sourceId), transport,
        });
        const sniffed = await client.schedule(download);
        const decoded = await decodeCoverWithChromium({ record: sniffed });
        const stored = await storeValidatedCover({ record: decoded, workspace, animeId: target.moemoaAnimeId });
        const selected = selectCanonicalCover([stored]);
        if (!selected) throw typedError('IMAGE_SELECTION_FAILED', 'Decoded cover could not be selected');
        return frozen({
          status: 'STORED', sourceId: selected.sourceId, sourceRecordId: selected.sourceRecordId,
          checksum: selected.checksum, byteSize: selected.byteSize, width: selected.width, height: selected.height,
          localRef: selected.localRef, created: selected.created,
        });
      } catch (error) {
        failures.push(errorCode(error));
      }
    }
    return frozen({ status: 'FAILED', errorCode: failures[0] ?? 'COVER_NOT_AVAILABLE', failures });
  };
}

async function runCoverPipeline(coverPipeline, input) {
  if (typeof coverPipeline === 'function') return coverPipeline(input);
  if (coverPipeline && typeof coverPipeline.collect === 'function') return coverPipeline.collect(input);
  throw typedError('COVER_PIPELINE_INVALID', 'Cover pipeline must be callable');
}

function countStages(targetRows) {
  const sourceStateCounts = {};
  for (const row of targetRows) {
    for (const state of Object.values(row.sources)) sourceStateCounts[state.stage] = (sourceStateCounts[state.stage] ?? 0) + 1;
  }
  return sourceStateCounts;
}

export async function runCatalogPipeline({
  workspace, profile = 'golden', targets, registry, adapters, bindings = {}, selectedSources, allowNetwork,
  refresh = false, clock = { now: () => new Date().toISOString() }, httpFactory = () => createHttpClient(),
  coverPipeline = createDefaultCoverPipeline(),
} = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  if (allowNetwork !== true) throw typedError('CATALOG_NETWORK_PERMISSION_REQUIRED', 'Network collection requires explicit permission');
  ensureInputs({ profile, targets, registry, selectedSources });
  if (!clock || typeof clock.now !== 'function' || typeof httpFactory !== 'function') {
    throw typedError('CATALOG_RUNNER_INPUT_INVALID', 'Catalog runner clock or HTTP factory is invalid');
  }
  const registryById = new Map(registry.map((entry) => [entry.sourceId, entry]));
  const clients = new Map(selectedSources.map((sourceId) => {
    const entry = registryById.get(sourceId);
    return [sourceId, createRateLimitedHttpClient({
      http: httpFactory({ sourceId, registryEntry: entry }), minIntervalMs: entry.minIntervalMs,
      now: Date.now, sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    })];
  }));
  const store = createCatalogArtifactStore({ workspace });
  const stateStore = createStateStore({ workspace });
  const growth = { sourceRecords: 0, claims: 0, canonicalRevisions: 0, images: 0 };
  const targetRows = [];

  for (const target of targets) {
    const sources = {};
    let current = await store.readCurrent(target.moemoaAnimeId);
    const rebuildCurrent = async () => {
      const sourceRecords = await availableRecords({ stateStore, store, target });
      const normalizedRecords = sourceRecords.map((record) => normalizeSourceRecord(record));
      if (sourceRecords.length === 0) return { sourceRecords, normalizedRecords };
      const claims = buildFieldClaims({ target, normalizedRecords });
      if (claims.length === 0) return { sourceRecords, normalizedRecords };
      const canonical = buildCanonicalRevision({ target, sourceRecords, normalizedRecords, fieldClaims: claims });
      const written = await store.writeCanonical({ target, sourceRecords, normalizedRecords, claims, canonical });
      growth.claims += written.claimsCreated;
      growth.canonicalRevisions += Number(written.created);
      current = { contentHash: written.contentHash };
      for (const sourceId of selectedSources) {
        if (sources[sourceId]?.stage === 'MATCHED') {
          const checkpoint = sourceState('CLAIMS_BUILT', { sourceRecordId: sources[sourceId].sourceRecordId });
          await stateStore.write({ sourceId, targetKey: target.targetKey, state: checkpoint });
          sources[sourceId] = checkpoint;
        }
      }
      return { sourceRecords, normalizedRecords };
    };
    for (const sourceId of selectedSources) {
      const prior = await stateStore.read({ sourceId, targetKey: target.targetKey });
      if (!refresh && ['COMPLETED', 'CLAIMS_BUILT', 'IMAGE_VALIDATED'].includes(prior?.stage) && prior.sourceRecordId) {
        const record = await store.readSourceRecord({ sourceId, targetKey: target.targetKey, sourceRecordId: prior.sourceRecordId });
        if (record) {
          sources[sourceId] = sourceState(prior.stage, { sourceRecordId: prior.sourceRecordId, resumed: true });
          continue;
        }
      }
      try {
        await stateStore.write({ sourceId, targetKey: target.targetKey, state: sourceState('PENDING') });
        const envelope = await collectOne(adapters?.[sourceId], {
          targets: [target], target, http: clients.get(sourceId), clock, bindings,
        });
        if (envelope?.sourceId !== sourceId || envelope?.targetKey !== target.targetKey) {
          throw typedError('SOURCE_ENVELOPE_INVALID', 'Adapter returned an envelope for another source or target');
        }
        const persisted = await storeSourceEnvelope({ workspace, envelope });
        growth.sourceRecords += Number(persisted.created);
        await stateStore.write({ sourceId, targetKey: target.targetKey, state: sourceState('FETCHED', {
          sourceRecordId: persisted.sourceRecordId,
        }) });
        const record = await store.readSourceRecord({ sourceId, targetKey: target.targetKey, sourceRecordId: persisted.sourceRecordId });
        const normalized = normalizeSourceRecord(record);
        await store.writeNormalized(normalized);
        await stateStore.write({ sourceId, targetKey: target.targetKey, state: sourceState('NORMALIZED', {
          sourceRecordId: persisted.sourceRecordId,
        }) });
        const identity = resolveIdentity({ target, candidate: normalized, sourceId, referenceRecords: [normalized] });
        if (identity.status !== 'MATCHED') {
          await stateStore.write({ sourceId, targetKey: target.targetKey, state: sourceState('PENDING_REVIEW', {
            sourceRecordId: persisted.sourceRecordId, errorCode: 'IDENTITY_PENDING_REVIEW',
          }) });
          sources[sourceId] = sourceState('PENDING_REVIEW', { sourceRecordId: persisted.sourceRecordId });
        } else {
          await stateStore.write({ sourceId, targetKey: target.targetKey, state: sourceState('MATCHED', {
            sourceRecordId: persisted.sourceRecordId,
          }) });
          sources[sourceId] = sourceState('MATCHED', { sourceRecordId: persisted.sourceRecordId });
        }
        try {
          await rebuildCurrent();
        } catch (error) {
          sources[sourceId] = sourceState('PENDING_REVIEW', {
            sourceRecordId: persisted.sourceRecordId, errorCode: errorCode(error),
          });
        }
      } catch (error) {
        const stage = sourceFailureState(error);
        const state = sourceState(stage, {
          ...(prior?.sourceRecordId ? { sourceRecordId: prior.sourceRecordId } : {}),
          errorCode: errorCode(error),
        });
        await stateStore.write({ sourceId, targetKey: target.targetKey, state });
        sources[sourceId] = state;
        try {
          await rebuildCurrent();
        } catch {
          // A failed refresh must retain the previous authenticated current pointer.
        }
      }
    }

    try {
      await rebuildCurrent();
    } catch {
      // Resume keeps the prior pointer while an authenticated replacement cannot be rebuilt.
    }

    const sourceRecords = await availableRecords({ stateStore, store, target });
    const normalizedRecords = sourceRecords.map((record) => normalizeSourceRecord(record));

    let cover;
    try {
      cover = await store.writeCoverObservation(target);
      if (refresh || !cover?.localRef) {
        const observation = await runCoverPipeline(coverPipeline, { target, normalizedRecords, workspace, clients });
        cover = observation;
        await store.writeCoverObservation(target, observation);
        growth.images += Number(observation?.created === true);
      }
    } catch (error) {
      cover = frozen({ status: 'FAILED', errorCode: errorCode(error) });
    }
    const coverValidated = cover?.status === 'STORED' && typeof cover.localRef === 'string';
    for (const sourceId of selectedSources) {
      if (!['CLAIMS_BUILT', 'IMAGE_VALIDATED'].includes(sources[sourceId]?.stage)) continue;
      if (!coverValidated) continue;
      const validated = sourceState('IMAGE_VALIDATED', { sourceRecordId: sources[sourceId].sourceRecordId });
      await stateStore.write({ sourceId, targetKey: target.targetKey, state: validated });
      sources[sourceId] = validated;
      const completed = sourceState('COMPLETED', { sourceRecordId: validated.sourceRecordId });
      await stateStore.write({ sourceId, targetKey: target.targetKey, state: completed });
      sources[sourceId] = completed;
    }
    for (const sourceId of EXECUTABLE_SOURCES) {
      if (sources[sourceId]) continue;
      const retained = await stateStore.read({ sourceId, targetKey: target.targetKey });
      if (retained) sources[sourceId] = retained;
    }
    targetRows.push({
      targetKey: target.targetKey,
      moemoaAnimeId: target.moemoaAnimeId,
      sources,
      cover,
      currentCanonicalHash: current?.contentHash ?? null,
    });
  }

  const counts = {
    targets: targetRows.length,
    canonical: targetRows.filter((row) => row.currentCanonicalHash).length,
    covers: targetRows.filter((row) => row.cover?.localRef).length,
    sourceStates: countStages(targetRows),
  };
  const summary = frozen({
    profile, counts, growth, targets: targetRows,
    canonicalHash: targetRows[0]?.currentCanonicalHash ?? null,
  });
  await store.writeRunSnapshot(profile, summary);
  return summary;
}

export async function validateCatalogArtifacts({ workspace, profile = 'golden', targets } = {}) {
  await assertCatalogWorkspaceMutation(workspace, []);
  const expectedCount = TARGET_PROFILE_COUNTS[profile];
  if (!expectedCount || !Array.isArray(targets) || targets.length !== expectedCount) {
    throw typedError('SOURCE_SCOPE_EXCEEDED', 'Validation target count does not match its approved profile');
  }
  const store = createCatalogArtifactStore({ workspace });
  const rows = [];
  for (const target of targets) {
    const current = await store.readCurrent(target.moemoaAnimeId);
    const cover = await store.writeCoverObservation(target);
    rows.push({ targetKey: target.targetKey, canonical: current?.contentHash ?? null, cover: cover?.localRef ?? null });
  }
  return frozen({ valid: rows.every((row) => row.canonical && row.cover), targets: rows });
}

export async function validateGoldenArtifacts(input = {}) {
  return validateCatalogArtifacts({ ...input, profile: 'golden' });
}
