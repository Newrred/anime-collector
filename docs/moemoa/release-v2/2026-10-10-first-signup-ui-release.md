# 한국·미국·태국 가입 및 운영 화면 개선

## 범위와 현재 상태

사용자 결정 `FIRST-SIGNUP-KR-US-TH-UI-20261010`에 따른 첫 활성 범위는 한국 만14세, 미국·태국 만13세 이상의 무료 비공개 기록 서비스다. PH·EU/EEA·UK 등은 이번 활성 대상이 아니며 기존 국가 행과 과거 동의 기록은 삭제하지 않는다. 공개 게시·공개 이미지·신고 접수 플래그도 이번에 켜지 않는다.

운영 반영과 국가별 가입 활성화를 완료했다. `master`의 검증 소스 `6a2beff04cdc408787dcf5ed9bf2660a95aa78ae`와 Vercel Git Production 및 실제 www 소스가 일치한다. 운영 DB의 독립 재조회와 가입·관리자 화면, 기존회원 Google 로그인 왕복까지 확인했다. 이번 배포에서 새로운 운영 계정을 생성하는 Google 가입 왕복은 수행하지 않았다.

## 8항 구현 보고

1. **읽은 문서·소스**: `CODEX_START_HERE.md`, 확정 결정, `PLANS.md`, 제품/아키텍처/QA·운영/변경관리 문서, release-v2 연구·기존 증거·ExecPlan. 가입 UI·날짜/선언·인증 repo·서버 handler·관리자 RPC/화면·170000/180000 migration 및 관련 검사.
2. **가정·질문**: KR14/US13/TH13 먼저 활성화. 추가 보호자 체크·이메일·신분증·유료 인증·새 의존성 없음. EU·UK 무보수 대표자 경로와 PH 후속 검토는 별도이며 세 나라 작업을 막지 않는다. 사용자 자신의 새 약관 수락을 에이전트가 대신하지 않는다.
3. **계획**: `01_RELEASE_EXECUTION_PLAN.md` 최상단의 동일 날짜 첫 가입 활성 계획. 최초 배포 활성은 일반 관리자 pause/resume과 분리한다.
4. **파일·이유**: `SimpleSignup.jsx`, `birthDateInput.js`, 가입 CSS·start route는 48px 연/월/일 입력, 한·영 오류·포커스·자연스러운 안내. `authRepo.js`·`webOAuth.js`는 기존회원 로그인을 신규 선언에서 분리. callback 화면은 가입 스타일·간결한 오류·재시도/가입 진입. `AdminDashboard.jsx`·admin CSS는 국가·가입 상태와 주요 현황 우선, 문서·전체 한도는 펼쳐보기. 관련 unit/Chromium/SQL/CI는 검증 범위 추가.
5. **DB·복귀**: additive `20261010190000_simple_signup_country_activation.sql`과 `tools/identity/build-first-signup-release.mjs`. 기존 국가 행에 활성 여부, 개인정보 없는 불변 릴리스 이력 추가. test는 schema-only로 기존 열린 정책 보존. 운영 stage는 가입 off/가입 절차 우회 차단 on/3국가·10/10 문서 준비, 실제 웹 배포 후 activate. rollback은 signup off와 admission on 유지이며 개인 데이터나 과거 문서를 지우지 않는다. SQL은 커밋 소스·해시·release ID에 결속한다.
6. **검증**: 최종 전체 unit571 PASS, build32 PASS. 가입 UI18·관리자17·callback4의 개별 Chromium 검사 PASS, PC/320px 및 한·영 확인. 통합 관리자/callback21 PASS. 로컬 가입/계정 통합은24 PASS·첫 계정 화면 초기 로딩 실패1 뒤 해당 검사 독립1 PASS(코드 변경 없음). 이후 같은 최종 소스의 CI `38048163986`에서는 가입/계정 전체와 모든 기존 웹 회귀까지 SUCCESS. PostgreSQL16의62개 검사는 국가별 허용/거부, 모든 가입 경로, 첫 활성 경합, 구문서·과거 기록 보존, 함수/권한/trigger/ledger 변조 거부, stage·pause 복구 및 cron 조회를 확인했다. Safari 추가 검사는 하지 않았다.
7. **안전·개인정보·관찰**: 입력 생년월일 자체는 브라우저에서 나이 계산에만 사용. 새 로그/분석/개인 데이터 열람 없음. 계정·사진·동의·권한 등26개 테이블과 동기화 함수 보존을 내부 해시/건수로 비교하며 원문은 출력하지 않는다. 국가 제한은 UI뿐 아니라 서버 발급/Hook/INSERT/finish/정책 조회에 적용한다. 모호한 오류를 성공으로 표시하지 않는다.
8. **잔여·승인**: 요청한 세 나라 활성 및 UI 배포에 남은 승인 대기는 없다. 새 비밀값 생성/추가 권한/유료 서비스는 사용하지 않았다. 신규 운영 계정의 최종 약관 수락·Google 완료는 이번에 직접 수행하지 않았으며 별도 미검증이다. 이전 테스트 DB의 실제 가입·이미지·탈퇴 결과와 이번 자동 검사/운영 기존회원 로그인을 신규 운영 실가입으로 합쳐 주장하지 않는다. 다른 나라 및 공개 게시 활성은 별도 범위다.

## 디자인 판단과 전후 근거

- 연도를 찾으려고 달력을 반복 이동하던 입력을 연·월·일 직접 입력으로 교체했다. 초기값은 비우고 윤년·존재하지 않는 날짜·미래 날짜를 자동 보정하지 않는다. 잘못된 칸에 설명과 포커스를 제공한다.
- 주요 버튼과 입력은48px, 모바일320px에서 가로 넘침 없음. 기존 흰색·핑크·얇은 구분선을 유지하며 hero나 새 장식 영역을 추가하지 않았다.
- 관리자 기본 화면의 문서 버전·12개 한도·처리 대기를 접어 현황과 실제 조작을 먼저 보여준다. 숫자가 의미하는 범위와 저장량/예약량, 정리 대기0/실행 성공의 차이는 숨기지 않는다.
- impeccable은 기존 디자인 유지·두 차례 시각 확인에, humanizer는 의미를 보존한 문구 축약에 사용했다. 검사기의 기존 문서 CSS Arial 경고1건은 새 가입 폼이 별도 글꼴을 사용하므로 법률/완료 화면까지 확장 수정하지 않았다.
- 수정 전 원본 화면과 동일한 모의 정책 화면을 구분해 보관했다. 로컬 캡처는 `.cache/first-signup-release/evidence/`(실제 운영)와 PC의 `C:/web/.moemoa-signup-ui/`, `C:/web/.moemoa-admin-refinement-results/`(합성 자료)이며 Git에 개인 화면을 넣지 않는다.

## 운영 적용 기록

- 설정 준비: Production `PUBLIC_SIMPLE_SIGNUP_V1=1`, `MOEMOA_SIMPLE_SIGNUP_SERVER_ENABLED=true` 저장. 테스트 문서 허용값은 test Preview에만 있고 Production에는 없음. Google client/cookie 키를 재조회·변경하지 않았다.
- 운영 Before User Created Hook를 기존 `public.check_simple_signup_admission`에 연결해 Enabled 확인. 기존 사용자 로그인 경로와 새 사용자 생성 검증을 분리해 유지했다.
- 검토 source `6a2beff04cdc408787dcf5ed9bf2660a95aa78ae`를 `codex/simple-signup-preview`에 push하고 [CI 38048163986](https://github.com/Newrred/anime-collector/actions/runs/38048163986)의 DB·전체 웹 회귀 두 job SUCCESS 후 같은 소스를 `master`에 fast-forward push했다.
- test schema rollback/apply/독립 readback PASS. release `MOEMOA_FIRST_SIGNUP_KR_US_TH_SCHEMA_TEST_20261010_01`, 기존 test 정책/5국가·계정2·수락2·Public 설정 보존. 이 테스트 환경의 기존 Public on은 이번에 켠 것이 아니다.
- production stage rollback/apply/독립 readback PASS. release `MOEMOA_FIRST_SIGNUP_KR_US_TH_STAGE_PROD_20261010_01`, source6a2beff, 190000 SHA256 `996e27fcef2696c9ebcc5912dd637069d49f8bd71986e633b4ea71c83ab0e7a2`. 당시 KR14/TH13/US13·10/10 운영 문서만 연결, signup=false/admission=true, 계정3·수락0·Public off. 최초 activate의 rollback rehearsal도 PASS.
- 두 환경 모두 signup 임시정보 정리 예약의 정확한 job/시간/명령/active 및 최근 succeeded 확인. 예약과 실행 결과를 구분해 조회했고 스케줄을 변경하지 않았다.
- Vercel Git Production [D5uRPWy778J7MR2spEeLr8JDeeEH](https://vercel.com/newrreds-projects/anime-collector/D5uRPWy778J7MR2spEeLr8JDeeEH) Ready, source master6a2beff 및 www 연결 확인. 실제 `https://www.moemoa.xyz/build-info.json`의 commit/checkoutCommit 동일, source=`vercel-git`, deploymentConfig.semanticMatch=true. workingTreeDirty=true는 기존 Vercel 배포 설정 재작성에 해당하며 의미 비교는 일치한다. CLI 배포·promote 없음.
- Production ACTIVATE 실제 적용 및 별도 readback PASS. release `MOEMOA_FIRST_SIGNUP_KR_US_TH_ACTIVATE_PROD_20261010_01`, 실행 시각 `2026-10-10T11:38:43.420647+00:00`, source6a2beff. signup=true/admission=true, firstActivated=true, bundle=`MOEMOA_KR_US_TH_PRIVATE_20261010_01`, revision=`0deafba52be1503e54b29986b6d210f05e7ae48212d80a08e1d1b0a388ac30e8`. KR14/TH13/US13만 enabled. GB·PH 행은 disabled로 보존. 계정3·수락0·Public off 및 보존 검사 PASS.
- 실제 `/auth/start/`: KR/TH/US 입력 활성, PH 입력 비활성·간단한 안내, 10/10 운영 약관/개인정보 링크 확인. `/admin/`: 기존 관리자 계정에서 새 한국어 UI·가입 가능·3국가 최소연령·현재 계정3·공개 꺼짐 확인.
- 기존회원 실제 Google 왕복 PASS: `/auth/start/`에서 DOB·동의 미입력 → 로그인 → 기존 관리자 Google 계정 선택 → `/data/` 계정 연결, 기억·보드 및 작품·감상 동기화 성공. 새 가입기록 생성 없이 기존회원 동작 보존.
- 실제 API의 선언 없는 요청 거부 확인: GET start는405 METHOD_NOT_ALLOWED, 같은 origin의 POST `{}`는503 SIGNUP_DETAILS_EXPIRED. 오류를 성공으로 해석하지 않았고 이 검사로 계정/동의 기록을 만들지 않았다.
- 활성 후 revision에 결속한 `production-pause-apply.sql`을 로컬 생성해 복귀 경로를 준비했다. **실행하지 않았으며 현재 가입은 열린 상태다.** 실제 복귀 시 signup=false/admission=true, 개인 데이터 보존. 시간이 지난 뒤에는 최신 revision으로 다시 생성한다.
- 완료 문서/집계 증거는 `codex/simple-signup-preview`에 후속 보관하며, 운영 master 소스는 검증된6a2beff를 유지한다. 다른 PC에서는 해당 작업 브랜치를 받아 최신 인계와 운영 SHA를 함께 확인한다.

## 재현 명령과 증거

- `npm run test:unit` — 571 PASS.
- `npm run build` — 32 pages PASS. 최종 동일 소스 CI build도 PASS.
- `node scripts/run-simple-signup-e2e.mjs` — CI 전체 PASS(로컬 초기 로딩 실패/독립 재검사는 위 구분 참조).
- `node scripts/run-admin-e2e.mjs` — 21 PASS.
- `node tools/identity/prepare-first-signup-fixtures.mjs` 및 `PG_BIN=/usr/lib/postgresql/16/bin bash tools/identity/run-first-signup-release-local.sh` — 62 PASS.
- `git diff --check` — PASS. 패키지 설치/업그레이드 없음.
- `.cache/first-signup-release/evidence/admin-before-live.png`, `admin-after-live.png`, `signup-after-live.png`, `production-activate-readback.png`는 로컬 실제 운영 캡처다. 신규 사용자의 개인정보·사진을 Git에 넣지 않는다.
- 공유 가능한 집계 증거: `evidence/2026-10-10-first-signup-ui-release.json`.
