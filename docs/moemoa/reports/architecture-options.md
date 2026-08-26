# MOEMOA Web/Android 아키텍처 선택지

> **문서 상태: `MIXED HISTORY — TECH-01/BACKEND-01 CONFIRMED`**
> client 옵션 비교의 결론은 2026-08-11, backend/user metadata 경계는 2026-08-26 사용자 승인으로 확정됐다. 이 문서의 backend 선택지는 비교 이력이며 최신 contract는 통합 Supabase 결정·설계를 따른다.

작성일: 2026-08-11
상태: `TECH-01` 옵션 B, `BACKEND-01` 단일 Supabase + read RLS + validated mutation RPC 확정. 상세 결정은 `decisions/2026-08-11-foundation-decisions.md`, `decisions/2026-08-26-unified-supabase-user-data.md`, 기술 경계는 `adr/0001-capacitor-client-and-local-media-boundary.md`.
현재 기준: Astro 5 + React 19 정적 Web/PWA + 브라우저 IndexedDB/localStorage + Supabase JS direct access (`package.json:23-36`, `astro.config.mjs:6-11`).

## 1. 선택 시 고정 조건

기술 방식과 무관하게 다음 제품 결정은 유지한다.

- Android가 Share Target, Photo Picker, 빠른 Card 작성의 주력 client다.
- Web은 Archive, Board, 계정/데이터 관리의 공통 기반이다.
- Web/Android는 동일 backend, auth 체계, 내부 ID, domain model을 사용한다.
- 로그인 없이 private Card/Archive/Board를 사용할 수 있다.
- Complete Card는 `Anime 또는 PrivateTitle + VisualAsset`이다.
- Public UGC는 별도 gate 통과 전 default off다.
- local image와 cloud backup 동의를 분리한다.
- 실제 사용자가 없었던 legacy cloud 구조는 신규 production schema로 이전하지 않으며 destructive local cleanup은 별도 승인한다.

현재 가장 큰 기술 위험은 화면 렌더링이 아니라 **Android가 전달한 이미지 URI를 안전한 앱 소유 파일로 바꾸고, 오프라인/프로세스 종료/계정 전환/삭제를 견디게 하는 것**이다.

## 2. 한눈에 보는 비교

| 항목 | A. PWA/TWA | B. Astro/React + Capacitor | C. Web + Kotlin/Compose |
| --- | --- | --- | --- |
| 기존 Web UI 재사용 | 매우 높음 | 높음 | Web만 높음, Android UI는 신규 |
| JS domain/Supabase 재사용 | 매우 높음 | 높음 | contract/fixture 중심, runtime 재사용 낮음 |
| Android Share/Photo Picker | Web API/manifest 및 TWA 제약 | native plugin/bridge로 가능 | Android API를 직접 사용 |
| 로컬 이미지 lifecycle | IndexedDB Blob/OPFS, 브라우저 제약 큼 | 앱 filesystem + SQLite adapter | 앱 filesystem + Room으로 가장 강함 |
| background/offline queue | service worker 제약 | native bridge/플러그인 필요 | WorkManager 직접 사용 |
| 출시 복잡도 | 가장 낮음 | 중간 | 가장 높음 |
| 장기 native 제어력 | 낮음 | 중간 | 높음 |
| Web/Android UI 일관성 | 가장 높음 | 높음 | 별도 관리 필요 |
| 테스트 부담 | Web + Android browser/TWA | Web + bridge/instrumentation | Web + 완전한 Android test suite |
| migration 비용 | 낮음~중간 | 중간 | 높음 |
| 현재 제품 적합도 | 빠른 검증에는 적합 | 균형이 가장 좋음 | 큰 팀/장기 native 투자가 있을 때 적합 |

감사 기준의 잠정 선두안이었던 **B가 2026-08-11 TECH-01로 확정됐다.** 기존 React 투자를 보존하면서 Android 이미지 intake와 앱 전용 파일 저장을 native 경계로 분리하는 선택이다. 아래 기술 spike는 선택 승인을 다시 받기 위한 것이 아니라 세부 bridge/plugin의 적합성을 검증하고 review trigger를 판단하기 위한 것이다.

## 3. 공통 목표 구조

세 옵션 모두 화면에서 provider/storage/Supabase를 직접 호출하는 현재 결합을 줄여야 한다.

```text
apps/web
  └─ Astro/React UI

apps/android 또는 android shell
  └─ Android entry points / native UI or WebView

packages/domain
  ├─ entity schema와 invariant
  ├─ use case
  ├─ migration fixture
  └─ sync contract

packages/adapters
  ├─ catalog-anilist / catalog-wikidata
  ├─ storage-web-idb
  ├─ storage-android
  ├─ media-web
  ├─ media-android
  └─ backend-supabase
```

실제 monorepo 전환은 선택 사항이다. 첫 단계에서는 현재 단일 package 안에 `domain/ports/adapters` 경계만 만들고, Android 방식 확정 후 물리적으로 분리할 수 있다. 디렉터리 재구성을 먼저 크게 수행하지 않는다.

공통 port 예시:

```text
CardRepository
BoardRepository
OwnerRepository
MediaRepository
CatalogProvider
SyncRepository
AuthProvider
TelemetryPort
```

domain은 browser `localStorage`, Supabase row, Android URI, Capacitor plugin을 직접 알지 않는다.

## 4. 옵션 A — PWA + TWA/Web Share Target

### 구조

- 현재 Astro/React 정적 앱을 유지한다.
- Web App Manifest `share_target`과 multipart 수신 route/service worker를 추가한다.
- 설치형 PWA를 우선 사용하고 Play Store가 필요하면 Trusted Web Activity wrapper를 둔다.
- metadata는 IndexedDB, image bytes는 IndexedDB Blob 또는 OPFS adapter에 저장한다.
- cloud/auth는 기존 Supabase JS를 adapter 뒤에서 사용한다.

### 재사용

- 현재 React 화면, Astro build, locale/theme, Supabase JS, Playwright 대부분을 재사용한다.
- 기존 PWA manifest와 service worker를 확장한다 (`public/manifest.webmanifest:1-23`, `public/sw.js:1-82`).
- current repository를 owner-scoped IndexedDB adapter로 바꿔야 한다.

### 장점

- 코드베이스와 배포 경로가 가장 단순하다.
- Web/Android UI divergence가 거의 없다.
- Play Store 배포 전 실제 사용자 Card 작성/Archive 반복성을 가장 빨리 검증할 수 있다.
- 작은 1인 개발/운영 비용에 유리하다.

### 약점과 위험

- Android Share Target의 파일 처리와 browser별 동작 편차가 있다.
- OPFS/IndexedDB quota, storage eviction, 대용량 이미지, background upload 제어가 native app보다 약하다.
- 공유 intent 직후 browser/process가 종료될 때 durable handoff를 보장하기 어렵다.
- Android Photo Picker, App Link, foreground/background lifecycle을 직접 제어하기 어렵다.
- TWA는 native API가 필요해질수록 별도 bridge가 아닌 wrapper 한계에 부딪힌다.

### local-first

- owner-scoped IndexedDB와 OPFS file manifest가 필요하다.
- browser storage persistence 요청과 quota/eviction UX가 필요하다.
- source URI가 아니라 copied Blob/object handle을 사용한다.
- backup 전 local asset 존재 여부와 hash를 검증한다.

### 테스트

- 기존 Playwright unit/E2E
- Chromium PWA install/share target fixture
- 실제 Android Chrome/TWA의 share intent
- browser storage eviction/quota
- offline create/restart/update/SW migration
- OAuth callback과 SW bypass

### 예상 migration

1. domain/storage port 분리
2. IndexedDB schema version-up과 owner namespace
3. VisualAsset Blob/OPFS adapter
4. manifest/SW share target
5. legacy snapshot import
6. optional TWA packaging과 App Link

### 적합한 경우

- Play Store native 품질보다 8~12주 내 private beta 검증이 더 중요하다.
- 사용자 이미지 크기를 강하게 제한해도 된다.
- background upload와 복잡한 file lifecycle을 P0에서 제외한다.

### 중단 기준

실기기 spike에서 다음 중 하나가 재현되면 B 또는 C로 이동한다.

- 공유 파일이 process restart 후 안정적으로 복구되지 않음
- storage eviction/용량 제어가 목표 사용량을 충족하지 못함
- Photo Picker/Share Target UX가 목표 단계 수를 만족하지 못함
- private cloud upload 재시도 품질을 확보하지 못함

## 5. 옵션 B — Astro/React + Capacitor Android shell

### 구조

- Web은 현재 Astro/React 빌드를 유지한다.
- Android는 Capacitor shell에서 같은 React UI 또는 Android 전용 얇은 entry UI를 실행한다.
- Share Intent, Photo Picker, App Link, 앱 전용 filesystem, SQLite/background task를 plugin/native bridge 뒤에 둔다.
- Web은 IndexedDB/media Web adapter, Android는 SQLite/filesystem adapter를 사용한다.
- domain/use case와 Supabase client adapter는 JS/TS로 공유한다.

### 재사용

- 현재 React 화면과 Astro UI 자산을 대부분 재사용한다.
- mobile responsive 테스트와 data/auth UI를 활용할 수 있다.
- 현재 repository/service를 port로 분리한 뒤 Web/Android adapter를 교체한다.
- recap canvas primitive는 system design card 생성에 활용 가능하다 (`src/services/recapShare.js:48-107`).

### 장점

- UI 재사용과 native 이미지 intake의 균형이 좋다.
- Android 공유 URI를 native code에서 앱 전용 영역으로 즉시 복사할 수 있다.
- WebView 화면과 native entry를 단계적으로 혼합할 수 있다.
- 1인 개발자가 Web/Android를 하나의 JS domain으로 유지하기에 현실적이다.
- 필요 기능만 작은 Kotlin bridge로 보강할 수 있다.

### 약점과 위험

- 현재 저장소에는 Capacitor 기반이 전혀 없어 Android project/release/signing 체계가 새로 필요하다.
- WebView lifecycle과 native filesystem/SQLite 사이의 transaction 경계를 설계해야 한다.
- plugin 품질·업데이트에 의존하며 일부 기능은 직접 Kotlin 구현이 필요할 수 있다.
- Astro의 모든 route/client-only 동작이 WebView navigation/OAuth에서 그대로 맞는지 검증해야 한다.
- native/background 처리 결과를 React state에 전달하는 중복/재전달 계약이 필요하다.

### 권장 bridge 경계

```text
receiveSharedImages() -> IntakeEnvelope[]
pickImages() -> IntakeEnvelope[]
copyIntoAppStorage(envelope) -> LocalAsset
createThumbnail(assetId, policyVersion) -> DerivedAsset
getAssetAvailability(assetId) -> state
enqueueUpload(assetId) -> operationId
deleteLocalAsset(assetId) -> operationId
```

bridge는 Card 본문이나 catalog 규칙을 소유하지 않는다. domain use case가 returned asset를 검증하고 Card status를 전환한다.

### local-first

- Android metadata: SQLite 계열 adapter 권장
- Android bytes: app-private filesystem
- Web metadata: IndexedDB
- Web bytes: OPFS/IndexedDB 또는 cloud-only download cache
- 공통 ID, operation/revision schema로 sync
- 기기별 file availability를 별도 값으로 취급

### 배포

- Web: 기존 Vercel static deployment 유지 가능
- Android: Gradle build, keystore/Play App Signing, internal testing track 추가
- OAuth: Android custom scheme보다 verified App Link/PKCE callback 우선 검토
- Vercel/GitHub Pages 중 canonical origin 하나를 확정해야 한다.

### 테스트

- 기존 Web unit/Playwright/build
- domain contract fixture를 Web/Android adapter에 공통 적용
- Kotlin/plugin unit 및 Android instrumentation
- Share Target/Photo Picker/process death/URI 만료 실기기 테스트
- WebView OAuth/App Link
- JS↔native bridge duplicate delivery와 version mismatch
- 앱 update 중 SQLite/filesystem migration

### 예상 migration

1. domain/port 추출과 current Web adapter 유지
2. Capacitor minimal shell 생성
3. native intake/filesystem spike
4. owner-scoped Android metadata store
5. local-only Card vertical slice
6. Web Archive read path
7. auth/App Link와 metadata sync
8. 선택적 private image backup

### 적합한 경우

- 기존 Web 투자와 1인 개발 생산성을 보존해야 한다.
- Android Share/Photo Picker와 file lifecycle은 P0 품질 요구다.
- Compose로 전체 UI를 이중 구현할 자원은 없다.

### 중단 기준

- 핵심 bridge가 plugin 조합으로 안정화되지 않고 native 코드 비중이 계속 커짐
- WebView memory/performance가 실제 카드 Archive 규모를 충족하지 못함
- OAuth/App Link 및 background upload가 반복적으로 lifecycle 결함을 만듦
- Android UI 요구가 Web과 빠르게 갈라져 이중 구현 비용이 Compose보다 커짐

## 6. 옵션 C — Astro Web + Kotlin/Compose Android

### 구조

- Web은 현재 Astro/React를 유지한다.
- Android는 Compose UI, Room, app-private filesystem, WorkManager, Photo Picker, Share Target, App Link로 신규 구현한다.
- 공유되는 것은 UI/runtime 코드가 아니라 domain schema, OpenAPI/JSON Schema, ID/sync protocol, fixture다.
- backend API 또는 Supabase contract가 두 client의 공통 경계가 된다.

### 재사용

- Web UI와 배포는 유지한다.
- 기존 JS domain은 명시 contract를 만드는 참고 자료로 사용한다.
- Android UI/runtime은 대부분 신규다.
- migration fixture와 sync semantics는 양쪽에서 공유한다.

### 장점

- Android file, process death, background retry, notification, deep link 제어력이 가장 높다.
- Room transaction과 WorkManager로 durable local-first queue를 명확히 구현할 수 있다.
- WebView/plugin 제약이 없다.
- 장기적으로 Android가 주력 제품이면 플랫폼 품질 최적화가 쉽다.

### 약점과 위험

- UI와 use case presentation을 Web/Android에서 이중 구현한다.
- JS/Kotlin model drift를 contract generation과 fixture로 관리해야 한다.
- 현재 규모의 1인 개발에서는 출시와 유지보수 시간이 가장 길다.
- 기능 parity, localization, accessibility, analytics를 두 번 검증한다.
- backend contract가 불안정하면 양 client 수정 비용이 커진다.

### local-first

- Room이 entity/revision/tombstone/operation queue의 단일 Android 원본
- filesystem과 DB transaction은 staged state + reconcile worker로 연결
- WorkManager가 upload/delete/reconcile 담당
- Web은 같은 protocol의 IndexedDB adapter

### 테스트

- Kotlin unit/Room migration/WorkManager test
- Compose UI/instrumentation/실기기 lifecycle
- Web Playwright
- generated contract compatibility
- cross-client sync E2E와 server integration
- store release/rollback

### 예상 migration

1. server/domain contract 확정
2. Web adapter와 legacy migration 유지
3. Android Room/domain/client 신규 구현
4. local-only image slice
5. metadata sync와 Web Archive
6. Board와 cloud image

### 적합한 경우

- Android가 장기적으로 압도적인 주력 client다.
- native UX/성능과 background reliability가 UI 코드 재사용보다 중요하다.
- 두 client를 지속 관리할 개발 자원 또는 긴 일정이 있다.

## 7. React Native를 별도 본안으로 두지 않은 이유

React 이름은 같지만 현재 DOM/CSS/Astro 화면을 React Native가 직접 재사용하지 못한다. domain JS는 공유할 수 있으나 UI를 상당 부분 다시 만들어야 하고, 이미지 filesystem/intent/native module 문제도 남는다. 현재 조건에서는 **UI 재사용 목표라면 Capacitor**, **native 품질 목표라면 Compose**가 trade-off를 더 명확히 보여준다.

다만 팀이 React Native 운영 경험을 보유했거나 iOS가 단기 범위에 들어오면 옵션 C의 대체안으로 다시 비교할 수 있다. 현재 iOS 요구는 확인되지 않아 `UNKNOWN`이다.

## 8. Backend 선택지

Android client 기술과 별도로 비교했던 BACKEND-01 선택지다. 최신 결론은 2026-08-26 통합 Supabase 결정 문서를 따른다.

### B1. Supabase direct access 유지 + RLS/Edge Function 보강

구성:

- private CRUD는 client→Supabase RLS
- privileged 작업, account delete, moderation, signed upload 정책은 Edge Function/server function
- versioned SQL migration과 generated types 추가

장점:

- 현재 Supabase JS/auth/RLS 투자 재사용
- 작은 운영 부담
- private vertical slice 출시가 빠름

위험:

- 두 client에 sync/orchestration 로직이 분산될 수 있음
- 복잡한 atomic commit, rate limit, moderation 권한은 RLS만으로 관리하기 어려움
- 실제 production policy drift를 별도로 감시해야 함

### B2. Thin application API 추가 + Supabase를 persistence/auth로 유지

구성:

- Web/Android는 versioned API를 호출
- API가 card/board sync commit, image manifest, account delete, moderation을 조정
- Supabase DB/Auth/Storage는 하부 인프라로 유지

장점:

- 두 client의 계약과 validation을 중앙화
- atomic operation/idempotency/rate limit/audit에 유리
- Public UGC와 private data 경계를 명확히 만들기 쉬움

위험:

- 배포/관측/비용/장애 지점 추가
- local-first 초기 private Card만 검증할 때는 과도할 수 있음
- 기존 direct query를 단계적으로 격리해야 함

### Backend 당시 잠정안

Phase 1 local-only와 초기 metadata sync까지는 B1을 기본으로 검증하되, 다음 기능 전에 B2 전환 기준을 재평가하는 것이 합리적이다.

- multi-entity atomic commit이 필수
- resumable image operation을 server가 조정해야 함
- Public moderation/admin/audit 도입
- client별 sync 로직 drift 발생
- abuse/rate limit가 RLS만으로 부족

이 절은 2026-08-11 당시 BACKEND-01 결정을 위한 권장 출발점이었다. 2026-08-26에는 B1을 보강한 단일 Supabase + read RLS + validated mutation RPC로 확정됐다.

## 9. 선택 전 3개 time-boxed spike

### Spike 1 — Android intake durability

동일 이미지에 대해 A와 B를 각각 작은 prototype으로 검증한다.

- Share Intent 수신
- Photo Picker
- app-private copy
- process kill/restart 복구
- 중복 intent idempotency
- thumbnail 생성
- 20~50장 archive scroll

완료 기준: 원본 URI permission이 사라져도 local asset가 열리고, 중복 Card가 생기지 않으며, 실패 상태를 재시도/삭제할 수 있어야 한다.

### Spike 2 — owner-scoped storage/migration

- 기존 snapshot v5 fixture import
- guest owner 생성
- A 로그인 승격
- 로그아웃/B 로그인 격리
- rollback/export

완료 기준: A 데이터가 B에 보이거나 sync되지 않고, 실패 후 legacy snapshot으로 복구 가능해야 한다.

### Spike 3 — sync/object boundary

- Card metadata 먼저/나중 성공
- image upload 실패/중복
- delete 대 edit
- Board reorder conflict
- 기기 2대 fixture

완료 기준: orphan를 탐지·reconcile하고 삭제가 부활하지 않으며 동일 operation 재전송이 무해해야 한다.

## 10. 확정 client 방향과 미정 backend

Client와 local storage/legacy 방향은 확정됐고, backend 초기안은 아직 **잠정 권장**이다.

```text
Client: 옵션 B — Astro/React + Capacitor Android shell
Backend 초기: B1 — Supabase direct/RLS + 제한된 privileged function
공통 기반: JS/TS domain contract + Web/Android storage/media adapter
첫 slice: local-only VisualAsset + MemoryCard + Archive
Public: default off
```

이유:

1. 현재 React/Astro와 Supabase 투자를 가장 많이 보존한다.
2. 제품의 가장 큰 위험인 Android 이미지 intake를 native 경계에서 처리한다.
3. Compose 전체 재작성보다 1인 개발 유지비가 낮다.
4. PWA만 사용할 때보다 앱 전용 file lifecycle과 App Link를 통제할 수 있다.
5. 나중에 특정 화면만 native로 옮기거나 backend API를 추가하는 단계적 경로가 있다.

Client/local-only slice 승인 조건:

- Spike 1의 process death/URI/file 성능 통과
- 최소 지원 Android version과 Play Store 배포 의사 확인
- Capacitor/plugin 유지보수 범위 수용
- Guest Owner namespace와 local DB/storage 방식 확정
- `[완료]` 사용자가 TECH-01과 STORAGE-LOCAL-01을 Decision Log에서 승인

Backend 초기 B1은 이 조합의 **당시 remote 단계 잠정안**이었으며 local-only slice 시작 조건이 아니었다. BACKEND-01은 2026-08-26 승인됐지만, 실제 remote schema나 sync endpoint 변경은 승인된 상세 설계의 별도 ExecPlan과 검증을 거쳐야 한다.

client 조건을 통과하지 못하면 A로 축소하거나 C로 전환한다. TECH/STORAGE 승인 전에는 dependency 설치, Android scaffold, local DB migration을 실행하지 않는다.
