# AniList·Wikidata·AniLife 로컬 카탈로그 랩 Implementation Plan / ExecPlan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **계획 상태: `IN PROGRESS — GOLDEN 10 COMPLETE, SAMPLE100 APPROVED`**
> 작성일: 2026-08-17
> 기준 저장소: `master@bb89002`
> 승인 설계: `docs/superpowers/specs/2026-08-17-three-source-local-catalog-lab-design.md`
> 대량 수집 상태: `FULL-CATALOG-INGESTION-GATE-01` 미통과
> 표본 수집 상태: `REPRESENTATIVE-100-INGESTION-01` 2026-08-18 승인; target manifest 검증 후 AniList + Wikidata 실행

**Goal:** 기존 3,998개 `legacy_unverified` 목록을 target roster로 사용해 AniList·Wikidata·AniLife 공개 페이지의 로컬 10→100 표본을 안전하게 수집·정규화·검증하고, 외부 네트워크 없이 Web 제목 검색에서 읽을 수 있는 테스트 카탈로그를 만든다.

**Architecture:** Node 22 기반 수집기를 Web/Android runtime과 분리하고, repository 밖 `TEST_ONLY` workspace에 `SourceRecord → FieldClaim → CanonicalAnime` revision을 만든다. source adapter는 raw 후보만 반환하고, 결정론적인 pipeline이 identity·claim·canonical·cover·report를 조립한다. Web은 loopback 전용 catalog server와 `TitleResolver` port를 통해 텍스트 사실만 읽으며 실제 표지 bytes와 source payload를 받지 않는다.

**Tech Stack:** Node.js 22 ESM, 내장 `fetch`/`crypto`/filesystem, 기존 `node:test`, 기존 Playwright Chromium, Astro 5, React 19. 신규 production/dev dependency 없음.

## Global Constraints

- 구현 기준은 `docs/superpowers/specs/2026-08-17-three-source-local-catalog-lab-design.md`다.
- 전체 범위는 골든 10개와 대표 100개뿐이다. 3,998개 전체 네트워크 수집은 실행하지 않는다.
- 실제 payload·cover·canonical snapshot은 `MOEMOA_CATALOG_LAB_DIR`가 가리키는 Git worktree 밖 절대 경로에만 쓴다.
- `TEST_ONLY.json` sentinel이 없거나 workspace가 repository 내부이면 write·download·serve를 거부한다.
- AniList와 AniLife claim은 `catalogPromotion=PROHIBITED`, cover는 `rightsStatus=TEST_ONLY_UNKNOWN`, `distributionStatus=PROHIBITED`다.
- AniLife는 공개 sitemap과 `/content/{numericId}` HTML만 사용한다. `/api/`, `/archive`, 영상·재생·댓글 데이터는 요청하지 않는다.
- AniLife content ID는 사람이 확인한 local binding만 사용한다. sitemap 전체 페이지를 제목 탐색 목적으로 순회하지 않는다.
- AniList character connection은 MAIN/SUPPORTING과 일본어 성우만 수집하며 페이지당 25개를 끝까지 순회한다.
- 배너·캐릭터 이미지·성우 이미지·영상은 수집하지 않는다.
- source adapter는 canonical snapshot을 직접 수정하지 않는다.
- source 충돌은 자동 overwrite하지 않는다.
- 실제 수집은 `--allow-network`가 있을 때만 시작한다.
- CI와 기본 `npm run test:unit`은 외부 네트워크를 호출하지 않는다.
- 기존 `src/data/aliases.json`, IndexedDB, Memory Card, 사용자 이미지에는 migration이나 destructive write를 하지 않는다.
- 저비용 모델은 이 계획에서 API로 연결하지 않는다. review batch의 구조화 export/import 계약만 구현한다.
- 각 task는 RED → GREEN → 관련 회귀 → 명시된 파일만 commit 순서로 진행한다.

---

## 1. 목적과 사용자 결과

구현 완료 후 개발자는 다음 순서로 작업할 수 있다.

```powershell
$env:MOEMOA_CATALOG_LAB_DIR = 'D:\moemoa-catalog-lab-data'
npm run catalog:init
npm run catalog:targets -- --profile golden
npm run catalog:collect -- --profile golden --sources anilist,wikidata,anilife_public --allow-network
npm run catalog:validate -- --profile golden
npm run catalog:targets -- --profile sample100
npm run catalog:collect -- --profile sample100 --sources anilist,wikidata,anilife_public --allow-network
npm run catalog:validate -- --profile sample100
npm run catalog:web
```

사용자 결과:

- 작품 제목, 방영·형식·화수·상태, 제작사, 원작 유형, 공식 사이트, 장르, 관계 작품, MAIN/SUPPORTING 캐릭터, 일본어 성우, 메인 표지 후보를 출처와 함께 확인할 수 있다.
- source가 실패하거나 값이 충돌해도 이전 canonical revision이 유지된다.
- 같은 명령을 다시 실행해도 entity·claim·cover 복사본이 늘어나지 않는다.
- Web 카드 작성 화면이 local sample catalog의 제목·별칭·장르를 외부 네트워크 없이 검색한다.
- 실제 표지와 raw payload는 Web build·APK·Git에 포함되지 않는다.

## 2. 관련 확정 결정

| 결정·게이트 | 적용 방식 |
| --- | --- |
| `CATALOG-01` | 3,998개는 target roster이며 public verified catalog로 자동 승격하지 않음 |
| `CATALOG-02` | 필요한 사실 필드를 자체 schema와 내부 ID로 정규화 |
| `LEGACY-01` | `aliases.json`을 수정·삭제하지 않고 `LEGACY_UNVERIFIED` seed로만 읽음 |
| `SOURCE-01` | 이번 승인 범위는 100개 local technical sample뿐이며 production 등급은 계속 gated |
| `TAG-01` | 13개 core genre mapping은 `TEST_ONLY` 기술 표본이며 production 어휘 확정으로 간주하지 않음 |
| `FULL-CATALOG-INGESTION-GATE-01` | 100개 품질 보고와 별도 사용자 승인 전 3,998개 실행 차단 |
| `CARD-01` | catalog cover는 사용자 Memory Card VisualAsset으로 복사하지 않음 |
| `STORAGE-LOCAL-01` | catalog lab workspace와 Android app-private media를 완전히 분리 |

## 3. 현재 상태와 저장소 증거

- `src/data/aliases.json`: `anilistId`, `ko`, `aliases`만 가진 3,998개 legacy rows.
- `src/lib/anilist.js`, `src/lib/wikidata.js`: 브라우저 runtime provider 코드이며 ingestion provenance·checkpoint가 없음.
- `src/features/memory/adapters/catalog/legacyAliasTitleResolver.js`: legacy alias를 `LEGACY_UNVERIFIED`로 투영.
- `src/features/memory/adapters/catalog/anilistTitleResolver.js`: AniList 제목 후보를 `PROVIDER_CANDIDATE`로 투영하되 artwork URL은 제거.
- `src/features/memory/domain/memoryDomain.js`: 현재 `ANILIST` source binding만 허용하므로 internal catalog adapter를 연결하려면 `MOEMOA` candidate 조합을 명시적으로 추가해야 함.
- `tests/unit/run-tests.mjs`: `tests/unit/*.test.mjs` 자동 import.
- `scripts/run-e2e.mjs`: Astro dev server와 Playwright를 조합한 기존 회귀 기반.
- `package.json`: 존재하지 않고 `.gitignore`에 포함된 과거 AniLife collector script 네 개를 아직 참조함.
- 현재 신규 catalog collector, Source Registry 실물, raw staging, canonical snapshot, 품질 report는 없음.

구현 시작 기준선:

```powershell
npm run test:unit
npm run build
npm run test:e2e -- tests/memory-card-composer.spec.ts --project=chromium --workers=1
```

기준선 실패는 새 task와 분리해 ExecPlan의 `발견 사항과 계획 변경`에 기록한다.

## 4. 범위

### 포함

- Source Registry의 실행 가능한 JSON 항목과 scope guard.
- 3,998개 seed에서 stable internal ID mapping과 10/100 target manifest 생성.
- repository 밖 raw, normalized, claim, canonical, image, state, report workspace.
- AniList, Wikidata, AniLife public-page source adapter.
- retry, `Retry-After`, source pause, atomic checkpoint, immutable revision.
- title/enum/date/genre/character/casting normalization.
- exact ID/rule match와 review queue.
- JPEG/PNG/WebP signature·dimension·checksum 검사와 Playwright decode gate.
- deterministic canonical snapshot과 aggregate quality report.
- review batch export와 advisor suggestion import validation.
- loopback-only local catalog server와 Web `TitleResolver` adapter.
- golden 10 live contract run, sample 100 live run, leakage guard, aggregate evidence report.

### 제외

- 3,998개 전체 네트워크 수집.
- production catalog DB/API, cloud object storage, Vercel 배포.
- AniList/AniLife 데이터나 이미지의 production promotion.
- AniLife 자동 검색, `/api/` 접근, 전체 content page 순회.
- OpenAI API key 또는 모델 호출 코드.
- 관리자용 catalog edit UI.
- Board, Public, UGC, 사용자 이미지 lifecycle 변경.
- 기존 runtime AniList 검색의 production 제거.

## 5. 아키텍처·데이터 흐름

```text
src/data/aliases.json (read-only)
  → TargetManifest(golden | sample100)
  → SourceRegistry scope check
  → SourceAdapter.collect()
  → immutable SourceRecord
  → normalizeSourceRecord()
  → resolveIdentity()
  → buildFieldClaims()
  → buildCanonicalRevision()
  → download/verify cover candidates
  → validateCatalogRevision()
  → quality report + review queue
  → loopback catalog server
  → canonicalCatalogTitleResolver
  → existing Memory runtime port
```

공통 interface는 Task 1에서 다음 이름으로 고정한다.

```js
/** @typedef {{
 * targetKey: string,
 * moemoaAnimeId: string,
 * seedSource: 'legacy_aliases',
 * seedExternalIds: Array<{sourceId: string, value: string}>,
 * seedTitles: Array<{locale: string, value: string}>,
 * targetStatus: 'ACTIVE',
 * createdAt: string
 * }} TargetRecord */

/** @typedef {{
 * sourceId: string,
 * targetKey: string,
 * sourceEntityId: string,
 * responseStatus: number,
 * fetchedAt: string,
 * requestFingerprint: string,
 * parserVersion: string,
 * payload: unknown
 * }} SourceEnvelope */

/** @typedef {{
 * collect(input: {
 *   targets: TargetRecord[],
 *   http: {request(input: {url: string, init?: RequestInit, kind?: 'DATA'|'IMAGE'}): Promise<Response>},
 *   workspace: Object,
 *   clock: {now(): string}
 * }): AsyncIterable<SourceEnvelope>
 * }} SourceAdapter */
```

## 6. 변경 파일 지도

### Collector core

| 파일 | 책임 |
| --- | --- |
| `tools/catalog-lab/cli.mjs` | command parsing, explicit network/scope gate, exit code |
| `tools/catalog-lab/contracts/catalogContracts.mjs` | enum, JSDoc contract, runtime assertion |
| `tools/catalog-lab/config/source-registry.json` | 네 출처의 허용 방식·범위·차단 경로 |
| `tools/catalog-lab/config/golden-targets.json` | 고정 AniList ID 10개 |
| `tools/catalog-lab/config/core-genre-map.json` | TEST_ONLY 13개 core genre mapping |
| `tools/catalog-lab/lib/workspace.mjs` | external path, sentinel, safe cleanup |
| `tools/catalog-lab/lib/atomic-json.mjs` | temp write + atomic rename |
| `tools/catalog-lab/lib/hash.mjs` | stable JSON serialization과 SHA-256 |
| `tools/catalog-lab/lib/path-key.mjs` | `ANILIST:1`, `anime:<uuid>`를 Windows-safe path segment로 변환 |
| `tools/catalog-lab/lib/http.mjs` | typed HTTP errors, retry/backoff, rate spacing |
| `tools/catalog-lab/pipeline/targets.mjs` | legacy rows → stable target manifests |
| `tools/catalog-lab/pipeline/raw-store.mjs` | immutable SourceRecord persistence |
| `tools/catalog-lab/pipeline/state-store.mjs` | target+source checkpoint와 source pause |
| `tools/catalog-lab/pipeline/normalize.mjs` | source payload → common normalized candidate |
| `tools/catalog-lab/pipeline/identity.mjs` | exact ID/rule matching과 review reason |
| `tools/catalog-lab/pipeline/claims.mjs` | deterministic FieldClaim 생성·충돌 탐지 |
| `tools/catalog-lab/pipeline/canonical.mjs` | sorted claims → revisioned CanonicalAnime |
| `tools/catalog-lab/pipeline/covers.mjs` | cover fetch, signature/dimension/hash, selection |
| `tools/catalog-lab/pipeline/runner.mjs` | stage orchestration, resume, partial failure |
| `tools/catalog-lab/review/review-queue.mjs` | 20~50개 batch export와 suggestion validation |
| `tools/catalog-lab/reports/quality-report.mjs` | coverage, errors, conflicts, duplicate, hash report |
| `tools/catalog-lab/server/local-catalog-server.mjs` | `127.0.0.1` text-only search endpoint |
| `tools/catalog-lab/lib/leak-guard.mjs` | tracked/build/Android asset의 TEST_ONLY data 검사 |

### Source adapters

| 파일 | 책임 |
| --- | --- |
| `tools/catalog-lab/sources/anilist-test.mjs` | ID 기반 media + character pagination |
| `tools/catalog-lab/sources/wikidata.mjs` | `P8729` batch mapping + `wbgetentities` |
| `tools/catalog-lab/sources/anilife-public-page-test.mjs` | local binding + sitemap membership + public JSON-LD/OpenGraph |

### Web adapter

| 파일 | 책임 |
| --- | --- |
| `src/features/memory/adapters/catalog/canonicalCatalogTitleResolver.js` | local server response를 MOEMOA candidate로 투영 |
| `src/features/memory/runtime/platformTitleResolver.js` | DEV URL이 있을 때 local catalog, 아니면 기존 resolver |
| `src/features/memory/domain/memoryDomain.js` | `MOEMOA + CATALOG_CANDIDATE` 조합 허용 |
| `src/features/memory/components/MemoryTitleSelector.jsx` | local test catalog provenance label |
| `scripts/run-catalog-lab-web.mjs` | loopback catalog server + Astro dev orchestration |
| `astro.config.mjs` | production build에 local catalog URL이 있으면 실패 |

### Tests and evidence

| 파일 | 책임 |
| --- | --- |
| `tests/catalog-lab/run-tests.mjs` | collector `*.test.mjs` runner |
| `tests/catalog-lab/*.test.mjs` | core/source/pipeline/image/report/leak tests |
| `tests/catalog-lab/fixtures/*` | 합성 AniList/Wikidata/AniLife/image payload |
| `tests/unit/titleResolvers.test.mjs` | MOEMOA catalog resolver와 기존 resolver 회귀 |
| `tests/catalog-lab-web.spec.ts` | loopback sample의 offline title search E2E |
| `docs/moemoa/reports/catalog-lab-test-evidence.md` | aggregate 결과와 gate 상태, raw/title 목록 제외 |
| `package.json` | `catalog:*` commands와 깨진 legacy collector script 제거 |

## 7. 데이터·스키마 마이그레이션

- 앱 DB와 IndexedDB schema migration은 없다.
- `src/data/aliases.json`은 변경하지 않는다.
- 최초 `catalog:init`은 외부 workspace에 `TEST_ONLY.json`과 schema version 1 디렉터리를 만든다.
- 최초 target 생성은 `targets/id-map.json`에 `ANILIST:<id> → anime:<uuid>`를 기록하고 이후 실행에서 재사용한다.
- canonical revision은 `canonical/revisions/<contentHash>.jsonl`로 쓰고 validation 성공 후에만 `canonical/current.json` pointer를 atomic 교체한다.
- parser version 변경은 새 raw/normalized revision을 만들며 이전 revision을 삭제하지 않는다.
- rollback은 current pointer를 이전 content hash로 돌리고 tracked code commit을 revert한다.

## 8. 마일스톤과 TDD 작업

### Task 1: 계약·Source Registry·외부 workspace·target manifest

**Files:**
- Create: `tools/catalog-lab/contracts/catalogContracts.mjs`
- Create: `tools/catalog-lab/config/source-registry.json`
- Create: `tools/catalog-lab/config/golden-targets.json`
- Create: `tools/catalog-lab/config/core-genre-map.json`
- Create: `tools/catalog-lab/lib/path-key.mjs`
- Create: `tools/catalog-lab/lib/workspace.mjs`
- Create: `tools/catalog-lab/pipeline/targets.mjs`
- Create: `tests/catalog-lab/run-tests.mjs`
- Create: `tests/catalog-lab/workspace-targets.test.mjs`

**Interfaces:**
- Consumes: `src/data/aliases.json`, explicit `repoRoot`, `MOEMOA_CATALOG_LAB_DIR`.
- Produces: `loadSourceRegistry()`, `assertSourceExecution(registryEntry, targetCount)`, `toPathKey()`, `openCatalogWorkspace()`, `buildTargetManifest()`.

- [ ] **Step 1: Add the catalog test runner and failing safety/target tests**

```js
test('workspace rejects a path inside the git worktree', async () => {
  await assert.rejects(
    openCatalogWorkspace({ repoRoot, workspaceRoot: join(repoRoot, '.cache', 'catalog') }),
    { code: 'CATALOG_WORKSPACE_INSIDE_REPOSITORY' },
  );
});

test('golden manifest uses the approved ten ids and stable internal ids', async () => {
  const first = await buildTargetManifest({ profile: 'golden', rows, idMapStore, clock, uuid });
  const second = await buildTargetManifest({ profile: 'golden', rows, idMapStore, clock, uuid });
  assert.deepEqual(first.map((row) => row.seedExternalIds[0].value),
    ['1', '121', '5114', '7902', '21519', '227', '120377', '112151', '129874', '131681']);
  assert.deepEqual(second, first);
});

test('logical ids never become raw Windows path segments', () => {
  assert.equal(toPathKey('ANILIST:1'), 'anilist-1');
  assert.equal(toPathKey('anime:11111111-1111-4111-8111-111111111111'),
    'anime-11111111-1111-4111-8111-111111111111');
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL because `openCatalogWorkspace` and `buildTargetManifest` do not exist.

- [ ] **Step 3: Implement contracts, registry, sentinel guard, stable IDs and deterministic sample selection**

```js
export async function openCatalogWorkspace({ repoRoot, workspaceRoot, create = false }) {
  const repo = resolve(repoRoot);
  const root = resolve(workspaceRoot);
  if (root === repo || root.startsWith(`${repo}${sep}`)) {
    const error = new Error('Catalog workspace must be outside the repository');
    error.code = 'CATALOG_WORKSPACE_INSIDE_REPOSITORY';
    throw error;
  }
  if (create) await mkdir(root, { recursive: true });
  const sentinel = join(root, 'TEST_ONLY.json');
  const sentinelExists = await stat(sentinel).then(() => true, () => false);
  if (create && !sentinelExists) {
    await writeFile(sentinel, JSON.stringify({ kind: 'MOEMOA_CATALOG_LAB', schemaVersion: 1 }) + '\n');
  }
  const parsed = JSON.parse(await readFile(sentinel, 'utf8'));
  if (parsed.kind !== 'MOEMOA_CATALOG_LAB' || parsed.schemaVersion !== 1) {
    const error = new Error('Catalog workspace sentinel is invalid');
    error.code = 'CATALOG_WORKSPACE_SENTINEL_INVALID';
    throw error;
  }
  return Object.freeze({ root, resolve: (...parts) => join(root, ...parts) });
}
```

`sample100`은 golden 10개를 먼저 두고, 나머지 3,988개를 AniList ID 숫자순으로 정렬한 뒤 전체 구간에서 동일 간격으로 90개를 선택한다. target count가 100을 넘으면 AniList/AniLife Registry guard가 `SOURCE_SCOPE_EXCEEDED`를 발생시킨다.

Registry의 초기 실행값은 다음과 같이 고정한다.

```json
[
  {"sourceId":"legacy_aliases","sourceRole":"seed_baseline","status":"approved","executionScope":"TARGET_ROSTER_ONLY","catalogPromotion":"PROHIBITED","redistributionStatus":"PROHIBITED","minIntervalMs":0,"maxConcurrency":1},
  {"sourceId":"anilist","sourceRole":"crosscheck_only","status":"approved","executionScope":"LOCAL_TEST_MAX_100","catalogPromotion":"PROHIBITED","redistributionStatus":"PROHIBITED","minIntervalMs":800,"maxConcurrency":1},
  {"sourceId":"wikidata","sourceRole":"direct_import","status":"approved","executionScope":"LOCAL_SAMPLE_MAX_100","catalogPromotion":"FIELD_REVIEW_REQUIRED","redistributionStatus":"CC0","minIntervalMs":1000,"maxConcurrency":1},
  {"sourceId":"anilife_public","sourceRole":"crosscheck_only","status":"approved","executionScope":"LOCAL_TEST_MAX_100","catalogPromotion":"PROHIBITED","redistributionStatus":"PROHIBITED","minIntervalMs":1500,"maxConcurrency":1,"blockedPaths":["/api/","/archive","/history","/settings","/login","/notifications"]}
]
```

각 실제 entry에는 설계 문서의 terms/robots/evidence URL, 2026-08-17 검토일, `MOEMOA-Catalog-Lab/0.1 (personal local test; https://github.com/Newrred/anime-collector)` User-Agent를 함께 기록한다.

- [ ] **Step 4: Run focused tests and existing unit regression**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: PASS with 10 unique golden targets, 100 unique sample targets, stable `moemoaAnimeId`, and four Registry entries.

Run: `npm run test:unit`

Expected: PASS; `aliases.json` runtime behavior unchanged.

- [ ] **Step 5: Commit Task 1**

```powershell
git add tools/catalog-lab/contracts tools/catalog-lab/config tools/catalog-lab/lib/path-key.mjs tools/catalog-lab/lib/workspace.mjs tools/catalog-lab/pipeline/targets.mjs tests/catalog-lab
git commit -m "feat(catalog): add lab contracts and workspace guard"
```

### Task 2: Immutable raw store, atomic checkpoint and retrying HTTP client

**Files:**
- Create: `tools/catalog-lab/lib/atomic-json.mjs`
- Create: `tools/catalog-lab/lib/hash.mjs`
- Create: `tools/catalog-lab/lib/http.mjs`
- Create: `tools/catalog-lab/pipeline/raw-store.mjs`
- Create: `tools/catalog-lab/pipeline/state-store.mjs`
- Create: `tests/catalog-lab/raw-state-http.test.mjs`

**Interfaces:**
- Consumes: workspace from Task 1 and `SourceEnvelope` contract.
- Produces: `stableStringify()`, `sha256()`, `createHttpClient()`, `storeSourceEnvelope()`, `createStateStore()`.

- [ ] **Step 1: Write failing immutability, retry and pause tests**

```js
test('same envelope is stored once and refresh creates a new immutable revision', async () => {
  const envelope = {
    sourceId: 'anilist',
    targetKey: 'ANILIST:1',
    sourceEntityId: '1',
    responseStatus: 200,
    fetchedAt: '2026-08-17T00:00:00.000Z',
    requestFingerprint: 'graphql:media:1',
    parserVersion: 'anilist-v1',
    payload: { id: 1, title: { native: 'カウボーイビバップ' } },
  };
  const first = await storeSourceEnvelope({ workspace, envelope });
  const second = await storeSourceEnvelope({ workspace, envelope });
  assert.equal(second.sourceRecordId, first.sourceRecordId);
  assert.equal(second.created, false);
});

test('429 honors Retry-After and stops after five retries', async (t) => {
  const sleeps = [];
  const fetchImpl = t.mock.fn(async () => new Response('', {
    status: 429,
    headers: { 'Retry-After': '2' },
  }));
  const http = createHttpClient({ fetchImpl, sleep: async (ms) => sleeps.push(ms), random: () => 0 });
  const request = { url: 'https://example.test/data', kind: 'DATA' };
  await assert.rejects(http.request(request), { code: 'SOURCE_RETRY_EXHAUSTED' });
  assert.equal(fetchImpl.mock.callCount(), 6);
  assert.deepEqual(sleeps, [2000, 2000, 2000, 2000, 2000]);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL on missing raw/state/http modules.

- [ ] **Step 3: Implement stable serialization, typed retry and atomic state**

```js
export const RETRY_POLICY = Object.freeze({
  transientRetries: 4,
  rateLimitRetries: 5,
  imageRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
});

export function classifyHttpFailure(status) {
  if (status === 401 || status === 403) return 'SOURCE_PAUSED';
  if (status === 404) return 'SOURCE_NOT_FOUND';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'FAILED_RETRYABLE';
  return 'FAILED_PERMANENT';
}
```

`atomicWriteJson(path, value)`는 같은 디렉터리의 `<name>.<uuid>.tmp`에 쓰고 `rename()`으로 교체한다. raw record path는 `<source>/<toPathKey(targetKey)>/<sourceRecordId>.json`이며 존재하면 덮어쓰지 않는다. state key는 `<source>/<toPathKey(targetKey)>.json`이다. logical ID 원문은 JSON 본문에 보존한다.

- [ ] **Step 4: Run focused tests**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: PASS for total attempts 5 on transient, 6 on 429, no retry on 404, source pause on 401/403, and atomic state recovery.

- [ ] **Step 5: Commit Task 2**

```powershell
git add tools/catalog-lab/lib tools/catalog-lab/pipeline/raw-store.mjs tools/catalog-lab/pipeline/state-store.mjs tests/catalog-lab/raw-state-http.test.mjs
git commit -m "feat(catalog): add immutable staging and retry state"
```

### Task 3: AniList local-test source adapter

**Files:**
- Create: `tools/catalog-lab/sources/anilist-test.mjs`
- Create: `tests/catalog-lab/anilist-source.test.mjs`
- Create: `tests/catalog-lab/fixtures/anilist-media-page1.json`
- Create: `tests/catalog-lab/fixtures/anilist-characters-page2.json`

**Interfaces:**
- Consumes: `TargetRecord[]`, Task 2 HTTP client.
- Produces: `createAniListTestAdapter({fetchImpl})` implementing `SourceAdapter.collect()`.

- [ ] **Step 1: Write failing projection and pagination tests**

```js
test('AniList adapter fetches by exact seed id and paginates character connection', async () => {
  const rows = [];
  for await (const envelope of adapter.collect({ targets: [target], http, workspace, clock })) rows.push(envelope);
  assert.equal(rows[0].sourceEntityId, '1');
  assert.equal(rows[0].payload.characters.length, 26);
  assert.ok(rows[0].payload.characters.every((row) => ['MAIN', 'SUPPORTING'].includes(row.role)));
  assert.ok(rows[0].payload.characters.flatMap((row) => row.voiceActors)
    .every((actor) => actor.language === 'JAPANESE'));
  assert.equal('bannerImage' in rows[0].payload, false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL because the AniList adapter is absent.

- [ ] **Step 3: Implement exact-ID GraphQL and page loop**

The query must request only the approved fields:

```graphql
query CatalogMedia($id: Int!, $page: Int!) {
  Media(id: $id, type: ANIME) {
    id idMal title { romaji english native } synonyms
    format status startDate { year month day } endDate { year month day }
    season seasonYear episodes source genres
    coverImage { extraLarge large medium }
    studios(isMain: true) { nodes { id name isAnimationStudio } }
    relations { edges { relationType node { id type title { romaji english native } format } } }
    externalLinks { id site url type }
    characters(page: $page, perPage: 25, sort: [ROLE, RELEVANCE, ID]) {
      pageInfo { currentPage hasNextPage }
      edges { role node { id name { full native alternative } }
        voiceActors(language: JAPANESE) { id name { full native alternative } language } }
    }
  }
}
```

The adapter rejects a response whose `Media.id` differs from the target AniList ID with `SOURCE_SCHEMA_DRIFT`. It stores one target-level payload after all character pages are combined and removes banner/character/actor image fields even if a fixture contains them.

- [ ] **Step 4: Run focused tests**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: PASS for exact ID, character page 2, Japanese-only voice actors, approved external link fields, and no banner/image leakage.

- [ ] **Step 5: Commit Task 3**

```powershell
git add tools/catalog-lab/sources/anilist-test.mjs tests/catalog-lab/anilist-source.test.mjs tests/catalog-lab/fixtures/anilist-*.json
git commit -m "feat(catalog): add bounded AniList sample adapter"
```

### Task 4: Wikidata CC0 batch adapter

**Files:**
- Create: `tools/catalog-lab/sources/wikidata.mjs`
- Create: `tests/catalog-lab/wikidata-source.test.mjs`
- Create: `tests/catalog-lab/fixtures/wikidata-p8729.json`
- Create: `tests/catalog-lab/fixtures/wikidata-entities.json`
- Create: `tests/catalog-lab/helpers/collect-envelopes.mjs`

**Interfaces:**
- Consumes: target AniList IDs, HTTP client.
- Produces: `createWikidataAdapter({userAgent})`, target-level `SourceEnvelope` values, test helper `collectEnvelopes()`.

- [ ] **Step 1: Write failing batch and no-fuzzy-search tests**

```js
test('Wikidata maps P8729 in batches and fetches known entities with wbgetentities', async () => {
  const envelopes = await collectEnvelopes(adapter, { targets, http, workspace, clock });
  assert.equal(envelopes[0].sourceEntityId, 'Q101244908');
  assert.equal(envelopes[0].payload.externalIds.anilist, '1');
  assert.deepEqual(envelopes[0].payload.labels.ko, '카우보이 비밥');
  assert.equal(requests.some((url) => url.includes('wbsearchentities')), false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL because Wikidata adapter is absent.

- [ ] **Step 3: Implement 25-ID WDQS mapping and 50-QID entity batches**

```sparql
SELECT ?item ?anilistId WHERE {
  VALUES ?anilistId { "1" "121" "5114" }
  ?item wdt:P8729 ?anilistId .
}
```

`wbgetentities` uses `props=labels|aliases|claims|sitelinks`, `languages=ko|ja|en`, `format=json`, and the explicit MOEMOA User-Agent from Registry. Persisted claims are limited to `P8729` (AniList ID), `P856` (official website), `P577` (publication date), `P136` (genre), and `P272` (production company). Missing `P8729` emits `SOURCE_NOT_AVAILABLE`; it does not trigger title search.

```js
export async function collectEnvelopes(adapter, input) {
  const rows = [];
  for await (const envelope of adapter.collect(input)) rows.push(envelope);
  return rows;
}
```

- [ ] **Step 4: Run focused tests**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: PASS for batch sizes, P8729 exact mapping, ko/ja/en labels, the five approved claims, sitelinks, and no fuzzy endpoint.

- [ ] **Step 5: Commit Task 4**

```powershell
git add tools/catalog-lab/sources/wikidata.mjs tests/catalog-lab/wikidata-source.test.mjs tests/catalog-lab/helpers/collect-envelopes.mjs tests/catalog-lab/fixtures/wikidata-*.json
git commit -m "feat(catalog): add Wikidata identity adapter"
```

### Task 5: AniLife public-page bound adapter

**Files:**
- Create: `tools/catalog-lab/sources/anilife-public-page-test.mjs`
- Create: `tests/catalog-lab/anilife-source.test.mjs`
- Create: `tests/catalog-lab/fixtures/anilife-sitemap.xml`
- Create: `tests/catalog-lab/fixtures/anilife-content-1.html`

**Interfaces:**
- Consumes: local `bindings/anilife.json`, public sitemap, `/content/{id}` HTML.
- Produces: `createAniLifePublicPageAdapter()` and `validateAniLifeBinding()`.

- [ ] **Step 1: Write failing allowlist and parser tests**

```js
test('AniLife adapter only fetches manually bound public content pages', async () => {
  const bindings = { 'ANILIST:1': { contentId: '1', evidence: 'MANUAL_PUBLIC_PAGE_REVIEW' } };
  const envelopes = await collectEnvelopes(adapter, { targets: [target], http, workspace, clock, bindings });
  assert.equal(envelopes[0].sourceEntityId, '1');
  assert.equal(envelopes[0].payload.title, 'Cowboy Bebop');
  assert.equal(requests.some((url) => new URL(url).pathname.startsWith('/api/')), false);
});

test('unbound target is marked NOT_FETCHED without sitemap-wide page crawling', async () => {
  const envelopes = await collectEnvelopes(adapter, { targets: [unboundTarget], http, workspace, clock, bindings: {} });
  assert.equal(envelopes[0].payload.fieldState, 'NOT_FETCHED');
  assert.equal(requests.filter((url) => new URL(url).pathname.startsWith('/content/')).length, 0);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL because AniLife public adapter is absent.

- [ ] **Step 3: Implement binding validation, sitemap membership and JSON-LD/OpenGraph parser**

The parser returns only:

```js
{
  contentId,
  title,
  alternateName,
  datePublished,
  numberOfEpisodes,
  imageUrl,
  publicPageUrl,
}
```

`contentId` must match `/^[1-9]\d*$/`; resolved URLs must have origin `https://anilife1.tv` and pathname exactly `/content/<contentId>`. The content URL must appear in the fetched sitemap. JSON-LD parse failure may fall back to OpenGraph title/image only and records `SOURCE_SCHEMA_DRIFT`; no rendered browser or internal XHR is used.

- [ ] **Step 4: Run focused tests**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: PASS for content 1 binding, unbound skip, malformed JSON-LD classification, `/api/` rejection, and absence of episode playback/comment fields.

- [ ] **Step 5: Commit Task 5**

```powershell
git add tools/catalog-lab/sources/anilife-public-page-test.mjs tests/catalog-lab/anilife-source.test.mjs tests/catalog-lab/fixtures/anilife-*
git commit -m "feat(catalog): add bound AniLife public page adapter"
```

### Task 6: Normalize, exact identity, FieldClaim and canonical revision

**Files:**
- Create: `tools/catalog-lab/pipeline/normalize.mjs`
- Create: `tools/catalog-lab/pipeline/identity.mjs`
- Create: `tools/catalog-lab/pipeline/claims.mjs`
- Create: `tools/catalog-lab/pipeline/canonical.mjs`
- Create: `tests/catalog-lab/canonical-pipeline.test.mjs`

**Interfaces:**
- Consumes: stored `SourceRecord` values and target manifest.
- Produces: `normalizeSourceRecord()`, `resolveIdentity()`, `buildFieldClaims()`, `buildCanonicalRevision()`.

- [ ] **Step 1: Write failing normalization, match, conflict and determinism tests**

```js
test('AniLife exact normalized title plus year is auto-matched', () => {
  const result = resolveIdentity({ target, candidate, sourceId: 'anilife_public' });
  assert.deepEqual(result, { status: 'MATCHED', confidenceClass: 'EXACT_RULE', ruleId: 'ANILIFE_TITLE_YEAR_V1' });
});

test('conflicting episode counts remain conflicted and canonical output is stable', () => {
  const claims = buildFieldClaims({ target, normalizedRecords });
  assert.equal(claims.find((row) => row.fieldPath === 'episodeCount').status, 'CONFLICTED');
  assert.equal(stableStringify(buildCanonicalRevision(claims)),
    stableStringify(buildCanonicalRevision([...claims].reverse())));
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL because normalize/identity/claims/canonical modules are absent.

- [ ] **Step 3: Implement explicit enums, match rules and deterministic IDs**

```js
export const FIELD_STATES = Object.freeze([
  'VALUE', 'SOURCE_NOT_AVAILABLE', 'NOT_FETCHED', 'CONFLICTED',
]);
export const CONFIDENCE_CLASSES = Object.freeze([
  'EXACT_ID', 'EXACT_RULE', 'REVIEWED', 'AMBIGUOUS',
]);
export const CORE_GENRES = Object.freeze([
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
  'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller',
]);
```

Claim ID는 `entityId + fieldPath + normalizedValue + sourceRecordId`의 SHA-256으로 만든다. canonical ordering은 title locale/value, external source/value, relation target/type, character role/id, casting character/person 순서다. AniList/AniLife claims를 사용한 revision은 항상 `reviewState='TEST_ONLY'`와 `distributionStatus='PROHIBITED'`를 갖는다.

- [ ] **Step 4: Run focused tests**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: PASS for Unicode NFKC, null/zero distinction, enum mapping, exact ID/rule match, ambiguous review, 13 core genres, Japanese casting, conflict preservation, stable content hash.

- [ ] **Step 5: Commit Task 6**

```powershell
git add tools/catalog-lab/pipeline/normalize.mjs tools/catalog-lab/pipeline/identity.mjs tools/catalog-lab/pipeline/claims.mjs tools/catalog-lab/pipeline/canonical.mjs tests/catalog-lab/canonical-pipeline.test.mjs
git commit -m "feat(catalog): build provenance-aware canonical revisions"
```

### Task 7: Cover download, structural validation and Chromium decode gate

**Files:**
- Create: `tools/catalog-lab/pipeline/covers.mjs`
- Create: `tests/catalog-lab/cover-validation.test.mjs`
- Create: `tests/catalog-lab/fixtures/cover-valid-images.mjs`

**Interfaces:**
- Consumes: exact-matched cover candidates, Task 2 HTTP client, external workspace.
- Produces: `inspectImageBytes()`, `downloadCoverCandidate()`, `storeValidatedCover()`, `decodeCoverWithChromium()`, `selectCanonicalCover()`.

- [ ] **Step 1: Write failing signature, mismatch, dedupe and decode tests**

```js
test('cover validation rejects MIME spoofing and deduplicates by checksum', async () => {
  assert.throws(() => inspectImageBytes({ declaredMime: 'image/jpeg', bytes: pngBytes }),
    { code: 'IMAGE_MIME_SIGNATURE_MISMATCH' });
  const animeId = 'anime:11111111-1111-4111-8111-111111111111';
  const first = await storeValidatedCover({ bytes: pngBytes, workspace, animeId });
  const second = await storeValidatedCover({ bytes: pngBytes, workspace, animeId });
  assert.equal(second.localRef, first.localRef);
  assert.equal(second.created, false);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL because cover validation module is absent.

- [ ] **Step 3: Implement JPEG/PNG/WebP inspection and existing-Playwright decode**

```js
export const COVER_MIME = Object.freeze({
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
});
```

`inspectImageBytes()` verifies magic bytes and parses dimensions from PNG IHDR, JPEG SOF, and WebP VP8/VP8L/VP8X headers. `decodeCoverWithChromium()` opens a blank existing Playwright Chromium page and evaluates `createImageBitmap(blob)`; success changes `validationStatus` from `STRUCTURE_VALID` to `DECODED`. No new image dependency is installed.

Selection order is exact identity class, decoded status, pixel area descending, sourceId lexical. Every result records source URL, source record ID, retrieved time, MIME, extension, byte size, dimensions, SHA-256, rights and distribution status.

- [ ] **Step 4: Run focused tests**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: PASS for valid JPEG/PNG/WebP fixtures, spoofed MIME, truncated image, checksum dedupe, text record preservation on image failure, and Chromium decode.

- [ ] **Step 5: Commit Task 7**

```powershell
git add tools/catalog-lab/pipeline/covers.mjs tests/catalog-lab/cover-validation.test.mjs tests/catalog-lab/fixtures/cover-valid-images.mjs
git commit -m "feat(catalog): validate local test covers"
```

### Task 8: Resumable runner, CLI, quality report and review batches

**Files:**
- Create: `tools/catalog-lab/pipeline/runner.mjs`
- Create: `tools/catalog-lab/review/review-queue.mjs`
- Create: `tools/catalog-lab/reports/quality-report.mjs`
- Create: `tools/catalog-lab/cli.mjs`
- Create: `tests/catalog-lab/runner-cli-report.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 1–7 modules.
- Produces: `runCatalogPipeline()`, `buildQualityReport()`, `exportReviewBatches()`, CLI commands.

- [ ] **Step 1: Write failing resume, partial-failure, report and CLI gate tests**

```js
test('runner resumes after a source failure without duplicating completed records', async () => {
  const first = await runCatalogPipeline({ context, targets, adapters, allowNetwork: true });
  const second = await runCatalogPipeline({ context, targets, adapters, allowNetwork: true });
  assert.equal(second.counts.sourceRecords, first.counts.sourceRecords);
  assert.equal(second.counts.claims, first.counts.claims);
  assert.equal(second.counts.images, first.counts.images);
  assert.equal(second.canonicalHash, first.canonicalHash);
});

test('collect refuses network and source scope violations', async () => {
  assert.equal(await runCli(['collect', '--profile', 'golden']), 64);
  assert.equal(await runCli(['collect', '--profile', 'all', '--allow-network']), 64);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `node tests/catalog-lab/run-tests.mjs`

Expected: FAIL because runner/CLI/report modules are absent.

- [ ] **Step 3: Implement stage machine, commands and bounded review contract**

```js
export const JOB_STATES = Object.freeze([
  'PENDING', 'FETCHED', 'NORMALIZED', 'MATCHED', 'CLAIMS_BUILT',
  'IMAGE_VALIDATED', 'VALIDATED', 'COMPLETED', 'FAILED_RETRYABLE',
  'FAILED_PERMANENT', 'PENDING_REVIEW', 'SOURCE_PAUSED',
]);

export const CLI_EXIT = Object.freeze({
  OK: 0,
  QUALITY_GATE_FAILED: 2,
  SOURCE_PAUSED: 3,
  USAGE_OR_SAFETY: 64,
});

export const REVIEW_DECISIONS = Object.freeze(['MATCH', 'NO_MATCH', 'NEEDS_HUMAN']);

export function validateReviewSuggestion(row) {
  if (!row?.targetKey || !row?.candidateId || !REVIEW_DECISIONS.includes(row.decision)) {
    const error = new Error('Review suggestion contract is invalid');
    error.code = 'REVIEW_SUGGESTION_INVALID';
    throw error;
  }
  if (!Array.isArray(row.ruleEvidence) || !row.reasonCode) {
    const error = new Error('Review evidence is required');
    error.code = 'REVIEW_EVIDENCE_REQUIRED';
    throw error;
  }
  return Object.freeze({
    targetKey: row.targetKey,
    candidateId: row.candidateId,
    decision: row.decision,
    ruleEvidence: Object.freeze([...row.ruleEvidence]),
    reasonCode: row.reasonCode,
  });
}
```

`export-review` includes only normalized title, year, format, episode state, relation context and source record references. `import-review` stores suggestions separately from claims, caps `advisorAttemptCount` at 2, and converts a third unresolved request to `NEEDS_HUMAN` without calling a model.

Commands:

```text
init
targets --profile golden|sample100
bind-anilife --anilist-id <numeric> --content-id <numeric>
collect --profile golden|sample100 --sources <csv> --allow-network [--refresh]
validate --profile golden|sample100
export-review --batch-size 20..50
import-review --file <absolute-json-path>
report --profile golden|sample100
clean --confirm TEST_ONLY
serve --host 127.0.0.1 --port 4318
guard
```

`clean` resolves the exact workspace, verifies the sentinel and rejects repository roots, drive roots and parent directories before recursive removal. Tests use only `mkdtemp()` paths.

Replace the four broken legacy collector entries in `package.json` with:

```json
{
  "catalog:test": "node tests/catalog-lab/run-tests.mjs",
  "catalog:init": "node tools/catalog-lab/cli.mjs init",
  "catalog:targets": "node tools/catalog-lab/cli.mjs targets",
  "catalog:collect": "node tools/catalog-lab/cli.mjs collect",
  "catalog:validate": "node tools/catalog-lab/cli.mjs validate",
  "catalog:report": "node tools/catalog-lab/cli.mjs report",
  "catalog:guard": "node tools/catalog-lab/cli.mjs guard"
}
```

- [ ] **Step 4: Run collector and application regressions**

Run: `npm run catalog:test`

Expected: PASS for resume, source pause, immutable refresh, review batch size, suggestion schema, aggregate report and safe clean.

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

```powershell
git add tools/catalog-lab/cli.mjs tools/catalog-lab/pipeline/runner.mjs tools/catalog-lab/review tools/catalog-lab/reports package.json tests/catalog-lab/runner-cli-report.test.mjs
git commit -m "feat(catalog): orchestrate resumable sample collection"
```

### Task 9: Loopback catalog server and Web TitleResolver

**Files:**
- Create: `tools/catalog-lab/server/local-catalog-server.mjs`
- Create: `src/features/memory/adapters/catalog/canonicalCatalogTitleResolver.js`
- Create: `scripts/run-catalog-lab-web.mjs`
- Modify: `src/features/memory/runtime/platformTitleResolver.js`
- Modify: `src/features/memory/domain/memoryDomain.js`
- Modify: `src/features/memory/components/MemoryTitleSelector.jsx`
- Modify: `astro.config.mjs`
- Modify: `tests/unit/titleResolvers.test.mjs`
- Create: `tests/catalog-lab/local-server.test.mjs`
- Create: `tests/catalog-lab-web.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `canonical/current.json` pointer and canonical JSONL revision.
- Produces: `createLocalCatalogServer()`, `createCanonicalCatalogTitleResolver()`, private `projectCatalogCandidate()`, DEV-only runtime selection.

- [ ] **Step 1: Write failing server, domain combination and resolver tests**

```js
test('canonical resolver returns text facts and MOEMOA internal binding only', async () => {
  const resolver = createCanonicalCatalogTitleResolver({ endpoint, fetchImpl });
  const [candidate] = await resolver.search('비밥');
  assert.deepEqual(candidate.sourceBinding, { provider: 'MOEMOA', externalId: 'anime:11111111-1111-4111-8111-111111111111' });
  assert.equal(candidate.verificationState, 'CATALOG_CANDIDATE');
  assert.doesNotMatch(JSON.stringify(candidate), /localRef|sourceUrl|image|cover|rawPayload/i);
});
```

Add a domain test that accepts only `MOEMOA + CATALOG_CANDIDATE` and still rejects `MOEMOA + PROVIDER_CANDIDATE` and `ANILIST + CATALOG_CANDIDATE`.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm run test:unit`

Expected: FAIL on missing canonical resolver and unsupported MOEMOA binding.

Run: `npm run catalog:test`

Expected: FAIL on missing local server.

- [ ] **Step 3: Implement loopback text-only server and DEV selection**

```js
export function createCanonicalCatalogTitleResolver({ endpoint, fetchImpl = fetch, limit = 8 }) {
  return Object.freeze({
    async search(query) {
      const url = new URL('/catalog/search', endpoint);
      url.searchParams.set('q', String(query).normalize('NFKC').trim());
      url.searchParams.set('limit', String(limit));
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error('LOCAL_CATALOG_UNAVAILABLE');
      return (await response.json()).results.map(projectCatalogCandidate);
    },
  });
}

function projectCatalogCandidate(row) {
  return {
    kind: 'ANIME_REF',
    displayTitle: row.displayTitle,
    aliases: row.aliases,
    genres: row.genres,
    sourceBinding: { provider: 'MOEMOA', externalId: row.id },
    verificationState: 'CATALOG_CANDIDATE',
  };
}
```

The server binds only to `127.0.0.1`, accepts `GET /health` and `GET /catalog/search`, limits results to 20, and returns `{id, displayTitle, aliases, genres, reviewState}`. `displayTitle` locale priority is `ko → en → ja → native/und`; remaining unique titles become aliases. It never exposes cover/source URL/localRef/raw payload. `scripts/run-catalog-lab-web.mjs` starts the server and Astro with `PUBLIC_MOEMOA_CATALOG_LAB_URL=http://127.0.0.1:4318`.

`memoryDomain.js` accepts only these provider/state pairs:

```js
const ALLOWED_ANIME_BINDINGS = new Set([
  'ANILIST:LEGACY_UNVERIFIED',
  'ANILIST:PROVIDER_CANDIDATE',
  'MOEMOA:CATALOG_CANDIDATE',
]);
```

`MemoryTitleSelector.jsx` maps `CATALOG_CANDIDATE` to `Local catalog · test only`, `PROVIDER_CANDIDATE` to `AniList candidate`, and `LEGACY_UNVERIFIED` to `Legacy data · unverified`.

Task 9 adds the manual runner command:

```json
{
  "catalog:web": "node scripts/run-catalog-lab-web.mjs"
}
```

`astro.config.mjs` throws `CATALOG_LAB_URL_FORBIDDEN_IN_PRODUCTION` when `command === 'build'` and the public lab URL is present. Normal production build without that variable remains unchanged.

`tests/catalog-lab-web.spec.ts` starts `createLocalCatalogServer()` against an OS temp synthetic workspace in `beforeAll`, then uses `page.addInitScript()` to install `globalThis.__MOEMOA_TEST_TITLE_RESOLVER__` before the React runtime loads. Therefore the existing `scripts/run-e2e.mjs` can remain the Astro process owner and the test does not require actual local catalog data.

- [ ] **Step 4: Run unit, catalog, E2E and build checks**

Run: `npm run test:unit`

Expected: PASS with old AniList/legacy candidates and new MOEMOA candidate combinations.

Run: `npm run catalog:test`

Expected: PASS; server returns no image/source fields.

Run: `npm run test:e2e -- tests/catalog-lab-web.spec.ts --project=chromium --workers=1`

Expected: PASS using a synthetic temp workspace, with browser network blocked except localhost.

Run: `npm run build`

Expected: PASS without lab URL.

Run: `$env:PUBLIC_MOEMOA_CATALOG_LAB_URL='http://127.0.0.1:4318'; npm run build; Remove-Item Env:PUBLIC_MOEMOA_CATALOG_LAB_URL`

Expected: FAIL with `CATALOG_LAB_URL_FORBIDDEN_IN_PRODUCTION`.

- [ ] **Step 5: Commit Task 9**

```powershell
git add tools/catalog-lab/server src/features/memory/adapters/catalog/canonicalCatalogTitleResolver.js src/features/memory/runtime/platformTitleResolver.js src/features/memory/domain/memoryDomain.js src/features/memory/components/MemoryTitleSelector.jsx scripts/run-catalog-lab-web.mjs astro.config.mjs tests/unit/titleResolvers.test.mjs tests/catalog-lab/local-server.test.mjs tests/catalog-lab-web.spec.ts package.json
git commit -m "feat(catalog): connect local sample catalog to web search"
```

### Task 10: Leakage guard, golden 10, representative 100 and evidence closure

**Files:**
- Create: `tools/catalog-lab/lib/leak-guard.mjs`
- Create: `tests/catalog-lab/leak-quality-gates.test.mjs`
- Create: `docs/moemoa/reports/catalog-lab-test-evidence.md`
- Modify: `tools/catalog-lab/reports/quality-report.mjs`
- Modify: `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- Modify: `docs/moemoa/README.md`

**Interfaces:**
- Consumes: completed runner, external workspace, tracked/build paths.
- Produces: `assertNoCatalogLabLeak()`, `evaluateQualityGate()`, aggregate evidence and explicit full-ingestion gate result.

- [ ] **Step 1: Write failing leakage and quality-gate tests**

```js
test('leak guard rejects payload markers in tracked and build output', async () => {
  await writeFile(join(fakeDist, 'leak.json'), JSON.stringify({ rightsStatus: 'TEST_ONLY_UNKNOWN', rawPayloadRef: 'raw/a' }));
  await assert.rejects(assertNoCatalogLabLeak({ trackedFiles: [], outputRoots: [fakeDist] }),
    { code: 'CATALOG_TEST_DATA_LEAK' });
});

test('sample100 gate requires schema, provenance, image and idempotency results', () => {
  assert.deepEqual(evaluateQualityGate(validReport), { passed: true, failures: [] });
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `npm run catalog:test`

Expected: FAIL because leak guard and final quality evaluator are absent.

- [ ] **Step 3: Implement repository/build leakage checks**

The guard inspects tracked **paths** for forbidden generated-data locations and inspects `dist`, `android/app/src/main/assets/public`, and configured report attachment roots for serialized lab payload markers.

```text
tracked path: /raw/, /canonical/revisions/, /images/covers/, TEST_ONLY.json
build content: {"kind":"MOEMOA_CATALOG_LAB"
build content: "rawPayloadRef":
build content: "rightsStatus":"TEST_ONLY_UNKNOWN"
build content: resolved MOEMOA_CATALOG_LAB_DIR absolute path
```

Tracked code and docs may contain contract strings such as `TEST_ONLY_UNKNOWN`; they are not treated as data leaks. Synthetic fixtures are allowed only by exact path prefix `tests/catalog-lab/fixtures/` and must not contain real downloaded image bytes or unredacted source response dumps.

- [ ] **Step 4: Run all offline verification before live network work**

Run: `npm run catalog:test`

Expected: PASS.

Run: `npm run test:unit`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npm run catalog:guard`

Expected: PASS with no real payload or cover in tracked/build paths.

- [ ] **Step 5: Initialize an external workspace and run the golden 10 network sample**

Run:

```powershell
$env:MOEMOA_CATALOG_LAB_DIR = 'D:\moemoa-catalog-lab-data'
npm run catalog:init
npm run catalog:targets -- --profile golden
node tools/catalog-lab/cli.mjs bind-anilife --anilist-id 1 --content-id 1
npm run catalog:collect -- --profile golden --sources anilist,wikidata,anilife_public --allow-network
npm run catalog:validate -- --profile golden
npm run catalog:report -- --profile golden
```

Expected: 10 target records, zero schema failures, zero missing provenance, zero silent conflict overwrites. AniLife coverage may be lower than 10 because only manually reviewed bindings are allowed; unbound works must be `NOT_FETCHED`, not failures.

- [ ] **Step 6: Perform the golden manual comparison gate**

For each of the 10 IDs, compare the public source evidence against titles, format, dates/status, episode state, source material, main studio, genres, relations, MAIN/SUPPORTING characters, Japanese cast and cover metadata. Record only aggregate counts and safe target keys in `docs/moemoa/reports/catalog-lab-test-evidence.md`.

Expected: wrong identity 0, unexplained field differences 0, missing provenance 0, unchecked conflict overwrite 0.

- [ ] **Step 7: Generate and run the representative 100 sample**

Run:

```powershell
npm run catalog:targets -- --profile sample100
npm run catalog:collect -- --profile sample100 --sources anilist,wikidata,anilife_public --allow-network
npm run catalog:validate -- --profile sample100
npm run catalog:collect -- --profile sample100 --sources anilist,wikidata,anilife_public --allow-network
npm run catalog:validate -- --profile sample100
npm run catalog:report -- --profile sample100
```

Expected: schema 100%, explicit field state 100%, provenance 100%, downloaded image structural/decode/checksum 100%, second-run entity/claim/image growth 0, every failure classified, current revision preserved through an injected source failure.

- [ ] **Step 8: Verify Web offline read and platform leakage**

Start `npm run catalog:web` in a separate terminal, perform the manual search check, then stop it with `Ctrl+C`.

Expected: Memory title search finds sample titles with network disabled except localhost; selected item persists as `MOEMOA + CATALOG_CANDIDATE`; no cover is copied into Memory VisualAsset.

Run: `npm run test:e2e -- tests/catalog-lab-web.spec.ts tests/memory-card-composer.spec.ts --project=chromium --workers=1`

Expected: PASS.

Run: `npm run android:assemble:debug`

Expected: PASS.

Run: `npm run catalog:guard`

Expected: PASS after Web build and Android asset generation.

- [ ] **Step 9: Close evidence without opening the full-ingestion gate**

Update `docs/moemoa/reports/catalog-lab-test-evidence.md` with commands, environment, aggregate counts, skips, review backlog, retry counts, source pauses, output hash comparison, disk bytes and leakage result. Update `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md` to link the evidence while keeping `FULL-CATALOG-INGESTION-GATE-01` marked not passed.

- [ ] **Step 10: Commit Task 10**

```powershell
git add tools/catalog-lab/lib/leak-guard.mjs tools/catalog-lab/reports/quality-report.mjs tests/catalog-lab/leak-quality-gates.test.mjs docs/moemoa/reports/catalog-lab-test-evidence.md docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md docs/moemoa/README.md
git commit -m "test(catalog): verify local sample ingestion gates"
```

## 9. 테스트와 검증

| 레벨 | 명령 | 완료 증거 |
| --- | --- | --- |
| Collector unit/integration | `npm run catalog:test` | 외부 네트워크 없이 모든 source fixture, retry, state, canonical, image, leak 테스트 통과 |
| App unit | `npm run test:unit` | legacy/AniList resolver 회귀와 MOEMOA candidate contract 통과 |
| Web E2E | `npm run test:e2e -- tests/catalog-lab-web.spec.ts tests/memory-card-composer.spec.ts --project=chromium --workers=1` | localhost-only sample 검색→선택→Card 저장 통과 |
| Production build | `npm run build` | lab URL 없이 성공, lab URL 설정 시 의도적 실패 |
| Android compile | `npm run android:assemble:debug` | domain/resolver 변경 후 debug APK compile 성공 |
| Leakage | `npm run catalog:guard` | Git/build/Android assets에서 actual raw/cover/sentinel 0건 |
| Golden live | `catalog:collect/validate/report --profile golden` | 오연결·provenance 누락·무단 conflict overwrite 0건 |
| Sample live | 동일 명령 `sample100`, 연속 2회 | schema·state·provenance 100%, 중복 성장 0건 |

## 10. 보안·개인정보·권리 영향

- source payload와 catalog cover는 개인 PC의 명시적 TEST_ONLY workspace에만 존재한다.
- local catalog server는 loopback에만 bind하고 image/raw endpoint를 제공하지 않는다.
- 로그에는 API key, 인증 header, 사용자 note, 사용자 image path/bytes를 기록하지 않는다.
- AniList/AniLife data와 cover는 production promotion·redistribution이 금지된다.
- AniLife `/api/`와 blocked paths는 URL 생성 시점과 HTTP client 직전 두 번 검사한다.
- source request에는 사용자 자유 검색어가 없다. target external ID와 공개 content binding만 사용한다.
- `clean`은 sentinel, resolved path, root/parent guard를 모두 통과할 때만 external workspace를 제거한다.
- 이 계획은 법률 자문을 대신하지 않으며 full catalog와 상업 서비스 사용은 별도 권리 gate다.

## 11. 관찰 가능성·분석 이벤트

서비스 analytics event는 추가하지 않는다. 로컬 aggregate report만 생성한다.

```text
runId
profile
sourceId
requestCount
successCount
retryCount
notFoundCount
schemaDriftCount
sourcePausedCount
completedTargetCount
reviewBacklogCount
conflictCount
imageDecodedCount
imageInvalidCount
canonicalHash
diskBytes
```

개별 제목은 일반 console log에 출력하지 않고 `targetKey`와 error code만 사용한다. raw payload path는 외부 workspace report 내부에만 기록한다.

## 12. 롤백·복구

- Task별 commit을 역순 revert할 수 있다.
- 외부 workspace current pointer는 validation 성공 전 변경하지 않는다.
- 새 parser/source 실패 시 이전 canonical revision과 cover는 유지한다.
- `--refresh`는 기존 raw revision을 삭제하지 않는다.
- Web adapter 문제 시 `PUBLIC_MOEMOA_CATALOG_LAB_URL`을 제거하면 기존 legacy/AniList resolver로 돌아간다.
- `MOEMOA + CATALOG_CANDIDATE`로 만든 local test Card는 사용자가 명시적으로 삭제하기 전 자동 삭제하지 않는다.
- external workspace 삭제는 `node tools/catalog-lab/cli.mjs clean --confirm TEST_ONLY`만 사용하며, 실행 후 복구할 수 없음을 명령 전에 표시한다.
- `src/data/aliases.json`, IndexedDB schema, app-private VisualAsset에는 rollback migration이 필요 없다.

## 13. 위험과 완화

| 위험 | 완화 |
| --- | --- |
| AniList 약관상 대량 보관 제한 | 100개 기술 표본 guard, production promotion 금지, full gate 유지 |
| AniLife 공개 페이지의 역검색 불가 | manual binding만 허용, sitemap 전체 content crawl 금지 |
| AniLife HTML 구조 변경 | raw 보존, schema drift로 source pause, 다른 source 결과 유지 |
| 동명이작·리메이크 오연결 | exact ID 또는 명시된 title+year/title+episode rule만 자동 match |
| 이미지 파일 위장·손상 | signature/MIME/dimension/checksum + Chromium decode |
| TEST_ONLY data 배포 | external root, production env guard, tracked/build/APK leakage scan |
| 재실행 중 중복·손상 | content-addressed raw, atomic state/current pointer, double-run gate |
| review backlog 폭증 | deterministic rules 우선, 20~50 batch, 두 번 뒤 `NEEDS_HUMAN` 종료 |
| model 비용·환각 | 모델 API 미연결, suggestion만 import, 자동 publish 금지 |
| source rate limit | concurrency 1, Registry spacing, Retry-After, bounded retry |

## 14. 필요한 사용자 결정

이 계획의 10→100 구현에는 추가 제품 결정이 없다. 다음 행동은 별도 사용자 승인 전 차단한다.

- AniList/AniLife의 100개 초과 수집.
- 3,998개 전체 수집.
- AniList/AniLife claim 또는 cover의 production 사용.
- review backlog에 저비용 모델을 실제 투입하는 비용·모델·batch 수.
- production core genre/tag 어휘 확정.
- local sample을 production DB로 migration.

## 15. 진행 기록

```text
[2026-08-17] 완료: 세 출처 조사, 역할·scope·오류·품질 설계 사용자 승인.
[2026-08-17] 완료: implementation task와 파일 지도 작성.
[2026-08-17] 대기: 사용자 실행 방식 선택과 구현 시작 승인.
```

각 task 실행자는 다음 형식을 아래에 누적한다.

```text
[YYYY-MM-DD HH:MM] 완료: Task N / commit / 검증 명령과 결과
[YYYY-MM-DD HH:MM] 발견: source·schema·환경 사실
[YYYY-MM-DD HH:MM] 변경: 계획 변경 전후와 이유
[YYYY-MM-DD HH:MM] 차단: 필요한 사용자 결정 또는 외부 상태
```

## 16. 발견 사항과 계획 변경

- AniLife public sitemap은 content URL 목록을 제공하지만 target 제목과 content ID의 검색 index를 제공하지 않는다. `/api/`는 robots 정책상 사용할 수 없으므로 자동 발견 대신 local manual binding으로 범위를 좁혔다.
- 기존 package scripts 네 개는 `.gitignore`에 포함된 존재하지 않는 collector를 가리킨다. Task 8에서 재현 가능한 `catalog:*` 명령으로 교체한다.
- Node core에는 JPEG/PNG/WebP 전체 decode API가 없다. 신규 native dependency 대신 기존 Playwright Chromium의 `createImageBitmap`을 최종 decode gate로 사용한다.
- Web browser는 repository 밖 파일을 직접 읽을 수 없다. actual payload를 repo로 복사하지 않고 loopback text-only server를 사용한다.
- 기존 `AnimeRef`는 AniList provider만 허용한다. 자체 catalog ID를 Card에 연결하기 위해 허용 조합을 `MOEMOA + CATALOG_CANDIDATE`로 제한해 확장한다.

## 17. 완료 보고

Task 10 종료 시 다음을 기록한다.

- 목표 달성 여부와 완료 commit 목록.
- 변경 파일과 각 책임.
- golden 10/sample 100 aggregate counts.
- source별 요청·retry·실패·pause·coverage.
- conflict/review backlog와 advisor 사용 여부.
- first/second run canonical hash와 entity/claim/image count 비교.
- 실제 workspace byte size와 삭제 절차 확인.
- Web offline search, production build, Android build, leakage guard 결과.
- DB/data migration 없음과 rollback 검증.
- 미해결 source 권리와 `FULL-CATALOG-INGESTION-GATE-01` 상태.
- 전체 3,998개 실행에 필요한 다음 사용자 승인 항목.
