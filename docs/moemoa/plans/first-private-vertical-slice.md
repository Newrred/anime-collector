# 첫 Private Vertical Slice ExecPlan

> **계획 상태: `APPROVED / IN PROGRESS`**
> 작성일: 2026-08-11
> 기준 저장소: `master@e71f211`
> 계획 기준: `PLANS.md`, `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`, `docs/moemoa/reports/architecture-decision-proposal.md`
> 승인일: 2026-08-12
> 승인 기록: `../decisions/2026-08-12-first-private-slice-approval.md`

이 문서의 구현 경계는 승인됐다. dependency 설치와 Android scaffold는 ADR-0003 environment gate 통과 뒤 실행한다.

## 1. 목적과 사용자 결과

Android 사용자가 로그인과 네트워크 연결 없이 다음 흐름을 끝낼 수 있게 한다.

```text
갤러리/다른 앱에서 이미지 공유 또는 앱 안에서 이미지 선택
→ 이미지를 확인하고 취소·교체 가능
→ 작품 검색 또는 PrivateTitle 입력
→ 선택적 짧은 기억 신호 작성
→ LOCAL_ONLY Private Memory Card 저장
→ Archive에서 즉시 확인
→ 앱 재시작 뒤 다시 열기·수정·삭제
→ 명시적 export로 로컬 백업 생성
```

이미지 권한을 거부했거나 적절한 이미지가 없는 사용자는 시스템 디자인 VisualAsset으로 같은 흐름을 완료할 수 있어야 한다.

이 slice의 제품 검증 질문은 하나다.

> 사용자가 본 애니의 장면·감정을 이미지 중심 카드로 빠르게 남기고, 나중에 Archive에서 다시 보고 싶어 하는가?

## 2. 관련 확정 결정

| ID | 이 계획에서 지키는 방식 |
| --- | --- |
| `PLATFORM-01` | Android intake와 공통 React surface를 사용하되 별도 제품으로 분리하지 않음 |
| `TECH-01` | Astro/React + Capacitor shell, native 기능은 bridge 뒤에 격리 |
| `CARD-01` | title reference + READY VisualAsset만 `COMPLETE_PRIVATE` |
| `IMAGE-01` | imageType/storageScope/visibility/rightsBasis 등 최소 metadata 기록 |
| `STORAGE-LOCAL-01` | app-private file + DB metadata, source URI 장기 보존 금지 |
| `ACCOUNT-01` | 설치별 Guest Owner로 로그인 없이 사용 |
| `CATALOG-01` | 검색 실패 시 PrivateTitle로 즉시 진행 |
| `LEGACY-01` | 기존 Library/WatchLog/Tier를 변경·자동 변환하지 않음 |

게이트 미통과 상태를 다음처럼 지킨다.

- Public route·publish command·public storage는 만들거나 켜지 않는다.
- private image auto-upload를 하지 않는다.
- full catalog ingestion을 실행하지 않는다.
- 기존 public profile/showcase/follow 기능을 새 Memory domain과 연결하지 않는다.

## 3. 현재 상태와 저장소 증거

- `package.json`: Astro 5.17.1, React 19.2.4, Supabase JS가 있고 Capacitor dependency는 없다.
- `astro.config.mjs`: React integration을 사용하는 정적 Astro 구성이다.
- `src/pages/`: 현재 `/`, `/library`, `/tier`, `/profile`, `/data`, `/help`, auth callback route가 있다. Memory/Archive route는 없다.
- `src/storage/idb.js`: `anime-collector-db` v1의 legacy stores를 관리한다. owner namespace와 MemoryCard/VisualAsset store는 없다.
- `src/storage/legacyMigration.js`: marker-last, 재실행 가능한 병합 패턴은 재사용 가치가 있지만 현재 migration은 Library/WatchLog/Tier용이다.
- `src/lib/anilist.js`: AniList GraphQL endpoint를 UI/runtime에서 사용할 수 있으나 provider boundary가 없다.
- `src/repositories/`: localStorage, IndexedDB mirror, Supabase가 혼재한다. 새 slice의 단일 원본으로 직접 재사용하지 않는다.
- `tests/unit/run-tests.mjs`: `*.test.mjs`를 순차 import하는 간단한 unit runner가 있다.
- `scripts/run-e2e.mjs`와 `tests/*.spec.ts`: Playwright Chromium 1-worker 회귀 테스트 기반이 있다.
- Android project, Gradle wrapper, native bridge test는 아직 없다.

구현 전 기준선 명령:

```powershell
npm run test:unit
npm run test:e2e -- --project=chromium --workers=1
npm run build
```

실패가 있으면 새 코드와 무관한 기존 실패인지 먼저 기록하고, 기준선이 불명확한 상태에서 milestone을 완료 처리하지 않는다.

## 4. 범위

### 포함

- 설치별 Guest Owner 생성과 owner-scoped local namespace.
- `AnimeRef` 또는 `PrivateTitle` 선택.
- `src/data/aliases.json`을 `legacy_unverified`로 읽는 local resolver, 기존 AniList search를 감싼 remote resolver, PrivateTitle fallback.
- Android 단일 `image/*` Share Target.
- Android Photo Picker 단일 이미지.
- 이미지 검토, 취소, 교체.
- app-private filesystem import, MIME/decode/size/dimension/hash 확인.
- 시스템 디자인과 텍스트 중심 디자인 VisualAsset 기본형.
- `MemoryCard`, `VisualAsset`, `media_operations` domain과 IndexedDB adapter.
- file + DB 보상 transaction, process death 및 orphan reconciliation.
- Private Card 작성, Archive 목록, 상세 열람, 선택 필드 수정.
- 이미지 교체 시 새 asset이 READY가 된 뒤 이전 asset 삭제.
- Card 삭제와 local file 삭제의 멱등 처리.
- JSON manifest + local image를 포함하는 export package 생성과 Android 공유.
- privacy-safe event contract와 local diagnostic logging.
- 현재 legacy Web/PWA 회귀 테스트.
- internal Android dogfood build와 실기기 smoke.

### 제외

- Board/BoardCard.
- Web production에서 LOCAL_ONLY image 생성·표시.
- 로그인, guest→account 승격, remote metadata sync.
- private cloud image backup과 restore/import.
- Public Memory Card/Board, feed, follow, comments, DM.
- image moderation, report/block/appeal 운영 UI.
- 전체 catalog ingestion, 자체 public catalog 관리 UI.
- 기존 Library/WatchLog/Tier 실제 migration 또는 삭제.
- 여러 이미지 공유, 영상, GIF animation, SVG.
- iOS.
- 광고, 구독, AI 분석.

## 5. 아키텍처·데이터 흐름

### 5.1 런타임 구성

```text
Astro route
  → React Memory UI
    → Memory application commands
      → Memory domain invariants
      → MemoryRepository port ── IndexedDB adapter
      → ImageIntakePort ──────── Capacitor/native bridge
      → LocalMediaPort ───────── app-private filesystem bridge
      → TitleResolver port ───── legacy alias / AniList / PrivateTitle fallback
      → TelemetryPort ────────── local diagnostics / test spy
```

React component는 `indexedDB`, `localStorage`, Capacitor plugin, Supabase, AniList 모듈을 직접 import하지 않는다. `createMemoryRuntime.js` composition root가 build/runtime capability를 확인해 adapter를 주입한다.

### 5.2 주요 domain model

```text
Owner
- id: guest:<uuid>
- kind: GUEST
- createdAt

AnimeRef
- id: internal UUID
- displayTitle, aliases, genres
- sourceBinding: { provider, externalId }
- verificationState: LEGACY_UNVERIFIED | PROVIDER_CANDIDATE

PrivateTitle
- id, ownerId
- displayTitle, normalizedTitle
- optionalGenres

MemoryCard
- id, ownerId
- animeRefId? XOR privateTitleId?
- visualAssetId?
- status: DRAFT | COMPLETE_PRIVATE | DELETED
- note?, watchedAt?, episode?, sceneCue?, emotionTags?, rewatchIntent?
- createdAt, updatedAt, deletedAt?

VisualAsset
- id, ownerId
- intakeSource
- imageType, storageScope, visibility, rightsBasis
- creator/source/license/permission fields
- contentRating, spoilerLevel, moderationStatus
- state: IMPORTING | READY | DELETE_PENDING | MISSING | DELETED
- localRef?, designSpec?
- checksumSha256?, mimeType?, byteSize?, width?, height?
- createdAt, updatedAt, deletedAt?

MediaOperation
- id, ownerId, assetId, cardId
- kind: IMPORT | REPLACE | DELETE | EXPORT
- state: PLANNED | FILE_READY | COMPLETED | FAILED
- attemptCount, lastErrorCode?, createdAt, updatedAt
```

### 5.3 Card 저장 command

```text
CreateMemoryCardInput
- operationId
- ownerId
- titleChoice
- intakeTicketId 또는 systemDesignSpec
- optional memory signals
```

1. input normalization과 owner/title invariant를 확인한다.
2. 같은 `operationId`의 완료 결과가 있으면 기존 결과를 반환한다.
3. DB transaction으로 Card `DRAFT`, Asset `IMPORTING`, Operation `PLANNED`를 예약한다.
4. native adapter가 source를 staging으로 복사하고 검사한다.
5. final localRef를 확정한다.
6. DB transaction으로 Asset `READY`, Card `COMPLETE_PRIVATE`, Operation `COMPLETED`를 함께 commit한다.
7. Archive query를 갱신하고 성공 이벤트를 보낸다.

실패 시 사용자는 typed error와 재시도·시스템 디자인 전환·취소 중 가능한 행동을 받는다. 자유 형식 native 오류나 source URI를 UI/log에 그대로 노출하지 않는다.

### 5.4 Share Target과 process death

```text
Android ACTION_SEND
→ native receiver/activity가 image/*와 caller grant 확인
→ native-private pending intake ticket 생성
→ Capacitor Activity/Memory composer 열기
→ JS가 claimPendingIntake()
→ preview
→ 사용자가 저장 확정할 때 import saga 실행
```

- intent 수신만으로 Card나 permanent file을 생성하지 않는다.
- 사용자가 취소하면 ticket과 staging을 제거하고 빈 Card를 남기지 않는다.
- process death 뒤 native pending ticket 또는 media operation journal에서 재개한다.
- 동일 intent가 반복 전달되면 ticket fingerprint/operation id로 중복 완료를 막는다.

### 5.5 시스템 디자인

시스템 디자인은 image byte 대신 versioned spec을 저장한다.

```text
designSpec
- version
- templateId
- paletteId
- patternSeed
- titleLayout
- optional genreTokens
```

렌더링 결과가 앱 버전마다 임의로 바뀌지 않도록 `version + seed`로 결정적이어야 한다. export 시 manifest와 함께 PNG derivative를 만들 수 있으나, local canonical source는 designSpec이다.

### 5.6 수정·교체·삭제

- note/date/episode 등 metadata 수정은 단일 DB transaction으로 처리한다.
- 제목 변경은 새 title reference의 owner/존재 확인 후 원자 교체한다.
- 이미지 교체는 기존 asset을 먼저 지우지 않는다. 새 asset이 READY가 되고 Card가 가리키는 ID를 commit한 뒤 이전 asset을 `DELETE_PENDING`으로 보낸다.
- Card 삭제는 tombstone을 먼저 기록하고 file delete를 멱등 실행한다. 완료 후 note, localRef, hash, creator/source 등 민감 필드는 scrub한다.
- Card 상세에서 file이 없으면 깨진 image placeholder와 교체/삭제 행동을 제공한다.

### 5.7 export

첫 export format은 versioned package다.

```text
moemoa-export-<timestamp>.zip
  manifest.json
  cards/<cardId>.json
  assets/<assetId>/original.<ext>
  assets/<assetId>/system-design.json
```

- current owner 데이터만 포함한다.
- manifest에 schema version, export time, record/file count, checksum을 둔다.
- source URI, absolute local path, analytics/device ID는 포함하지 않는다.
- export 생성 중에는 원본을 변경하지 않는다.
- 첫 slice는 export 생성과 내용 검증까지만 포함하고 restore는 후속 plan으로 둔다.

## 6. 변경 파일 지도

아래는 예상 변경 경로다. native spike 결과로 exact plugin wrapper 파일명은 달라질 수 있으며, 변경 시 이 문서의 발견 사항에 기록한다.

### 기존 파일

| 경로 | 변경 목적 |
| --- | --- |
| `package.json` | 승인된 Capacitor/Android dependency와 check/android scripts 추가 |
| `astro.config.mjs` | Capacitor `webDir=dist`와 충돌 없는 정적 build 확인. 필요 최소 변경만 수행 |
| `src/layouts/BaseLayout.astro` | internal Memory navigation/flag hook. legacy route 영향 최소화 |
| `src/lib/anilist.js` | 직접 API 구현은 보존하고 새 adapter가 사용할 안정된 export만 정리 |
| `tests/helpers/appState.ts` | Memory fake/runtime flag seed helper 추가 |
| `README.md` | internal Android 실행·검증 절차와 feature status 기록 |

### 신규 shared/runtime 파일

```text
src/config/featureFlags.js
src/features/memory/domain/memoryCard.js
src/features/memory/domain/visualAsset.js
src/features/memory/domain/titleReference.js
src/features/memory/domain/invariants.js
src/features/memory/application/ensureGuestOwner.js
src/features/memory/application/createMemoryCard.js
src/features/memory/application/updateMemoryCard.js
src/features/memory/application/deleteMemoryCard.js
src/features/memory/application/listArchive.js
src/features/memory/application/recoverMediaOperations.js
src/features/memory/application/exportMemoryArchive.js
src/features/memory/ports/memoryRepository.js
src/features/memory/ports/imageIntake.js
src/features/memory/ports/localMedia.js
src/features/memory/ports/titleResolver.js
src/features/memory/ports/telemetry.js
src/features/memory/adapters/indexeddb/memoryDb.js
src/features/memory/adapters/indexeddb/indexedDbMemoryRepository.js
src/features/memory/adapters/catalog/legacyAliasTitleResolver.js
src/features/memory/adapters/catalog/anilistTitleResolver.js
src/features/memory/adapters/platform/inMemoryMediaAdapter.js
src/features/memory/adapters/platform/capacitorImageIntake.js
src/features/memory/adapters/platform/capacitorLocalMedia.js
src/features/memory/adapters/telemetry/localDiagnosticTelemetry.js
src/features/memory/runtime/createMemoryRuntime.js
src/features/memory/ui/MemoryCardComposer.jsx
src/features/memory/ui/ArchiveView.jsx
src/features/memory/ui/MemoryCardDetail.jsx
src/pages/memory/new.astro
src/pages/archive/index.astro
```

현재 정적 Astro build에서는 runtime Card ID용 dynamic route를 만들지 않는다. 상세 화면은 `/archive/` React state와 URL fragment로 연다.

### Android

```text
capacitor.config.*
android/                                    # generated project, 승인 후 생성
android/app/src/main/AndroidManifest.xml
android/app/src/main/.../ImageIntakePlugin.*
android/app/src/test/...                    # native unit tests
android/app/src/androidTest/...             # instrumentation tests
```

### 테스트

```text
tests/unit/memoryCard.test.mjs
tests/unit/visualAsset.test.mjs
tests/unit/memoryOperations.test.mjs
tests/unit/memoryOwnerIsolation.test.mjs
tests/unit/systemDesign.test.mjs
tests/memory-card-create.spec.ts
tests/memory-archive.spec.ts
tests/memory-recovery.spec.ts
tests/memory-feature-isolation.spec.ts
tests/fixtures/memoryRuntimeHarness.jsx
```

### 문서

```text
docs/moemoa/adr/0002-memory-local-domain-and-owner-boundary.md
docs/moemoa/adr/0003-android-image-intake-bridge.md
docs/moemoa/reports/private-slice-test-evidence.md
docs/moemoa/plans/first-private-vertical-slice.md
docs/moemoa/README.md
CODEX_START_HERE.md
PACKAGE_MANIFEST.md
```

## 7. 데이터·스키마 마이그레이션

### 7.1 신규 DB

Database: `moemoa-memory-v1`, schema version 1.

| Store | key | 주요 index |
| --- | --- | --- |
| `owners` | `id` | `kind`, `createdAt` |
| `anime_refs` | `id` | `sourceKey`, `updatedAt` |
| `private_titles` | `id` | `[ownerId, normalizedTitle]`, `[ownerId, updatedAt]` |
| `memory_cards` | `id` | `[ownerId, status, updatedAt]`, `[ownerId, createdAt]`, `visualAssetId` |
| `visual_assets` | `id` | `[ownerId, state]`, `[ownerId, checksumSha256]`, `updatedAt` |
| `media_operations` | `id` | `[ownerId, state, updatedAt]`, `assetId`, `cardId` |
| `meta` | `key` | 없음 |

DB upgrade callback은 store/index 생성만 담당하고 네트워크·filesystem 작업을 하지 않는다. 데이터 backfill이 생기면 별도 resumable migration journal을 사용한다.

### 7.2 legacy data

- `anime-collector-db`, 기존 localStorage keys를 변경하지 않는다.
- 첫 slice는 legacy 데이터를 읽어 MemoryCard로 보여주지 않는다.
- future migration을 위해 Card/Title에 `legacySourceRef?` 확장 지점만 허용한다.
- Tier→Board 자동 변환 코드는 만들지 않는다.
- WatchLog→Draft preview는 후속 Board/Web slice의 별도 opt-in plan으로 둔다.

### 7.3 migration 검증

- 신규 DB 생성 전후 기존 Library/WatchLog/Tier record count와 snapshot hash가 동일해야 한다.
- 새 schema initialization을 여러 번 실행해도 store/index가 중복·삭제되지 않아야 한다.
- 실패 시 신규 feature만 recovery/read-only 상태가 되고 legacy route는 계속 동작해야 한다.

## 8. 마일스톤

### Milestone 0 — 승인 반영과 기술 조합 고정

상태: `[x] COMPLETED`

- 사용자가 이 architecture proposal과 ExecPlan 범위를 승인한다.
- `ADR-0002`에 Memory module, Guest Owner, 신규 IndexedDB 경계를 기록한다.
- 현재 공식 문서 기준 Capacitor core/cli/android, Android Gradle, JDK, plugin compatibility를 확인한다.
- Share receive가 유지보수 가능한 plugin으로 충족되는지 검증하고, 부족하면 최소 custom native bridge 범위를 문서화한다.
- min/target SDK와 Photo Picker fallback 범위를 `ADR-0003` 초안에 기록한다.
- 설치할 production dependency와 version을 변경 전에 보고한다.
- 기존 unit/E2E/build 기준선을 실행하고 결과를 test evidence에 기록한다.

완료 증거:

- 승인된 ADR-0002.
- exact dependency/SDK/bridge compatibility 표.
- baseline test 결과.
- 변경 없는 legacy data snapshot.

중단 조건:

- 지원 Android 범위가 제품 목표와 충돌.
- 필요한 receive-share plugin이 방치됐거나 과도한 권한을 요구.
- custom bridge 범위가 이 slice보다 커짐.

### Milestone 1 — native intake 위험 spike

상태: `[~] IN PROGRESS`

- 최소 Capacitor Android shell을 생성한다.
- `ACTION_SEND image/*` 한 장과 Photo Picker 한 장을 ticket으로 수신한다.
- app-private staging/final path로 복사하고 stat/hash를 반환한다.
- JS restart/process death 뒤 pending ticket을 다시 claim한다.
- UI는 spike 화면 또는 test harness만 사용하고 아직 MemoryCard를 저장하지 않는다.
- source URI를 domain/localStorage/analytics에 기록하지 않는지 확인한다.

완료 증거:

- 실기기에서 share→copy→앱 강제 종료→재실행→복사본 표시 영상 또는 스크린샷.
- permission cancel, invalid MIME, source grant 만료, storage full fault 결과.
- Android bridge contract test.
- 승인 가능한 `ADR-0003` 최종안.

중단 조건:

- 복사본을 안정적으로 재열 수 없음.
- bridge가 source URI를 장기 canonical reference로 요구.
- 현재 Web build 또는 legacy route를 깨뜨림.

### Milestone 2 — Memory domain과 port contract

상태: `[x] COMPLETED`

- Owner, AnimeRef, PrivateTitle, MemoryCard, VisualAsset, MediaOperation model을 구현한다.
- title XOR, READY VisualAsset, owner isolation invariant를 순수 함수로 고정한다.
- application command와 repository/media/title/telemetry ports를 정의한다.
- system design spec과 deterministic seed 규칙을 구현한다.
- Node unit tests에서 브라우저·native API 없이 모든 invariant를 검증한다.

완료 증거:

- unit tests에서 invalid Complete Card, cross-owner reference, 중복 operation이 모두 거부됨.
- 같은 designSpec이 같은 render view model을 생성함.
- domain import graph에 React, `window`, IndexedDB, Capacitor, Supabase, AniList가 없음.

### Milestone 3 — owner-scoped DB와 보상 transaction

상태: `[~] IN PROGRESS`

- `moemoa-memory-v1` schema와 `IndexedDbMemoryRepository`를 구현한다.
- 최초 Guest Owner를 멱등 생성한다.
- Create/Replace/Delete operation journal과 startup reconciliation을 구현한다.
- IndexedDB transaction failure와 media adapter fault를 주입할 수 있는 test seam을 만든다.
- legacy DB와 localStorage snapshot이 변하지 않는 contract test를 추가한다.

완료 증거:

- 저장 단계별 crash/failure matrix가 기대 상태로 복구됨.
- app/runtime 재시작 뒤 Complete Card와 READY asset이 다시 조회됨.
- final file만 있는 orphan, DB만 있는 missing file, delete pending이 재조정됨.
- 두 Guest Owner fixture 사이 데이터가 섞이지 않음.

### Milestone 4 — 공통 Card composer와 Archive UI

상태: `[~] IN PROGRESS`

- `/memory/new/`, `/archive/`, card detail route를 flag 뒤에 추가한다.
- image preview, 취소, 교체, 시스템 디자인 전환을 제공한다.
- title search timeout/error/no-result에서 PrivateTitle 입력으로 계속 진행한다.
- local alias 결과는 `legacy_unverified`로 구분하고 verified catalog처럼 표시하지 않는다.
- 선택적 note/date/episode/scene/emotion/rewatch 입력을 제공한다.
- 저장 성공 뒤 Archive에서 즉시 보이고 재열 수 있게 한다.
- Web Playwright에서는 deterministic fake native adapter를 사용한다.
- user-facing copy는 첫 slice 영어 기준으로 작성하고 기존 locale 구조와 충돌하지 않게 한다.

완료 증거:

- Playwright에서 create→Archive→detail→metadata edit 흐름 통과.
- cancel 시 Card/Asset/Operation count가 증가하지 않음.
- provider failure 상태에서도 PrivateTitle + system design으로 Complete Card 저장 가능.
- offline 상태에서 legacy alias read-only 검색 또는 PrivateTitle로 진행 가능하며 alias row가 canonical catalog로 변하지 않음.
- narrow mobile viewport에서 composer 핵심 CTA가 접근 가능.

### Milestone 5 — Android end-to-end 통합

상태: `[~] IN PROGRESS`

- native ticket을 실제 composer에 전달한다.
- 사용자가 저장을 확정할 때만 import saga를 시작한다.
- app-private image를 Archive/detail에서 안전하게 표시한다.
- 저장 버튼 중복 탭과 intent redelivery를 멱등 처리한다.
- background/foreground, orientation/configuration change, process death를 검증한다.

완료 증거:

- Share Target과 Photo Picker 각각 create→restart→Archive 열람 성공.
- 네트워크 비활성 상태에서 PrivateTitle + Card 저장 성공.
- source 앱이 이미지를 삭제하거나 grant가 만료돼도 imported Card 표시 성공.
- 원본 image byte가 IndexedDB, localStorage, URL query에 없음.

### Milestone 6 — 수정·교체·삭제·export·복구 UX

상태: `[~] IN PROGRESS`

- `[x]` note metadata 수정과 안전한 image replacement를 구현한다.
- `[x]` Card delete와 local file delete를 멱등 구현한다.
- `[~]` 상세 화면에서 missing/broken image의 교체·삭제 복구 진입점을 제공한다. 전체 filesystem orphan scan과 `MISSING` 자동 분류는 남아 있다.
- `[ ]` versioned ZIP export와 Android 공유를 구현한다.
- `[ ]` export manifest count/checksum 검증을 추가한다.
- `[ ]` staging/export temp TTL cleanup을 구현한다.

완료 증거:

- replacement 실패 시 기존 image/Card가 유지됨.
- delete 후 Card는 Archive에서 사라지고 file은 stat 불가, tombstone에는 민감 정보가 없음.
- export ZIP의 manifest record/file count와 checksum이 DB/file과 일치.
- 앱 재시작 후 pending delete/export cleanup이 완료됨.

### Milestone 7 — 회귀, 실기기 dogfood, 완료 보고

상태: `[ ] NOT STARTED`

- 전체 unit, Playwright 1-worker, Astro build를 통과시킨다.
- Android unit/instrumentation/build와 실기기 smoke를 통과시킨다.
- legacy `/library`, `/tier`, `/profile`, `/data` 핵심 회귀를 확인한다.
- `memoryV1` off와 on 두 configuration을 검증한다.
- privacy-safe event payload와 diagnostic redaction을 검사한다.
- test evidence, 알려진 한계, rollback rehearsal, 다음 gate를 문서화한다.

완료 증거:

- 첫 사용자 흐름의 화면/테스트 증거.
- failure/recovery matrix 결과.
- 신규·legacy data count 비교.
- feature flag rollback 뒤 legacy runtime 정상.
- Board/Web/sync/cloud/Public이 활성화되지 않았다는 확인.

## 9. 테스트와 검증

### 공통 명령

현재 명령:

```powershell
npm run test:unit
npm run test:e2e -- --project=chromium --workers=1
npm run build
```

계획된 추가 명령은 실제 script 생성 뒤 확정한다.

```powershell
npm run check
npm run test:memory
npm run test:e2e:memory
npm run android:sync
npm run android:test
npm run android:assemble:debug
```

Gradle wrapper 생성 뒤 evidence에 실제 명령을 기록한다. 예상 native 명령:

```powershell
.\android\gradlew.bat testDebugUnitTest
.\android\gradlew.bat connectedDebugAndroidTest
.\android\gradlew.bat assembleDebug
```

### 수용 기준

#### 정상 흐름

- 단일 share image로 2분 이내 첫 Complete Card 저장.
- Photo Picker와 시스템 디자인도 같은 Card invariant를 통과.
- 저장 직후와 재시작 뒤 Archive에서 동일 Card 확인.
- PrivateTitle 사용 시 네트워크 불필요.

#### 실패·복구

- picker cancel과 composer cancel은 permanent row/file을 남기지 않음.
- permission denial은 시스템 디자인 대체 경로를 제공.
- import/commit 중 process death 뒤 중복 Card 없이 완료 또는 정리.
- storage full은 기존 Card·legacy data를 손상시키지 않음.
- file missing은 crash 대신 복구 UI.

#### 격리

- owner A query에서 owner B row/file reference를 얻지 못함.
- `memoryV1=off`에서 새 route/nav가 노출되지 않음.
- 새 route가 기존 Supabase auth/public repository를 호출하지 않음.
- 신규 DB initialization이 legacy DB/localStorage를 변경하지 않음.

#### 권리·개인정보

- source URI/localRef/hash/note/title/search text가 analytics에 없음.
- AniList cover/banner가 VisualAsset 또는 export file로 포함되지 않음.
- 모든 Card는 PRIVATE, 모든 file asset은 LOCAL_ONLY.
- `rightsBasis=UNKNOWN`이 Public eligibility를 얻지 않음.

## 10. 보안·개인정보·권리 영향

- Android exported component를 image intake에 필요한 최소 범위로 제한한다.
- untrusted content provider stream은 size, MIME, decode, timeout 제한을 통과해야 한다.
- user filename과 URI path를 filesystem path에 연결하지 않는다.
- app-private path 밖의 delete/write를 거부하고 path를 로그에 출력하지 않는다.
- exact hash는 local duplicate 진단용이며 analytics/export 기본 metadata에는 노출하지 않는다. Export integrity checksum은 별도 manifest 범위로 제한한다.
- 이미지 유형과 권리 근거가 불명확해도 Private 기록은 가능하지만 Public command 자체가 존재하지 않는다.
- local original의 EXIF/GPS 보존 여부는 사용자에게 고지한다. cloud/public 단계에서는 별도 transform 정책이 필요하다.
- 앱 삭제 시 LOCAL_ONLY 데이터가 사라질 수 있으므로 첫 Card 후와 설정 화면에서 export를 안내한다.

## 11. 관찰 가능성·분석 이벤트

### 제품 이벤트

```text
card_creation_started
image_selected
system_design_selected
anime_selected
private_title_created
memory_card_save_succeeded
memory_card_save_failed
first_memory_card_saved
archive_revisited
memory_card_deleted
backup_exported
```

허용 속성 예:

```text
platform
intakeSource enum
imageType enum
titleChoiceType enum
result/errorCode enum
durationBucket
existingCardCountBucket
isOffline boolean
```

### 안정성 이벤트

```text
media_recovery_started
media_recovery_completed
media_operation_failed
local_asset_missing
export_failed
```

첫 slice에서는 원격 analytics 공급자 추가가 필수가 아니다. test spy와 redacted local diagnostics로 이벤트 계약과 failure 분포를 검증한다. 원격 전송은 개인정보 고지와 공급자 결정을 검토한 뒤 켠다.

## 12. 롤백·복구

### 기능 롤백

- `memoryV1`, `androidImageIntakeV1`을 off한다.
- 기존 Astro route와 legacy DB는 그대로 둔다.
- 신규 DB와 media file은 자동 삭제하지 않는다.
- 문제가 해결된 build에서 다시 열거나 recovery/export 도구로 접근할 수 있게 한다.

### schema 롤백

- IndexedDB schema downgrade를 시도하지 않는다.
- 실패 version은 read-only recovery mode로 열고 export/delete만 허용한다.
- 새 version migration은 copy/backfill + marker-last 방식으로 작성한다.

### file 복구

- startup에서 미완료 operation만 bounded scan한다.
- 전체 file tree scan은 maintenance 화면이나 charging/idle 조건으로 제한한다.
- orphan file은 즉시 삭제하지 않고 TTL과 operation evidence를 확인한다.
- `MISSING` asset은 자동으로 Card를 삭제하거나 다른 image로 바꾸지 않는다.

### 사용자 데이터 삭제

- rollback과 사용자 삭제를 구분한다.
- feature off는 데이터를 삭제하지 않는다.
- 사용자가 삭제를 요청하면 Card, file, temp/export file에 전파하고 결과를 검증한다.

## 13. 위험과 완화

| 위험 | 영향 | 완화 |
| --- | --- | --- |
| receive-share plugin 유지보수/호환성 | Android 핵심 흐름 차단 | Milestone 1 spike, 최소 custom bridge 대안, ADR 재검토 |
| IndexedDB와 file 불일치 | image 손실·고아 파일 | operation journal, final-file-first commit, startup reconciliation |
| WebView storage 손실 | metadata 손실 | export 안내, 실기기 durability test, SQLite adapter 재검토 trigger |
| 기존 public/auth code가 새 기능에 섞임 | 결정 위반·private leak | composition root 분리, flags, import/route contract test |
| AniList 장애/정책 변경 | title search 실패 | adapter 격리, PrivateTitle fallback, provider image 미사용 |
| 저사양 SEA Android 기기 | decode OOM·느린 저장 | native streaming copy, decode bounds, configurable limits, 실기기 matrix |
| system design 품질 부족 | 이미지 없는 사용자 이탈 | 소수 deterministic template로 시작, 사용 데이터 후 확장 |
| export만 있고 restore 없음 | 완전한 백업 기대 불일치 | UI에 export 범위 명시, restore를 다음 별도 plan으로 추적 |
| app uninstall | LOCAL_ONLY 완전 손실 | 첫 카드 이후 export 안내, 후속 opt-in cloud backup gate |

## 14. 필요한 사용자 결정

구현 시작 전 다음을 승인해야 한다.

1. 이 첫 slice를 **Android local-only Card/Archive**로 제한하는 것.
2. `moemoa-memory-v1` 신규 IndexedDB와 Guest Owner 방식을 사용하는 것.
3. Board, Web production read path, 로그인/sync, cloud backup, catalog ingestion을 후속 slice로 미루는 것.
4. 첫 slice는 export를 포함하되 restore/import는 후속 계획으로 미루는 것.

Milestone 0~1에서 exact dependency, Android 지원 범위, native bridge 유지보수성에 중대한 trade-off가 발견되면 실행을 멈추고 다시 결정받는다.

## 15. 진행 기록

```text
[2026-08-11] 완료: repository evidence와 확정 결정에 기반해 architecture proposal과 이 ExecPlan을 작성함.
[2026-08-11] 상태: 사용자 승인 전. 코드·dependency·Android scaffold·DB 변경 없음.
[2026-08-12] 완료: 사용자가 local-only first slice 경계와 실행 순서를 승인함.
[2026-08-12] 완료: baseline unit 40/40, Playwright 36 pass/2 live skip, Astro build pass.
[2026-08-12] 발견: Capacitor 8.5는 Node 22+와 Android Studio 2025.2.1+ 필요. 현재 일반 Node 20.20.1, Android Studio 2025.1.1.
[2026-08-12] 승인: application ID `com.newrred.moemoa`, Node/Android 환경 준비 승인.
[2026-08-12] 결정: Computer Use를 제외하고 terminal 기반 build·검증으로 전환.
[2026-08-12] 완료: official Node 24.19.0 portable, Capacitor 8.5.0 exact dependencies, Android API 24/36 scaffold 준비.
[2026-08-12] 완료: JBR 21 + Gradle 8.14.3 `assembleDebug`; debug APK 11,416,717 bytes 생성.
[2026-08-12] 변경: Android Studio IDE 2025.2.1+ update 선행 대신 CLI toolchain build를 environment gate로 채택. IDE 전용 문제가 발생하면 최신 안정판 side-by-side 설치 gate를 다시 연다.
[2026-08-12] 진행: image share intent policy 4 tests, durable pending ticket store 3 tests를 각각 RED→GREEN으로 구현. 아직 Activity/plugin 연결과 실기기 검증 전.
[2026-08-12] 검증: Android unit+assemble, Web unit 40/40, Astro build, Capacitor sync, sync 후 assemble 모두 통과.
[2026-08-12] 위험: production npm audit 17건(high 12). Astro 7 breaking upgrade를 요구하는 항목이 있어 이번 spike와 분리하고 production launch gate로 등록.
[2026-08-12] 완료: native streaming stage, bounded JPEG preview, durable ticket, `MainActivity` ACTION_SEND, Photo Picker/document fallback, custom Capacitor `ImageIntake` plugin, `/memory/new/index.html` React composer를 연결.
[2026-08-12] 검증: Web unit 43/43, 신규 composer Chromium E2E, Astro 9-page build, Android unit 25개와 assemble, React Doctor 변경분 100/100.
[2026-08-12] emulator: API 36에서 cold launch, synthetic MediaStore share, original/preview/ticket 생성, Web preview, discard 3-file cleanup, system Photo Picker launch/cancel을 terminal-only로 확인.
[2026-08-12] 발견/수정: Capacitor local server에서 `/memory/new/`가 root document fallback을 반환해 exact static path `/memory/new/index.html`로 변경.
[2026-08-12] 남은 gate: 물리 실기기 실제 share/picker 선택, EXIF orientation, storage full/source grant 만료, process-death 재claim, API 24~32 fallback. Card/VisualAsset 영구 저장은 Milestone 2 범위.
[2026-08-12] 완료: Guest Owner, PrivateTitle, MemoryCard, VisualAsset, MediaOperation domain/port와 system design deterministic spec을 구현하고 owner/title/READY asset invariant를 unit test로 고정.
[2026-08-12] 완료: 격리 DB `moemoa-memory-v1` schema 1, owner-scoped repository, IMPORT/DELETE journal과 startup reconciliation을 구현. 기존 `anime-collector-db`와 localStorage는 읽거나 변경하지 않음.
[2026-08-12] 완료: native staging ticket을 `files/moemoa-media` 영구 파일로 승격하고 opaque `asset:<uuid>`만 Web에 전달하는 promote/preview/delete bridge를 구현. 실패 보상과 멱등 동작을 Android unit test로 고정.
[2026-08-12] 완료: composer 저장, Archive 목록·재열기, 상세 note 수정·확인 삭제, 이미지 없는 deterministic system design fallback을 연결. Web E2E는 DEV 전용 fake native adapter를 사용하며 production에는 노출되지 않음.
[2026-08-12] emulator: API 36 system Photo Picker 실제 PNG 선택→PrivateTitle Card 저장→Archive 표시→앱 강제 종료/재실행 후 재열기→상세 삭제→native 영구 파일 제거를 terminal-only로 통과.
[2026-08-12] 검증: Web unit 68/68, Chromium 전체 40 pass/2 live skip, Astro static 11 pages, Android unit 30/30와 debug APK 11,793,876 bytes 통과. 상세 수치는 test evidence에 기록.
[2026-08-12] 발견/수정: 비대화형 Windows 실행에서 Astro dev server가 telemetry 입력을 기다릴 수 있어 E2E runner가 `CI=1`, `ASTRO_TELEMETRY_DISABLED=1` 기본값을 자식 서버에 전달하도록 고정.
[2026-08-12] 남은 구현: AnimeRef/local alias/AniList title resolver, 선택 metadata 전체, image replacement, missing/orphan file reconciliation UI, export package·Android 공유, temp TTL cleanup, feature flag rollback, 물리 실기기/API 24~32 matrix.
[2026-08-12] 완료: `aliases.json` local resolver는 기존 3,998개 row를 `LEGACY_UNVERIFIED` read-only 후보로만 반환하고, AniList resolver는 제목·별칭·장르·numeric provider ID만 `PROVIDER_CANDIDATE`로 투영하도록 RED→GREEN 계약을 고정. cover/banner/site URL은 결과와 VisualAsset에 포함되지 않음.
[2026-08-12] 완료: combined TitleResolver는 동일 AniList ID의 local/remote 후보만 병합하며 원격 실패·2.5초 timeout에도 local 결과와 PrivateTitle 경로를 반환. 사용자 자유 검색어는 telemetry와 ordinary log에 전달하지 않음.
[2026-08-12] 완료: CreateMemoryCard command와 IndexedDB repository가 PrivateTitle/AnimeRef XOR를 저장·복구하며, 선택하지 않은 입력은 PrivateTitle, 선택한 후보는 AnimeRef로 Complete Card를 생성. `moemoa-memory-v1` schema version은 1 유지.
[2026-08-12] 완료: composer 작품 검색·후보 provenance 표시·선택 해제·PrivateTitle fallback을 연결하고, 제목 변경 뒤 늦게 도착한 과거 응답을 generation guard로 폐기. resolver/aliases는 최초 검색 시에만 dynamic import.
[2026-08-12] 남은 구현 갱신: 선택 metadata 전체, image replacement, missing/orphan file reconciliation UI, export package·Android 공유, temp TTL cleanup, feature flag rollback, 물리 실기기/API 24~32 matrix. TitleResolver/AnimeRef 항목은 완료.
[2026-08-12] 검증: Web unit 77/77, Chromium 전체 43 pass/2 live skip, Astro static 11 pages, Android unit 30/30와 debug APK 11,730,977 bytes, React Doctor 89/100 통과. exact evidence와 잔여 위험은 test evidence 문서에 기록.
[2026-08-12] 완료: REPLACE operation journal을 추가해 신규 asset READY와 Card pointer commit 전에는 기존 asset을 보존하고, commit 뒤에만 이전 asset을 DELETE_PENDING→DELETED로 정리한다. 이전 파일 삭제 실패는 새 Card 성공을 되돌리지 않고 startup reconciliation이 재시작 뒤 이어서 완료한다.
[2026-08-12] 완료: Card 상세에서 Android image picker 기반 이미지 교체, bounded preview, 명시적 개인 사용 권리 확인, 취소 시 staging ticket 정리, 누락 이미지의 `이미지 복구`·`카드 삭제` 진입점을 연결했다. 교체 확정 전에는 기존 이미지가 계속 표시된다.
[2026-08-12] 리뷰/보강: native delete `false`, post-switch DB cleanup failure, fail-state 기록의 2차 실패도 신규 Card 성공을 되돌리지 않고 복구 journal을 유지한다. 같은 Card의 동시 REPLACE는 transaction에서 차단하고, 교체 중 저장된 최신 note를 pointer commit이 덮어쓰지 않는다. picker 연타·화면 이탈의 late ticket과 pre-reservation 거절 ticket ownership도 검증했다.
[2026-08-12] 추가 보강: metadata update는 Card 전체 snapshot 대신 허용된 note만 같은 readwrite transaction의 최신 Card에 병합한다. promotion 오류 기록이 2차 실패해도 journal의 ticket ownership을 유지하며, discard 미확인 ticket ID는 path/hash 없이 bounded local cleanup queue에 보존해 다음 runtime 시작에서 재시도한다.
[2026-08-12] 검증: Web unit 91/91, Chromium 전체 49 pass/2 live skip, Astro static 11 pages, Android sync와 unit 30/30·debug APK 11,730,977 bytes, React Doctor 변경분 100/100 통과.
[2026-08-12] 남은 구현 갱신: 선택 metadata 전체, 전체 filesystem orphan scan과 `MISSING` 자동 분류, export package·Android 공유, temp TTL cleanup, feature flag rollback, 물리 실기기/API 24~32 matrix. Image replacement와 상세 복구 진입점은 완료.
```

## 16. 발견 사항과 계획 변경

### 작성 시 발견

- 기존 `anime-collector-db`는 owner scope가 없고 localStorage와 원본/mirror 역할이 혼재한다. 새 DB 격리가 rollback 관점에서 안전하다.
- 현재 AniList API module은 search 결과에 cover/banner URL을 포함한다. 새 TitleResolver는 text/genre 중심으로 projection하고 이 URL을 Memory VisualAsset으로 사용하지 않아야 한다.
- `src/data/aliases.json`의 3,998개 row는 provenance가 없으므로 삭제하지 않고 `legacy_unverified` read-only 검색 fallback으로만 사용할 수 있다.
- 현재 저장소에는 Android project와 Capacitor dependency가 전혀 없다. 따라서 native intake는 구현 milestone이 아니라 먼저 실패 가능한 spike로 검증해야 한다.
- 기존 runbook의 catalog-first 번호와 Gap 분석의 local-first 권장 순서가 달랐다. 이 계획은 첫 사용자 가치와 미정 backend/auth/sync 회피를 근거로 local-first를 제안한다.
- Capacitor 공식 지원 정책상 v8은 Node 22+와 Android Studio 2025.2.1+가 필요하다. v7은 2026-12-08 extended support가 끝나므로 신규 기반으로 낮추지 않는다.
- staging ticket은 저장 확정 전까지만 유지하고, 확정 시 app-private `files/moemoa-media`의 original/preview/metadata commit set으로 승격한다. Web/DB에는 절대 경로나 source URI 대신 opaque `asset:<uuid>`만 보관한다. 이는 ADR-0001/0002 경계를 구체화하며 schema version 변경은 없다.
- 첫 composer 구현은 provider에 의존하지 않는 PrivateTitle 직접 입력부터 시작했고, 이후 local alias/AniList resolver와 AnimeRef 선택 저장을 같은 slice에 연결했다.
- Playwright의 native image 성공 경로는 DEV 빌드에만 존재하는 deterministic fake adapter를 사용한다. production Android는 Capacitor bridge만 사용하고 일반 Web에서는 local image input을 제공하지 않는다.
- 검색 adapter는 full catalog ingestion이나 legacy 승격이 아니다. `aliases.json` row는 계속 `LEGACY_UNVERIFIED`이며, AniList 응답도 `PROVIDER_CANDIDATE`일 뿐 MOEMOA verified catalog가 아니다. 두 후보는 numeric AniList binding이 동일할 때만 화면 검색 결과에서 병합한다.
- title resolver와 3,998-row alias payload는 Archive/detail runtime에서 정적으로 import하지 않고 첫 검색 시 lazy load한다. 이는 catalog 경계를 바꾸지 않는 번들 분리이며 신규 dependency나 schema 변경이 없다.
- image replacement는 신규 schema 없이 기존 `MediaOperation.kind=REPLACE`, `previousAssetId`, VisualAsset lifecycle을 사용한다. 교체 command 결과와 telemetry에는 opaque ID·enum·boolean만 포함하고 ticket, source URI, native path, checksum은 포함하지 않는다.

### 변경 기록 규칙

구현 중 다음이 바뀌면 이 섹션에 원래 계획, 새 계획, 근거, 승인 여부를 누적한다.

- DB engine 또는 store schema.
- Capacitor/plugin/bridge 방식.
- Android min/target SDK.
- file directory와 lifecycle state.
- 첫 slice 포함/제외 범위.
- 사용자 데이터 migration.

## 17. 완료 보고

상태: `NOT STARTED`

완료 시 다음을 채운다.

- 사용자 결과와 demo evidence.
- 실제 변경 파일.
- dependency와 schema version.
- unit/Web E2E/Android/실기기 결과.
- migration 전후 legacy/new data count.
- export/delete/recovery 검증.
- privacy/rights/event payload 검토.
- rollback rehearsal.
- 알려진 한계.
- 다음 승인 gate: Private Board + Web read path.
