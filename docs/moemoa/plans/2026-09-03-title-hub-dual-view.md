# Title Hub·Dual View 통합 ExecPlan

> **상태:** `PHASE 6 IMPLEMENTED / WEB VERIFIED — HUMAN USABILITY GATE BEFORE PHASE 7`
>
> **승인 범위:** 2026-09-03 사용자가 전달한 Pro 협의 패키지를 최신 제품 방향으로 채택한다. 문서 동기화와 local domain 구현에 이어, 사용자가 Supabase `CATALOG_COVER` 비파괴 확장 migration·RPC 동기화 변경을 명시 승인했다. 운영 Web 배포는 이 승인에 포함하지 않는다.

## 1. 목적과 사용자 결과

기존 Library와 Memory Archive의 쓰기 의미는 분리하면서, 사용자에게는 `작품 / Titles`와 작품별 `Title Hub`를 통해 하나의 자연스러운 경험으로 제공한다. 작품 집합은 `표지 보기`와 `기억 함께 보기`로 탐색하고, 사용자가 명시적으로 선택한 승인된 대표 표지는 개인 기억 신호를 갖춘 Memory Card의 visual로 사용할 수 있게 준비한다.

## 2. 관련 확정 결정

- `CARD-01`, `CATALOG-PROD-01`: 대표 표지를 명시적으로 선택한 Memory visual 허용.
- `IA-01`: 작품 허브형 Library·Memory 읽기 통합.
- `TITLE-COLLECTION-01`: 저장 작품과 Complete Memory 보유 작품의 합집합.
- `TITLE-VIEW-01`: Poster View와 Memory View.
- `LIBRARY-INTEGRATION-01`, `NAMING-01`: 기존 Library의 축소 통합과 사용자 명칭.
- 기존 불변식 `Save Title ≠ Create Memory`, `Remove Title ≠ Delete Memory`는 유지한다.

## 3. 현재 상태와 저장소 증거

- 현재 작품 읽기 route는 `/titles/`와 `/title/`로 통합됐다. `/archive/`는 Memories 주소를 유지하고 `/library/`는 작품 목록·상세로 연결하되 `focus=quick-log`와 `focus=edit`에서는 기존 기록 편집을 보존한다.
- Memory Composer는 catalog 후보나 detail deep-link의 승인된 cover revision을 사용자가 명시적으로 선택하게 하며, Archive와 Memory Detail은 저장된 immutable reference를 다시 resolve해 표시한다.
- additive migration은 user metadata Supabase schema와 mutation/conflict/promotion RPC에 `CATALOG_COVER`를 추가한다. local fresh DB와 hosted project `okchpyagfucpzpyrfgol`에 적용·검증됐다.
- 기존 active catalog asset의 배포 근거는 preview permission이었고, Memory Card가 참조하는 durable `catalog_cover_revisions` registry는 별도 검증된 `EXPLICIT_PERMISSION`과 허가 확인 시각을 요구한다.
- 기존 Library는 AniList ID 기반 local record와 runtime AniList media를 사용한다.

## 4. 범위

### 포함

- 최신 결정·제품 흐름·UI 명세·실행 계획을 저장소 문서 체계에 반영.
- 기존 active 문서의 충돌 문구를 superseded 처리.
- 현재 코드·DB·route와 새 결정의 차이를 파일 단위로 기록.
- 이후 구현을 비파괴 단계와 별도 승인 단계로 구분.
- 기존 Library·Complete Memory·catalog detail을 합치는 read-time Title projection.
- `/title/` 작품 허브와 검색·Library·catalog detail·Memory Detail 진입 동선.

### Phase 4에서 제외

- localStorage·IndexedDB 변환·삭제.
- 기존 route 제거·사용자-facing nav 명칭 변경, Web 배포, Public 기능 활성화.

## 5. 아키텍처·데이터 흐름

```text
LegacyLocalLibraryAdapter + MemoryRepository + CatalogTitleResolver
→ TitleAlbumProjection
→ My Titles Poster View / Memory View
→ Title Hub
```

공식 표지 기반 Memory는 user-owned card metadata가 catalog-managed cover revision을 참조한다. Local 계약은 작품별 stable identity와 immutable revision을 분리했다. Remote 적용 전에는 과거 revision record와 object를 active release 교체 후에도 보존하고, 누락 시 `MISSING/REPLACE_REQUIRED`로 전환하는 수명주기를 migration에 포함한다.

## 6. 변경 파일 지도

- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `docs/moemoa/README.md`
- `docs/moemoa/decisions/2026-09-03-title-hub-dual-view-and-catalog-cover.md`
- `docs/superpowers/specs/2026-09-03-title-hub-dual-view-ui.md`
- 이 ExecPlan
- `docs/moemoa/reports/2026-09-03-title-hub-code-conflict-audit.md`
- `docs/superpowers/README.md`

## 7. 데이터·스키마 마이그레이션

`20260903141500_catalog_cover_memory_assets.sql`은 다음을 additive하게 추가한다.

- active catalog release에서 독립된 immutable `catalog_cover_revisions` registry.
- `memory_visual_assets`의 nullable cover identity/revision/anime/permission columns.
- `CATALOG_COVER`, `CATALOG_MANAGED`, `EXPLICIT_PERMISSION` constraint와 durable foreign key.
- 기존 mutation/conflict/promotion 구현을 보존한 public wrapper와 normalized reference hydration.

기존 `USER_IMAGE`·`SYSTEM_DESIGN` row는 변환하거나 삭제하지 않는다. 롤백은 기존 RPC entry point로 routing을 되돌리고 UI/feature를 끈 뒤 새 write를 중단하는 비파괴 operational rollback을 우선한다. 이미 참조된 cover registry row와 columns는 FK 보존을 위해 삭제하지 않는다.

## 8. 마일스톤

1. Canonical 문서 동기화와 Decision Log 기록.
2. 현재 코드·schema·route 충돌 감사.
3. 공식 표지 영구 참조 설계와 Phase 2 구현 계획 보완.
4. 사용자 승인 후 local catalog-cover domain vertical slice. **완료**
5. remote additive migration·RPC local 검증. **완료**
6. hosted migration 적용 및 read-only 상태·권한 확인. **완료**
7. composer/archive/detail 연결. **완료**
8. Title projection과 Title Hub. **완료**
9. My Titles dual view. **완료**
10. Navigation·copy·검색·legacy alias 통합. **구현·Web 검증 완료**
11. Phase 6 Home·화면 간 연결과 첫 Memory 작성 후 Memory View 제안. **구현·로컬 Web 검증 완료**
12. Web 사용성 gate 뒤 Phase 7 Android 적용.

## 9. 테스트와 검증

문서 단계에서는 별도 테스트 framework를 추가하지 않는다.

- Markdown 상대 링크 존재 확인.
- active 문서에서 폐기된 표지 금지 문구 검색.
- `git diff --check`.
- 변경 파일이 문서 범위에 한정됐는지 확인.

구현 단계 테스트는 각 동작의 핵심 불변식과 주요 모바일 흐름만 우선하며, 같은 사실을 여러 계층에서 중복 검증하지 않는다.

## 10. 보안·개인정보·권리 영향

새 결정은 대표 표지 사용 범위를 확대하지만 사용자 note, 날짜, Board membership의 privacy를 확대하지 않는다. 카드에는 이미지 bytes·object path를 복제하지 않고 승인 시각을 포함한 immutable reference만 저장한다. public cover registry는 승인된 표지 revision metadata만 읽을 수 있고, user-owned Memory table의 RLS와 private visibility는 유지한다.

## 11. 관찰 가능성·분석 이벤트

자유 텍스트와 이미지 정보를 제외한 `catalog_cover_selected`를 local telemetry port에 연결했다. 현재 sink는 승인 전 비활성화 상태다. 후속 구현에서는 `title_view_mode_changed`, `title_hub_opened`만 검토한다.

## 12. 롤백·복구

원격 적용 전에는 migration·gateway 변경을 revert하면 된다. 원격 적용 후에는 UI/feature를 끄고 public RPC routing을 기존 보존 함수로 되돌리는 후속 migration을 우선한다. 새 cover write를 중단해도 기존 `USER_IMAGE`·`SYSTEM_DESIGN`은 계속 동작한다. 이미 참조된 registry row와 nullable columns는 데이터 보존을 위해 즉시 drop하지 않으며, destructive cleanup은 별도 승인과 사용 현황 확인 후에만 수행한다.

## 13. 위험과 완화

- active catalog release 제거 시 카드의 표지 reference가 끊길 수 있음 → 영구 cover identity와 revision 보존 설계 선행.
- preview 권리 코드와 확대 승인 범위 불일치 → migration 전 권리 metadata 계약 확정.
- Library와 Memory의 자동 결합 오해 → 독립 write 불변식 유지.
- 진행 중인 다른 작업과 변경 혼합 → Phase별 파일 경계를 유지하고 별도 status 보고.

## 14. 필요한 사용자 결정

- 기존 `/library/` alias 유지 기간과 최종 route 형태.

## 15. 진행 기록

- `[2026-09-07] Phase 6 완료:` Home 최근 Memory 우선 구조와 작품 문맥을 유지하고 작품 연결을 Title Hub로 정리했다. 공식 표지 Memory의 Home resolve/contain 표시, Home·Detail 공통 작품 ID 연결, 첫 저장 후 owner별·기기별 한 번만 안내하는 Memory View 제안을 구현했다. 사용자의 보기 선택은 안내 수락 전 바꾸지 않는다. unit 221, build 15 pages, 최종 대상 Chromium 6/6 및 기존 핵심·확장 흐름을 검증했고 React Doctor는 84/100을 유지했다. [Phase 6 보고서](../reports/2026-09-07-title-cross-surface-phase6.md)에 테스트 범위·제약·복구를 기록했다. 다음은 사람 Web 사용성 gate 확인 후 Phase 7 Android 적용이다.

- `[2026-09-07] Phase 6 승인·시작:` 사용자의 후속 진행 요청에 따라 Home의 최근 Memory 우선순위를 유지하고 작품 문맥·최근/이어보기·캐릭터 연결을 Title Hub로 정리한다. Archive/Board → Memory Detail → Title Hub의 동일 작품 연결을 교차 검증한다. 첫 Complete Memory 저장 성공 후 Archive에 한 번만 Memory View 안내를 제공하며, 사용자가 누르기 전 마지막 보기 선택은 바꾸지 않는다.
- `[2026-09-07] Phase 6 구현·검증·복구 범위:` Home 및 home components, Memory composer/Archive/Detail의 연결, owner별 로컬 안내 preference, 한영 문구와 관련 unit/E2E가 대상이다. 도메인/DB/원본 데이터 migration과 Android 배포는 제외한다. 초기 unit 218, React Doctor 84/100(기존 4 warnings)을 기준으로 저장 독립성·일회성 안내·320px/desktop·native URL mapping을 검증한다. 작업 전 text snapshot은 `D:/hong/Web/Anime/.moemoa-ui-audit-2026-09-07-phase6/`에 보존했다. 추가되는 로컬 안내 표시는 삭제 가능한 UI preference일 뿐 원본 Memory·Library에는 영향을 주지 않는다.

- `[2026-09-07] Phase 5 완료:` Home·Memories·Titles·Boards 메뉴, Tier 보조 메뉴, 저장 상태와 Complete Memory 수를 보이는 검색, 한·영 action copy, `/library/` alias와 기존 기록 편집 진입을 구현했다. unit 218/218, build 15 pages, 확장 Chromium 48 passed/1 conditional skip 및 후속 변경 대상 재검증을 통과했다. React Doctor는 84/100(시작 86), 기존 maintainability 경고는 5→4이며 최종 메뉴·검색 코드 경고는 없다. 점수 하락 원인은 확정하지 않았으며 추가 품질 확인 항목으로 남긴다. 상세 결과·복구·제약은 [작업 보고서](../reports/2026-09-07-title-navigation-phase5.md)에 기록했다.

- `[2026-09-07] Phase 5 승인·시작:` 사용자가 프로젝트 분석에서 제시한 다음 작업 실행을 요청했다. 메뉴를 Titles/Memories로 통합하고 검색의 저장 상태·Memory 수, 기존 주소 호환과 KO/EN action copy를 정리한다. 작업 시작 시 master에 기존 수정·미추적 항목 112개가 있으며 이를 보존한다. 기준 검증은 unit 216/216, build 15 pages다.
- `[2026-09-07] Phase 5 구현 범위:` `/titles/`와 `/title/`를 사용하고 `/archive/`는 Memories의 기존 canonical 주소로 유지한다. `/library/` 기본 진입은 `/titles/`, 작품 ID 진입은 Title Hub로 연결하되 기존 `focus=quick-log`와 명시적 기록 편집 진입은 호환 화면을 보존한다. WatchLog/상태/평점 편집은 아직 Title Hub로 완전히 이전되지 않았기 때문이다. 호환 기간 종료나 원본 component 삭제는 Phase 8에서 결정한다.
- `[2026-09-07] Phase 5 파일·검증·복구:` TopNavDataMenu, 검색 source/panel, titleNavigation·호환 route, KO/EN copy 및 관련 테스트가 대상이다. 저장소·DB·이미지·동기화 스키마는 변경하지 않는다. 기존 변경 파일은 별도 작업 snapshot으로 보존한 뒤 이번 diff만 되돌릴 수 있게 한다. 핵심 검증은 query mapping/저장 독립성/owner별 Memory count, desktop·320px 메뉴와 검색·뒤로가기·KO/EN E2E, build, unit, React Doctor이며 배포·Android sync는 실행하지 않는다.

- `[2026-09-03] 승인:` Pro 협의 패키지를 최신 방향으로 채택하고 문서 동기화·충돌 감사를 먼저 수행.
- `[2026-09-03] 범위:` 검증 코드를 과도하게 구조화하지 않고 핵심 계약 중심으로 유지.
- `[2026-09-03] 완료:` canonical 01·02를 원본 패키지와 checksum-equivalent하게 반영하고, UI 명세·Decision Log·architecture/index·코드 충돌 감사를 동기화했다. 애플리케이션 코드·DB·local/remote data는 변경하지 않았다.
- `[2026-09-03] 구현:` 작품별 stable `cover:<anime-uuid>` identity와 immutable `asset:<sha40>` revision을 분리하고, `CATALOG_MANAGED`·`EXPLICIT_PERMISSION` metadata를 가진 local Card 생성 계약을 추가했다.
- `[2026-09-03] 이전 안전 gate:` remote contract 구현 전에는 Account cover write를 차단했고 당시 composer에도 노출하지 않았다. 현재 gateway/RPC 계약과 명시적 선택 UI 구현 후 해당 임시 차단은 제거됐다.
- `[2026-09-03] 검증:` unit 201개, production build, React Doctor 90/100 통과. React Doctor의 2개 경고는 이번 domain 변경이 아닌 기존 변경 파일에 있다.
- `[2026-09-03] 승인:` 사용자가 Supabase `CATALOG_COVER` 비파괴 확장 migration과 RPC 동기화 변경을 명시 승인했다.
- `[2026-09-03] 구현:` durable cover revision registry, Memory asset normalized FK, mutation/conflict/promotion RPC wrapper, Supabase read gateway와 IndexedDB pull mapping을 추가했다. Account write 임시 차단은 제거했다.
- `[2026-09-03] 로컬 검증:` fresh local DB reset 성공, pgTAP 112/112, schema lint 0, unit 201/201, production build 13 pages 성공. 기존 user row 변환·삭제는 없다.
- `[2026-09-03] 일시 차단 후 해소:` 저장소 CLI가 project에 link되어 있지 않고 `SUPABASE_ACCESS_TOKEN`도 없어 hosted 적용을 중단했다. 사용자가 CLI 로그인한 뒤 canonical 대상 `okchpyagfucpzpyrfgol`을 재확인해 해소했다.
- `[2026-09-03] 원격 적용:` 사용자 CLI 로그인 후 계정의 두 project를 대조하고 `moemoa-preview (okchpyagfucpzpyrfgol)`에만 link했다. migration list·dry-run은 `20260903141500_catalog_cover_memory_assets.sql` 한 개만 pending임을 확인했고 해당 파일만 적용했다.
- `[2026-09-03] 원격 검증:` local/remote migration 8개 일치, hosted schema lint 0, public cover registry 3,998개와 active catalog asset 3,998개 일치. 기존 aggregate는 profile 1, device 2, Memory user-owned entity 0을 유지했다. anon의 `memory_visual_assets` SELECT는 `42501`로 거부됐다.
- `[2026-09-03] UI 구현:` 검색 결과와 catalog detail에서 승인된 cover revision을 선택할 수 있게 하고, 개인 감상 신호를 필수 gate로 적용했다. 카드에는 URL·bytes·object path를 저장하지 않고 immutable `catalogCoverRef`만 저장한다.
- `[2026-09-03] 읽기 구현:` Archive와 Memory Detail은 저장된 reference를 durable registry와 다시 대조한 뒤 표지를 `contain`으로 표시하고 `공식 표지` badge를 노출한다. registry 불일치·권리 metadata 불일치·불러오기 실패는 missing state로 처리한다.
- `[2026-09-03] UI 검증:` unit 202/202와 Memory Composer Playwright 18/18이 통과했다. 공식 표지 선택 → 감상문 gate → reference-only 저장 → Archive → Detail 경로를 포함한다.
- `[2026-09-03] Phase 3 시작:` local data migration 없이 기존 Library 저장 목록, active owner의 Complete Memory, catalog detail을 읽기 시점에 합치는 `TitleAlbumProjection`을 먼저 구현한다. 정적 Astro build와 Android document navigation을 보존하기 위해 canonical 초안 route는 `/title/?animeId=...`로 선택했다.
- `[2026-09-03] Phase 3 구현:` saved-only, memory-only, saved+memory, PrivateTitle, direct catalog browse를 하나의 read-time `TitleAlbumProjection`으로 합치고 `/title/?animeId=...` Title Hub를 추가했다. 작품 저장 상태와 Memory 목록은 별도 repository를 사용하며 저장 해제는 Memory를 변경하지 않는다.
- `[2026-09-03] Phase 3 동선:` 상단 통합 검색, 기존 Library 상세, catalog detail, Memory Detail에서 동일 Title Hub로 진입한다. 정확한 catalog ID가 확인된 작품만 같은 작품에 `기억 남기기`를 제공해 PrivateTitle 분리를 방지한다.
- `[2026-09-03] Phase 3 검증:` projection/navigation unit, Title Hub Chromium E2E 3개(저장 해제 독립성, composer deep-link, 320px overflow, 검색 진입), production build 14 pages를 통과했다. 브라우저 full-page 검토에서 desktop 정보 위계와 카드/metadata 배치를 확인했다. React Doctor는 86/100이며 5개 maintainability 경고는 기존 대형 Composer/Detail/QuickAction 계열 함수에 남아 있고 새 Title Hub에는 진단이 없다.
- `[2026-09-03] Phase 4 시작:` 기존 `/library/`와 쓰기 모델을 유지하고 신규 `/titles/`에서 같은 `TitleAlbumProjection`을 Poster/Memory 두 방식으로 표시한다. active catalog search row를 AniList ID 묶음으로 조회해 N회 제목 검색을 피하고, 작품당 Memory preview는 최대 3개만 resolve한다.
- `[2026-09-03] Phase 4 구현:` 신규 `/titles/`에서 저장 작품과 Complete Memory 연결 작품의 합집합을 Poster/Memory 두 보기로 제공한다. 제목·별칭 검색, 전체/저장됨/기억 있음/보는 중/완료 필터, 최근 기억/최근 저장/제목순 정렬을 같은 album 집합에 적용하며 마지막 보기 선택만 local preference로 저장한다.
- `[2026-09-03] Phase 4 데이터 경계:` Library와 Memory write model은 변경하지 않았다. active catalog row와 durable cover revision을 AniList ID 100개 단위 묶음으로 읽고, 작품당 Memory visual은 우선순위에 따라 최대 3개만 resolve한다. `/library/`와 Android packaged asset은 Phase 5·Web gate 전까지 유지한다.
- `[2026-09-03] Phase 4 검증:` unit 216/216, My Titles Chromium E2E 3/3, production build 15 pages, Web static route 확인을 통과했다. 320px와 desktop full-page 캡처를 직접 확인해 모바일 필터 줄바꿈과 PrivateTitle fallback을 보완했다. React Doctor는 86/100이며 새 Phase 4 코드 진단은 없고 기존 대형 Composer/Detail/QuickAction 계열 5개 maintainability 경고만 남는다.

## 16. 발견 사항과 계획 변경

- 실제 catalog cover ID는 이미지 checksum을 포함하므로 표지 교체 시 바뀐다. 카드가 참조할 영구 identity와 revision을 분리해야 한다.
- 구현 전 user schema는 `CATALOG_COVER`를 허용하지 않았으므로 local UI와 remote sync를 한 단계로 암묵 처리할 수 없었다. 현재는 additive migration과 RPC 계약을 먼저 적용한 뒤 UI를 노출했다.

## 17. 완료 보고

문서 동기화, local `CATALOG_COVER` domain slice, additive Supabase schema/RPC, local·hosted 검증, composer/archive/detail, Title projection·Title Hub와 My Titles Poster/Memory dual view까지 완료했다. Card는 표지 URL·bytes·object path나 local file reference를 복제하지 않고 stable identity와 immutable revision만 보존한다. 기존 user asset row는 보존했고, Phase 5에서 메뉴·검색·한영 문구와 기존 주소 호환을 구현·Web 검증했다. `/library/` 기본·작품 진입은 새 작품 화면으로 연결하며 시청 기록 편집은 호환 화면을 유지한다. Phase 6의 Home·화면 간 연결·첫 Memory 작성 후 보기 제안도 구현·로컬 Web 검증했다. 다음은 사람 Web 사용성 gate 뒤 Phase 7 Android 적용이다. 품질 점수는 Phase 6 시작과 같은 84/100이며 Phase 5 이전 기록 86과의 차이는 별도 확인 항목이다. 배포는 별도 승인 범위다.
