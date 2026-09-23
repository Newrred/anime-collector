# Phase 6 — Home와 화면 간 연결

날짜: 2026-09-07. 상태: **구현·로컬 Web 기능 검증 완료**. 전체 통합의 사람 사용성 gate와 Android 실기기 검증은 미완료다.

## 기준 문서와 실행 범위

`AGENTS.md`, `CODEX_START_HERE.md`, canonical `01`, 사용자 흐름 `02`, 변경 보고 규칙 `09`, `PLANS.md`, [UI 명세](../../superpowers/specs/2026-09-03-title-hub-dual-view-ui.md), [ExecPlan](../plans/2026-09-03-title-hub-dual-view.md), [구현 프레임](../plans/2026-09-03-title-hub-dual-view-implementation-frame.md)의 Phase 6를 코드와 대조했다. React Doctor 스킬을 적용했다.

첫 저장 안내는 **현재 소유자별·현재 기기에서 한 번** 제공하는 UI preference로 구현했다. 계정 간·기기 간 온보딩 동기화는 추가하지 않았다. 기존 마지막 보기 선택을 보존하며, 사용자가 안내 버튼을 누를 때만 MEMORY로 바꾼다. 안내 저장에 실패해도 이미 성공한 Memory 저장은 성공 상태를 유지한다.

## 변경 내용과 코드 근거

- `src/components/Home.jsx`, `home/ResurfacingCards.jsx`, `home/CharacterInsightSheet.jsx`: 홈 작품 요약·최근 기록·이어보기·재감상·캐릭터의 작품 연결이 Title Hub를 직접 가리킨다. 명시적인 빠른 기록 버튼은 기존 편집 경로를 유지한다. 최근 실제 Memory가 작품 요약보다 먼저 보이는 구조를 유지했다.
- `src/components/home/HomeMemoryOverview.jsx`, `src/features/memory/components/useHomeMemoryArchive.js`: 최근 Memory에 작품 문맥 링크를 추가했다. 공식 표지를 선택한 Memory는 승인 reference를 resolve하고 전체 이미지와 표지 badge를 표시한다. 홈의 실제 페이지 제목을 하나로 정리했다.
- `src/features/titles/domain/titleNavigation.js:26–37`, `src/features/titles/components/MemoryTitleLink.jsx`: Home·Memory Detail이 같은 작품 ID 변환을 공유한다. PrivateTitle·정확한 catalog ID·AniList binding을 구분하며, 다른 provider의 숫자를 AniList ID로 해석하지 않는다.
- `src/features/memory/components/MemoryCardDetail.jsx`: 공통 작품 링크를 사용한다. 기존 Board → Memory Detail 경로는 그대로 사용하며 같은 원본 Card에서 같은 Title Hub로 이동하는지 검증했다. Board membership의 대상은 계속 MemoryCard다.
- `src/features/memory/components/useMemoryCardComposer.js:262–301`, `src/features/titles/application/firstMemoryViewSuggestion.js:1–34`: 저장 성공 뒤 첫 Complete Card인지 확인해 안내를 기록한다. Draft·두 번째 저장·소유자 불일치·원본이 없어진 안내는 노출하지 않는다.
- `src/features/memory/components/ArchiveView.jsx`, `src/features/titles/components/FirstMemoryViewSuggestion.jsx`: Archive에 한 번만 안내를 보여준다. 닫거나 새로고침하면 반복하지 않으며, 명시적 선택 시 My Titles의 Memory View로 이동한다. Web 주소와 Android packaged 주소를 구분한다.
- `src/messages/en.js`, `ko.js`: 첫 저장 안내와 작품 문맥 링크를 번역했다. 영문 홈의 legacy WatchLog 영역은 Recent watch records로 표시한다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm run test:unit` | **221 passed**, 실패 0. 시작 시 218개 |
| `npm run build` | **15페이지 성공**. 기존 큰 bundle 경고 유지 |
| `verifyAndroidStaticRoutes()` | Web build의 **15개 정적 route 확인** |
| 기존 핵심 Chromium 흐름 | index 10, composer 18, Board 3개 통과 |
| 추가 Chromium 범위 | Title Hub 3, My Titles 3, UI readiness 17개 통과. 전용 시각 테스트 서버 조건 1개 skip |
| 최종 변경 대상 재검증 | Phase 6 신규 5개와 Home 공식 표지 확장 1개, **6/6 통과** |
| 번역 키·diff | homeMemory/memoryRoutes KO/EN key parity, `git diff --check` 통과 |
| React Doctor | **84/100 유지**. 시작 시점 대비 점수 하락 없음 |

브라우저 검증은 `npx playwright test ... --project=chromium --workers=1 --reporter=line`으로 범위를 나누어 실행했다. 마지막 실행은 `tests/title-cross-surface.spec.ts tests/memory-card-composer.spec.ts --grep 'first-Memory|Home and Board|approved official cover'`였다. 위 표의 일부 사례는 반복 실행되므로 실행 횟수를 더해 독립 테스트 수로 해석하지 않는다.

초기 새 테스트의 한국어 label을 실제 UI 문구로 정정했다. 페이지 제목 검사는 개발 도구의 숨겨진 shadow DOM을 제외하고 앱 범위로 좁혔다. Board 클릭 후 주소 검사는 화면 전환 완료를 기다리도록 고쳤다. 해당 실패를 수정한 최종 재실행은 모두 통과했다.

320px KO/EN 안내, 사용자의 POSTER 선택 보존, 안내 수락 후 MEMORY 선택, 닫기·재방문·두 번째 저장, native URL, Home → Detail 및 Board → Detail → 동일 Title Hub를 확인했다. 후자의 데이터는 탐색 전후 **Memory 1개·저장 작품 3개**를 유지했다. 별도 UI readiness 검증은 반응형 배치·200% 확대·명암·키보드 흐름을 포함한다.

스크린샷은 `D:/hong/Web/Anime/.moemoa-ui-audit-2026-09-07-phase6/screenshots/`의 `phase6-first-memory-{ko,en}-320.png`, `phase6-home-desktop.png`에 보존했다. 모바일 줄바꿈·버튼 배치와 홈의 Memory 우선순위를 직접 검토했다. 기존 golden 파일을 일괄 갱신하지 않았다.

React Doctor 최종 진단은 `C:/Users/hongs/AppData/Local/Temp/react-doctor-8eb5408c-9db8-4cf6-b643-278ca3f579e6/`에 있다. 기존 Composer 크기·복잡도, LibraryDetailModal·MemoryCardDetail 복잡도와 이번 diff 검사 범위에 들어온 기존 Home·CharacterInsightSheet의 복잡도 등 6개 경고가 남는다. 새 안내·공통 링크 모듈에는 진단이 없다. Phase 5 기록의 86→84 원인 확인은 별도 미해결 항목이다.

## 데이터·개인정보·복구

DB·Memory/Library 원본 schema·동기화 계약·의존성 변경, 운영 배포, 이미지 업로드·삭제는 없다. 추가된 `moemoa:titles:first-memory-view:v1:<ownerId>` 값은 pending Card ID 또는 seen 표시만 갖는 기기 UI preference다. 감상문·이미지·검색어를 기록하거나 새 analytics를 만들지 않는다. 보기 변경은 기존 `moemoa:titles:view:v1`을 사용한다. Save Title과 Create Memory의 독립성은 유지된다.

이전 작업을 보존한 text snapshot은 `D:/hong/Web/Anime/.moemoa-ui-audit-2026-09-07-phase6/`, 이번 application/test 변경 목록은 그 안의 `phase6-changed-files.txt`다. 롤백은 후속 수정을 확인한 뒤 이 작업의 diff만 복원하고 신규 세 모듈·테스트를 제거한다. 안내 preference는 남아 있어도 원본 데이터에 영향을 주지 않으며, 필요할 때 해당 prefix만 제거할 수 있다. 전체 worktree reset이나 원본 데이터 삭제는 필요 없다.

## 다음 단계와 남은 gate

다음은 Web의 사람 사용성 확인 후 **Phase 7 Android 적용·실기기 검증**이다. 특히 작품 저장과 기억 작성의 차이, 첫 안내 이해도, 작품별 기억 찾기, 두 번째 Memory 작성, Board 제거와 원본 보존을 확인해야 한다. 이번 native 검증은 Chromium에서 packaged URL을 확인한 것으로 Share Target·Photo Picker·실기기 검증을 대신하지 않는다. 운영 배포·Public·이미지 cloud·legacy 삭제는 이번 실행에 포함하지 않는다.
