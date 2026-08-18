import assert from 'node:assert/strict';
import test from 'node:test';

import {
  planTargetBatches,
  runCatalogBatches,
} from '../../tools/catalog-lab/pipeline/batches.mjs';
import { QUALITY_SCHEMA_VERSION, renderQualityReportMarkdown } from '../../tools/catalog-lab/reports/quality-report.mjs';

function targets(count = 3998) {
  return Array.from({ length: count }, (_, index) => Object.freeze({
    targetKey: `ANILIST:${index + 1}`,
    moemoaAnimeId: `anime:${String(index + 1).padStart(6, '0')}`,
  }));
}

function batchSummary(rows, selectedSources, { resumed = false, paused = false } = {}) {
  const targetRows = rows.map((row, index) => ({
    targetKey: row.targetKey,
    moemoaAnimeId: row.moemoaAnimeId,
    sources: Object.fromEntries(selectedSources.map((sourceId) => [sourceId, {
      stage: paused && index === 0 ? 'SOURCE_PAUSED' : 'COMPLETED',
      ...(resumed ? { resumed: true } : {}),
    }])),
    cover: { status: 'STORED', localRef: `images/covers/${index}.png` },
    serviceReadiness: 'READY',
    currentCanonicalHash: 'a'.repeat(64),
  }));
  return {
    profile: 'full3998',
    counts: {
      targets: rows.length,
      canonical: rows.length,
      covers: rows.length,
      sourceStates: paused
        ? { SOURCE_PAUSED: 1, COMPLETED: rows.length - 1 }
        : { COMPLETED: rows.length },
    },
    growth: {
      sourceRecords: resumed ? 0 : rows.length,
      claims: resumed ? 0 : rows.length,
      canonicalRevisions: resumed ? 0 : rows.length,
      images: resumed ? 0 : rows.length,
    },
    targets: targetRows,
    canonicalHash: targetRows[0]?.currentCanonicalHash ?? null,
  };
}

test('full3998 plan creates forty deterministic non-overlapping batches', () => {
  const roster = targets();
  const batches = planTargetBatches({ profile: 'full3998', targets: roster, batchSize: 100 });

  assert.equal(batches.length, 40);
  assert.deepEqual(batches.slice(0, 39).map((batch) => batch.targets.length), Array(39).fill(100));
  assert.equal(batches[39].targets.length, 98);
  assert.deepEqual(batches.flatMap((batch) => batch.targets), roster);
  assert.deepEqual(batches.map((batch) => batch.batchNumber), Array.from({ length: 40 }, (_, index) => index + 1));
  assert.throws(() => planTargetBatches({ profile: 'full3998', targets: roster, batchSize: 101 }), {
    code: 'CATALOG_BATCH_INVALID',
  });
  const malformed = [...roster];
  malformed[20] = { ...malformed[20], targetKey: undefined };
  assert.throws(() => planTargetBatches({ profile: 'full3998', targets: malformed, batchSize: 100 }), {
    code: 'CATALOG_BATCH_INVALID',
  });
});

test('batch coordinator persists aggregate progress and pauses only after batches that performed work', async () => {
  const roster = targets();
  const snapshots = [];
  const sleeps = [];
  const calls = [];
  const result = await runCatalogBatches({
    profile: 'full3998', targets: roster, batchSize: 100, pauseMs: 120_000,
    selectedSources: ['anilist'],
    runBatch: async (input) => {
      calls.push(input);
      return batchSummary(input.targets, input.selectedSources, { resumed: input.batchNumber === 1 });
    },
    writeSnapshot: async (snapshot) => { snapshots.push(snapshot); },
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
  });

  assert.equal(calls.length, 40);
  assert.equal(calls.every((call) => call.approvedTargetCount === 3998 && call.persistSnapshot === false), true);
  assert.equal(snapshots.length, 40);
  assert.equal(snapshots.at(-1).counts.targets, 3998);
  assert.equal(snapshots.at(-1).batchProgress.completedBatches, 40);
  assert.equal(snapshots.at(-1).batchProgress.totalBatches, 40);
  assert.equal(snapshots.at(-1).batchProgress.nextBatchNumber, null);
  assert.equal(snapshots.at(-1).growth.sourceRecords, 3898);
  assert.deepEqual(sleeps, Array(38).fill(120_000));
  assert.equal(result.stoppedForSourcePause, false);
});

test('batch coordinator stops after persisting a source pause and never starts the next batch', async () => {
  const snapshots = [];
  const sleeps = [];
  let calls = 0;
  const result = await runCatalogBatches({
    profile: 'full3998', targets: targets(), batchSize: 100, pauseMs: 120_000,
    selectedSources: ['anilist'],
    runBatch: async (input) => {
      calls += 1;
      return batchSummary(input.targets, input.selectedSources, { paused: input.batchNumber === 2 });
    },
    writeSnapshot: async (snapshot) => { snapshots.push(snapshot); },
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
  });

  assert.equal(calls, 2);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots.at(-1).counts.targets, 200);
  assert.equal(snapshots.at(-1).batchProgress.completedBatches, 2);
  assert.equal(snapshots.at(-1).batchProgress.nextBatchNumber, 3);
  assert.equal(result.stoppedForSourcePause, true);
  assert.deepEqual(sleeps, [120_000]);
});

test('batch coordinator rejects a result for a different target before progress is persisted', async () => {
  const roster = targets();
  let writes = 0;
  await assert.rejects(runCatalogBatches({
    profile: 'full3998', targets: roster, batchSize: 100, pauseMs: 120_000,
    selectedSources: ['anilist'],
    runBatch: async (input) => {
      const summary = batchSummary(input.targets, input.selectedSources);
      summary.targets[0].targetKey = 'ANILIST:999999999';
      return summary;
    },
    writeSnapshot: async () => { writes += 1; },
    sleep: async () => {},
  }), { code: 'CATALOG_BATCH_RESULT_INVALID' });
  assert.equal(writes, 0);
  await assert.rejects(runCatalogBatches({
    profile: 'full3998', targets: roster, batchSize: 100, pauseMs: 59_999,
    selectedSources: ['anilist'], runBatch: async () => {}, writeSnapshot: async () => {},
  }), { code: 'CATALOG_BATCH_INVALID' });
});

test('full3998 quality report has an unambiguous profile heading', () => {
  const report = {
    schemaVersion: QUALITY_SCHEMA_VERSION,
    profile: 'full3998',
    gate: { passed: false, blockers: ['TARGET_COUNT_INCOMPLETE'] },
    serviceGate: { passed: false },
    targetCount: 0,
    canonicalCount: 0,
    coverStoredCount: 0,
    serviceReadinessCounts: {},
    serviceTotals: {
      targetsWithReview: 0,
      targetsWithWarnings: 0,
      autoAcceptedTitleAliases: 0,
      quarantinedTitles: 0,
      officialLinkAutoSelections: 0,
      automaticTitleFallbacks: 0,
    },
    targets: [],
  };
  assert.match(renderQualityReportMarkdown(report), /^# Full 3,998 Catalog Quality Report$/mu);
});
