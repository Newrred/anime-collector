import { TARGET_PROFILE_COUNTS } from './targets.mjs';

const MAX_BATCH_TARGETS = 100;

function batchError(message) {
  const error = new Error(message);
  error.code = 'CATALOG_BATCH_INVALID';
  return error;
}

function batchResultError(message) {
  const error = new Error(message);
  error.code = 'CATALOG_BATCH_RESULT_INVALID';
  return error;
}

function frozen(value) {
  return Object.freeze(structuredClone(value));
}

function countSourceStates(targetRows) {
  const counts = {};
  for (const row of targetRows) {
    for (const state of Object.values(row.sources ?? {})) {
      if (typeof state?.stage === 'string') counts[state.stage] = (counts[state.stage] ?? 0) + 1;
    }
  }
  return counts;
}

function batchPerformedNetworkWork(summary, selectedSources) {
  return summary.targets?.some((target) => selectedSources.some((sourceId) => (
    target.sources?.[sourceId]?.resumed !== true
  ))) ?? false;
}

function hasSourcePause(summary) {
  return summary.targets?.some((target) => Object.values(target.sources ?? {}).some((state) => (
    state?.stage === 'SOURCE_PAUSED'
  ))) ?? false;
}

function assertBatchSummary(summary, batch, profile) {
  if (!summary || typeof summary !== 'object' || summary.profile !== profile
    || !Array.isArray(summary.targets) || summary.targets.length !== batch.targets.length
    || summary.counts?.targets !== batch.targets.length
    || summary.targets.some((row, index) => (
      row?.targetKey !== batch.targets[index].targetKey
      || row?.moemoaAnimeId !== batch.targets[index].moemoaAnimeId
    ))) {
    throw batchResultError('Catalog batch returned targets outside its approved slice');
  }
}

export function planTargetBatches({ profile, targets, batchSize = MAX_BATCH_TARGETS } = {}) {
  const expectedCount = TARGET_PROFILE_COUNTS[profile];
  if (profile !== 'full3998' || expectedCount !== 3998
    || !Array.isArray(targets) || targets.length !== expectedCount
    || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_TARGETS
    || targets.some((target) => !/^ANILIST:[1-9]\d*$/u.test(target?.targetKey ?? '')
      || typeof target?.moemoaAnimeId !== 'string' || !target.moemoaAnimeId.startsWith('anime:'))
    || new Set(targets.map((target) => target.targetKey)).size !== expectedCount
    || new Set(targets.map((target) => target.moemoaAnimeId)).size !== expectedCount) {
    throw batchError('Full catalog batch plan is invalid');
  }
  const totalBatches = Math.ceil(targets.length / batchSize);
  return Object.freeze(Array.from({ length: totalBatches }, (_, index) => Object.freeze({
    batchNumber: index + 1,
    totalBatches,
    startIndex: index * batchSize,
    targets: Object.freeze(targets.slice(index * batchSize, (index + 1) * batchSize)),
  })));
}

/** Runs the existing serial catalog pipeline in deterministic, resumable full-roster slices. */
export async function runCatalogBatches(input = {}) {
  const {
    profile,
    targets,
    batchSize = MAX_BATCH_TARGETS,
    pauseMs = 120_000,
    selectedSources,
    runBatch,
    writeSnapshot,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    onProgress = () => {},
    clock = { now: () => new Date().toISOString() },
    ...pipelineInput
  } = input;
  if (!Array.isArray(selectedSources) || selectedSources.length === 0
    || typeof runBatch !== 'function' || typeof writeSnapshot !== 'function'
    || typeof sleep !== 'function' || typeof onProgress !== 'function'
    || !clock || typeof clock.now !== 'function'
    || !Number.isInteger(pauseMs) || pauseMs < 60_000 || pauseMs > 3_600_000) {
    throw batchError('Full catalog batch coordinator input is invalid');
  }
  const plan = planTargetBatches({ profile, targets, batchSize });
  const summaries = [];
  let latest = null;

  for (const batch of plan) {
    const summary = await runBatch({
      ...pipelineInput,
      profile,
      targets: batch.targets,
      selectedSources,
      clock,
      approvedTargetCount: targets.length,
      persistSnapshot: false,
      batchNumber: batch.batchNumber,
      totalBatches: batch.totalBatches,
    });
    assertBatchSummary(summary, batch, profile);
    summaries.push(summary);
    const targetRows = summaries.flatMap((row) => row.targets ?? []);
    const paused = hasSourcePause(summary);
    latest = frozen({
      profile,
      mode: 'BATCHED_COLLECTION',
      generatedAt: clock.now(),
      counts: {
        targets: targetRows.length,
        canonical: targetRows.filter((row) => row.currentCanonicalHash).length,
        covers: targetRows.filter((row) => typeof row.cover?.localRef === 'string').length,
        sourceStates: countSourceStates(targetRows),
      },
      growth: summaries.reduce((growth, row) => ({
        sourceRecords: growth.sourceRecords + (row.growth?.sourceRecords ?? 0),
        claims: growth.claims + (row.growth?.claims ?? 0),
        canonicalRevisions: growth.canonicalRevisions + (row.growth?.canonicalRevisions ?? 0),
        images: growth.images + (row.growth?.images ?? 0),
      }), { sourceRecords: 0, claims: 0, canonicalRevisions: 0, images: 0 }),
      targets: targetRows,
      canonicalHash: targetRows[0]?.currentCanonicalHash ?? null,
      batchProgress: {
        batchSize,
        pauseMs,
        completedBatches: summaries.length,
        totalBatches: plan.length,
        nextBatchNumber: summaries.length < plan.length ? summaries.length + 1 : null,
        stoppedForSourcePause: paused,
      },
    });
    await writeSnapshot(latest);
    await onProgress(frozen({
      batchNumber: batch.batchNumber,
      totalBatches: batch.totalBatches,
      batchTargets: batch.targets.length,
      processedTargets: targetRows.length,
      stoppedForSourcePause: paused,
    }));
    if (paused) return frozen({ ...latest, stoppedForSourcePause: true });
    if (batch.batchNumber < plan.length && batchPerformedNetworkWork(summary, selectedSources)) {
      await sleep(pauseMs);
    }
  }

  return frozen({ ...latest, stoppedForSourcePause: false });
}

export { MAX_BATCH_TARGETS };
