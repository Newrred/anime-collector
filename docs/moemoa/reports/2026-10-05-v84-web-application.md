# V8.4 실제 Web 디자인 적용 — 2026-10-05

> 최신 결과는 하단 **22차: 카드별 분류와 기억 상세** 절이다(10/5 착수, 10/6 마감). 20·21차의 과거 PASS와 이번 실행을 구분한다.

사용자 “시안에 전체적인 큰 틀의 디자인은 나온 것 같으니, 이제 실 서비스 디자인 적용 작업 진행해줘”에 따른 **로컬 서비스 코드 적용 및 실제 브라우저 검증 결과**다. `codex/phone-test`, 기준 HEAD `54c39cb` 이후 working tree 변경이며 아직 커밋·push·운영 배포하지 않았다. 기존 release-v2 진행판이나 W/D/Q의 hosted PASS를 변경하지 않았다.

## 읽은 문서와 실제 코드

AGENTS.md → CODEX_START_HERE.md → 최상위 결정01, 제품02, Title Hub/dual-view UI 명세, QA07, 구조06, 감사03, 변경통제09, PLANS.md와 기존 `plans/2026-10-03-interface-rebuild.md`를 확인했다. `verify-before-claiming` skill에 따라 실제 `src` 실행과 캡처를 확인했다. V8.4의 CSS/템플릿/상세·분류 시안과 기존 title collection projection/service, WatchLog 저장소, Memory runtime/owner shell, 상세 편집·삭제·교체 handler를 대조했다.

새 계획이나 진행판은 만들지 않았다. 승인 결정은 `V84-WEB-APPLICATION-01`(01:646–653), 실행은 기존 interface-rebuild **20차**(421행 이후)다.

## 적용 범위와 변경 파일

| 화면/목적 | 실제 변경과 근거 |
| --- | --- |
| 공통 흰 배경·핑크·작은 버튼·얇은 선 | `src/styles/channel-service.css:1–201`, `src/layouts/BaseLayout.astro:1–50`. 기존 CSS 위에 명시적으로 적용한다. 신규 의존성 없음. |
| 로고와 메뉴 | `src/components/TopNavDataMenu.jsx`, `PrimaryNavigationLinks.jsx`, `public/brand/moemoa-film.png`. 자체 기존 필름 로고2안을 사용한다. 내 책장/작품/기억과 공통 기억 남기기 하나, Board는 메뉴와 책장 링크로 접근한다. |
| 기본 테마 | `src/domain/uiPreferences.js:19–31`. 새로운 저장소의 기본값은 light, 저장된 dark/light 선택은 유지. 관련 unit assertion 갱신. |
| 공통 정보·탐색 영역 | `src/components/collection/ChannelHeader.jsx:1–19`. PC는 정보·탐색·보기, 기억 화면은 우측 태그/캐릭터까지 추가. 모바일은 펼침 버튼, 키보드·aria 상태 제공. |
| 실제 내 책장 | `src/pages/index.astro`, `src/features/bookshelf/BookshelfView.jsx:1–69`, `bookshelfSettings.js:1–18`. 기존 Title collection read service를 재사용한다. 선반 추가·이름·진열 선택·적용/취소·기기 내 재로드, 합집합/선반 선택, 해당 행 아래 필름 하나, 제목→Title Hub, 필름→기억 상세가 연결된다. 초기 자동 펼침 없음. |
| 계정 경계 | `MemoryRouteShell.jsx:18–49`의 기존 owner readiness/keyed remount를 유지하며 UI context에 owner key만 추가한다. 진열 설정은 owner별 localStorage key. 원본/Memory/Board의 소유자 모델 변경 없음. |
| 작품 | `TitleCollectionView.jsx:53–74,160행 이후`, `TitleAlbumCard.jsx`, `TitlePosterTile.jsx`, `TitleViewModeControl.jsx`. 기존 저장 상태·8상태 필터·장르·정렬·열 수·두 보기를 유지하고 중복 필터 영역을 정리했다. 공용 작품 카드의 CSS를 직접 연결해 책장에서 재사용해도 정상 크기로 표시한다. |
| 기억 분류·원본 비율 | `ArchiveView.jsx:54–176`, `application/archiveFacets.js:1–18`, `components/collection/useCollectionMasonry.js:1–29`. 실제 WatchLog와 같은 ANILIST source binding에만 연결한다. 태그/캐릭터/감정은 같은 characterRef에서 조건을 모두 만족해야 한다. 검색·표/그리드·상세 왕복 필터 상태는 URL에 보존한다. |
| 이미지 상세 | `MemoryCardDetail.jsx:215–310`, `AddMemoryToBoard.jsx:1–30`, 공통 CSS:124–150. 좌측 큰 이미지/우측 좁은 정보·감상·행동, 모바일 세로 배치. 실제 기록일/이미지 종류·연결 Board 표시. 이미지 교체는 펼침 안에 배치하되 이미지가 없는 복구 상황에서는 처음부터 열린다. 편집/미저장/삭제/교체/공개 handler 유지. |
| 회귀 검증 | `tests/channel-service.spec.ts`, `tests/unit/channelService.test.mjs`, `tests/unit/uiPreferences.test.mjs`, 기존 layout-mobile/composer/title-collection/title-cross-surface 검사를 새 실제 UI에 맞춰 갱신했다. 기존 저장·취소·권리·원본 보존 assertion은 유지했다. |
| 문서·증거 | 최상위 결정, 기존 ExecPlan20차, CODEX_START_HERE, 기존10/5 인계의 최신 요약, 이 보고서와 `design/evidence/v84-service-2026-10-05/`. 이전 시안 실행 로그 보존. |

기존 `design/ui-kit-v8.1`, `ui-kit-v8.2`, `bookshelf-detail-v8.3`, `channel-study-v8.4`의 작업 중 파일은 보존했다. 시안 사진을 실제 사용자 데이터로 복사하지 않았다.

## 가정·제품 경계·남은 조건

- 책장은 **선별 진열**이다. 기본 빈 선반에서 사용자가 책장 꾸미기로 고른 작품만 보여 준다. 선반 설정은 이 기기와 소유자에 귀속되며 서버 sync/schema는 추가하지 않았다.
- 실제 service projection의 필름은 최대3개 preview와 전체 기억의 Title Hub 링크를 제공한다. 시안 RAM의 가상 이미지·무한 추가·댓글 등을 새 제품 기능으로 만들지 않았다.
- 캐릭터/태그는 **작품의 기존 감상 기록 기준**이다. 이미지 속 캐릭터 자동 판단이나 Memory별 직접 태그 연결이 아니다. 정확한 외부 작품 연결이 없는 개인 작품은 임의로 이름을 비교해 분류하지 않는다.
- 운영 DB/OAuth/다른 기기의 실제 계정 및 이미지 sync, 실물 iPhone/Android, Safari/Firefox의 이번 변경은 검증하지 않았다. Android 빌드·출시 작업 제외를 유지한다.
- 서비스 전체의 출시 완료가 아니다. 별도 화면들의 상세 재설계와 공개/운영 출시 게이트는 기존 release-v2에 남는다. 공통 토큰은 기존 화면에도 적용된다.

## 이번에 실행한 검증

환경: Windows, Node24.19.0/npm11.17.0, 로컬 Astro 실제 서비스, Chromium, 외부 HTTPS는 새 시나리오에서 차단. 합성 기록과 합성 PNG를 격리된 테스트 브라우저에만 생성했다. 제품 브라우저에 fixture를 넣지 않았다.

```powershell
. .\.cache\activate.ps1
npm run test:unit
npm run build

$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4362'
$env:PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1='1'
$env:MOEMOA_VISUAL_TEST='1'
node scripts/run-e2e.mjs tests/channel-service.spec.ts tests/memory-card-composer.spec.ts tests/title-collection.spec.ts tests/title-cross-surface.spec.ts tests/memory-board.spec.ts tests/memory-owner-boundary.spec.ts tests/web-image-intake.spec.ts tests/title-hub.spec.ts tests/layout-mobile.spec.ts --project=chromium --workers=1
node scripts/run-e2e.mjs tests/channel-service.spec.ts --project=chromium --workers=1
git diff --check
```

| 실행 | 결과 / 범위 |
| --- | --- |
| unit | **410 PASS, 0 fail/skip**. 새 설정의 owner 격리·길이/개수 제한·저장 실패, 정확한 작품 연결과 동일 characterRef 교집합 포함. |
| build | **19 routes PASS**. 기존 공통 메뉴 bundle 약1,021kB/minified, gzip370kB의500kB 초과 경고는 남는다. 기능 실패는 아니지만 용량 최적화 후속 대상이다. |
| 실제 Chromium 회귀 | **51 PASS, 0 skip**. 새 UI5건 + 기존 composer/권리·교체/원본·삭제/Board/owner/Title Hub/모바일 검증. 로그 `.cache/channel-final3.log`. |
| 실제 테마 버튼 추가 확인 | 동일 새5건 **재검사 PASS**. 51+5를56개 고유 테스트로 합산하지 않는다. 실제 theme 버튼→dark 후 작품 이동 링크 배경 rgb(36,36,36)/글자 rgb(237,237,237) 확인. 로그 `.cache/channel-dark-final.log`. |
| 차이 검사 | `git diff --check` 오류0. LF/CRLF 안내만 존재. |

이번에 새로 통과한 사용자 행동:

1. 실제 Memory7개/작품6개에서 선반 진열 적용→재로드. 이름/선택 변경 **취소**→재로드 시 이전 설정 유지. 원본 기록 개수 불변.
2. 선택한 표지 행 아래 전체 폭 필름→같은 Memory 상세→감상 변경 저장/재로드→실제 연결 Board→정확한 Title Hub의 기억2개. 제목/Memory identity 보존.
3. 책장 편집 중 새 작품 저장 알림→새 작품이 재로드 없이 진열 선택에 추가.
4. 기존 태그/캐릭터가 불일치하면0개, 해제7개, 일치2개; 상세에서 돌아오면 필터 복원, 표에서도 같은2개.
5. 실제 파일 선택기로 만든 가로900×450/세로400×600 PNG→로컬 저장/재로드→1440/390/320 원본 비율 유지, 가로 넘침0, 이미지 업로드 요청0. PC 상세/320 상세·dark 테마 캡처.
6. 320px 탐색 펼침·키보드 보기 전환, 공통 기억 남기기1개, 로고 상단 잘림 없음.

## 발견·수정 및 실패 기록

초기 회귀 실패는 이전 Home/필터 DOM assertion, 공식 표지 alt 이름, 접힌 이미지 관리 영역과 검사 timing을 새 명시적 UI에 맞춰 고쳤다. 실제로 발견한 책장의 과대 이미지/필름은 공유 Title 카드의 stylesheet 누락을 연결해 수정했다. 책장 편집 중 최신 작품 반영도 library-updated listener와 stale response 방지로 보완했다.

중간50개 회차는47 PASS/3 fail: 모바일 header 로딩 전 펼침 확인, 공식 표지 alt assertion, 검사 중 stylesheet 변경으로 생긴 파일 선택 흐름 reload였다. 다음 회차에서 build와 dev 검사를 동시에 실행하자 빈 화면 로딩이 나타나 검사를 중단했다. 새 서버에서 build 종료 후 순차 실행한 최종51개는 모두 통과했다. 중단 회차를 PASS로 기록하지 않는다.

처음 dark 캡처는 DOM 테마 강제 변경 직후 버튼 색상 transition 중 촬영하여 밝은 배경과 밝은 글자가 겹쳤다. 실제 사용자 theme 버튼으로 전환하고 스타일이 안정된 뒤 검사·재캡처했다. 이 부분은 **추가 CSS 수정 없이 실제 전환을 확인한 것**이다.

## 캡처와 검증 한계

`design/evidence/v84-service-2026-10-05/`의10개 PNG는 **실제 src/runtime에서 실행한 합성 데이터 화면**이다. 시안 렌더링이나 개인 사진이 아니다. 책장/기억1280, 실제 이미지 목록1440/390/320, 상세1280/1440/320/dark, 작품320을 보존했다. main이 책장·목록·상세 PC/모바일·dark 캡처를 직접 열어 검토했다. 모바일 viewport 에뮬레이션을 실물폰 PASS로 승격하지 않는다.

## DB·롤백·보안·관측

DB migration/data release/운영 키·flags/유료 변경/의존성 설치 없음. 원본 이미지, 기존 Memory/WatchLog/Title/Board 데이터 수정 schema 없음. 책장 설정의 명시적 Apply만 새 로컬 쓰기다. 저장 실패 때 성공 표시하지 않는다. 계정 경계는 기존 shell/runtime을 재사용하고 설정은 owner key로 분리한다. 비공개 이미지는 기존 안전한 preview 경로로 표시하며 자동 업로드·공개 전환은 추가하지 않았다. 개인 선반 이름·감상·검색·이미지 bytes를 analytics/일반 로그에 추가하지 않았다. 공개 권리·신고/차단/관리자·kill switch 계약 변경 없음.

롤백은 이번 presentation/import/로컬 설정 reader를 이전 코드로 복구한다. 새 선반 설정은 무시할 수 있으며 원본이나 legacy 데이터를 강제 삭제할 필요가 없다. 운영에 적용하지 않아 운영 DB 복구 작업도 필요 없다.

로컬 실제 서비스는 `http://127.0.0.1:4363/`에 실행했다. `node node_modules/astro/astro.js dev --host 127.0.0.1 --port 4363 --strictPort`로 시작했고 별도 Chromium smoke에서 실제 My bookshelf/light/가로 넘침0/pageerror0을 확인했다. 환경변수 Web image intake만 로컬1, 공개/원격 환경 설정 변경 없음. 새 origin에 기존 기록이 없으면 빈 책장이 정상이며 사용자 브라우저에 테스트 기록을 주입하지 않았다. Codex 패널 열기는 `queued` 결과여서 사용자 화면에 표시됐다고 주장하지 않는다.

현재 외부 차단 없음. 다음 작업1개는 **이 실제 Web 화면을 사용자의 기록으로 확인해 미감·동작 검토**하는 것이다. 검토 후 정확한 Git 후보로 커밋/배포할 때 사용자 승인과 기존 D06 추적 절차를 따른다.
# 21차 후속 — 실제 Web 디테일·표지 확인

이 절이 10/5 후속의 최신 결과다. 위20차의51 PASS·원격 미연결 상태·10개 캡처는 당시 실행 근거로 보존한다. 이번 실제 카탈로그 읽기와 디테일 검증을 과거 결과에 소급하지 않는다.

## 읽은 문서·가정·기존 계획

`AGENTS.md` → `CODEX_START_HERE.md` → `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` 순서와 제품02, Title Hub dual-view 명세/계획, QA07, 카탈로그04의 읽기·표지 권리 계약, `PLANS.md`, 기존 interface-rebuild의20차 실행 근거를 확인했다. 수정 전에 **같은 ExecPlan의21차**를 추가했다. 새 출시 계획·진행판·W/D/Q 번호는 만들지 않았다.

사용자 요청은 첨부5장에 보이는 로고 배경·선택 메뉴·검색 입력·적은 이미지의 배치를 실제 앱에 적용하고 실제 애니 표지로 확인하는 것이다. 로컬 앱 코드/검증/카탈로그 익명 읽기 범위로 진행했다. 운영 배포·DB 변경·Public 활성화는 이번 실행에 포함하지 않는다. 미감 최종 판단과 실물폰 검증은 남는다.

## 변경 파일과 원인

| 실제 제어 파일 / 근거 | 변경 이유와 결과 |
| --- | --- |
| `src/components/collection/CollectionSelect.jsx:6–58`, `collection-select.css:1–14` | native blue OS 메뉴를 얇은 테마 trigger/listbox로 교체. Arrow/Home/End/Enter·Space/Escape/Tab/typeahead, 바깥 클릭, 선택값과 미확정 탐색 분리. viewport에 위치/높이를 제한하고 모바일44px 항목을 적용한다. |
| `src/features/memory/components/ArchiveView.jsx:7,111`, `src/features/titles/components/TitleCollectionView.jsx:16,174`, `src/components/search/QuickActionPanel.jsx:3,215–219` | 기억/작품 정렬과 검색의 기본 추가 상태3곳에 같은 메뉴를 연결. 기존 onChange·정렬 URL·상태 저장 함수를 재사용한다. 작품 정렬은 기존대로 화면 state이며 재로드 영속화를 새 기능으로 추가하지 않았다. |
| `src/hooks/useModalInteraction.js:33–39`, `src/components/search/TopNavGlobalSearch.jsx:201–205` | 목록이 열린 첫 Escape를 목록에 넘기고 다음 Escape가 모달을 닫게 한다. 모바일 portal은 해당dialog 내부로 넣고 포커스는 trigger에 유지한다. 기존 PC 검색의 닫기→input focus→즉시 재열림을 발견해 focus 후닫기 순서로 최소 수정했다. |
| `src/styles/channel-service.css:24,60–63,101–113,196–198` | `.nav a:hover`의 둥근 회색 배경을 brand에서 제거. 검색 초점은2px 핑크 밑줄로 표시. 필름은 최대300px의 일정한 슬롯을 왼쪽부터 놓으며 원본 이미지는 contain/left center. 작은 작품 표지의 글자 줄바꿈도 정리한다. |
| `src/features/titles/components/TitleAlbumCard.jsx:37`, `src/features/bookshelf/BookshelfView.jsx:49` | 이미지 개수에 따라 전체폭으로 늘어나던 inline grid 제거. 책장 검색에 실제 placeholder 추가. |
| `tests/channel-controls.spec.ts`, `tests/channel-service.spec.ts` | 실제 메뉴 조작/키보드 취소·닫기/상태 보존/모달 안 포커스와 hit test/테마/1440·390·320, 필름1·2개 왼쪽 및390px 회귀. |
| `tests/release-editing.spec.ts`, `tests/library-userflow.spec.ts` | native select 조작을 새 역할로 대체하고 과거 Home CTA·계정 문구 assertion을 현행 실제 UI에 대조해 갱신. 저장·취소·0 Memory 경계 검사는 유지한다. |
| 기존 계획/이 보고/시작문서/10/5 인계/증거 README | 현행 요약만 갱신하고20차 로그와 기존10개 캡처는 보존. 새 합성 증거7개 추가. |

## 실제 표지 확인과 로컬 선택

기존4363 서버에 catalog public URL/익명 키가 빠져 있었다. 기존 `.env.production`에서 **전용 public catalog 읽기 설정2개만** 선택해 동일 loopback origin에 연결했다. 재시작 뒤에도 보이도록 기존 다른 값을 보존하며 Git ignored `.env.local`에 해당2개만 저장했다. `git check-ignore`로 제외를 확인했고 원문을 출력하지 않았다. service-role/사용자 sync 키·Public flags를 가져오지 않았다. 카탈로그 조회와 표지 권리·revision·identity 검사는 현행 repository 그대로다.

별도 disposable Chromium에서 실제 Title Hub→Save Title5회→책장 선반 선택→Apply를 실행했다. source/data/표지 bytes를 테스트 fixture로 대체하지 않았다. 기존 익명 catalog의 실제 표지5개 모두 naturalWidth460으로 로드됐으며 height는 프리렌649/진격의 거인636/목소리의 형태651/너의 이름은690/Steins;Gate667이었다. 작품 목록과책장1440/390/320에서 이미지 로드/가로 넘침0/JS 오류0을 확인했다. Save Title만으로 Memory가 생기지 않아 최종 Memory0이었다.

사용자가 열어 둔 IAB의 해당 origin에도 작품 목록0을 먼저 확인하고 같은 실제 UI로 위5작품을 선택해 **‘디자인 확인’ 선반**에 Apply했다. 기존 기록을 지우거나 가짜 Memory/이미지를 주입하지 않았다. 화면의진열5/기억0,5개 이미지 로드와 실제 Title Hub 연결을 확인하고 책장 탭을 남겼다. 이5개는 그 브라우저/기기의 로컬 작품 선택이며 운영 계정이나 원격 DB를 수정한 기록이 아니다.

실제 표지가 포함된5장(`catalog-titles-1440`, `catalog-sort-1440`, `catalog-bookshelf-1440/390/320`)과 공개 작품 ID/크기만 담은 JSON은 **`.cache/v84-service/`의 로컬 검토 자료**다. 실표지 캡처를 Git에 추가하지 않았다. 별도 공개 이미지·원본 업로드·ingestion·권리 승격은 없다.

## 실제 명령·결과·실패 구분

```powershell
. .\.cache\activate.ps1
npm run test:unit
npm run build

$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4365'
$env:PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1='1'
$env:MOEMOA_VISUAL_TEST='1'
node scripts/run-e2e.mjs tests/channel-controls.spec.ts tests/channel-service.spec.ts tests/release-editing.spec.ts tests/title-collection.spec.ts tests/title-cross-surface.spec.ts tests/title-hub.spec.ts tests/memory-card-composer.spec.ts tests/library-userflow.spec.ts --project=chromium --workers=1 --reporter=line
node scripts/run-e2e.mjs tests/library-userflow.spec.ts --grep 'Library UX fixture flow' --project=chromium --workers=1 --reporter=line

node .cache/v84-catalog-preview.mjs
node .cache/configure-v84-local-catalog.mjs
git check-ignore .env.local .cache/configure-v84-local-catalog.mjs .cache/v84-catalog-preview.mjs
node .cache/verify-v84-real-catalog.mjs
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:4363'
node scripts/run-e2e.mjs tests/channel-controls.spec.ts tests/channel-service.spec.ts --project=chromium --workers=1 --reporter=line
git diff --check
```

| 검증 | 실제 결과 / 해석 |
| --- | --- |
| 단위 | **410 PASS**, fail/skip0. |
| 최종 source build | **19 routes PASS**. 기존 큰 메뉴 bundle 경고는 약1,024kB/minified·371kB gzip으로 남는다. |
| 넓은 회귀65 collected | 첫 회차58 PASS/5 fail/2 live skip. 실제 PC Escape 버그1, 새 테스트의 기존 작품정렬 영속화 가정1, 과거 Nav/CTA assertion3을 대조했다. source를 최소 수정하고 테스트를 현행 계약에 맞췄다. |
| source 수정 후 회귀 | **61 PASS/2 fail/2 live skip**, 로그 `.cache/channel-details-final.log`. 남은2건은 이전 계정 문구 assertion이었다. actual LOCAL_ONLY·로컬 저장 표시·disabled Google 진입을 유지하는 검사로 보정한 뒤 해당2 flow **2 PASS**, `.cache/channel-search-final.log`. 한영 검색6회·작품6개·감상3회 저장·0 Memory 경계가 PC/모바일에서 통과했다. |
| 마지막 테마/320/필름 보강 | 기존4363에서 **11 PASS**, `.cache/channel-details-themes.log`. 이전10개 재검사+신규320 메뉴1건이다. 이번 고유 Chromium 통과는 **64개**이며61+2+11을74개로 합산하지 않는다. 과거20차51 PASS와도 합산하지 않는다. |
| 실카탈로그 | actual Title Hub/Save Title/선반과5표지 로드/3폭 넘침0/Memory0/pageerror0 **PASS**. JSON `.cache/v84-service/catalog-evidence.json`. 모든 HTTPS nonGET을 차단한 격리 검사에서 Supabase nonGET 요청0이었다. |
| 직접 사용자 화면 | IAB4363의 실제 UI를 통한5작품/선반 Apply,5표지 로드와진열5/Memory0 확인. API로 사용자 localStorage를 직접 주입하지 않았다. |
| 차이 | `git diff --check` 오류0, CRLF 안내만 존재. |

카탈로그 helper의 첫 실행은 이미지/배치 검사 후 **‘모든 POST=원격쓰기’라는 잘못된 assertion**에서 실패했다. 요청의 host/path를 확인하면 차단된 호출은 `graphql.anilist.co/`의 기존 읽기 POST였고, 원격 쓰기 완료는 없었다. Supabase nonGET/완료한 nonGET과 차단된 provider 읽기를 구분해 helper를 정정한 재검사에서21개 GraphQL 읽기 POST 차단/Supabase nonGET0/완료 nonGET0을 기록했다. 이 실패를 제품 DB 쓰기 실패나 PASS로 소급하지 않는다. 사용자 화면은 실제 카탈로그 연결을 사용하며 이 격리 검사처럼 외부 읽기를 차단하지 않는다.

현재 새로 통과한 사용자 행동은 **정렬 키보드 확정/취소·URL 복귀, 기본 추가 상태 선택 후 검색창 유지·재로드 복원, 첫/다음 Escape 분리와포커스, 테마 메뉴,1·2개 기억 좌측 배치, 실제 작품5개 선택→선반 진열**이다. 제공받은 과거 hosted 공개/A·B PASS를 이번 UI PASS로 재사용하지 않았다.

## 보안·DB·롤백·잔여

DB/data migration/data release/운영 flag·키 설정/유료 변경/새 의존성/commit·push·배포 없음. Public·rights·moderation·원본/operationId/quota 계약은 바꾸지 않았다. 사용자 감상·사진 bytes·private Board 이름·검색을 새 분석/일반 로그로 보내지 않는다. public catalog 키 원문을 소스/보고/증거에 저장하지 않았다. 추가 로컬 쓰기는 명시적 UI의 작품 선택5개와선반 Apply이며 Memory/WatchLog를 자동 생성하지 않는다.

롤백은 새 select import/공용 메뉴/관련 CSS와PC Escape 순서를 이전 코드로 복원하고4363의 catalog 환경 연결 및 `.env.local`의 추가2설정만 제거한다. local sample 작품 선택과‘디자인 확인’ 선반은 기존 UI의 저장 해제/선반 편집으로 취소할 수 있다. 원본·legacy·운영 DB를 삭제할 이유가 없다.

현재 외부 차단 없음. 실물 iPhone/Android·Safari/Firefox/화면낭독기/hosted user sync와공개 게시 흐름은 이번 실행에서 검증하지 않았다. 기존 release-v2 W/D/Q 미완료를 가짜 PASS로 채우지 않는다. 다음1개는 **실제 표지가 채워진4363 화면에서 미감 검토**이며, 운영 반영은 D06의정확한 Git 후보 승인과master/Vercel 동일 SHA 확인으로 이어간다. 로컬 변경을 운영 출시 완료로 보고하지 않는다.

# 22차 후속 — 카드별 분류와 기억 상세

10/5 착수, 10/6 00시 마감. 사용자는 **카드별 캐릭터·커스텀 태그의 로컬 저장·검증 및 동기화 후보 준비**를 승인했다. 실제 화면을 정리하고 로컬 흐름을 검증했다. 아래 수치는 이번 실행이며 앞선20·21차와 합산하지 않는다.

## 읽은 문서·가정·계획

AGENTS, CODEX_START_HERE, 최상위 결정01, 제품02, Title Hub dual-view 명세/계획, UGC05, 구조06, QA07, 감사03, 변경통제09, PLANS와 기존 interface-rebuild를 확인했다. verify-before-claiming에 따라 실제 서비스 src/runtime과 브라우저를 검사했다. 계획은 **기존 interface-rebuild 22차**이며, CARD-CLASSIFICATION-01 승인 후 같은 절에 데이터·migration·롤백 범위를 보완했다. 새 계획 트리나 진행판을 만들지 않았다.

작품 장르와 WatchLog의 기존 분류는 유지하고 카드 이미지의 캐릭터를 사용자가 선택한다. 자동 이미지 분석은 없다. 원격 schema를 승인 없이 바꾸지 않으므로 현재 태그는 이 기기에 저장되고 UI에 이를 표시한다. TAG-01 전체 taxonomy, 실물폰, 새 태그의 hosted 동기화·운영 적용은 이번 완료 조건이 아니다.

## 변경 파일과 이유

| 파일/행 근거 | 변경 |
| --- | --- |
| `MemoryCardDetail.jsx:64–130,272–316`, `MemoryClassificationEditor.jsx:1–27`, `MemorySharingSettings.jsx:1–19`, `memory-card-detail.css:46–65` (모두 `src/features/memory/components/`) | 감상/분류 우선, 관리 도구 접기, 원본 비공개와 공개 사본 경로 구분. typed tag의 Save/실패/취소 보호, 작은 태그 칩과 입력/버튼 폭. 기존 이미지 preview와 교체 handler는 유지. |
| `src/features/memory/components/AddMemoryToBoard.jsx` | 저장 중 Board 편집 잠금; 기존 N:M 연결/만들기 유지. |
| `src/features/memory/domain/cardClassification.js:1–31` | 분류 version1, 길이·개수·출처/ID 검증, 중복 제거, 이미지/추가 필드 미보관. |
| `src/features/memory/application/updateMemoryCard.js:15–65`, `adapters/indexeddb/IndexedDbMemoryRepository.js:476–506` | 명시된 note/분류만 atomic 저장. 기존 note를 분류 단독 저장으로 비우지 않으며 owner 경계와 기존 outbox 재사용. |
| `src/features/memory/application/archiveFacets.js:1–26`, `components/ArchiveView.jsx:57–75,111–126` | Memory별 태그/캐릭터를 정확히 해당 카드에 적용, 기존 작품 감상 분류와 교집합. URL·검색·표 보기·재로드 유지. |
| `src/features/titles/application/titleCharacters.js:1–37`, `components/TitleCharacters.jsx:1–44`, `components/title-characters.css`, `components/TitleHub.jsx:116–120` | exact title catalog/AniList binding으로 실제 캐릭터 읽기·출처·실패/재시도·페이지. 처음6개 표시/더 보기, 오래된 추가 페이지 응답 무시. |
| `src/features/memory/sync/memorySyncContract.js:112–147`, `adapters/supabase/SupabaseMemoryGateway.js:200–202,258–259,362–388`, `adapters/indexeddb/memorySyncStore.js:208–209` | 새 flag off에서는 구서버 요청/SELECT 유지. 지원 시 분류 DTO/읽기 검증, 구응답·미전송 로컬 분류 보존. |
| `src/features/memory/application/memoryBackup.js:45–51`, `application/deleteMemoryCard.js:20–21` | metadata 백업 복원에 분류·원래 카드 참조 유지, malformed 분류 거부. 삭제 분류 scrub. 이미지 bytes 포함하지 않는 기존 백업 범위 유지. |
| `supabase/migrations/20261005090000_memory_card_classification.sql:1–92`, `tools/card-classification/`, `.gitattributes` | private additive column/default/constraint와 기존 mutation·conflict·promotion RPC transaction wrapper 후보, 임시 로컬 DB 검사. 셸의 LF 보존. |
| `tests/memory-classification.spec.ts`, `tests/unit/cardClassification.test.mjs`, `tests/unit/channelService.test.mjs`, `tests/unit/supabaseMemoryGateway.test.mjs` | 같은 작품의 카드 분리·저장/실패/복원/구서버·새 SELECT와 rollout outbox 경계 검증. |
| 현재 결정/이 보고/기존 계획/시작/인계/단일 작업판의 좁은 요약/증거 README | CARD-CLASSIFICATION 승인과 이번 결과·한계만 갱신. 과거 실행 근거·기존 W/D/Q 유지. |

## 실제 명령·결과

Node24.19.0/npm11.17.0은 기존 `.cache/activate.ps1`로 활성화했다. production dependency 설치/업그레이드 없음.

```powershell
. .\.cache\activate.ps1
npm run test:unit
node .cache/v84-service/run-detail-regression.mjs
node .cache/v84-service/run-classification-regression.mjs
npm run build
wsl -d Ubuntu -u postgres -- bash -lc 'PG_BIN=/usr/lib/postgresql/16/bin bash /mnt/e/web/anime/tools/card-classification/run-local-postgres.sh'
git diff --check
```

두 ignored 임시 browser runner는 기존 `scripts/lib/isolatedE2eServer.mjs`를 사용했다. 전용 loopback 포트, 실제 catalog 환경값을 빈 값으로 override, Web intake1/새 classification sync0, tests 아래 실제 src 테스트를 Chromium/worker1로 실행하며 자신의 서버만 종료한다. 첫 runner 대상은 memory-classification/channel-service/channel-controls/title-hub/memory-card-composer/memory-account-sync/release-editing7개 suite다. 두 번째는 memory-classification/title-hub를 재검사했다. 사용자4363 서버와 기록은 지우지 않았다.

| 이번 실행 | 결과/증거 |
| --- | --- |
| unit 최종 | **416 PASS, fail/skip0**. `.cache/v84-service/detail-unit-final.log`. |
| 실제 Chromium 회귀 | **고유61 PASS, skip0**. `.cache/v84-service/detail-regression-final.log`. |
| 마지막 pagination 경계 수정 후 재검사 | 위61개 중 **12 PASS**. `.cache/v84-service/classification-browser-final.log`; 61+12를73개로 계산하지 않는다. |
| migration/local RPC | **19 SQL assertions PASS**. `.cache/v84-service/classification-sql-final.log`. 기존 WSL PostgreSQL16.15, Auth/Storage bootstrap stubs 및 pg_cron 제외. 실제 hosted/PostgREST/Auth 검증과 다르다. |
| build | **19 routes PASS**. `.cache/v84-service/detail-build-final.log`. 기존 큰 메뉴 bundle 경고: 약1,026.80kB/gzip372.08kB. |
| diff | 오류0; Git의 LF/CRLF 안내만 존재. `.cache/v84-service/detail-diff-check.log`. |
| 실제 catalog 화면 | 4363의 실제 프리렌 Title Hub에서 Fern/Frieren/Stark 등6개와 성우 표시, More characters 키보드 조작 후12개 확인. 합성 캐릭터 데이터로 대체하지 않았다. Memory는 기존0 유지, 사용자 노트/이미지 변경 없음. |

## 이번에 새로 통과한 사용자 행동

1. 동일 작품의 두 Memory 중 하나에만 캐릭터/커스텀 태그 저장 → 재로드 유지 → 다른 카드에는 미적용 → Archive 카드 태그+캐릭터 조합으로1개 → 표/재로드에서도1개.
2. 입력 중 태그를 Enter/추가 없이 Save → 저장. 한 번의 실제 repository 쓰기 실패 주입 → 감상·태그 초안 유지 → 재저장/재로드 성공. 취소/삭제 취소는 원래 감상·분류 유지.
3. 실제 IndexedDB에서 구서버 응답/원격 분류가 있어도 미전송 로컬 태그 보존, 전송 상태 정리 후 새 원격 태그 반영, 원격 tombstone에서 분류 제거.
4. 실제 IndexedDB metadata export → 잘못된 태그 restore 거부 → 빈 archive로 정상 restore → 태그/캐릭터/작품 참조/기존 감상 유지. 같은 트랜잭션으로 복원하며 image bytes는 포함하지 않는다.
5. 상세의 이미지 관리는 처음 접힘, 공개 flag off 안내는 정직하게 사용 불가 표시. 1440/390/320에 가로 넘침 없음. `design/evidence/v84-service-2026-10-05/classification-*.png`3개는 실제 src에서 실행한 합성 데이터 캡처이며1440/320을 직접 열어 검토했다. 실휴대폰 PASS는 아니다.
6. SQL 후보에서 분류 저장/ACK/replay/구client 보존/invalid rollback/conflict/current-version resolution/guest promotion/owner B 읽기·쓰기 거부/anon 거부/unguarded RPC 권한 거부/delete scrub 검증.

## 실패와 수정 근거

첫 browser6개 중1개 실패는 IndexedDB의 update whitelist가 note만 허용해 새 분류가 실제 저장되지 않았기 때문이다. 분류/pending 명시 필드만 추가한 뒤 통과했다. 첫 broad58개는55 PASS/3 fail: 실제 catalog 환경과 합성 제목 fixture 충돌1개 및 검사 도중 source 수정에 따른 reload와 일치한 pending2개 실패였다. 후자를 제품 원인으로 단정하지 않는다. 전용 fixture 서버에서 source 수정 없이 최종61개를 재실행해 전부 통과했다. 실패 회차는 PASS로 기록하지 않는다.

Docker daemon은 가동되지 않아 기존 WSL PG를 사용했다. 첫 root initdb는 실행 불가였고, postgres 사용자 첫 검사는 transaction GUC가 commit 후 빈 문자열로 돌아오는 assertion 오류였다. fixture의 빈 값 검사를 고친 뒤15개, conflict/promotion/권한 검사를 추가한 최종19개 통과. 외부 차단으로 남아 있지 않다. 실제 IAB의 More click 도구 오류는 같은 버튼의 Enter 조작으로12개 표시를 확인했으며 UI 클릭 버그로 판정하지 않았다.

## DB/롤백·보안·권리·관측

운영/hosted DB 적용 없음. 후보는 private `memory_cards.classification` JSON과 bounded validation, 기존 RPC를 감싸는 transaction-local hydration이다. 기존 version·operationId/hash·replay·quota·RLS 계약을 재사용하고 old wrapper의 client 실행권한은 제거한다. 원격 새 필드는 **기본 꺼진** `PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1`로 분리했다. `tools/card-classification/README.md`에 local 실행/rollout 순서를 기록했다.

롤백은 새 flag off와 이전 UI/read path 복원이다. additive column/사용자 태그/원본은 보존하며 drop/reset하지 않는다. 기존 legacy 데이터·공식 표지 권리·회원계정 정책·Public flags는 변경하지 않았다. 공개 DTO allowlist(`src/features/memory/domain/publicationView.js:3–34`)와 기존 SQL의 공개 snapshot 선택 필드(`supabase/migrations/20260923090000_memory_publication_boundary.sql:98–128`)에 classification을 추가하지 않았다. 감상/태그/검색/이미지 bytes를 analytics/일반 로그에 새로 담지 않았고 telemetry는 변경 필드 개수만 사용한다. 원본을 자동 업로드하거나 공개 전환하지 않는다.

## 현재 미완료·외부 차단·다음1개

이번 로컬 범위는 검증했다. 외부 차단은 없다. 새 태그의 실제 hosted save/pull/conflict/promotion 및 다른 기기 재열람은 **미검증**이다. 승인된 test 환경에 후보 적용 후 새 flag를 켜고 그 새 필드만 검증해야 한다. 기존 기본 DB·A/B 격리/72table 검사를 근거 없이 반복하지 않는다. 실폰/Safari/전체19route 회귀·기존 출시 D01~D06의 실제 잔여는 유지한다. 운영 migration·Public·유료·master merge/push/배포는 D06의 별도 후보 승인 대상이다.

다음 작업1개: **4363에서 사용자의 실제 기억을 열어 새 상세/카드 분류 UI를 검토**한다. 이번 변경은 아직 로컬 미커밋이며 다른 PC/Git/운영 사이트에 반영됐다는 의미가 아니다.

# 23차 후속 — 상세 읽기·수정·관리 분리 (2026-10-06)

## 읽은 문서·가정·계획

AGENTS.md → CODEX_START_HERE → 확정 결정01, 제품02, 기존 Title Hub dual-view spec/plan, 이미지05, 구조06, QA07, 변경통제09, PLANS.md와 기존 interface-rebuild22차를 확인했다. 실제 MemoryCardDetail/분류 editor/TitleCharacters/Board/Sharing/PrivateImageSync와 공통 CSS·모달 훅·해당 테스트를 대조했다. verify-before-claiming 및 computer-use 지침을 읽고 실제 src 실행과 캡처로 확인했다.

사용자 요청은 Are.na를 더 참고한 기존 기억 상세의 정리다. 기존 카드별 태그·공개/권리·저장 모델을 바꾸는 요청으로 확장하지 않았다. 소스 편집 전에 **기존 `plans/2026-10-03-interface-rebuild.md`의23차**에 읽기/수정/관리, 선택창, 수용 기준과 롤백을 추가했다. 별도 진행판·계획 트리 없음.

실제 [AD_Direzione](https://www.are.na/chase-body/ad_direzione)의 ken-price.jpg 블록을 열어 큰 이미지/좁은 정보 패널·짧은 facts·Connect/Actions·Connections/Comments를 DOM 및 화면으로 확인했다. 로그아웃 Actions 메뉴의 Find original/Share/API도 확인했다. [공식 Connections](https://help.are.na/docs/getting-started/connections), [Settings and export](https://help.are.na/docs/getting-started/channels/settings-and-export)와 대조했다. MOEMOA에서는 기존 Board/기억/관리 기능에 맞춰 구분하며 없는 댓글 기능을 만들지 않았다.

## 변경 파일과 근거

| 파일/현재 행 근거 | 이번 변경 이유 |
| --- | --- |
| `src/features/memory/components/MemoryCardDetail.jsx:33–89,121–146,298–358` | 기본 화면은 감상/선택한 캐릭터·태그를 읽는다. 명시적 ‘기억 수정’에서 입력/저장/취소, 기억/관리 탭과 키보드 전환. 성공 후 읽기/focus 복귀, 실패 후 초안 유지. 이미지 없는 카드의 관리·복구 자동 접근과 접힌 private preview hydration 유지. |
| `src/features/memory/components/MemoryCharacterPicker.jsx:1–36` | 캐릭터의 별도 검색/선택창. 자체 선택 초안은 적용 전 부모에 쓰지 않으며 Escape/취소로 폐기. 기존 모달 훅의 focus trap/복귀/body scroll lock 재사용. 기존12개 제한, 명시 적용 뒤 카드 저장. |
| `src/features/memory/components/MemoryClassificationEditor.jsx:1–20` | 인라인 전체 캐릭터 grid/details를 없애고 선택값과 선택 액션만 유지. 기존 커스텀 태그 입력/Enter/저장 계약 유지. |
| `src/features/titles/components/TitleCharacters.jsx:31–38` | 로드된 캐릭터 이름만 검색하며 범위를 ‘불러온 목록’으로 표시. 기존 title binding/provenance/추가 페이지·재시도는 유지. |
| `src/features/memory/components/AddMemoryToBoard.jsx:21–22` | 짧은 ‘보드에 담기 →’ 액션, busy/수정 중 열기 잠금과 로딩 표시. 기존 N:M 저장/중복·실패/연결된 Board 링크 유지. |
| `src/features/memory/components/memory-card-detail.css:66–121`, `src/styles/channel-service.css:146–151` | 얇은 선·짧은 액션 줄/탭/분류 facts, 작은 감상 입력, 큰 이미지 관리 박스 제거. 모달의 제한 높이/목록 스크롤과 모바일 터치 크기. |
| `tests/memory-classification.spec.ts`, `tests/channel-service.spec.ts`, `tests/memory-card-composer.spec.ts`, `tests/release-editing.spec.ts`, `tests/private-image-sync.spec.ts` | 읽기→수정/관리의 명시 경로로 기존 사용자 행동을 검증. 선택창 staging/검색/포커스·35명 목록/12명 제한·초안 보호, 숨긴 관리 패널에서도 사진 preview 보존. 이전 책장/접힌 모바일 제어의 오래된 selector를 현행 UI로 대조해 갱신. |
| 시작/확정 결정의 최신 요약/단일 작업판/기존 계획·이 보고/인계/증거 README |23차 검증·한계만 갱신하며22차 및 기존 W/D/Q의 과거 결과는 보존. |

## 실제 실행 명령과 결과

기존 Node24.19.0/npm11.17.0 사용. 아래 ignored 임시 runner는 기존 `scripts/lib/isolatedE2eServer.mjs`의 독립 loopback 서버를 사용하고 fixture 테스트의 catalog 값을 빈 값으로 명시했다. 사용자4363 origin과 기록은 수정하지 않았다.

```powershell
. .\.cache\activate.ps1
npm run test:unit
node .cache/v84-service/run-detail-regression.mjs
node .cache/v84-service/run-classification-regression.mjs
node .cache/v84-service/run-detail-long-regression.mjs
node .cache/v84-service/run-detail-private-regression.mjs
node .cache/verify-v84-detail-23-real-catalog.mjs
npm run build
git diff --check
```

| 이번 실행 | 결과와 증거 |
| --- | --- |
| unit |416 PASS/fail0/skip0, `.cache/v84-service/detail-23-unit.log`. |
| 기본 Chromium 회귀 |7개 suite **63 PASS**, `.cache/v84-service/detail-23-regression.log`. note 저장/중복 요청/실패/삭제취소/이미지 교체·권리/Board/Archive/Title Hub 포함. |
| 선택창 추가/캡처 |15개 중14 PASS/새 긴 목록1 fail, `.cache/v84-service/detail-23-picker.log`. 긴 목록 테스트가 저장 완료를 기다리지 않고 reload한 오류를 수정한 대상 재검사 **1 PASS**, `detail-23-long-final.log`. 반복14개를 고유 숫자에 더하지 않는다. |
| private image 회귀 |별도 임시 서버의 private sync/Web intake flag1 및 mock Auth/HTTP 경계로 **2 PASS**, `detail-23-private-current.log`. 원본 바이트·hash, 재시도의 같은 operationId/같은 bytes, quota/불확실 응답, 최적화·remote-only 재로드·숨긴 관리 패널의 preview·계정 변경 격리 포함. 실제 hosted/OAuth PASS가 아니다. |
| 고유 Chromium |위63 + 새 긴 목록1 + private2 = **66 PASS**. 이전22차61/21차64, 반복 검사 결과와 합산하지 않는다. |
| 실제 catalog 읽기 |사용자와 분리된 disposable browser에서 기존 승인 카탈로그의 프리렌 표지를 명시 선택하고 합성 감상으로 임시 Memory 생성. 실제30명 목록에서 Fern/Frieren 선택 → 태그·Save → 실제 표지/읽기·선택창/관리·dark/1440·390·320 확인. JS 오류0/가로 넘침0/완료된 원격 nonGET0. `.cache/v84-service/detail-23-catalog-evidence.json`, `detail-23-real-catalog-final.log` 및 `catalog-detail-*.png`. dark는 CSS 전환 완료를 확인한 최종 캡처로 보존했다. 이 context는 종료·폐기했고 사용자 카드에 추가하지 않았다. |
| build |19 routes PASS, `.cache/v84-service/detail-23-build.log`. 기존 TopNav bundle 약1,026.82kB/gzip372.09kB 경고 유지. |
| diff |`git diff --check` 오류0, `.cache/v84-service/detail-23-diff-check.log`. 기존 LF/CRLF 안내만 존재. |

실패 회차를 PASS로 바꾸지 않았다. 첫 private2는 이전 `.home-rediscovery` selector가 현행 선반 UI에 없어서 실패했다. 실제 Edit bookshelf→Add shelf→선택→Apply→memory film 경로로 바꾼 다음 회차는 모바일에서 접힌 Memory View 제어를 찾지 못해2 fail이었다. 현행 ‘Expand information and controls’로 열고 검사한 최종2 PASS. 데이터/사진 기능을 이 selector 실패에 맞춰 재작성하지 않았다. 첫 기본 읽기 캡처는 async 로딩을 기다리지 않아 빈 화면이었다. 실제 감상 렌더를 기다리도록 수정해 다시 캡처했다.

## 이번에 새로 통과한 사용자 행동과 시각 증거

- 기본 상세에서 감상/태그를 읽고 ‘기억 수정’ → 선택창 검색 → 임시 선택 → Escape 시 폐기/focus 복귀 → 다시 적용 → 명시 Save → 재로드 유지. 카드 전체 취소는 원래 감상/분류를 보존한다.
- 편집 중 관리 탭을 숨기지 않고 잠가 초안이 갑자기 사라지지 않는다. 돌아가기 확인 취소 시 초안 유지, 수정 취소 후 돌아가기 성공. Save 실패/중복 방지와 기존 원본 교체/삭제 취소도 통과.
- 35명 목록/320px/dark에서12명 선택 후13번째 추가 금지, 이미 선택한 인물 해제 가능, 적용·저장·재로드12명 유지. 적용 footer가 화면 안에 남으며 가로 넘침 없음.
- 관리 탭을 보이지 않게 전환해도 private preview 컴포넌트는 유지되어 원격 사진이 사라지거나 자동 재업로드되지 않는다. 이미지 없는 카드에서는 관리/복구를 자동으로 연다.

`design/evidence/v84-service-2026-10-05/detail-read-{1440,390,320}.png`, `detail-picker-{1440,390,320}.png`, `detail-picker-long-dark-320.png`는 실제 src의 합성 데이터7장이다. 1440 읽기/320 picker·dark를 직접 열어 확인했다. 실제 표지가 포함된6장(`catalog-detail-*`)은 ignored cache에만 보존했고1440/320 읽기·선택창/관리/dark도 직접 확인했다. viewport 검증이며 실물 휴대폰/Safari PASS가 아니다.

## DB·롤백·보안/권리/관측

이번에는 schema/migration/동기화 계약·원격 설정·정책·Public flags·의존성을 바꾸지 않았다.22차의 migration 후보/SQL19는 과거 실행 근거로 유지하며 다시 실행하지 않았다. 원복은 이번 상세 UI/선택창·CSS·테스트만 되돌리고 기존 카드/태그/원본/Board를 보존한다. 개인 노트/이미지나 태그를 analytics/일반 로그에 새로 넣지 않는다. 원본 공개 상태를 조회하지 않고 공개 사본까지 비공개라고 단정하지 않는다. 기존 Board preview·권리/최종 동의·철회 경로를 재사용한다. 실제 카탈로그 QA는 읽기 전용 원격 접근+별도 context의 명시 로컬 저장이며 원격 쓰기/이미지 자동 업로드0이다.

## 미완료 조건·외부 차단·다음1개

23차 로컬 범위는 완료했다. 외부 차단 없음. 카드 태그는 현재 이 기기 저장이며, 새 분류의 hosted sync/다른 기기 읽기와 실물폰/Safari·기존 출시 D01~D06 잔여는 미검증으로 유지한다. 운영 적용/공개 활성/배포 승인은 D06의 정확한 후보를 따르며 이번 작업에서 commit/push/배포0. Git의 기존 미커밋 디자인 작업은 보존했다.

다음1개: **4363에서 기존 실제 기억의 읽기→수정→관리 배치에 대한 사용자 미감 검토**. 현재 실제 앱 소스에는 반영됐지만 운영 moemoa.xyz나 다른 PC에 배포된 상태는 아니다.

## 24차 — 다른 PC Git 인계 (2026-10-06)

1. **읽은 문서/파일:** AGENTS, CODEX_START_HERE, 결정01, PLANS, 변경통제09/QA07, 기존 interface-rebuild23차, 이 보고와10/5 인계/단일 작업판, package/ignore/attributes, 기존 격리 E2E·시안 서버/검사기, 새 디자인 자료·card-classification 후보 안내. 제품/권리 결정을 새로 변경하지 않았다.
2. **가정/미확인:** 개발 브랜치 `codex/phone-test`를 다른 PC에서 이어간다. fetch 기준54c39cb/ahead0·behind0. 실제 새 PC 실행·폰/Safari·hosted 새 태그 sync는 미검증이며 현재 카드 태그/선반은 기기 보관이다. 기존 추적 `.env.production`은 PUBLIC client 설정9개뿐이고 수정하지 않았다. 비밀 환경 설정과 사용자 브라우저/원본 자료는 새 commit 대상이 아니다.
3. **계획:** 새 계획판 없이 `plans/2026-10-03-interface-rebuild.md`24차에 파일 점검→문서/실행 경로→재검사→구분 commit→비강제 push→SHA 확인을 기록했다. 기존 W/D/Q와 실행 로그 보존.
4. **변경/보존:** 시작 문서/인계/작업판/이 보고의 최신 요약·다른 PC 명령·다음 작업을 갱신. `scripts/serve-channel-design.mjs`와 `design:preview:v84`로 최신 시안 실행, `scripts/run-channel-e2e.mjs`와 `test:e2e:channel`로 기존 cache 전용 회귀를 재현한다. 기능·의존성 버전은 새로 바꾸지 않았다. 이전20~23차 코드·테스트, V8.1~V8.4 PNG/SVG/규칙·합성 증거를 모두 보존. 새 디자인 text7개의 마지막 빈 줄만 정리했다.
5. **데이터/롤백:** 이번 DB 적용0. 미적용 private 분류 SQL과 로컬 도구를 별도 `4bfb3da`에 보존했다. 과거22차 격리 SQL19 PASS를 이번 hosted PASS로 만들지 않는다. 원복은 개발 커밋 revert/flag off이며 사용자 원본/분류/선반/새 column을 삭제하지 않는다. master/운영 Public/DB/운영 배포 변경0.
6. **이번 실행/결과:** Node24.19.0/npm11.17.0. 아래 표와 Git 확인을 실행했다. 이번 작업에서 새 사용자 기능을 추가한 것은 없고 기존 실제 save/edit/cancel/tag/filter/Board/account 경계를 재검사했다. 이전23차66·22차61/SQL19와 합산하지 않는다.

| 명령/환경 | 이번 결과 | 범위/제한 |
| --- | --- | --- |
| `npm run test:unit` |416 PASS/실패·skip0|기존 domain/adapter/UI helper|
| `npm run design:check` |errors0/169checksum|기존 V8 portable 패키지, V8.4 전체 검사를 뜻하지 않음|
| `npm run test:design-server` |9 PASS/skip0|기존 loopback/경로·검사기 계약|
| `npm run test:e2e:channel` |64 PASS/skip0|새 격리 실행기/기존7suite/Chromium, 합성 자료·모의 계정, 실제 OAuth/hosted/폰 아님|
| `npm run build` |19 routes PASS|기존 TopNav1,026.82kB/gzip372.09kB 경고 유지|
| 새 preview CLI / 실제 Chromium 시안 로드 |CLI200·최신URL /8화면 PASS|4시안×1440·320, V8.4 세 탭 왕복, JS오류·로컬404·가로넘침0; 외부 폰트 차단/fallback|
| 후보 파일명/text 점검 및 `git diff --cached --check` |새 secret/JWT literal0 /최종오류0|실제 사용자/제3자 catalog 캡처와cache/env 비밀 제외, LF/CRLF 경고만|

첫 E2E는 Astro 최초 최적화가 준비 제한시간을 넘어 테스트 실행 전 중단됐으며 같은 명령 재실행64 PASS였다. 초기 정적 문자열 자산 점검의 HTML base/JS 동적 상대경로 false positive는 실제 브라우저 요청으로 대조했다. 마지막 EOF 정리는 동작 코드 변경이 아니다. 로그/JSON은 `.cache/v84-service/handoff-24-*`로 로컬 보존; 새 PC 회귀에는 cache 실행기가 필요 없다.

7. **보안/권리/관찰 영향:** 새 비밀·실제 표지 QA 캡처·사용자 감상/사진/cache는 commit하지 않았다. 기존 공개 client 설정은 유지한다. 새 실행기는 credentials/rollout flags를 제거하고 기존 격리 loopback 서버를 소유한다. UI assets는 합성 시안/직접 만든 SVG·PNG/로고와 합성 서비스 증거이며 Are.na 제3자 원본 캡처는 cache 전용이다. analytics/일반 로그 필드 추가0, Private 자동 업로드/Public 활성화0.
8. **Git 근거/잔여/다음 gate:** 결정/계획 `2c0c480` → SQL 후보 `4bfb3da` → 실제 Web `9cf424e` → 시안/합성 증거 `fb25167`. 자료 commit `fb25167b9563807e9eeb22f89f82f9f42651d3a7`를 `git push origin HEAD:codex/phone-test`로 올리고 `git rev-parse HEAD`/`git ls-remote origin refs/heads/codex/phone-test` 일치를 확인했다. 이 기록의 후속 문서 commit까지 포함한 최종 branch HEAD를 새 PC에서 받는다. 자동 Vercel Preview 완료는 미조회이며 운영 배포로 보고하지 않는다. 외부 Git 차단 없음. 다음1개는 **기존 실제 기억 상세의 읽기→수정→관리 배치 사용자 검토**. 새 태그 hosted·실폰/Safari·기존 출시 D01~D06 잔여는 유지하며 Android 제외/운영 후보 승인은 별도다.
