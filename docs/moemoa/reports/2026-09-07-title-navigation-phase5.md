# Phase 5 — Navigation, Copy, Search, Aliases

Date: 2026-09-07. Status: implemented and functionally verified on Web; quality-score follow-up remains. Scope: local Web implementation; production and Android rollout excluded. ExecPlan: [Title Hub dual view](../plans/2026-09-03-title-hub-dual-view.md).

## Documents and baseline

Read `AGENTS.md`, `CODEX_START_HERE.md`, canonical decisions `01`, product flows `02`, audit protocol `03`, change control `09`, `PLANS.md`, the 2026-09-03 Title Hub UI specification, ExecPlan and implementation frame. Cross-checked current routes, navigation, search, title projection/services, Memory runtime, local repositories and tests. React Doctor skill applied.

Baseline: `master`, HEAD `3fb09a7`; 112 existing modified/untracked status entries. Unit 216/216, static build 15 pages, React Doctor 86/100. Existing work was preserved.

## User result and implementation

- Navigation now follows Home → Memories → Titles → Boards. Tier remains available under the management menu. Desktop/mobile share `src/components/PrimaryNavigationLinks.jsx`, keeping labels, destinations and current-page semantics consistent.
- `TopNavDataMenu.jsx` and `src/messages/{en,ko}.js` use Add Memory / 기억 남기기 and Save Title / 작품 저장. Existing internal locale keys and storage names remain compatible.
- `src/pages/library.astro` renders `LegacyLibraryRoute.jsx`. Plain `/library/` replaces history with `/titles/`; numeric `animeId` maps to `anilistId` on `/title/`; exact catalog IDs retain their namespace. Unknown IDs go safely to My Titles. No arbitrary destination is accepted.
- `/archive/` remains the canonical Memories route, preserving existing links without a needless URL migration.
- `focus=quick-log` and `focus=edit` retain the existing record editor. Title Hub links to that editor for saved titles. Watch status, rating, memo and WatchLog controls remain available while their full integration is deferred.
- `titleHubService.js` resolves numeric legacy links through exact catalog bindings even when the old URL contains no display title.
- `titleSearchProjection.js`, `useSearchMemories.js`, `TopNavGlobalSearch.jsx` and `QuickActionPanel.jsx` display saved status and Complete Memory count, including Memory-only titles. An unavailable count is not shown as zero. Private title and unresolved Memory-only results open Title Hub without an ambiguous composer shortcut.
- The search hook reads the active owner's archive only while search is open, clears snapshots on account-scope changes, rejects superseded asynchronous responses, and checks owner identity around the archive read. It does not fetch previews or render private notes.
- `TitleCollectionView.jsx` refreshes after Save Title while retaining the chosen view. Navigation uses document transitions to avoid keeping an old modal behind the destination.

Key source evidence, relative to the repository root: `src/features/titles/domain/titleNavigation.js:39–51` (compatibility URL mapping), `src/features/titles/application/titleSearchProjection.js:6–34` (Memory counts and search rows), `src/hooks/useSearchMemories.js:5–37` (owner/scope guards), and `src/components/search/TopNavGlobalSearch.jsx:245–275` (composer, quick-log and Title Hub destinations). Full task-specific application/test paths are in the snapshot manifest referenced below.

## Assumptions and remaining decisions

Canonical routes stay `/titles/`, `/title/`, `/archive/`. Keeping compatibility until Phase 8 is reversible; no retirement deadline is invented. The old editor is intentionally retained because Title Hub does not yet contain all editing controls. User understanding and Android physical-device acceptance are separate from automated Web verification.

## Data, rollback and privacy

No schema, data migration, deletion, user image upload, production deployment or dependency change. Save Title and Memory creation/deletion remain separate. No analytics event or logging sink was added. Public/UGC/image-backup gates are unchanged.

Pre-edit text snapshot: `D:/hong/Web/Anime/.moemoa-ui-audit-2026-09-07-phase5/`. `status-before.txt` records the original worktree, and `phase5-changed-files.txt` lists this task's application/test changes relative to that snapshot. To roll back, restore only this task's changes from the snapshot and remove only its newly introduced files after checking for later edits; do not reset the worktree or remove the earlier Title Hub/catalog changes. No DB rollback is necessary.

## Verification

- `npm run test:unit`: **218 passed, 0 failed** (baseline 216). New coverage protects legacy URL mapping and search counts, including draft/deleted exclusions and unavailable counts.
- `npm run build`: **15 static pages built**. The existing large-chunk warning remains; no dependency or chunk-limit suppression was added.
- `verifyAndroidStaticRoutes()` from `scripts/verify-android-static-routes.mjs`: **15 Web output routes verified**. This does not validate installed Android assets or a physical device.
- Chromium core suite (`index`, `memory-card-composer`, `memory-card-discovery`, `title-collection`, `title-hub`, `title-navigation`): **46 passed** after correcting locale-specific expectations.
- Expanded Chromium suite (`index`, `memory-card-discovery`, `memory-board`, `title-collection`, `title-hub`, `title-navigation`, `ui-readiness-functional`): **48 passed, 1 conditional skip**. The skipped case requires the dedicated visual-test server; viewport, keyboard, reflow, contrast and save/delete checks ran.
- After the search component refactors: **22/22** menu/search/navigation cases passed; the final remote-result and local-result extractions were then checked with **8/8** discovery and **4/4** navigation cases respectively. These are overlapping runs, not an additive total.
- Legacy Library and storage hydration regression coverage: **19 passed, 2 live-only cases skipped** in the broader compatibility run.
- One expanded run observed an empty page during the new reload test. A direct browser reproduction produced no page error and preserved the stored Memory. The fixture now waits for the initial My Titles screen before seeding; the focused and expanded reruns passed. No data-loss defect was reproduced.
- KO/EN key parity for `topNavDataMenu`, `globalQuickAction`, and `memoryRoutes` passed. `git diff --check` passed.
- `npx react-doctor@latest --verbose --diff`: **84/100**, versus the recorded **86/100** baseline. Final diagnostics contain **4 existing maintainability warnings** (LibraryDetailModal, MemoryCardComposer complexity/size, MemoryCardDetail), down from 5; navigation and search components have no remaining diagnostics. No rule was disabled. The numerical score regression is unresolved, so this is **not** a passing no-regression score gate; verify it before a later commit/release. Final tool evidence: `C:/Users/hongs/AppData/Local/Temp/react-doctor-68fb896c-0019-4a93-9049-0407a44ac1c5/`.
- Reviewed screenshots in `D:/hong/Web/Anime/.moemoa-ui-audit-2026-09-07-phase5/screenshots/`: `phase5-menu-ko-320.png`, `phase5-menu-en-320.png`, `phase5-search-desktop.png`. Reviewed menu order/current-page state, narrow layout and separate saved/count labels. The desktop capture uses a real persisted Memory and a populated My Titles screen.

Compatibility tests keep their old behavior assertions but explicitly enter `focus=edit`. Tests for ordinary legacy URLs exercise the new redirect. Copy assertions follow each test's selected locale. Existing screenshot goldens were not bulk replaced.

Validation limits: Chromium and local Web only; no Firefox/WebKit sweep, hosted authentication/sync acceptance, production deployment, Android sync/build/device test, or human comprehension acceptance was performed in this unit. The local Node 20 runtime differs from the package's Node >=22 requirement; the reported unit/build checks passed in that current environment.

## Next unit

Phase 6: Home and cross-surface links, first-Memory success suggestion for Memory View, and consistent Memory Detail/Board → Title Hub navigation. After the shared Web usability gate, proceed to Phase 7 Android adaptation. Production release, Public UGC, private image backup and destructive legacy cleanup remain separate gates.
