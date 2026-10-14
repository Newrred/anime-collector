# 화면·이동 개선 운영 후보와 확인 절차 — 2026-10-14

## 1. 읽은 근거
상위 THIS_PC_HANDOFF, repo AGENTS/START/확정 결정/PLANS, 기존 W18·07/08/09·단일 작업판/수용 계약, 두10/14 검수 보고, 운영 Git/실제 www/Vercel metadata와 실제 src/tests/workflow를 대조했다.

## 2. 승인과 기준
사용자 “문제 없으면 지금까지 작업 본 운영으로 업뎃 ㄱㄱ”로 이번 검토 UI 운영 반영 승인 충족. 기준 운영5d544ad2ca83e847df623b2abfe7bbcaf2158801, 검토 원본6e2a412..0be7c4a의 두 commit7e8bd78/0be7c4a다. 운영 기준의 app/API/schema/deps/workflow/tests는 검토 시작점과 동일하다. 이 보고는 배포 전에 후보와 검증 절차를 기록하며 실제 완료 결과를 미리 SUCCESS로 기록하지 않는다.

## 3. 계획
기존 release-v2/01의 W18 화면·이동 개선 운영 반영 ExecPlan17항. 운영 전용 checkout에서 준비하고 정확 후보 전체CI가 통과한 뒤 master Git 배포한다.

## 4. 변경과 목적
원본58파일의 UI·경로/메뉴·hooks/layout·회귀 검사·quality 단계와 관련 보고/명세/최신 인수 문서를 포함했다. 새 문서/근거 JSON은 이미 검토한 개발 인계의 보존용이다. 별도 운영시험 도구16개 전체 병합 없음. 검토53개 src/tests/workflow는0be7c4a와 blob 단위로 일치한다. 이후 원격CI에서 발견한 admin-ui 검사3개만 관리자 status 영역으로 한정하며 사용자 동작/권한/쓰기의 assertion은 유지했다.

## 5. 데이터·복귀
DB/Storage/API/auth repository/계정 초기화/공개 controller/권리/환경/flags/한도/의존성·lock·실자료 변경0. 회귀는 UI patch의 Git revert→동일CI/Git배포로 복귀한다. DB 복원 없음. 동시master drift는 덮어쓰지 않는다.

## 6. 검증과 실제 운영 확인
검토 원본의 고유 Chromium117/단위630/build33 PASS. 정확 운영 후보에서 단위630 PASS·실제 이동/편집/collection30 PASS·build33/postbuild exit0를 다시 확인했다. source Doctor0.9.11은 기준34→후보34,536→531개·신규rule/file0이며 제외한 개발 도구의 진단과 기존 경고 감소를 구분한다. 운영master 대비diff의PublicTitleShelf 경고1개는 기준에도 같은file/rule로 존재한다. 기존 전체 진단을 해결했다고 주장하지 않는다. 검토 원본의diff0과 이번master 대비diff1을 혼동하지 않는다.

최종 완료 조회: 원격master SHA에 해당하는 GitHub **Service quality** publication-contract/verify 두 job SUCCESS, Vercel Production source git/master·READY·www alias, https://www.moemoa.xyz/build-info.json의 commit=checkoutCommit=master·source=vercel-git·semanticMatch=true. 빈 guest Chromium에서 주요3회 문서 이동0/같은 메뉴·Back/Forward/계정 버튼·1440/390/320·JS예외를 읽기로 확인한다. localhost build를 hosted 성공으로 바꾸어 쓰지 않는다.

실패 이력: 첫 후보724bf62의CI38498176100에서 SQL/publication-contract SUCCESS, verify의admin3개가 새검색status/관리status의 전역 locator 중복 때문에 strict 오류로 실패했다(18PASS/3FAIL). 동일3개 로컬 FAIL 재현 뒤 scope만 교정했고, 관리자17/OAuth복귀4=21개 전체 무재시도 PASS를 확인했다. 기존30과 다른51개 로컬 browser PASS이며 검토 원본117과 합산하지 않는다. 실패 후보는master에 배포하지 않으며 새SHA 전체CI로 마감한다.

두 번째3f25cac/CI38498579440은 관리자 성공, desktop52 중 옛/library→/titles 준비 전 입력1개가 route scope 갱신 때 지워져 실패했다(51PASS/1FAIL). artifact의최종My Titles/빈input을 확인했고, 로컬 빠른 전환은PASS/합성1초canonicalfetch지연은같은FAIL로 재현했다. 기존helper에서canonicalURL/본문 준비를 확인한 뒤 입력하도록 보완하고 지연회귀를 유지했다. runtime은검토원본과 동일하며 저장1행/정확title/Memory0/Native 조건을 유지한다. 적합한desktop 격리환경52개 무재시도PASS로 마감했다. 후보 로컬30+21+52=103고유이며 과거117/반복실행과 합산하지 않는다. 실패후보2개 운영 배포0.

## 7. 보안·권리·관측
새 analytics/키/환경/사진/검색어·private DTO 로그 없음. owner/dirty/busy·새 공개 선택/동의/철회 경계 유지. 실제 계정의 로그인/수락/게시/신고/삭제/설정 변경 없음. 배포 직후 프로젝트 runtime 오류 읽기를 시도하고 결과/도구 제한을 구분해 기록한다.

## 8. 남는 한계와 인계

### 개인 사진 재시도와 quiet navigation 연결
18310f2/CI38502561444는public54까지성공, signed composer21에서20PASS/1FAIL이었다. 두번실패한사진은durable intent와카드/원본을보존했지만상세화면으로soft이동후post2에서멈췄다. 같은1개localFAIL을재현했다. persisted메뉴가재마운트되지않으므로기존onResume를astro:page-load에도등록/정리한다(useMemoryAccountSync.js의2행). 기존ready/current-user·online/visibility/pause/in-flight/session/owner/asset/sourceVersion검증과명시Save로기록된queue만사용한다. 새사진을queue하거나권리를부여하지않는다. original0be7c4a와다른runtime은one-time안내의top-window2행과이동완료resume2행이다.

보완뒤사진/모바일41PASS(실패1/2회회복·카드1·원본보존·queue0 포함), Core/Channel/동기화·계정경계/navigation/collection140PASS/기존5SKIP·FAIL0, unit631PASS. sourceDoctor34→34/536→531·신규rule/file0, masterdiff1은기존PublicTitleShelf경고다. 각묶음/과거검사의중복은합산하지않는다. Supabase[현재SDK session 문서](https://supabase.com/docs/reference/javascript/auth-getsession)와[2026-10-12 TLS 변경](https://supabase.com/changelog/cbc-tls-ciphers-deprecated)을읽고SDK·TLS·서버검증을교체할필요없음을확인했다. 이재시도회귀의해소를기존실제개인사진로딩원인전체해소로보고하지않는다. 실패후보는운영미배포이며최종exactSHA의전체quality 성공후배포한다.

### 공개 준비 fixture의 안정화
c6439f3/CI38500772041은core까지성공했고public54는26PASS/28FAIL이었다. 모든실패는shared seedOwner의빈이름기대가이미검토된원본이름draft제안과불일치해서발생했다. 같은환경의local54는빠른loading빈값을읽어PASS했으므로controller준비후이름을기다리게해같은1FAIL을재현했다. fixture를draftName 확인+설명빈칸+기억자동선택0+최종게시버튼0으로보완하고54개전체무재시도PASS를확인했다. 이후기존Public collection 이름입력·freshreview/consent·권리·철회·원본/계정조건은그대로검사한다. 런타임/서버변경은추가하지않는다. 새정확SHA의전체CI가성공하기전에는master배포하지않는다.

### 후속 검증 — 세 번째 후보 이후
2c7b651/CI38499379483의desktop52는성공했고 core52 중 board→card click 후동기URL 읽기1개가 실패했다. local Core/Channel126의117PASS/5기존SKIP/4FAIL을대조해 검색label/빈컬렉션/묶음accessible name은현재계약에맞추고, cardURL은완료를기다린뒤 같은ID/returnTo를검사한다. 실제저장·권리·계정코드를완화하지않는다.

합성Storage추적에서Astro DEV 준비iframe(frame=false)이 one-time first-memory seen을먼저기록하는원인을확인했다. application/firstMemoryViewSuggestion.js의소비를top window에한정했다. 검토원본UI와다른runtime은이2행 presentation fence뿐이다. Nodeunit은631PASS로늘었고 iframe→visible소비1회/원본pending보존을검사한다. 임시Storage trace코드는제거했다. 마지막Core/Channel+navigation+collection145개는140PASS/기존5SKIP/FAIL0, source Doctor34→34/536→531·신규rule/file0. 기존103이나원본117과중복합산하지않는다. 전체public54와환경별게이트는새정확SHA의CI로검사한다.

첫 방문·내용 데이터/계정 확인·외부/auth/Native 및 네트워크 실패 fallback은 남는다. 실제 큰 archive/물리기기/Safari·개인 이미지 문제·전체 복구/임계 알림·미실행Q·10/18 첫 백업 관찰은 기존 별도 잔여다. 완료 receipt는 이 PC 상위 .tools/production-ui-navigation-release-20261014.json 및 THIS_PC_HANDOFF에 기록하며 다른 PC에서는 위Git/CI/Vercel/www 절차로 현재 상태를 재조회한다. 추가 UI 운영 승인 대기는 없으며 검사 실패는 먼저 해결하고 반영한다.
