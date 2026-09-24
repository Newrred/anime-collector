# W18 화면·행동 검증 지도

실행 결과는 [진행판](../release-v2/03_RELEASE_WORKBOARD.md)과 연결된 evidence를 따른다. 아래 목록은 route/action과 실제 테스트의 연결이며 표만으로 PASS를 선언하지 않는다. 실제 Google/hosted REST·Storage/Android 기기와 합성 브라우저 adapter는 구분한다.

| route | 제어 소스/주요 행동 | 정상·실패·취소·복귀 검사 |
|---|---|---|
| `/` | Home/HomeMemoryOverview, 기록 재발견·작성·검색 | index, review-improvements, title-navigation |
| `/titles/` | TitleCollection, 표지/기억 보기·필터·작품 이동 | title-collection, title-cross-surface |
| `/title/` | TitleHub, 작품 상태·기억·작성 | title-hub, source-independent-title |
| `/catalog/detail/` | catalog 상세·공식 표지 선택·기억 작성 | source-independent-title, title-cross-surface |
| `/library/` | Library/LibraryQuickLogSheet, 저장·시청 기록·모달 | library-userflow, release-editing, storage-hydration |
| `/tier/` | TierBoard, 등급 배치·저장 | storage-hydration, layout-mobile/desktop |
| `/memory/new/` | MemoryCardComposer, 제목/표지·사진/디자인·감상·저장 | memory-card-composer/discovery, release-editing, ui-readiness-functional |
| `/memory/card/` | MemoryCardDetail, 편집·이미지 복구/교체·삭제·전체 철회 | memory-card-composer, service-finishing, publication-ui, memory-owner-boundary |
| `/archive/` | MemoryArchive, 필터·정렬·열기·원래 위치 복귀 | memory-card-discovery, release-editing, ui-readiness-functional |
| `/boards/` | MemoryBoardView, 생성/이름·멤버십·공개 준비/게시/철회 | memory-board, publication-ui, release-editing |
| `/data/` | DataCenter/MemoryAccountPanel/MemoryBackupTools, 승격·sync·백업/복원 | memory-account-sync, memory-indexeddb, review-improvements, service-finishing |
| `/help/` | HelpCenter, 도움말·연락처·복사 | page-design-system, layout-mobile/desktop; 일반 공개 전 상태를 문구에 반영 |
| `/profile/` | ProfileCenter, 이전 프로필 경로 게이트 | service-finishing; 이전 mock minihome 편집 검사는 새 공개 서비스 증거 아님 |
| `/u/` | PublicProfilePage, 이전 공개 프로필 게이트 | service-finishing; legacy REST 호출 없음 확인 |
| `/auth/callback/` | AuthCallbackClient, 안전한 복귀·실패·재시도 | publication-ui, webOAuth/nativeOAuth unit, android-auth-static |
| `/minihome/` | MemoryMinihome/MemorySafety, 대표 보드·정렬·게시·관계·접수/이의 | publication-ui |
| `/public/board/` | PublicMemoryBoard, 익명 snapshot·복사·신고 | publication-ui, SQL publication/moderation |
| `/public/home/` | PublicMinihome/MemoryRelationships, 익명 전시·로그인·팔로우/차단 | publication-ui, SQL minihome/relationships |

공통 탐색·언어·테마·320/390/1440px·키보드·모달·설치 가능 여부는 index/layout/page-design-system/service-finishing/ui-readiness-functional에서 재사용한다. testMatch를 spec/setup으로 좁혀 Playwright 수집 중 Node unit/catalog 테스트가 별도로 실행되던 문제를 제거했다. Node suite는 각 전용 명령으로 검사한다.

## 발견 사항과 수정 근거

- 기존 홈 검사는 `Memory Archive`/최신 카드 한 장 UI를 기대했지만 실제 HomeMemoryOverview는 `Return to your memories`/Recent memories 재발견 구성이다. 변경된 제품 동작에 맞춰 저장한 카드·이미지·작성/Archive 이동을 계속 검증한다.
- 작성 진입 주소의 `returnTo`/`returnY`는 복귀 기능이다. 쿼리를 금지하던 검사를 pathname과 정확한 내부 returnTo 검증으로 교체했다.
- 시스템 디자인에는 외부 이미지 권리 확인 단계가 없다. 해당 단계가 있다고 가정한 320px 검사를 바로잡고 부재를 명시 검증한다. 사용자 이미지의 명시 권리 동의 검사는 그대로 유지한다.
- 이미지 선택기 처리 중에는 현재 dirty/busy 경계가 이탈을 차단한다. 이전의 "선택 중 이탈" 기대를 제거하고 deferred picker로 실제 이탈 차단·중복 클릭 1회·반환 ticket 취소 실패·재시작 후 정리 재시도를 검증한다. 컴포넌트 unmount의 모든 native callback 상황까지 이 테스트로 증명하지 않는다.
- desktop composer의 12px와 mobile의 16px 모서리를 구분해 검사한다. IDB의 시청 기록만 있는 기존 사용자 홈은 재발견 제목을 표시해도 Memory 카드가 0개임을 검증하며, watch log가 메모리로 변환됐다고 간주하지 않는다.
- Library 캐릭터 선택이 state updater 안에서 다른 state를 변경하던 실제 순수성 문제를 클릭 처리 단계로 옮겼다. 처음 선택 시 `Number(null)=0`을 대표 캐릭터로 취급하던 경우도 막았다. 별도 브라우저 검사로 대표 1명 유지/해제 후 다음 선택자 전환을 검증한다.
- useModalInteraction/useUnsavedNavigation의 이벤트용 ref는 render 중 수정 대신 commit의 layout effect에서 갱신한다. 미완료 render의 옵션이 이벤트 처리에 섞이는 것을 방지하며 모달·dirty·계정 전환 검사로 회귀를 확인한다.

## 이전 정적 분석 진단 분류

W11 React Doctor 21 errors/131 warnings 출력은 출발점이며 이번 코드의 점수로 재사용하지 않는다. 규칙을 끄거나 경고 전체를 해결한 것으로 표시하지 않는다.

| 진단 | 소스 확인 결과/처리 |
|---|---|
| Library state updater side effect 1 | 위 실제 수정과 캐릭터 선택 회귀 검사 |
| MemoryBackupTools side effect 4 | `run(async action)` 이벤트 helper이며 React setState updater가 아님. helper는 lock 후 실행/finally 해제. 백업/취소/원자 복원 실제 브라우저 검사 재사용 |
| render ref mutation 2 | 두 hook을 commit 시점 갱신으로 수정 |
| Memory schema RLS 11 | schema 생성 다음 migration에서 RLS/권한 부여. 전체 순서 적용과 실제 역할 SQL 검사로 확인; 생성 파일 하나만 본 진단 |
| image-contract permissive policy 1 | 의도적으로 허용 정책을 추가해 restrictive Storage 정책이 우회를 막는지 확인하는 격리 fixture |
| showcase client authz field 1 | legacy 코드가 존재하지만 현재 availability gate와 W15 DB client grant 회수로 닫음. 실제 원격 옛 grant/미등록 RPC 감사는 D01 |
| dependency supply-chain score 1 | 점수 자체를 실제 취약점으로 단정하지 않음. 의존성을 임의 교체하지 않았으며 공급망/보안 advisory 최신 검토는 별도 후보 게이트 |

남은 style/complexity 경고를 고치기 위한 광범위 UI 재작성은 하지 않는다. 실제 Android 키보드/back/화면 안전 영역·200% 확대 전체 화면·스크린리더·실운영자 이해 검증을 이 로컬 지도만으로 완료 처리하지 않는다.
