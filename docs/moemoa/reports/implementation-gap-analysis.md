# MOEMOA 구현 Gap 분석

> **문서 상태: `ANALYSIS / PROPOSED SEQUENCE`**
> Gap 분류는 감사 증거를 바탕으로 하지만 단계 순서는 승인된 ADR/ExecPlan이 아니다. 사용자 승인 전 이 순서를 구현 명령으로 사용하지 않는다.

> **현재 순서 안내 — 2026-08-16:** 이 문서는 2026-08-11 snapshot 기반의 역사적 Gap 분석이다. 실제 실행 순서는 승인된 `plans/first-private-vertical-slice.md`와 `decisions/2026-08-16-web-first-shared-ui-readiness.md`를 따른다. 현재는 Android 기반 위에서 Web 공용 UI readiness를 먼저 통과한 뒤 Android 적응·실기기 검증으로 복귀한다.

작성일: 2026-08-11  
기준 결정: `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`  
상세 현황: `docs/moemoa/reports/repository-audit.md`

결정 업데이트: 2026-08-11 `TECH-01` 옵션 B, `STORAGE-LOCAL-01` 옵션 1, `LEGACY-01` 옵션 1이 사용자 승인으로 확정됐다. 아래 단계 순서는 여전히 승인된 ExecPlan이 아니라 권장 분석안이다.

## 1. 목적과 판정 원칙

이 문서는 확정된 제품 요구와 현재 저장소 사이의 차이를 구현 순서로 바꾼다. 아직 결정되지 않은 기술·운영 항목은 구현으로 고정하지 않고 명시적 gate로 남긴다.

분류:

- `KEEP`: 새 제품에서도 그대로 유지
- `ADAPT`: 기반을 유지하되 도메인/UX 수정
- `MIGRATE`: 데이터 또는 구조를 단계적으로 이전
- `ISOLATE`: adapter 또는 default-off feature flag 뒤로 격리
- `DEPRECATE`: 사용 중단 후보. 즉시 삭제 금지
- `UNKNOWN`: 증거/결정 부족

## 2. 핵심 Gap 매트릭스

| 요구사항 | 현재 상태와 근거 | Gap 판정 | 권장 조치 | 위험 | 승인/Gate |
| --- | --- | --- | --- | --- | --- |
| Web + Android 공통 제품 | Astro/React Web/PWA만 존재. Android 프로젝트 0건 (`package.json:23-36`, `public/manifest.webmanifest:1-23`) | `MIGRATE` | Web UI를 유지하면서 공유 domain contract와 Android client/shell 추가 | 기술 선택을 늦게 바꾸면 image/storage 계층 재작성 | `TECH-01` |
| Android 이미지 수집 우선 | Share Target, Photo Picker, App Link, local file copy 없음 | `MIGRATE` | OS intent 수신 → 앱 전용 복사 → draft 복구까지 첫 vertical slice에 포함 | URI permission 만료, process death, 중복 intent | `TECH-01`, `STORAGE-LOCAL-01` |
| Complete Card = Title + VisualAsset | Library/WatchLog만 있고 VisualAsset entity 없음 (`src/domain/animeState.js:45-93`, `src/repositories/watchLogRepo.js:128-159`) | `MIGRATE` | `MemoryCard` 상태 machine과 VisualAsset FK/invariant 정의 | 기존 로그를 Complete로 오승격 | CARD-01 확정값 준수 |
| 시스템 디자인 fallback | recap canvas만 존재 (`src/services/recapShare.js:48-107`) | `ADAPT` | 사용자 이미지가 없을 때 system-generated VisualAsset 생성 | 생성물의 재현성/버전 불일치 | 디자인 template version 결정 |
| 작품 검색 실패 시 PrivateTitle | `anilistId` 필수인 Library 중심 | `MIGRATE` | `AnimeRef xor PrivateTitle` invariant와 후속 merge 후보 연결 | 중복 작품, 잘못된 공용 승격 | CATALOG-01 준수 |
| 한 작품에 여러 Memory Card | WatchLog는 여러 건 가능하지만 Library는 작품당 하나 (`src/storage/idb.js:47-60`) | `ADAPT + MIGRATE` | WatchLog 기억 신호를 seed로 쓰고 Card는 독립 ID 생성 | legacy ID 충돌, 순서 손실 | migration 규칙 승인 |
| 자동 Archive | 최근 로그 resurfacing selector만 존재 (`src/domain/homeSelectors.js:22-84`) | `ADAPT` | Complete Card query/index를 Archive로 정의; 별도 membership 복제 금지 | 이중 원본/삭제 불일치 | schema invariant |
| N:M Board | Tier는 Anime ID 랭킹 (`src/domain/tierTopics.js:24-58`) | `ISOLATE + MIGRATE` | `Board`, `BoardCard(boardId, cardId, position)` 신규 | Tier 자동 변환 시 의미 왜곡 | Tier migration 선택 |
| 카드 3개 후 Board 제안 | 미구현 | `ADAPT` | Complete Card count 기반 로컬 prompt; dismiss state 별도 | 과도한 prompt | BOARD-01 준수 |
| 비로그인 local-first | 전역 localStorage/IDB로 가능하지만 owner namespace 없음 (`src/storage/keys.js:1-23`) | `MIGRATE` | `ACCOUNT-01` 불변조건으로 설치별 Guest Owner ID와 owner-scoped local namespace 도입 | 계정 A/B 데이터 혼입 | 논리 guest ownership 필수; account 연결·승격은 `AUTH-01` |
| 첫 Card 저장 후 선택 로그인 권장 | 현재 첫 Card 개념이 없고 로그인은 Data/Profile 경로 중심 (`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:89-97`, `src/components/DataCenter.jsx:11-34`) | `ADAPT` | 첫 Complete Card 성공 뒤 non-blocking backup/sync 설명; 거절해도 private local 기능 유지 | 가입 강제가 첫 가치 경험을 막음 | ACCOUNT-01 확정값 준수 |
| guest→account 승격 | 로그인 후 snapshot 선택/업로드; 명시적 승격 transaction 없음 | `MIGRATE` | preflight/backup → mapping → idempotent promote → commit marker | 중복 업로드/데이터 유실 | `AUTH-01`, `SYNC-01` |
| Web/Android 동기화 | snapshot/split 혼합, 전체 local/cloud conflict (`src/repositories/syncRepo.js:125-215`, `src/hooks/useSyncStatus.js:469-530`) | `MIGRATE` | entity revision, tombstone, operation id, commit protocol 확정 | 삭제 부활, 부분 commit, 순서 충돌 | `SYNC-01` |
| Private 이미지 cloud backup | object storage 호출 없음 | `MIGRATE` | local-only 기본; 명시 동의 후 private object + metadata sync | 무단 업로드, quota, 삭제 누락 | `IMAGE-SYNC-01`, `STORAGE-01`, `PRIVACY-01` |
| 제한적 자체 catalog | AniList/Wikidata direct call, 3,998 aliases (`src/lib/anilist.js:1-190`, `src/data/aliases.json:1-16`) | `ISOLATE + MIGRATE` | 내부 Anime ID, Source Registry, FieldClaim, `legacy_unverified` staging | 출처/권리 불명, provider 장애 | `SOURCE-01` |
| 자체 catalog 사실 필드 | 현재 provider 응답 shape를 직접 사용하며 자체 정규화 schema가 없음 (`src/lib/anilist.js:85-190`, `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:109-122`) | `MIGRATE` | 제목 계열, 방영/형식/화수/상태, 제작사/역할, 공식 사이트, 원작 유형, 작품 관계, 장르/tag 후보, 캐릭터/성우 관계를 provenance와 함께 정규화 | provider별 의미 drift와 잘못된 병합 | CATALOG-02, `SOURCE-01` |
| Public default off | showcase publish/follow 경로가 flag 없이 존재 (`src/components/ProfileCenter.jsx:290-348`) | `ISOLATE` | generic UGC + image rights flag를 분리하고 둘 다 off | 비공개 note/image 노출 | UGC gates |
| 신고·차단·심사·삭제 | 구현 없음 | `ISOLATE` | moderation entity/API/admin/audit/SLA 이후만 제한적 public | 법적·운영 대응 불가 | `AGE-01`, `MODERATION-01` |
| Export/restore/delete | snapshot v5는 legacy 목록/로그/Tier만 포함 (`src/domain/snapshotCodec.js:307-321`) | `ADAPT` | 새 schema manifest와 image byte 정책, account delete 검증 | 불완전 export, orphan object | `PRIVACY-01`, `IMAGE-SYNC-01` |
| Analytics/observability | Vercel page analytics만 존재 (`src/layouts/BaseLayout.astro:3`, `src/layouts/BaseLayout.astro:62`) | `ADAPT` | 최소 event taxonomy, PII denylist, error code/release tag | note/search/image URL 유출 | privacy review |
| CI/release gate | GitHub Pages workflow는 install/build만 수행 (`.github/workflows/astro.yml:68-80`) | `ADAPT` | unit + check + Chromium 1-worker + build 필수, Android 추가 | 병렬 flake/회귀 배포 | canonical deploy 결정 |

## 3. 반드시 먼저 해결할 5개 구조 Gap

### G0-1. 내부 ID와 공통 도메인

현재 `anilistId`는 Library, WatchLog index, cloud PK, Tier membership, Wikidata mapping 전반에 퍼져 있다 (`src/storage/idb.js:47-60`, `src/domain/tierTopics.js:24-58`, `src/lib/wikidata.js:299-348`, `docs/deploy/supabase-split-sync.sql:4-47`). 이 상태에서 자체 catalog나 PrivateTitle을 추가하면 provider ID가 계속 도메인 identity가 된다.

첫 구현 전에 최소 계약을 작성한다.

```text
Owner(id, kind: GUEST | ACCOUNT)
Anime(id, canonical fields, verificationStatus)
ExternalIdentifier(animeId, provider, providerId)
PrivateTitle(id, ownerId, displayTitle, mergeCandidateAnimeId?)
VisualAsset(id, ownerId, imageType, intakeSource, storageScope, visibility,
            localRef?, remoteObjectKey?, rightsBasis,
            creatorOrSource?, licenseOrPermission?,
            moderationStatus, spoilerRating, contentRating,
            checksum, state, createdAt)
MemoryCard(id, ownerId, animeId xor privateTitleId,
           visualAssetId?, status, note?, watchedAt?, createdAt, updatedAt)
Board(id, ownerId, title, visibility, createdAt, updatedAt)
BoardCard(boardId, memoryCardId, position, addedAt)
SyncOperation(id, ownerId, entityType, entityId, action, revision, state)
```

필수 invariant:

1. MemoryCard는 `Anime` 또는 `PrivateTitle` 중 정확히 하나에 연결된다.
2. Archive에 포함되는 모든 완성 카드는 유효한 VisualAsset 하나를 가져야 한다. 완성도, 공개 workflow/visibility, storage scope를 하나의 boolean으로 합치지 않는다.
3. Archive는 Complete Card의 자동 query이며 독립 membership 원본을 만들지 않는다.
4. Board에서 membership 삭제는 MemoryCard/VisualAsset을 삭제하지 않는다.
5. owner가 다른 entity 사이의 reference는 금지한다.
6. Public 여부와 storage scope를 동일 값으로 취급하지 않는다.
7. Board는 포함된 모든 Card와 VisualAsset image type이 각각 Public 적격이고 generic UGC gate도 통과한 경우에만 Public 전환할 수 있다. 카드 하나라도 부적격이면 Board 전체 전환을 거부한다.

### G0-2. guest/account ownership

현재 제품 key는 전역이다 (`src/storage/keys.js:1-23`). 로그아웃도 session만 종료한다 (`src/repositories/authRepo.js:55-63`). 이는 기능 추가 전 해결해야 할 데이터 격리 결함이다.

필요한 결정과 구현 계약:

- 앱/브라우저 첫 실행에 guest owner 생성
- 모든 local row에 `ownerId` 포함 또는 owner별 DB namespace 사용
- 로그인 시 guest data 발견/요약/backup/preflight
- 중복된 작품·기억 기록·Board를 보존하는 idempotent promotion
- A→B 계정 전환 때 A local data 비노출
- 로그아웃 시 “기기에 유지”와 “이 기기에서 제거” UX
- promotion 실패 시 원 guest DB 유지와 재시도 가능 marker

### G0-3. 이미지 수명주기

이미지는 card의 필수 구성인데 현재 file ingestion이 없다. 따라서 UI보다 먼저 상태 machine을 정해야 한다.

```text
RECEIVED_URI
→ COPYING_LOCAL
→ LOCAL_READY
→ PROCESSING_DERIVATIVES
→ READY_PRIVATE
→ UPLOAD_QUEUED (선택 동의 시)
→ PRIVATE_CLOUD_READY
→ DELETE_QUEUED
→ DELETED
```

모든 단계에 retry 가능 operation ID, checksum, 실패 코드, 원본/thumbnail 관계가 필요하다. Android 공유 URI를 DB에 영구 보관하지 말고 앱 전용 영역으로 복사 완료한 뒤 Card를 Complete로 전환한다. EXIF 제거, MIME 검증, decompression bomb 방지, quota는 `STORAGE-01` 결정에 묶는다.

### G0-4. 동기화와 삭제 의미

현재 cloud push는 여러 저장을 transaction 없이 순차 실행한다 (`src/repositories/syncRepo.js:356-394`). 새 모델에서 card row만 올라가고 image object/Board membership이 실패하면 불완전 상태가 발생한다.

최소 요구:

- client-generated stable UUID
- entity별 `updatedAt`, revision, device/operation ID
- soft-delete tombstone와 retention 기간
- 동일 operation의 idempotency
- metadata commit과 object upload의 보상/reconcile job
- Card 본문 충돌, Board reorder, 삭제 대 수정 규칙
- sync schema/version capability negotiation
- 실제 적용 migration marker; 빈 table을 migration 전 상태로 해석하지 않기

### G0-5. Public 경로 격리

현재 showcase는 private log의 cue/note와 외부 URL을 public snapshot으로 만들 수 있다 (`src/domain/showcase/showcaseSelectors.js:354-386`, `src/domain/showcase/showcaseSelectors.js:590-608`). 이 경로를 새 Memory Card public 기능으로 재사용하지 않는다.

코드 구현을 시작하는 첫 PR에서 제품 기능 변경과 별개로 다음 default-off 경계를 먼저 설계해야 한다.

```text
publicProfileEnabled = false
publicMemoryCardEnabled = false
publicBoardEnabled = false
followGraphEnabled = false

publicImageTypeEnabled = {
  SYSTEM_DESIGN: false,
  TEXT_DESIGN: false,
  ANIME_SCREENSHOT: false,
  USER_ORIGINAL: false,
  USER_CREATED_FANART: false,
  THIRD_PARTY_FANART: false,
  OTHER_MEDIA: false
}
```

image type registry는 콘텐츠 유형만 다루고 새 유형을 자동 허용하지 않는 fail-closed 구조여야 한다. Photo Picker/Share Target 등 입력 경로는 `intakeSource`, 기기 로컬 여부는 `storageScope`, 허가/공개 라이선스는 `rightsBasis`와 license evidence로 별도 기록한다. Public 적격성은 다음 축을 모두 AND 처리한다.

```text
generic UGC gate
+ publicImageTypeEnabled[imageType]
+ storageScope/remote public asset availability
+ explicit visibility consent
+ allowed rightsBasis and required license/permission evidence
+ eligible moderationStatus
+ spoiler/content-rating policy
```

따라서 `LOCAL_ONLY` asset은 그 상태로 Public이 될 수 없지만, “기기에서 골랐다”는 이유만으로 콘텐츠 유형 자체가 영구 비공개인 것은 아니다. 사용자가 만든 원본이면 `USER_ORIGINAL` 같은 콘텐츠 유형을 유지하고, 별도 동의·권리·업로드·심사를 모두 통과했을 때만 Public storage/visibility로 전환한다. 각 flag는 UI 숨김만이 아니라 write API/RLS/route에서도 거부해야 하며 실제 production 상태 확인 없이 켜지 않는다.

## 4. Legacy 데이터 migration 지도

| 기존 데이터 | 새 위치 | 자동 변환 | 주의/rollback |
| --- | --- | --- | --- |
| LibraryItem | `AnimeRef` + `LegacyLibraryState` | 가능하되 내부 Anime mapping 성공분만 | 원본 snapshot과 `anilistId` mapping 보존 |
| WatchLog | `LegacyMemorySignal` 또는 MemoryCard `DRAFT` seed | 가능 | VisualAsset 부재로 Complete 승격 금지; 원 id/시간 유지 |
| CharacterPin | legacy preference/reference | 결정 전 보존 | 외부 image URL을 VisualAsset로 승격 금지 |
| TierTopic | `LegacyTierTopic` | 기본은 그대로 보존 | Board 자동 변환은 별도 opt-in/승인 |
| aliases.json | `legacy_unverified` catalog staging | 전체 격리 | provenance 없이는 verified 승격 금지 |
| AniList poster/banner URL | provider image reference | display fallback만 | user VisualAsset로 복사/공개 금지; kill switch 가능해야 함 |
| snapshot v5 | versioned import adapter | read-only 호환 | 새 export 후에도 원본 JSON 다운로드 제공 |

### Migration 실행 원칙

1. 기존 데이터를 in-place 덮어쓰지 않는다.
2. migration 시작 전 원본 snapshot hash와 export를 만든다.
3. mapping 결과를 `mapped / private-title-candidate / unresolved / invalid`로 구분한다.
4. 동일 입력에 같은 결과가 나오는 idempotent migration을 사용한다.
5. 완료 marker는 모든 durable write가 끝난 뒤 기록한다.
6. 새 read가 실패하면 legacy reader로 rollback할 수 있는 기간을 둔다.
7. 삭제는 사용자 검증과 별도 승인 후 마지막 단계에서만 한다.

## 5. 구현 전 Gate와 의존 관계

```text
TECH-01
   │
   ├── 공통 domain/ID/schema
   │       ├── guest owner namespace
   │       └── legacy migration contract
   │
   └── STORAGE-LOCAL-01 image adapter
           └── Android Share/Photo Picker local-only slice

BACKEND-01 + AUTH-01 + SYNC-01
   └── metadata cloud sync
           └── IMAGE-SYNC-01 + STORAGE-01 private cloud backup

SOURCE-01 ── provider adapter/internal catalog ── Anime mapping

AGE-01 + MODERATION-01 + PRIVACY-01
        └── Public UGC gate 이후 제한적 공개
```

Public 기능은 private vertical slice의 선행 조건이 아니다. 반대로 private Card/Archive/Board를 Public schema에 종속시키지 않는다.

## 6. 권장 구현 단계

### Phase 0 — 결정·안전 경계

완료 조건:

- TECH-01과 Android local storage 방식 승인
- 공통 entity/invariant와 ID 규칙 승인
- `ACCOUNT-01`에서 파생되는 Guest Owner 논리 경계를 적용하고, Phase 2 ExecPlan에서 local namespace의 물리 저장 계약 승인. 인증 공급자와 계정 승격 UX는 cloud sync 전까지 보류 가능
- 현재 public 경로를 default-off로 만드는 방식 승인
- legacy migration 표본 fixture 확보
- production Supabase/Vercel 상태 read-only 확인 계획 수립. BACKEND-01은 remote schema를 변경하기 전에 승인

이 단계에서는 실제 DB migration, dependency 변경, public enable을 하지 않는다.

### Phase 1 — Local-only vertical slice

대상 사용자 흐름:

```text
Android 공유 또는 Photo Picker
→ 앱 전용 로컬 복사
→ 작품 검색 또는 PrivateTitle
→ 이미지 + 짧은 기억으로 Card 저장
→ Archive에서 즉시 확인
→ 앱 재시작/오프라인 후에도 복구
→ export/delete 검증
```

필수 구현:

- domain package와 storage interface
- owner-scoped local DB
- VisualAsset local lifecycle
- Draft/Complete MemoryCard
- Archive query
- 시스템 디자인 fallback
- 첫 Complete Card 저장 뒤 non-blocking 로그인 권장. 거절해도 local Card/Archive/Board 사용 가능
- process death/중복 intent/공간 부족 복구
- 자유 텍스트/이미지 없는 진단 logging

제외:

- cloud image upload
- Public Card/Board
- full catalog scrape
- 기존 Tier 자동 migration

### Phase 2 — Private Board와 Web read path

- Web Archive/Card detail
- Board/BoardCard N:M과 reorder
- Card 3개 후 Board prompt
- Board membership delete와 Card delete 분리
- legacy WatchLog draft import preview
- Web/Android contract fixture 테스트

### Phase 3 — 계정과 metadata sync

- guest→account promotion
- Web/Android metadata sync
- entity revision/tombstone/conflict UI
- account switch isolation
- JSON/ZIP export와 restore
- account/local delete dry-run 및 E2E

이미지는 계속 local-only일 수 있다. metadata sync가 local file의 존재를 거짓으로 표시하지 않도록 `assetAvailability`를 기기별로 모델링한다.

### Phase 4 — 동의 기반 private image backup

IMAGE-SYNC-01, STORAGE-01, PRIVACY-01 승인 후 진행한다.

- private bucket/ACL/signed URL
- client-side transform/EXIF 정책
- resumable/retry upload
- quota UX
- object/metadata reconcile
- 기기 간 download와 local cache
- card/account 삭제 전파
- backup/restore 실제 검증

### Phase 5 — 제한적 catalog 운영

- Source Registry
- internal Anime ID와 provider adapter
- coming season/recent 2–3년 seed
- 제목 계열, 방영/형식/화수/상태, 제작사/역할, 공식 사이트, 원작 유형, 작품 관계, 장르/tag 후보, 캐릭터/성우 관계 정규화
- FieldClaim/provenance와 review state
- PrivateTitle merge 후보와 사용자 확인
- `legacy_unverified` 검색 fallback
- import dry-run, rate limit, rollback

### Phase 6 — Public 준비 여부 재평가

AGE-01, MODERATION-01, PRIVACY-01와 모든 UGC gate를 통과했을 때만 진행한다.

- terms/consent version
- report/block/moderation/takedown/appeal/strike
- admin authorization와 audit log
- image type/rights별 publish eligibility
- private→public field preview
- unpublish/delete propagation
- kill switch와 incident runbook
- 소규모 allowlist beta

## 7. 테스트 Gap과 완료 기준

### 공통 domain

- MemoryCard xor title invariant
- Complete/VisualAsset invariant
- Board N:M와 membership-only delete
- guest/account cross-owner reference 거부
- migration idempotency/property test

### Android

- Share Intent 1개/여러 개/잘못된 MIME
- Photo Picker permission과 process death
- URI permission 만료 전 앱 전용 복사
- 저장 공간 부족/중복 수신/회전/업데이트
- offline create/restart/delete

### Sync/backend

- A→B 계정 전환 중 모든 mutation 차단
- 동일 operation 중복 delivery
- delete 대 edit, Board concurrent reorder
- object upload 성공 + metadata 실패 및 반대 경우
- RLS 실제 integration과 cross-account access deny

### Privacy/rights

- note, 검색어, local path, signed URL이 analytics/error log에 없음
- EXIF 정책 검증
- private/public field leak test
- 모든 image type의 default-off/fail-closed publish eligibility
- Public Board가 부적격 Card 하나라도 포함할 때 전체 전환을 거부하는 invariant/E2E
- account delete 후 row/object/cache 제거 검증
- external provider/image kill switch

### Release

- Unit, contract, migration fixture
- Web Chromium 1-worker E2E와 build
- Android unit/instrumentation/실기기 smoke
- schema compatibility matrix
- rollback rehearsal

## 8. 초기 우선순위

| 순위 | 작업 | 이유 |
| --- | --- | --- |
| P0 | Public 경로 격리 설계 | 현재 확정 결정과 코드 상태가 직접 충돌 |
| P0 | Domain/ID/ownership 계약 | 모든 저장·sync·migration의 기준점 |
| P0 | TECH-01 결정 spike | Android image intake 구현 방식을 좌우 |
| P0 | Local-only VisualAsset slice | 제품의 실제 차별 기능과 가장 큰 기술 위험을 동시에 검증 |
| P1 | guest/account promotion + metadata sync | Web/Android 연속 사용을 가능하게 함 |
| P1 | Internal catalog/provider adapter | 외부 ID·이미지 종속을 축소 |
| P1 | Private Board | Card 작성 반복성이 확인된 뒤 확장 |
| P2 | Private image cloud backup | 동의·quota·삭제 운영 준비 후 |
| 보류 | Public UGC | 운영 gate 전에는 개발 우선순위로 올리지 않음 |

## 9. 이 분석에서 확정하지 않은 것

- Android 구현 기술
- 별도 backend API 도입 여부
- OAuth provider와 guest merge UI 세부안
- field-level sync conflict 정책
- private image backup 용량/format/region
- 기존 Tier의 Board 자동 변환
- catalog source별 허용 등급
- 미성년자 지원과 moderation 모델
- beta 규모와 성공 기준

선택지는 `architecture-options.md`, 사용자 질문과 권장 기본값은 `open-decision-questions.md`에 분리한다.
