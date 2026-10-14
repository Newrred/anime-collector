# 컬렉션 문서·실제 화면 대조와 보완 — 2026-10-14

사용자의 “문서랑 실제 화면 차이부터 검수하고, 빠진 부분이나 개선할 부분 있으면 이어서 작업 진행” 요청에 따라 실제 화면의 차이를 재현하고 로컬 후보를 수정했다. 작품 선반·이미지 보드의 탐색을 하나로 정리하고, 잘못된 선반 진입과 미저장 입력 손실을 막았다. 공유 선택의 PC·모바일 배치, 공개 상태 표시와 일부 표지 실패도 보완했다. 새 운영 배포나 DB 적용은 이 작업에 포함하지 않는다.

## 1. 읽은 문서와 대조 기준

- 상위 `AGENTS.md`, `THIS_PC_HANDOFF.md`, 저장소 `AGENTS.md`, `CODEX_START_HERE.md`, 확정 결정, `PLANS.md`, release-v2의 계획·수락 계약·단일 작업판.
- 첨부 `MOEMOA_COLLECTION_HOME_REALIGNMENT_2026-10-13.zip`의 README·검토 명세·실행 노트와 저장소 `references/collection-home-realignment-20261013/`의 같은 문서. 차이는 두 문서 머리말의 Markdown 줄바꿈용 공백뿐이며 요구 내용은 같다. 첨부의 실행 문구를 별도 운영 승인으로 사용하지 않았다.
- 실제 시작 소스 `6e2a4124387a0e8a4b484c7dfa382e1c3f05cb8a`. 시작 인수에서 앱 코드가 운영 `5d544ad`와 일치함을 확인한 개발 인계다. 개발 브랜치 전체에는 별도 테스트 도구도 있으므로 운영 master 전체 병합 대상이 아니다.
- 소유자 `BookshelfView`, `CollectionGroups`, `BookshelfEditor`, 공개 설정 `MemoryMinihome`·`MemoryPublicationPanel`, 방문자 `MinihomeSnapshot`·`PublicTitleShelf`, 기존 컨트롤러·게이트웨이·소유자 경계와 해당 검사.

## 2. 요구사항·실제 차이·최종 처리

아래 행 번호는 이 수정 후보의 소스 기준이다. 합성 브라우저의 동작 결과와 함께 읽는다.

| 문서 요구 | 실제 시작 상태 | 보완 또는 유지 근거 |
| --- | --- | --- |
| 컬렉션을 하나의 작업 공간으로 사용 | 기존 `/boards/`, `/minihome/`가 별도 화면에 남음 | 통합 기능이 켜진 환경에서 옛 보드 ID와 following/safety 주소를 컬렉션의 같은 역할로 연결. 기능 OFF의 기존 화면은 유지. `collectionLegacyRoute.js:1–12`, `CollectionLegacyRedirect.jsx:5–10`, `MemoryMinihome.jsx:134–137`, `MemoryBoardView.jsx:13–19` |
| 선반 직접 진입·새로고침 | 탭은 요청 선반인데 내용은 전체 선반으로 초기화 | 단일 group에서 실제 shelf를 도출. 요청 선반 하나만 표시되고 부재 선반에는 복귀 안내. `BookshelfView.jsx:30–38,115–118` |
| 두 종류 묶음의 공통 탐색 | old Shelves 선택기와 typed 그룹 탐색 중복 | 중복 3열 메타 영역 제거, 공통 그룹 탭과 내용별 검색·보기만 남김. 보드에는 작품 검색·표 보기 제거. `BookshelfView.jsx:92–97,109–114`, `CollectionGroupTabs.jsx:1–7` |
| 전체 화면도 저장된 묶음 순서 사용 | 작품 선반의 합집합 뒤에 보드가 따로 나옴 | 저장된 typed 순서로 각 선반과 보드를 렌더링. 같은 작품의 선반별 배치는 기존 참조이며 새 Memory가 아님. `CollectionGroups.jsx:22–27`, `BookshelfView.jsx:87–91` |
| 공통 추가 메뉴에서 두 종류 선택 | 기존 보드 연결만 직접 제공 | 작품 선반 만들기와 이미지 보드 연결을 선택. 새 선반 적용·취소·새로고침, 원래 순서·멤버십 보존 확인. `CollectionGroups.jsx:29–44`, `BookshelfEditor.jsx:5–17` |
| 기존·간편 공유 원본 유지 | 원본을 자동 편입하면 내부 공유 보드까지 노출될 수 있음 | 자동 편입하지 않음. 옛 주소로 진입한 미연결 보드는 사용자가 선택해서 연결. homeId/boardId/cardId·멤버십과 공개 URL은 유지. `CollectionGroups.jsx:34` |
| 작품 표지 뒤 개인 기억 탐색 보존 | 기존 팬·열기·닫기 구현이 있음 | `CollectionTitleShelf`로 추출해 그대로 재사용. 선반별 확장 ID로 한 작품의 여러 배치를 구분. 기존 PC·모바일 팬/작품 탐색 회귀 유지. `CollectionTitleShelf.jsx:5–18`, `BookshelfView.jsx:42–53` |
| 편집 중 이동·작업 보호 | Following/Safety가 sharing의 dirty/busy 검사를 우회 | 모든 헤더 작업을 같은 전환 검사로 연결. 거절 시 소개 입력 보존, busy·선반 편집 중 이동 비활성. `BookshelfView.jsx:29,39,94–96` |
| 공개 상태를 실제 서버 결과로 표시 | 읽기 전 ‘비공개’로 보이고 가려진 공개 상태도 혼동 | 확인 중·실패/재시도·공개·현재 방문자 비노출을 구분. pending/busy 검사. `CollectionProfile.jsx:5–25` |
| 기존 소개·선택을 복원, 미게시 변경 구분 | 기존 selection hydration은 구현되어 있음 | 기존 nickname/bio/entries 복원은 유지. 미게시 초안 상태와 선택 수·순서 표시 추가. `MemoryMinihome.jsx:31–58,61,98–107` |
| 읽기 가능한 공유 작업 배치 | 보드 공유는 이미 제한 폭/2열, 컬렉션 설정은 세로 폼 | 기존 보드 구조를 보존하고 컬렉션 설정도 왼쪽 입력·오른쪽 선택으로 정리. 모바일 1열 작업/2열 선택/안전영역 행동 바, 작은 디자인 카드의 글자 잘림 보완. `MemoryMinihome.jsx:71–108`, `memory-publication.css:53–112` |
| 처음 공개할 때 필요한 입력을 줄임 | 선반·보드 공개 이름을 빈칸부터 입력 | 명시적으로 선택한 원본 이름을 미제출 초안으로 제안. 기존 저장된 공개 이름 우선. 사적 설명·본문·카드 선택·동의를 자동 복사하지 않음. `MemoryPublicationPanel.jsx:103–113,156`, `MemoryMinihome.jsx:79` |
| 일부 표지 실패의 회복과 게시 경계 | 한 resolveCover 실패로 모든 정상 표지까지 사라짐 | 정상 표지는 표시하되 실패 상태와 onReady=false를 유지. 입력 rerender마다 같은 표지를 다시 읽지 않도록 안정화. 필수 표지가 준비되지 않은 미리보기는 새 동의 후에도 게시 불가. `PublicTitleShelf.jsx:5–24` |
| 방문자는 허용된 부분만 보고 링크 의미가 분명 | schema2도 일반 Public home, 작품 클릭의 ‘내 기록’ 주체 불명확 | Public collection 제목, 공개된 그룹에만 URL 선택 복원, 작품 정보/방문자 자신의 기록 안내. visitor에서 owner source/RPC를 읽지 않음. `PublicMinihome.jsx` 제목, `MinihomeSnapshot.jsx:19–36`, `PublicTitleShelf.jsx:28` |

이미 구현된 typed 공개 DTO, 승인 표지만 있는 작품 공개, sourceVersion/reviewHash/fresh policy·rights·owner 경계, 저장된 선택 복원, 철회·차단·신고 엔진과 공유 중 원본 목록 가리기는 중복 구현하지 않았다. 이번 작업을 새 공개 엔진·마이그레이션으로 확대하지 않았다.

## 3. 계획과 가정

계획은 `release-v2/01_RELEASE_EXECUTION_PLAN.md`의 **W18 문서와 실제 화면 대조 후속 ExecPlan — 2026-10-14**다. 격리된 `codex/collection-screen-review-20261014`에서 재현→수정→영향 검사→로컬 실행 폴더 반영 순서로 진행한다. 실제 작업 판정은 `03_RELEASE_WORKBOARD.md` 하나에만 기록한다.

통합 경로는 기존 collectionHomeEnabled가 켜진 경우에만 전환한다. 이 PC의 기존 환경 값을 바꾸어 운영 계정이나 공개 기능을 활성화하지 않는다. 실계정과 개인 사진 문제를 합성 fixture의 성공으로 완료 처리하지 않는다.

## 4. 변경 파일과 목적

소유자 탐색·편집·소개: `BookshelfView.jsx`, `BookshelfEditor.jsx`, `CollectionGroups.jsx`, `CollectionProfile.jsx`, `CollectionTitleShelf.jsx`, `collection-home.css`, `CollectionGroupTabs.jsx`.

경로 호환: `collectionLegacyRoute.js`, `CollectionLegacyRedirect.jsx`, `MemoryBoardView.jsx`, `MemoryMinihome.jsx`. 새 보드 작성은 기존 `MemoryBoardContent`를 컬렉션 작업 안에서 재사용한다.

공유·방문자 표현: `MemoryPublicationPanel.jsx`, `MinihomeSnapshot.jsx`, `PublicMinihome.jsx`, `PublicTitleShelf.jsx`, `memory-publication.css`. 정책 본문·API·인증·DB·공개 컨트롤러는 변경하지 않았다.

검사: 신규 `tests/collection-document-audit.spec.ts`, `tests/unit/collectionLegacyRoute.test.mjs`. 기존 `bookshelf-editor.spec.ts`는 합집합 대신 실제 선반별 표시를, `collection-home.spec.ts`는 공통 추가 메뉴를 검증하도록 보완했다. 권리·복원·원본 보존 검사를 삭제하지 않았다. quality workflow의 기존 격리 컬렉션 검사에 새 파일을 포함했다.

## 5. 데이터·마이그레이션·롤백

DB/Storage/원격 설정/권한/공개 범위/실계정 자료 변경 **0**. 새 의존성과 잠금 파일 변경 **0**. 기존20선반/40layout/10공개묶음 한도, 참조 ID·저장 형식·서버 hash/version을 유지했다.

복귀는 이번 UI/경로 patch의 Git revert로 가능하다. 데이터 복원·SQL 재실행이나 계정의 개인 원본 삭제는 필요 없다. 기존 브랜치·환경·복구 자료와 이전 비교 산출물은 보존한다.

## 6. 실제 실행·검증 결과

런타임은 프로젝트 Node24.19.0/npm11.17.0. 주 실행 폴더의4363과 검증 checkout/cache를 분리했고, 각 checkout에서는 Astro 검사와 build를 순차 실행했다. 외부 API는 합성 adapter 또는 차단을 사용했다.

| 검사 | 결과·근거 |
| --- | --- |
| 수정 전 차이 재현 | 신규 회귀4개 실제 FAIL: 선반 진입, typed 순서/내용 도구, 공통 추가, dirty 이동. `collection-review-reproduced.log`. 기준의 기존 컬렉션4개 PASS와 구분 |
| 전체 단위 | `node tests/unit/run-tests.mjs`: **626 PASS / 실패0 / skip0**, 새 경로의 중복ID·과대ID·외부/역슬래시/제어문자 base 경계 포함. `collection-review-unit-final.log` |
| 기존 공개 흐름과 신규 회귀 | publication-ui54 + 신규8 =62 PASS. `collection-review-public-final.log`. 실 Google/hosted 실행은 아님 |
| 최종 UI와 작품 탐색 | 신규8 + 기존 컬렉션4 + 선반 편집2 + 작품7 + 디자인 회귀8 = **29 PASS**. 새 선반 Apply/취소/순서/재실행, 작은 카드 글자 영역, 폭1440/390/320 검증. `collection-review-ui-final.log` |
| 고유 브라우저 범위 | 위 두 실행의 중복 신규8을 제외하면 **83개 고유 시나리오 PASS**. 사진·국가·전수 기기 QA 전체 완료 수치가 아님 |
| 최종 빌드 | **33페이지 PASS**, postbuild 완료·exit0. `collection-review-build-final.log` |
| React Doctor | 최신0.9.18은 repo 설치/agent 파일 변경을 요구해 소스에 설치하지 않음. 같은 캐시0.9.11로 비교: 생성 산출물이 없는 동일 소스 범위 **34→34**, 진단536→533, 새 rule/file **0**. 전체 기존 진단은 남아 있음. diff18파일에서 기존 PublicTitleShelf의 prop 변경 effect 경고1개 남음. `collection-review-doctor-source-baseline.log`, `source-final.log`, `diff-final.log` |
| 생성 artifact 검사 구분 | 최초 full-after33점은 새 build 산출물의 BaaS map 경고1개가 포함된 범위였다. 결과를 삭제하지 않고 산출물을 별도로 보존한 뒤 clean tracked baseline과 source-only 범위를 대조했다. 이 경고가 해결됐다고 주장하지 않으며 새 서버 권한/키 변경과도 구분한다 |
| 변경 검사 | staged/unstaged `git diff --check` PASS. 기존 정적 오류370개는 이번에 전부 해소하거나 새로 전수 검사한 수치가 아님 |

검사 로그는 이 PC의 `D:/hong/Web/Anime/.tools/` 아래에 있다. 기능 OFF/ON 경로, 공개 사본/owner 분리, 새 동의·부분 실패의 게시 금지, 원본 유지·철회·계정 전환을 함께 검사했다. quality workflow의 실제 collection runner와 같은 환경 flags로12개도 별도 PASS(`collection-review-ci-equivalent.log`); Windows 검증 서버에서만 CI transport를 해제했고 원격 GitHub CI 성공으로 대신 보고하지 않는다. 실제 비교 캡처에서 추가로 확인한 모바일 선반의 너무 작은4열 표지는2열로 고쳐3폭의 타일 너비120px 이상을 측정했다. 마지막 typed 오류 안내도 ‘보드/대표 기억’ 대신 두 종류 묶음의 선택을 설명한다. 이 표현/CSS 수정 뒤 build와 영향받은 동일 typed 시나리오를 재검사했다. 통과한 같은 테스트를 반복 캡처했다는 이유로 고유 수를 늘리지 않는다.

## 7. 화면·개인정보·권리·관측

전후 자료는 `D:/hong/Web/Anime/.tools/collection-review-comparison-20261014/`에 둔다. 같은 합성 시나리오로 소유자1440/390/320, 방문자PC/mobile, 공유 미리보기와 공유 선택1440/390/320을 비교한다. 추가 장면은 보드 탐색·작은 공유 카드·부분 표지 실패다. 입력 ID는 재생성될 수 있으며 실제 계정·원본·환경·키는 없다. PNG의 파일 해시와 경로는 manifest에 기록한다. 이전59909 비교는 그대로 보존한다.

새 analytics·사용자 본문 로그·원격 업로드·실제 게시/철회/신고/정책 동의 실행 **0**. 미니홈/공유 테스트의 동의 체크는 격리 mock에만 적용한다. 승인 표지 resolver를 유지하고 개인 사진을 표지로 대체하지 않는다. 초안 이름 제안은 게시나 동의의 자동 완료가 아니다.

## 8. 남는 한계와 다음 작업

이 후보는 로컬 문서·화면 보완 완료 범위다. 새 운영 배포·Vercel 활성·migration·실계정 가입 절차를 완료로 보고하지 않는다. 기존 개인 이미지 로딩 원인, 물리 기기/키보드·Android 전수, 전체 Public/Storage 복구 serving·ingestion history, 실제 용량 임계 알림 수신은 남아 있다. 일부 표지 resolve 실패의 표시 보완은 별도 개인 사진 문제의 해결이 아니다.

기존10/18 03:00 KST 주간 예약의 첫 결과는 예정 이후 읽기로 확인한다. 새 백업·예약을 만들거나 지금 수동 실행하지 않았다. 운영 반영을 별도로 진행할 때는 운영 master에서 이번 검토된 UI 범위만 옮긴 정확 후보를 검사하고 Git/Vercel/www 동일 소스를 확인한다. 개발 인계 브랜치 전체를 운영에 합치지 않는다.
