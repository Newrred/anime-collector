# 06. 아키텍처와 첫 Vertical Slice 계획

> **문서 상태: `CURRENT CONSTRAINTS / GATED DESIGN`**
> 공통 도메인/local-first 제약, Astro/React + Capacitor client 방향, 첫 Private Vertical Slice는 승인되어 구현 중이다. 2026-08-16에는 첫 slice 내부 실행 순서를 `Web 공용 UI readiness → Android 적용·실기기 검증`으로 보완했다. 2026-08-26에는 `BACKEND-01`, `AUTH-01`, `SYNC-01`을 단일 Supabase project, Google Auth, explicit Guest promotion, normalized metadata sync로 확정했다. Private image cloud backup과 Public 관련 gate는 계속 미정이다.

확정 근거: `decisions/2026-08-11-foundation-decisions.md`, `adr/0001-capacitor-client-and-local-media-boundary.md`.

## 1. 아키텍처 원칙

- 하나의 도메인 모델과 백엔드.
- Web과 Android의 역할은 다르지만 데이터 의미는 동일.
- 기존 안정화 코드와 기술 스택을 최대한 재사용.
- native 기능은 adapter/bridge로 격리.
- offline/local-first와 cloud sync를 분리.
- public 기능은 private core 위에 추가.
- 외부 catalog provider와 image provider는 인터페이스 뒤에 격리.

## 2. 목표 논리 구조

```text
Web Client
Android Client
   │
   ├── Shared API contract / domain types
   │
Backend boundary — single Supabase project + read RLS + validated mutation RPC
   ├── Auth and account linking
   ├── Catalog
   ├── Memory Card / Archive / Board
   ├── Sync
   ├── Image/UGC
   ├── Moderation/Admin
   └── Analytics event gateway

Data
   ├── relational database
   ├── local Android database
   ├── object storage
   ├── search/index as needed
   └── raw catalog staging
```

위 `Backend boundary`는 2026-08-26 확정된 논리적 애플리케이션 경계다. Catalog read와 Auth/user session client는 같은 Supabase project를 사용하되 역할을 분리한다. Private read는 owner RLS, mutation은 version·operation·상태 전이를 검증하는 RPC를 사용한다. 별도 standalone thin API는 초기 범위에 포함하지 않으며, 필요성은 운영 증거가 생길 때 재검토한다. 상세 contract는 `../superpowers/specs/2026-08-26-unified-supabase-user-data-design.md`를 따른다.

## 3. 도메인 경계

### Catalog domain

- Anime
- PrivateTitle
- Titles/Aliases
- Organization
- Character/Person/Casting
- Relation/Genre/Tag
- Source/FieldClaim/Revision

### Memory domain

- MemoryCard
- MemorySignal
- Archive queries
- Board/BoardCard
- SavedReference

### Identity/sync domain

- Owner (`GUEST | ACCOUNT`)
- DeviceIdentity
- User
- GuestPromotion
- SyncOperation
- Conflict
- Export/Restore/Delete

### Media/UGC domain

- VisualAsset
- UploadSession
- Derivative
- PublishRequest
- Report/Block/ModerationAction/Appeal/Strike

## 4. P0 Vertical Slice chain

목표:

> Android에서 이미지를 받아 Private Memory Card를 저장하고, Archive와 Board에서 확인한 뒤 선택 로그인으로 Web에서도 같은 카드를 볼 수 있게 한다.

이 목표는 P0 전체를 이루는 여러 slice의 결과이며 한 번에 구현하지 않는다. 첫 실행 slice는 `Android local-only Card + Archive`로 제한하고 Board/Web/account/sync는 후속으로 분리하는 안이 현재 proposal이다.

### Slice 단계

1. Android image intake
2. 작품 검색/PrivateTitle
3. MemoryCard Draft/Complete
4. LOCAL_ONLY storage
5. Archive
6. Private Board
7. 로그인과 local account promotion
8. metadata sync
9. Web Archive/Board
10. export/delete

### Slice에서 제외

- Public publishing
- private cloud image backup
- full catalog ingestion
- complex recommendation
- comments/follows

## 5. 데이터 모델 최소안

```text
Anime(id, ...)
PrivateTitle(id, ownerId, title, ...)
Owner(id, kind: GUEST | ACCOUNT, ...)
MemoryCard(id, ownerId, animeId?, privateTitleId?, visualAssetId?, status, note?, ...)
VisualAsset(id, ownerId, intakeSource, imageType, storageScope, visibility, rightsBasis, state, localRef?, ...)
Board(id, ownerId, title, visibility, ...)
BoardCard(boardId, memoryCardId, position, ...)
DeviceIdentity(id, ownerId, ...)
User(id, ownerId, ...)
SyncOperation(id, entityType, entityId, version, ...)
```

MemoryCard는 Anime 또는 PrivateTitle 중 정확히 하나에 연결된다.

Draft에서는 `visualAssetId`가 비어 있을 수 있지만 Complete 상태에는 정확히 하나의 VisualAsset이 필요하다. VisualAsset은 업로드 파일뿐 아니라 시스템·텍스트 디자인도 포함하며, `localRef`와 object key 같은 파일 수명주기 필드는 file-backed asset에만 적용한다.

`Owner`는 제품 데이터의 소유 경계를 나타내고, `DeviceIdentity`는 기기 식별, `User`는 인증 주체다. local slice부터 설치별 Guest Owner ID와 owner-scoped namespace를 둔다. Remote private row의 owner는 `auth.users.id`이며 Guest row는 remote에 만들지 않는다. 로그인 승격은 entity UUID를 유지하는 idempotent promotion transaction으로 수행하고, 성공 뒤에만 local account namespace로 전환한다. Account 간 자동 병합은 금지한다.

## 6. Local-first 저장

### 원칙

- UI 성공 표시 전에 로컬 트랜잭션이 완료되어야 한다.
- 이미지 파일과 DB 레코드가 불일치하지 않도록 실패 보상 처리를 한다.
- sync는 저장 성공과 별도 상태다.

### 권장 상태

```text
LOCAL_SAVED
SYNC_PENDING
SYNCED
SYNC_FAILED
CONFLICT
```

## 7. 로그인 승격

- 비로그인 owner identity를 유지한다.
- 첫 provider는 Supabase Google OAuth 하나만 사용한다.
- 로그인 후 기존 로컬 entity UUID를 유지한다.
- Remote owner는 `auth.users.id`, local account owner는 `account:<auth user uuid>`로 명시한다.
- 승격 전 manifest/hash와 Guest backup을 준비하고 중복 업로드 방지용 operation ID를 사용한다.
- Server transaction 완료 뒤에만 local owner를 account namespace로 전환한다.
- 실패하면 Guest 원본을 유지하고 같은 operation을 재시도한다.
- 이미지 백업은 별도 opt-in.

## 8. 동기화 충돌

`SYNC-01`은 2026-08-26 다음과 같이 확정됐다.

### Card scalar fields

- Base version이 같으면 mutation을 적용하고 version을 증가시킨다.
- 다르면 timestamp last-write-wins를 사용하지 않고 explicit conflict UI로 보낸다.
- 사용자가 선택한 결과는 새 idempotent resolution operation으로 적용한다.

### Board order

- Bounded lexicographic `position_key`를 사용한다.
- Membership/reorder mutation도 base version을 검사한다.
- Stale reorder는 자동 전체 덮어쓰기하지 않고 conflict로 반환한다.

### Delete versus edit

- Delete tombstone이 stale edit보다 우선한다.
- Tombstone은 30일 보존하며 명시적 복구 operation만 허용한다.
- Operation ID/request hash와 server `sync_seq`로 retry와 incremental pull을 관리한다.

이 규칙에 따라 삭제된 카드가 다른 Board나 Web에서 stale update로 재생성되지 않아야 한다.

## 9. Web/Android 코드 공유

`TECH-01`에 따라 Astro/React + Capacitor Android shell을 사용한다. 다음 경계를 유지한다.

- 재사용할 responsive React surface와 Android 전용 화면 경계
- shared JS/TS domain contract와 platform adapter 경계
- Capacitor Share Intent/Photo Picker/filesystem/App Link bridge
- Web-only public/admin surface와 Android package 분리

평가 기준:

- 현재 코드 재사용
- Share Target/Photo Picker
- local DB/offline
- file lifecycle
- Web SEO/public pages
- build/release complexity
- tests

Capacitor/plugin 버전과 native bridge 구현 세부는 승인된 ADR/ExecPlan과 spike 증거를 따른다.

2026-08-16 실행 순서 보완:

- Android native image intake와 app-private storage 기반은 폐기하거나 다시 만들지 않는다.
- `/memory/new/`, `/archive/`, `/memory/card/`의 공용 React UI를 Web 내부 검증면에서 먼저 완성한다.
- Web gate에서는 모바일·데스크톱 반응형, 잘림·가독성, 상태 표현, 키보드·터치 접근성을 검증한다.
- gate 통과 뒤 같은 공용 surface를 Android shell에 적용하고 safe-area, keyboard, back, native media 표시를 실기기에서 검증한다.
- 이 단계에서 Web production 이미지 업로드·영구 LOCAL_ONLY 저장, 인증·동기화·cloud·Public을 활성화하지 않는다.

상세 결정과 UI 기준은 `decisions/2026-08-16-web-first-shared-ui-readiness.md`와 `../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`를 따른다.

## 10. Catalog provider 격리

```text
CatalogProvider interface
- searchTitles
- getTitleCandidate
- fetchUpdates
```

외부 provider 결과는 raw/candidate로 취급한다. public catalog write는 ingestion pipeline을 통과한다.

AniList 런타임이 남아 있다면:

- provider adapter 뒤에 격리
- failure fallback
- new code에서 직접 호출 금지
- 제거 계획과 테스트

### 10.1 수집 중 TEST_ONLY 데이터를 쓰는 개발 adapter

```text
external TEST_ONLY ServiceProjection/Cover
→ Node-only validated read model
→ loopback Astro DEV middleware
→ allowlisted browser TitleResolver DTO
→ existing local resolver + MemoryTitleSelector
```

- `tools/dev-catalog/*`만 외부 filesystem을 읽고 브라우저 component는 filesystem·raw artifact를 알지 못한다.
- DEV TitleResolver는 local projection endpoint를 우선하며 endpoint 자체가 불가할 때만 기존 AniList resolver로 복구한다. 검색 결과가 0개인 것은 정상 결과이므로 외부 요청을 자동 추가하지 않는다.
- 기존 legacy alias는 계속 별도 local resolver이고 같은 numeric AniList ID만 화면 후보에서 병합한다.
- TEST_ONLY cover URL은 검색 후보의 일시 preview capability일 뿐 Card/AnimeRef/VisualAsset에 영구 저장하지 않는다.
- production static build에는 DEV endpoint client, 외부 경로, 수집 이미지가 없어야 한다.

## 11. 이미지 추상화

```text
MediaRepository
- importLocalImage
- createSystemDesign
- uploadPrivate
- requestPublish
- deleteAsset
- getDisplaySource
```

Web은 LOCAL_ONLY 원본을 가정하면 안 된다.

## 12. feature flags

- new catalog
- private title
- new memory card
- board
- sync
- private image backup
- public publishing
- image type public permissions
- provider cutover

## 13. 마이그레이션 원칙

- 기존 데이터를 즉시 삭제하지 않는다.
- dual-read/dual-write가 필요하면 기간과 종료 조건을 계획한다.
- migration version과 rollback을 둔다.
- user-visible data count를 전후 비교한다.
- backups와 dry-run을 사용한다.

## 14. P0 chain 전체 수용 기준

아래는 여러 slice를 합친 P0 완료 기준이다. 첫 local-only slice의 수용 기준은 `plans/first-private-vertical-slice.md`를 따른다.

- Android에서 이미지를 받아 저장 전 검토 가능.
- 검색 실패 시 PrivateTitle로 계속 진행.
- 작품 + visual이 없으면 Complete가 되지 않음.
- 네트워크 없이 카드·Archive 저장.
- 카드 3개 후 Board 제안.
- 같은 카드를 여러 Board에 추가.
- 로그인 실패에도 로컬 데이터 유지.
- metadata sync 후 Web에서 동일 카드 확인.
- LOCAL_ONLY 이미지는 Web에서 오해 없는 대체 표시.
- export와 deletion 기본 동작.
- analytics에 note/image가 포함되지 않음.

## 15. P0 chain 구성 요소

아래 목록은 필요한 구성 요소의 legacy outline이며 승인된 실행 순서가 아니다. 승인된 큰 순서는 `local-only Card/Archive → Board/Web → account sync → private cloud → 제한 catalog`다. 첫 단계 내부의 현재 순서는 `구축된 Android 기반 유지 → Web 공용 UI readiness → Android 적용·dogfood → 잔여 local-only 기능 마감`이며, 상세 milestone은 `plans/first-private-vertical-slice.md`를 따른다.

```text
observability/feature flags
→ domain model and local persistence
→ Android image intake
→ catalog search/private title
→ MemoryCard
→ Archive
→ Board
→ account promotion/sync
→ Web surfaces
→ export/delete
→ private cloud image
→ UGC foundation
```

## 16. 완료 보고

각 milestone 후 다음을 기록한다.

- 사용자 흐름 데모
- 변경 파일
- schema/API 변경
- 테스트 결과
- analytics events
- migration status
- known limitations
- next gate
