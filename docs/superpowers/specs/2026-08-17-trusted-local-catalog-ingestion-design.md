# Trusted Local Catalog Ingestion Design

> **Status:** USER REVIEW REQUIRED
> **Date:** 2026-08-17
> **Scope:** One real AniList/Wikidata/AniLife golden-10 collection on the owner's PC, including one locally stored main cover per title
> **Relationship:** Supersedes `2026-08-17-windows-cover-safe-storage-spike.md` for local test collection; that blocked spike remains historical evidence and is not resumed

## 1. Decision

MOEMOA will stop the adversarial Windows filesystem experiment and use an ordinary local-only storage model for test collection. The owner controls the PC and the external workspace, does not replace directories with junctions or symbolic links during a run, and does not run an attacker process against the collector.

The first completion gate is not another storage abstraction or synthetic fixture suite. It is a real, inspectable result for the approved ten anime targets:

- ten canonical anime records;
- actual AniList, Wikidata, and bounded AniLife public-page source results or an explicit per-source absence/failure state;
- one downloaded, structurally validated, browser-decoded main cover per target;
- a human-readable quality report showing exactly what was collected and what failed;
- no raw payload or cover bytes in Git, Vercel output, Android assets/APK, CI artifacts, or tester deliverables.

The existing 3,998-title list remains the target roster. This design does not authorize a 3,998-title network run.

## 2. Considered Approaches

### A. Trusted local workspace — selected

Use the existing external `TEST_ONLY` workspace contract, ordinary Node filesystem operations, checksum verification, temporary files, and a single collector process. This is the shortest path to real evidence and matches the user's stated local-PC-only test scope.

Trade-off: this does not defend against a malicious local process changing directory links or filesystem objects during a run.

### B. Metadata-only collection

Collect real text data while keeping cover persistence disabled on Windows. This is simpler but does not meet the user's request to verify the real data shape with covers.

### C. Hardened native or hosted image storage

Continue the native Windows backend or move covers to object storage/app-owned native storage. This may be appropriate before public distribution, but it is not required to validate ten local records and would delay the first real collection again.

## 3. Trust and Safety Boundary

The trusted-local collector must still enforce practical guardrails:

- `MOEMOA_CATALOG_LAB_DIR` is an explicit absolute path outside the repository and every Git worktree.
- `catalog:init` creates the exact `TEST_ONLY.json` sentinel only after confirming the target is outside those roots.
- Every later command requires the exact sentinel and refuses repository, worktree, build, Android, and deployment paths.
- The collector never places raw responses or images in tracked directories.
- Network access remains off unless the command includes `--allow-network`.
- AniList and AniLife records and images remain `TEST_ONLY_UNKNOWN`/`PROHIBITED`; local collection does not grant redistribution rights.
- The owner must not move, link, replace, or externally mutate the workspace during a run.

Explicit non-claim: this local mode is not secure against a malicious process, administrator, filesystem filter, junction/symlink swap, abrupt power loss, or post-run file mutation.

## 4. Local Cover Storage

Reuse the already implemented cover acquisition and validation chain:

1. accept only a cover candidate bound to an exact matched target;
2. require approved HTTPS source/origin policy and the existing bounded downloader;
3. enforce byte, MIME, signature, dimension, and Chromium JPEG/PNG/WebP decode gates;
4. compute SHA-256 before persistence;
5. write to a unique temporary file under `images/covers/anime-<uuid>/`;
6. flush and rename to `<sha256>.<jpg|png|webp>` using ordinary Node filesystem operations;
7. if the destination exists, read and verify exact size and SHA-256 before returning `EXISTING`;
8. remove the current operation's temporary file on handled failure.

The runner is single-process for the golden-10 run. Local storage promises checksum verification and repeatable deduplication, not hostile-race resistance or universal crash durability.

The abandoned PowerShell/C# Windows broker and its tests are not part of this design and must not be imported, committed, or connected.

## 5. Real Collection Flow

The next implementation adds the missing runner and CLI around the existing approved components:

```text
aliases.json (3,998-title roster)
  -> golden target manifest (10)
  -> AniList adapter
  -> Wikidata adapter
  -> bounded AniLife public-page adapter
  -> immutable raw/source records
  -> normalization + exact identity + field claims
  -> canonical anime revision
  -> main-cover download/validation/local persistence
  -> quality-report.json + quality-report.md
```

Commands:

```powershell
$env:MOEMOA_CATALOG_LAB_DIR='<absolute external folder>'
npm run catalog:init
npm run catalog:targets -- --profile golden
npm run catalog:collect -- --profile golden --sources anilist,wikidata,anilife_public --allow-network
npm run catalog:validate -- --profile golden
npm run catalog:report -- --profile golden
```

Collection is resumable. A failed source or image does not erase the last valid raw/source/canonical revision. A second identical run must add no duplicate entity, claim, canonical revision, or image.

## 6. Golden-10 Required Data

For each target, the report must show the value or an explicit `SOURCE_NOT_AVAILABLE`/failure state for:

- AniList/MAL IDs and Korean, Japanese, English, romaji/native titles and aliases;
- format, airing status, start/end dates, season/year, episode count, and duration;
- production studio, source material type, official site, and minimal genres;
- relations;
- MAIN/SUPPORTING characters and Japanese voice actors according to the existing bound;
- one main cover candidate, downloaded bytes, MIME/signature/dimensions, decoded format, checksum, byte size, and local reference.

AniLife remains a bounded cross-check source. No `/api/`, account, playback, video, history, notification, or other blocked path may be called.

## 7. Failure Handling

- A network/source failure is classified by source and target and remains resumable.
- An identity mismatch never falls back to fuzzy promotion.
- An invalid or unavailable cover preserves the text record and records the image failure.
- A corrupt existing checksum destination fails validation; it is not silently trusted or overwritten.
- Any attempted repository/build/APK path write fails before network collection.
- Rate limits and `Retry-After` remain bounded by the existing HTTP policy.

## 8. Acceptance Gate

The golden-10 phase is complete only when fresh evidence shows:

- target count: 10;
- canonical record count: 10;
- explicit field state and provenance: 100%;
- successfully downloaded and decoded main covers: 10, or the run stops with a target-by-target blocker report before any 100-title expansion;
- second-run entity/claim/canonical/image growth: 0;
- tracked/build/Android/Vercel leakage: 0 files and 0 payload matches;
- existing catalog and unit regressions pass.

After the user reviews the ten records and report, a separate approval may authorize the representative 100-title run. The 3,998-title run remains separately gated.

## 9. Immediate Implementation Boundary

The next implementation plan contains only:

1. remove the abandoned untracked Windows broker experiment from the active test surface;
2. permit ordinary trusted-local cover persistence on Windows behind the exact external-workspace brand;
3. implement the runner, CLI, resume state, validation, and report commands;
4. run and inspect the real golden-10 collection;
5. stop for user review.

Web integration, Android integration, representative-100 collection, and full-3,998 collection remain later phases.
