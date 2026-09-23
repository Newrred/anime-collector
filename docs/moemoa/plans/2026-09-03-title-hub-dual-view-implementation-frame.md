# 04. Implementation and Verification Plan

> **상태:** `APPROVED EXECUTION FRAME`
>
> **목표:** 현재 MOEMOA 코드베이스를 파괴적으로 재작성하지 않고, 공식 표지 VisualAsset, Title Hub, My Titles dual view를 단계적으로 구현하고 검증한다.

## 1. Codex 실행 원칙

1. 문서를 먼저 갱신하고 코드 변경을 시작한다.
2. 현재 repository와 테스트에서 실제 구현을 확인한다.
3. 변경 전에 local data와 current route의 rollback 근거를 만든다.
4. 한 단계마다 failing test → 최소 구현 → focused test → screenshot → 보고 순서를 지킨다.
5. 기존 CSS 전체를 재작성하지 않는다.
6. remote migration과 destructive local migration을 같은 단계에 섞지 않는다.
7. 구현됨, 자동 검증됨, 배포 검증됨, 실기기 검증됨, 사용자 이해 검증됨을 분리한다.

## 2. 시작 전 Repository Audit

Codex는 다음을 조사한다.

### 2.1 Git / build

- current branch와 HEAD
- uncommitted files
- package manager
- build, lint, unit, E2E, visual test scripts
- Vercel 또는 production deployment 구조
- feature flags

### 2.2 화면과 route

- Home
- Library
- Archive
- Boards
- Memory composer
- Memory detail
- catalog search/detail
- navigation
- existing direct route/query contracts

### 2.3 저장소와 domain

- legacy Library item schema와 localStorage/IndexedDB key
- MemoryCard, AnimeRef, PrivateTitle, VisualAsset schema
- Complete Card validator
- platform memory runtime
- sync DTO/RPC/schema
- Board membership
- catalog cover record와 URL lifecycle
- existing Memory count selector

### 2.4 Test evidence

- 작품 저장과 Memory 생성의 독립성 테스트
- Archive grid tests
- current Library detail tests
- visual screenshot harness
- Android native tests 또는 manual evidence

### 2.5 Audit 산출물

```text
현재 구현 지도
충돌 목록
데이터 삭제 위험
schema 변경 후보
route alias 계획
단계별 변경 파일 예상
```

## 3. 권장 Architecture

### 3.1 핵심 관계

```text
Owner
├─ UserTitleState 0..N
├─ WatchLog 0..N
├─ MemoryCard 0..N
└─ Board 0..N

Anime / PrivateTitle
├─ UserTitleState: owner+title 당 0..1
└─ MemoryCard: 0..N

MemoryCard
└─ VisualAsset: Complete일 때 1

Board
└─ BoardCardMembership: MemoryCard와 N:M
```

### 3.2 TitleRef

현재 내부 ID와 legacy AniList ID를 바로 하나의 raw 값으로 섞지 않는다.

```ts
type TitleRef =
  | { kind: "ANIME"; animeId: string }
  | { kind: "PRIVATE_TITLE"; privateTitleId: string }
  | { kind: "LEGACY_ANILIST"; anilistId: number };
```

`LEGACY_ANILIST`는 adapter 입력이며 canonical write target으로 새로 사용하지 않는다.

### 3.3 TitleAlbumProjection

새 영구 테이블이 아니라 read projection을 기본으로 한다.

```text
legacy/new title state
+
resolved title/catalog data
+
Memory summaries grouped by TitleRef
=
TitleAlbumProjection
```

필수 selector:

```text
resolveTitleRef
listTitleAlbums
getTitleHub
listMemoryPreviewsByTitle
countMemoriesByTitle
```

### 3.4 Official cover VisualAsset

제품 의미:

```text
user-owned private Memory Card metadata
→ references
catalog-managed official cover asset
```

권장 record:

```ts
type CatalogCoverVisualRef = {
  sourceKind: "CATALOG_COVER";
  catalogAnimeId: string;
  catalogCoverId: string;
  rightsBasis: "EXPLICIT_PERMISSION";
  permissionVerifiedAt: string;
};
```

기존 schema가 `storageScope = LOCAL_ONLY`만 Complete로 허용한다면 validator를 다음 의미로 바꾼다.

```text
USER_IMAGE
→ local/private media invariant

SYSTEM_DESIGN
→ reproducible design invariant

CATALOG_COVER
→ valid catalog cover reference + permission metadata invariant
```

정확한 enum 이름은 audit 후 선택하되 `CATALOG_COVER`를 사용자 local file처럼 가장하지 않는다.

### 3.5 Privacy separation

```text
catalog cover bytes가 공개적으로 제공됨
≠
사용자의 Memory note/date/Board membership이 공개됨
```

Card visibility와 source asset delivery 범위를 분리한다.

## 4. 단계별 구현

## Phase 0 — Safety Baseline

### 작업

- current local Library/Memory 데이터 개수 기록
- export 가능한 데이터는 backup 생성
- existing routes와 주요 화면 before screenshot
- current unit/E2E/build 결과 저장
- git status와 rollback commit 확인

### 금지

- IndexedDB version bump
- localStorage key 삭제
- remote migration
- route 제거

### 완료 기준

- 기존 데이터 수량과 backup 위치가 기록됨
- rollback 명령과 기준 commit이 있음
- current failures와 new regressions를 구분 가능

## Phase 1 — Canonical Docs and Conflict Removal

### 작업

- repository의 canonical decision log를 이 패키지와 동기화
- 다음 과거 문장을 제거 또는 superseded 표기
  - cover는 search/detail에만 사용
  - cover는 VisualAsset 불가
- `IA-01`, `TITLE-VIEW-01`, `CATALOG-PROD-01` 갱신 기록
- current UI spec의 관련 비목표와 data/security section 갱신

### 완료 기준

- repository 안에 서로 충돌하는 active canonical 문장이 없음
- 역사 문서는 삭제하지 않고 superseded status가 명확함

## Phase 2 — Catalog Cover Visual Source

### 2.1 Domain test 먼저

필수 failing tests:

1. valid catalog cover reference로 Complete Private Card 생성
2. 작품 표지 노출만으로 Card 생성되지 않음
3. 작품 저장만으로 Card 생성되지 않음
4. cover Card에 personal signal이 없으면 save blocked/Draft
5. cover Card에 note/date/emotion 중 하나가 있으면 Complete
6. catalog cover bytes를 local media promote path로 보내지 않음
7. Card 삭제가 shared catalog cover를 삭제하지 않음
8. cover reference sync payload에 bytes가 없음
9. permission/source metadata가 누락되면 invalid
10. Public gate 상태는 변경되지 않음

### 2.2 구현

- Visual source union에 `CATALOG_COVER`
- create command input에 cover reference branch
- validator source별 invariant 분리
- repository persistence
- sync DTO
- detail/archive renderer
- error/missing state
- feature flag 또는 kill switch

### 2.3 UI

- composer choice: My image / Official cover / System design
- title 미선택 상태에서 cover 선택 시 title selector 연결
- cover preview와 source badge
- personal signal requirement inline error
- Archive의 4:5 frame 안에서 contain rendering

### 완료 기준

- unit + integration + E2E 통과
- 기존 user-image/system-design flow 회귀 없음
- cover-based Card가 Archive/Detail에 나타남
- 실제 shared cover record는 Card 삭제 후 유지

## Phase 3 — Title Projection and Title Hub

### 3.1 Selector tests

fixture:

- saved only
- memory only
- saved + one memory
- saved + many memories
- PrivateTitle + memories
- legacy AniList item resolved
- unresolved legacy item
- missing official cover
- mixed visual sources

필수 assertion:

- union에서 duplicate title이 하나의 album으로 합쳐짐
- `isSaved`와 `memoryCount`가 독립적
- Memory 삭제 후 saved state 유지
- save removal 후 memories 유지
- same title route resolves consistently

### 3.2 Title Hub 화면

- title identity header
- compact state summary
- independent `Add Memory` and `Save Title` actions
- related Memory Gallery
- WatchLog/metadata sections
- all four state combinations
- Memory Detail → Title Hub link

### 3.3 Route

권장 canonical route:

```text
/titles/
/titles/<internal-title-id>/
```

현재 Astro routing과 ID shape 때문에 dynamic route가 위험하면 다음 query route를 임시 canonical로 사용할 수 있다.

```text
/title/?ref=<encoded-internal-ref>
```

Codex는 current route contract를 audit한 뒤 deep link, static build, Android App Link에 가장 안전한 형태를 선택하고 근거를 기록한다.

### 완료 기준

- search, legacy Library, Memory Detail에서 같은 Title Hub 진입
- URL reload 가능
- back navigation과 focus 복귀 정상
- title hub가 데이터 write를 암묵적으로 수행하지 않음

## Phase 4 — My Titles Dual View

### 4.1 Read model

- `listTitleAlbums` 구현
- official cover, tracking, memoryCount, previewMemories 최대 3개
- preview priority 적용
- pagination/cache 설계

### 4.2 Poster View

- official cover grid
- title/status/memory count
- responsive columns
- PrivateTitle fallback
- no personal preview

### 4.3 Memory View

- official cover anchor
- Memory mosaic/strip
- `+N`
- latest cue
- memory-empty CTA
- memory-only unsaved state

### 4.4 Mode preference

- `POSTER | MEMORY`
- last selection persistence
- default rule
- filters/sort/search preserved
- mode change analytics without text/image

### 완료 기준

- 같은 filter에서 두 mode의 album IDs가 동일
- mode 전환으로 write repository 호출 없음
- reload 후 preference 복원
- 320px에서 horizontal overflow 없음
- 200% zoom에서 기능 손실 없음

## Phase 5 — Navigation, Copy, Search, Aliases

### 작업

- `Archive` nav → `Memories/기억`
- `Library` nav → `Titles/작품`
- `Create memory card` action → `Add Memory/기억 남기기`
- `Add to Library` → `Save Title/작품 저장`
- 검색 결과에 saved state + memory count
- result/title → Title Hub
- existing actions maintain independence
- `/library/`, `/archive/` alias/redirect
- old query mapping

### 완료 기준

- direct legacy URLs remain safe
- no stale modal behind navigation
- locale key parity KO/EN
- keyboard and screen reader labels updated

## Phase 6 — Home and Cross-surface Integration

### 작업

- Home recent Memory remains first
- recent/continuing titles use Title Hub links
- first Memory success provides Memory View suggestion
- Archive/Board Memory detail links to Title Hub
- Board continues to contain MemoryCard only

### 완료 기준

- Home does not regress into cover-first tracker dashboard
- titles are visible as context, not primary archive visual
- no duplicate Card created through cross-link

## Phase 7 — Android Adaptation

Web shared UI gate가 닫힌 뒤 진행한다.

검증:

- Share Target
- Photo Picker
- Official cover selection
- safe area
- software keyboard
- Android back
- process death and resume
- offline catalog behavior
- app-private image preservation
- cover reference rendering
- physical device readability

공식 표지 기반 Card는 network/cache unavailable 시 `MISSING` 또는 retry/replace 상태를 제공하되 user-image local lifecycle과 혼합하지 않는다.

## Phase 8 — Legacy UI Retirement

사람 검토 통과 후에만 진행한다.

- independent Library nav 제거
- old Library route compatibility 유지 기간 결정
- legacy memo/WatchLog 위치 정리
- unused UI component 제거
- local data store 삭제는 별도 명시 승인 전 금지

## 5. Component and File Boundary

권장 구조 예:

```text
src/features/titles/
├─ application/
│  ├─ buildTitleAlbumProjection.*
│  └─ buildTitleHubProjection.*
├─ domain/
│  ├─ titleRef.*
│  └─ titlePresence.*
├─ components/
│  ├─ TitleCollectionView.*
│  ├─ TitlePosterTile.*
│  ├─ TitleAlbumCard.*
│  ├─ TitleViewModeControl.*
│  └─ TitleHub.*
└─ styles/

src/features/memory/
├─ domain/
│  └─ visual source union
├─ application/
│  └─ create/update cover-based memory
└─ components/
   └─ catalog-cover renderer
```

실제 repository conventions가 다르면 기존 구조를 우선하되 다음 경계는 지킨다.

- selector/application logic와 presentational UI 분리
- catalog cover resolver와 local media adapter 분리
- Archive component가 Board domain을 import하지 않음
- Title UI가 raw legacy localStorage를 직접 읽지 않음
- shared CSS를 global file 끝에 무제한 누적하지 않음

## 6. Data Migration Strategy

### 6.1 Remote

실제 legacy 사용자가 0명이므로 legacy remote Library/WatchLog schema를 신규로 만들지 않는다.

### 6.2 Local

개발 기기 데이터는 다음 순서 없이 변환·삭제하지 않는다.

```text
inspect
→ export
→ count/checksum
→ adapter read
→ new projection verification
→ rollback rehearsal
→ explicit approval
```

### 6.3 Recommended transition

```text
LegacyLocalLibraryAdapter
+
MemoryRepository
+
CatalogTitleResolver
→ TitleAlbumProjection
```

먼저 read integration을 구현한다. 신규 `UserTitleState` write model이 필요하면 기존 local data를 그대로 둔 dual-read 또는 explicit import로 전환한다.

## 7. Test Matrix

### 7.1 Domain invariants

- Save Title does not create Memory
- Create Memory does not save Title
- Remove Title does not delete Memory
- Delete Memory does not remove Title
- Board removal does not delete Memory
- official cover anchor does not count as Memory
- official cover selected by user does count as Memory
- cover-based Memory requires personal signal
- catalog cover bytes are not duplicated per card
- user card privacy is independent from cover delivery

### 7.2 Projection

- union and deduplication
- saved-only
- memory-only
- saved-with-memory
- PrivateTitle
- legacy resolved/unresolved
- mixed sources
- preview priority
- memory count after delete

### 7.3 UI behavior

- mode toggle same dataset
- filters preserved
- sort preserved
- preference persisted
- first memory suggestion only once
- source badges
- title hub all four states
- search action separation
- direct route reload
- legacy alias

### 7.4 Layout

Required viewport:

- 320×720
- 390×844
- 768×1024
- 1024×768
- 1440×900

Assertions:

- horizontal overflow ≤ 0.5px
- touch target ≥ 44×44 for primary/mobile controls
- title max two lines
- cue max two lines
- no image-induced major layout shift
- mode control not clipped
- card minimum width respected
- 200% zoom and 320px reflow usable

### 7.5 Accessibility

- one `main`, one `h1`
- mode control semantic
- keyboard navigation
- focus retention after toggle
- accurate alt distinction
- status/alert semantics
- contrast
- reduced motion
- dialog focus trap

### 7.6 Visual golden

Add only critical screenshots specified in `03`.

Do not:

- increase global threshold to hide changes
- mask official cover, Memory preview, status or error
- replace real layout regressions with broad snapshots updates

## 8. Manual Product Gate

설명을 받지 않은 사용자가 다음을 수행해야 한다.

1. 10초 안에 `기억 남기기`를 찾는다.
2. `작품 저장`과 `기억 남기기`의 결과 차이를 설명한다.
3. Poster View와 Memory View의 차이를 설명한다.
4. 한 작품의 개인 이미지를 찾는다.
5. 공식 표지 anchor와 공식 표지 기반 Memory Card를 구분한다.
6. Memory만 있는 작품이 저장된 작품이 아님을 이해한다.
7. 작품 상태를 바꾸고도 Memory가 유지되는 것을 확인한다.
8. 같은 작품에 두 번째 Memory를 만든다.
9. Board에서 제거해도 Archive 원본이 남는 것을 이해한다.
10. PRIVATE/LOCAL_ONLY와 cloud/Public을 혼동하지 않는다.

목표 시간:

- 첫 Complete Card: 2분 이내
- 원하는 작품 찾기: Poster View에서 10초 이내
- 해당 작품의 Memory 찾기: Memory View 또는 Title Hub에서 10초 이내

## 9. 단계별 완료 보고

각 Phase 종료 시 다음을 작성한다.

```text
Phase:
Decision docs updated:
Code implemented:
Unit tests:
E2E tests:
Visual/layout tests:
Production build:
Preview/deployed verification:
Android device verification:
Human usability verification:
Local data before/after counts:
Known gaps:
Rollback:
```

## 10. Stop Conditions

다음 상황에서는 임의로 진행하지 않고 위험과 선택지를 보고한다.

- current code에 이미 다른 canonical Title model이 존재함
- official cover permission metadata를 식별할 방법이 없음
- catalog cover reference가 불안정하거나 삭제 가능 ID만 제공함
- local data 변환 없이는 기존 Library를 읽을 수 없음
- schema migration history가 remote와 불일치함
- visual source enum 변경이 production data를 파괴할 가능성이 있음
- route alias가 OAuth/PWA/App Link를 깨뜨림
- Public 기능을 켜야만 구현이 가능해 보임

단, 단순 구현 난이도나 작업량만을 이유로 중단하지 않는다. 가능한 비파괴 단계까지 수행하고 남은 위험을 분리한다.

## 11. 최종 완료 조건

다음이 모두 충족되어야 이번 통합을 완료로 표시한다.

- canonical docs와 code가 충돌하지 않는다.
- official cover VisualAsset flow가 구현되고 source별 invariant가 테스트된다.
- My Titles의 Poster View와 Memory View가 같은 dataset을 표시한다.
- Title Hub가 saved-only, memory-only, both, neither를 처리한다.
- Save Title과 Create Memory의 독립성이 회귀 테스트로 보호된다.
- legacy local data count가 의도 없이 감소하지 않는다.
- existing direct route 또는 safe redirect가 작동한다.
- KO/EN, dark/light, required viewport가 검증된다.
- Web preview 또는 production-like environment에서 확인된다.
- Android 적용 항목은 실제 기기 검증 전 별도 상태로 남는다.
- 사람 검토 gate가 통과된다.
