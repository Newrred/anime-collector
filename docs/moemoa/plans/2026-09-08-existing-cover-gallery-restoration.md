# Existing Cover Gallery Restoration ExecPlan

## 1. Purpose and user outcome

Restore the polished cover-browsing experience that already exists in the legacy Library implementation on the current `/titles/` route. Users can search by title or genre, select multiple genre tags, change filters and sort direction, resize the poster grid from 2 to 10 base columns, and browse the same title set in Poster View or Memory View.

## 2. Related confirmed decisions

- `TITLE-COLLECTION-01`: My Titles remains the union of explicitly saved titles and titles with a complete Memory.
- `TITLE-VIEW-01`: Poster View and Memory View use the same title set, search, filters, and sort state; changing views does not mutate user data.
- `LIBRARY-INTEGRATION-01`: `/library/` remains a compatibility alias to the integrated Titles surface.
- This restoration does not expose AniList as a user-facing destination or change catalog identity behavior.

## 3. Current state and repository evidence

- `src/components/Library.jsx` still contains the original genre search, multi-genre selection, `ResizeObserver` column calculation, and stored `anime:grid:perRowBase:v1` preference.
- `src/components/library/LibraryFiltersPanel.jsx` still contains the original compact search/filter/view/slider presentation.
- `src/styles/global.css` still contains the original dense poster grid and filter chip styles.
- `src/features/titles/components/TitleCollectionView.jsx` currently uses a separate large control card, title-only search, a reduced filter set, and fixed poster columns.
- Git history shows the Library gallery predates the untracked Titles implementation; the old implementation was disconnected when `/library/` became an alias of `/titles/`.

## 4. Scope

### Included

- Reuse and generalize the existing `LibraryFiltersPanel` without changing its legacy defaults.
- Restore title/genre search, multi-genre chips, full saved/watch state filtering, sort direction, and stored 2–10 column sizing on `/titles/`.
- Reuse the original compact poster card/grid classes for Poster View.
- Keep Memory View and the integrated My Titles projection intact.
- Add focused unit and browser coverage for the restored interactions and responsive layout.
- Production verification and deployment, authorized by the user on 2026-09-08 after local restoration.

### Excluded

- Catalog, database, ingestion, or identity changes.
- Reinstating the legacy Library route as a separate product surface.

## 5. Architecture and data flow

`TitleCollectionService` continues to load the saved-title/Memory union. `TitleCollectionView` derives localized genre search aliases and passes filter controls to `applyTitleCollectionQuery`. The shared `LibraryFiltersPanel` renders the existing control design using caller-provided sort, filter, and view options. The legacy column preference key drives the existing width-aware column calculation. Both Poster and Memory render from the same filtered album list.

## 6. File change map

- `src/components/library/LibraryFiltersPanel.jsx`: make existing controls reusable for Titles while retaining legacy defaults.
- `src/components/library/LibraryUi.jsx`: preserve correct radio semantics for the reused view switch.
- `src/features/titles/application/titleCollectionQuery.js`: support genre selection/search, restored filters/sorts, and sort direction.
- `src/features/titles/components/TitleCollectionView.jsx`: connect the existing gallery controls and responsive grid algorithm.
- `src/features/titles/components/TitlePosterTile.jsx`: render the original dense poster-only card presentation.
- `src/features/titles/components/TitleAlbumCard.jsx`: expose genre tags in Memory View using the existing genre chip component.
- `src/features/titles/components/title-collection.css`: remove the replacement fixed-grid styling and fit Titles to the restored gallery system.
- `src/messages/ko.js`, `src/messages/en.js`: clarify title-or-genre search copy and label restored filters/sorts.
- `tests/unit/titleCollection.test.mjs`, `tests/title-collection.spec.ts`: cover restored query and UI behavior.

## 7. Schema/data migration

None. The existing local preference `anime:grid:perRowBase:v1` is reused, so a previous user-selected grid size is restored automatically. Rollback only requires reverting the UI changes; title, Library, and Memory data remain unchanged.

## 8. Milestones

### Milestone 1 — Shared legacy control surface

- Generalize the existing filter panel through optional caller-provided options and accessible view semantics.
- Confirm the legacy `Library` call renders with its existing defaults.

### Milestone 2 — Titles gallery restoration

- Connect title/genre query, multi-genre filters, status filters, sort direction, and column sizing.
- Render Poster View with the dense original card treatment and Memory View with the same filtered set.

### Milestone 3 — Verification

- Run focused unit and Playwright tests.
- Run the production build and React Doctor.
- Inspect desktop and mobile screenshots and verify the live local page without horizontal overflow or browser errors.

## 9. Tests and acceptance

- Unit: Korean/localized genre search aliases, multi-genre OR filtering, added filter states, deterministic restored sorts, invalid-control bounds.
- Browser: Poster/Memory identity parity and preference, genre chip filtering, title/genre search, column slider persistence and effective grid columns, 320px overflow and control target sizes.
- Build: `npm run build`.
- React quality: `npx react-doctor@latest --verbose --diff` with no score regression.
- Visual acceptance: the compact legacy control panel and dense poster grid are visible at desktop and mobile sizes.

## 10. Security/privacy/rights

No new network request, personal-data field, public image behavior, or external link is introduced. Existing private-title and Memory visibility rules remain unchanged.

## 11. Analytics/observability

No new analytics event. Existing load error state remains visible. Browser verification checks console errors and page rendering.

## 12. Rollback/recovery

Revert the listed UI/query files. No database or local collection data rollback is needed. The reused column preference is an existing non-destructive UI preference.

## 13. Risks and mitigations

- Risk: changing the shared filter panel could regress legacy Library tests. Mitigation: keep current options and markup as defaults and run its browser flow.
- Risk: dense columns could make Memory cards unreadable. Mitigation: retain the original width cap algorithm with a larger minimum width for Memory View.
- Risk: localized genre search could diverge from raw catalog genres. Mitigation: index both raw and localized labels while filtering on stable raw genre values.

## 14. User decisions required

The user explicitly authorized verification and production deployment on 2026-09-08. Verify current inputs, build an isolated production candidate, validate it, promote it, and verify the production domain. Retain the previous deployment for rollback; no database migration is included.

## 15. Progress log

- [2026-09-08 09:15] Completed: traced the existing gallery through code and Git history and identified the parallel `/titles/` implementation as the source of the regression.
- [2026-09-08 09:15] Completed: confirmed the restoration can retain all current Titles/Memory product decisions and reuse the existing UI implementation.
- [2026-09-08 09:22] Completed: generalized the existing Library filter panel and connected it to `/titles/` with title/genre search, genre chips, saved/watch filters, full sorting, sort direction, and the stored column-size preference.
- [2026-09-08 09:25] Completed: restored the original dense poster-only card/grid presentation and verified desktop and 320px screenshots.
- [2026-09-08 09:28] Completed: 231 unit tests passed; the combined Library and Titles browser run passed 15 tests with 2 live-network cases skipped by design.
- [2026-09-08 09:33] Completed: production static build passed and generated all 15 route shells.
- [2026-09-08 09:33] Completed: React Doctor remained at 71/100 while changed-code warnings decreased from 7 to 6; the restored shared filter component has no remaining diagnostic.
- [2026-09-08 09:33] Completed: agent-browser verified meaningful `/titles/` content, Poster View, watch-state filtering, persisted 8-column preference, 9 effective desktop columns, no error overlay, and navigation back to Home.

## 16. Discoveries and plan changes

- The original gallery was not deleted. Its component, styling, storage preference, and responsive calculation are still present, so a direct restoration is lower risk than recreating the design.

## 17. Completion report

Completed locally and deployed to production on 2026-09-08.

- Result: `/titles/` now uses the existing Library filter panel and dense poster gallery instead of the replacement fixed-grid control card.
- Preserved behavior: My Titles union, Poster/Memory identity parity, view preference, Title Hub links, and `/library/` compatibility route.
- Restored behavior: title/genre search, localized genre matching, genre chips, complete status filters, score/year/genre sorting, sort direction, clickable genres in Memory View, and the prior 2–10 base-column preference.
- Validation: `npm run test:unit` (231/231), focused Playwright Library/Titles run (15 passed, 2 live-only skipped), `npm run build` (15 routes), React Doctor (71/100, 6 unrelated existing warnings), and agent-browser desktop verification all passed.
- Migration: none. Existing user collection and Memory data are untouched; the prior `anime:grid:perRowBase:v1` preference is reused.
- Rollback: revert the listed UI/query files. No data recovery step is required.
- Deployment: user approval received; candidate `dpl_7CswVCMgTNWLU8vzh7A3ULPCeGxm` promoted to `https://www.moemoa.xyz`. Focused recheck passed 5 unit and 11 browser tests. Candidate and production each passed 14 smoke checks. All 78 live output files matched the audited build (63 byte-identical, 15 HTML matched after normalization of build/hosting fields).
- Release evidence and production rollback: `../reports/2026-09-08-gallery-production.md`.
