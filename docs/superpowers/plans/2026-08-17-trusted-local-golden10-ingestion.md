# Trusted Local Golden-10 Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the first real, inspectable MOEMOA catalog result by collecting the approved ten AniList targets from AniList, Wikidata, and bounded AniLife public pages, storing one validated main cover per target in an external local-only workspace, and generating a quality report.

**Architecture:** Keep the existing source adapters, immutable raw store, normalization, exact identity, FieldClaim, canonical revision, and cover validation chain. Replace only the over-scoped Windows platform prohibition with a documented trusted-local workspace model, then add a small resumable artifact store, runner, CLI, and report layer. Real payloads and covers remain outside Git and are never distributed.

**Tech Stack:** Node.js 24.19.0 ESM, `node:test`, Windows 11 ordinary local NTFS filesystem operations, existing Playwright Chromium, AniList GraphQL, Wikidata HTTP APIs, bounded AniLife sitemap/content HTML, no new npm/NuGet dependency.

## Global Constraints

- Approved design: `docs/superpowers/specs/2026-08-17-trusted-local-catalog-ingestion-design.md`.
- Work only in the linked worktree `codex/catalog-lab-10-to-100`; never change or push `master` during this plan.
- Use bundled Node from `C:\Users\hongs\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin` and verify `v24.19.0` in every task report.
- The owner controls the PC/workspace and does not mutate links or directories during a run. Do not claim malicious-local-process, reparse-race, administrator, crash-durability, or power-loss resistance.
- `MOEMOA_CATALOG_LAB_DIR` must be absolute, outside the repository and every Git worktree, and contain the exact `TEST_ONLY.json` sentinel.
- Actual raw payloads, canonical records, bindings, reports, and cover bytes stay under the external workspace only. Never add them to Git, build output, Android assets/APK, Vercel output, CI artifacts, or tester deliverables.
- Network is opt-in through exact `--allow-network`; source target count is at most 10 in this plan.
- AniList and AniLife data/images remain `TEST_ONLY_UNKNOWN`/`PROHIBITED`; Wikidata field claims retain their CC0/review policy. No production promotion or redistribution is authorized.
- No `/api/`, authenticated, playback, history, notification, archive, settings, login, video, subtitle, comment, or other blocked AniLife path.
- Main cover only; no banner, character, voice-actor, or video images.
- Source requests and cover downloads are serial and respect registry minimum intervals. No new dependency, native helper, executable, PowerShell broker, service, admin setting, or system-policy change.
- The first hard acceptance gate is ten canonical records and ten decoded/stored covers. A missing target or cover produces a blocker report and stops before any 100-title work.
- Do not implement Web/Android integration, sample100 collection, full-3,998 collection, review-model integration, or production publishing in this plan.

---

### Task 1: Remove the abandoned native experiment and enable trusted-local Windows cover persistence

**Files:**
- Delete untracked: `tools/catalog-lab/windows/cover-store-native.cs`
- Delete untracked: `tools/catalog-lab/windows/cover-store-broker.ps1`
- Delete untracked: `tools/catalog-lab/lib/windows-cover-store.mjs`
- Delete untracked: `tests/catalog-lab/windows-cover-storage.test.mjs`
- Modify: `tools/catalog-lab/pipeline/covers.mjs`
- Modify: `tests/catalog-lab/cover-validation.test.mjs`

**Interfaces:**
- Consumes: an authenticated `workspace` returned only by `openCatalogWorkspace()`, a module-branded decoded production `CoverRecord`, and a safe `anime:<uuid>`.
- Produces: the existing `storeValidatedCover({record, workspace, animeId})` and `createCoverStorageTestHarness().storeFixture(...)` on Windows and non-Windows with the same trusted-local semantics.
- Does not produce: a native broker, a new public trust-minting API, or any security claim against concurrent malicious filesystem mutation.

- [ ] **Step 1: Replace the Windows fail-closed assertions with failing trusted-workspace tests**

In `tests/catalog-lab/cover-validation.test.mjs`, remove the Windows skip from the existing immutable fixture-storage test and replace the platform-fail-closed test with these behaviors:

```js
test('trusted external workspace stores and deduplicates validated fixture covers on every platform', async () => {
  await withWorkspace(async (workspace) => {
    const storage = createCoverStorageTestHarness();
    const first = await storage.storeFixture({
      bytes: pngBytes, declaredMime: 'image/png', workspace, animeId,
    });
    const second = await storage.storeFixture({
      bytes: pngBytes, declaredMime: 'image/png', workspace, animeId,
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.localRef, first.localRef);
    assert.deepEqual(new Uint8Array(await readFile(
      workspace.resolve(...first.localRef.split('/')),
    )), pngBytes);
  });
});

test('trusted-local cover persistence rejects a forged workspace before filesystem access', async () => {
  const storage = createCoverStorageTestHarness();
  let accesses = 0;
  const workspace = new Proxy({}, {
    get() { accesses += 1; throw new Error('forged workspace reached path access'); },
  });
  await assert.rejects(storage.storeFixture({
    bytes: pngBytes, declaredMime: 'image/png', workspace, animeId,
  }), { code: 'CATALOG_WORKSPACE_UNTRUSTED' });
  assert.equal(accesses, 0);
});
```

The forged-workspace behavior must be enforced by the existing private workspace brand, not by checking object shape.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
$env:PATH='C:\Users\hongs\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
node --test --test-name-pattern="trusted external workspace|trusted-local cover persistence|validated cover storage" tests/catalog-lab/cover-validation.test.mjs
```

Expected on Windows: the real authenticated-workspace cases fail only with `COVER_STORAGE_PLATFORM_UNSAFE`; the forged workspace remains rejected without creating a directory.

- [ ] **Step 3: Remove only the platform prohibition and preserve the existing storage trust chain**

In `tools/catalog-lab/pipeline/covers.mjs`:

- remove `assertProductionStoragePlatformSafe()` and both calls to it;
- do not add a platform flag, environment override, native helper import, or alternate persistence implementation;
- keep `COVER_RECORDS`, `PRODUCTION_COVER_RECORDS`, and `COVER_BYTES` private;
- keep the production record-brand check before any workspace access;
- keep `persistCoverBytes()` using `assertCatalogWorkspaceMutation()`, unique `wx` temporary creation, file sync, no-overwrite hard-link publication, exact size/hash verification, and handled temporary cleanup;
- make `createCoverStorageTestHarness().storeFixture()` call `assertCatalogWorkspaceMutation(workspace, [])` before converting/inspecting bytes so a forged workspace fails before any filesystem-dependent work.

No native Windows code survives this task.

- [ ] **Step 4: Delete the four abandoned untracked files with `apply_patch` and verify the active test surface**

After deletion, run:

```powershell
git ls-files --others --exclude-standard
rg -n "windows-cover-store|cover-store-native|cover-store-broker" tools tests
```

Expected: no abandoned file and no import/reference remains.

- [ ] **Step 5: Run focused and full regressions**

Run:

```powershell
node --test tests/catalog-lab/cover-validation.test.mjs
node tests/catalog-lab/run-tests.mjs
npm run test:unit
```

Expected: all pass with no Windows storage skip for the trusted fixture path. The existing injection tests must still prove that synthetic transports cannot mint a production-storable cover.

- [ ] **Step 6: Commit Task 1 and stop for task review**

```powershell
git add tools/catalog-lab/pipeline/covers.mjs tests/catalog-lab/cover-validation.test.mjs
git commit -m "feat(catalog): allow trusted local cover storage"
```

Commit only those two tracked files. Confirm the four abandoned untracked files are absent and no payload/image/sentinel/native binary is tracked.

---

### Task 2: Add a resumable golden-10 artifact store and collection runner

**Files:**
- Create: `tools/catalog-lab/pipeline/artifact-store.mjs`
- Create: `tools/catalog-lab/pipeline/runner.mjs`
- Create: `tests/catalog-lab/runner-resume.test.mjs`

**Interfaces:**
- `createCatalogArtifactStore({workspace})` produces immutable JSON persistence methods for manifest, ID map, bindings, normalized records, claims, canonical revisions, current pointers, cover observations, and run snapshots.
- `createRateLimitedHttpClient({http, minIntervalMs, now, sleep})` serializes one source's requests and waits so request starts are at least `minIntervalMs` apart.
- `runCatalogPipeline({workspace, targets, registry, adapters, bindings, selectedSources, allowNetwork, refresh, clock, httpFactory, coverPipeline})` returns a frozen run summary and never accepts more than ten targets in this plan.
- `createDefaultCoverPipeline()` builds candidates only from exact-matched normalized cover fields, uses the concrete pinned downloader and production Chromium decoder, stores at most one selected main cover per target, and returns a classified observation.

- [ ] **Step 1: Write failing artifact, resume, rate-limit, partial-failure, and cover-isolation tests**

Create `tests/catalog-lab/runner-resume.test.mjs` using OS-temporary authenticated workspaces, the existing valid source-envelope shapes, and synthetic injected adapters. Include these tests:

```js
test('artifact store persists one stable target manifest and immutable canonical current pointer', async () => {
  await withWorkspace(async (workspace) => {
    const store = createCatalogArtifactStore({ workspace });
    await store.writeManifest('golden', [target]);
    assert.deepEqual(await store.readManifest('golden'), [target]);
    const written = await store.writeCanonical({
      target, sourceRecords, normalizedRecords, claims, canonical,
    });
    assert.equal((await store.readCurrent(target.moemoaAnimeId)).contentHash,
      canonical.revision.contentHash);
    assert.equal(written.created, true);
    assert.equal((await store.writeCanonical({
      target, sourceRecords, normalizedRecords, claims, canonical,
    })).created, false);
  });
});

test('rate-limited source client spaces serialized request starts by the registry minimum', async () => {
  let time = 0;
  const starts = [];
  const client = createRateLimitedHttpClient({
    http: { async request(input) { starts.push(time); return new Response('{}'); } },
    minIntervalMs: 800,
    now: () => time,
    sleep: async (milliseconds) => { time += milliseconds; },
  });
  await client.request({ url: 'https://example.test/1' });
  await client.request({ url: 'https://example.test/2' });
  assert.deepEqual(starts, [0, 800]);
});

test('runner resumes completed source-target stages without duplicate records or images', async () => {
  const first = await runFixturePipeline();
  const second = await runFixturePipeline();
  assert.deepEqual(second.counts, first.counts);
  assert.equal(second.canonicalHash, first.canonicalHash);
  assert.equal(second.growth.sourceRecords, 0);
  assert.equal(second.growth.claims, 0);
  assert.equal(second.growth.canonicalRevisions, 0);
  assert.equal(second.growth.images, 0);
});

test('one source failure is classified and does not erase another source or the last canonical revision', async () => {
  const first = await runFixturePipeline();
  const second = await runFixturePipeline({ wikidataFailure: Object.assign(new Error('down'), {
    code: 'SOURCE_RETRY_EXHAUSTED', recoverable: true,
  }), refresh: true });
  assert.equal(second.targets[0].sources.wikidata.stage, 'FAILED_RETRYABLE');
  assert.equal(second.targets[0].sources.anilist.stage, 'COMPLETED');
  assert.equal(second.targets[0].currentCanonicalHash, first.canonicalHash);
});

test('runner rejects network omission, target overflow, unregistered sources, and forged workspaces before adapters run', async () => {
  // Assert CATALOG_NETWORK_PERMISSION_REQUIRED, SOURCE_SCOPE_EXCEEDED,
  // SOURCE_NOT_REGISTERED, and CATALOG_WORKSPACE_UNTRUSTED respectively.
});
```

The fixture cover pipeline returns a classified observation and bytes count but cannot brand a production `CoverRecord`. The runner test asserts only its injected interface; Task 1 retains the production trust tests.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
node --test tests/catalog-lab/runner-resume.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for `artifact-store.mjs` or `runner.mjs` before implementation.

- [ ] **Step 3: Implement the bounded artifact store**

`tools/catalog-lab/pipeline/artifact-store.mjs` must export:

```js
export function createCatalogArtifactStore({ workspace }) {
  return Object.freeze({
    readIdMap, writeIdMap,
    readManifest, writeManifest,
    readAniLifeBindings, writeAniLifeBinding,
    readSourceRecord,
    writeNormalized,
    writeCanonical, readCurrent,
    writeCoverObservation,
    readRunSnapshot, writeRunSnapshot,
  });
}
```

Use only `workspace.resolve(...)`, `assertCatalogWorkspaceMutation(...)`, `atomicWriteJson(...)`, content hashes, and safe `toPathKey(...)` segments. Persist under:

```text
manifests/golden.json
state/id-map.json
bindings/anilife.json
normalized/<source>/<target>/<sourceRecordId>.json
claims/<anime-path>/<claimId>.json
canonical/<anime-path>/<contentHash>.json
current/<anime-path>.json
covers/<anime-path>.json
runs/golden/current.json
```

`writeCanonical({target,sourceRecords,normalizedRecords,claims,canonical})` rebuilds the canonical revision with `buildCanonicalRevision({target,sourceRecords,normalizedRecords,fieldClaims:claims})`, requires exact stable equality with `canonical`, then creates immutable hash-addressed revision/claim/normalized files without overwriting different bytes and atomically advances `current`. Existing same-hash content returns `{created:false}`. A different object at the same content-addressed path throws `CATALOG_ARTIFACT_COLLISION`.

Bindings contain only:

```js
{
  [targetKey]: {
    contentId: '123',
    evidence: 'MANUAL_PUBLIC_PAGE_REVIEW'
  }
}
```

No absolute path is written into any artifact.

- [ ] **Step 4: Implement the serial runner and exact state machine**

`tools/catalog-lab/pipeline/runner.mjs` must export:

```js
export const JOB_STATES = Object.freeze([
  'PENDING', 'FETCHED', 'NORMALIZED', 'MATCHED', 'CLAIMS_BUILT',
  'IMAGE_VALIDATED', 'COMPLETED', 'FAILED_RETRYABLE',
  'FAILED_PERMANENT', 'PENDING_REVIEW', 'SOURCE_PAUSED',
]);

export function createRateLimitedHttpClient({ http, minIntervalMs, now, sleep });
export function createDefaultCoverPipeline();
export async function runCatalogPipeline(input);
export async function validateGoldenArtifacts({ workspace, targets });
```

Runner rules:

1. authenticate `workspace` with `assertCatalogWorkspaceMutation(workspace, [])` before reading run inputs;
2. require `allowNetwork === true`, `targets.length === 10`, `selectedSources` to be a non-empty unique subset of `anilist,wikidata,anilife_public`, and every source to pass `assertSourceExecution()`;
3. collect one target at a time so one adapter exception cannot abort later targets;
4. create exactly one serial rate-limited HTTP client per selected source outside the target loop, then pass it to every call for that source using the registry `minIntervalMs` and `maxConcurrency=1`;
5. store the immutable envelope with `storeSourceEnvelope()`, read the resulting `SourceRecord`, normalize with `normalizeSourceRecord()`, persist it, and checkpoint the exact stage;
6. after each source update, reload every available current source record for that target—including previously completed sources not selected in the current command—then build claims with `buildFieldClaims()` and canonical revisions with `buildCanonicalRevision({target,sourceRecords,normalizedRecords,fieldClaims})`;
7. preserve the previous current revision if refreshed sources cannot produce an authenticated replacement;
8. reuse an already valid stored cover observation unless `refresh === true`; otherwise create cover candidates from normalized `cover` field values plus `resolveIdentity()` results, reject ambiguous identity, download/decode/store serially, and select exactly one stored main cover;
9. classify every error into the finite job states without storing free-form response bodies or stack traces;
10. write a run snapshot with counts, per-target/source states, cover observation, current canonical hash, and growth counts.

Default cover flow:

```js
const sniffed = await downloadCoverCandidate({
  candidate, policy: getApprovedCoverSourcePolicy(candidate.sourceId), transport,
});
const decoded = await decodeCoverWithChromium({ record: sniffed });
const stored = await storeValidatedCover({
  record: decoded, workspace, animeId: target.moemoaAnimeId,
});
```

Try exact candidates in deterministic identity/source-record/URL order until one succeeds. Store the selected observation only; retain classified failures in the run snapshot. Never downgrade a text record because its cover fails.

- [ ] **Step 5: Run Task 2 and regressions**

Run:

```powershell
node --test tests/catalog-lab/runner-resume.test.mjs
node tests/catalog-lab/run-tests.mjs
npm run test:unit
```

Expected: all pass; the runner suite proves zero-growth resume, source isolation, stable canonical hash, workspace authentication, and finite failure states without network.

- [ ] **Step 6: Commit Task 2 and stop for task review**

```powershell
git add tools/catalog-lab/pipeline/artifact-store.mjs tools/catalog-lab/pipeline/runner.mjs tests/catalog-lab/runner-resume.test.mjs
git commit -m "feat(catalog): add resumable golden collection runner"
```

---

### Task 3: Add the golden-only CLI, validation, quality report, and leakage guard

**Files:**
- Create: `tools/catalog-lab/reports/quality-report.mjs`
- Create: `tools/catalog-lab/cli.mjs`
- Create: `tests/catalog-lab/runner-cli-report.test.mjs`
- Modify: `package.json`

**Interfaces:**
- `buildQualityReport({workspace, profile:'golden'})` returns frozen JSON-safe report data.
- `renderQualityReportMarkdown(report)` returns a deterministic readable Markdown report.
- `runCli(argv, dependencies)` returns `CLI_EXIT.OK|QUALITY_GATE_FAILED|SOURCE_PAUSED|USAGE_OR_SAFETY` and writes only concise progress/errors to stdout/stderr.
- Supported commands are exactly `init`, `targets`, `bind-anilife`, `collect`, `validate`, `report`, and `guard` for this plan.

- [ ] **Step 1: Write failing CLI and report tests**

Create `tests/catalog-lab/runner-cli-report.test.mjs` with subprocess tests and injected `runCli` tests:

```js
test('CLI refuses collection without exact network permission or with a non-golden profile', async () => {
  assert.equal(await runCli(['collect', '--profile', 'golden']), CLI_EXIT.USAGE_OR_SAFETY);
  assert.equal(await runCli([
    'collect', '--profile', 'sample100', '--sources', 'anilist', '--allow-network',
  ]), CLI_EXIT.USAGE_OR_SAFETY);
});

test('init and targets create only an external sentinel, stable ID map, and ten-target manifest', async () => {
  assert.equal(await runCli(['init'], deps), CLI_EXIT.OK);
  assert.equal(await runCli(['targets', '--profile', 'golden'], deps), CLI_EXIT.OK);
  const manifest = JSON.parse(await readFile(join(workspaceRoot, 'manifests', 'golden.json')));
  assert.equal(manifest.length, 10);
  assert.equal(new Set(manifest.map((row) => row.moemoaAnimeId)).size, 10);
});

test('bind-anilife stores only a manifest target and numeric reviewed public content id', async () => {
  assert.equal(await runCli([
    'bind-anilife', '--anilist-id', '1', '--content-id', '123',
  ], deps), CLI_EXIT.OK);
  assert.equal(await runCli([
    'bind-anilife', '--anilist-id', '../1', '--content-id', 'https://evil.test/x',
  ], deps), CLI_EXIT.USAGE_OR_SAFETY);
});

test('quality report exposes ten target/source/field/cover states and no raw payload', async () => {
  const report = await buildQualityReport({ workspace, profile: 'golden' });
  assert.equal(report.targetCount, 10);
  assert.equal(report.targets.length, 10);
  assert.equal(JSON.stringify(report).includes('rawPayloadRef'), false);
  assert.equal(JSON.stringify(report).includes('payload'), false);
  assert.equal(report.targets.every((row) => row.sources.anilist && row.cover), true);
});
```

Also test `guard` against synthetic sentinel/raw/image signatures placed in a temporary tracked/build-shaped tree; it must return `QUALITY_GATE_FAILED` and identify only relative paths, never payload contents.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
node --test tests/catalog-lab/runner-cli-report.test.mjs
```

Expected: `ERR_MODULE_NOT_FOUND` for `cli.mjs` or `quality-report.mjs`.

- [ ] **Step 3: Implement deterministic quality JSON and Markdown**

`quality-report.mjs` exports:

```js
export const QUALITY_SCHEMA_VERSION = 1;
export async function buildQualityReport({ workspace, profile });
export function renderQualityReportMarkdown(report);
export async function writeQualityReport({ workspace, profile });
```

JSON top-level shape:

```js
{
  schemaVersion: 1,
  profile: 'golden',
  generatedAt,
  targetCount,
  canonicalCount,
  coverStoredCount,
  sourceStateCounts,
  fieldStateCounts,
  growth,
  gate: { passed, blockers },
  targets: [{
    targetKey, moemoaAnimeId, displayTitle,
    sources, fieldStates, canonicalHash,
    cover: { status, sourceId, checksum, byteSize, width, height, localRef, errorCode },
  }],
}
```

The report contains no raw payload, source URL, image bytes, absolute workspace path, stack, or free-form remote error. Markdown lists the ten targets, required-field state, source state, cover checksum/dimensions, and blockers.

- [ ] **Step 4: Implement exact CLI commands and package scripts**

`tools/catalog-lab/cli.mjs` exports and invokes:

```js
export const CLI_EXIT = Object.freeze({
  OK: 0, QUALITY_GATE_FAILED: 2, SOURCE_PAUSED: 3, USAGE_OR_SAFETY: 64,
});
export async function runCli(argv, dependencies = {});
```

Command behavior:

- `init`: `openCatalogWorkspace({repoRoot,workspaceRoot,create:true})` only.
- `targets --profile golden`: load `src/data/aliases.json`, read/write external `state/id-map.json`, call `buildTargetManifest()`, and persist exactly ten targets. Re-running returns the identical manifest and IDs.
- `bind-anilife --anilist-id <digits> --content-id <digits>`: require an existing manifest target, call `validateAniLifeBinding()`, and store `MANUAL_PUBLIC_PAGE_REVIEW` binding externally.
- `collect --profile golden --sources <csv> --allow-network [--refresh]`: create the approved source adapters, registry-derived HTTP clients, and `runCatalogPipeline()`.
- `validate --profile golden`: call `validateGoldenArtifacts()` and exit 2 unless all ten canonical/current records and cover observations are internally valid.
- `report --profile golden`: write `reports/golden/quality-report.json` and `.md`; exit 2 while blockers remain, but always leave the report.
- `guard`: scan only Git tracked files plus existing `dist`, `android/app/src`, test-output, and Vercel output roots for `TEST_ONLY.json`, known raw-record keys, external `localRef` payloads, or image signatures. Never scan/delete the external workspace.

Use `process.exitCode`, never `process.exit()`, so cleanup completes.

Add package scripts:

```json
"catalog:test": "node tests/catalog-lab/run-tests.mjs",
"catalog:init": "node tools/catalog-lab/cli.mjs init",
"catalog:targets": "node tools/catalog-lab/cli.mjs targets",
"catalog:bind-anilife": "node tools/catalog-lab/cli.mjs bind-anilife",
"catalog:collect": "node tools/catalog-lab/cli.mjs collect",
"catalog:validate": "node tools/catalog-lab/cli.mjs validate",
"catalog:report": "node tools/catalog-lab/cli.mjs report",
"catalog:guard": "node tools/catalog-lab/cli.mjs guard"
```

Do not remove the unrelated existing Web/Android scripts.

- [ ] **Step 5: Run Task 3 and application regressions**

Run:

```powershell
node --test tests/catalog-lab/runner-cli-report.test.mjs
npm run catalog:test
npm run test:unit
npm run build
npm run catalog:guard
```

Expected: all pass; the guard reports zero leaked actual payloads/covers/sentinels.

- [ ] **Step 6: Commit Task 3 and stop for task review**

```powershell
git add tools/catalog-lab/reports/quality-report.mjs tools/catalog-lab/cli.mjs tests/catalog-lab/runner-cli-report.test.mjs package.json
git commit -m "feat(catalog): add golden collection CLI and report"
```

---

### Task 4: Run the real golden-10 collection and produce external evidence

**Files:**
- External only: `D:\hong\MOEMOA_CATALOG_LAB_TEST\TEST_ONLY.json`
- External only: all manifests, bindings, raw/source/normalized/claim/canonical/current/cover/run/report files below that workspace
- Modify no tracked source or data file during the live run
- Report only: `.superpowers/sdd/2026-08-17-trusted-local-golden10-ingestion/task-4-report.md`

**Interfaces:**
- Consumes: the reviewed Tasks 1–3 CLI and the approved golden IDs `1,121,5114,7902,21519,227,120377,112151,129874,131681`.
- Produces: ten external current canonical records, ten external decoded main covers, source state for all three sources, and `quality-report.json/.md`.
- Never produces: a tracked data commit or a 100/3,998-title request.

- [ ] **Step 1: Initialize or safely resume the explicit external workspace**

```powershell
$catalogLabRoot='D:\hong\MOEMOA_CATALOG_LAB_TEST'
$env:MOEMOA_CATALOG_LAB_DIR=$catalogLabRoot
npm run catalog:init
npm run catalog:targets -- --profile golden
```

If the directory already exists without the exact sentinel, do not delete or overwrite it; use a new sibling ending `-2` and record the chosen path only in the ignored task report.

Verify:

```powershell
(Get-Content -LiteralPath (Join-Path $catalogLabRoot 'manifests\golden.json') -Raw | ConvertFrom-Json).Count
```

Expected: `10`.

- [ ] **Step 2: Collect real AniList and Wikidata data plus AniList covers**

```powershell
npm run catalog:collect -- --profile golden --sources anilist,wikidata --allow-network
npm run catalog:report -- --profile golden
```

An interim report may exit 2 because AniLife is not yet bound. Inspect only the external report and classified errors. Do not paste raw payloads or image bytes into Git/task reports.

Expected before continuing: ten AniList source records, ten canonical current records, and ten decoded/stored covers. If any target or cover is missing, stop Task 4 with the target/error-code blocker rather than expanding scope.

- [ ] **Step 3: Manually review and bind ten AniLife public content pages**

For each target, use the AniList titles/year/episode count from the external report and only AniLife's public sitemap/content pages to identify one exact numeric `/content/<id>` page. Do not call or infer `/api/` endpoints.

For every proven mapping run:

```powershell
npm run catalog:bind-anilife -- --anilist-id <numeric> --content-id <numeric>
```

Record only the ten `AniList ID -> AniLife content ID` pairs and public page URLs in the ignored task report. If a unique exact public page cannot be proven, record `NO_EXACT_BINDING` for that target; do not guess or use fuzzy matching. Task 4 remains blocked until the user decides whether that explicit AniLife absence is acceptable.

- [ ] **Step 4: Collect the bound AniLife pages and rebuild canonical revisions**

```powershell
npm run catalog:collect -- --profile golden --sources anilife_public --allow-network
npm run catalog:validate -- --profile golden
npm run catalog:report -- --profile golden
```

Expected: ten target rows, three classified source states per row, ten authenticated current canonical revisions, and ten stored covers.

- [ ] **Step 5: Run the zero-growth second pass and leakage gate**

```powershell
npm run catalog:collect -- --profile golden --sources anilist,wikidata,anilife_public --allow-network
npm run catalog:validate -- --profile golden
npm run catalog:report -- --profile golden
npm run catalog:guard
```

Expected quality report:

```text
targetCount = 10
canonicalCount = 10
coverStoredCount = 10
growth.sourceRecords = 0
growth.claims = 0
growth.canonicalRevisions = 0
growth.images = 0
gate.passed = true
```

- [ ] **Step 6: Run final code regressions without moving external data**

```powershell
npm run catalog:test
npm run test:unit
npm run build
npm run catalog:guard
git status --short
```

Expected: tests/build/guard pass; no external payload, image, sentinel, report, binding, or workspace path appears in tracked/untracked Git status.

- [ ] **Step 7: Write the ignored evidence report and stop for user inspection**

The report records commands, exit codes, counts, target titles, source state/error codes, canonical hashes, cover checksums/dimensions/local references, first/second growth comparison, and leakage result. It must not include raw payload bodies, image bytes, or a committed absolute workspace path.

Do not commit live data. Stop before sample100 and show the user the external quality-report file and a concise ten-title result summary.
