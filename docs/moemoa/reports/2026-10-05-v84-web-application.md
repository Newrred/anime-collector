# V8.4 실제 Web 디자인 적용 — 2026-10-05

> 최신 실행 기록은 하단 **30차 요청 취소와 원복** 절이다(2026-10-07). 유효한 구현은29차 감상 기록과 장면 저장 동선 복원까지다. 원격 체크포인트2c1811d 이후25~29차 로컬 미커밋이다. 20~29차의 당시 상태·실패·PASS와 이번 원복 검사를 구분한다.

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

## 25차 — 컬렉션과 선·이미지 중심 후속 (2026-10-06~07)

1. **읽은 문서와 소스:** AGENTS.md → CODEX_START_HERE.md → 최상위01/제품02/Title Hub dual-view UI 명세·계획, PLANS.md/변경09/QA07 및 기존 interface-rebuild 계획·보고·인계·단일 출시 작업판을 대조했다. 실제 BookshelfView/설정 reader, TitleCollectionView/PosterTile/AlbumCard/collection query, ChannelHeader/PrimaryNavigationLinks/TopNavDataMenu, channel-service/title-collection CSS와 관련 channel/title/helper/runner 테스트를 읽었다. Are.na 재접근 web 도구는 실패했으므로 새 사이트 실측을 주장하지 않고 사용자의 첨부와 이전 검토 근거를 사용했다. verify-before-claiming에 따라 실제 src와 런타임을 대조했다.

2. **승인·가정:** 사용자의 필름 장식 전부 제거(인터랙션 유지), 작품 탐색 이동, 이미지 겹침/모션 요청과 “컬렉션 / Collection (추천)” 답을 LINE-IMAGE-COLLECTION-01에 기록했다. SHELF-ROW-PREVIEW-01의 행 아래 펼침은 제가 제안한 V8 진행에 동의한 이력이 있으며 최초부터 사용자가 직접 아래 방식으로 바꾸라고 지시한 것은 아니었다. 사용자의 여러 책장일 때 느낌이 달랐다는 후속은 옆 펼침 복원 요청으로 해석하지 않았다. 기본 그리드는 유지하고 겹쳐보기로 비교한다. 추가 필수 결정/이번 로컬 차단은 없다.

3. **계획:** 새 진행판이나 계획 트리 없이 `plans/2026-10-03-interface-rebuild.md` 25차에서 승인/지도/순서/수용 기준/안전/롤백을 구현 전에 기록했다. 같은 계획의 실행 결과에 이번 PASS와 최초 테스트 오류를 보존했다.

4. **변경 파일과 이유:**

| 현재 경로/근거 | 변경 내용 |
| --- | --- |
| `src/features/bookshelf/BookshelfView.jsx:46–67` | 화면 제목/편집/검색/보기의 Collection 문구, 기억 펼치기 문구, 별도 layered 선택; 기존 선택 행 아래 한 패널 유지 |
| `src/components/PrimaryNavigationLinks.jsx:22` | PC/모바일 공통 Collection 이름; route와 저장 키 변경 없음 |
| `src/components/collection/ChannelHeader.jsx:12–17` | 확장 헤더의 칸 수를 지정해 작품의 탐색을 보기 옆으로 배치, 기존 Archive 5칸 유지 |
| `src/features/titles/components/TitleCollectionView.jsx:43,172–189` | 기존 POSTER/MEMORY 의미와 독립된 일시적 이미지 배치 옵션, 장르/열 수/방향을 헤더 탐색 칸으로 이동 |
| `src/styles/channel-service.css` | 기존 PNG의 문자만 CSS로 표시, 구멍/띠 pseudo decoration 제거, 일반 표지94%, 얇은 선과 가벼운 overlap/hover/focus; 모바일/reduced-motion pose를 none으로 제한 |
| `tests/channel-service.spec.ts`, `tests/title-collection.spec.ts` | 겹침의 실제 center hit test, 모든 표지의 키보드 선택/단일 기억 패널, 모션 감소·모바일/탐색 위치·장르와 동일 title 집합/상세 이동 검사 |
| `tests/channel-controls.spec.ts`, `tests/library-userflow.spec.ts`, `tests/memory-card-composer.spec.ts`, `tests/private-image-sync.spec.ts`, `tests/title-cross-surface.spec.ts` | 사용자 승인으로 바뀐 표시명/접근성 문구만 갱신. private-image/library 전체 suite는 이번 재실행하지 않았으며 나머지는 아래 범위로 검사 |
| 최상위01/시작, 기존 계획/이 보고/인계/출시 작업판 | 결정 및 현재 로컬 요약을 좁게 갱신; 과거 이력과 W/Q의 hosted 상태 보존 |

5. **데이터/마이그레이션/롤백:** migration/DB/ingestion/remote flags/의존성 변경0. 내부 bookshelf 클래스·저장 키와 사용자 선반 이름은 호환성 때문에 유지했지만 필름 표현은 보이지 않는다. 원본 이미지 바이트, Memory/Title/WatchLog/Board의 동작은 그대로다. 이번 source presentation diff만 원복하면 기존 로컬 설정을 그대로 읽는다. 기존 미적용 분류 SQL은 그대로 미적용이며 삭제/원격 적용하지 않았다.

6. **이번 명령/실행 결과:** Node24.19.0/npm11.17.0, `. .\.cache\activate.ps1` 활성화 후 실행했다.

| 실행 | 실제 결과와 한계 |
| --- | --- |
| `npm run test:e2e:channel -- tests/title-collection.spec.ts tests/title-cross-surface.spec.ts` | 최초77개 중76 PASS/1실패. 새 테스트가 CSS zoom 뒤 숨은 펼침 버튼을 무조건 클릭했다. 현재 표시 여부를 확인하게 보정했다. 초기 cross-surface5개 PASS도 이 회차 근거이며 Android 앱 검증이 아니다 |
| `npm run test:e2e:channel -- tests/title-collection.spec.ts --grep 'My Titles remains usable'` | npm/PowerShell에서 grep 옵션이 전달되지 않아 의도한1개 대신 기본+title72개 회귀가 실행됨.72 PASS/skip0. 다른 suite와 합산하지 않음 |
| `node scripts/run-channel-e2e.mjs tests/title-collection.spec.ts '--grep=layered Collection\|Title exploration'` | 최종 CSS의 reduced-motion hover/focus 우선순위 보완 후 Collection1+Titles3폭 **4개 재검사 PASS**.72개와 중복이며 고유4개를 더했다고 보고하지 않음 |
| `npm run test:unit` |416 PASS/실패·skip0 |
| `npm run build` |19 routes PASS; 기존 TopNav1,026.82kB/gzip372.08kB 및500kB chunk 경고 유지 |
| `git diff --check` |오류0, LF/CRLF 안내만. 이후 문서 추가의 최종 확인도 실시 |
| 실제4363 IAB |기존5작품/0Memory, 실제 카탈로그 표지·Collection 이름/문자 로고·겹쳐보기·보기 옆 탐색 관찰. Action만 선택→1작품 좌측, 전체→5작품 복귀. 여러 장르 선택은 기존 query의 OR 계약을 유지하며 새 교집합 구현으로 주장하지 않음 |

이번 새로 통과한 사용자 행동은 겹쳐보기에서 모든 표지 중심 선택/키보드 기억 펼침·같은 패널 교체, 모션 감소 시 focus에도 정지, 보기 옆 장르와 열 수 제어, 필터된 동일 Title 집합/두 보기/상세 이동이다. 기본 데이터/72 table 복원이나 hosted A/B/Public 검사를 반복하지 않았다. 격리 합성 fixture PASS와 실제 카탈로그 화면 확인은 별도 근거다. 실제 사용자 origin에 합성 카드나 사진을 넣지 않았다.

로그: `.cache/v84-service/line-25-unit.log`, `line-25-build.log`, `line-25-motion-e2e.log`; 합성 UI 캡처 `collection-layered-1440.png`, `titles-layered-{1440,390,320}.png`. 실제 표지 캡처 `collection-real-layered-25.png`, `titles-real-sparse-25.png`, `titles-real-layered-25.png`는 cache에만 보관한다. 브라우저 임시 viewport override는 reset했고 서비스 탭을 남겼다. 실표지 PNG 일부 오른쪽이 잘리는 캡처 한계가 있다(원인은 확정하지 않음). DOM 수평 넘침 결과 및 headless3폭 layout 검사와 구분한다. 새 실측 Are.na 원본/실폰/Safari/hosted/운영 배포 PASS가 아니다.

7. **보안·권리·관찰:** 비공개 이미지 자동 업로드·공개 범위/동의·계정/권한·moderation·analytics 변경0. 실제 이미지 내용이나 metadata를 재생성/분석하지 않았다. CSS transform은 표시뿐이며 원본 파일은 유지한다. 실제 카탈로그 캡처/개인 설정은 Git에 추가하지 않는다. 공용 문구와 UI 제어만 변경한다.

8. **잔여/다음 승인:** 로컬 미커밋으로 기존 개발 HEAD2c1811d 이후 변경이다. 이번 로컬 구현의 외부 차단은 없다. 출시 W/Q의 실폰/Safari, 새 private classification hosted save/pull/conflict/promotion 및 D01~D06의 실제 잔여는 미완료이며 이번 디자인 PASS로 채우지 않는다. Android 제외, 운영 migration/Public/master merge·push·배포의 정확한 D06 후보 승인은 유지한다. 다음 작업1개는 **컬렉션·작품의 새 선/이미지 배치 사용자 검토**다. 행 옆 펼침 복원은 이번 작업에서 확정하지 않았다.

## 26차 — 같은 작품 기억을 표지 뒤로 겹침 (2026-10-07)

1. **문서/소스:** 기존 AGENTS→시작→최상위01/제품02/Title Hub dual-view 명세·계획 및 PLANS/변경09/QA07, 같은 interface-rebuild·보고·인계·작업판을 대조했다. PosterTile/Cover/AlbumCard, BookshelfView/TitleCollectionView/projection 서비스와 PrivateMemoryCardPreview/MemoryVisual, channel-service CSS, channel/title/cross-surface 테스트 및 MemoryCardDetail의 async save를 읽었다. verify-before-claiming 적용.
2. **승인/가정:** 사용자 정정으로 겹침의 대상은 서로 다른 작품 표지가 아니라 한 작품 표지 뒤의 그 작품 Memory다. TITLE-MEMORY-STACK-01에 기록했다. 기억0인 작품에 가짜 이미지를 넣지 않으며 현재 실제 origin에는5작품/0Memory다. 초기 행 아래 동작 유지 검증 후, 후속 승인으로27차 옆 펼침을 이어간다.
3. **계획:** 기존 interface-rebuild26차를 코드 전에 갱신했다. 실행 결과/실패를 누적하고 새로운 진행판은 만들지 않았다.
4. **변경 파일:** `src/features/titles/components/TitleMemoryStack.jsx:1–20` 신규: 해당 preview 최대3개를 기존 owner별 이미지 렌더러로 읽어 aria-hidden 장식에 표시. `TitlePosterTile.jsx:1–20`: 공유 stack 연결, locale 전달. `BookshelfView.jsx:46–67`/`TitleCollectionView.jsx:174–205`: 잘못 해석한 Layered 옵션 제거, 두 보기/제목 href/기억 펼침 유지. `channel-service.css:97,165–172,223–227`: 앞표지 폭 통일, 뒤 이미지 작은 회전/hover·focus/reduced-motion, tail 클릭 범위. `tests/channel-service.spec.ts`/`tests/title-collection.spec.ts`: 정확한 source ID,0/1/3개, 동일 앞표지 크기, tail/키보드/단일 패널·상세와3폭. 기존 문서 현재 요약도 후속27차 마감에 맞춘다.25차의 필름 제거/명칭/탐색 위치 변경과 과거 근거는 보존한다.
5. **DB/롤백:** 새 migration/DB/flags/의존성0. 기존 미적용 카드 분류 SQL 상태 유지. source presentation만 원복하며 원본/카드/선반 키와 저장 데이터는 삭제하지 않는다.
6. **실제 명령/결과:** `. .\.cache\activate.ps1` 후 Node24.19.0/npm11.17.0. `node scripts/run-channel-e2e.mjs tests/title-collection.spec.ts tests/title-cross-surface.spec.ts` 최초77개75PASS/2실패. 기존 저장 검사에서 async save 전에 reload, 새 검사에서 정렬 후 첫 작품을2Memory 작품으로 잘못 고른 오류다. updateCard await 후 읽기 복귀를 기다리고 정확한 작품 label로 검사하도록 보정했다. `node scripts/run-channel-e2e.mjs tests/title-collection.spec.ts '--grep=real shelves persist|Collection previews|per-title memory stacks'` 최종5 PASS/skip0(초기 회차와 합산하지 않음). 새 실제 행동은 카드별 뒤 ID/개수·동일 앞표지 크기·exposed rear tail 클릭/모든 표지 키보드·같은 기억/Title 상세·모션 감소·1440/390/320/no-overflow다. `npm run test:unit` 최초415/1실패는 로컬 listen EACCES:23139, 소스·검사 변경 없이 재실행416 PASS/skip0. netsh 제외 포트 목록에 해당 포트가 없어서 원인은 미확정이다. `npm run build`19 routes PASS, 기존 TopNav1,026.82kB/gzip372.08kB/500kB 경고 유지. 최초/최종 로그는 `.cache/v84-service/memory-stack-26-{e2e,e2e-final,unit,unit-final,build}.log`. 실제4363의5stack/0뒤 이미지/0Memory/no-overflow 확인은 실제 카탈로그 근거이며 합성 src 캡처 `titles-memory-stack-{1440,390,320}.png`, 실제 로컬 runtime `collection-memory-stack-1440.png`와 구분한다. 실제 사용자 캡처는 `collection-real-no-memories-26.png`이며 현재 좁은 앱 패널에서 관찰했다. 사용자 데이터 주입/이미지 업로드0.
7. **보안/권리/관찰:** 기존 owner 검증/lazy private preview/4개 동시 read 큐/실패 및 object URL 정리 재사용. 중복 장식은 aria-hidden이고 독립 조작/공개/새 API 경로가 없다. 사진 바이트/개인 기록/검색을 새 로그나 Git에 넣지 않았다. 원본 이미지와 공개 동의 경계 유지.
8. **미완료/다음:** 로컬 미커밋, 운영 배포 완료 아님. 실제폰/Safari/hosted 새 태그 sync와 기존 W/Q·D01~D06 잔여는 유지한다. 새로운 외부 차단 없음. 후속 사용자 승인 **COLLECTION-SIDE-FAN-01**에 따라 다음1개는 컬렉션의 PC 옆 펼침/휴대폰 아래 넘김 구현·검증이다.26차 행 아래 PASS는27차의 새 위치 PASS가 아니다.

## 27차 — 컬렉션 표지 옆으로 기억 펼침 (2026-10-07)

1. **읽은 문서/소스:**26차 목록과 같은 기존 결정/계획/인계/작업판을 계속 사용하고 PLANS.md를 대조했다. BookshelfView의 selectedRow/Fragment 삽입, TitleAlbumCard의 동일 card href/최대3개와 extra/빈 상태, 공유 PosterStack/PrivateMemoryCardPreview/MemoryVisual, GenresRow의 실제 class, channel CSS 및 channel/cross-surface 검사 근거를 확인했다. verify-before-claiming 적용.
2. **승인/가정:** “클릭 시에는 겹친게 펼쳐지면” 및 선택 답 “표지 옆으로 펼침 (추천)”을 COLLECTION-SIDE-FAN-01에 기록했다. PC 선택 묶음이 한 줄 전체를 사용하고 다른 작품은 다음 줄로 이동한다는 방식을 안내했다. 이는 SHELF-ROW-PREVIEW-01/26차의 별도 행 아래 위치에 대한 명시 교체 승인이다. 컬렉션 클릭 범위이며 작품 탭의 Title Hub 이동 계약은 유지한다. 기억0에는 가짜 자료를 생성하지 않는다.
3. **계획:** 기존 interface-rebuild27차를 코드 전에 갱신했다. 데이터/보안/롤백/마일스톤과 source 제어를 기록하고 기존26차/과거 PASS를 남겼다.
4. **변경 파일/이유:** `src/features/bookshelf/BookshelfView.jsx:19–30,46–74`: 선택한 타일 안으로 표지 열/Memory 열을 옮기고 aria-controls/region, 다시 클릭·접기/Escape·표지 focus 복귀, 선택 표지 nearest scroll과 보기·편집 때 선택 정리. `src/styles/channel-service.css:84,173–185,226–230,243`: 일반 타일과 같은 표지 폭의 전체 행, PC 옆/휴대폰 아래 rail, 실제 이미지 contain/왼쪽 정렬·scroll snap·짧은 순차 펼침/모션 감소, 중복 정보 숨김. `tests/channel-service.spec.ts:35–113,151–227,230–308`: 위치·크기/행동과 저장된 이미지·최대3개 및 전체4개 연결 검사. 시작/최상위01/인계/이 계획/보고/단일 작업판의 현재 요약만 갱신했다.26차 신규 `TitleMemoryStack`은 그대로 사용한다.
5. **DB/데이터/롤백:** migration/DB/remote flag/의존성/Android 변경0. 기존 source presentation diff만 원복하며 원본·메모·태그·선반 키/Board N:M·카드 id를 유지한다. 기존 카드 분류 SQL 후보는 미적용이다. 사용자 origin의 카드/사진 생성·업로드0.
6. **실제 명령/결과:** Node24.19.0/npm11.17.0, `. .\.cache\activate.ps1` 후 아래 검사. 모든 initial 로그를 cache에 보존했고 과거/반복 PASS와 합산하지 않는다.

| 실행/근거 | 이번 결과와 한계 |
| --- | --- |
| `node scripts/run-channel-e2e.mjs tests/title-cross-surface.spec.ts '--grep=real shelves persist|Collection previews|Bookshelf and Board'` |초기3 중1PASS/2검사 오류: animation 중 x=-41px를 완료 값으로 검사, 선택 타일 내부 hidden duplicate cover로 strict selector 실패. source/front를 정확히 선택하고 종료 상태를 기다리도록 보정 |
| `node scripts/run-channel-e2e.mjs tests/title-collection.spec.ts tests/title-cross-surface.spec.ts` |77 중76PASS/1위치 대기 누락. 기존 no-overlap/Title3폭·두 보기/검색/계정/카드 행동은 이 회차 근거. 애니메이션 중 위치는 poll로 완료 후 판단 |
| `node scripts/run-channel-e2e.mjs tests/title-cross-surface.spec.ts '--grep=real shelves persist|Collection previews|actual local image bytes|Collection unfolds|Bookshelf and Board'` |추가 검사 회차2PASS/3실패: animation-fill:both가 종료 후 identity matrix를 유지. source를 backwards로 바꿔 종료 뒤 transform이 해제되게 함. 최종 같은 명령 **5 PASS/skip0**, `side-fan-27-e2e-complete.log` |
| `npm run test:unit` / `npm run build` |**416 PASS/skip0 /19 routes PASS**.27차 신규 실행이며26차 EACCES 실패/재시도와 별도. 기존 TopNav 큰 bundle/500kB 경고 유지 |
| `git diff --check` / 실제4363 IAB |오류0(LF/CRLF 안내만). 실제 기존5표지/0Memory 보존, Steins;Gate 표지 선택 시 첫 기억 안내·불필요한0개 링크 없음. 실제폰/hosted/운영배포 PASS 아님 |

새 사용자 행동 PASS: PC 펼침 전후 같은 표지 폭/옆 위치, 휴대폰390・320 아래 rail의 실제 scroll와 문서 no-overflow, 모든 표지 center/tail/키보드·단일 선택, 표지 재클릭/접기/Escape·focus/reduced-motion, local 파일 선택→IDB 저장한 합성 이미지의 같은 src/contain/자동 upload0, 실제4Memory의 preview3/+1→전체보기4, 같은 card/Title/Board 연결과 감상 저장 후 reload. 연령/권리/공개 실검증이나 기기 Safari PASS로 승격하지 않는다.

초기/전체/보정 로그: `.cache/v84-service/side-fan-27-{e2e,e2e-final,e2e-verified,e2e-complete,unit,build}.log`. 최종 합성 실제 src 캡처: `collection-side-fan-open-1440.png`, `collection-side-fan-{390,320}.png`, `collection-side-fan-three-1440.png`; 실파일로 저장한 합성 이미지 캡처 `collection-side-fan-local-image-dark.png`. 실제 사용자 자료는 `collection-side-fan-real-empty-27.png`에 별도 보관한다. 임시 viewport override 없이 현재 앱 패널의 좁은 화면을 관찰했으며 사용자 브라우저에 fixture를 주입하지 않았다.

7. **보안/개인정보/권리/관찰:** 기존 owner/lazy/4read 큐·실패/objectURL 정리를 재사용하며 source reader/API/원본 bytes/개인 분류/공개 동의는 변경하지 않는다. 겹친 뒤 이미지는 aria-hidden, 펼친 카드는 기존 href/접근성 이름으로 조작한다. 사진·검색·개인 감상을 신규 로그/Git에 추가하지 않았고 analytics 이벤트 추가0. 모든 QA 파일은cache 로컬이며 원격/운영 DB 쓰기0.
8. **잔여/다음 gate:**25~27차는 로컬 미커밋이며 원격 기준2c1811d 이후이다. 이번 로컬 작업의 외부 차단 없음. 다음 작업1개는 **컬렉션 옆 펼침 사용자 배치 검토**. 현재 사용자 기록의0Memory 때문에 실제 개인 사진이 채워진 팬의 육안 검토는 아직 없다. 격리 real runtime에서 합성 자료/실파일 저장으로 대신 검증한 범위를 명시한다. 기존 W/Q의 실폰/Safari/hosted 태그 sync와 D01~D06 잔여, Android 제외, 운영 migration/Public/master merge・push/배포의 정확한 후보 승인 게이트는 유지한다.

## 28차 — 선반 편집 정리와 실제 표지 (2026-10-07)

1. **문서/소스:** AGENTS→CODEX_START_HERE→최상위 결정01→제품02/Title Hub dual-view 명세와 기존 계획을 읽었다. PLANS/QA07/변경09와 기존 interface-rebuild·보고·인계·단일 작업판을 대조했다. 실제 BookshelfView/owner별 bookshelfSettings, TitleCover/collection service·projection, ChannelHeader/TextChoices, channel CSS·channel/cross-surface 검사와 appState·격리 실행기를 확인했다. verify-before-claiming 적용을 이어간다.
2. **승인/가정/질문:** 사용자 “선반 편집 부분 좀 정리 … 애니 표지가 같이 나오면 좋겠어”를 SHELF-EDITOR-COVERS-01에 기록했다. 실제 catalog 표지와 제목을 같은 선택 행에 표시하고 활성 선반 한 개씩 편집한다. 선반 추가/제거는 적용 전 draft이며 취소 시 저장본을 보존한다. 새 작품이나 Memory/표지 이미지를 생성하지 않는다. 첨부는2작품/3Memory였으나 접근 가능한4363 탭은 기존5작품/0Memory다. 이 서로 다른 상태를 동일 재현으로 주장하지 않고 검사 문맥을 구분한다. 추가 사용자 결정/외부 차단 없음.
3. **계획:** 코드 전에 기존 `plans/2026-10-03-interface-rebuild.md:555`의28차를 갱신했다. 별도 계획 트리/작업판을 만들지 않았다. 현재 요약·후속 카드만 좁게 갱신하며20~27차의 실제 실패/PASS·W/Q/D 출시 근거를 보존한다.
4. **파일/이유:** 신규 `src/features/bookshelf/BookshelfEditor.jsx:1–46`은 선반 목록/개수·활성 선반 이름/제거·검색/선택됨·표지44×66/제목/Memory 수/선택 표시·빈 상태·분리된 취소/적용 footer. 기존 최대20선반/80자 이름을 유지하고 저장 계층의 최대300개 선택에 맞춰 추가 선택을 제한한다(상한300개 실량 검사는 이번 범위 아님). 기존 `BookshelfView.jsx:56–59`는 부모 draft/owner/save·오류 handler를 그대로 전달한다. `src/styles/channel-service.css:120–162,270–276`은 큰 fieldset/멀리 떨어진 텍스트 checkbox를 선반 열+compact3열 선택/얇은 선으로 바꾸고 모바일은 한 열·테마/focus를 지원한다. 신규 `tests/bookshelf-editor.spec.ts:1–117`은 실제 플랫폼 runtime의 합성3Memory·두 선반을 통해 검색/전환/겹치는 title key·재로드/취소/삭제·저장 실패를 검증한다. 기존 시작/결정/이 계획/보고/인계/작업판 최신 요약도 갱신했다. 기존 다른25~27차 수정은 원복하지 않았다.
5. **DB/데이터/롤백:** DB/migration/remote flags/의존성/Android 변경0. 기존 owner별 localStorage 키와 원본/카드/Title/Board 관계를 유지한다. UI diff만 원복하면 기존 선반을 계속 읽으며 데이터 삭제/복구 작업은 불필요하다. 기존 카드 분류 SQL 후보는 미적용 상태다.
6. **실행과 실제 결과:** `. .\.cache\activate.ps1` 후 Node24.19.0/npm11.17.0. 다음 결과는 이번 실행이며 과거26・27차 PASS와 합산하지 않는다.

| 실제 실행/근거 | 결과와 증명 범위 |
| --- | --- |
| `node scripts/run-channel-e2e.mjs tests/bookshelf-editor.spec.ts tests/title-cross-surface.spec.ts '--grep=shelf editor|real shelves persist|a title added while|Bookshelf and Board preserve'` |초기5 PASS/skip0. 선반 제거 뒤 이전 검색/선택 필터가 다음 선반을 가릴 수 있어 source에서 초기화하고 검사에 추가. 최종 같은 명령5 PASS/skip0, 초기/최종은 중복 검사이며10개로 합산하지 않음 |
| `npm run test:unit` |최종416 PASS/실패·skip0. 제거 필터 초기화 전416도 통과했으며 별도 합산하지 않음 |
| `npm run build` |최종19 routes PASS. 기존500kB chunk 경고 유지. 초기 build19는 필터 초기화 전 근거이며 최종 소스로 다시 빌드 |
| 실제4363 CUA / source `TitleCover` |기존5작품/0Memory, 실제 catalog 표지5개 모두 naturalWidth>0/44×66·1440과390 no-overflow. 다른 좁은 agent 탭의319px 캡처를1440로 잘못 표기한 파일명은 `shelf-editor-real-319-separate-tab-28.png`로 정정. 실제 탭 fullPage1440 캡처를 별도로 저장. 캡처 크기와 화면 검증을 구분 |
| `git diff --check` |최종 확인에서 공백 오류0. LF/CRLF 안내는 있으나 Git stage/push 없음 |

새 사용자 행동 PASS: 두 선반이 같은 작품을 독립적으로 선택·검색/선택됨 후 선택 유지·선반 전환·제거 후 다른 선반의 검색 초기화·취소로 삭제 철회/저장본 동일·적용/새로고침의 title keys와 합집합 유지·QuotaExceededError 뒤 이름/체크 draft 보존 및 취소·이미지 없는 작품 fallback·1440/light/390/dark/320/light no-overflow. 기존 새 작품 이벤트 갱신과 Memory 감상 저장·동일 Title Hub/Board 왕복도 통과했다. 실제 catalog 이미지 로드와 소유 테스트 문맥의 private 제목 fallback을 구분한다. 이번 실제 데이터/기록 주입·선반 적용·이미지 업로드0. 관찰 가능한 탭의 실제 표지를 읽고 편집을 열었으며 합성 Memory는 격리 검사에만 만들었다.

로그: `.cache/v84-service/shelf-editor-{e2e,e2e-final,unit,unit-final,build,build-final}-28.log`. 격리 runtime 캡처: `shelf-editor-{1440-light,390-dark,320-light}-28.png`(표지 없는 합성 제목). 실제 catalog 캡처: `shelf-editor-real-desktop-full-28.png`, `shelf-editor-real-390-28.png`. 모두 cache 로컬 전용이며 Git에 넣지 않는다. 임시 viewport override를 reset하고 실제 편집 탭을 남긴다.
7. **보안·개인정보·권리·관찰:** picker는 기존 승인 catalog cover 경로를 재사용하고 사용자 Memory 이미지를 표지로 대체하지 않는다. 기존 collection service/owner 권한·private preview 읽기는 변경하지 않았다. 새 이미지 업로드/API/계정 권한/공개 동의·이미지 권리 정책/analytics 추가0. 검색·사용자 선반명·사진을 새로운 ordinary log나 Git에 넣지 않는다.
8. **미완료·다음 gate:**25~28차 로컬 미커밋/기준2c1811d, 운영 배포 완료 아님. 이번 편집 UI의 외부 차단 없음. 다음1개는 **표지가 보이는 선반 편집 사용자 배치 검토**. 실제폰/Safari/hosted 새 카드 태그 sync·기존 W/Q/D01~D06 출시 잔여와 Android 제외는 유지한다. 운영 migration/Public/master merge・push/배포는 D06의 정확한 후보 승인 뒤 별도다.

## 29차 — 감상 기록과 장면 저장 동선 복원 (2026-10-07)

1. **읽은 문서/소스:** AGENTS→CODEX_START_HERE→최상위01→제품02/Title Hub dual-view 명세와 기존 계획, PLANS.md, QA07/변경09와 기존 interface-rebuild·본 보고·인계·release-v2 단일 작업판을 대조했다. TitleHub/service/projection/TitleCollectionView·공통 TopNav, 기존 Library status/quick-log·WatchLog editor/repo/IDB hydration, snapshot codec·catalog title backup·cloud rows/remote apply, Memory composer/복귀 훅·공유 CSS와 실제 unit/브라우저 검사를 읽었다. verify-before-claiming 적용. 기존25~28차 로컬 diff를 보존했다.

2. **승인·가정:** 사용자 요청은 이미지 업로드 폼에 별점 등을 붙이는 것이 아니라 기존 감상 기록의 핵심 가치를 사용자 동선에서 복원하는 것이다. `WATCH-RECORD-FLOW-01`에 기록했다. 공통 진입에서 감상/장면을 구분하고 같은 작품 상세에 감상/기억 탭을 연결한다. 일반 감상은 이미지 없이 기록하고 별점/완료만으로 Memory를 만들지 않는다. 신규 provider 결과는 기존 resolver를 재사용하며 catalog 미연결 후보를 verified catalog로 승격하지 않는다. PrivateTitle의 새 tracking, 자체 catalog 감상의 새 원격 모델/동기화는 이번 범위가 아니다. 현재 실제4363에서 읽힌5작품/0Memory/감상0은 사용자 첨부의 다른 시점2작품/3Memory나 과거 별점 자료의 재현이 아니다.

3. **ExecPlan:** 기존 `docs/moemoa/plans/2026-10-03-interface-rebuild.md:571–587`의29차를 코드 전에 작성하고 실제 결과를 같은 절에 누적했다. 새로운 계획 트리/진행판 없이 현재 시작/결정/제품 flow/인계/작업판의 요약만 좁게 갱신했다. 과거 W/Q/D 완료 여부와 실행 로그를 덮어쓰지 않았다.

4. **변경 파일·이유:** 이번29차 소스와 검사는 아래다.25~28차의 미커밋 선반·겹침·공통 디자인 파일은 별도 이전 작업으로 보존한다.

| 파일/위치 | 이번 동작 |
| --- | --- |
| `src/pages/record.astro:1–6`, `src/components/TopNavDataMenu.jsx:195`, 신규 `src/features/titles/components/RecordStart.jsx:11–75` | 단일 공통 기억 남기기→감상/장면 분기. 기존 내 작품/실제 표지·상태/별점/재시청과 기존 resolver 검색→같은 Title Hub. 선택만으로 저장하지 않음. 검색 최신 요청만 반영, canonical ID가 없는 제공처 후보를 서로 같은 작품으로 잘못 제거하지 않음 |
| `src/features/titles/components/TitleHub.jsx:21–64,101–134,145–238`, 신규 `TitleWatchRecords.jsx:10–125`, `title-hub.css:42–109` | 같은 작품의 기억/감상 탭·본문 작성/기존 메모/시청 이력과 sidebar 요약. 상태/0~5 half-step 별점·미평가/재시청 횟수, 이번 감상/시작/완료/재시청/하차와 일·월·연도·미상. 명시 Save Title 선행·취소/이탈 보호·저장 중 재진입/해제 방지. 이미지 composer/캐릭터 읽기는 유지. 얇은 선과1440/390/320 배치 |
| 신규 `src/features/titles/domain/titleWatchRecord.js:1–44`, `application/titleWatchRecordWriter.js:4–61`, `application/titleHubService.js:83–140`, `titleAlbumProjection.js:160–170` | 실제 달력/별점/횟수/identity 검증, 기존 status alias는 draft에서만 정규화. 저장된 작품에 log→현재 tracking 반영. operationId 고정과 순차 저장/이미 저장된 내용 변경 거부·부분 완료/재시도; 절대 횟수 값으로 이중 증가 방지. 기존 긴 memo는 덮어쓰지 않음 |
| 신규 `src/domain/watchLogIdentity.js:1–16`, `src/repositories/watchLogRepo.js:129–165,193–241,259–325`, `src/domain/snapshotCodec.js:216–248,499–558,677–697` | 숫자 AniList와 optional canonical identity로 실제 old/new 이력 조회·IDB 전체 승격·동일 store/JSON 읽기. 미평가 null과0 구분. compact v5 trailing index11의 catalog ID, catalog-only 숫자 null 보존. 명시 백업 restore와 원격 snapshot 적용의 보존 조건 분리 |
| `src/domain/cloudSyncTables.js:62–80`, `src/repositories/syncRepo.js:584–588` | 자체 catalog-only 이력을 AniList0으로 보내지 않음. 기존 원격 전체 snapshot을 적용해도 현재 로컬 자체 이력을 유지. 신규 원격 schema/flag 없음 |
| `src/domain/search/memoryReturnNavigation.js:1–40`, `tests/unit/memoryReturnNavigation.test.mjs` | record 선택을 거쳐도 이미지 composer의 원래 Board/Archive/스크롤 복귀 목적지 유지, 외부/중첩 return 차단 계약 유지 |
| 신규 `tests/unit/titleWatchRecord.test.mjs`, `tests/watch-record-flow.spec.ts`, 수정 `tests/release-editing.spec.ts:200`, `tests/index.spec.ts:92`, `tests/storage-hydration.spec.ts:360` | 의미 있는 저장·실패·재시도/보존/백업 unit와 실제 browser 동선. 변경된 공통 chooser를 실제 image Back 검사에 반영하고 obsolete Home hero 대신 현재 Collection/실제 감상 이력을 확인 |

5. **DB·데이터·롤백:** 새 migration/DB schema/IDB version·production 데이터/flags/의존성 변경0. WatchLog 로컬 optional field와 기존 백업 tuple의 끝 필드를 추가했다. 예전 숫자 로그/기존 메모·태그·캐릭터·이미지/Board 관계는 읽기·저장·백업으로 보존한다. 자체 작품의 상태/별점/재시청은 기존 catalog title 백업, 시청 이력은 전체 snapshot 백업에 포함되므로 **둘을 함께 보존**해야 다른 PC에서 전체 자료를 복원할 수 있다. UI/code 원복은 가능하지만 구버전 codec으로 새 canonical 로그를 내보내면 유실 가능성이 있으므로 먼저 현재 버전의 두 백업 bytes를 보관하고 local store/로그를 삭제하지 않는다. 원격 신규 normalized WatchLog/TitleState sync는 별도 `TITLE-STATE-SYNC-01` gate다.

6. **실행 명령·결과:** `. .\.cache\activate.ps1` 후 Node24.19.0/npm11.17.0. 아래 로그는 `.cache/v84-service/` 로컬 전용이다. 각 회차는 합산하지 않으며 이전 PASS/이번 PASS를 구분한다.

| 실제 실행 | 결과/보존 근거 |
| --- | --- |
| `npm run test:unit` | 초기421PASS(`watch-unit-29.log`), 최종 수정 소스424PASS/실패·skip0(`watch-unit-29-final.log`). 최종 수치는424이며 과거416과 합산하지 않음 |
| `node scripts/run-channel-e2e.mjs tests/watch-record-flow.spec.ts tests/source-independent-title.spec.ts tests/title-cross-surface.spec.ts '--grep=watch flow:|Title Hub|UUID navigation|catalog-only title|same Title'` | 최초owned server readiness timeout으로 검사 시작0(`watch-browser-29-initial.log`, 원인 미확정). 재실행13 중9PASS/4FAIL(`watch-browser-29-second.log`): label의 option/help/textarea 내용까지 accessible name에 섞여 exact selector 실패. 명시 aria-label을 source에 적용 |
| `node scripts/run-channel-e2e.mjs tests/watch-record-flow.spec.ts '--grep=watch flow:'` |5 중4PASS/1 strict selector 충돌(`watch-browser-29-fix.log`): alert role status가 작품 캐릭터 로딩과 겹침. 저장 완료 기대값을 현재 감상 region에 한정 |
| `node scripts/run-channel-e2e.mjs tests/watch-record-flow.spec.ts tests/source-independent-title.spec.ts tests/title-cross-surface.spec.ts tests/storage-hydration.spec.ts tests/library-userflow.spec.ts tests/review-improvements.spec.ts` |103 중99PASS/2FAIL/2기존 환경 skip(`watch-browser-29-final.log`). 구 공통 CTA→직접composer Back 기대값과 obsolete Home hero selector 실패. 새로운 chooser/Collection→감상 경로로 검사를 보정. 두 skipped live Library 환경 검사는 이번 PASS에 포함하지 않음 |
| `node scripts/run-channel-e2e.mjs tests/watch-record-flow.spec.ts tests/storage-hydration.spec.ts tests/source-independent-title.spec.ts tests/index.spec.ts '--grep=watch flow:|browser Back|Home initial entry|mobile exposes memory|Title Hub|UUID navigation|catalog-only title'` | 첫16 중14PASS/2FAIL(`watch-browser-29-closeout.log`): 빈 선반의 hidden displayed-titles selector를 현재 bookshelf-page로 한정하고, 신규 제공처 후보의 undefined canonical ID를 같은 ID로 판단해 검색에서 제거하는 실제 source 문제를 고침. 최종 동일 명령16PASS/실패·skip0/exit0/25.9s(`watch-browser-29-verified.log`).103개 전체를 다시 PASS로 주장하지 않음 |
| `npm run build` |20 pages/exit0 PASS(`watch-build-29.log`). 기존500kB chunk 경고 유지. 새 record route 포함 |
| CUA 실제4363 읽기/클릭·DOM/캡처 | 실제 내 작품5개/기억0, Steins;Gate catalog 표지 naturalWidth460과 빈 감상 작성 폼1개.1440/390/320 가로 넘침 없음. 최종PC width1440/scrollWidth1430. `record-start-real-29.png`, `watch-real-desktop-final-29.png`, `watch-real-mobile-29.png`. 현재 locale 영어 유지; 기록 입력·저장/이미지 업로드·fixture 주입0. 실제 화면 증거와 아래 격리 저장 PASS를 구분. 임시viewport reset/탭 유지 |
| `git diff --check`, `git ls-files '.cache/v84-service/*'` | 공백 오류0/exit0, 증거 cache 추적 파일0. LF/CRLF 안내만 존재. commit/stage/push 없음 |

새로 통과한 사용자 행동(격리 소유 테스트 문맥): 공통 진입→기존 AniList 작품의 별점4.5/재시청2와 긴 memo·old cue/tag/character→재시청3/별점0/월 단위 감상→reload; 이미지/Memory0. canonical 작품 명시 Save Title/취소0쓰기·별5/완료·note→전체 이력 snapshot 및 catalog title backup의 fresh-browser 복원→미평가 clear/일 단위→unsave 후 로그 유지. 신규 검색의 미연결 제공처 작품 explicit save/별3/note/reload. JSON 없는 legacy/canonical IDB 전체 승격·null 대0·원격 snapshot에서 로컬 canonical 이력 보존. quota append 실패 draft 보존/수정 재시도, tracking 부분 실패의 정확한 알림/입력 잠금/같은operationId 재시도·기록1개/재시청1 유지. 늦은 검색 결과 무시·이탈 취소/draft 유지·1440/390/320 no-overflow. 기존 이미지 선택/Back/Archive 복귀와 현재 Home IDB hydration 두 실패 경로도 최종16에서 통과했다.103회차의99PASS는 legacy quick-log/status/character edit·기존 이미지/private/Board·Title 행동의 해당 회차 근거이며 최종16에 더하지 않는다.

7. **보안·개인정보·권리·관찰:** 감상과 날짜/횟수/별점은 기존 비공개 로컬 경로다. 자체 로그의 새 원격 전송·이미지 upload/공개·새 UGC flags/권리 승인·moderation/계정 권한 변경0. 사용자 note·검색·사진·개인 기록을 analytics/ordinary log/Git에 추가하지 않는다. picker는 기존 catalog cover와 resolver를 재사용하고 개인 기록은 검색 제공처로 보내지 않는다. 기존 image/rights/공개 동의 경계를 유지한다. 합성 fixture/실패 주입은 owned isolated browser에서만 실행하고 사용자 origin에는 쓰지 않았다. 캡처·raw 테스트 로그는 cache이며 Git 추적 제외다.

8. **미완료·외부 차단·다음 gate:** 브랜치`codex/phone-test`, HEAD`2c1811d36e28659c6055175bf1a31025389f2e3e`;25~29차 로컬 미커밋. 운영 배포/remote push 완료 아님. 이번 로컬 작업의 새 외부 차단 없음. 자체 TitleState/WatchLog 원격 동기화·새 카드 분류 hosted save/pull/conflict/promotion·실제 휴대폰/Safari 및 기존 W/Q/D01~D06의 출시 미완료 조건은 이번 로컬 PASS로 채우지 않는다. Android 제외 유지. 운영 migration/Public/master merge·push/배포는 정확한 후보 승인 후 별도다. 다음 작업1개는 **사용자가 실제 감상/장면 진입과 같은 작품의 기록 배치를 검토**하는 것이다.

## 30차 요청 취소와 원복 (2026-10-07)

1. **읽은 문서/파일:** AGENTS.md, CODEX_START_HERE, 최상위 결정01, PLANS.md, 기존 interface-rebuild 계획·보고/인계/단일 작업판과 제품02·구조06·UGC05·QA07·변경통제09를 대조했다. 이번 세션에서 원복 대상 index, titleCollectionService, TitleCollectionView의 실제 diff 및 기존 BookshelfView/BookshelfEditor/TitlePosterTile, shelf/channel/title/watch 회귀를 확인했다. verify-before-claiming 기준으로 실제 앱을 검증했다.

2. **범위/가정:** 사용자 “이 요청 그냥 취소.. 롤백 해줘”는 직전의 실험적 개인 취향 컬렉션과 작품 탭으로 표지 펼침/선반 이동 요청 취소다.25~29차의 기존 미커밋 디자인·카드 태그·선반 편집·감상 기록 복원은 원복 범위가 아니다. 추가 결정/질문 없음.

3. **계획:** 기존 `plans/2026-10-03-interface-rebuild.md`30차에 사용자 취소와 원복 범위를 코드 수정 전에 표시했다. 새 계획/작업판 없음. COLLECTION-TASTE-SPACE-01은 CANCELLED로 바꾸고 원래 요청은 이력으로 보존했다.

4. **실제 변경:** `src/pages/index.astro`는 기존 BookshelfView로, `src/features/titles/application/titleCollectionService.js`는 기존 load 계약으로 복구했다(두 파일 현재 HEAD 대비 diff0). TitleCollectionView에서는 이번 fan/shelf editor/filter/selection만 역변경하고 이전 장르·열 수 탐색 배치는 유지했다. 새 TitlePosterFan, collection/의5개 파일(CollectionSpace/CollectionVisual/model/loader/CSS), 이번 전용 browser/unit 테스트를 제거했다. 기존 BookshelfView/TitleMemoryStack/BookshelfEditor·감상 기록 구현/기존 테스트는 유지했다. 시작·결정·계획·보고·인계·작업판에는 취소/원복 사실만 기록했다.

5. **데이터/롤백:** DB/schema/migration0. 사용자 카드·감상·별점·시청 상태·정주행·태그·이미지 bytes·기존 선반 설정 수정/삭제0. 실제4363의 미저장 실험 배치만 Cancel 후 새로고침했다. source 원복 전3파일/계획/결정은 추적 제외 `.cache/v84-service/rollback-30/`에 보존했다. Git reset/전체 restore·commit/stage/push 없음.

6. **이번 검증:** 아래는 원복 후 새 실행 결과이며 과거 PASS와 합산하지 않는다.

| 실제 실행/관찰 | 이번 결과 |
| --- | --- |
| `npm run test:unit` |424 PASS/실패·skip0/exit0; `.cache/v84-service/rollback-30-unit.log` |
| `node scripts/run-channel-e2e.mjs tests/bookshelf-editor.spec.ts tests/title-collection.spec.ts tests/watch-record-flow.spec.ts '--grep=shelf editor&#124;real shelves&#124;Collection previews&#124;Collection unfolds&#124;actual local image bytes&#124;My Titles&#124;watch flow:'` |16 PASS/실패·skip0/exit0/35.9s; `rollback-30-browser.log`. 선반 검색/독립 선택·취소·quota/재로드, 컬렉션 표지 뒤 기억·PC 옆/모바일 아래 펼침·실제 이미지 비율/최대3개, 작품 두 보기·장르·열 수/320px, 감상 기록/백업/재시도 보존 |
| `npm run build` |20 pages PASS/exit0; `rollback-30-build.log` |
| 실제4363 CUA 읽기/클릭·새로고침 | 기존 Collection/‘디자인 확인’ 선반·표지5개 정상 로드, Memory0 유지; Steins;Gate 표지 클릭 펼침/닫기 확인. `.collection-space` 없음, `.bookshelf-page` 존재. 사진/기록 입력·저장/업로드0. `rollback-30-real-collection.png`; 임시 viewport reset, 기존 컬렉션 탭 유지 |
| `git diff --check` 및 source 참조 검색 | 공백 오류0, 활성 source/test에서 CollectionSpace/TitlePosterFan/resolvePreviews 참조0 |

취소 전30차 실행의 unit429 및 초기4PASS/1FAIL(reduced-motion CSS), 보정 후14PASS/1FAIL(Title poster 링크 hitbox 회귀)은 cache의 taste-space 로그에 그대로 보존한다. 취소된 구현의 출시/완료 PASS로 사용하지 않는다. 이번 원복16개에서 기존 작품 표지 링크 이동까지 통과했다.

7. **보안/권리/관찰 영향:** 공개/권리 gate, DB/flags·운영 권한·원격 업로드·analytics·유료 서비스 변경0. private→public 전환 없음. 합성 QA는 격리 브라우저에서만 수행했고 실제 사용자 origin에는 자료를 주입하지 않았다. 캐시 캡처/로그는 Git 추적 제외다.

8. **잔여/다음 gate:** 이번 요청 원복 완료. 현재 유효한 작업 기준은29차까지이며 취소된 취향 공간을 이어가지 않는다.25~29차는 계속 로컬 미커밋, 기준2c1811d/codex/phone-test다. 실폰/Safari/hosted 및 원격 동기화/기존 W/Q/D 출시 잔여는 그대로다. 새 외부 차단 없음. 다음 작업1개는 기존29차 감상 기록 동선의 사용자 검토이며 추가 구현은 새 요청을 따른다. 운영 배포/DB/Public/Android는 이번 원복 대상이나 신규 승인 대상이 아니다.

## 31차 — 핵심 기능 비교와 Web/DB 운영 반영 (2026-10-07)

1. **읽은 문서/기준:** AGENTS→START→확정 결정01, 제품02/Title Hub·dual-view spec, 감사03·UGC05·구조06·QA07·runbook08·변경09, PLANS, 기존 interface-rebuild 및 인계/이 보고/단일 작업판. 운영 moemoa.xyz는 www로 이동하고 build-info source=vercel-git/SHA06d2e38d79d38c66753f0ec25a21b615bdc5fa60, origin/master도 동일했다. 당시 workingTreeDirty=true와 Vercel 성공/CI37461754826 성공은 **배포 전 조회 결과**다. 현재 개발 시작2c1811d 이후25~29차 미커밋과 master4ead72b 검토 checkpoint를 보존하고 취소30차를 다시 넣지 않았다. 실제 컴파일된 운영 client의 catalog/계정 host와 Supabase dashboard를 대조해 운영 ref okchpyagfucpzpyrfgol(이름 moemoa-preview)을 확정했다.
2. **가정/미확정:** 사용자의 이번 직접 승인으로 필요한 비파괴 DB 적용 및 master merge/push/Git 배포를 수행한다. 반복 승인 질문 없음. 실물 휴대폰·새 Google OAuth 사용자 전체 검증, 자체 catalog TitleState/WatchLog 전체 원격 모델 선택(TITLE-STATE-SYNC-01), 공개 출시 정책/백업·비용/권리 gate는 이번 일반 Web 배포로 완료하지 않는다. 기존 운영 로그인/수동 sync는 보존한다. Public schema는 운영에 없고 flags도off인 기준이며 이는 이번 변경의 기능 삭제가 아니다.
3. **계획:** 기존 `plans/2026-10-03-interface-rebuild.md`의31차를 소스 변경 전에 추가했다. 기존 M0~M5/W01~W20/C01~C12/Q01~Q24/D01~D06을 유지한다. 신규 진행판/계획 트리 없음. 현재 기능 감사→누락 최소 수정→로컬/hosted 검사→DB 적용→master/Vercel 같은 SHA→운영 읽기 확인 순서다.
4. **변경/핵심 기능 비교:** 아래 표는06d2e38의 계약과 현재 구현을 비교한다. 단순 route 존재를 사용자 동작 PASS로 대신하지 않았다. 이번 추가 소스는 TitleWatchRecords/TitleHub·TopNavDataMenu의 이력 관리 진입, Library 기존 캐릭터 snapshot fallback, MemoryBoardView.jsx:132–136의 flag 내 미니홈 진입 복원과 memory-board.css:65–76의 모바일 선택 메뉴 폭 보완이며25~29차 유효 변경도 함께 배포한다. 이전 상세 폼 테스트는23차 읽기/수정/관리 탭에 맞게 갱신했다. 신규 필수 회귀를 quality CI에 넣었고 npm production 의존성 변경0이다.

| 중요한 기능 | 현재 결과/보완 | 소스·실행 증거(저장소 상대 경로:행 범위) |
|---|---|---|
| 작품 검색/명시 저장·표지/기억 두 보기·장르/열 수 | 동일 작품 집합, 저장만으로 Memory 생성0; 보기 옆 탐색 | TitleHub.jsx:35–60, TitleCollectionView.jsx; tests/title-collection.spec.ts:68–192 |
| 별점·시청 상태·정주행·날짜/감상 작성 | /record/ 목적 선택→같은 작품 감상 탭; 이미지 없이 작성,0점/미평가 구분 | TitleWatchRecords.jsx:13–125, titleWatchRecordWriter.js; tests/watch-record-flow.spec.ts:66–248 |
| 기존 감상 이력 편집/삭제·context 태그/캐릭터 | 기존 Library editor 진입 복원; fresh 캐릭터 조회 실패에도 저장 이름·이미지·role 보존 | TitleWatchRecords.jsx:105–115, TopNavDataMenu.jsx:341, Library.jsx:1073–1088/1282–1301; tests/watch-record-flow.spec.ts:42–64 |
| 사용자 이미지·시스템 디자인·공식 표지 Memory | 원본/preview 보존·교체 실패/취소, explicit cover+개인 신호; 기존 완성 조건 유지 | MemoryCardComposer.jsx:66–80/184–267; tests/web-image-intake.spec.ts:16–94 |
| 상세 수정/관리·캐릭터/커스텀 태그·Archive 분류 | 읽기/명시 수정/관리와 실제 카드 classification; 필터→상세→필터 복귀 | MemoryCardDetail.jsx:299–343, ArchiveView.jsx:57–123; tests/memory-classification.spec.ts, channel-service.spec.ts:131–149 |
| 컬렉션 선반·표지 뒤 실제 기억·옆 펼침 | 선반 편집/적용/취소·표지·검색/선택됨; 최대3 preview, 같은4개 전체 기억은 상세 유지 | BookshelfView.jsx:47–70, BookshelfEditor.jsx:5–45, TitleMemoryStack.jsx:5–20; channel-service.spec.ts:35–129/151–228/280–308, bookshelf-editor.spec.ts:24–116 |
| Board N:M/정렬/삭제·Archive 독립 | 같은 카드 다중 보드·순서/삭제 tombstone/Board 보존 | tests/memory-board.spec.ts:39–152, service-finishing.spec.ts |
| 계정·승격/수동 sync·기존 tier/pin·백업/복원 | 기존 메뉴/저장소 유지; IDB-only/재로드·기존 legacy sync·원복/백업 보존 | memory-account-sync.spec.ts:184–308, storage-hydration.spec.ts:143–385; snapshotCodec.js:521–537/679–689, syncRepo.js:587 |
| 새 카드 분류 원격 save/pull/conflict/promotion | 테스트 실제 SDK+HTTP 및 운영 실제 RPC rollback 계약 통과; 구client가 새tags를 지우지 않음 | SupabaseMemoryGateway.js:200–202/258–259/364–388, migration20261005090000; 아래 hosted 증거 |
| 자체 catalog-only 시청 이력 원격 한계 | 로컬/IDB/두 백업 보존; legacy apply가 삭제하지 않고 AniList0으로 업로드하지 않음. 신규 전체 remote 모델은 미구현/미완료 유지 | cloudSyncTables.js:60–82, snapshotCodec.js:679–682, watchLogRepo.js:231–239; watch-record-flow.spec.ts:95–149/172–189 |
| Public/신고·차단·moderation·철회 | 보드 상세→내 미니홈 진입 누락 복원/모바일 넘침 보완, 기존 구현/로컬 회귀 보존, 운영 flags off. 실제 공개 활성 테스트 PASS를 이번 배포로 추가하지 않음 | publication-ui.spec.ts, publication-boundary SQL; .env.production |

5. **DB/데이터/롤백:** version-controlled `supabase/migrations/20261005090000_memory_card_classification.sql`만 선택 적용했다. canonical LF SHA256=ab422e1e50a35c2f5eb1f0015409fab5eb4444dae3e4fb21d7c6e8393b6b6e64. Test data release=MOEMOA_TEST_CARD_CLASSIFICATION_20261007_31, prod=MOEMOA_PROD_CARD_CLASSIFICATION_20261007_31. 변경 전 schema/함수/권한·제약/트리거 backup은 ignored .cache/v84-service/release31-{test,prod}-schema-before.json에 보관한다. test 기존23카드 수/기존 rows fingerprint·설정 유지, 합성계정2개만 생성/정리했다. 운영 기존0카드/fingerprint 동일, 익명 raw SELECT 불가, 기존3 wrapper ACL 유지, migration history/notify reload 반영. 운영 transaction에서 synthetic auth/draft save/read·구payload tags 보존·삭제 scrub 후 ROLLBACK하여 지속 synthetic자료0 확인했다. 최신 공개/삭제 fence나 legacy 데이터 삭제/승격0. 다른 과거 migration을 일괄 적용하지 않았으며 향후 전체 Public/private-image SQL 실행 전 버전과 wrapper chain을 재대조해야 한다. rollback은 새 classification flag0/클라이언트 이전 Git 후보로 복귀하고 column/태그/이력은 보존한다. 자동 stale DB restore/drop 금지.
6. **이번 실제 명령/결과:** 아래 검사는 이번31차 실행이며 이전20~30차 PASS와 합산하지 않는다. logs는 ignored .cache/v84-service/release31-*에 남겼다.

| 명령/검증 | 이번 결과/한계 |
|---|---|
| npm run test:unit |424 PASS/0 fail/0 skip |
| npm run catalog:test |256 PASS/0 fail/Windows 플랫폼 검사2 skip |
| wsl -u postgres -e env PG_BIN=/usr/lib/postgresql/16/bin bash /mnt/e/web/anime/tools/publication-boundary/run-local-postgres.sh | exit0 PASS, 실제 local PostgreSQL 계약/경쟁조건; hosted 아님 |
| 같은 WSL 명령 tools/card-classification/run-local-postgres.sh |19 assertion PASS |
| node scripts/run-channel-e2e.mjs +watch-flow/library-userflow/memory-board/service-finishing/web-image-intake/source-independent-title/bookshelf-editor/title-collection | 최종98개 중96 PASS/2기존 환경 skip/0 fail. 초기115개108 PASS/3 FAIL/4 skip와 관리98개94 PASS/2 FAIL/2 skip는 보존; 이전 상세 UI selector/잘못된 새label을 보정하고 재실행한 결과이며 합산 안 함 |
| node .cache/release31-webkit.mjs |35/35 PASS. 기존 Playwright WebKit26 runtime만 공식 경로에서 설치. 초기28 PASS/7 FAIL은 fixture init-script 상대 import와 기존 backlink selector였으며 origin을 명시/현재 header link로 고쳤다. focused3 PASS 후 같은 전체35 PASS, 중복 합산 없음. 실물 iPhone/Safari 아님 |
| node scripts/run-channel-e2e.mjs tests/title-cross-surface.spec.ts tests/publication-ui.spec.ts tests/layout-mobile.spec.ts tests/index.spec.ts tests/storage-hydration.spec.ts | 최종128개 중127 PASS/1기존 환경 skip/0 fail. 초기115 PASS/12 FAIL/1 skip는 보존했다. 실제 누락인 보드 상세→미니홈 링크와320px switcher2px 넘침을 복원/수정했다. 나머지는 승인된 Collection/기록 분기 및 상세 관리 탭의 과거 selector를 갱신했다. focused12에서10 PASS/2 FAIL 후 두 원인을 보완해2 PASS, 마지막 동일 전체128 회귀127 PASS/1 skip. 반복 합산 없음 |
| node .cache/release31-hosted-classification.mjs | 실제 test Supabase SDK/HTTP12checks PASS: exact save/read, operation replay, 구client 보존, conflict/current-version resolve/pull, Guest 승격, 새column owner scope/익명거부, tombstone scrub, 합성계정 정리 |
| 운영 SQL editor에서 tracked migration transaction/postflight/rollback-only contract | 실제 운영 DB 적용/기록/권한/기존 데이터 보존 및 rollback-only 계약 PASS. Google/browser 운영 로그인 flow PASS라는 뜻 아님 |
| npm run build | 최종20 pages PASS/exit0. 기존500kB chunk 경고 유지 |
| git diff --check 및 staged secret/개인자료 검사 | Git 직전 결과와 배포 결과는 아래 최종 증거에서 확인 |

7. **보안/권리/관측:** DB 비밀키·비밀번호·raw private 데이터/브라우저 인증정보·사용자 사진·노트·선반명·검색어를 Git/일반 로그에 넣지 않았다. 실제 사용자 브라우저 데이터에는 QA 쓰기를 하지 않았다. test SQL 설정은 기존값 그대로이며 운영 새 classification sync만1, private-image/Public/mini-home/follow/moderation 기존off 유지. 계정 수동 metadata sync가 사진 자동 업로드나 공개가 되지 않는다. 새 analytics payload/권리 승격/유료·성인 인증·Android 변경0. evidence에는 release ID/hash와 검사·배포 상태만 기록한다.
8. **잔여/다음1개/배포:** 이번 유효 Web 구현 및 새 DB 필드 계약의 미해결 회귀는 최종 검사/배포 결과로 판단한다. 기존 실물폰·자체 catalog 전체 remote 기록·운영 Public/CDN 실제 철회/정책·비용·복구 사본/경보는 그대로 미완료다. 새 유료·법적/권리 범위·Public 활성화를 임의 승인하지 않는다. 현재 Git/Vercel 검증이 남았으며 결과는 [31차 배포 증거](../release-v2/evidence/2026-10-07-web-design-deployment.json)에 같은 후보 SHA로 기록한다. 다음1개는 **배포된 링크에서 실제 휴대폰 감상 기록→장면 저장→재열람 확인**이다.
