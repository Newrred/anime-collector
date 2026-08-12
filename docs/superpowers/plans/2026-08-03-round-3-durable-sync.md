# Round 3 Durable Sync Implementation Plan

> **문서 상태: `COMPLETED_LEGACY_PLAN` — 재실행 금지**
> legacy snapshot sync 내구성 구현 이력이다. 신규 Card/Board sync 설계로 간주하지 않는다. 현재 기준은 [`docs/moemoa/README.md`](../../moemoa/README.md)를 따른다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining durability, promotion-race, and migration-retry data-loss paths using real `applyRemoteSnapshot`, `uploadSnapshotToCloud`, snapshot export, migration, and Home entry flows.

**Architecture:** Normal interactive writes keep their existing fast local-first mirrors. Cloud download receives dedicated strict repository writers that require successful localStorage writes and await the corresponding IndexedDB transaction before the next guarded phase. External persistence boundaries accept narrow optional adapters so unit tests can defer or reject real repository call paths without mocking the orchestration under test. Watch-log promotion rechecks local state after its awaited IDB read and merges by log ID with local conflicts winning; migration caches only an in-flight attempt and propagates read failures so the next call can retry.

**Tech Stack:** Astro 5, React 19, browser IndexedDB/localStorage, Node test runner, Playwright Chromium.

## Global Constraints

- Work only in `D:\hong\Web\Anime\anime-collector\.worktrees\sea-product-readiness` on `codex/sea-product-readiness`.
- Follow strict RED -> GREEN -> REFACTOR for every behavior.
- Exercise actual public call paths; mocks are allowed only at IndexedDB or Supabase external boundaries.
- Preserve all Round 2 behavior and account-scoped completion metadata.
- Do not run live-network tests or React Doctor.
- Finish with unit, targeted actual-path tests, storage-hydration and quick-log focused E2E, full Chromium E2E, build, diff check, and port-4321 cleanup verification.

---

### Task 1: Strict durable cloud download

**Files:**
- Modify: `src/repositories/libraryRepo.js`
- Modify: `src/repositories/tierRepo.js`
- Modify: `src/repositories/watchLogRepo.js`
- Modify: `src/repositories/characterPinRepo.js`
- Modify: `src/domain/snapshotCodec.js`
- Modify: `src/repositories/syncRepo.js`
- Modify: `tests/unit/syncMutationSafety.test.mjs`

**Interfaces:**
- Produces `writeLibraryListDurable(list, options)`, `writeTierBoardBundleDurable(bundle, options)`, `replaceWatchLogsDurable(logs, options)`, and `replaceCharacterPinsDurable(pins, options)`.
- Each strict writer throws when localStorage cannot be written and awaits its real IDB mutation. `options.storage` may replace only the external IDB functions in tests.
- `applySyncSnapshot(snapshot, { canMutate, storage })` runs these writers sequentially through the guard.
- `applyRemoteSnapshot(remote, { canMutate, storage, ... })` forwards the adapter and records completion only after every durable phase succeeds and the guard is still current.

- [x] Add actual `applyRemoteSnapshot()` tests that defer each IDB-backed store in turn and prove completion remains absent until the deferred durability Promise resolves.
- [x] Add an actual `applyRemoteSnapshot()` test that switches account A -> B while the Library IDB replacement is awaiting; assert no Tier, WatchLog, CharacterPin, preference, or completion mutation occurs.
- [x] Add actual-path rejection tests for IDB and localStorage failures; assert the original error propagates and sync completion metadata remains absent.
- [x] Run the focused unit file and verify RED because current writers discard IDB Promises and localStorage failures.
- [x] Implement the four strict writers, thread the persistence adapter through snapshot apply, and verify GREEN.

### Task 2: Actual cloud upload race coverage

**Files:**
- Modify: `src/repositories/syncRepo.js`
- Modify: `tests/unit/syncMutationSafety.test.mjs`

**Interfaces:**
- `uploadSnapshotToCloud(userId, snapshot, { client, remoteState, canMutate, expectedLocalRevision, hash })` uses `client || supabase`; all internal remote reads/upserts/deletes receive that client.
- The test client implements the same fluent `.from(table)` boundary while orchestration, diffing, account guards, and completion metadata remain production code.

- [x] Replace the helper-only account-switch test with an actual `uploadSnapshotToCloud()` test whose Library upsert is deferred, then switch A -> B and prove later tables and completion are untouched.
- [x] Replace the helper-only newer-edit test with an actual gated upload, mutate local revision while its Library upsert awaits, and prove hash S is recorded while S2 stays pending in the next `buildLocalSyncState()` result.
- [x] Run focused tests and verify RED because the production repository cannot yet accept the controlled external client.
- [x] Pass the client through every upload/read/upsert/delete helper without changing production defaults, then verify GREEN.

### Task 3: Race-safe full watch-log promotion

**Files:**
- Modify: `src/services/watchLogSource.js`
- Modify: `src/repositories/watchLogRepo.js`
- Modify: `src/domain/snapshotCodec.js`
- Modify: `tests/unit/watchLogSource.test.mjs`

**Interfaces:**
- `loadAuthoritativeWatchLogSnapshot(...)` reads IDB only when no local key exists, then rechecks local state and returns a deterministic ID union where the post-await local row wins duplicate IDs.
- IDB read failures reject unchanged.
- `readAllWatchLogsPreferred({ readAllIdbSnapshot } = {})` and `exportSyncSnapshot({ watchLogStorage } = {})` permit external-boundary injection for controlled tests while production uses real IndexedDB.

- [x] Add a real repository race test: start preferred read with no local key, append S2 through `appendWatchLog()` while IDB S is deferred, resolve S, and assert both rows remain with local conflict priority.
- [x] Add a real `exportSyncSnapshot()` rejection test using a failing IDB boundary and assert the same error propagates instead of producing an empty watch-log snapshot.
- [x] Run the focused tests and verify RED from the overwrite and swallowed-error behavior.
- [x] Implement post-await merge/recheck, remove the catch-to-empty export path, and verify GREEN.

### Task 4: Retryable failure-atomic legacy migration

**Files:**
- Modify: `src/storage/legacyMigration.js`
- Modify: `tests/storage-hydration.spec.ts`

**Interfaces:**
- `ensureLegacyStorageMigrated({ storage } = {})` uses real storage functions by default and permits a narrow external storage adapter in tests.
- Any metadata, Library, Tier, or WatchLog IDB read rejection aborts before all replacement and marker writes, rejects to the caller, and clears only the matching cached in-flight Promise.

- [x] Add an actual browser migration test with IDB `{1,2}` and local `{1}`: reject the first Library read, assert no replace and no marker, then call again in the same module instance and assert safe union plus marker.
- [x] Run the focused test and verify RED because current reads become empty and failure resolves/caches.
- [x] Remove read fallbacks, make failure reject, clear the cached attempt on rejection, and verify GREEN.

### Task 5: Independent Home entry and final verification

**Files:**
- Modify: `tests/storage-hydration.spec.ts`
- Modify: `README.md`
- Modify: `.superpowers/sdd/2026-08-03-product-readiness/final-review-fix-report.md` (ignored handoff artifact)

**Interfaces:**
- A Home E2E fixture enters `/` directly after seeding IDB-only Library/log rows; it does not invoke export or visit Library first.

- [x] Add the independent Home-first IDB-only log test and verify it fails if `useShowcaseSource` loses preferred hydration.
- [x] Run `npm run test:unit`, the actual-path unit files, storage hydration, the focused quick-log bundle, full Chromium E2E, and `npm run build`.
- [x] Run `git diff --check`, verify zero listeners on port 4321, and inspect the final staged diff.
- [x] Update README and the Round 3 report with root causes, RED evidence, exact results, residual warnings, and the final commit SHA.
- [x] Commit the coherent Round 3 fix and leave the feature worktree clean.
