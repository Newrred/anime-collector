# 한국·미국·태국 가입 및 운영 화면 개선

## 범위와 현재 상태

사용자 결정 `FIRST-SIGNUP-KR-US-TH-UI-20261010`에 따른 첫 활성 범위는 한국 만14세, 미국·태국 만13세 이상의 무료 비공개 기록 서비스다. PH·EU/EEA·UK 등은 이번 활성 대상이 아니며 기존 국가 행과 과거 동의 기록은 삭제하지 않는다. 공개 게시·공개 이미지·신고 접수 플래그도 이번에 켜지 않는다.

구현과 로컬 검증을 마쳤다. 실제 DB·Git Production 결과는 아래 운영 적용 기록에 후속 기입한다. 이 문서의 준비 상태를 운영 활성 완료로 해석하지 않는다.

## 8항 구현 보고

1. **읽은 문서·소스**: `CODEX_START_HERE.md`, 확정 결정, `PLANS.md`, 제품/아키텍처/QA·운영/변경관리 문서, release-v2 연구·기존 증거·ExecPlan. 가입 UI·날짜/선언·인증 repo·서버 handler·관리자 RPC/화면·170000/180000 migration 및 관련 검사.
2. **가정·질문**: KR14/US13/TH13 먼저 활성화. 추가 보호자 체크·이메일·신분증·유료 인증·새 의존성 없음. EU·UK 무보수 대표자 경로와 PH 후속 검토는 별도이며 세 나라 작업을 막지 않는다. 사용자 자신의 새 약관 수락을 에이전트가 대신하지 않는다.
3. **계획**: `01_RELEASE_EXECUTION_PLAN.md` 최상단의 동일 날짜 첫 가입 활성 계획. 최초 배포 활성은 일반 관리자 pause/resume과 분리한다.
4. **파일·이유**: `SimpleSignup.jsx`, `birthDateInput.js`, 가입 CSS·start route는 48px 연/월/일 입력, 한·영 오류·포커스·자연스러운 안내. `authRepo.js`·`webOAuth.js`는 기존회원 로그인을 신규 선언에서 분리. callback 화면은 가입 스타일·간결한 오류·재시도/가입 진입. `AdminDashboard.jsx`·admin CSS는 국가·가입 상태와 주요 현황 우선, 문서·전체 한도는 펼쳐보기. 관련 unit/Chromium/SQL/CI는 검증 범위 추가.
5. **DB·복귀**: additive `20261010190000_simple_signup_country_activation.sql`과 `tools/identity/build-first-signup-release.mjs`. 기존 국가 행에 활성 여부, 개인정보 없는 불변 릴리스 이력 추가. test는 schema-only로 기존 열린 정책 보존. 운영 stage는 가입 off/검증 on/3국가·10/10 문서 준비, 실제 웹 배포 후 activate. rollback은 signup off와 admission on 유지이며 개인 데이터나 과거 문서를 지우지 않는다. SQL은 커밋 소스·해시·release ID에 결속한다.
6. **검증**: 전체 unit570 PASS, build32 PASS. 가입 UI18·관리자17·callback4의 개별 Chromium 검사 PASS, PC/320px 및 한·영 확인. PostgreSQL16에서 국가별 허용/거부, 모든 가입 경로, 첫 활성 경합, 구문서·과거 기록 보존, 함수/권한/trigger/ledger 변조 거부, stage·pause 복구를 검사했다. 통합 UI 및 원격 검증은 후속 기록한다. Safari 추가 검사는 하지 않았다.
7. **안전·개인정보·관찰**: 입력 생년월일 자체는 브라우저에서 나이 계산에만 사용. 새 로그/분석/개인 데이터 열람 없음. 계정·사진·동의·권한 등26개 테이블과 동기화 함수 보존을 내부 해시/건수로 비교하며 원문은 출력하지 않는다. 국가 제한은 UI뿐 아니라 서버 발급/Hook/INSERT/finish/정책 조회에 적용한다. 모호한 오류를 성공으로 표시하지 않는다.
8. **잔여·승인**: 운영 반영 권한은 현재 사용자 요청에 포함된다. 새 비밀값 생성/추가 권한/유료 서비스는 필요하지 않다. 실제 신규 계정의 최종 약관 수락·Google 완료를 수행하지 않았다면 그 범위는 별도 미검증으로 적고 자동검사를 실제 사용자 가입으로 과장하지 않는다.

## 디자인 판단과 전후 근거

- 연도를 찾으려고 달력을 반복 이동하던 입력을 연·월·일 직접 입력으로 교체했다. 초기값은 비우고 윤년·존재하지 않는 날짜·미래 날짜를 자동 보정하지 않는다. 잘못된 칸에 설명과 포커스를 제공한다.
- 주요 버튼과 입력은48px, 모바일320px에서 가로 넘침 없음. 기존 흰색·핑크·얇은 구분선을 유지하며 hero나 새 장식 영역을 추가하지 않았다.
- 관리자 기본 화면의 문서 버전·12개 한도·처리 대기를 접어 현황과 실제 조작을 먼저 보여준다. 숫자가 의미하는 범위와 저장량/예약량, 정리 대기0/실행 성공의 차이는 숨기지 않는다.
- impeccable은 기존 디자인 유지·두 차례 시각 확인에, humanizer는 의미를 보존한 문구 축약에 사용했다. 검사기의 기존 문서 CSS Arial 경고1건은 새 가입 폼이 별도 글꼴을 사용하므로 법률/완료 화면까지 확장 수정하지 않았다.
- 수정 전 원본 화면과 동일한 모의 정책 화면을 구분해 보관했다. 로컬 캡처는 `.cache/first-signup-release/evidence/`(실제 운영)와 PC의 `C:/web/.moemoa-signup-ui/`, `C:/web/.moemoa-admin-refinement-results/`(합성 자료)이며 Git에 개인 화면을 넣지 않는다.

## 운영 적용 기록

- 설정 준비: Production `PUBLIC_SIMPLE_SIGNUP_V1=1`, `MOEMOA_SIMPLE_SIGNUP_SERVER_ENABLED=true` 저장. 테스트 문서 허용값은 test Preview에만 있고 Production에는 없음. Google client/cookie 키를 재조회·변경하지 않았다.
- 운영 Before User Created Hook를 기존 `public.check_simple_signup_admission`에 연결해 Enabled 확인. 연결만으로 국가 정책이 활성화된 것은 아니며 새 Git 배포/DB 활성 순서가 남아 있다.
- 최종 source·DB release·CI·실제 www 확인: 진행 중.
