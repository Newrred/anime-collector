# Round 2 Data Safety Implementation Plan

> **문서 상태: `COMPLETED_LEGACY_PLAN` — 재실행 금지**
> legacy 저장·동기화 회귀 계약의 구현 이력이다. 현재 sync Gap과 신규 owner 모델은 [`implementation-gap-analysis.md`](../../moemoa/reports/implementation-gap-analysis.md)를 따른다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four merge-blocking data-loss races found in the `b622f8f..4f078d7` review while preserving account-scoped sync metadata and device-local pending state.

**Architecture:** Migration will union interrupted IDB/local state before setting its marker. All multi-phase destructive sync work will run through one reusable guard checked before every phase, while a monotonic device-local revision prevents an older upload from clearing a newer edit. Watch-log full-snapshot consumers will use one asynchronous preferred read that promotes the complete IDB snapshot before Home, export, or cloud snapshot construction.

**Tech Stack:** Astro 5, React 19, browser IndexedDB/localStorage, Node test runner, Playwright Chromium.

## Global Constraints

- Work only in `D:\hong\Web\Anime\anime-collector\.worktrees\sea-product-readiness`.
- Follow strict RED -> GREEN -> REFACTOR for each behavior.
- Do not run live-network tests or React Doctor.
- Keep sync completion metadata account-scoped; keep `pending`, mutation timestamp, and revision device-local.
- Finish with unit, focused E2E, full Chromium E2E, build, diff check, and port-4321 cleanup verification.

---

### Task 1: Interrupted legacy migration union

**Files:**
- Create: `src/services/legacyMigrationMerge.js`
- Modify: `src/storage/legacyMigration.js`
- Modify: `tests/storage-hydration.spec.ts`
- Create: `tests/unit/legacyMigrationMerge.test.mjs`

**Interfaces:**
- Produces `mergeLegacyLibraryRows(existingRows, legacyRows)`, `mergeTierStatePreferExisting(existingTier, legacyTier)`, and `mergeLegacyWatchLogs(existingRows, legacyRows)`.
- Existing IDB values win duplicate conflicts; unique legacy values are retained; a title/log/tier ID appears at most once.

- [x] Write unit expectations for IDB conflict priority and union/deduplication, plus an E2E case that seeds partial IDB and complete local Library/Tier data on `/favicon.svg` before the first app navigation.
- [x] Run the unit and focused E2E tests and verify they fail because current migration skips nonempty IDB.
- [x] Implement the merge helpers and make `ensureLegacyStorageMigrated()` write the merged union to both storage layers before the migration marker.
- [x] Re-run the focused tests and verify the preferred read, hydration, and mirror retain the complete union.

### Task 2: Guard every destructive sync phase and preserve newer edits

**Files:**
- Create: `src/services/guardedMutationSteps.js`
- Modify: `src/repositories/syncRepo.js`
- Modify: `src/domain/snapshotCodec.js`
- Modify: `src/hooks/useSyncStatus.js`
- Modify: `src/storage/keys.js`
- Create: `tests/unit/syncMutationSafety.test.mjs`

**Interfaces:**
- `runGuardedMutationSteps({ canMutate, steps, onComplete })` checks `canMutate()` immediately before every step and before completion.
- `readSyncMeta(userId)` exposes device-local `localRevision`; `markLocalDirty()` increments it.
- `markSyncCompleted({ expectedLocalRevision, ... })` updates the uploaded baseline but keeps `pending: true` if the current revision is newer.
- `uploadSnapshotToCloud(..., { canMutate, expectedLocalRevision })` and `applyRemoteSnapshot(..., { canMutate, expectedLocalRevision })` pass the guard through every destructive phase.

- [x] Write a controlled deferred test that starts account-A phase 1, switches to B while it awaits, then proves phase 2 and real `markSyncCompleted()` never execute.
- [x] Write a controlled deferred test that captures revision S, calls `markLocalDirty()` for S2 during the await, then proves completion records hash S without clearing device-local pending and the next local sync state still reports pending.
- [x] Run the tests and verify both fail against the current single-check/unconditional-completion behavior.
- [x] Implement the guarded step runner, thread guards through remote upsert/delete/tier/preference/local-apply phases, and add stable revision capture to `buildLocalSyncState()`.
- [x] Pass `expectedLocalRevision` from every `useSyncStatus` upload/apply call and re-run the focused unit tests.

### Task 3: Preferred complete watch-log snapshots

**Files:**
- Modify: `src/repositories/watchLogRepo.js`
- Modify: `src/domain/snapshotCodec.js`
- Modify: `src/hooks/useShowcaseSource.js`
- Modify: `src/components/DataCenter.jsx`
- Modify: `src/components/Library.jsx`
- Modify: `src/components/TierBoard.jsx`
- Modify: `tests/storage-hydration.spec.ts`

**Interfaces:**
- `readAllWatchLogsPreferred()` asynchronously promotes/returns the complete authoritative watch-log snapshot.
- `exportSyncSnapshot()` awaits it, so manual backup and `buildLocalSyncState()` share the same safe source.

- [x] Add an E2E case that seeds IDB-only logs on the static same-origin page, calls real `exportSyncSnapshot()` before any Library route, and then proves Home renders the cue.
- [x] Run it and verify the snapshot/Home path loses the log before implementation.
- [x] Add `readAllWatchLogsPreferred()` and replace correctness-sensitive synchronous reads in Home, export/cloud snapshot, counts, and direct Library/Tier backup builders.
- [x] Re-run the focused E2E and existing watch-log failure/reload coverage.

### Task 4: Saving-state close affordance and final verification

**Files:**
- Modify: `src/components/library/LibraryQuickLogSheet.jsx`
- Modify: `src/styles/global.css`
- Modify: `tests/library-userflow.spec.ts`
- Modify: `README.md`
- Modify: `.superpowers/sdd/2026-08-03-product-readiness/final-review-fix-report.md` (ignored handoff artifact)

**Interfaces:**
- While `saving` is true, the sheet top-X and footer close/save buttons are natively disabled and visibly use the disabled style.

- [x] Extend the rapid double-save E2E observer to require the top X to become disabled with visible disabled styling, and verify RED.
- [x] Add `disabled={saving}` and a scoped disabled style, then verify GREEN.
- [x] Update storage/test documentation and the Round 2 report with RED evidence and exact verification results.
- [x] Run `npm run test:unit`, relevant focused E2E, full Chromium E2E, `npm run build`, `git diff --check`, and verify zero listeners on port 4321.
- [x] Commit the coherent Round 2 fix and record its SHA in the report.
