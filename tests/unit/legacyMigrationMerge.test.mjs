import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeLegacyLibraryRows,
  mergeLegacyWatchLogs,
  mergeTierStatePreferExisting,
} from "../../src/services/legacyMigrationMerge.js";

test("interrupted migration keeps IDB conflicts and restores unique legacy library rows", () => {
  const rows = mergeLegacyLibraryRows(
    [{ anilistId: 1, memo: "newer IDB", addedAt: 2 }],
    [
      { anilistId: 1, memo: "older local", addedAt: 1 },
      { anilistId: 2, memo: "local only", addedAt: 3 },
    ],
  );

  assert.deepEqual(rows, [
    { anilistId: 1, memo: "newer IDB", addedAt: 2 },
    { anilistId: 2, memo: "local only", addedAt: 3 },
  ]);
});

test("interrupted migration keeps each anime in exactly one tier with IDB placement priority", () => {
  const tier = mergeTierStatePreferExisting(
    { unranked: [3], tiers: { S: [1], A: [] } },
    { unranked: [2, 3], tiers: { S: [], A: [1, 4] } },
  );

  assert.deepEqual(tier, {
    unranked: [3, 2],
    tiers: { S: [1], A: [4] },
  });
});

test("interrupted migration unions watch logs without replacing an IDB conflict", () => {
  const rows = mergeLegacyWatchLogs(
    [{ id: "shared", cue: "newer IDB" }],
    [
      { id: "shared", cue: "older local" },
      { id: "local-only", cue: "restored" },
    ],
  );

  assert.deepEqual(rows, [
    { id: "shared", cue: "newer IDB" },
    { id: "local-only", cue: "restored" },
  ]);
});
