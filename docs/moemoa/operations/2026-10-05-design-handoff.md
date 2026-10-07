# MOEMOA 디자인 작업 재개 — 2026-10-05

> **32차 운영 인계(2026-10-07):** 작품 51개·감상 기록 22개의 PC→계정→iPhone Safari 동기화를 운영에서 확인했다. 자체 카탈로그 작품·WatchLog도 신규 계정 모델의 대상이고, 선반 설정도 포함한다. 테스트/운영 migration `20261007093000`을 다시 적용하지 않는다. 변경 코드와 기능 플래그는 master Git 배포 `ad1995a`부터 반영됐다. 최신 배포 SHA·검사·남은 범위는 [증거](../release-v2/evidence/2026-10-07-title-state-sync-production.json)를 따른다. 개인 사진·티어·캐릭터 고정은 이번 동기화 범위 밖이다. 아래 종료/31차 안내는 당시 이력이다.

## PC 종료 인계 — 2026-10-07

- 사용자 요청으로 이번 구현은 완료 상태에서 정리하고 PC를 정상 종료한다. 새 기능 작업은 시작하지 않는다. 종료 전 확인한 `6fbea0d621e476c7c4f62a1e5134fda92c283ca9`는 로컬/master 원격/실제 www.moemoa.xyz의 Git 배포 SHA가 같고 [CI37504154213](https://github.com/Newrred/anime-collector/actions/runs/37504154213)이 SUCCESS다. 구현 후보는0f46310이며6fbea0d는 문서만 변경한 동일 코드다. 이 인계도 문서만 master에 추가하고 최신 SHA는 `git log -1`과 운영 build-info에서 확인한다.
- 다시 시작할 작업1개: **배포 링크에서 실물 휴대폰 감상 기록→장면 저장→재열람 확인**. 이후 TITLE-STATE-SYNC-01의 자체 catalog 전체 원격 기록 모델 결정과 기존 공개 출시 정책·권리·비용·백업/경보 잔여를 이어간다. 취소30차/Android 제외, 운영 Public/private-image 비활성은 유지한다. 기존 테스트 전용 공개/다기기 절차를 운영에서 그대로 실행하지 않는다.
- 카드 classification migration20261005090000은 test/production 적용 완료다. 두 data release ID·hash·검사/복귀 절차는 기존31차 보고/evidence에 있다. 새 PC에서 전체 과거 migration을 일괄 적용하거나 이 migration을 반복하지 않는다. 종료 때문에 DB·권한·flags·사용자 자료를 다시 변경하지 않는다.
- 비밀 환경 설정과 DB 복구 자료/검사 로그는 Git 제외 상태로 이 PC에 보존한다. 브라우저의 개인 기록·이미지도 Git으로 이전되지 않는다. 새 PC는 기존 비밀 보관 경로의 개인 dev 환경 파일을 별도로 준비하고 기존 계정 동기화/백업 범위와 사진 원본의 기기 보관을 구분한다. 운영 이미지 자동 업로드는 수행하지 않았다.
- Node.js24.19.0을 준비한다. 새 checkout은 `git clone https://github.com/Newrred/anime-collector.git` 후 해당 폴더에서 아래 명령을 실행한다. 기존 checkout에 미커밋 작업이 있으면 먼저 보존하고, `--ff-only` 실패를 reset/force로 해결하지 않는다.

```powershell
git switch master
git pull --ff-only origin master
npm ci
npm run dev
```

Codex 재개 요청: **“AGENTS.md, CODEX_START_HERE.md와 최신 종료 인계를 읽고 기존31차/단일 release-v2 작업판 기준으로 이어가줘. 먼저 실휴대폰 감상 기록→장면 저장→재열람을 확인하고, 취소30차·Android 제외와 공개/이미지 동기화 게이트를 유지해줘.”**

현재 작업/배포는 완료됐지만 실물폰·새 원격 기록 모델·전체 공개 출시를 완료로 표시하지 않는다. 아래 날짜별 로컬 미커밋/미적용 상태는 당시 실행 이력이다.

> **31차 재개 기준(2026-10-07):** 현재 승인 범위는 master Git 운영 반영/카드 classification DB 갱신까지다. Web 코드0f46310은 master/Vercel Git 동일 SHA·CI37502913118 성공과 운영 읽기 확인까지 완료했다. 문서 후속 커밋도 master에서 이어지며 최신 commit/배포는 [증거](../release-v2/evidence/2026-10-07-web-design-deployment.json), 기능/검사/남은 범위는 [31차 보고](../reports/2026-10-05-v84-web-application.md#31차--핵심-기능-비교와-webdb-운영-반영-2026-10-07)를 따른다. 새 PC는 master를 clone/pull하고 Node24.19.0에서 npm ci 후 기존 환경 파일을 비밀 보관 경로에서 준비한다. 로컬 dev는 .env.production을 자동 사용하지 않으므로 기존 개인 dev 환경이 별도로 필요하다. 새 classification migration은 test/production 이미 적용됐으며 전체 과거 migration을 일괄 db push하지 않는다. 운영 참조 okchpyagfucpzpyrfgol, test nmgkhknponvzcwliajyk. 암호·DB 복구 자료·브라우저 개인 기록은 Git에 없다.30차 취향 배치는 취소 유지하며29차까지 선반/감상 흐름을 보존한다. 아래 로컬 미커밋/DB 미적용 표시는 과거 이력이다.

> **30차 취소/원복(2026-10-07):** 사용자 요청으로 새 취향 컬렉션/작품 탭 선반 이전을 제거했다. 아래29차까지가 유효한 작업 기준이며 취소된30차를 재개하지 않는다. 기존 선반/태그/감상 기록은 보존했다. 이번 unit424/관련 Chromium16/build20 및 실제4363 기존 화면 확인 PASS. [원복 근거](../reports/2026-10-05-v84-web-application.md#30차-요청-취소와-원복-2026-10-07). 배포/DB/flags 변경 없음.

> **현재 재개 기준(2026-10-07):** 아래29차가 최신 로컬 상태다. 원격2c1811d 이후25~29차는 로컬 미커밋이며 다른 PC로 가져갈 수 있도록 push한 상태는 아니다. 공통 기억 남기기→감상/장면 분기와 Title Hub 감상 이력을 적용했다. 28차 선반 편집과26・27차 같은 작품 기억 뒤 겹침·PC 옆/모바일 아래 펼침은 유지한다. 이전 필름·행 아래 패널 설명은 당시 기록이다.

## 29차 현재 — 감상 기록과 장면 저장 연결 (2026-10-07)

- 실제 `/record/`의 RecordStart와 공통 TopNav, TitleHub/TitleWatchRecords, titleWatchRecordWriter/검증·watchLogRepo가 제어 파일이다. 내 작품 또는 기존 resolver로 선택→같은 작품의 감상 탭→상태/별점/재시청·날짜/감상→이력 확인. 기존 이미지 composer와 캐릭터/카드 분류는 그대로다. 감상 저장만으로 Memory를 만들지 않는다.
- WatchLog는 숫자 AniList와 optional canonical ID를 현재 로컬 store에 보관한다. 기존 snapshot 백업은 로그 identity를, 기존 catalog title 백업은 자체 작품 상태/별점/재시청을 보존한다. 자체 로그를 AniList0으로 원격 전송하지 않고 기존 원격 snapshot 적용도 로컬 자체 로그를 지우지 않는다. 신규 remote schema/활성화 없음.
- 최종 unit424/관련 Chromium16/build20 PASS. 전체99PASS/2FAIL/2환경 skip, 접근성 이름·이전 Home selector·취소/복귀·새 제공처 결과 중복 제거 보정과 재검증은 [29차 보고](../reports/2026-10-05-v84-web-application.md#29차--감상-기록과-장면-저장-동선-복원-2026-10-07)에 보존한다. 실제4363 표지/빈 폼1440・390・320 확인은 합성 record 저장/백업 검증과 별도다.
- 현재 로컬 미커밋, 사용자 기록에 QA 저장/사진 주입 없음. 다음1개는 감상 기록 동선 사용자 검토. 실폰/Safari/hosted·TITLE-STATE-SYNC-01·카드 분류 sync/기존 W/Q/D01~D06 잔여와 Android 제외·운영 후보 승인을 유지한다.

## 28차 현재 — 선반 편집과 실제 작품 표지 (2026-10-07)

- 실제 Collection 편집의 `BookshelfEditor.jsx`/BookshelfView/channel CSS가 제어 파일이다. PC 선반 목록+작품 선택, 모바일 세로 목록, 실제 TitleCover·제목·기억 수/선택 표시·검색/선택됨. 저장 키/owner/적용/취소 및27차 펼침 유지.
- 이번 최종 unit416/관련 Chromium5/build19 PASS, 실제4363 catalog 표지5개1440・390/no-overflow 확인. 격리 문맥의3Memory·두 선반·quota 실패 검증과 사용자 표지 읽기는 구분한다. 초기/최종5개의 재실행을 합산하지 않는다. [28차 상세](../reports/2026-10-05-v84-web-application.md#28차--선반-편집-정리와-실제-표지-2026-10-07), 기존 interface-rebuild28차 참조.
- 25~28차 로컬 미커밋이다. 지금 사용자의 편집을 자동 적용하거나 사용자 origin에 fixture를 주입하지 않았다. 실제폰/hosted 새 분류 sync·DB/Public/운영배포의 잔여 유지. 다음1개는 새 선반 편집 사용자 배치 검토. 아래 최신 Git 안내는24차 체크포인트 시점이다.

## 최신 Git 인계 — 2026-10-06 / 실제 Web 적용20~23차

재개 브랜치는 **`codex/phone-test`**다. 기준 `54c39cb` 이후의 V8.1~V8.4 시안·PNG/SVG·실제 Web 코드·테스트·카드 분류 migration 후보와 아래 문서를 Git 개발 체크포인트로 보존한다. 최신 기준은 **실제 앱 `src/`와 기존 interface-rebuild23차 결과**, 인계 절차는24차다. 아래 ‘로컬 미커밋’, ‘시안만 존재’, V8 미적용 안내는 각 날짜의 과거 상태다. 운영 `master`/moemoa.xyz의 최신 배포를 뜻하지 않는다.

### 완료 범위와 아직 남은 것

- 실제 앱: 공통 상단/핑크 주요 버튼, 내 책장의 명시 선택 선반·행 아래 필름, 작품 두 보기, 기억 원본 비율 목록/분류, 테마 메뉴와 적은 이미지 좌측 정렬. Hero 금지와 로고2안 유지.
- 카드 분류: 카드별 캐릭터/커스텀 태그 저장·Archive 교집합·metadata 백업 복원, 실제 작품 캐릭터 읽기. 현재 **이 기기에 저장**되며 소유자별 선반 설정도 서버 동기화하지 않는다.
- 최신 상세: 기본 읽기 → ‘기억 수정’ → 검색 가능한 별도 캐릭터 선택창 → 적용/Save, 기억·관리 탭과 Board/공개/이미지/삭제 경로. 원본·개인 감상·Board N:M·기존 공개 동의 계약 유지.
- 미적용 후보: `supabase/migrations/20261005090000_memory_card_classification.sql`, `tools/card-classification/`. hosted/운영 적용과 `PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1` 활성화는 미실행. 승인된 test 적용 후 실제 계정 save/pull/conflict/promotion 확인이 필요하다.
- 다음 작업 **1개**: 기존 실제 기억 상세의 읽기→수정→관리 배치를 사용자와 검토한다. 그 뒤 남은 실폰/Safari·새 태그 다기기·기존 출시 gate를 검증한다. Android 제외, 운영 migration/Public/master merge·push·배포는 D06 정확한 후보 승인 유지.

### 다른 PC에서 실제 앱 열기

Git과 Node.js24.19.0을 권장한다(지원22~26, npm11.17.0). 처음 받는 경우:

```powershell
git clone --branch codex/phone-test https://github.com/Newrred/anime-collector.git
cd anime-collector
npm ci
npm run dev -- --host 127.0.0.1 --port 4363
```

기존 저장소는 먼저 `git status --short`로 변경을 확인하고 보존한다. 깨끗한 상태에서:

```powershell
git fetch origin
git switch codex/phone-test
git pull --ff-only origin codex/phone-test
npm ci
npm run dev -- --host 127.0.0.1 --port 4363
```

브랜치가 없으면 `git switch --track origin/codex/phone-test`. 분기/충돌 시 force/reset/clean하지 않고 차이를 확인한다. 실제 앱은 http://127.0.0.1:4363/ . 포트가 사용 중이면 다른 포트를 지정하며 **origin이 바뀌면 브라우저 로컬 기록도 다른 저장소**다. 로컬·원격 기준 확인은 `git rev-parse HEAD`, `git ls-remote origin refs/heads/codex/phone-test`의 SHA를 대조한다.

`.env`/`.env.local`, 비밀번호·service role·브라우저 로그인/IndexedDB·원본 사진·선반 설정·cache 로그는 이번 Git 인계에 넣지 않는다. **기존 `.env.production`은 공개 client 설정만 든 추적 파일**이며 이번에 수정하지 않았다(키 이름/공개 여부만 확인, 비밀 키 없음). 따라서 아래 과거 ‘모든 env가 이전되지 않음’ 안내에는 이 예외가 있다. 코드 이전으로 개인 자료가 따라오지 않는다. 필요한 기록은 기존 앱 내보내기/복원과 명시 이미지 백업 경로로 별도 보존한다. 실제 표지 검색을 계속하려면 기존 공개 설정의 **`PUBLIC_CATALOG_SUPABASE_URL` / `PUBLIC_CATALOG_SUPABASE_ANON_KEY`** 두 값만 새 PC의 무시되는 `.env.local`에 별도 설정한다. client 공개 설정을 DB 비밀번호/service role로 대체하지 않는다. 로컬 파일 선택 검토만 할 때는 `PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1=1`; 계정/Private/Public/새 태그 sync 설정을 디자인 미리보기 때문에 켜지 않는다. 서버를 재시작해 반영한다. dev는 `.env.production`을 자동 로드하지 않으므로 같은 카탈로그/로그인 환경이 자동 구성되지는 않는다.

### 최신 시안·디자인 자료와 반복 검사

최신 V8.4 시안은 실제 앱과 별개이며 합성 데이터/RAM-only다. 다른 터미널에서:

```powershell
npm run design:preview:v84
```

http://127.0.0.1:4351/channel-study-v8.4/index.html#home 에서 연다. 충돌하면 `npm run design:preview:v84 -- --port 4352`. 같은 서버의 `/ui-kit-v8.1/index.html`, `/ui-kit-v8.2/index.html`, `/bookshelf-detail-v8.3/index.html`에 이전 자료가 있다. 기존 `npm run design:preview`는 이전 V8 서버4348이며 최신 V8.4 실행 명령과 구분한다. PNG/SVG·규칙은 `design/ui-kit-v8.1/`, `design/ui-kit-v8.2/`, 실제 서비스 합성 캡처/설명은 `design/evidence/v84-service-2026-10-05/`, 구현 결과는 기존 [보고서](../reports/2026-10-05-v84-web-application.md)다. Are.na 분석은 `design/channel-study-v8.4/ANALYSIS.md`; 제3자 원본 캡처와 실제 catalog 표지 QA 캡처는 cache 검토 전용으로 Git에 넣지 않는다.

```powershell
npm run test:unit
npm run design:check
npm run test:design-server
npx playwright install chromium
npm run test:e2e:channel
npm run build
```

Playwright Chromium 설치는 새 PC에 브라우저가 없는 경우 필요하며 앱 의존성 버전을 바꾸지 않는다. `test:e2e:channel`은 기존 격리 서버 도구로 새 loopback 포트를 소유하고 credentials/rollout flags를 차단한다. 합성 fixture·모의 계정 경계를 검사하며 hosted/OAuth/실폰 PASS를 뜻하지 않는다. cache 전용 실행기가 필요하지 않다. build와 E2E는 순차 실행한다. 첫 Astro 최적화가 시작 제한시간을 넘으면 해당 로그를 보존하고 재시도한다. 실패가 계속되면 환경을 조사하며 PASS로 표기하지 않는다.

### Codex 재개 요청

> AGENTS.md → CODEX_START_HERE.md → 확정 결정01 → 최신 디자인 인계 → 기존 interface-rebuild 계획23·24차/보고서를 읽고 이어서 진행해줘. V8.4는 실제 src에 적용돼 있어. 먼저 기존 실제 기억 상세의 읽기·수정·관리 배치를 검토하고, 기존 W/D/Q와 검증 근거를 유지해줘. 새 계획판을 만들지 말고 Android/운영 DB/Public/master 배포는 별도 승인 경계를 유지해줘.

### Git 완료 근거와 이번 재검사

자료 체크포인트 **`fb25167b9563807e9eeb22f89f82f9f42651d3a7`**를 `origin/codex/phone-test`에 push하고 로컬 HEAD/`git ls-remote` SHA 일치를 확인했다. 구현은 `9cf424e`, 미적용 SQL 후보는 `4bfb3da`, 결정/기존 계획은 `2c0c480`, 시안/합성 증거는 `fb25167`이다. 이 기록을 담은 **후속 인계 문서 커밋까지 받은 브랜치 HEAD**에서 재개한다. 자료 커밋 SHA와 최종 문서 커밋 SHA를 혼동하지 않는다.

이번24차는 unit416/격리 Chromium64/build19, 기존 V8 검사169checksum·서버9, V8.1~V8.4 시안8화면(1440/320, JS오류·로컬404·넘침0)과 최신 preview CLI200/URL출력을 확인했다. 첫 E2E는 Astro 최적화 준비시간 제한으로 중단 후 재실행 PASS; 새 디자인 text7개 EOF 빈 줄만 정리 후 staged whitespace 검사 PASS. 이전23차66·22차SQL19 및 다른 실행 PASS와 합산하지 않는다. [24차 보고](../reports/2026-10-05-v84-web-application.md#24차--다른-pc-git-인계-2026-10-06)에 명령/한계를 기록했다. 비밀 키/실제 이미지/cache는 새로 commit하지 않았고 기존 공개 client 환경 설정도 변경하지 않았다.

이 인계는 소스·문서의 Git 이전이다. 실제 두 번째 PC나 휴대폰에서 실행한 검증으로 확대하지 않는다. 운영 배포/DB/flags 변경0, 자동 Git Preview 완료는 미조회다. 이하 실행 로그와 과거 PASS는 보존한다.

## 최신23차 — 읽기·명시 수정·관리 (2026-10-06)

기존 실제 기억 상세를 기본 읽기/‘기억 수정’/기억·관리 탭으로 정리했다. 캐릭터 전체 목록은 별도 검색 선택창이며 Escape/취소는 선택 초안을 버리고 focus를 복귀한다. 적용 후 카드 Save로 저장한다. Board는 짧은 액션, 공개/이미지/삭제는 관리에 모았다. private preview는 접힌 패널에서도 유지하며 이미지 없을 때 복구 경로를 자동으로 연다. 기존 사용자 기록은 변경하지 않았다.

이번 unit416/고유 Chromium66/build19 PASS. 이전22차61/21차64 및 반복 검사를 합산하지 않는다. 실제 프리렌 표지/30명 catalog 목록에서 Fern/Frieren 선택과1440/390/320/dark를 별도 disposable context로 검증했다. 합성7장/실제 표지6장의 캡처 범위를 구분한다. [23차 보고](../reports/2026-10-05-v84-web-application.md#23차-후속--상세-읽기수정관리-분리-2026-10-06)와 기존 interface-rebuild23차가 최신이다.4363 실제 앱 유지/로컬 미커밋; 카드 태그는 현재 기기 저장이고22차 후보의 hosted/운영 적용·flags·push/배포는 미실행이다. 다음1개는 사용자의 기존 실제 기억 상세 배치 검토다.

## 이전22차 기억 상세·분류 — 2026-10-06 마감

CARD-CLASSIFICATION-01 승인으로 카드별 캐릭터·커스텀 태그 저장/Archive 분류/metadata 백업 복원을 실제 src에 추가했다. 기존 장르·WatchLog와 분리하며 현재 이 기기에 저장됨을 표시한다. 상세는 감상/분류 → 공개 범위 → Board → 접힌 이미지 관리 → 삭제 순서다. 실제 catalog 프리렌 캐릭터6개/더 보기12개도 확인했다. unit416/고유 Chromium61/격리 PG SQL19/build19 PASS이며 마지막 경계 변경 후 그중12개를 재검사했다. 이전 결과와 합산하지 않는다. [22차 보고](../reports/2026-10-05-v84-web-application.md#22차-후속--카드별-분류와-기억-상세)와 기존 interface-rebuild22차가 최신이다.

새 private classification migration과 `tools/card-classification/README.md`를 준비했지만 hosted/운영 적용과 `PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1` 활성화는 미실행이다. 기본off client는 구서버 응답으로 로컬 분류를 지우지 않는다. 원격/다른 기기 태그 PASS가 아니며 승인된 test 환경에서 새 metadata 흐름을 확인해야 한다. 운영 후보는 D06 별도. 현재 변경은 **로컬 미커밋**, 다른 PC에는 아직 없다.4363 실제 앱과 기존 사용자 기록을 유지했다. 실폰·운영 공개/배포 미검증. 다음1개는 실제 기억의 새 상세 화면 사용자 검토다.

## 이전21차 실제 서비스 적용 — 2026-10-05 후속

사용자가 V8.4의 큰 틀을 채택하고 실서비스 적용을 승인했다. `src/`의 실제 내 책장·작품·기억·이미지 상세와 공통 메뉴에 반영했고 후속 선택 메뉴·검색 초점·로고 hover·좌측 필름을 마감했다. 단위410/build19 routes와 이번 Chromium 고유64개를 검증했다(기존51개와 합산하지 않음). [결과 보고](../reports/2026-10-05-v84-web-application.md)와 기존 interface-rebuild 계획20·21차가 최신이다. 실제 앱4363에 기존 public catalog의 익명 읽기만 연결해 실제 표지5개를 확인했고 앱 내 ‘디자인 확인’ 선반에 작품5개를 선택했다. 실제폰·다른기기 연동은 이번 검증에 포함하지 않는다. V8.4 시안은 `design/channel-study-v8.4/`, 실제 앱은 `npm run dev`로 연다. 선반은 소유자별 이 기기 설정으로 저장되며 서버 동기화는 추가하지 않았다. 이번 변경은 **로컬 미커밋**으로 다른 PC의 Git에는 아직 없다. 운영 배포·Public·DB 변경도 없다.

아래 Git 이전 안내와 V8 설명은 이번 실서비스 적용 **이전 시점**의 인계 기록이다. 당시 시안 검증과 최신 실제 앱 검증을 합산하지 않는다.

## 이전 체크포인트 상태

- 저장소: https://github.com/Newrred/anime-collector
- 최신 개발 브랜치: **`codex/phone-test`**. `master`가 아니다.
- 이번 이전 기준점: `5bd1b3f` 이후 진행한 UI 코드·테스트·작업 기록과 별도 디자인 시안의 개발 체크포인트. 출시 후보나 디자인 최종 승인본이 아니다.
- 최신 디자인: **V8 `moemoa-film-grid.html#home`**. 이전 V7은 `moemoa-film-desk.html`, 전후 비교는 `moemoa-film-grid-compare.html`.
- 중요한 차이: `src/`에는 초기 collection/board UI 개편 작업이 보존돼 있다. 최신 필름 디자인 V2–V8은 별도 HTML 시안이다. `npm run dev`만 실행하고 화면이 V8과 다르다고 해서 유실된 것이 아니다.

## 다른 PC에서 받기

Node.js 22–26 범위와 Git이 필요하다. 이번 PC는 Node24.19.0/npm11.17.0으로 검사했다. 저장소 packageManager는 npm11.17.0이다. 시안만 여는 데는 별도 패키지·DB·로그인·환경변수가 필요 없다.

처음 받는 경우:

```powershell
git clone --branch codex/phone-test https://github.com/Newrred/anime-collector.git
cd anime-collector
npm ci
npm run design:preview
```

이미 받았던 경우, `git status`로 미반영 변경이 없는지 먼저 확인한다. 변경이 있으면 보존하고 충돌 여부를 확인하며 강제 reset/clean하지 않는다. 깨끗한 상태에서:

```powershell
git fetch origin
git switch codex/phone-test
git pull --ff-only origin codex/phone-test
npm ci
npm run design:preview
```

로컬 브랜치가 없다면 switch 대신 `git switch --track origin/codex/phone-test`. 브랜치가 분기되어 pull이 거절되면 force push/reset하지 않고 차이를 확인한다.

실행 후 http://127.0.0.1:4348/ 에서 최신 V8이 열린다. 전후 비교는 http://127.0.0.1:4348/moemoa-film-grid-compare.html . 포트가 사용 중이면 `npm run design:preview -- --port 4350`으로 실행하고 해당 포트로 접속한다. 서버는 현재 PC에서만 접근 가능한 loopback이며 Ctrl+C로 종료한다. 기존 시안 저장은 RAM 전용이라 새로고침하면 초기화된다.

시안 패키지 검사:

```powershell
npm run design:check
npm run test:design-server
```

실제 앱 개발은 별도 `npm run dev`. 계정·동기화·서버 연결 검사는 필요한 환경변수를 안전하게 별도 준비하고, 기존9/29 인계의 테스트 환경/권한/만료 조건을 먼저 확인한다. 이번 이전은 DB 관측시각이나 정책을 갱신하지 않는다.

## Codex에 이어서 요청할 문장

> CODEX_START_HERE.md와 docs/moemoa/operations/2026-10-05-design-handoff.md를 읽고 이어서 진행해줘. 최신 기준은 design/prototypes/film-archive의 V8 필름책장 시안이야. Hero는 절대 넣지 말고 로고2안과 고정 표지 그리드·선택 행 아래 필름 구조를 유지해줘. 실제 앱에 V8이 아직 적용되지 않았다는 점과 남은 승인 단계를 먼저 확인해줘.

읽기 순서: AGENTS → CODEX_START_HERE → 확정 결정01 → 이 인계 → `plans/2026-10-03-interface-rebuild.md`의 최근8차 기록 → 작업별 명세. Git 이전 자체의 계획·검증은 `plans/2026-10-05-cross-pc-design-handoff.md`.

## 사용자가 정한 디자인 방향

1. 이미지 우선 개인 애니 기억 아카이브. 일반 트래커/서비스 소개 랜딩처럼 만들지 않는다.
2. **Hero를 절대 넣지 않는다.** 큰 소개/대표 이미지/spotlight/환영 영역으로 이름만 바꿔 되살리지 않는다. 기능적인 작은 제목·탐색·빈 상태는 가능하다.
3. C안에서 출발한 필름집 컨셉. 둥근 소문자 워드마크와 **이어지는 필름 심벌2안** 방향 유지. 최종 벡터/실제 폰트 원본/최소 크기 확정은 아직이다.
4. Are.na/Cosmos의 실제 이미지·컬렉션 화면, Pinterest 보드, Letterboxd/Raindrop/라프텔을 참고한다. 랜딩 캡처만 보고 반영했다고 주장하지 않는다. 실제 관찰치와 MOEMOA 제안치를 구분한다. Letterboxd/Raindrop 접근 실패 및 Pinterest 로그인 가림 한계는 과거 기록에 명시돼 있다.
5. 과한 둥근 테두리, 옛 느낌의 초록 배경·두꺼운 박스, hover 시 큰 확대/들썩임, 이미지 위아래 유색 패딩, 장황한 개발자/AI식 안내를 피한다. 이미지 비율과 작은 글자 위계를 실제 화면에서 검토한다.
6. 개인 홈은 선별한 작품을 꾸미는 책장. 전체 작품 그리드와 기억 Archive는 유지한다. Board를 서비스에서 영구 삭제하거나 N:M 모델을 책장으로 바꾼 승인은 아니다.
7. 표지를 필름집 커버처럼 느끼게 하고, 기억 필름과 연결한다. 모바일에서도 커버와 이미지가 각각 떨어져 배치된 느낌을 피한다.

## V8에서 구현된 것과 아직 아닌 것

V8 홈은 작은 선반 선택줄 + 연속 표지 그리드다. 전체는 선반 합집합(초기6작품, 중복 제거)이며 My Titles(8작품)와 다르다. PC6열/중간4·3열/모바일2열. 표지 선택 시 해당 행 바로 아래에 패널1개만 열리고 옆 표지의 x좌표·폭은 변하지 않는다. 같은 행의 다른 작품 선택은 같은 위치에서 내용 교체, 화면폭 변경은 해당 행 끝으로 패널 재배치. 초기 자동 펼침은 없다.

열린 패널은 작은 커버와 가로 필름이 붙어 있으며 자연 이미지 비율, 추가 로딩, 클릭 확대, 키보드 이동, 접기/다시 열기 위치 복원, 작품 상세 왕복, 그 작품에 기억 추가 후 같은 선반/패널 유지가 동작한다. 책장 이름·선반명·진열/순서 편집과 적용/취소, 개인 감상·날짜도 유지한다.

이것은 **가상 이미지/기록을 사용하는 RAM-only 프로토타입**이다. 실제 업로드·지속 저장·로그인·동기화·공개·production API와 연결되지 않는다. 생성된 가상 표지/장면은 실제 애니 작품·사진이 아니다. V8 구현을 전체 서비스의 디자인/기능 완료로 보고하지 않는다.

## 자료 위치와 비교 기준

| 자료 | 저장소 경로 |
| --- | --- |
| 현재 V8와 V7/V6 비교 | `design/prototypes/film-archive/` |
| 디자인 가이드·로고·V2–V8 소스/생성 자산/검증 JSON | 같은 폴더의 README와 manifest |
| 원래 서비스 디자인 비교 | `design/evidence/original-design-5bd1b3f/` |
| 레퍼런스 실제 수치와 제한 | `docs/moemoa/references/measurements/`, interface-rebuild 계획 |
| 현재 코드·검사 | `src/`, `tests/`, `scripts/measure-reference-layout.js` |

원래 서비스 비교는 **5bd1b3f 대10/3 초기 앱 개편**에 동일 합성 기록을 넣은9화면×전후 캡처다. V8과 직접 비교한 이미지가 아니다. `capture-manifest.json`에 날짜 당시의 `current uncommitted working tree` 표현은 그 시점의 설명으로 보존한다. 최신 V8 비교는 **V7 대V8**이며 최초 서비스 전후로 재명명하지 않는다. 모든 캡처는 합성 데이터이며 개인 사진이 아니다.

과거 계획/JSON에 적힌 `C:/Users/shjb0/.codex/visualizations/2026/10/03/01a10016-8e69-7791-b51b-32b0f7bd2d51/`은 당시 출처 경로다. 새 PC에서는 같은 파일명을 `design/prototypes/film-archive/`에서 찾는다. `deliverables/design-comparison-5bd1b3f/`의 보존 사본은 `design/evidence/original-design-5bd1b3f/`다. 당시 로컬 주소는 새 서버를 실행해야 다시 동작한다.

아주 초기 로고 후보4장의 원본은 기존 작업 폴더에도 없어 설명과 부재 사실만 보존했다. 현재 필름 로고2안은 포함돼 있다. 최신 V8은 이미지/동작 코드가 로컬에 있고 폰트만 CDN을 사용한다. 초기 가이드 일부는 온라인 폰트/스크립트에 의존하므로 완전한 오프라인 복원은 아니다. 보존/제외/누락과 외부 의존성은 `portable-manifest.json`에서 확인한다.

## 검증 상태

- 이번 인계 때 실제 앱 `npm run test:unit`:407/407 PASS, 실패/skip0. `npm run build`:19pages PASS. 대형 JS chunk 경고는 남는다.
- V8 기존 기록: fixture32/기능15그룹 PASS; 320·390·768·1000·1440px 배치/넘침/행 삽입 확인. 상세 bounds는 `grid-v8-flow-results.json`, `grid-v8-layout-results.json`.
- 기존 앱의10/3 Chromium97개/보드6개/원본 비교1개 결과는 당시 실행 기록이다. 이번 Git 이전 때 전체 브라우저 suite를 다시 통과했다고 주장하지 않는다. visual golden은 최종 디자인으로 승인·교체하지 않았다.
- 이식본의 새 경로/미리보기 검사 결과는 아래 완료 기록과 이전 ExecPlan에 남긴다.
- 이번 이식 검사:171파일/98로컬참조/7JS구문·7fixture/169checksum PASS. 서버·검사기 테스트9/9 PASS(skip0). Git에 담긴 파일만 다른 공백 포함 폴더에 풀어, 기존 저장소 밖 CWD에서 Node만으로 같은 검사를 재통과했다.
- 이번 브라우저 smoke:새 저장소 경로에서 V8 PC1440/모바일320px, 필름 펼침, 모바일 전후 비교 이미지, 옛 로고 부재 안내 확인. console errors0·수평넘침0. 다른 OS/실제 두 번째 PC까지 실행한 것은 아니다.

## 다음 작업과 승인 경계

1. V8을 실제로 열어 사용자 최신 피드백부터 확인한다. 필름/표지 구조 검토가 우선이다.
2. 최초 약속 순서인 전수 상태·문구 조사 → 공통 기준 확정 → 문구 축약 → 대표 흐름 시안 → 확인 후 확장 →320px/회귀를 따른다. 과거에는 기준 확인 전 확산한 문제가 있었고 그 이력을 삭제하지 않는다.
3. V8 승인 후 실제 앱 적용 ExecPlan을 갱신하고 하나의 end-to-end 흐름부터 이전한다. 현재 시안의 중첩 CSS를 그대로 운영 앱에 붙이거나 전체 언어/프레임워크를 임의 교체하지 않는다.
4. 실물 모바일 터치/관성, Safari/Firefox, 스크린리더·확대, 대량 이미지·실제 기록/동기화·전체19route 상태/문구/회귀는 잔여다.
5. 공개 이미지 준비 버튼의 결과 가시성/서버 성공, 공개 미리보기→게시→익명열람→철회 실기기 검증 등9/29 잔여는 해결되지 않았다. 디자인 작업으로 공개 gate를 통과한 것으로 해석하지 않는다.

## Git으로 이동하지 않는 것

`.env`와 키/비밀번호, 브라우저 로그인·로컬Storage/IndexedDB, 동기화하지 않은 원본 사진, 기존 PC의 실행 중 서버, Codex 대화 세션 자체/앱 탭/개인 설정, 카탈로그 수집 원본·checkpoint는 포함하지 않는다. 작업 맥락은 이 문서와 결정/계획/검증 기록으로 이어간다. 실제 개인 자료를 Git에 올리거나 미확인 키를 문서에 적지 않는다.

## 이번 인계 완료 기록

2026-10-05 16:55 KST 기준 코드·자료·재개 도구 commit `0abc021ed249c0c70dd19b903e4a3198b85005a8`까지 `origin/codex/phone-test` push 완료, 로컬/원격 SHA 일치와 깨끗한 작업 폴더를 확인했다. 이 완료 기록은 후속 문서 커밋으로 함께 보존한다. 다른 PC에서는 특정 중간 커밋이 아니라 브랜치 최신 상태를 받는다.

- 작업 기록/결정 → 기존 앱 개발 코드 → 시안/전후 비교 자료 → 실행·검사 도구를 분리해 보존했다.
- 시안169파일의 checksum과 기존 비교37파일의 원본 일치를 확인했다. Git 사본 이식 검사, 앱 단위407개, 미리보기 서버9개, 빌드, 브라우저 smoke가 통과했다. 전체 E2E/운영배포 완료가 아니다.
- 이번 변경263파일 최종 감사에서 실제 credential·새 연락처·개인사진 폴더·DB dump·100MB 초과 Git blob 없음. PNG158개에서 텍스트/EXIF 메타데이터 없음. 과거 작업 경로는 출처 문서/JSON5개에 역사적 정보로 남아 있으며 새 PC 실행에는 사용하지 않는다.
- 원격 `master`는 `06d2e38d79d38c66753f0ec25a21b615bdc5fa60`으로 변경하지 않았다. 브랜치 push가 기존 Git 연동 Preview를 유발할 수 있지만 운영 배포를 수정·승격하지 않았다.

상세 읽기 목록·변경 범위·검증 명령·마이그레이션/롤백·보안·잔여 게이트는 [이전 ExecPlan 완료 보고](../plans/2026-10-05-cross-pc-design-handoff.md#17-완료-보고)에 있다.
## 2026-10-07 추가 로컬 상태 — 기존25차

이번25차는 `2c1811d` 이후 **로컬 미커밋**이다. 홈은 컬렉션/Collection, 필름 구멍·띠·아이콘 대신 문자 로고/얇은 선, 작품 탐색은 보기 옆, 겹쳐보기는 그리드와 선택 비교 가능하다. 기존 선반 이름/owner 저장 키/선택 행 아래 기억/Title 두 보기와 원본·공개·동기화 계약을 유지한다. 초기77 검사76PASS/1테스트 오류 후 보정 회귀72PASS, 최종 모션4 재검사PASS·unit416/build19. 실제4363 카탈로그5표지 및 Action1개/전체5개 복귀를 확인했다. 과거64/66과 합산하지 않는다. [25차 보고](../reports/2026-10-05-v84-web-application.md#25차--컬렉션과-선이미지-중심-후속-2026-10-0607), 기존 ExecPlan25차/LINE-IMAGE-COLLECTION-01 참조. 다음1개는 새 실제 서비스 배치 사용자 검토다. Android/실폰/새 태그 hosted·운영 DB/Public/배포 게이트는 남아 있다.

## 2026-10-07 최신 추가 로컬 상태 — 26・27차

TITLE-MEMORY-STACK-01/사용자 정정으로 겹침 대상은 **각 작품의 Memory**가 되었다. 별도 Layered 옵션은 제거하고 기억0이면 앞표지만 표시한다. COLLECTION-SIDE-FAN-01/사용자의 “표지 옆으로 펼침” 승인으로 컬렉션의 선택 묶음은 한 줄 전체 폭으로 확장하되 앞표지는 같은 크기, 기억은 PC 옆/휴대폰 아래 가로 넘김이다. 표지 재클릭·접기/Escape·포커스 복귀, 기억 상세·작품 이름의 Title Hub·미리보기3개와 전체4개 연결을 검증했다. 작품 탭의 두 보기/Title Hub 경로는 유지한다.

26차 최초 Chromium75PASS/2검사 오류→보정된 관련5PASS, unit415/1listen EACCES→소스 변경 없는 재실행416PASS/build19.27차 전체76PASS/1애니메이션 도중 위치 검사 실패와 최종 source/검사 보정 후 관련5PASS·unit416/build19. 상세 초기 실패·원인 한계/명령은 기존 [보고26・27차](../reports/2026-10-05-v84-web-application.md#27차--컬렉션-표지-옆으로-기억-펼침-2026-10-07)에 보존하며 PASS를 합산하지 않는다. 실제4363 사용자 데이터는5작품/0Memory로 보존했고 첫 기억 안내를 확인했다. 합성 local 파일 선택/저장·same src/no-upload와 system design/card identity는 격리 runtime 검증이며 실제 사용자 사진/hosted/실폰 PASS가 아니다.25~27차는 아직 Git에 안 올린 로컬 작업이다. 다음1개는 **컬렉션 옆 펼침 사용자 검토**. 기존 Android 제외/운영 D06·실폰·새 태그 hosted 잔여 유지.
