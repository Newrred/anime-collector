# MOEMOA 상세 아키텍처 결정 제안

> **문서 상태: `APPROVED IMPLEMENTATION BOUNDARY`**
> 작성일: 2026-08-11
> 기준 저장소: `master@e71f211`
> 승인일: 2026-08-12
> 승인 기록: `../decisions/2026-08-12-first-private-slice-approval.md`

이 문서는 `TECH-01`, `STORAGE-LOCAL-01`, `LEGACY-01`을 변경하지 않는다. local-only first slice 경계는 승인됐고 exact Capacitor/Android toolchain은 ADR-0003 environment gate를 따른다.

## 1. 결론 요약

첫 구현 단위는 **Android에서 이미지 또는 시스템 디자인을 사용해 로그인 없이 Private Memory Card를 만들고, 재시작 후 Archive에서 다시 확인·수정·삭제·내보내기 할 수 있는 local-only 흐름**으로 제한한다.

권장 실행 순서는 다음과 같다.

```text
1. local-only Card + Archive
2. Private Board + Web read path
3. guest→account 승격 + metadata sync
4. 명시적 동의 기반 private image backup
5. 제한 catalog ingestion
6. Public 준비 상태 재평가
```

기존 runbook의 catalog-first 번호를 그대로 구현 순서로 사용하지 않는다. 첫 카드 저장에는 전체 카탈로그가 필요하지 않으므로, 기존 alias 데이터와 AniList 검색을 **교체 가능한 최소 TitleResolver adapter**로 감싸고 검색 실패 시 `PrivateTitle`로 진행한다. alias 데이터는 `legacy_unverified` 상태를 유지하며, AniList 표지 이미지는 새 Memory Card의 VisualAsset으로 저장하거나 재배포하지 않는다.

이 순서의 이유는 다음과 같다.

- 가장 큰 제품 가설인 `이미지 중심 기록 → Archive 재방문`을 가장 먼저 검증한다.
- `BACKEND-01`, `AUTH-01`, `SYNC-01`, `IMAGE-SYNC-01`을 임의로 확정하지 않는다.
- legacy Library·WatchLog·Tier를 건드리지 않아 현재 서비스와 롤백 경계를 보존한다.
- Android native intake와 file/DB 실패 복구라는 가장 큰 기술 위험을 초기에 검증한다.

## 2. 입력 조건과 비목표

### 확정 입력

- `TECH-01`: Astro/React 공통 surface + Capacitor Android shell.
- `STORAGE-LOCAL-01`: app-private filesystem에 image byte, DB에 VisualAsset metadata.
- `LEGACY-01`: Library는 legacy title state, WatchLog는 Draft seed 후보, Tier는 read-only. 자동 Tier→Board 변환 금지.
- `CARD-01`: Anime 또는 PrivateTitle + VisualAsset 1개가 Complete Card 조건.
- `ACCOUNT-01`: 로그인 없이 Private Card/Archive/Board 사용 가능.
- `IMAGE-01`: 이미지 유형·저장 범위·공개 범위·권리 근거를 데이터 모델에서 분리.

### 이번 제안이 결정하지 않는 것

- backend 공급자, API 형태, remote DB schema.
- 인증 공급자와 계정 병합 UI.
- metadata sync 충돌 정책.
- private cloud image backup의 용량·리전·포맷.
- Public UGC, 애니 캡처 Public, 타인 팬아트 Public.
- full catalog 수집 출처와 라이선스 등급.
- canonical production origin.

## 3. 저장소 사실과 재사용 판단

현재 저장소는 Astro 5 + React 19 정적 Web/PWA이며, UI는 `src/components/`, route는 `src/pages/`, 도메인 함수는 `src/domain/`, 영속화는 `src/repositories/`와 `src/storage/`에 분산되어 있다.

기존 `src/storage/idb.js`는 `anime-collector-db` v1에 Library, WatchLog, Tier, cache, meta store를 둔다. 동시에 여러 repository가 localStorage를 원본 또는 mirror로 사용한다. 이 구조는 현재 runtime 보존에는 필요하지만 새 Memory domain의 owner-scoped 단일 원본으로 재사용하기에는 위험하다.

따라서 재사용 경계를 다음처럼 둔다.

| 현재 자산 | 판단 | 새 구조에서의 사용 |
| --- | --- | --- |
| Astro/React shell, layout, 디자인 토큰 | `REUSE` | 새 route와 Memory UI의 공통 기반 |
| 순수 domain 함수와 Node unit runner 패턴 | `ADAPT` | Memory domain을 브라우저 API 없는 plain JS로 작성 |
| repository 경계 패턴 | `ADAPT` | 명시적 port/interface와 owner context 추가 |
| `src/lib/anilist.js` | `ISOLATE` | `TitleResolver` 뒤의 임시 read-only remote adapter. UI 직접 import 금지 |
| `src/data/aliases.json` | `PRESERVE + ISOLATE` | `legacy_unverified` read-only local search fallback. canonical catalog 승격 금지 |
| `anime-collector-db` v1 및 localStorage keys | `PRESERVE` | 첫 slice에서 read/write/migration하지 않음 |
| 기존 profile/showcase/follow/public 경로 | `ISOLATE` | 새 Memory route에서 노출·호출하지 않고 feature flag 기본 off |
| 기존 Supabase auth/sync | `PRESERVE` | 첫 slice와 연결하지 않음. AUTH/SYNC 결정 후 adapter 검토 |

## 4. 제안 결정 묶음

아래 항목은 승인 시 후속 ADR로 승격할 후보이다.

### AP-01 — 기능 단위 modular monolith

새 Memory 기능은 기존 앱 안에 기능 단위 모듈로 추가하고, 별도 Web 앱이나 별도 Android 앱을 만들지 않는다.

```text
Astro routes / React UI
        ↓ commands + view models
Memory application layer
        ↓ ports
Domain model and invariants
        ↓ adapters
IndexedDB metadata / Capacitor native media / TitleResolver / Telemetry
```

첫 slice에서는 현재 저장소의 언어와 빌드 경계를 존중해 **plain JavaScript + JSDoc type contract**를 사용한다. TypeScript 전환은 별도 repo-wide 결정 없이 섞어 넣지 않는다.

### AP-02 — 신규 owner-scoped Memory DB 격리

새 metadata 원본은 별도 IndexedDB database `moemoa-memory-v1`에 둔다. 기존 `anime-collector-db`를 version upgrade하거나 기존 store를 재사용하지 않는다.

권장 store:

```text
owners
anime_refs
private_titles
memory_cards
visual_assets
media_operations
meta
```

모든 사용자 데이터 row는 `ownerId`를 가지고, 조회는 항상 현재 Owner namespace로 제한한다. 첫 구현의 DB engine은 WebView와 Web test surface에서 공통으로 사용할 수 있는 IndexedDB다. engine은 `MemoryRepository` port 뒤에 두어, 실기기 내구성·성능 증거가 부족할 경우 native SQLite adapter로 교체할 수 있게 한다.

선택 근거:

- 현재 코드와 테스트 도구를 가장 많이 재사용한다.
- remote schema나 인증 결정을 요구하지 않는다.
- 별도 DB이므로 legacy rollback과 데이터 수 비교가 단순하다.
- 첫 beta 규모에서 필요한 query는 owner + status + time 정렬 중심이다.

재검토 조건:

- WebView storage 손실·corruption 재현.
- 목표 기기에서 1,000개 카드 Archive query 또는 migration 성능 기준 미달.
- Android backup/restore 또는 파일 transaction 요구를 IndexedDB가 충족하지 못함.

### AP-03 — 설치별 Guest Owner namespace

앱 최초 실행 시 cryptographically random UUID를 생성해 `Owner(kind=GUEST)`로 저장한다. 외부 provider ID, 기기 광고 ID, Android hardware ID를 owner ID로 사용하지 않는다.

```text
ownerId = guest:<uuid>
```

- 모든 command는 `OwnerContext`를 명시적으로 받는다.
- owner가 다른 entity를 참조하면 domain/repository 양쪽에서 거부한다.
- 로그인은 이 owner를 덮어쓰지 않는다. 향후 `AccountLink`가 guest owner와 account owner를 연결하거나 승격한다.
- 로그아웃·계정 전환·병합은 `AUTH-01` 승인 전 구현하지 않는다.

### AP-04 — title은 내부 reference, provider는 출처 binding

MemoryCard는 AniList ID를 직접 foreign key로 사용하지 않는다.

첫 slice의 제목 선택지는 두 가지다.

```text
AnimeRef
- 내부 UUID
- displayTitle / aliases / genres snapshot
- sourceBinding(provider, externalId)
- verificationState = LEGACY_UNVERIFIED | PROVIDER_CANDIDATE

PrivateTitle
- 내부 UUID
- ownerId
- displayTitle
- optional genres
```

MemoryCard는 `animeRefId`와 `privateTitleId` 중 정확히 하나만 가진다. `AnimeRef`는 완성된 공용 catalog row가 아니라 첫 slice의 로컬 reference다. 후속 catalog ingestion에서 canonical Anime와 연결할 수 있지만, 사용자의 카드 ID와 제목 snapshot은 유지한다.

`TitleResolver` contract:

```text
searchTitles(query, locale, limit) -> TitleCandidate[]
resolveCandidate(candidateKey) -> AnimeRefDraft
```

- resolver chain은 `legacy_unverified aliases read-only 검색 → AniList remote adapter → PrivateTitle` 순서로 동작한다. 로컬 alias 결과와 remote 결과를 같은 검증 등급으로 표시하지 않는다.
- 현재 AniList 호출은 adapter 내부에서만 허용한다.
- timeout·rate limit·network failure는 PrivateTitle 진행을 막지 않는다.
- 새 Card UI는 AniList cover/banner URL을 VisualAsset 또는 카드 표지로 사용하지 않는다.
- provider 제거 시 adapter와 source binding만 바꾸고 Card schema는 유지한다.
- `src/data/aliases.json`은 provenance가 없으므로 표시·검색 후보로만 사용하고 verified Anime나 공용 catalog row로 자동 승격하지 않는다.

### AP-05 — VisualAsset은 파일과 metadata를 분리

file-backed VisualAsset의 최소 metadata:

```text
id, ownerId
intakeSource
imageType
storageScope = LOCAL_ONLY
visibility = PRIVATE
rightsBasis
creatorName?, sourceUrl?, licenseType?, permissionEvidenceRef?
contentRating, spoilerLevel
moderationStatus
state
localRef
checksumSha256
mimeType, byteSize, width, height
createdAt, updatedAt, deletedAt?
```

`localRef`는 앱 내부 상대 경로 또는 native adapter가 발급한 opaque key다. absolute path, `content://` URI, signed URL을 domain과 analytics에 저장하지 않는다.

권장 lifecycle:

```text
IMPORTING → READY → DELETE_PENDING → DELETED
                   ↘ MISSING
```

- `READY`만 Complete Card에 연결할 수 있다.
- `MISSING`은 Card를 자동 삭제하지 않고 복구/교체 UI를 제공한다.
- `SYSTEM_DESIGN`과 `TEXT_DESIGN`은 file이 아니라 versioned `designSpec`을 저장하며 즉시 `READY`가 될 수 있다.
- 이미지 유형을 모르면 `UNKNOWN`, 권리 근거를 모르면 `UNKNOWN`으로 저장하고 이후 Public eligibility는 fail-closed로 처리한다.

### AP-06 — native image intake bridge는 ticket 기반

JS layer가 Android source URI를 장기 보관하지 않도록 native bridge를 ticket 기반으로 둔다.

제안 contract:

```text
ImageIntakePort
- claimPendingIntake() -> IntakeTicket | null
- pickImage() -> IntakeTicket | null
- discardIntake(ticketId)

LocalMediaPort
- importToPrivate(ticketId, ownerId, assetId, operationId) -> ImportedMedia
- resolveDisplaySource(localRef) -> DisplayHandle
- stat(localRef) -> LocalMediaStat | null
- deleteLocal(localRef, operationId)
- exportLocal(localRef, exportSessionId)
```

`IntakeTicket`은 process death 뒤 다시 claim할 수 있는 짧은 수명의 native-private handle이다. 실제 source URI는 native queue 안에서만 보관하고 import·discard 또는 만료 뒤 제거한다.

필수 native 동작:

- `ACTION_SEND image/*` 수신과 단일 이미지 처리.
- Android Photo Picker 수신.
- source URI 권한이 살아 있을 때 app-private staging path로 byte 복사.
- MIME sniff, decode, dimensions, byte size, SHA-256 계산.
- 앱 재시작 시 미완료 intake/media operation 재개 또는 정리.
- 허용하지 않는 MIME, 0 byte, decode 실패, 저장 공간 부족을 typed error로 반환.

여러 이미지 공유, 영상, SVG, 앱 링크 인증은 첫 slice에서 제외한다.

### AP-07 — file + DB는 보상 가능한 saga로 저장

filesystem과 IndexedDB를 하나의 물리 transaction으로 묶을 수 없으므로 `media_operations` journal을 사용한다.

저장 흐름:

```text
1. 사용자가 저장을 확정한다.
2. DB transaction:
   - media operation = PLANNED
   - VisualAsset = IMPORTING
   - MemoryCard = DRAFT
3. native adapter가 app-private staging file로 복사·검증한다.
4. native adapter가 final opaque localRef로 확정한다.
5. DB transaction:
   - VisualAsset = READY + file metadata
   - MemoryCard = COMPLETE_PRIVATE
   - operation = COMPLETED
6. UI가 성공을 표시하고 Archive query를 갱신한다.
```

복구 규칙:

| 중단 지점 | 재실행 처리 |
| --- | --- |
| DB 예약 전 | 저장된 entity 없음 |
| DB 예약 후, file 없음 | operation 실패 처리 후 임시 row 정리 또는 명시적 Draft 유지 |
| staging file만 존재 | TTL 경과 시 제거, 즉시 재개 가능하면 import 재개 |
| final file 존재, DB `IMPORTING` | stat/hash 대조 후 DB finalize |
| DB `READY`, file 없음 | VisualAsset `MISSING`, Card는 보존하고 교체/삭제 안내 |
| delete 중 process death | `DELETE_PENDING` operation을 멱등 재실행 |

`operationId`는 Share Intent 중복 delivery와 저장 버튼 중복 탭을 막는 idempotency key로 사용한다. checksum이 같다는 이유만으로 서로 다른 기억 카드를 자동 병합하지 않는다.

### AP-08 — MemoryCard invariant와 Archive query

MemoryCard 상태 전이는 application service 하나에서만 수행한다.

```text
COMPLETE_PRIVATE iff
  owner가 일치하고
  (animeRefId XOR privateTitleId)가 존재하고
  visualAssetId가 존재하며
  VisualAsset.state == READY
```

- 위 조건이 깨지면 `DRAFT` 또는 복구 가능한 asset error 상태로 남는다.
- Archive는 현재 owner의 `COMPLETE_PRIVATE`만 기본 노출한다.
- Draft는 별도 진입점에서만 표시한다.
- 삭제는 Card tombstone과 asset delete operation을 사용하고, 실제 파일 삭제 뒤 note/localRef 등 민감 metadata를 scrub한다.
- 첫 slice에서는 VisualAsset 1개를 Card 1개가 소유한다. 재사용이 필요해지면 reference count 결정을 별도로 한다.

### AP-09 — UI route와 feature isolation

제안 route:

```text
/memory/new/     카드 작성
/archive/        개인 Archive
```

현재 Astro build가 정적 출력이므로 런타임 ID용 dynamic Astro route를 만들지 않는다. 카드 상세·수정은 `/archive/`의 React state와 URL fragment로 연다. Astro route는 React island를 mount하고, React component는 repository나 Capacitor plugin을 직접 import하지 않는다. runtime composition root가 platform capability에 따라 port adapter를 주입한다.

제안 flags:

```text
memoryV1                 default OFF on current public Web
androidImageIntakeV1     internal Android build only
memorySystemDesignV1     internal Android/Web test surface
legacyMemoryPreviewV1    OFF
memoryPublicV1           hard OFF
privateImageBackupV1     hard OFF
```

첫 implementation은 현재 `/library`, `/tier`, `/profile` 동작을 변경하지 않는다. 내부 dogfood Android build에서만 `memoryV1`을 기본 on으로 할 수 있다.

### AP-10 — 관찰 가능성은 privacy-safe adapter

도메인은 분석 SDK를 직접 호출하지 않고 `TelemetryPort`에 이름과 제한된 enum/count만 보낸다.

첫 slice 이벤트:

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
media_recovery_started
media_recovery_completed
```

금지 속성:

- note·PrivateTitle·검색어 원문.
- 이미지 byte, hash, file path, source URI.
- 개인 Board/Card 제목.
- 외부 URL, 계정 이메일, device identifier.

remote analytics 공급자를 추가하지 않은 상태에서는 local structured diagnostic log와 test spy로 계약만 검증한다.

## 5. 제안 모듈 지도

구현 시 다음 구조를 기준으로 한다. 세부 파일명 변경은 가능하지만 계층 역전은 허용하지 않는다.

```text
src/features/memory/
  domain/
    memoryCard.js
    visualAsset.js
    titleReference.js
    invariants.js
  application/
    ensureGuestOwner.js
    createMemoryCard.js
    updateMemoryCard.js
    deleteMemoryCard.js
    listArchive.js
    recoverMediaOperations.js
    exportMemoryArchive.js
  ports/
    memoryRepository.js
    imageIntake.js
    localMedia.js
    titleResolver.js
    telemetry.js
  adapters/
    indexeddb/
    catalog/
    platform/
  ui/
    MemoryCardComposer.jsx
    ArchiveView.jsx
    MemoryCardDetail.jsx
  runtime/
    createMemoryRuntime.js

src/pages/memory/new.astro
src/pages/archive/index.astro
src/config/featureFlags.js

capacitor.config.*
android/                         # 승인 후 Capacitor scaffold
```

의존 방향:

```text
UI → application → domain
UI → port types only
adapter → ports/domain
domain ↛ React/Astro/window/indexedDB/Capacitor/Supabase/AniList
```

## 6. Web와 Android 책임 분리

| 기능 | Android 첫 slice | Web 첫 slice | 후속 |
| --- | --- | --- | --- |
| Share Target | 실제 native | 해당 없음 | 유지 |
| Photo Picker | 실제 native | test adapter만 | Web upload 별도 결정 |
| app-private file | 실제 | production 미지원 | private cloud 후 read path |
| 시스템 디자인 | 실제 | internal test 가능 | 공통 지원 |
| Card/Archive UI | 실제 | responsive contract test | 로그인 sync 후 실제 사용 |
| 로그인/sync | 제외 | 제외 | BACKEND/AUTH/SYNC 승인 후 |
| Public | hard off | hard off | UGC gate 후 |

Web E2E에서는 native bridge의 deterministic fake를 주입해 React/application 계약을 검증한다. 이 fake의 Blob/object URL을 production local persistence로 오인하지 않는다.

## 7. 데이터·파일 디렉터리 규칙

권장 opaque file layout:

```text
owners/<ownerId>/assets/<assetId>/original.<safeExt>
staging/<operationId>/<random>.pending
exports/<exportSessionId>/moemoa-export.zip
```

- 위 `<ownerId>` 자리에는 `guest:` 문자열을 그대로 넣지 않고 native adapter가 발급한 filesystem-safe opaque owner key를 사용한다.
- user filename은 path에 사용하지 않는다.
- extension은 decode 결과와 허용 MIME으로 결정한다.
- path traversal, symlink, 외부 absolute path를 거부한다.
- export file은 cache/temporary 영역에 만들고 공유 완료 또는 TTL 뒤 제거한다.
- app uninstall 시 LOCAL_ONLY 데이터가 사라질 수 있음을 UI에 명시한다.

첫 slice 허용 후보는 JPEG, PNG, WebP이고 영상·SVG·animated image는 제외한다. 정확한 byte/dimension limit은 `STORAGE-01`이 미정이므로 implementation spike에서 안전한 임시 한도를 configuration으로 두고 사용자 승인 없이 영구 정책으로 기록하지 않는다.

## 8. 테스트 전략

### Domain/unit

- title reference XOR invariant.
- Complete Card + READY VisualAsset invariant.
- owner mismatch 거부.
- state transition과 delete scrub.
- duplicate operation id 멱등성.
- system design deterministic rendering spec.

### Repository/contract

- `MemoryRepository` fake와 IndexedDB adapter가 동일 contract를 통과.
- owner-scoped query가 다른 owner row를 반환하지 않음.
- DB version upgrade 재실행 멱등성.
- legacy DB와 신규 DB가 서로 변경되지 않음.

### Web E2E

- 새 카드 작성, PrivateTitle fallback, 취소, 저장, Archive, 수정, 삭제.
- native fake에서 permission denial/storage full/process restart 시나리오.
- `memoryV1` off일 때 현재 legacy route 회귀 없음.

### Android

- Share Intent, Photo Picker, URI permission expiry.
- app background/process death 후 pending intake 복구.
- staging/final/DB commit 각 중단점 fault injection.
- storage full, invalid MIME, decode failure, duplicate delivery.
- 재시작 후 display, delete, export.
- 최소 1개 저사양/저장공간 부족 시뮬레이션 기기와 1개 현재 Android 실기기 smoke.

## 9. 보안·개인정보·권리 기본값

- Private·LOCAL_ONLY·Public off가 기본이다.
- Android exported activity/receiver는 필요한 intent-filter만 허용하고 임의 command를 실행하지 않는다.
- source URI와 localRef는 외부 로그·URL·analytics에 노출하지 않는다.
- 파일 content를 extension만으로 신뢰하지 않는다.
- AniList cover/banner는 새 Card VisualAsset으로 가져오지 않는다.
- 사용자 업로드 이미지는 private 기록에는 허용하되 `rightsBasis=UNKNOWN`이면 Public eligibility가 없다.
- EXIF 제거는 cloud/public derivative 단계에서 필수다. local original은 사용자 보존 의도를 존중하되 GPS/EXIF 보유 사실을 고지하고 export에 포함되는 범위를 명시한다.

## 10. 배포와 롤백 경계

첫 slice는 production Web 배포가 아니라 **internal Android dogfood build**를 목표로 한다.

롤백:

1. `memoryV1`과 native intake flag를 off.
2. 기존 route, DB, localStorage는 그대로 유지.
3. 신규 `moemoa-memory-v1`과 app-private media는 자동 삭제하지 않음.
4. 사용자가 앱을 다시 켜면 feature re-enable 또는 export/delete 도구로 접근 가능해야 함.
5. schema migration 실패 시 이전 DB version을 열지 못하게 하는 대신 신규 기능을 read-only recovery mode로 전환.

Capacitor/plugin 호환성 실패는 Android shell만 보류하고 Web legacy runtime에 영향을 주지 않아야 한다.

## 11. 승인 후 후속 ADR 후보

| 후보 | 작성 시점 | 결정 내용 |
| --- | --- | --- |
| ADR-0002 | 첫 slice 승인 직후 | Memory modular boundary, 신규 IndexedDB, Guest Owner |
| ADR-0003 | native spike 완료 후 | Capacitor/plugin exact versions, min/target SDK, ticket bridge schema |
| ADR-0004 | account sync 전 | backend/auth/sync topology와 conflict contract |
| ADR-0005 | cloud image 전 | object storage, transform, consent, deletion propagation |

## 12. 승인 결과

다음 네 가지는 2026-08-12 사용자 승인으로 implementation boundary가 됐다.

1. 첫 slice를 Android local-only Card/Archive로 제한한다.
2. 신규 owner-scoped IndexedDB `moemoa-memory-v1`을 사용하고 legacy DB를 건드리지 않는다.
3. 실제 이미지의 Web production 저장은 보류하고 Android native path를 먼저 검증한다.
4. Board, 계정, sync, private cloud, full catalog, Public을 첫 slice에서 제외한다.

정확한 Capacitor/plugin/Android SDK 조합은 `adr/0003-android-image-intake-spike-toolchain.md`에서 제안 중이다. 환경 gate와 spike 결과 전에는 해당 ADR을 ACCEPTED로 승격하지 않는다.
