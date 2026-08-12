# 06. 아키텍처와 첫 Vertical Slice 계획

> **문서 상태: `CURRENT CONSTRAINTS / GATED DESIGN`**
> 공통 도메인/local-first 제약과 Astro/React + Capacitor client 방향은 확정됐다. 첫 실행 단위의 상세안은 `reports/architecture-decision-proposal.md`와 `plans/first-private-vertical-slice.md`에 작성됐으며 사용자 승인 전이다. backend 형태, account linking/promotion schema, sync 규칙은 `BACKEND-01`, `AUTH-01`, `SYNC-01` 승인 전에는 확정하지 않는다. Guest Owner ID와 owner-scoped local namespace는 `ACCOUNT-01`에서 파생되는 필수 불변조건이다.

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
Backend boundary — Supabase direct/RLS adapter 또는 thin API (`BACKEND-01` 미정)
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

위 `Backend boundary`는 논리적 애플리케이션 경계다. Supabase direct/RLS adapter 또는 thin API 중 어느 배포 형태를 뜻하는지는 아직 미정이다. 실제 디렉터리와 기술 선택은 완료된 저장소 감사를 바탕으로 Phase 2에서 제안·승인한다.

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
- AccountLink
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

`Owner`는 제품 데이터의 소유 경계를 나타내고, `DeviceIdentity`는 기기 식별, `User`는 인증 주체다. local slice부터 설치별 Guest Owner ID와 owner-scoped namespace를 둔다. 로그인 승격 시 entity ID를 가능한 한 유지하되 owner 전환과 계정 혼입 방지를 별도 규칙으로 검증한다. account identity/link mapping, promotion transaction, remote conflict의 구체 schema는 `AUTH-01`과 `SYNC-01` 승인 전 고정하지 않는다.

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
- 로그인 후 기존 로컬 entity ID를 가능한 한 유지한다.
- server ID와 local ID 관계를 명시한다.
- 중복 업로드 방지용 idempotency key를 사용한다.
- 이미지 백업은 별도 opt-in.

## 8. 동기화 충돌

최종 규칙은 `SYNC-01`에서 확정한다. Codex는 다음 옵션을 비교한다.

### Card scalar fields

- version + last-write-wins
- field-level merge
- explicit conflict UI

### Board order

- position token/lexicographic ordering
- operation log
- server canonical list

### Delete versus edit

- tombstone 우선
- grace period 복구
- conflict prompt

어떤 규칙을 선택하든 삭제된 카드가 다른 Board나 Web에서 재생성되지 않아야 한다.

## 9. Web/Android 코드 공유

`TECH-01`에 따라 Astro/React + Capacitor Android shell을 사용한다. Phase 2에서는 이 방향 안에서 다음 경계를 구체화한다.

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

Capacitor/plugin 버전과 native bridge 구현 세부는 spike 증거와 ADR/ExecPlan 승인 없이 고정하지 않는다.

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

아래 목록은 필요한 구성 요소의 legacy outline이며 승인된 실행 순서가 아니다. 현재 제안 순서는 `local-only Card/Archive → Board/Web → account sync → private cloud → 제한 catalog`이고, 상세 milestone은 `plans/first-private-vertical-slice.md`를 따른다.

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
