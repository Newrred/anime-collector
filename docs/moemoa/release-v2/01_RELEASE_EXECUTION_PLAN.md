# MOEMOA · 공개 서비스 첫 출시 ExecPlan v2

## 현재 실행 범위 — 2026-09-27 일반 공개·사후 검토로 축소

`GENERAL-PUBLIC-POSTMODERATION-01` 사용자 확정에 따라 첫 Web-only 후보에서 성인 인증과 성인 이미지 공개를 보류한다. 일반 이미지는 간단한 공개 확인·미리보기 동의 후 게시하고 신고·관리자 사후 검토로 처리한다. 비공개 업로드에 공개 동의를 요구하지 않는다. 기존 identity/eligibility prototype과 과거 검증은 보존하되 성인 공급자 문의·계약·추가 guard/경합 검사를 이번 출시 필수 작업에서 제외한다. 최소12세·KR/PH/TH는 변경하지 않았으며 아동 개인정보/보호자 동의는 D04의 별도 미완료 조건이다.

이번 작업은 결정·현재 요약·C/W/D 계약을 동일 기준으로 정리하고 현행 코드와 차이를 확인한다. 후속 구현은 기존 W08/W09/W11/W14에 흡수한다: 공개 확인과 정확한 snapshot/policy 결속을 유지하면서 일반 공개의 일괄 사전심사만 사후 검토로 바꾼다. 이미 MATURE/BLOCKED/숨김/철회된 대상은 새 제목·정책·이미지 교체만으로 재노출하지 않는다. 관리자 조치·이의·감사·kill switch, 원본/operationId/quota와 캡처·타인 팬아트의 별도 권리 조건을 보존한다. 체크를 관리자 검토 완료나 제3자 권리 확보로 기록하지 않는다.

검증 종료선: 일반 게시→새 익명 본문/이미지/미니홈 열람→관리자 차단→동일 URL 및 재게시 우회 거부의 한 흐름과 옛 preview 거부를 현행 코드에서 검증한다. 새 사전심사/성인 시스템을 만들지 않는다. DB 변경 시 기존 migration을 덮어쓰지 않고 추가 migration으로 준비하며 기본값은 운영 공개 활성화가 아니다. 로컬 rollback은 해당 변경 되돌림·폐기 DB 종료, 원격 적용/정확한 정책·후보 승인은 D01/D06에 남긴다. 이번 문서 변경은 구현·hosted PASS·배포 완료가 아니다.

### 2026-09-27 실행 — 일반 게시 동의와 사후 차단 수직 변경

- 소스 근거: `20260926140122_memory_content_review.sql:94–105,150–162`의 GENERAL 선검토 reader, `publicationCopy.js`/`minihomeCopy.js`의 기존 미리보기 동의와 공개 controller. 기존 신고 없는 검토 큐·관리자 분류/이의는 재사용한다.
- 변경 지도/흐름: CLI로 추가 migration 생성 → 기본 UNCONFIGURED인 일반 공개 정책 revision → 기존 publish RPC가 검증한 정확한 snapshot/hash/정책에 서버 소유 동의 기록 → reader에서 해당 동의와 기존 권리/철회/숨김 검사 → 관리자 MATURE/BLOCKED는 hash/정책 변경과 무관하게 해당 게시 대상 차단. 양쪽 publish의 원래 RPC를 private으로 이동하고 ACL을 닫아 우회를 막는다. 동의 없는 과거 게시물은 자동 승격하지 않는다.
- UI: 보드/미니홈 최종 확인에 일반 공개 제한·권리·사후 검토 안내를 넣고 성인 분류 결과는 ‘공개 불가’로 표시한다. 비공개 업로드 화면/원본·quota·trusted 권리 근거는 변경하지 않는다.
- 테스트: 기존 disposable PostgreSQL runner에 제한 실행 옵션을 추가해 실제 이미지 예약/준비·게시 fixture에서 신규 계약을 실행한다. 정책 기본off/옛 동의 미승격/정상게시/익명 본문·이미지·home/신고 없는 검토/차단 뒤 편집·재게시/철회·kill switch/ACL·원본·quota 보존을 확인한다. 새 Auth/provider 개발,72table 복원,운영 연결은 제외. UI는 기존 publication Playwright 검증, unit/build를 적용 범위에 맞춰 실행한다.
- 위험/복구: 새 정책 revision은 명시적으로 설정하기 전 비활성. 기존 검토 이력은 그대로 유지하고 새 동의 테이블은 비공개·RLS/ACL로 차단한다. 정책을 UNCONFIGURED로 되돌리면 기존 사전검토 경로로 복귀, 긴급중지는 기존 reads/writes/images/minihomes flags 사용. 감사·사본 삭제 없음. 로컬 폐기 DB 종료로 원복하며 원격 migration/정책/배포는 정확한 후보 승인 후 수행한다.
- 이번 종료선: 새 일반 공개 경계의 실제 로컬 SQL·UI 검증 근거와 남은 hosted/rights·실기기/D04/D06을 분리해 기존03에 기록한다. 캡처/타인 팬아트 등 권리 범위를 늘리거나 기존 trusted 권리를 자동 생성하지 않는다.

실행 결과: 추가 migration `20260927042334_memory_general_postmoderation.sql`과 보드/미니홈 확인·노출 상태 안내를 구현했다. 별도 동의 테이블 대신 기존 private 게시/미니홈 row의 서버 전용 hash/정책 컬럼으로 좁혔다. 오래된 operation replay는 새 동의를 생성하지 않는다. 실제 로컬 SQL 신규33, 새 schema private49, unit394, build19, Chromium30 PASS/설정에 따른 private-source1 skip. 브라우저 첫 실행은 서버 준비 시간 초과로 검사 전 중단, build 후 재실행 종료0. [증거](evidence/2026-09-27-general-postmoderation-local.json). 원격/운영0. 일반 이미지의 기존 trusted 권리 근거 요구는 남아 있으므로 전체 ‘체크만으로 신규 이미지 공개’ 완료로 표시하지 않는다. 다음1개는 기존 W08의 일반 이미지 권리 확인 경로 마감이다.

### 2026-09-27 W08 실행 — 본인 창작 이미지의 공개 확인

- 현재 단순 확인 결정의 구현: 사용자가 본인 창작물임을 명시적으로 선택한 경우만 `SELF_DECLARED` 근거를 저장하고 기존 `TRUSTED` 승인과 구분한다. 캡처·타인 팬아트/기타 권리 근거는 기존 별도 승인 경로에 남긴다. 자동 유형 변경·관리자 GENERAL 생성 없음.
- 추가 migration에서 기존 private 권리 row에 근거 종류·확인 정책·원본 hash를 결속한다. 원본/최적화 사본의 예약과 확인 저장을 한 transaction으로 처리해 실패 시 함께 rollback한다. 현재 소유자/버전/hash·사본 ID/hash·정책·철회와 quota/operationId를 보존한다. 기존 trusted 기록/철회는 자기 확인으로 덮어쓰지 않는다.
- UI에서 본인 창작/별도 승인 이미지 선택과 공개 확인 후 기존 업로드 API로 전달한다. 원본 bytes는 명시적 요청 안에서만 읽으며 사본 경로는 기존 로그인·Storage 검사를 재사용한다. 서버의 일반 공개 정책이 UNCONFIGURED면 새 확인 경로도 닫힌다.
- 검증: 폐기 PostgreSQL에서 무승인 본인 이미지 예약→준비→preview/게시/익명 열람, B/옛 hash/정책/철회/실패 rollback과 사본 결속을 확인한다. HTTP 실제 처리+합성 backend, 실제 React 화면+모의 RPC는 별도로 기록한다. 기존 unit/build, 관련 브라우저 검증만 실행한다.
- 복구/종료선: 정책 UNCONFIGURED는 자기 확인으로 만든 사본도 비노출로 만든다. 기존 trusted/원본/사본 데이터 보존. 원격 migration·flags·배포/유료 변경 없음. 로컬 결과를 기존 W08/C04와 증거에 남기고 hosted/출시 PASS와 구분한다.

실행 결과: `20260927044435_memory_self_declared_image_rights.sql`과 원본/사본 UI→HTTP→새 예약 RPC 연결을 구현했다. 공개 확인 종류는 SELF_DECLARED이며 approved_at null, 기존 TRUSTED/철회 보존. 로컬 SQL29 검사·HTTP 신규3 포함unit397·build19·fresh private49 PASS. 브라우저 전체29 PASS/2 FAIL에서 접근성 이름/시험 flag를 수정하고 대상2 PASS. 실제 원본·사본 준비/선택 변경 시 재확인/preview/게시/새 방문자 이미지 decode를 synthetic adapter로 확인했다. [근거](evidence/2026-09-27-self-declared-image-rights-local.json). 원격/배포0, 다음은 기존 D01/W08 정확한 hosted 시험 후보 준비다.

### 2026-09-27 D01/W08 — 확인된 hosted 시험 후보 (적용 승인 대기)

실행 승인: 사용자 “적용 및 진행”(2026-09-27)으로 아래 정확한3개 및 테스트 한 바퀴 승인. 적용 전 hash/대상/flags 재확인 후 순차 적용하고, 합성 fixture ID와 변경 전 설정을 ignored cache에 기록해 실패 시에도 원복한다. 운영/유료/Git 배포는 범위 밖이다. 현재 실행 결과는 이 섹션과03에 추가하며 아래 준비 시점의 승인 대기 표시는 이력이다.

- 이번 읽기 전용 확인: `moemoa-test` / `nmgkhknponvzcwliajyk`, ACTIVE_HEALTHY. 적용 이력22개, 로컬25개 중 아래3개 미적용. 공개/비공개 이미지 기능 off, Public/Private bucket 비공개. 공개 보드/미니홈·운영자·활성 권리·미정리 공개 사본 모두0. 기존 A/B·기본 연결·복원은 재검증하지 않았다.
- 적용 후보 순서와 SHA256:
  1. `20260926140122_memory_content_review.sql` — `fbffdeb940bd8f40aa92a06131e749d0aac057099cfd45b5b86e18495fcaa6b4`
  2. `20260927042334_memory_general_postmoderation.sql` — `dba59f6c4ce128c59b4344e1bd170ebd7c68fd11d29cf594b108cea1f80d68e2`
  3. `20260927044435_memory_self_declared_image_rights.sql` — `bc6ab74391012dd2500da1d03968ef0c343623db39b58f01709603adfcab0aa1`
- 후보 식별: `test-general-public-20260927-01`, base4ead72b+미커밋 diff. 운영 RC/Git 배포 후보 아님. 적용 직전 hash와 대상 project 재확인. DB에는 각 파일 이력을 남기며 첫 단계부터 완료 전까지 기능 off를 유지한다. 중간 실패 시 이후 적용/활성화를 멈추고 실제 적용 이력만 기록한다.
- 승인 범위: 위3개 additive DB 변경을 moemoa-test에만 적용. 기존 사용자 승인된 A/B·합성 이미지·A 임시 운영자·시험 후 원복 범위를 사용한다. 새 성인/보호자 prototype, 운영 DB, Git push/배포, 유료 변경은 포함하지 않는다. 새 migration 범위는 기존 D01의 NEW_MIGRATION_APPROVAL_PENDING에 해당하므로 명시 확인 후 수행한다.
- 시험 설정: 새 `TEST_ONLY_GENERAL_20260927_01`로 publication/content/general 정책을 맞춘다. Public reads/writes/images/minihomes/follows/reports만 시험 중 활성화하고10개/40MiB·신고10건/일 상한. 사본 시험에만 private 이미지를 기존 승인 범위(50,000,000bytes 논리/40MiB 물리,main1,000,000bytes/thumb120,000bytes,10개,준비/디코드20회/일,read40MiB/global80MiB,동시업로드1)로 임시 활성화한다. 실행 직전 실제 설정을 비밀값 없는 snapshot으로 보존한다.
- 실제 행동 종료선: 합성 원본/최적화 사본2개를 명시 확인→준비→동일operation 복구→preview/게시→새 익명 실제 이미지 decode→미니홈→B 팔로우/재방문→신고/차단→A 사후 MATURE/BLOCKED 조치와 direct URL 거부→철회. 옛 동의/권리철회 거부는 이번 후보에 관련된 경우만 확인한다. HTTP/실제SQL와 브라우저·실휴대폰의 증거는 분리한다. 완성하지 못한 행동은 미검증으로 남긴다.
- 원복: 실패/성공 모두 기존 전역 flags를 먼저 닫고 fixture ID별 게시·미니홈 철회, 생성한 권리만 철회, 생성한 Storage 객체만 기존 cleanup RPC로 정리하여 해당 reservation0 확인. 새로 추가한 A 운영자 권한만 제거한다. 기존 public/private 설정 snapshot 복원, 새 content/general 정책 UNCONFIGURED. schema는 additive 적용 상태로 남기며 데이터/감사/legacy를 삭제하는 down migration은 하지 않는다. 정리 실패는 숨기지 않고 flags off와 남은 fixture ID/bytes를 기록한다.
- 보안 점검: 원격 advisors는 INFO23(RLS/no policy), WARN3(익명 read RPC), WARN42(로그인 RPC), WARN1(유출 비밀번호 보호 off)을 보고. 실제 private client table grants0, 노출 definer의 search_path 누락0, 익명3개는 공개 reader임을 확인했다. 알림 전체를 취약점0 또는 전부 결함으로 바꾸지 않는다. 비밀번호 보호의 현재 Auth 방식 적용성/플랜은 별도 미확인으로 보존. [공식 linter 설명](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- 이번 실행 결과: 원격 읽기/설정·DDL 부재·ACL·advisors 확인과3개 파일 hash 대조. 새 사용자 행동 PASS0, remote writes0. [후보 및 근거](evidence/2026-09-27-general-hosted-preflight.json). 다음1개는 이 정확한 테스트 DB 변경 승인 후 시험 실행.

실행 결과(사용자 적용 승인 후): 후보3개를 원격 test migration `20260927053858/20260927053904/20260927053914`로 순차 적용하고 총25개 이력을 확인했다. 현재 소스 handler+실제 hosted Auth/RPC/Storage로 원본·사본/미니홈/B팔로우·신고/차단/A사후조치/철회28검사 PASS, 물리삭제/용량0·권리/fixture·임시권한/기존home·설정복원4검사 PASS. `.cache/general-hosted-run.mjs` 및 cleanup 실행 모두 exit0. 실제 bytes86/88,96×64,차단404 확인. 추가 제품수정0. 정책은UNCONFIGURED/flags off, schema/감사만 test에 유지. 원격 ACL: private client grants0, 새 RPC anon불가·인증사용자허용, 옛publisher 직접실행불가. advisors INFO27/WARN54는 private tables4/인증RPC8 추가를 반영하며 비밀번호 보호off 알림도 유지. [전체 증거](evidence/2026-09-27-general-public-hosted.json). 제품브라우저/Google OAuth/실폰/CDN PASS 아님. 다음은 기존 W08/W09 제품 Web UI와 최신 test backend 조합 검증이다.

### 2026-09-27 W08/W09 — 최신 제품 UI와 실제 test backend

사용자 “진행 ㄱ”으로 승인된 test 범위를 계속한다. 기존 test 계정·정책 임시 활성/원복을 재사용하고 새 migration/운영/유료 변경은 하지 않는다. 설치된 Playwright와 별도 loopback Astro+현행 이미지 HTTP handler로 실제 화면을 실행한다(전용 agent-browser 명령 미설치). Auth는 실제 test 세션을 주입하되 OAuth 로그인 자체 PASS로 세지 않고, RPC/Storage 응답을 mock하지 않는다. 합성 카드/보드만 준비해 사용자 UI의 원본/사본 선택·확인·준비·preview·게시·새 익명 이미지 decode·철회를 검증한다. 좁은 viewport는 CSS 검증일 뿐 실휴대폰으로 기록하지 않는다. 실패는 최대2개 다른 시도 뒤 정확한 차단을 기록하며, 항상 flags/임시권한/생성fixture/Storage를 복구한다. 기존 readback 검증을 반복 확장하지 않고 제품 UI 조합의 빈칸을 닫는다. 현재 계약을 만족하는 코드는 재작성하지 않는다.

9/27 제품 Web UI+실제 test backend 검증13항목 및 정리4항목 PASS. 원본/동기화 사본 명시선택·권리확인·준비→preview동의→게시→새 익명2이미지 decode→철회,390px 가로넘침없음. 첫2회는 fixture 동기화 목록 누락으로 보드 미표시; 테스트 생성기 수정 후 통과. 정리도구가 유예시간 동안20초 요청제한을 소진해503 두 번 발생, 각각 재시도 후 원복 확인; 별도 모형 재현과 도구수정으로 기록하며 서버장애로 단정하지 않는다. 제품 추가수정/신규migration/운영변경0. [이번 증거](evidence/2026-09-27-general-public-hosted-ui.json). 실폰/OAuth/CDN 및 이 실행의 미니홈/관계/운영자 전체UI는 미검증.

### 이전 재개 범위 (공급자 문의를 다음 작업으로 삼던 당시 기록)

### 2026-09-27 W19 — 휴대폰 테스트 링크 준비

사용자 “ㅇㅋ 준비해줘”에 따라 기존 W08/W09 제품UI PASS 후보를 휴대폰에서 여는 비운영 테스트 링크로 준비한다. 별도 계획/진행판은 만들지 않는다. Vercel 기존 anime-collector 프로젝트의 비운영 브랜치/Preview 환경에만 moemoa-test 연결·공개/비공개 test flags와 정확한 callback origin을 설정한다. 운영 master/도메인/DB/유료플랜은 변경하지 않는다. 로컬 검증된 변경을 테스트 브랜치 커밋으로 결속하고 비밀값을 제외해 push, Preview 배포 SHA와 실제 build/API를 확인한다. 테스트 DB는 기존 승인된 합성 이미지10개/40MiB·신고10건 한도를 유지한다. 본인 창작 테스트 파일과 짧은 로그인→이미지 저장/sync→게시→익명열람→철회 절차를 제공하고 실기기 결과는 사용자 확인 전 미검증으로 남긴다. 테스트 종료 시 test flags/한시 역할/허용 callback을 원복하고 생성한 합성 자료만 정리한다. 인증 설정/배포 도구가 막히면 정확한 제한과 준비된 산출물만 보고한다. 새 schema migration/권리 자동승인/개인 원본 업로드/성인 인증 개발 없음.

사용자 “진행해줘”로 문서 반영과 승인된 독립 마감을 재개한다. identity/eligibility prototype 추가 확장은 동결한다. 이번 종료선은 기존 00/01/02/03·최상위 gates의 상태 불일치를 정리하고 D03/D04 기존 공급자 문의를 실제 승인 가능한 상태로 제시하는 것이다. W09/W11의 게시됨/노출 상태 불일치는 현행 소스 검토만 하고, 심사 운영정책이 필요한 변경은 임의 확정하지 않는다. 추가 race/기초 DB·A/B·복원 재실행, 새 계획/진행판, 운영 변경 없음. 아래 일시정지/다음작업 문장은 당시 이력이며 현재 실행 지시는 03 현재 작업 카드만 따른다.

2026-09-27 후속 사용자 요청: 구현 중단은 유지하되 전체 작업/문서를 master에 커밋해 Pro 검토 자료로 보존한다. 검토 인계 보고서와 현재 요약을 갱신하며 ignored 비밀값/로컬 DB/캐시/사용자 원본은 제외한다. identity shell LF 속성만 보완하여 새 checkout의 검사 스크립트 줄바꿈을 유지한다. 커밋 자체는 배포/운영 DB/Public 승인 아님.

**2026-09-27 사용자 요청으로 실행 일시정지.** 이번 mutation/promotion 대기만료 결함을 재현·보완하고143 PASS(exit0)로 마감했다. evidence/2026-09-27-eligibility-mutation-expiry.json. 최초 post-fix 후속 fixture 상태 오류는 이전 REVOKED 상태 복원으로 교정했다. 기존 완료 replay/삭제 검사도 통과. 새 구현은 시작하지 않으며 03의 기존 계획 대비 검토/현재 작업 카드를 갱신했다. 출시 완료가 아니며 사용자 재개 전 자동 다음 작업 금지.

2026-09-27 C02/W06 저장·승격 대기만료 범위: 현재 guard가 기존 write 전에만 실행되어 이후 잠금 대기 중 만료가 누락될 수 있다. 폐기DB에서 private_titles 테이블을 다른 세션이 잠근 상태로 실제 신규 mutation/promotion을 실행하고 만료 후 결과·실데이터·operation/promotion ledger를 확인한다. 필요한 경우 최초 신규 여부를 저장해 함수 전후 같은 transaction에서 자격을 검사하며 기존 완료 replay/삭제 경로는 그대로 유지한다. 운영0.

2026-09-27 C02/W08 게시자 철회 결과: 기존 공개가 계속 읽히는 실패 exit3 재현 후 local reader의 owner PUBLIC_PUBLISH 현재 증거 검사 추가. 신규5 포함141 PASS(exit0), 익명 본문/미니홈/이미지 차단·snapshot/READY/quota보존·유효 grant 복구 확인. evidence/2026-09-27-eligibility-publisher-read.json. 02의 현재 자격 대조표에 구현/미구현을 분리했다. 다음은 mutation/promotion 잠금 대기 중 만료와 기존 replay 보존. 실제 자격 발급·보호자 관계/가입 전 동의·국가정책·hosted는 별도 잔여. 운영0.

2026-09-27 C02/W08 게시자 철회 감사: C02 기존 계약29행은 게시자 자격 철회가 기존 공개 본문/이미지에도 적용되어야 한다. 현재 local viewer helper는 방문자만 검사해 이를 놓쳤다. 기존 데이터 삭제 없이 공개 reader에서 소유자 PUBLIC_PUBLISH 현재증거/정책/만료 조건을 요구하고, GENERAL 익명 보드·미니홈·서비스 이미지 해석도 철회 후 거부하는 failing regression부터 실행한다. 정식 migration 전 local 보완이며 운영0.

2026-09-27 W08/W13 성인 이미지 HTTP/SQL 결과: 실제 public handler/adapter→폐기PostgreSQL resolver 연결 신규5 포함136 PASS(exit0). 정상WebP hash/length, 익명SQL거부·Storage0, Storage 중 실제자격철회/세션삭제→두번째SQL거부/404/bytes0, 실제전송budget3*2097152보존 확인. evidence/2026-09-27-eligibility-viewer-http.json. Auth/Storage/분류·연령증거는 합성fixture, 실제업체/hosted PASS 아님. 다음은 local 자격 구현 전체를 기존 C/W 계약과 대조해 formal migration 후보 전 누락을 정리한다. 운영/정식migration0.

2026-09-27 W08/W13 성인 이미지 HTTP/SQL 통합 범위: 기존 public handler→verified-session adapter→service RPC를 실제 폐기 PostgreSQL로 연결한다. Auth는 합성 claims/user, Storage는 합성 WebP Buffer임을 명시한다. 정상bytes/hash, 익명거부, 다운로드 사이 DB자격철회/세션삭제→재검사404·이미지미반환, 실제 배달 quota 유지 확인. 원격0.

2026-09-27 W08/W13 viewer 브라우저 결과: Chromium4 PASS(28.4s). 보드/미니홈 각각 실제 WebP decode24px, 표시 후 로그아웃→snapshot/img 제거·BlobURL해제, 이미지 응답 보류 중 계정변경→이전내용 제거·늦은이미지미표시. pageerror/overlay0. evidence/2026-09-27-eligibility-viewer-browser.json. 실제 React/runtime이며 Auth/RPC/Storage는 합성 adapter; hosted/실기기 PASS 아님. 다음은 성인 이미지 실제 HTTP→폐기PostgreSQL 결합 및 Storage 중 철회 실검사. 원격/제품코드 추가수정0.

2026-09-27 W08/W13 viewer 브라우저 범위: 설치된 Playwright Chromium으로 보드/미니홈 각각 이미지 decode 후 로그아웃→snapshot 제거/URL 해제, 이미지 지연 중 A→B 전환→늦은 이미지 미표시를 실행한다. backend/auth는 DEV 합성 adapter임을 명시하며 hosted 인증 PASS와 구분한다. agent-browser 실행파일 미설치여서 기존 Playwright 사용, 새 의존성 설치0.

2026-09-27 W08/W13 client viewer 결과: default-off 인증 metadata reader/이미지 blob fetch 연결, 조회 전후 세션 비교·async 구독 등록 gap 재확인·계정 변경 시 부모 snapshot 비우기/abort/기존 blob cleanup 연결. 순수 adapter 신규3 tests와 build19페이지 PASS. evidence/2026-09-27-eligibility-viewer-client.json. React 코드 점검은 했으나 실제 화면 제거/이미지 URL 해제/로그아웃 브라우저 동작은 아직 미검증이다. 다음은 보드·미니홈 실제 브라우저 계정전환/로그아웃 및 지연응답 폐기 검증. 원격0.

2026-09-27 W08/W13 client viewer 범위: default-off PUBLIC_MEMORY_AUTHENTICATED_VIEWER_V1 아래 reader와 이미지 fetch를 현재 로그인 계정에 연결한다. 조회 전후 세션 비교와 세션 변경 구독으로 보드/미니홈 상태를 비우고 진행 중 요청을 중단한다. Blob URL은 기존 effect cleanup에서 해제한다. 익명/default-off 경로 유지, 순수 adapter 단위검증 및 build 후 실제 브라우저 검증은 별도 기록한다.

2026-09-27 W08/W13 성인 이미지 서버 결과: verified claims/getUser에서 user/session/expiry 추출, service-only SQL에서 현재 세션 확인 및 임시 context 설정/복원. default-off API flag 아래 Storage 전후 인증과 visibility 재검사. 로컬 HTTP 신규2·SQL 신규6 포함131 PASS, 전체unit391·build19페이지 PASS. evidence/2026-09-27-eligibility-viewer-image.json. HTTP는 Auth/RPC/Storage 합성이고 SQL은 별도 실제 폐기 DB 검증이며 통합 hosted PASS로 합산하지 않는다. 다음은 client 인증 reader/이미지 연결 및 로그아웃·계정전환 시 폐기, 이어 통합검증. 운영/정식migration0.

2026-09-27 W08/W13 성인 이미지 서버 연결 범위: 기존 signed-session 검증을 재사용하여 서버에서만 user/session/token expiry를 추출하고 service-only resolver에 전달한다. SQL은 현재 세션 확인 후 transaction-local viewer context로 기존 resolver를 호출하며 전후 context 복원한다. 이미지 API의 default-off viewer flag 아래 Authorization 요청만 연결하고 Storage 전후 인증/DB 검사를 반복한다. 익명 일반 경로와 원본 hash/용량/no-store는 보존한다. 로컬 fixture와 HTTP unit 검증, 운영0.

2026-09-27 W08/W13 성인 metadata 로컬 결과: board/home reader의 exact review와 기존 숨김/철회 검사를 보존한 MATURE_VIEW+현재 세션 조건 추가. 신규12 포함125 PASS(exit0), GENERAL 익명 유지·로그인 단독 거부·기본off·정상 nested home·철회/만료/정책변경/삭제세션/다른사용자세션/차단/오래된review 거부 확인. evidence/2026-09-27-eligibility-viewer.json. 아래 범위 중 이미지 resolver는 저장소 좌표를 사용자 RPC에 노출하지 않도록 기존 service-only ACL을 유지했으며 아직 viewer 전달 미연결이다. 다음은 검증된 서버 세션→이미지 service resolver→Storage 후 재검사 연결, 이후 client 세션변경 폐기. JWT/Auth/분류는 합성fixture, 성인인증 실제 PASS 아님. 원격/정식migration0.

2026-09-27 W08/W13 성인 reader 로컬 연결 범위: 정식 migration 밖 prototype에서 exact content review를 보존하며 GENERAL 또는 현재 MATURE_VIEW 증거+유효 auth session으로만 읽도록 한다. JWT subject/session/expiry/anonymous, DB session 종료와 증거 철회를 검사한다. 이미지 전용 authenticated resolver도 동일 reader를 사용하며 서비스 경로에 임의 viewer ID를 받지 않는다. 합성 DB fixture만 실행하고 실제 인증·국가 정책 승인이나 성인 활성화로 간주하지 않는다. 이후 HTTP/client 연결 및 계정 전환 폐기 검증이 남는다.

2026-09-27 W08/W13 방문자 감사 결과: 공개 metadata는 익명 client, img URL은 token 미전달, 서버 resolver는 service-only임을 현행 코드로 확인했다. 성인 접근은 인증 reader+이미지 fetch+세션변경 폐기+서버 자격 검사를 함께 연결해야 한다. 추가로 공개 자격 오류가 일반 실패로 소거되는 unit 실패를 재현하고 3개 전달 지점 수정, 관련36 tests PASS(신규2). evidence/2026-09-27-public-viewer-boundary.json. 전체 unit/build/hosted/화면 PASS는 추가하지 않았다. 다음은 default-off 로컬 인증 방문자 수직 연결, 실제 인증업체·국가정책과 원격 적용은 별도 게이트.

2026-09-27 W08/W13 방문자 경로 감사 및 오류 전달: 공개 reader는 별도 익명 client, 공개 이미지 img URL과 service-only resolver에는 viewer 전달이 없다. 따라서 MATURE 허용 SQL만 바꾸지 않고 인증된 reader/이미지 fetch/session 변경 폐기/서버 자격 검사 연결을 하나의 잔여로 유지한다. 이번에는 기존 공개 자격 guard의 오류가 server RPC→이미지 준비 및 publication gateway에서 소거되는 누락을 failing unit으로 확인 후 네 가지 bounded code만 보존한다. 성인 공개 활성화/원격 적용은 하지 않는다.

2026-09-27 W08 public asset 완료 결과: 저장된 소유자 PUBLIC_PUBLISH 전후 검사와 private 사본 예약 wrapper를 추가했다. 로컬 PostgreSQL/HTTP 묶음 exit0, 기존107+신규6=113 PASS. 철회 후 완료 거부·예약 보존·취소 허용·별도 이미지 권리 유지·service 우회 거부·유효 완료의 실제 byte 정산 확인. 초기 테스트의 권리 오류 기대값을 현행 PUBLICATION_RESTRICTED로 교정했다(제품 권리 검사 변경 없음). evidence/2026-09-27-eligibility-public-asset.json. 공개 Storage/화면/hosted 및 개별 완료 경합은 미검증. 다음은 성인 열람의 인증된 방문자 전달 경로 검토이며 원격/정식 migration0.

2026-09-27 W08 public asset 완료 범위: service-role complete는 auth.uid가 아니라 저장된 asset.user_id의 PUBLIC_PUBLISH를 전후 검사한다. private 사본 예약의 외부 RPC도 최종 대기 후 검사를 받도록 기존 wrapper 목록에 포함한다. 실제 reserve→철회→complete거부/취소보존 및 재승인→권리철회거부/유효완료를 합성 로컬 SQL로 검증한다. 국가/권리 승인 생성 API는 만들지 않고 fixture 승인만 사용하며 원격0.

2026-09-27 W08 public 범위/경합 결과: guard를 shared writer에서 실제6RPC로 좁혀 follow의 기존 검사를 보존했다. 차단/팔로우해제/내부writer 및 실제 publish 잠금대기 만료 rollback 신규4 포함107 PASS. evidence/2026-09-27-eligibility-publication-races.json. 내부helper ACL 검사역할을 owner로 교정했으며 제품권한은 유지. 전체6RPC 개별경합/실제follow·public asset완료·MATURE/hosted는 미검증이다. 다음은 public asset complete의자격검사이며 운영0/정식migration0.

2026-09-27 W08 writer 경계 보완: 공통 writer가 follow에도 사용되므로 PUBLIC_PUBLISH가 follow 자격을 임의로 바꾸지 않도록 local guard를 prepare/publish 보드·미니홈, public asset 예약·이미지 준비 6개 RPC로 좁힌다. 함수 전후 동일 transaction 재검사로 잠금 대기 만료 시 쓰기 rollback을 확인한다. 신고/차단/철회는 기존 경로 유지, 운영0.

2026-09-27 W08/W13 PUBLIC_PUBLISH 결과: local 공통 writer guard와 실제 합성 보드/미니홈 RPC 검사 추가, 신규7 포함103 PASS. 권리와 moderation review 조건을 우회하지 않으며 review는 fixture 주입임을 명시했다. 초기 fixture 오류 세 가지(빈 entries, SYSTEM_GENERATED, 디자인 spec 필수키)를 보완 후 통과. evidence/2026-09-27-eligibility-publication.json. 기존 공개 읽기/성인 접근/게시 중 잠금대기 만료와 전체 호출 영향은 별도 잔여. 다음은 writer 호출 전체 및 lock-wait expiry 검증이다. 정식migration/원격0.

2026-09-27 W08/W13 공개 자격 로컬 범위: 기존 require_publication_writer를 보존한 wrapper에서 PUBLIC_PUBLISH를 별도로 요구한다. 공유 저장소의 CLOUD_WRITE/MATURE_VIEW를 대체 자격으로 사용하지 않는다. 미니홈 실제 prepare/publish→자격철회→prepare 거부/revoke 허용을 local RPC로 검증한다. 일반/성인 공개 읽기 정책 연결은 별도이며 지금 MATURE를 열지 않는다. 신규 schema는 prototype만, 원격0.

2026-09-27 W06/W08 SQL-HTTP 결과: 실제 loopbackHTTP→앱handler/processor→privateRpc→PostgreSQL 함수 연결로 신규4 포함96 PASS. 합성 PNG 실제 인코딩/bytes-size, 중간철회403과 예약보존, 취소/정리, 완료응답socket강제파기 후 GET상태/bytes복구를 확인했다. evidence/2026-09-27-eligibility-image-http.json. Auth합성/Storage Map이며 hosted·화면·실기기 검증 아님. 다음은 공개 게시/성인읽기 경계에 자격 증거를 연결할 현행 경로 검토다. 원격/정식migration0.

2026-09-27 W06/W08 SQL-HTTP 실행 범위: 기존 private-image HTTP handler/processor/privateRpc와 실제 폐기 PostgreSQL을 psql adapter로 연결한다. Auth는 합성, Storage는 메모리 Map임을 표시한다. 실제 PNG→WebP 업로드 중 자격철회→403/manifest PREPARING/bytes 유지→명시취소→cleanup, 성공 완료 후 응답 유실→GET READY/실제 bytes 복구를 검증한다. 운영/원격0, 제품 Auth/Storage 통합 PASS가 아니다.

2026-09-27 W06/W08 image 경합 결과: media lock 대기 중 만료가 완료를 허용하는 실패를 재현 후 authorize/reserve/complete에서 lock 획득 직후 guard 재확인을 추가했다. 실제 complete의 철회 먼저/완료 먼저/대기 중 만료3종 신규 포함92 PASS, bytes/quota 유지. evidence/2026-09-27-eligibility-image-races.json. 실행 중단 후 동일 session58644 종료0 확인으로 결과를 회수했다. 별도 reserve/authorize 경합·SQL-HTTP·Storage는 미검증이며 다음 작업은 기존 HTTP handler와 실제 로컬 SQL 연결이다. 정식migration/원격0.

2026-09-27 W06/W08 image 경합 실행 범위: 폐기 DB의 실제 complete RPC와 자격 철회를 두 세션에서 양방향 실행한다. 별도로 media lock 대기 중 만료 시 stale guard가 완료를 허용하는지 재현하고 필요하면 기존 guard→media lock 순서를 유지하며 실제 작업 직전에 만료를 재확인한다. 합성 fixture만, 원격/정식migration0. HTTP/Storage 검증과 구분한다.

2026-09-27 W06/W08 HTTP 결과: 자격 오류 allowlist 누락을 failing regression으로 확인 후 server/controller에 4종 코드와 상태 전달 추가. JSX 안내는 컴파일만 확인. 신규3 포함unit387·build19페이지 PASS. evidence/2026-09-27-eligibility-http.json. 실제 HTTP+합성backend 사본 보존 및 모의fetch GET복구 검증이며 DB/Storage 연결·화면은 별도다. 다음은 이미지 완료/철회 DB 동시성 및 실제SQL-HTTP 통합. 원격0/DB변경0.

2026-09-27 W06/W08 HTTP 자격 오류 실행 범위: 기존 private RPC 오류 allowlist와 전송 controller allowlist에 자격 필요/만료/정책변경/정책미준비를 구분한다. 현재는 일반 실패로 소거될 것으로 예상되므로 회귀를 먼저 실행한다. 실제 loopback HTTP에서는 준비중 완료거부 후 사본 자동삭제0, 전송 controller에서는 journal/원본 보존과 GET 상태 복구를 확인한다. UI는 이유 안내만 추가하고 존재하지 않는 인증 화면으로 안내하지 않는다. 원격/의존성/DB 변경0.

2026-09-27 W06/W08 image 결과: authorize/reserve/complete에 local 자격 wrapper를 추가하고 기존 get/read/cancel/cleanup 유지. 신규14 포함89 PASS, 중간 철회 실패·quota 보존·유예/정산·READY 상태 회수 확인. evidence/2026-09-27-eligibility-image.json. Storage bytes/HTTP·동시성 검증은 별도이며 원격/정식migration0. 다음은 실제 이미지 완료 RPC와 철회 경합, HTTP 오류와 완료 상태 복구 연결 검증이다.

2026-09-27 W06/W08 image 자격 연결 범위: local-only wrapper를 authorize/reserve/complete에 적용해 실제 owner의 CLOUD_WRITE를 검사한다. complete는 서버 manifest owner를 사용한다. 기존 get/read/cancel/cleanup은 유지하여 완료 상태 조회·회수·삭제 정산을 검증한다. 철회 후 새로운 POST는 차단되며 완료응답 유실은 기존 GET policy/manifest로 확인한다. raw Storage/HTTP 업로드 검증으로 확대하지 않고 폐기 DB RPC로 재현·검증한다. 원격/정식migration0.

2026-09-27 W06 Board/승격 결과: 철회 상태에서 빈 guest 승격이 성공하는 local guard 누락을 재현(exit3)하고 승격 진입점에 보완했다. 기존 source hash/device/replay 검사는 원본 함수가 유지한다. 새11 포함75 PASS, 실제 RPC mutation과 철회 양방향 경합의 title/operation ledger까지 확인. evidence/2026-09-27-eligibility-promotion-races.json. 승격 자체 경합·완성 visual카드·Storage·hosted는 미검증이다. 다음은 private image 예약/완료에 local 자격 guard를 연결하고 취소/삭제 정산을 유지하는 검증이다. 정식migration/운영 변경0.

2026-09-27 W06 Board/승격 후속 범위: promote_guest_memory는 공통 mutation 호출 없이 직접 insert하므로 기존 로컬 guard를 우회할 수 있다. 먼저 철회 상태에서 빈 승격 신규 요청을 재현하고 public 승격 wrapper에 동일 transaction guard를 연결한다. 이미 기록된 같은 사용자/guest 승격은 기존 hash/device/replay 검사로 돌려보낸다. Board RPC와 실제 두 세션 저장/철회도 합성 로컬 DB에서 검증하며 원격 적용하지 않는다.

2026-09-27 W06 mutation 결과: optional 로컬 wrapper와 public RPC 합성 계약 추가, 15신규+49기존=64 PASS. 개인 작품/DRAFT card UPSERT·철회 후 새 쓰기 거부·동일 replay·삭제/tombstone·hash/다른계정 거부 확인. 초기 검사 테이블명 오류를 수정했으며 기존 제품 구현 결함으로 분류하지 않는다. evidence/2026-09-27-eligibility-mutation.json. 완성 visual card·Board/승격·실제 mutation 동시성·Storage는 별도 잔여다. 다음은 해당 실제 mutation 경합과 Board/승격을 로컬 검증한다. 원격/정식 migration0.

2026-09-27 W06 mutation 연결 실행 범위: 기존 private-image 폐기 DB runner의 선택 옵션으로 자격 prototype과 공통 private.apply_memory_mutation wrapper를 적용한다. 원래 함수는 이름 변경 후 그대로 재사용하고 DELETE/확정 replay는 기존 검사를 통과하도록 보존한다. 합성 새 계정의 실제 public RPC로 허용 쓰기→철회→새 쓰기 거부/기존 replay/DELETE/다른 계정/변조 hash를 확인한다. 정식 migration·운영 연결은 하지 않으며 기록 회수/UI·Storage까지 완료로 확대하지 않는다.

2026-09-27 W06 자격 prototype 결과: tools/identity의 private 정책/증거/guard와 계약·경합 검사를 추가했다. 신규13+기존25=38 PASS, 정책 기본off·다른계정/목적·철회/만료·클라이언트/서비스 직접 grant 거부, 철회 먼저/쓰기 먼저 양방향 실제 두 세션 순서 확인. evidence/2026-09-27-eligibility-local.json. 합성 쓰기 probe이며 실제 mutation/Storage/동의 철회 UI 연결은 미검증. 다음은 기존 mutation에 로컬 연결하여 UPSERT 거부와 DELETE/replay 보존을 검증한다. 국가/공급자 grant 생성이나 운영 스키마 변경은 하지 않았다.

2026-09-27 W06 로컬 자격 저장소 실행 범위: `tools/identity`의 폐기 PostgreSQL runner에 private 자격 정책/증거 prototype과 transaction 내 guard를 추가한다. 정책 기본off, grant 발급 API 없음, 개인정보 원문 없음. 합성 DB owner fixture로만 증거를 넣고 정책/목적/만료/철회·클라이언트 권한·두 세션 경합을 검사한다. 실제 mutation/Storage 연결·국가 정책·공급자 권한 부여는 후속이며 이 단계 PASS와 구분한다. 정식 migration/원격 변경 없음, 폐기 DB 종료로 복구한다.

2026-09-27 W06 이용 자격 적용 지점 결과: 실제 mutation/promotion wrapper와 계정 초기화, private image 예약/완료/회수 경로를 조사해 C02에 매핑했다. 완료 replay와 새 쓰기, DELETE/철회/회수와 UPSERT, service-role 작업의 실제 owner를 구분해야 한다. 아직 국가 정책이나 권한 상태를 배포하지 않았으며 코드/DB 변경0·새 runtime PASS0. 기존 384 unit은 과거 실행이다. 다음 로컬 작업은 서버 소유 증거 상태 및 철회와 쓰기 원자성 계약이며 외부 공급자의 VERIFIED를 성인/보호자 자격으로 바로 승격하지 않는다.

2026-09-27 W06 가입 경계 감사 결과: OAuth 시작→callback 교환→계정 runtime 초기화 경로와 identity prototype의 기존 user/session 필수 조건을 대조했다. 가입 전 아동 동의는 미구현이고 GUARDIAN_IDENTITY를 해당 완료 근거로 사용할 수 없다. C02에 신규 생성 hook 및 주체/일회성 동의 결속 계약을 추가했다. 공식 hook 안내는 기술 수단의 근거이며 국가별 동의 충족 판정이 아니다. 소스 검색·읽기/문서 diff 검증만 수행, 신규 runtime PASS0. 다음은 이미 로그인한 사용자의 자격 철회 시 신규 쓰기와 데이터 회수/삭제를 분리할 기존 서버 지점 감사다. 실제 국가별 보관/연령 기준이나 원격 Auth 설정은 변경하지 않는다.

2026-09-27 W06 서명 검증 결과: 실제 SDK/WebCrypto가 ES256 위조·변조·만료를 차단하고 사용자 조회 불일치/익명/거부도 인증 실패로 처리했다. 제품 수정 불필요, 신규 회귀1 및 전체 unit384 PASS. evidence/2026-09-27-identity-signed-session.json에 범위·미검증을 기록했다. 다음은 가입 전 동의와 기존 Google OAuth 시작 경계 검토이며 실제 공급자·국가별 정책을 임의 확정하지 않는다.

2026-09-27 W06 실행 범위: 설치된 Supabase Auth SDK의 실제 getClaims/getUser와 로컬 HTTP JWKS fixture를 연결한다. 일회용 ES256 키로 정상·위조·만료 토큰 및 사용자 조회 불일치를 검증한다. 외부 Auth는 합성이므로 실제 Google 로그인/hosted 세션 취소 PASS와 구분한다. 신규 의존성·원격 변경 없이 tests/unit에 회귀를 추가하고 전체 unit을 실행한다. 기존 서버 구현은 재현된 실패가 있을 때만 수정한다.

2026-09-26 W06/D03/D04 공급자 준비 결과: 기존 계획 안에서 공식 PortOne 요금·채널·V2 본인인증 안내를 대조하고 `../operations/2026-09-26-identity-provider-inquiry.md`에 발송 가능한 문의 초안을 작성했다. 본인인증 단독 OPI 요금 면제와 인증 제공사 비용을 구분하며, 개인 계약/해외 현지 인증/보호자 관계 기능은 미확정으로 남긴다. 외부 발송·계약·API 연결·유료 변경 없음. 문서 링크/공백 검사만 수행하며 새 사용자 행동 PASS로 계산하지 않는다. 다음은 기존 W06 실제 인증 세션 검증 공백을 로컬에서 확인하는 작업이다.

작성일: 2026-09-22 · 상태: **실행 지침 / 구현 상태는 03 진행판에서 관리**

> 목표는 고정하고, 구현 순서와 수단은 근거에 따라 바꾼다.
> 필요한 일이 생겨도 계획을 더 깊게 파지 않는다. 같은 진행판에서 닫거나, 이동하거나, 멈추거나, 보류한다.

## 1. 목적과 사용자 결과

### 2026-09-26 간이 테스트용 Git 배포 실행 범위
- 사용자 요청: “배포 하고 이어가줘 폰이나 다른사람들한테 배포 링크로 간이 테스트좀 해보게”. 현재 변경을 검증해 master에 반영하고 Vercel Git 배포 및 moemoa.xyz의 동일 SHA를 확인한다. 정식 Public 출시/D03~D06 전체 PASS와 구분한다.
- 제공: 기존 계정·작품·개인 기록·Archive/Board 및 Web 로컬 이미지 선택. 이미지는 선택한 브라우저에만 보관하며 서버 자동 업로드하지 않는다. private 동기화 및 public 게시/사본 입력은 닫힌 상태로 배포한다.
- 변경: 기존 코드/증거를 선별 커밋, 추적 중인 .env.production에 비밀 없는 간이 테스트 flags를 명시. DB migration 파일은 추적하되 운영 적용하지 않는다. deliverables와 로컬 자격증명/로그는 커밋하지 않는다.
- 검증: 현재 unit/catalog/핵심 Chromium·모바일 layout, intake flag-on 회귀, production build; 커밋 전 비밀 스캔; GitHub CI와 Vercel READY/SHA/build-info, 실 URL의 기록 작성·재방문·모바일 폭 확인. 기존 통과와 이번 실행을 분리한다.
- 복구: 문제 발생 시 해당 코드 커밋을 Git revert하여 master Git 재배포. 운영 DB 변경 없음. 사용자 로컬 이미지·기록 삭제 없음. 공개/연동 미완료 조건은 기존 W06/W08/D01에 유지한다.
- 배포 관찰: 29ca80d Git 배포 READY, 실제390px에서 합성 로컬 이미지 저장/Archive 재방문/detail decode 확인. cloud build-info workingTreeDirty=true가 기존과 같이 남아 installCommand를 npm ci로 고정하고 build log에 파일 경로만 기록해 원인을 확인한다. 비밀 값/파일 내용은 로그에 출력하지 않는다.

### W06/W08/D01 다음 hosted 검사 범위 — 실행 전 고정안
- 2026-09-26 실행: 사용자가 위 다음 작업 설명 후 “작업 이어서 진행”을 지시. 기존 test-only 합성 이미지/계정 승인과 함께 이 고정 범위의 테스트 실행으로 해석한다. 운영 적용/일반 사용자 권리 승인이 아니다. 적용 전 관련 함수/설정만 사본 저장, transaction 내 두 migration 및 history 기록, API 실증 후 정책/권리 원복. 실제 Google 로그인과 실물 휴대폰은 별도 근거 없으면 PASS로 만들지 않는다.
- 대상은 기존 moemoa-test(nmgkhknponvzcwliajyk)만. 운영 moemoa.xyz 배포 설정과 분리된 test 실행 환경을 사용한다. 추가 계정/기초격리/72table 복원을 반복하지 않는다.
- 적용 후보: 20260925152859_memory_private_image_boundary.sql → 20260925164126_private_representation_public_rights.sql. 기존 retry/author/visual-null 세 migration은 이미 test 적용된 근거와 migration history를 대조해 중복 적용하지 않는다. 실제 적용 시 source SHA와 별도 test data release ID를 기록한다.
- 임시 정책 제안: revision TEST_ONLY_PRIVATE_REP_20260926, quota50,000,000bytes/main1,000,000/thumb120,000, 총 test 물리량40MiB·10assets, owner 준비/변환 각20회/일·업로드 동시1, owner 읽기40MiB/global80MiB. 숫자는 합성 검사 한도이며 운영 가격·서비스 약속이 아니다. 승인된 A/B 및 합성 이미지에만 사용한다.
- 검사: A 명시 private opt-in→실제 Storage 저장→원본 없는 새 Web 세션 표시; 미승인 사본 공개 거부→정확 source와 representation trusted 근거 부여→별도 public 동의→게시→새 익명 열람. B/변조/철회/불명 완료는 실제 owner/bytes/hash/operation/quota 변화를 비교한다.
- 정리: public 게시 철회·읽기 차단→합성 private media 취소/지연 cleanup→실제 bytes 제거 후 용량 정산→원래 test flags/정책/역할 복원. 이력·원본 checksum·권리철회 fence를 역삭제하지 않는다. 권한 부족이나 서로 다른 두 시도에서 진전 없음이면 정확한 차단만 남긴다.
- 이번 간이 배포는 위 원격 적용/정책/권리 쓰기를 실행하지 않았다. D01에서 실제 변경 범위와 승인을 확정한 뒤 실행한다.
- 후속 실행 결과(2026-09-26): 사용자의 이어서 진행 지시로 test-only 두 migration 적용, 실제 private HTTP/Auth/RPC/Storage15항목 PASS. admin test sessions으로 검증하며 OAuth/제품 두 기기 UI 성공과 구분. Public은 전 과정off, 권리 승인 추가0. 기존 삭제상태 제약 때문에 초기 fixture 정리1실패가 있었고, 정책 원복→올바른 tombstone→지연 cleanup 후 실제객체0/용량0/RLS·ACL 등4항목 PASS로 복구했다. 상세 evidence/2026-09-26-private-image-hosted-roundtrip.json. 다음은 실제 UI 두 세션과 합성 trusted rights 양성 Public 경로; 실물폰은 별도 확인.

첫 정식 출시를 다음 한 흐름으로 정의한다.

**기억 작성 → 공개할 기록을 직접 선택 → 보드 공개 → 미니홈 전시 → 비로그인 방문자 열람 → 다른 계정의 팔로우 → 팔로우 목록에서 재방문 → 공개 철회·신고·관리자 조치.**

동시에 비공개 기록·작품 상태·두 가지 작품 보기·Archive·기존 Board·백업의 기본 경험을 유지한다. 이것을 위해 새 SNS 전체를 만드는 것은 목표가 아니다.

완료는 '할 일을 더 찾지 못함'이 아니라, 02에 정한 출시 계약을 검증한 상태다. 새로운 개선 아이디어가 남아 있어도 출시 계약을 만족하면 종료할 수 있다.

## 2. 관련 확정 결정과 우선순위

### 2.1 이번 대화에서 승인된 제품 범위

- 개인 기록과 계정 사용, 공개 보드, 공개 미니홈, 팔로우, 필수 운영 장치를 첫 정식 출시 범위로 포함한다.
- 기능 아이디어 확장은 중단한다. 공개 기능을 안전하게 연결하는 필수 보완은 수행한다.
- 공식 표지의 승인된 VisualAsset 사용과 Poster/Memory 보기 모드는 유지한다.
- 신규 사용자·개발 기기의 기록을 명시적 승인 없이 지우지 않는다.

### 2.2 문서 우선순위

1. 이번 출시 범위를 반영한 최신 승인 Decision Log와 그 이후 사용자의 명시적 결정.
2. 기존 최상위 제품 결정 중 이번에 교체하지 않은 항목.
3. 이 ExecPlan의 범위·진행 규칙, 02의 목표 행동 계약.
4. 현재 코드와 실제 환경에서 확인한 사실. **코드는 현재 상태의 근거이지 제품 원칙을 자동 변경하는 권한이 아니다.**
5. 기존 9월 22일 검토서의 결함·증거·QA. 충돌하는 Private-only 출시 전제만 폐기한다.
6. 더 오래된 기획·연구·브레인스토밍: 배경 자료일 뿐 출시 할 일이 아니다.

M0에서 새 결정을 기존 canonical Decision Log에 좁게 반영한다. 전체 문서 교체·오래된 아이디어 일괄 승격·권리 조건 삭제 금지.

### 2.3 기본 구현안의 지위

이 문서와 02의 구체적 데이터 구조명·UI 배치·기본 동작은 **최소 실행 기본안**이다. 기존 구현이 같은 사용자 결과와 안전 조건을 만족하면 그대로 재사용한다. 원본/공개 분리, 명시적 공개 선택, 철회, 권한, 신고 등 필수 조건을 낮추는 변경은 자동 결정하지 않는다. 실제 운영 활성화는 별도 승인 사항이다.

## 3. 현재 상태와 저장소 근거

이 계획은 `MOEMOA-Pro-Service-Readiness-2026-09-22.zip`과 `MOEMOA_RELEASE_READINESS_2026-09-22` 검토서에 기반한다. 원본 ZIP은 현재 작업 저장소와 다를 수 있고, GitHub 과거 HEAD 또는 운영 배포와 동일하다고 가정하지 않는다. 출처 해시는 `sources/SOURCE_BASELINE.json`에 있다.

기존 검토서에는 25개 지적(U01~U11, S01~S14)이 있다. 모두 현행 결함이라고 다시 선언하지 않는다. M0에서 아래 중 하나로 분류하고 03의 기존 지적 추적표에 적는다.

`재현됨 / 소스 위험 확인 / 미검증 / 이미 수정됨(현재 증거) / 목표 변경으로 기대 수정 / 해당 없음(근거)`

과거 자료는 개인 작품 연속 기록·메타데이터 백업·Board 갤러리·Archive 검색·Home 재발견 등의 개선도 기록한다. 이미 동작하는 것을 다시 만드는 티켓으로 바꾸지 않는다.

위 설명은 2026-09-22 계획 작성 당시의 기준이다. 당시 초기값 TODO를 현 상태로 재적용하지 않는다. 최신 기준은 `2026-09-25-pro-interim-review.md`와 03의 현재 표·증거다. M0 및 W01/W02/W04/W05의 종료 기록을 보존하고, 나머지는 구현·자동 검사·실제 검사·승인을 구분한다. 4/20은 엄격한 종료 수이지 구현률 20%가 아니다.

이번 검토 반영으로 새로운 제품 실행 증거는 생기지 않는다. 정확한 current HEAD와 bbff3d4 이후 변경을 먼저 확인하며, 현재 작업 상태는 03 한 곳에서만 갱신한다.

## 4. 범위: 포함과 제외

### 포함 — 빠지면 정식 출시 목표 미달

| 영역 | 최소 도달점 |
|---|---|
| 개인 기록 | 정상 작성·누적·수정·삭제·작품별 탐색·Board 분류, 원본 보호 |
| 계정 | 로그인/거절/만료/로그아웃, Guest 승격 동의, 계정별 격리, 지원하는 메타데이터 동기화의 진짜 완료·재개 |
| 공개 보드 | 작성자가 공개 대상과 내용을 검토·게시하고 다른 기기 방문자가 실제 이미지와 함께 열람, 수정·철회·삭제 가능 |
| 공개 미니홈 | 닉네임·소개·선택한 대표 공개 기록/보드, 안정적인 공유 주소, 방문자 화면 |
| 팔로우 | 로그인한 이용자의 팔로우·해제, 중복 방지, 내 팔로우 목록에서 재방문 |
| 공개 안전 | 신고·차단·임시 비공개·조치 통지·이의제기 접수·계정 제한·감사·공개 긴급 중지 |
| 운영 | 서버 한도·비용 경보·지원/삭제·DB/파일 복구·카탈로그 후보 갱신/승인 게시/복구·검증된 Git 배포 |
| UX | 모든 노출 화면/행동의 목록화, 닫기·취소·저장·복귀·실패·권한·빈 상태의 일관된 결과 |

Web + Android라는 기존 제품 대상을 임의로 축소하지 않는다. Android의 첫 배포 채널·동시 출시 여부는 현재 승인 상태를 M0에서 확인하고 D02에 기록한다. 결정 전에도 공통 도메인과 양 플랫폼 회귀를 보호한다. 실기기 검증이 어렵다고 자동으로 Android를 완료 또는 제외 처리하지 않는다. iOS 신규 앱 개발은 추가하지 않는다.

**2026-09-25 실행 범위 보완:** 최신 인계서에 기록된 사용자의 Android 이번 실행 제외를 따른다. Android 추가 구현·실기기 준비를 이번 본 작업의 자동 선행조건으로 만들지 않는다. 기존 소스·데이터·공통 도메인은 보존한다. 최종 Web-only 후보에 대한 명시 승인이 D02에 기록된 경우에만 C12의 플랫폼별 해당 없음 처리를 사용할 수 있다. 이번 실행 제외만으로 Android 검증을 통과시키거나 제품의 영구 지원 범위를 바꾸지 않는다.

### 제외 — 첫 출시의 선행 조건으로 만들지 말 것

DM, 댓글·좋아요, 취향 매칭, 추천 피드, 관계도, 새 ID/팔레트/영상 생성기, 공동 Board 편집, 타인의 카드 재수집, 자유형 미니홈 빌더, 통계·브랜딩 전면 재설계, 범용 관리자 플랫폼, 전체 비공개 이미지 자동 클라우드 백업.

현재 이미 있는 Tier·회고·보기 설정은 보존한다. 출시 경로에 노출되어 있다면 기존 행동과 접근 제어를 검증하되 새 기능으로 고도화하지 않는다.

공유 링크→작성자 미니홈→팔로우 목록의 재방문만으로 최초 연결 경로를 완성할 수 있다. 별도 이용자 검색·공개 피드·추천은 필수가 아니다. 이미 있는 안전한 탐색 경로는 유지할 수 있다.

## 5. 아키텍처·데이터 흐름과 선택 자유

```text
Private 원본: 작품/개인 작품 + Memory + VisualAsset + Board
          │ 사용자에게 공개할 필드·이미지·대상을 미리 보여줌
          ▼
공개용 표현: 선택한 필드와 공개 전달 가능한 이미지 revision
          │ 게시·철회·관리자 상태를 서버에서 확인
          ├─ 공개 Board/카드 방문자 읽기
          └─ 미니홈의 선택 전시
                    │
                    └─ 팔로우한 사람 목록 → 재방문
```

`공개용 표현`은 개념이며 반드시 신규 테이블 이름을 뜻하지 않는다. 기존의 안전한 publication/read-model을 재사용할 수 있다. private 테이블을 그대로 익명 공개하거나 `visibility=true`만 추가하는 것으로 끝내지 않는다.

기본안은 원본의 비공개 수정을 공개본에 자동 반영하지 않고, 다시 검토해 '공개 내용 갱신'하는 것이다. 철회·원본 삭제·관리자 차단은 기다리지 않고 노출 권한에 반영한다. 자세한 동작은 02의 C03~C05에서 확인한다.

이미지 전달은 다음을 구분한다.

- 승인된 공식 표지: 현재 catalog revision과 권리 근거 재사용.
- 시스템 디자인: 안정적인 렌더/데이터 계약으로 방문자에게 재현.
- 사용자가 공개하기로 선택한 이미지: 명시적인 공개용 사본 준비·검증·서버 전달.
- 공개되지 않은 개인 이미지: 기존 로컬 원본을 유지. 계정 연결만으로 업로드하지 않음.

일반 클라우드 갤러리나 범용 업로더를 먼저 완성할 필요는 없다. 현재 공개 기능에 필요한 최소 업로드/읽기/철회 경로만 만든다.

## 6. 변경 파일 지도

M0에서 다음 지도에 실제 경로·현재 구현 상태를 03으로 연결한다. 기존 path가 바뀌었으면 현행 경로를 쓴다.

| 대상 | 기존 검토서에서 확인할 코드군 | 이번 변경 범위 |
|---|---|---|
| 공통 UX | modal/unsaved hooks, Composer, QuickLog, Memory/Board views, navigation/messages | 재현된 행동 위반과 공개 흐름 연결 |
| 계정/sync | `syncMemoryMetadata`, gateway, account runtime, RPC/migrations | 배치/cursor/owner/오류 계약 및 검증 |
| Public | legacy social availability, profile/public routes, Board/Memory model | mock과 실제를 구분, 부족한 최소 서버·읽기·쓰기만 |
| 이미지 | VisualAsset/catalog-cover revision, media adapters, Storage 경계 | 공개용 자산 준비와 철회·비용·수명주기 |
| 운영 | `tools/operations`, catalog-lab, status/health, CI/build-info/SW | 최소 통제·수집/검증/게시·복구·승격 |

폴더를 정리하기 위해 기능 전체를 옮기거나 공통 라이브러리를 새로 만들지 않는다. 현행 구조로 계약을 충족할 수 없다는 구체적인 증거가 있을 때만 대안을 선택한다.

## 7. 데이터·스키마 마이그레이션

필요한 변경은 가급적 추가형으로 만들고, 기존 client와 원본 자료를 보존한다. 데이터 모델을 바꿔야 하면 현재 W작업의 기록에 다음 6항목을 붙인다. 새 하위 계획서는 만들지 않는다.

`현재/목표 schema · 영향을 받는 데이터 · 호환 기간 · staging 적용/검증 · 실패 복구 · 운영 적용 승인`

- 운영 DB에 임의 SQL로 먼저 바꾸고 나중에 문서화하지 않는다.
- 공개 projection을 만들기 위해 모든 개인 기록을 일괄 업로드·공개하지 않는다.
- 공개 원본/사본/공유 catalog bytes의 소유권과 삭제 책임을 분리한다.
- versioned migration/릴리스 ID를 보존하고 API 서명은 해당 작업 시점의 공식 문서를 확인한다.
- 스테이징 테스트용 권한·자료도 허가된 환경만 사용한다. 기존 사용자 자료를 시험에 쓰지 않는다.
- 위험한 변경은 해당 W만 멈추고 승인을 기다린다. 독립적인 작업은 이어갈 수 있다.

## 8. 고정된 6개 마일스톤

단계 번호는 **M0~M5에서 더 늘리지 않는다.** 아래 작은 W작업의 순서 변경·교체·동일 단계 내 추가는 13절 규칙을 따른다. 단계 순서는 기본 경로이며 파일별 구현 순서를 강제하지 않는다.

### M0 — 현재 위치와 출시선을 한 번 고정한다

**사용자 결과:** 무엇을 재사용하고 무엇만 완성하면 되는지 하나의 진행판으로 알 수 있다.

- W01: 현재 HEAD/dirty diff/운영-후보 차이, 실행 명령, 노출 화면·API·기능 flag, Public 구현 수준을 확인한다.
- W02: 승인된 출시 범위를 기존 Decision Log에 반영하고 25개 이전 지적을 현재 코드와 연결한다. 기본안과 외부 결정을 분리한다.

**완료 증거:** 03의 기준점·재사용 목록·지적 매핑·READY 작업·D결정표. 앱 코드/실DB/운영 설정 변경 0건.

**여기서 하지 않음:** 전면 시장조사, 모든 과거 문서 다시 쓰기, 새 설계안 여러 개 만들기. 한 번 확인한 현재 상태는 변경된 부분만 다시 본다.

### M1 — 기록과 계정을 신뢰할 수 있게 만든다

**사용자 결과:** 기록이 유실·혼합되지 않고, 계정 동기화와 저장 안내가 사실과 일치한다.

- W03: clean CI/health/버전 확인과 안전한 SW 정책의 최소 기반을 복구한다.
- W04: 기존 핵심 작성의 dirty/취소/저장 중 입력/복귀 문제를 수정한다.
- W05: sync 배치·페이지·동시 수정·삭제·재시도·한계값을 일관된 계약으로 검증한다.
- W06: 실제 계정별 격리, Guest 승격, 지원 백업의 왕복 복원을 확인한다.

**완료 증거:** 관련 U/S 재현의 해소, 단위·E2E·격리 실DB 두계정 결과, 원본 보존. 구현·mock만으로 실환경 통과 금지.

**여기서 하지 않음:** 사용하지 않는 인증 provider 추가, 엔진 전면 교체, 백업 범위를 무조건 확대. 이미 완성된 부분은 테스트로 닫는다.

### M2 — 보드 하나를 타인이 보고, 다시 못 보게 할 수 있다

**사용자 결과:** A가 고른 기록·이미지가 B/비회원에게 실제로 보이고, 철회 후 서비스의 공개 경로가 계약대로 닫힌다.

- W07: 현재 구조에서 공개 필드/권한/이미지/철회 계약을 확정하고 최소 데이터 경계를 만든다.
- W08: 지원 이미지 종류의 공개용 준비·검증·전달·실패 정리를 구현한다.
- W09: 보드 공개 미리보기→명시적 게시→방문자 읽기를 한 경로로 완성한다.
- W10: 비공개 전환·카드 전체 철회·원본 삭제·버전 갱신·동시 작업을 검증한다.

**완료 증거:** 작성자 기기/세션 없이 새 방문자 기기에서 표지·디자인·허용 사용자 이미지가 표시된다. 미선택 기록은 API/직접 이미지 경로로도 유출되지 않는다. 철회는 여러 공개 위치와 캐시에 대해 검증한다.

**주의:** M2에서 실서비스 Public을 켜지 않는다. 관리자 강제 차단 상태를 public reader가 존중하는 최소 경계는 여기서 만들고, 운영 도구·신고 흐름은 M4에서 완성한다.

**여기서 하지 않음:** 일반 cloud photo backup, 공동편집, 여러 종류 공개 모드, 공개 검색·피드.

### M3 — 미니홈 전시와 팔로우 재방문을 완성한다

**사용자 결과:** 방문자가 작성자를 알고, 로그인 후 팔로우하고, 다음 방문에 그 사람을 다시 찾는다.

- W11: 선택된 대표 공개 기록/보드와 닉네임·소개를 전시하는 미니홈을 구현한다.
- W12: 서버 권위의 팔로우/해제/중복 방지/내 목록을 구현한다.
- W13: 보드→작성자→팔로우→로그인 복귀→내 목록→재방문을 연결하고 빈/삭제/비공개 상태를 처리한다.

**완료 증거:** A/B/비회원 세 역할의 실제 왕복. 팔로우는 private 열람 권한을 주지 않는다. 목록에서 공개 철회·정지된 대상을 안전하게 처리한다.

**여기서 하지 않음:** DM, 추천, 타임라인 피드, 실시간 알림, 방대한 프로필 편집기. 공개 Board/미니홈이 '구현됨'이라는 이유로 추천 피드가 선행 조건이 되지 않는다.

### M4 — 운영자가 제한·조치·갱신·복구할 수 있다

**사용자 결과:** 문제가 신고되면 조치할 수 있고, 비용·카탈로그·자료를 방치하지 않는다.

- W14: 신고 접수→검토→임시 비공개/복원/통지/이의제기, 사용자 차단·계정 제한을 완성한다.
- W15: 현재 실제 API·업로드·공개 조회 경계별 제한/중단/예산 경보와 안전한 오류를 구현·설정·검증한다.
- W16: 기존 도구로 카탈로그 후보→검증→승인 게시→이전 내용 복구를 연결한다. S08/S09는 같은 작업 안에서 끝내어 상호 의존 고리를 만들지 않는다.
- W17: 로컬/계정/공개 이미지/표지/canonical 복구, 정책·문의·삭제·감사·알림과 운영 책임자를 확인한다.

**완료 증거:** 운영자가 검증된 도구로 하나의 신고와 공개 철회를 처리, 두계정 한도/정지 우회 테스트, 알림 실제 수신, staging 데이터 게시/복구와 지원 자료 복원 리허설.

**허용 최소 구현:** 제한된 CLI/관리 명령과 기존 dashboard, 한 개의 실제 읽는 알림 채널, 수동 검토 후 게시. 실제로 실행되고 이력이 남아야 하며 '담당자가 나중에 알아서'는 완료가 아니다.

**여기서 하지 않음:** 범용 admin UI, 자동 추천/모더레이션 모델, 승인 없는 전체 스크래핑, 대형 데이터 파이프라인 교체.

### M5 — 모든 노출 흐름을 검증하고 정확한 후보를 출시한다

**사용자 결과:** 버튼이 약속대로 작동하고, 다른 역할·기기에서도 핵심 흐름이 이어지며, 운영 중 문제가 나도 중단·복구할 수 있다.

- W18: 현재 모든 공개/비공개/관리 UI route와 노출된 action을 목록화하고 계약별 정상·취소·실패·권한·복귀를 확인한다. 공통 요소는 동일 계약 테스트를 재사용한다.
- W19: 실제 두계정+비로그인, 다른 브라우저/기기, 새·기존 사용자 프로필로 end-to-end·격리·철회·복원을 검증한다. Android는 승인된 채널의 실기기 증거를 분리한다.
- W20: 동일 commit의 checks·build·release 설정·DB/catalog 버전·SW·롤백을 묶어 후보를 확정하고, 승인 후 Git 경로로 배포·운영 smoke·인수인계를 마친다.

**완료 증거:** 02의 필수 Q01~Q24, 03의 결정/차단 해소, 운영자 승인과 실제 release trace. 전체 tests가 실패하는데 일부 pass만 보고 승인하지 않는다.

**중간 상태:** `READY_FOR_DEPLOY`는 실제 출시가 아니다. 승인/환경을 기다리면 그 상태를 유지한다. 운영에 필수 Public 기능이 꺼져 있으면 `LIVE_VERIFIED`가 아니다.

## 9. 테스트와 검증 원칙

검증 수준은 기존 기준을 유지한다.

| 필드 | 뜻 |
|---|---|
| IMPLEMENTED | 코드/설정이 존재하며 현재 경로에 연결됨 |
| AUTO_TESTED | 명령·commit·환경이 기록된 자동 검증 성공 |
| REAL_ENV_VERIFIED | 실제 브라우저·두계정/격리 DB·대상 기기의 필요한 행동을 확인 |
| OWNER_APPROVED | 범위/정책/배포 등 승인이 필요한 항목의 명시적 승인 |

각 작업에 불필요한 실기기/사용자 승인을 반복 요구하지 않는다. `해당 없음`은 이유를 기록하되 로그인·Public·권한·배포·Android 등 필수 검증을 NA로 빼지 않는다. 환경 부족은 `BLOCKED_EXTERNAL`이며 PASS가 아니다.

기존 40개 QA는 유지하되 Q31의 '항상 Public 불가' 등 이전 출시 전제는 02의 새 기대에 맞춘다. 기존 테스트가 새 목표와 충돌하는 경우 의미를 교체하고, 실제 결함을 숨기기 위해 mock 한도·권한·snapshot을 완화하지 않는다.

기능 전체의 '평균 사용자 만족'을 자동 테스트 성공으로 주장하지 않는다. 사람 검토에서는 본인이 어떤 자료를 공개했고 무엇을 취소/삭제했는지 정확히 설명할 수 있는지 확인한다.

### 9.1 9월 25일 증거 재사용과 재검증 경계

제공된 unit320/build18, 당시 종합 검사, 실제 A/B OAuth·별도 origin 왕복, 실제 API/Storage33, 선택5schema72table 복원은 **각 실행 당시의 범위**로 재사용한다. 다른 origin은 다른 물리 기기 검증이 아니며, private bucket 차단은 공개 이미지의 성공 전달이 아니다. Supabase 플랫폼 전체·운영 PITR·실제 CDN을 복원/검증한 것으로 확대하지 않는다.

변경·실패·잘못된 대상·증거 손상·검증 대상 불일치가 없다면 기본 DB 연결/기초 격리/같은 복원을 무한 반복하지 않는다. W19의 실제 공개 한 바퀴는 그 기존 증거가 대신하지 못하므로 실행한다. 최종 후보의 필수 checks는 후보 SHA와 연결하고, 수정 후 영향 범위는 다시 검사한다.

최종 D02가 Web-only 출시를 승인하면 해당 후보의 Android 실행 항목은 `N/A + 승인/사유/범위 근거`로 표시할 수 있다. 승인 부재·증거 부재를 PASS 또는 N/A로 대체하지 않는다. 현재 `check-release-candidate.mjs`의 android 고정 필수는 W20에서 이 승인과 대조해 필요한 최소 범위만 조정한다.

## 10. 보안·개인정보·권리 영향

비공개와 공개는 서버에서 분리하며 public 요청은 공개 allowlist 필드만 반환한다. 소유자·관리자·차단 상태는 client flag가 아니라 서버 권한으로 검증한다. 서비스 비밀키/원본 토큰/개인 감상·검색어를 공개 client나 일반 로그에 넣지 않는다.

공식 표지 사용 승인은 유지한다. 그러나 그 승인으로 모든 개인 사진·스크린샷·팬아트의 공개 권리까지 자동 해결된다고 보지 않는다. 기존 권리 게이트를 지키고 미확인 종류만 공개를 차단한다. 승인된 종류의 개발까지 함께 중단할 필요는 없다.

Public bucket, 서명 URL, CDN/PWA 캐시는 서로 다른 접근·철회 성질을 가진다. 이미지가 페이지에서 사라졌다는 것만으로 철회를 통과시키지 않는다. 02 C04와 [W2][W3]을 확인한다.

## 11. 관찰 가능성·분석 이벤트

처음에는 operation/request ID, 오류 code, route, build SHA, 실제 작업 종류, 결과·지연·잔여 수 정도면 충분하다. private 내용과 위치/원본 경로는 넣지 않는다.

최소 관찰 대상: 저장·sync·공개 준비·게시·철회·신고 처리·한도 거부·health/수집 마지막 성공·업로드/egress 비용·복구 결과. 같은 사용자의 여러 기기와 재시도가 비용/건수를 중복 증가시키지 않는지 확인한다.

별도 analytics 제품을 도입하는 것이 목표가 아니다. 이미 쓰는 도구로 최소 신호가 수신되면 종료한다.

## 12. 롤백·복구

코드 롤백, DB 복원, catalog 내용 복구, 이미지 bytes 복구, 공개 철회는 서로 다른 행위다. 되돌리는 단위마다 원본과 승인된 복구 경로를 확인한다.

- public 문제가 발생하면 필요한 공개 읽기/쓰기를 서버에서 차단하되 가능한 범위의 private 읽기/내보내기를 보존한다.
- 복원으로 과거 공개 상태가 되살아나지 않게, 복원 직후 Public을 잠그고 최신 철회·차단·삭제 상태를 재적용·검증한 뒤 연다.
- signed URL/브라우저 다운로드 사본까지 즉시 회수된다고 약속하지 않는다.
- DB 백업과 Storage 파일 복구를 별도 검증한다. [W4]
- 롤백을 핑계로 사용자 IndexedDB/localStorage를 일괄 초기화하지 않는다.

## 13. 변수 대응과 범위 통제 — 이 계획의 핵심

### 13.1 계획 깊이 제한

허용: `M단계 → W작업 → 검증 체크리스트`.

금지: `M2 → 이미지 하위 단계 → 저장소 하위 프로젝트 → 공통 플랫폼 → 다시 새 마스터 계획`.

하나의 새 일이 독립적인 사용자 결과/검증을 요구하면, 현재 작업 밑에 넣지 말고 **같은 진행판의 형제 W작업**으로 기록한다. 관련 W와 의존성만 연결한다. 체크리스트는 작업 내용이며 독립 단계 번호를 만들지 않는다.

### 13.2 새로 발견한 일을 처리하는 네 갈래

| 분류 | 판별 | 행동 |
|---|---|---|
| 현재 작업에 흡수 | 같은 수용 조건을 만족시키는 국소 수정 | 기존 W의 범위/테스트에 추가 후 끝냄 |
| 출시 필수 선행 작업 | 특정 출시 계약 실패를 재현하고 별도 변경이 필요 | 같은 M의 새 W로 추가, 원작업은 의존 대기, 해결 후 원작업 복귀 |
| 외부 결정/환경 차단 | 권한·비용·권리·실기기·운영 승인이 필요 | 해당 W에 D번호/필요 증거를 적고 독립 READY로 이동 |
| 출시 후 보류 | 없어도 고정된 출시 결과·안전 계약 충족 | PARKING에 한 줄. 이번 진행 중 다시 열지 않음 |

'좋아 보임', '언젠가 필요함', '일반 서비스는 보통 있음'만으로 필수 작업을 만들지 않는다. 그렇다고 개인정보 유출·권한 우회·입력/기록 손상·철회 실패·허위 완료·핵심 행동 불능을 보류하지도 않는다.

### 13.3 필수 작업으로 편입할 때 쓰는 한 줄 계약

`발견 근거 → 실패하는 C/Q 또는 M완료 조건 → 사용자/운영 손실 → 가장 작은 수정 → 검증 → 해결 후 돌아갈 W`.

이 연결을 쓸 수 없으면 우선 조사 후보/보류로 둔다. 단, 유출·파괴 등 즉시 위험 신호는 재현을 위해 운영에서 위험을 발생시키지 말고 차단/검토부터 한다.

### 13.4 선택지와 기본 행동

| 변수 | 기본 행동 | 하지 않을 행동 |
|---|---|---|
| 기능이 이미 있음 | 실제 역할/환경에서 검증 후 DONE | 같은 기능을 신규 폴더로 다시 구현 |
| mock UI만 있음 | 필요한 최소 서버 경로를 해당 W에 연결 | mock flag만 켜고 운영 완료 선언 |
| 권한 검사 때문에 새 endpoint 필요 | 해당 공개/쓰기 경계 하나만 구현 | 먼저 범용 backend/gateway 플랫폼 제작 |
| 기존 구조로 작게 해결 가능 | 재사용+국소 adapter | 프레임워크/DB 교체 |
| 두 번의 다른 해결 시도에도 진전 없음 | 원인·실험을 정리, 접근 변경 또는 BLOCKED | 같은 명령 무한 반복, 세 번째 계획서 생성 |
| 환경/인증 접근 불가 | BLOCKED_EXTERNAL, 실환경 검사 0건으로 기록 | mock 통과를 실제 검증으로 치환 |
| S08/S09 같은 순환 의존 | 하나의 게시/복구 작업으로 묶거나 최소 선행 계약을 형제 작업으로 분리 | 서로를 기다리는 단계 두 개 유지 |
| 공개 철회에 캐시 문제가 발견 | C04를 만족하는 전달·철회 경로를 수정 | '나중에 최적화'로 철회 누출을 보류 |
| 정렬/애니메이션이 더 예뻐질 수 있음 | PARKING | 출시 후보 디자인 재설계 |
| UI 문구가 구현과 다름 | 실제 제공 상태에 맞춤 | 구현 안 된 미래 기능까지 만들어 문구를 맞춤 |

### 13.5 작업량·중단·재시작 규칙

- 동시에 수정 중인 본 작업은 **1개**. 환경 대기 중 독립 작업을 선택할 수 있지만 원작업 상태와 변경을 먼저 안전하게 남긴다.
- 한 번에 모든 열린 지적을 조사하지 않는다. 현재 W와 바로 필요한 선행 조건만 본다.
- 긴 작업을 쪼개야 하면 **사용자에게 보이는 완료 결과**로 나눈다. '조사/설계/설계검토/구현준비' 네 단계로 늘리지 않는다.
- 새 W가 생겨도 M0~M5, 사용자 목표, 기존 완료된 단계의 의미는 변하지 않는다.
- 단계 완료 후에는 코드 변화나 구체적인 반례가 있을 때만 그 부분을 다시 연다. '더 좋은 방법 발견'으로 전체 단계를 재시작하지 않는다.
- 같은 단계에서 새로운 필수 W가 **3개 이상** 누적되거나 같은 완료 조건을 두 번 바꾸려 하면, 새 단계 대신 범위 점검을 한 번 한다. 중복 원인을 합치고 기존 작업과 교체·흡수할 수 있는지 본다. 이 숫자는 관리용 경보 기준이지 안전 문제를 무시하는 상한이 아니다.
- 현재 작업의 합의된 수용 조건이 통과하면 DONE으로 닫는다. 추가 미관·범용화·예방 정리는 PARKING으로 보내며 '이것까지 하고 끝내자'로 완료선을 계속 옮기지 않는다.
- 의존성은 DAG여야 한다. 서로 대기하면 즉시 최소 계약과 구현 순서를 다시 정한다.
- BLOCKED가 남아도 다른 독립 READY는 진행한다. 모든 남은 작업이 같은 외부 요인에 막히면 작업을 멈추고 실행 가능한 요청만 보고한다.
- 보안·권한·공개 상태·저장/삭제 의미·인프라 비용을 바꾸는 대안은 관련 결정 없이 우회하지 않는다.
- task 수를 줄이려고 문제를 숨기지 않는다. 반대로 보류 아이디어를 분모에 계속 넣어 진행률을 흐리지 않는다.

### 13.6 소유자가 매번 답하지 않아도 되는 결정

기존 컴포넌트 재사용, 같은 계약 내 파일/함수 배치, 도구 UI 대신 검증된 운영 명령, test fixture, 보안 영향 없는 문구 정돈, 작업 순서 조정은 근거를 기록하고 진행한다.

서비스 목표 삭제/추가, platform 축소, 권리·개인정보 약속, 공개 철회 허용 지연, 예산/유료 도구, 운영 배포·공개 활성화·파괴적 변경은 D결정표로 보낸다. 운영 승인은 매 W마다 반복하지 않고 정확한 release candidate 단위로 받는다.

## 14. 필요한 사용자 결정 — 하나의 대기열로 관리

이미 승인된 Public 첫 출시 목표를 다시 질문하지 않는다. 아래 값만 필요 시 확인한다. 자세한 요청은 03 D표에 한 번 기록한다.

| D | 결정 | 가장 늦게 필요한 시점 | 대기 중 계속 가능한 일 |
|---|---|---|---|
| D01 | 격리 테스트 환경·테스트 계정 사용 권한·비밀값 제공 방식 | M1 실DB/OAuth, M2 서버 검증 전 | 로컬 구현·fixture·공통 UX |
| D02 | 기존 Web+Android의 첫 배포 채널/동시성·실기기 검증 담당 | M0 확인 시작, M5 승인 전 | 양 플랫폼 공통 기능·Web 검증 |
| D03 | 예산·지원 규모·호출/저장 한도·경보 수신자 | M4 정책 활성화 전 | 부하 측정·한도 설정/오류 구현 |
| D04 | 운영주체·정책/연령/권리 범위·신고/이의제기/삭제 담당과 연락처 | M4 인수인계 전 | 승인된 이미지 유형과 테스트 정책으로 격리 개발 |
| D05 | 공개 철회/캐시 지연 약속·보존/복구 목표·파일 사본 | M2 전달 구조 확정 및 M4 복구 전 | 가장 보수적인 재검증/no-store 경계 구현 |
| D06 | 정확한 SHA·DB/catalog release·flags의 운영 적용 승인 | M5 배포 전 | release candidate 검증과 rollback 준비 |

값이 없으면 임의 연락처·무제한 무료 용량·즉시 삭제/복구·법적 적합성을 만들어내지 않는다. D05 기본안은 신규 public 요청의 최신 상태 확인이며, 더 긴 지연을 허용하는 변경은 별도 승인한다.

## 15. 진행 기록

유일한 작업 상태 원장은 `03_RELEASE_WORKBOARD.md`다. 매번 새 상태 문서·새 ZIP을 생성하지 않는다. GitHub Issues 등 외부 작업판을 이미 쓰고 있으면 ID를 연결할 수 있지만 상태 원장의 우선순위를 한 곳으로 정한다.

매 작업 종료 보고는 다음 형태로 제한한다.

```text
현재: M2 / W09
완료: 이번에 실제로 끝낸 사용자 행동 1문장
근거: commit · 테스트/환경 · 증거 링크
진행: 완료 단계 2/6 · 기본 W 완료 n/20 · 추가 필수 x(미해결 y)
차단: W/D번호 · 필요한 입력 또는 증거
보류: PARKING에 넣은 개선
현재 단계 잔여: 고정된 완료 조건 중 남은 것
다음: READY 작업 1개
```

이 보고는 실제 작업 결과만 적는다. 예시의 완료 숫자를 템플릿 초기 상태로 복사하지 않는다.

## 16. 발견 사항과 계획 변경

### D01 실제 테스트 프로젝트 연결 (2026-09-24)

2026-09-25 후속: 기존 로컬 pg_dump/pg_restore 리허설에 stale snapshot과 최신 삭제 fence journal 재적용 시나리오를 추가한다. 별도 복구 DB에서만 합성 공개본을 준비하고, 백업→삭제 철회→오래된 사본 복원→closed gate→최신 fence 병합→reader 차단을 검증한다. hosted 프로젝트 reset/공개 활성화 및 운영 자료 복제는 하지 않는다. 서버 전체 백업 접근과 Storage bytes 사본은 별도 외부 요건이며 로컬 리허설로 대체 완료하지 않는다.

2026-09-25: 사용자 지시로 Android 검증은 이번 실행에서 제외한다. 기존 실 Google 세션을 이용하는 loopback 전용/무시되는 `.cache` 진단 페이지에서 A/B/anon REST 행 조회·직접 쓰기 차단·Storage 접근을 검사한다. 토큰은 클라이언트 메모리 안에서만 사용하고 화면/로그/파일로 내보내지 않는다. 테스트 ref를 고정하고 개인 자료 대신 기존 합성 카드와 작은 합성 파일만 사용한다. 실제 존재하는 비공개 Storage fixture의 관리자 확인/바이트 확인과 client 접근 거부를 구분한다. 공개 flags나 RLS를 완화하지 않는다. 결과는 단일 진행판에 기록하고 임시 진단 페이지는 검증 후 제거한다.

복원 실검증에서 새 origin의 동기화 완료 후 Archive 로드 오류를 재현했다. 원본을 보존한 채 IndexedDB 복원 관계와 조회 경계를 진단하고, 원인에 맞는 최소 수정 및 회귀 검사를 추가한다. 실제 hosted 카드 재열람으로 확인하며 운영/DB schema 변경은 하지 않는다.

A/B 검증의 두 번째 Google 계정 사용을 승인받았다. 웹 로그인에서 이전 Google 세션이 자동 재선택되어 계정 전환이 어려우므로 provider의 select_account prompt를 지정한다. 기존 PKCE/redirect/권한 범위는 유지하며 실제 계정 선택 화면과 복귀를 검증한다.

사용자가 MOEMOA 운영 project를 새 조직으로 이전하고 같은 조직의 별도 테스트 project 생성을 승인했다. 운영은 `okchpyagfucpzpyrfgol`, 테스트는 `nmgkhknponvzcwliajyk`, 조직은 `jdomtzpoqpyfinazdnpi`다. 실제 이전/생성 결과는 단일 진행판에 기록한다.

다음 순서: (1) 인증된 관리 연결 확보 및 테스트 ref 대조, (2) 기존 migration 목록과 fresh hosted 적용 전제 검토, (3) 테스트에만 schema 적용 및 migration 이력 기록, (4) anon/owner 권한·기본 closed flags·Storage 경계 확인, (5) 테스트 전용 로컬 환경 구성 및 A/B 계정/OAuth 검사. 현재 운영용 link/env를 테스트로 덮어쓰지 않고 명시적인 대상 분리를 사용한다. 테스트 생성 시 자동 테이블 공개를 껐으므로 migration의 명시 GRANT가 실제 PostgREST 동작에 충분한지 확인한다.

대상은 비어 있는 테스트 환경이며 운영 데이터/사용자/이미지는 복제하지 않는다. 운영 schema·배포·Public 활성화는 이번 승인에 포함하지 않는다. 작업 실패 시 테스트 실행을 중단하고 partial migration 이력을 확인하며, 무조건 reset/drop하지 않는다. 새 dependency 없이 기존 CLI 또는 연결된 Supabase 도구를 우선 사용하고 비밀번호/토큰을 대화나 Git에 기록하지 않는다. 실제 schema/Auth/Storage 검증 전 D01을 완료로 바꾸지 않는다.

변경은 03의 '선택/변경 기록'에 `기존 수단 → 새 수단 / 근거 / 변하지 않는 수용 조건 / 영향 W / 승인 필요 여부`를 쓴다.

작은 상세가 필요하면 동일 W의 작업 기록에 변경 파일·migration·테스트·rollback을 적는다. 기존 계획에 없는 새 기능을 '기술 선행'으로 위장하지 않는다.

기존 감사의 U/S는 02 추적표로 보존한다. 신규 Public 작업은 C03~C08을 기준으로 검증한다. 예전 지적을 25개 새 작업으로 복제해 같은 수정을 두 번 관리하지 않는다.

### W10 실행 상세 (2026-09-24)

C05를 기존 publication 경계에 연결한다. 공개본의 원본 버전 정보를 서버 내부에 보존해 소유자에게 갱신 필요 상태를 제공하고, 갱신은 새 미리보기와 동의를 요구한다. 모든 위치의 카드 철회를 기존 RPC에 연결한다. 계정 원본 삭제는 원격 철회가 확인된 뒤 로컬 삭제를 진행하며, 실패 시 원본을 보존하고 재시도를 안내한다. Guest 로컬 삭제는 유지한다. 이전 요청/여러 보드/삭제 복원/관리 제한은 PostgreSQL 계약과 브라우저 회귀로 검증한다. 신규 public 요청 no-store와 기존 이미지 전달의 전후 권한 검사를 재사용한다.

파일 지도: publication controller/panel/copy, private delete command/platform adapter/detail, additive publication status migration, tools/publication-boundary 및 unit/Chromium tests. 검증 환경은 새 PC의 격리 PostgreSQL과 합성 계정, 실제 로컬 Chromium이다. 실제 Supabase/Auth/Storage/Android 및 복원 운영 절차는 D01/D05에 남긴다. 운영 DB/배포/flags/의존성 변경은 범위 밖이다. rollback은 클라이언트 변경을 되돌리되 철회 fence와 이력은 보존하고 Public을 열지 않는다. 결과·잔여 위험은 단일 진행판에 기록한다.

W10 보완 결과: 로컬 remoteVersion=0은 서버 미존재 증거가 아니므로 모든 계정 카드 삭제에 서버 retire RPC를 요구한다. source FK 없는 owner별 삭제 fence가 늦은 최초 sync/복원에도 공개 read/prepare를 차단한다. Guest 삭제는 오프라인 유지, 계정 삭제는 서버 확인 실패 시 원본 보존과 재시도 안내. 공개본 source status는 owner-only이며 익명 DTO에 원본 버전·ID를 추가하지 않는다. 신규 RPC의 호출/이력 용량 제한은 W15에 포함하고, 서버 migration 선적용 없이 클라이언트를 출시하지 않는다. 공개 읽기·쓰기를 잠근 채 fence를 보존하는 rollback을 사용한다.

### W11 실행 상세 (2026-09-24)

이미 공개한 보드 전체 또는 그 안의 대표 기억을 명시 선택·정렬하여 닉네임/소개와 전시한다. 기존 legacy showcase의 private 취향 위젯은 재사용하지 않는다. 공개 publication의 allowlist DTO와 현재 철회 판정을 재사용하며, 보드 철회 시 해당 보드에서 가져온 미니홈 전시도 제거됨을 안내한다. 별도 공개 원본을 자동 생성하지 않는다. 서버 preview/hash/revision → 재동의 publish → 안정 UUID 방문 주소를 제공한다. 미니홈 비공개는 보드 공개에 영향을 주지 않는다. 서버 기본 off와 기존 publication kill switch/계정 제한을 따른다.

파일 지도: additive mini-home RPC/내부 table migration, memory domain/gateway/controller, owner editor와 anonymous visitor route, 기존 Board 화면 진입점, SQL/unit/Chromium 및 route manifest. 원본·이미지 업로드·팔로우·운영 활성화는 제외한다. 검증은 합성 역할 PostgreSQL 및 실제 로컬 브라우저로 선택/미리보기/게시/철회/계정 격리/오류/원본 삭제 전파를 확인한다. 실제 Auth/Storage/CDN/Android는 D01/W19. rollback은 mini-home flag off, 클라이언트 복원, 서버 공개 상태·삭제 fence 유지. 새 production 의존성 없음. 결과는 단일 진행판에 기록한다.

### W12 실행 상세 (2026-09-24)

C07에 따라 공개 미니홈의 팔로우/해제, 본인 관계 목록과 재방문, 차단/해제를 연결한다. legacy user_follows는 재개하지 않고 private 전용 관계 테이블과 인증 RPC를 추가한다. 사용자 ID는 auth.uid에서만 취하며 외부에는 미니홈 UUID만 반환한다. 동일 쌍의 변경은 트랜잭션 잠금으로 직렬화하고 차단 시 양방향 팔로우를 제거한다. 비공개/제한 대상은 이유 없는 사용 불가 항목으로 표시하며 해제는 가능하다. 비회원은 기존 안전한 OAuth 복귀 경로로 로그인하고 자동 팔로우하지 않는다. 차단은 익명 공개 열람을 막는다고 안내하지 않는다.

파일 지도: 관계 migration, publication gateway/runtime, 미니홈 관계 UI 및 내 목록, SQL/브라우저 검사. 기본 off flag를 추가하고 운영 DB·공개 활성화·뉴스피드·DM은 제외한다. SQL 역할 검사와 로컬 브라우저, unit/build로 검증하며 실제 OAuth/Supabase/Android는 D01/W19에 남긴다. quota는 W15/D03, 신고는 W14에 연결할 출시 게이트다. 롤백은 관계 flag off 및 UI 복원이며 관계/차단 이력과 private 원본은 삭제하지 않는다. 새 의존성 없음. 실행 결과는 단일 진행판에 기록한다.

### W13 실행 상세 (2026-09-24)

공개 보드/미니홈에 안정 UUID 기반 주소 복사를 제공하고, 복사 실패 시 선택 가능한 주소로 복구한다. 공유 주소는 현재 query/hash를 복제하지 않으며 Android localhost 대신 기존 운영 웹 origin을 사용한다. 로그인 취소/실패 시 검증된 원래 내부 주소로 돌아가고 재시도할 수 있게 한다. callback 토큰/오류는 주소창에서 제거하며 외부 주소·callback 재진입·토큰이 포함된 next를 거부한다. Android OAuth 완료 경로는 packaged index.html로 변환한다. 자동 팔로우/게시 없음.

파일 지도: public link domain/공용 복사 UI, owner/visitor 연결, web/native OAuth 및 callback UI, unit/Chromium 검사. DB·의존성·운영 설정 변경 없음. 검증: 복사 성공/권한 거부·취소/실패 복귀·공격 next·native cold/warm 경로 단위 검사, 기존 브라우저 회귀와 빌드. 실제 OAuth 제공자/Android 기기는 D01/W19에 유지한다. 롤백은 W13 client 변경 복원이며 원본/관계/공개 상태를 변경하지 않는다. 결과는 단일 진행판에 기록한다.

### W14 실행 상세 (2026-09-24)

C08의 공개 대상 신고→접수 확인→인증된 운영자 검토/임시 가림/복원→소유자 인앱 통지→이의제기→재검토/감사 흐름을 구현한다. 신고는 public board/home UUID와 고정 분류·선택 설명만 받으며 차단 관계와 무관하게 접근한다. 서버 전용 moderator allowlist, private 사건/통지/감사 테이블 및 좁은 RPC를 사용한다. 일반 client metadata나 공개 테이블 쓰기로 운영자 권한을 얻을 수 없다. 기존 hidden/read/image 경계를 재사용하며 복원은 공개 동의/철회 상태를 변경하지 않는다. 사건 revision으로 관리자 경합을 거절한다.

파일 지도: additive moderation migration, gateway/runtime, 공개 신고 양식과 미니홈의 내 접수/조치 알림·이의제기, 합성 PostgreSQL 역할/동시성 검사·실제 Chromium. 운영자는 로컬에서 검증한 queue/review RPC와 저장소 운영 절차를 사용하며 별도 광범위 관리자 대시보드는 만들지 않는다. 신고 flag 기본 off, 일일 신고 한도 기본 0(격리 테스트만 설정), 동일 사용자/대상/분류 중복 접수는 기존 사건 반환. 실제 한도·담당자·지원 채널·보존 기간은 D03~D05, 운영 DB/배포/Public 활성화는 제외한다. 계정 전체 제재는 기존 write_blocked/hidden 범위로 유지하고 세분화는 W15에서 검증한다. 롤백은 신고 flag off 및 client 복원; 안전 가림·신고/감사/통지 기록을 파괴하지 않는다. 새 의존성 없음.

W14 구현 중 발견/조정: 계정 제한은 기존 write_blocked flag를 덮어쓰면 다른 사건의 제한까지 해제할 위험이 있어 사건별 sanction을 추가했다. 기존 writer 경계와 이미지 완료 trigger에서 이를 검사하며, 한 사건의 해제는 다른 사건/기존 flag를 유지한다. 진행 중 동일 신고는 합치되 종결 후 새 사건을 받을 수 있게 했고 operation 재시도는 기존 접수로 고정했다. 운영 절차는 `docs/moemoa/operations/2026-09-24-public-moderation.md`에 기록한다.

### W15 실행 상세 (2026-09-24)

C09에 따라 서버 저장 변경량/용량·공개 이미지 비용을 제어한다. private 정책/사용량/만료 override, 계정별 잠금과 실제 테이블 trigger로 동기화/private 자료·게시 준비/게시·팔로우 생성의 우회를 막는다. 기존 operation replay는 새 변경을 소비하지 않는다. 삭제/철회/차단/지원/이의제기는 성장 quota에서 제외한다. 이미지 POST 변환 시도와 서비스 전용 GET 전달 비용은 별도 RPC로 계수하며 Storage 직통은 기존 private 권한을 유지한다. 모든 새 숫자는 미승인 상태의 비활성 정책으로 추가하고 격리 검사만 작은 수치로 설정한다.

파일 지도: additive quota migration·이미지 HTTP 경계/오류 매핑·SQL 실제 역할/병렬 검사·HTTP/unit/browser 회귀·운영 계측 절차. 성공한 저장 변경량 quota와 실패 포함 ingress rate 제한을 혼동하지 않는다. 공개 페이지/catalog의 bounded 응답·서버 kill switch를 확인하며 호스팅 WAF/요금 경보·실제 트래픽 예산은 D03 외부 게이트다. 삭제 fence는 나중에 도착할 sync로 재공개되는 것을 막으므로 임의 삭제/하드 cap으로 정상 삭제를 막지 않는다; 크기 계측과 D05 보존/압축 설계가 필요하다. 운영 DB/배포/설정 변경, 새 의존성 없음. 롤백은 새 정책 비활성화이며 사용량/삭제 fence/공개 동의를 파괴하지 않는다.

W15 발견/조정: `docs/deploy/supabase-social.sql`과 `supabase-showcase.sql`의 과거 직접 권한을 확인했다. 테이블이 있을 때만 legacy follows/showcase의 client 권한을 회수하고, user_profiles는 기존 own-select 경계로 제한한다. 행 삭제/자동 변환은 하지 않는다. 격리 harness에 과거 권한 fixture를 넣어 차단과 데이터 보존을 검증한다. 운영에 해당 객체가 존재하는지는 D01 원격 감사가 필요하다. 사건 제한과 이미 진행 중인 공개 쓰기는 계정별 공유/배타 잠금과 저장 시 재검사로 직렬화한다.

W15 결과/인계: unit318·Chromium30·SQL218·build18·dist route18 통과. 초기 개발 서버/첫 화면 timeout과 Android packaged assets 부재를 진행판에 별도 기록했다. `docs/moemoa/operations/2026-09-24-resource-controls.md`에 단위·설정/회복·안전 삭제·남은 ingress/보존 경계를 남긴다. D01/D03/D05 미해소로 W15는 BLOCKED_EXTERNAL이며 다음 독립 로컬 작업은 W16이다. 배포·운영 설정 변경 없음.

### W16~W20 연속 실행 상세 (2026-09-24 사용자 승인)

사용자는 W 단계 종료까지 중단 없이 진행하도록 지시했다. 기존 dirty W09~W15를 보존하며 단계별 확인 질문 없이 가능한 구현/검증/인계를 수행한다. D01~D06의 실제 계정·기기·정책·정확한 후보 운영 승인까지 임의로 충족시키는 지시는 아니다. 외부 의존 항목을 기록하면서 독립 로컬 작업을 계속한다.

W16: 기존 preview exporter/uploader와 catalog activation RPC를 점검했다. activation은 STAGING만 허용하고 전역 직렬화/expected-active 비교가 없어 재시도·복구·동시 전환 계약이 부족하다. additive migration으로 검증된 상태의 재시도/RETIRED 복구와 전환 잠금·선행 release 비교를 제공하고, 격리 SQL에서 불완전 후보·직접 권한·A→B→A·동시성·cover revision 보존을 검사한다. 기존 공개 함수 signature 호환을 보존하며 원격 upload/수집은 실행하지 않는다. uploader의 immutable release 재개가 ACTIVE를 STAGING으로 되돌리지 않도록 검토한다.

W17: 저장소 복구/지원 도구와 사용자 안내를 점검하고 로컬 백업 복원/공개 철회 보존 검사를 수행한다. 정책 주체·연락처·보존 일수는 꾸며 넣지 않는다. 복구 절차/실제 확인 목록을 운영 인계에 묶는다.

W18: 실제 route와 주요 action을 목록화하고 unit/catalog/Chromium 전체 대상 검사 및 빌드를 수행한다. 실패는 재현·분석하고 의미를 약화하지 않는 수정만 한다. 구형 공개 프로필 등 이전 기대는 현행 권한 모델과 구분한다.

W19: 로컬 Android SDK/JDK/기기 가용성을 확인하고 가능한 패키징/검사까지 수행한다. 실제 계정·격리 프로젝트·기기가 없으면 해당 Q를 BLOCKED_EXTERNAL로 기록한다. W20: 검증 결과·source hashes·migration/catalog/flags·잔여 gate·rollback을 후보 인계로 묶되, 미검증 후보를 RC_VERIFIED/배포 완료로 표시하지 않는다. 모든 소스 변경은 기존 기능 회귀 검사, 문서 변경은 diff 확인을 수행한다. 신규 운영 의존성·운영 배포·자료 삭제는 제외하고 rollback은 코드 복원/flags off와 안전 이력 보존을 따른다.

연속 실행 발견: 카탈로그 기존 객체 재시도는 Content-Length만 비교해 같은 크기의 손상을 놓쳤다. bounded GET의 SHA256/길이 확인으로 바꾸고 손상/초과 검사를 추가했다. 기존 릴리스 업로드는 ignore-duplicates로 상태를 보존하고 predecessor를 checked RPC로 전달한다. 현재 DB snapshot의 pg_dump→별도 DB 복원과 안전 이력 비교를 harness에 추가했으며 stale backup의 최신 철회 journal은 외부 gate로 남긴다. Android SDK36/build-tools36을 기존 JDK21 환경에 준비하고 Capacitor packaging·native 검사·APK를 실행한다(앱 의존성 변경 없음). W20 `scripts/check-release-candidate.mjs`는 commit/clean tree·필수 검사 artifact hash·D01~D06·catalog/config 증거의 누락/변조를 거부하는 로컬 gate다. 호스팅 보호 규칙이나 운영 승인 자체를 대신하지 않는다.

W18 발견: 이전 UI 기대/주소/이미지 선택 중 이탈 계약이 현재 구현과 달랐고 Playwright가 Node 테스트까지 수집했다. 실제 UI 계약에 맞춰 회귀 검사를 수정하고 Node suite를 수집 대상에서 제외한다. Library의 다른 state를 변경하는 updater/대표 선택 null 처리, 이벤트용 ref의 render 중 변경은 직접 수정한다. 세부 분류와 action 지도는 `reports/2026-09-24-release-surface-audit.md`에 남긴다.

연속 실행 결과: unit320/catalog256(skip2)/Chromium174(skip3)/SQL235/build18/native31/실제 packaged route18 PASS, 최신 local debug APK 생성. candidate guard는 미커밋·미확인 gate를 ready=false로 거부한다. 원격은 기존0330a54 quality/최근 health 성공과 Git 배포 SHA를 읽기 전용 확인했으나 운영 workingTreeDirty=true 원인은 확인하지 못했다. W16~W20은 해당 외부 조건을 남긴 BLOCKED_EXTERNAL로 인계한다. 필요한 실제 계정/기기·정책/예산/사본·후보 승인 없이는 정식 완료할 수 없으며 운영 DB·배포·Public은 변경하지 않았다. 상세 evidence/실패와 재검증 순서는 단일 진행판을 따른다.

2026-09-25 서버 자격증명 입력 후 검증: gitignored 테스트 env에서만 값을 읽고 target ref를 고정한다. psql로 실제 TLS 연결 및 버전을 확인하고 service key로 기존 합성 private Storage fixture를 내려받아 로컬 사본·재다운로드 SHA256·이미지 decode를 대조한다. 비밀값/개인 데이터는 결과에 기록하지 않는다. 이 읽기 전용 단계는 hosted DB 전체 복원이나 CDN 검증을 대신하지 않는다. 원격 PostgreSQL17에 맞는 dump 도구 준비와 격리 복원은 후속이며, 운영/Public/Android 변경은 제외한다.

## 17. 최종 완료·출시·종료 보고

2026-09-25 W19 후속: 기존 합성 카드/보드를 재사용하고 승인된 test 공개/이미지/home 설정만 임시 활성화한다. 제품 화면에서 재게시 후 철회 확인창의 취소→공개 유지, 확인→보드/미니홈/직접 이미지 거부를 검사한다. 확인창 제어 불가 시 UI PASS로 대체하지 않고 해당 차단을 기록한다. 종료 시 test flags/권리·사본 원복; moderator/follow/report 재검사나 운영 변경은 필요 없다.

2026-09-25 W08 실제 전제 결함: 합성 사용자 이미지의 정상 metadata 동기화가 23514/source_metadata_check로 실패했다. JS DTO의 designSpec:null이 SQL JSONB null로 저장되어 SQL NULL 제약과 충돌한다. 기존 hydration trigger에 JSON null→SQL NULL 정규화만 추가하여 신규/수정/Guest 승격의 payload hash·operation을 보존한다. SYSTEM_DESIGN의 필수 객체 제약과 다른 type의 객체 거부는 유지한다. 로컬 SQL 재현 후 동일 실패 operation의 hosted 재시도로 확인한다. 기존 W08에 흡수하며 새 계획/인프라 재검증은 만들지 않는다.

2026-09-25 D01 사용자 명시 승인 확보: moemoa-test(nmgkhknponvzcwliajyk)에 한해 공개 기능 임시 활성화, 합성 이미지의 자산/버전별 권리 승인, A의 테스트 운영자 역할을 허용했다. 이미지10개/40MiB·신고일일10 한도, 종료 후 flags/한도/정책/역할 원복 조건이다. 실행 전 baseline은 모든 public flags=false, asset_limit/asset_bytes_limit/report_daily_limit=0, policy_revision=UNAPPROVED, moderators/rights=0이다. 테스트용 TEST_ONLY_20260925 정책으로 정상 앱 로그인·게시·익명 bytes·미니홈·B 팔로우/신고/차단·운영자 조치·철회를 검증한다. 운영 정책 승인이나 D06 승인이 아니다. 실제 계정 토큰은 브라우저 밖으로 추출하지 않는다.

2026-09-25 W13 R0925-U01: 현행 board reader/DTO/UI에 공개 작성자 연결이 없음을 확인했다. 기존 board/home reader를 그대로 호출해 현재 공개 가능성을 확인한 뒤 공개 home UUID·nickname 두 필드만 반환하는 별도 read RPC를 추가한다. 기존 미니홈 builder가 board reader를 호출하므로 board DTO에 home 전체를 중첩하지 않아 순환 호출을 피한다. 방문자 UI는 이 검증된 링크만 표시하고 작성자 panel에는 공개 미니홈 연결 의미를 안내한다. 공개 취소/hidden/없는 home은 null, private UID/이메일 노출 없음. 기존 W13/Q04/Q16 안에서 SQL·DTO/UI 회귀를 수행한다.

2026-09-25 W08 R0925-B01 실행 상세: HEAD bbff3d4/clean 및 최신 증거 대조 후 제공 문서 patch의18개 hunk를 문맥 일치로 반영했다(줄바꿈만 정규화). 기존 operation 실패/완료 불명 구분을 위해 owner 전용 상태 조회와 service 전용 실패 객체 정리 claim을 additive migration으로 추가한다. PREPARING/READY/참조 중 객체는 재시도 정리 대상에서 제외하고, 실제 Storage 제거+DELETED/예약량0 확인 뒤에만 client가 새 operation을 발급한다. 완료 응답 유실은 같은 operation READY를 재사용한다. 사용자별 기존 권리/정책/버전/한도는 그대로 유지한다. 로컬 HTTP/controller/SQL 회귀로 재현→수정 검증하며 원격 migration은 테스트 승인 범위 확인 뒤에만 적용한다. rollback은 새 호출 코드 복원이며 기존 원본/READY/삭제 이력은 삭제하지 않는다. D01 활성 설정/테스트 운영자/합성 권리 승인은 후속 사용자 응답으로 확보했고, 실행 후 원복했다. 이번 결과는 03의 최신 로그와 evidence JSON 참조.

2026-09-25 Pro 중간 검토 인계: 사용자 요청으로 누적 개발본과 최신 검증 증거를 검토 브랜치 `review/pro-interim-2026-09-25`에 commit/push한다. master 운영 배포와 DB/Public 활성화는 수행하지 않는다. 기존 진행 원장을 유지하고 중간 검토 안내 하나에 읽기 순서·소스 지도·검증 수준·출시 잔여·검토 질문을 모은다. 추적 대상 비밀값/덤프/개인 파일 검사와 현재 unit/build를 확인한다. 과거 검사 결과는 당시 소스 증거로 표시한다.

2026-09-25 hosted 복구 실행: 사용자 계속 진행 승인에 따라 공식 PostgreSQL apt의17 바이너리를 격리 도구 폴더에 준비한다. 테스트 Session pooler만 허용하는 guard로 전체 logical dump를 생성하고 원격에 write하지 않는다. 로컬 Unix socket 전용17 DB에 복원하며 Supabase 전용 extension/플랫폼 서비스 의존성은 별도로 분류한다. public/private 앱 테이블·삭제 fence·정책·권한·Auth/Storage metadata의 비교 범위를 명시하고, 제외한 플랫폼 객체를 전체 서비스 복구 성공으로 세지 않는다. 백업에 포함될 수 있는 테스트 계정 정보는 Gitignored 사본에만 저장하며 stdout에는 집계/성공 여부만 남긴다. Storage bytes는 기존 별도 사본을 사용한다. 실패 시 local DB를 중지하고 dump를 보존하며 hosted DB는 덮어쓰지 않는다.

### 17.1 READY_FOR_DEPLOY

- M0~M4가 계약과 증거 기준으로 종료됐고, M5의 후보 검증이 통과.
- 필수 Q01~Q24가 지원 platform·실역할 기준으로 통과. NA에는 승인된 근거가 있음.
- 데이터 유실·권한 누출·공개 철회·허위 성공·핵심 단절에 해당하는 열린 필수 W가 0개.
- 실제 설정·연락처·한도·이미지 보존·배포 보호 등 D01~D05가 필요한 범위에서 해소.
- 코드 SHA, migration, catalog release, 환경별 flag, 테스트·운영 절차·rollback을 하나의 후보로 묶음.

### 17.2 LIVE_VERIFIED

D06 승인 후 검증된 Git 배포로 반영하고, 운영 도메인에서 정확한 후보 버전·로그인·공개 보드·공개 미니홈·팔로우·철회·관리 통제를 승인된 테스트 자료로 확인한다. Public을 꺼 둔 채 정식 목표를 완료했다고 하지 않는다.

### 17.3 종료 뒤

담당자가 다음 운영 점검(예: 배포 후 2/24/72시간)을 수행하도록 인계한다. 이는 실행할 운영 일정 제안이며 이 문서가 관측을 자동 수행했다는 뜻이 아니다. 초기 관찰에서 새로 발생한 장애는 기존 평면 작업판의 핫픽스로 처리한다. P2 개선 때문에 M0부터 다시 시작하지 않는다.

최종 보고: 달성한 사용자 흐름, 실제 지원 범위, 정확한 버전, 자동/실환경/사용자 승인 증거, 미해결 없는 필수 계약, 허용한 경미한 한계, 운영 책임자와 복구 수단, 보류 목록. **미출시는 미출시, 차단은 차단으로 끝낼 수 있지만 완료로 바꿔 쓰지 않는다.**


W07 실행 상세(2026-09-23): 단일 진행판의 W07 실행 범위를 따른다. 공개 snapshot/서버 권한/철회 기반의 additive SQL과 합성 PostgreSQL 역할 검증을 먼저 수행하고, 이미지 전달 W08·방문자 UI W09·통합 철회 W10은 별도 완료 조건으로 유지한다. 실제 Supabase가 없는 D01 게이트는 보존한다.

W08 실행 상세(2026-09-23): 단일 진행판 W08 실행 범위 참조. 기존 Vercel의 이미지 전달 endpoint+Supabase 권한/Storage로 범위를 제한하며 sharp0.34.5를 명시 의존성으로 고정한다. D01/D03/D05/D06과 W09 UI/W19 실기기 게이트 유지.

W09 실행 상세(2026-09-24): 기존 Board에 명시 선택·공개 제목/설명·서버 DTO 미리보기·게시·주소·보드 철회를 연결하고 `/public/board/` 방문자 화면은 익명 reader만 사용한다. 기본 off인 `PUBLIC_MEMORY_PUBLICATION_V1` 아래 구현하며 기존 갤러리/원본/DB 스키마는 유지한다. 세션·요청 세대 검사와 AbortController, 동일 게시 operation 재시도, 검토 변경 시 재동의, 실제 이미지 로드 실패 시 게시 차단을 검증한다. 사용자 이미지는 원본 파일을 명시 재선택하고 서버 checksum/권리 판정을 사용한다. 업로드 동의 revision은 서버와 일치하는 배포 설정 `PUBLIC_MEMORY_PUBLICATION_POLICY_REVISION`으로 제공하며 미설정 시 업로드를 열지 않는다. 이는 정책 승인 자체를 대체하지 않는다. 파일 지도: memory/application publication controller, runtime platformPublication, components 공개 선택/공용 DTO renderer/방문자, public route, unit 및 Chromium 계약 검사. 의존성·migration·운영 설정 변경 없음. 검증: unit/build, 합성 RPC와 실제 로컬 브라우저의 선택→미리보기→게시→새 context 방문→철회 및 취소/실패/계정전환/320px. 실제 Supabase/Storage/Vercel/Android는 D01 등 외부 게이트로 유지한다. rollback은 W09 신규 파일과 Board 진입점만 복원하며 서버 이력·private 원본은 건드리지 않는다. 결과와 증거는 단일 진행판에 기록한다.

## 기존 W에 적용하는 2026-09-25 보완 — 새 단계 아님

- **W08 / C04 / Q10:** 원본 불일치로 실패한 공개 이미지 준비가 같은 controller에서 `ASSET_OPERATION_UNAVAILABLE`로 반복될 수 있다. 기존 검토의 모형 재현을 현재 코드에서 확인한 뒤, 확정 실패는 정리된 새 시도로 회복하고 완료 여부가 불확실한 요청은 같은 작업 상태를 확인한다. 매 클릭마다 새 operation ID를 발급하거나 READY 객체를 삭제하는 우회 금지. W09/Q09 실제 전달로 복귀한다.
- **W13 / C06,C07,C11 / Q04,Q15,Q16:** 공유 보드에서 공개된 작성자 미니홈으로 연결하고 팔로우·내 목록 재방문을 검증한다. 공개된 home 식별자만 사용하며 Auth UID·이메일·private profile은 DTO에 추가하지 않는다. 없거나 철회/가림된 홈은 안전하게 생략한다. 새로운 검색·피드는 제외한다.
- **D01/W07~W15/W19:** 기존 테스트 환경으로 선택 게시→익명 실제 bytes 열람→미니홈→팔로우/재방문→신고/차단/조치→철회를 검증한다. 테스트 Public/정책/운영자 권한 승인과 실제 가용성을 별도로 확인한다. 운영 Public은 건드리지 않는다.
- **D04/W08/W14:** `memory_public_image_rights`의 자산/버전별 신뢰된 승인과 policy revision의 실제 처리 경로를 인계한다. 현재 SQL 요구를 사용자 checkbox로 우회하지 않는다. 허가된 표지 승인을 다시 묻거나 전체 이미지를 일괄 허용하지 않는다.
- **D03~D05/W14~W17:** 비용·한도·경보, 정책·담당, 사본·보존·최신 철회 journal의 실제 미확정 항목만 모은다. 기존 도구를 재사용하고 범용 관리자·DR 프로젝트로 확대하지 않는다.
- **W03/W20:** 과거 `sourceCommit:null` 후보를 PASS로 덮어쓰지 않는다. 정확한 후보·실제 CI·DB migration 매핑·catalog hash·client/server flags·정책·이미지 endpoint·복구 근거를 묶어 D06 승인을 받는다. 검토 브랜치 push는 quality 통과나 운영 배포가 아니다.

세부 진행과 차단은 03에서만 관리한다. 문서 반영 자체는 별도 W21이 아니며 새 발견 세 건도 기존 W에 흡수한다. 현재 수용 조건이 통과하면 다음 W로 돌아가고, 이미 완료된 M0나 테스트 인프라 구축으로 되돌아가지 않는다.

2026-09-25 W19/Q05 만료·복귀 후속: 기존 callback 성공/거절 검사를 재사용하고, 설치된 Supabase SDK의 만료 session 갱신 거절→로그인 요구→PKCE 재시도→원래 공개 home 복귀를 격리 Chromium에서 보완한다. Auth HTTP만 합성하여 외부 계정/세션을 폐기하지 않는다. 서버 설정·공개 flag·원본 변경0. 실제 hosted 만료/Google 재인증 및 후보 endpoint 증거와 구분하며, 실패가 드러난 제품 코드만 최소 수정한다. 신규 계획판 없이 W19/Q05 증거를 갱신한다.

2026-09-25 W19/Q15 후속: 기존 합성 카드로 테스트 보드 두 개만 공개하여 미니홈의 대표 카드 선택·전시 순서·소개 변경을 owner 제품 UI와 새 익명 방문자에서 대조한다. 테스트 전용 reads/writes/images/home만 승인 범위로 임시 활성화하고 종료 시 home/board 철회·derivative 정리·flags/권리 원복한다. 운영/Android/새 migration 없음. UI 검증과 fixture 준비 RPC는 분리 기록한다.

2026-09-25 W19/Q18: 기존 테스트 사건을 재사용, 승인된 A moderator만 임시 복원. reads/images/home/follows/reports는 off 유지하고 writes만 켜 제한 판정이 flag off에 가리지 않게 한다. 실제 A JWT의 기존 moderation RPC로 제한→owner 제품 알림/이의→stale 재검토 거부→새 queue 재검토→해제를 검증한다. 제품 운영콘솔 대신 임시 로컬 버튼임을 명시한다. 종료 시 해당 사건 제한 해제/모더레이터 삭제/writes·client flags 원복, 감사·원본 보존. 운영/Android/migration 변경 없음.

2026-09-25 W20 현재 증거 대조: 과거 null 후보 파일은 원본 유지하고 현재 HEAD/dirty 상태에서 기존 candidate guard와 전용 단위검사를 실행한다. W19 최신 증거를 Q04/Q07/Q08/Q12/Q13/Q17/W14 및 D01 현재 요약에만 반영한다. 미검증 세부 조건을 PASS로 넓히지 않는다. Android hard-coded 필수 검사는 D02 확정 전 임의 N/A로 바꾸지 않고 Web-only 승인 후의 기존 W20 보완으로 기록. 새 계획·후보 승인·원격 변경·commit/push 없음.

2026-09-25 W19/Q15 다중 카드/비공개 후속: 기존 B 테스트 보드에 합성 SYSTEM_DESIGN 카드2개를 준비하여 기존 owner RPC로만 게시한다(fixture 준비≠UI PASS). 제품 미니홈에서 한 카드만 대표 선택·게시 후 익명 DTO/화면에서 다른 카드 제외를 확인한다. 제품 비공개 확인 후 home reader null/보드2카드 유지 확인. native confirm 도구 제한 시 사용자 클릭 보조를 명시한다. 테스트 reads/writes/home·정책만 일시 활성, images/rights/moderator 변경0; 종료 두 공개본 철회/flags 원복. 원본과 감사 보존, 새 계획/제품코드/운영 변경 없음.

2026-09-25 W19/Q11 hosted 동의 경계: 기존 B 보드와 합성 SYSTEM_DESIGN 카드2개 재사용. 실제 A JWT/기존 RPC로 baseline 게시→새 prepare→합성 원본 제목/version 변경→같은 revision/hash/policy/operation publish의 PREVIEW_CHANGED 및 익명 snapshot 유지 확인. 새 prepare 뒤 구 revision 게시 거부, 최신 검토 게시 성공도 비교한다. 임시 로컬 버튼은 진단 RPC이며 제품 화면 E2E로 포장하지 않는다. 승인된 test reads/writes/policy만 활성; images/rights/roles 변경0. 종료 원본 제목 복원(version 단조 증가), 게시 철회·flags off·임시 파일/서버 제거. 운영/migration/Android 변경 없음.

### 2026-09-25 W19/Q11 실제 동시 게시 검증
기존 합성 B 보드/디자인 카드2개와 실제 A 로그인 RPC를 재사용한다. 같은 review/operation 두 요청은 같은 결과와 revision 1회 증가, 서로 다른 operation 두 요청은 하나 성공/하나 충돌을 기대한다. Promise.all로 요청을 함께 시작하고 최종 owner/익명 공개본을 비교한다(서버 내부 정확한 동시 시작을 강제하는 부하 시험은 아님). 재전송·operation 다른 입력 거부도 확인한다. test reads/writes만 임시 활성하고 종료 시 보드 철회/설정 원복/임시 파일 및 서버 제거. 제품·schema·운영 변경 없음. 기존 승인 범위, Android 제외 및 D02~D06 유지.

결과: 같은 operation 동시2건 revision14 동일/1회 증가, 서로 다른 operation은 revision16 성공1·CONFLICT1, 재전송 불변/변경 hash OPERATION_MISMATCH. 익명 공개본 일치. 보드 철회revision17/설정 원복/원본version3 보존. evidence/2026-09-25-w19-concurrent-publish.json. 제품 코드·migration 변경 없음. 다음 policy 변경 경계.

### 2026-09-25 W19/Q11 policy 변경 경계
기존 합성 B 보드와 실제 A SDK RPC 재사용. baseline 게시 및 구 policy 미리보기 뒤 test policy만 V2로 변경한다. 구 동의 게시 CONSENT_MISMATCH와 기존 익명 snapshot 불변, 새 policy 미리보기/동의 게시 성공을 확인한다. private 원본 변경/이미지 업로드/새 migration/운영 변경 없음. 종료 보드 철회 및 flags/quota/policy 원복. 기존 테스트 승인 범위이며 Android 제외/D02~D06 유지.

결과: review20 구 policy는 CONSENT_MISMATCH/익명 hash 불변, 새 review21 V2는 게시revision22/새 익명 내용 확인. 종료철회23·flags/policy 원복·원본version3 보존. evidence/2026-09-25-w19-policy-consent.json. 다음 이미지 권리 철회 경계.

### 2026-09-25 W19 실제 이미지 권리 경계 연속 검증
기존 승인된 합성 16x16 원본/보드 A만 사용. 실제 이미지 handler 준비→미리보기→권리 철회→게시 거부/익명 비공개, 승인 복원 후 새 미리보기 게시→실제 bytes200→권리 철회→bytes404를 확인한다. 준비 한도도 기존 Q19에서 승인된 asset_limit=1로 일시 낮춰 두 번째 준비 거부를 확인한다(병렬 한도 전체 증거 아님). 권리 재승인은 같은 합성 fixture에만 적용. 종료 owner 철회/asset취소 및 지정 파생본 삭제, 모든 flags/quota/policy 원복. 원본/감사 보존; 제품/운영/schema 변경 없음. 두 접근 실패 시 차단 기록 후 독립 작업.

후속 Q19: 권리 검증 파생본 정리 후 같은 합성 원본의 서로 다른 operation 준비2건을 동시에 시작한다. asset_limit1에서 성공1/QUOTA1 및 예약1 확인, owner취소·지정 파생본 삭제 후 예약0 원복. 기존 승인 한도 이하, 서버 내부 타이밍 강제 부하시험 아님.

독립 Q19 후속: hosted DB의 IMAGE_ATTEMPT 정책/override 만료/정지는 단일 transaction 안에서만 임시 설정하고 authenticated 역할·A claim으로 기존 authorize RPC를 호출한다. 정상1회/초과거부/유효override허용/만료거부/정지거부를 assertion 후 전체 rollback. 실제 JWT/HTTP429 증거와 구분, 외부 알림 미전송.

완료: 이미지 권리 철회 후 게시거부/실제bytes404, 병렬quota 성공1/거절1·정리0, 현재 Chromium22PASS, hosted rollback-only resource daily/override만료/정지 PASS. 증거 w19-rights-quota / w19-current-regression JSON. 전부 원복·제품 변경없음. D02 최종 Web-only 질문 대기 및 D03~D06 잔여 유지.

### 2026-09-25 D02 확정 / W20 Web-only 후보 검사
사용자 첫 Web-only 후보 승인에 따라 최상위 결정·D02를 갱신한다. releaseChannel WEB_ONLY에서만 Android NOT_APPLICABLE을 허용하고 동일 HEAD/0건/사유/VERIFIED D02의 유효한 동일 근거를 요구한다. 기본 기존 후보는 Web+Android 검사 유지, 잘못된 채널·누락/변조 승인·다른 필수검사의 N/A·D06미승인은 계속 차단한다. 과거 후보 파일 보존. 단위검사로 허용/거부 경계를 검증하고 최신 전체 unit/build를 순서대로 실행한다. 제품/DB/운영/의존성 변경없음, rollback은 guard/docs의 이번 변경만 되돌림.

완료: D02 Web-only 확인근거/Decision Log 및 guard 보완. 전용3·전체unit329·build18 PASS. 최신 초안 guard ready=false/14blockers(HEAD·최종환경·운영 게이트 등), D02 gate 자체 통과. evidence/2026-09-25-w20-web-only-validation.json. D03~D05 입력 요청, D06 별도승인 유지.

### 2026-09-25 D03~D05 운영 입력 및 비용 검토
사용자 제공 확정: 월 운영비 1만원 이내 희망, 전체 공개/규모 미정, 개인운영 sinong, 공개 지원 godburgundy@gmail.com, 본인이 신고·장애·비용 확인 하루2~3회, 한국 및 동남아 우선. 비용을 위한 공급자 변경은 질문이며 이전 승인 아님. 연령/이미지/백업은 추천 요청으로 미승인 유지. 공식 Supabase/Vercel/Google Cloud 가격·백업 문서 대조 후 기존 D03~D05에만 반영. 제품/운영 설정 및 외부 이메일 전송 없음.

### 2026-09-25 W06/W08 FREE private image sync 반영
- 기준: 승인 FREE-PRIVATE-IMAGE-SYNC-01, 첨부 closeout 13개 hash 검증. 현재 Web createPlatformImageIntake는 unavailableAdapter이며 일반 파일선택/파일보관이 없음. 기존 card create/promote/getPreview/delete 포트와 IndexedDB metadata는 재사용. 현재 public handler의 원본hash 검사는 유지.
- 범위/순서: 먼저 Web 실제 file picker→원본 로컬 보존/preview→기억 저장·새로고침 복구의 기존 포트 연결. feature flag로 개발 경로를 격리하고 cloud 완료로 표시하지 않는다. 다음 owner-scoped private representation manifest/원자 reservation·최적화/서버검증·동기화·삭제를 같은 W에 연결한다. 숫자 후보를 frontend-only 서비스 정책으로 사용하지 않는다.
- 현재 변경지도: adapters/platform Web intake, 전용 IndexedDB media 저장소, platform selector, 최소 hook 취소/rights 처리, 단위 및 실제 브라우저 파일입력 회귀. 기존 Android/public 포트 유지. 라이브 업로드/DB migration 없음.
- 검증: 실제 input file→preview→저장→재조회. 취소/잘못된 MIME/크기/픽셀·실패 시 기존 ticket보존·동일 operation재시도 검증. 실제 PC/휴대폰 원격동기화는 이 로컬경로로 PASS 처리하지 않음.
- 복구: 새 flag off 기본값; 기존 metadata schema 변경없음, 별도 additive local media DB. 원본 외부파일 수정없음. 기존 tracked diff/reset 금지.
- 종료선: 로컬 유입은 독립 하위검증일 뿐 W06/W08 전체 DONE 아님. cloud 동기화/50MB서버quota/private access/실휴대폰은 필수 잔여.

2026-09-26 로컬 입력 결과: 실제 file chooser→저장/reload/원본hash 보존→삭제, 실패·취소/동의 초기화, real IndexedDB 승격 replay/충돌 Chromium3 PASS. 단위4/전체333/기존 composer18/build18 PASS. 첫 startup timeout과 테스트 확인버튼 누락·Fetch 차단 port 실패는 evidence/2026-09-26-web-local-image-intake.json에 보존. 기존 image HTTP test harness에서 임의 OS 포트 대신20000~49999 범위와 충돌 재시도를 사용해 안정화했다. 신규 서버 DB/공개 플래그 변경 없음. W06/W08의 remote 구현은 미완료이며 로컬 성공으로 CODE_COMPLETE_FOR_WEB_RC를 주장하지 않는다.

### 2026-09-26 W06/W08/W15 private 서버 저장·읽기 경계
- 목적/범위: 기존 Node API와 Supabase adapter 방식을 따라 `api/private-image.js`에서 인증된 사본의 저장/읽기/취소를 연결한다. 계정 원본 metadata의 LOCAL_ONLY/checksum/cloud 필드는 덮지 않는다. 새 private manifest는 owner/asset/source version/수신hash/확정main·thumb hash·bytes/pipeline/operation/state를 별도 보관한다.
- 정책/권한: 기존 private 운영 정책 영역에 revision·승인·관측 만료·계정/전역 bytes·준비/전송 한도를 추가한다. 기본 disabled/한도0, 미승인/미정은 remote 쓰기 거부. private bucket은 direct anon/authenticated 접근을 restrictive RLS로 막고 검증된 HTTP 요청만 전달한다. 정책·완료·정리 RPC는 service-only, 사용자 RPC는 auth.uid와 기존 source owner를 검사한다.
- 일관성: DB 잠금 아래 실제 서버 산출 main+thumb bytes를 예약하며 동일 operation/body는 멱등, 다른 body는 거부. PREPARING/READY/DELETING 모두 물리 용량 점유. 불명 완료에서 파일/예약을 지우지 않는다. source 변경/카드·계정 삭제는 read 즉시 차단/삭제 fence; 파일 제거 후에만 용량 해제. 공개철회는 private 사본 유지.
- 변경지도: additive migration(명령으로 생성), `src/server/privateImages` handler/processor/backend, API entry, 전용 HTTP unit 및 실제 로컬 PostgreSQL 역할·경합 검사. private media의 UI/클라이언트 최적화·PC/실휴대폰 연결은 이어지는 기존 W의 잔여로 구분한다.
- 검증: auth/owner·anon/B 거절, 가짜 MIME/animation·decode·size, server byte/hash/원본 불변, 응답유실 및 동시 replay, quota 경계/병렬·준비 만료, delete→read 차단→cleanup 정산, 정책 미승인/만료/정지. 로컬 DB에만 migration 적용; hosted/실휴대폰 PASS 아님. 기존 unit/build 영향 검사.
- 보안/관측/복구: URL·로그에 파일명/원문/bytes/token을 남기지 않음, no-store/private/no CDN/SW 캐시. default-off API 및 DB 설정으로 rollback, 원본/manifest/fence 역삭제 없음. 운영 DB/Public/유료/배포 승인은 여전히 D06.

결과: private handler/backend/검증된 main·thumb processor 및 additive manifest/정책/전송·준비·변환 meter, source/계정 삭제 retire, 지연 cleanup 도구 연결. service 전용 reserve/complete/cleanup와 owner 검사 RPC, restrictive Storage RLS. **이번 로컬 unit340(신규HTTP/이미지7 포함), PostgreSQL40+실제 병렬2, 기존 public SQL248, build18 PASS**. 49MB+동시800KB×2→성공1/한도거부1/49.8MB, 같은operation 병렬→행/준비 차감1. SQL fixture의 card tombstone 상태 누락1회 수정 후 통과. evidence/2026-09-26-private-image-server-boundary.json. HTTP suite의 Auth/Storage backend는 모형, SQL은 실제 PostgreSQL 역할/권한/경합 검사이며 hosted Supabase 실사용 성공으로 확대하지 않는다.

현재 미완료: Web 명시 연동 선택·client 최적화/원본보존·계정 전환 방어와 원격 이미지 표시/사용량 UI, 실제 test Supabase migration/Storage 연결, 실물 휴대폰↔PC, private bytes 복구, 공개 선택 representation adapter, 동일/작은 교체의 quota 여유와 전체 원화 예산·정책 감사. 다음 1개는 **기존 Web 카드 화면에서 명시 선택한 사본만 최적화해 이 API에 연결하는 흐름**이다. 원격 활성/정책 값/최종 후보는 D01/D03~D06에서 정확한 범위로 관리한다.

### 2026-09-26 W06/W08 Web 명시 연동 및 원격 표시
- 기존 detail/owner boundary/auth session/asset remoteVersion 포트를 재사용. 새 UI flag 기본 off. 계정 metadata SYNCED인 USER_IMAGE만 명시 동의 후 전송하며 방문/새로고침으로 사진을 자동 업로드하지 않는다. Guest·metadata pending은 연동 선행 안내만 표시한다.
- 원본 bytes/hash 대조 후 bounded decode·1600px/최대3회·품질 하한. 전송용 Blob과 operation/policy를 owner+asset+remoteVersion key의 별도 IndexedDB에 원자 저장한다. 응답 유실·새로고침 재시도는 같은 Blob/operation. 취소된 요청은 완료 여부 미확인으로 유지; 서버 취소 확인 전 journal 제거 금지.
- 단계마다 session UID/active owner/현재 asset version을 대조하고 계정 변경·unmount는 abort. 늦은 응답은 화면/다른 계정에 반영하지 않는다. private image는 no-store 인증 fetch→hash/bytes 검증→일시 object URL로 표시하며 unmount/replacement에서 revoke. 서버 policy의 owner-safe READY manifest·pending operation 및 사용량 projection을 확장(미적용 migration에 좁은 변경).
- 파일: 기존 card detail + private panel, client optimizer/controller/journal, runtime 서비스 연결, server policy projection, unit 및 실제 Chromium 앱 검사. 실제 이미지 최적화/IndexedDB/UI와 모형 HTTP 응답의 범위를 분리. 새 remote migration/원격 업로드/실기기 검증은 이번 자동검사로 주장하지 않는다.
- 검증/복구: 명시 동의 전 POST0, 큰 합성 원본 보존/전송사본, 성공/read/reload·응답유실 재시도·취소/계정전환·원격만 있는 카드 표시, 기존 detail/owner regression/build. 기능flag off로 복구하고 기존원본/metadata/journal을 지우지 않는다.

2026-09-26 Web client 결과: private panel/controller/optimizer/journal/runtime와 detail 연결. 실제 로컬 imageType은 rights 분류 UNKNOWN이므로 서버 USER_IMAGE와 혼동한 초기 조건을 수정했다. 원본 없는 detail에서도 사본 read/hash 검증 후 표시. 단위347(신규7), 실제 Chromium 신규2(큰 파일·실제 canvas/IndexedDB/응답 유실/reload/same bytes+operation/390px/늦은 A 이미지 응답 중 B 전환), Web intake3, 기존 composer/owner19, private SQL47+병렬2, 기존 public SQL248, build18 통과. Auth/HTTP/metadata sync는 브라우저 모형이며 hosted 성공 아님.

추가 발견/최소 수정: 카드의 로컬 삭제 RPC가 만드는 기존 delete fence를 private source/retire trigger에 연결해 metadata tombstone 이전 read를 차단했다. 일반 공개 철회는 private copy를 유지한다. 취소가 예약보다 먼저 도착하는 역순 요청은 owner+operation cancellation fence로 차단. 미예약 fence만 계정당1000행으로 제한, 기존 예약 취소는 제한을 적용하지 않으며 계정 삭제 시 fence cascade. 미적용 migration 안에서 수정했고 서버 기본 정책은 off/미승인/한도0 그대로다. 서버 취소 성공 뒤 policy 일시정지가 생겨도 성공한 취소를 불명 완료로 바꾸지 않는다.

현재 잔여/다음: W06/W08 DOING 유지. 다음 1개는 원본 없는 기기의 Archive/Board 원격 사본 표시. 공개 representation adapter·hosted private 왕복·실휴대폰·작은 교체 여유·복구/합산 원화 예산은 계속 남는다. 50MB/1MB는 synthetic test 후보값, 운영 수치 승인 아님. rollback은 PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1 off(기본값); 별도 IndexedDB는 보존하고 원본/기존 이력은 역삭제하지 않는다. 원격 적용/배포/paid 변경0. 명령과 검증 범위: evidence/2026-09-26-private-image-web-client.json.

### 2026-09-26 W06/W08 Archive·Board private 썸네일
- 현재 ArchiveView/MemoryBoardView는 local getPreview만 사용한다. 기존 MemoryCardPreview를 감싸는 private 전용 wrapper에서 local visual MISSING이고 account/SYNCED/개발 flag 조건을 충족할 때만 read한다. Public preview에는 이 wrapper를 연결하지 않는다.
- 목록은 큰 사본 대신 기존 서버 thumb variant를 사용하고 READY manifest의 thumbnail bytes/hash(최대120KB)를 대조한다. viewport 근처에서만 요청, 최대4개 동시 처리, owner/session/version 재검사, unmount/계정변경 시 abort 및 object URL revoke. 업로드와 영구 캐시 없음.
- 검증: 실제 Chromium의 원본 없는 Archive/Board 썸네일, 기존 detail main 표시/재시도, 계정전환 지연응답 차단, HTTP GET만 사용 및 thumb variant, corrupt bytes/기본 flag off 회귀, unit/build. Auth/HTTP는 모형으로 명시하고 hosted·실휴대폰 성공으로 확대하지 않는다.
- 롤백: 기존 private flag off. DB/의존성/원본/권리계약 변경 없음. 다음 기존 W08 공개 representation adapter가 남는다.

2026-09-26 목록 연결 결과: Archive/Board의 기존 visual이 MISSING인 계정/SYNCED 이미지에만 PrivateMemoryCardPreview를 연결. 기존 MemoryCardPreview article ref를 재사용해 DOM/layout 유지. controller read에 thumb variant와 thumbnail hash/120KB validation 추가. 실제 Chromium 원본 없는 Archive/Board·390px/12카드 lazy+동시4건·계정전환 대기 취소 및 기존detail/retry/Board 동작6개 통과, 전체unit348, build18. 기본off 회귀는 evidence/2026-09-26-private-image-list-preview.json 참조. DB 변경 없어 이전 PG 검사 재실행 없음. 다음은 원본 hash·권리·공개미리보기 동의를 보존하는 private→public representation 연결. 현재 원본전용 공개 준비 경로를 그대로 사본 bytes로 우회하지 않는다.

### 2026-09-26 W08 private→public 입력 신뢰 검토
- 현재 공개 handler는 reserve의 원본 sourceHash와 실제 수신 bytes hash를 비교한다. private processor는 최적화 사본 bytes만 검증하며 원본 파생 관계를 증명하지 않는다. 기존 원본 권리 승인만으로 private main을 공개 input으로 대체하면 임의 private bytes에 승인을 전용할 수 있다.
- 먼저 실제 private processor 산출을 공개 handler에 보내 기존 거부를 재현하고 다른 입력도 유효한 private 사본으로 처리되는지 검증한다. 승인된 기존 공개 contract를 완화하지 않는다.
- 검토안(미승인): 원본 checksum/localRef는 유지하고 공개할 정확한 private representation ID/mainHash에 별도 trusted rights evidence를 결속한다. owner/sourceVersion/representation/hash/policy를 operation에 고정하고 reserve/complete/preview/publish/read에서 권리 철회를 재검사한다. 브라우저 자체 선언과 private 저장 완료는 승인으로 사용하지 않는다. 기존 원본 경로 유지, 별도 개발 flag 기본off.
- 이 방식은 현재 원본 기반 권리 승인 모델을 확장하므로 AGENTS.md의 기존 제품결정 변경 승인 규칙에 따라 사용자 결정을 받는다. 승인 전 원격 변경/공개 우회 구현 없음. 새 진행판 없음.

### 2026-09-26 W08 사본별 trusted 권리 결속 구현
- 위 검토안 사용자 승인(PRIVATE-REPRESENTATION-PUBLIC-RIGHTS-01). additive migration으로 사본별 trusted 권리 근거와 public asset의 입력 사본 ID/hash를 보관. 일반사용자/anon write 금지. 기존 source rights와 policy/계정/카드/version gate 유지.
- 서버는 명시적 private source 요청에서만 인증된 사용자 RPC로 사본 ID/hash를 고정·예약하고 private Storage를 직접 읽어 bytes/hash를 검사한다. 원본 업로드의 checksum 비교는 그대로. 완료 시 권리/사본 상태 재검사; 이후 공개 snapshot/preview/read도 사본 권리 철회를 재검사. 정상 공개 후 단순 private copy 삭제는 public 권리 철회와 구분한다.
- UI는 사용자가 서버 사본 사용을 명시 선택하고 별도 공개 동의를 해야 준비한다. private 정책 조회는 GET만, 원본 파일 경로 그대로. operation별 입력 타입/사본 고정, 기존 실패 확인 후 재시도/불명 완료 보존.
- 검증: local PG의 owner/B/anon·원본 및 사본 권리 gate·사본/hash/version/policy 불일치·완료/공개 후 철회, real HTTP private bytes 검증·원본 guard회귀, client 동의·request contract 및 기존 browser/build. hosted/실휴대폰은 미검증으로 보존.
- 복구: 새 client/server feature flags 기본off, additive schema 보존. 사본/원본/권리 이력 역삭제 없이 비활성화. 운영 변경 없음.

2026-09-26 구현 결과: 승인된 사본 입력을 새 client/server default-off flags로 격리했다. 기존 public reservation/complete/visual/readable/preview 함수는 private 내부 원본을 보존한 wrapper로 확장하고 owner/source/사본ID/hash/policy/operation과 trusted 사본 권리 근거를 확인한다. original sourceHash는 그대로 유지한다. public reserve의 기존 owner/source 잠금 후 사본/권리 행을 재검사·잠금하여 기다리는 동안의 취소/철회를 반영한다. complete는 잠금 뒤 정확한 권리 조건 재검사. 공개 이후 private copy만 삭제하는 행위는 public 권리 철회와 구분한다.

검증: unit353(HTTP22 포함), local public SQL267(신규19), private SQL47+병렬2, 전체 공개UI Chromium23 및 최종 동의 문구 2개 재검사 PASS, Web build18. 서버/클라이언트 가짜 데이터승인을 실제 hosted 성공으로 간주하지 않는다. UI 첫 실패의 dev sharp dependency reload를 route등록 순서로 해결, 중복서버 실행 충돌은 중단하고 독립4355에서23 PASS. 원격 적용/운영/의존성/paid 변경0.

다음1개: 기존 W06/W08/D01의 private→public hosted 테스트 적용 manifest(두 신규 migration, 임시 한도/합성 source 및 사본 권리, feature flags,cleanup/원복)를 고정한다. 추가 사용자 계정/기초 DB 재구축은 요구하지 않는다. 실휴대폰·교체 quota·복구·운영 예산/D03~D06은 계속 남는다. 상세 source hashes/명령: evidence/2026-09-26-private-public-representation.json.

### 2026-09-26 W06/W08 실제 두 Web 세션 검증 착수
- 사용자 계속 진행 승인에 따라 기존 moemoa-test만 사용한다. 이미 적용·검증된 migration/기본격리/복원은 반복하지 않는다.
- 서로 다른 loopback origin의 실제 제품 UI와 실제 Auth/RPC/Storage를 연결한다. 기존 A 계정의 한시적 테스트 로그인은 서버 내 admin.generateLink/verifyOtp로 얻으며 비밀키·토큰은 기록하지 않는다. Google OAuth 및 실물 기기 검증과 구분한다.
- 합성 이미지의 UI 저장→명시적 metadata 동기화→private 사본 동의/전송→로컬 원본 없는 두 번째 세션 열람을 확인한다. 정책은 이전 값 전체 보관/복구, 생성 fixture만 tombstone/정리하고 사용한 세션만 로그아웃한다. 운영 변경0.
- 실제 실패가 발견되면 최소 수정/관련 회귀로 먼저 마감하며, 공개 positive 검증은 그 뒤 기존 W08에서 진행한다. 결과와 미실행 항목을 분리 기록한다.
- 실제 두 세션 이미지 왕복 PASS 뒤 모바일390px에서 상단 nav만 root clientWidth보다6px 넘침을 발견했다. container의100dvw가 세로 스크롤바 폭까지 포함하고 nav의 음수 margin이 더해지는 원인이다. 기존 W06/Web QA에 흡수해 container 폭을 부모의 사용 가능 폭 기준으로 최소 수정하고, 동일 실화면·기존 모바일 layout suite/build로 확인한다. 공개 양성 검증은 이 마감 뒤 이어간다.

결과: 실제 UI 두 origin/hosted private 이미지 왕복10관찰 PASS, CSS 가로 넘침 최소 수정 후 실제380/380px·mobile8/build18PASS. 정책 정확한 복원·신규 fixture tombstone/사본 물리삭제1·objects0/quota0·생성 session2개 정리 완료. 이전 HTTP/모형 UI 근거와 구분. 명령·중간 selector timeout/Windows watcher 경고·미검증은 evidence/2026-09-26-private-image-hosted-ui.json. 신규 migration/운영 변경/배포0. 다음은 기존 W08 hosted trusted 사본 공개 양성 경로.

### 2026-09-26 W08 hosted 합성 private→public 양성 경로
- 기존 사용자 test-only 합성 이미지/권리 승인과 후속 진행 지시 범위로 moemoa-test만 사용. source/사본의 정확한 hash를 새 synthetic fixture에 결속하고 기존 source 권리와 사본 권리를 모두 기록한다. production/기존 사용자 레코드 변경0.
- 실제 A Auth session과 private/public HTTP handler→hosted RPC/Storage로 사본 저장/공개 준비/같은operation 회복/preview/publish/anonymous decode/철회를 실행한다. 사본 자체 삭제와 공개 권리 철회를 구분하며 원본 checksum/예약을 대조한다. 이번 HTTP+SDK 검증은 제품 공개 UI/Google OAuth/실기기 PASS로 확대하지 않는다.
- Public reads/writes/images만 임시 활성화(10개/40MiB), private 정책도 기존 test 한도 사용. 모든 원설정 사본을 보존하고 finally에서 원복·권리revoked·새fixture tombstone·세션 scope local 로그아웃, 원래 cleanup fence 뒤 실제 물리삭제/quota 해제 확인. 새 migration/새 계획판 없음.

실행 결과: 실제 hosted HTTP/SDK 18PASS, cleanup3PASS. source/정확한 사본 권리 승인 후 READY·동일operation·원본hash·preview·게시·익명decode 통과. private취소는 Public 유지, 공개권리철회는cards0/이미지404, owner철회는공개본null. 원래fence 존중 후 Storage객체0/두quota0·권리revoked/정책원복/로컬세션로그아웃. 새 product/migration/production 변경0. 근거 evidence/2026-09-26-private-public-hosted.json. 다음 기존 W06/W08/W15 한도 근처 작은 이미지 교체와 예약/정리 검증; 운영 후보/실기기 등 미완료 유지.

### 2026-09-26 W06/W08/W15 작은 교체 quota 재현
- 기존 test-only 승인 범위에서 실제 private HTTP/Storage 합성 사본2개를 사용한다. 큰 사본+작은 사본 합계보다1byte 작은 테스트 quota로 경계를 재현하며 운영50MB 후보 자체는 변경하지 않는다.
- metadata 교체로 옛 asset is_current=false/새 asset 생성, 옛read 차단·DELETING의bytes 유지·새예약 거부를 확인한다. 실제 cleanup fence 경과/물리삭제 후 동일 operation 재시도 성공·새사본bytes만 과금·원본hash 보존을 검증한다. 즉시 작은 교체 UX의 한계와 저장 안전성 통과를 분리한다.
- private 정책 전값 보관/finally복원, 합성card tombstone·사본 물리정리·테스트session만 logout. 기본 DB/A-B/공개 왕복 재검사/운영/새 migration 없음. 두 번 실패로 무의미한 재시도는 하지 않는다.

결과: 작은교체 hosted10PASS. 920+170>1089로 새예약 거부/기존DELETING 과금유지, 원래fence 후 물리삭제→같은operation 성공/새170만과금/원본hash보존. 최종객체0/용량0/정책원복. 즉시작은교체 및 자동정리 UX는 미완료다. repository에 private 자동정리 hookup이 없고 generic quota문구만 있으므로 기존 W08/W15 구현 잔여로 흡수. 다음 bounded 정리와 대기안내 연결, 운영 스케줄 활성은 D06 범위로 구분. evidence/2026-09-26-private-replacement-quota.json.

### 2026-09-26 W08/W15 자동 정리 실행 경로와 용량 안내
- 기존 cleanupPrivateImages의 지연 fence/물리삭제 후 complete를 재사용한다. 신규 secret-authenticated HTTP 정리 endpoint 기본off·GET만·대상project명 일치·no-store·집계 결과만 응답. 기본50개 상한/20초backend timeout, 실패는503으로 관측. 원본/READY를 삭제하는 새 경로 없음.
- GitHub 예약 workflow는 명시 ENABLED 변수true인 경우만 승인된 endpoint 호출, 동시실행 직렬화·timeout·redirect불허. 운영변수/secret등록·push/스케줄 활성은 하지 않는다. 비밀값은 요청header로만 전달한다.
- UI quota문구에 교체/삭제 직후 정리대기 가능성과 같은요청 재시도 안내를 추가. 서버가 확인하지 않은 pending 상태/완료시각을 확정하지 않는다. 정확한 pending 수치projection은 추가DB변경 없이 이번에 만들지 않는다.
- 검증: endpoint 기본off/키누락·오류/올바른키/부분실패/집계정보만 반환, 실제 기존 cleanup 상태 규칙회귀·client operation보존·관련UI/build. 운영scheduler 활성/실제유료범위는 D06 별도. rollback은 cleanupenabled off 및 기존코드revert, DB이력보존.

결과: src/server/privateImages/cleanupHandler.js, api/private-image-cleanup.js, .github/workflows/private-image-cleanup.yml, src/features/memory/components/MemoryPrivateImageSync.jsx, tests/unit/privateCleanup.test.mjs, tests/private-image-sync.spec.ts 구현. unit356/Chromium4/build18/YAML/diff PASS. hosted 빈queue401/200 검증. 실제 예약/nonempty endpoint는 미검증, 과거 cleanup물리삭제와 구분. 새migration/원격활성/배포0. 운영기동 시 API MOEMOA_PRIVATE_IMAGE_CLEANUP_ENABLED=true, _PROJECT=승인ref, _SECRET=별도32자이상 및 기존serverenv; GitHub vars동명ENABLED=true·_ORIGIN=승인https origin, secret동명_SECRET가 필요하다. 현재 등록/활성하지 않았으며 원복은 두 ENABLED off. 주기15분은 후보설정·실제실행지연/비용/알림확인 D03/D06 잔여. 공식인증 참고 https://vercel.com/docs/cron-jobs/manage-cron-jobs . 다음 새endpoint의 합성대기열정리/재시도 실검증. evidence/2026-09-26-private-cleanup-integration.json.

### 2026-09-26 W08/W15 nonempty cleanup endpoint 실검증
- 기존 승인 test-only 합성 교체 fixture를 새 ID로 재사용하되 물리삭제 직접 호출을 새 API의 HTTP GET으로 교체한다. 먼저 기존 live private 사본0을 확인해 다른 자료 정리 금지. endpoint 실제 project binding/secret/default-off 설정을 loopback process내에만 설정한다.
- wrong secret401·fence전 deleted0/파일2·fence후 deleted1/파일0/용량해제·같은operation 재시도·중복cleanup deleted0 검증. 실제 scheduler 실행/제품UI/운영 배포로 확대하지 않는다. 기존fence 기다림, 정책원복·새fixture정리·세션logout 보존.

결과: 실제 API export/hosted nonempty queue 16PASS. 유예전0/후1/중복0·wrongsecret401·원본/용량/같은operation 복구 통과. 최종사본객체0/용량0/정책원복. 증거 evidence/2026-09-26-private-cleanup-hosted.json. 실제 GitHub예약·운영활성은 하지 않음, 기존unit/UI/build 재실행하지 않음. 다음 private 사본bytes/manifest 복구·최신삭제fence 기존 W06/W17/D05.

### 2026-09-26 W06/W17 private 사본 복구 로컬 리허설
- 기존 disposable PostgreSQL runner에 합성 WebP main/thumb 파일의 물리적 백업·복원 검사를 추가한다. 새 진행판/운영 migration/원격 연결은 만들지 않는다.
- 오래된 DB+파일 사본을 별도 격리 DB/디렉터리에 복원하고 모든 공개/비공개 읽기 설정을 닫는다. 백업 뒤 card 삭제 fence 및 알려진 operation 취소를 각각 발생시켜 최신 fence와 representation의 DELETING/DELETED 상태를 재적용한다. 알려진 operation 취소는 cancelled 테이블에 추가되지 않으므로 그 테이블만 백업하면 안 된다.
- 최신 삭제정보 적용 전 부활하는 negative control과 적용 후 재조회 거부, 살아 있는 사본의 manifest/bytes/hash/이미지 decode, 중복 재적용과 quota 보존을 검증한다. 파일 복원은 유효 READY/source만 허용하고 불일치 hash/누락 파일은 실패시킨다.
- 변경 지도: tools/private-images의 합성 fixture 생성/복구 SQL·shell 및 기존 runner, release-v2 요약/증거. 테스트 파일은 합성 이미지뿐이며 운영용 백업 도구로 취급하지 않는다. 운영 사본 암호화·외부 보관·삭제 journal 수집 지속성·보존/RPO/RTO는 D05 미완료로 유지한다.
- 롤백은 추가 리허설 파일 및 runner 호출만 revert. 기존 제품/DB계약은 변경하지 않는다. 실제 hosted 복구/운영 재개/실기기 PASS로 확대하지 않는다.

결과: tools/private-images/recovery-rehearsal.mjs/.sh, recovery-assert.sql 및 기존 runner에 opt-in 로컬복구 리허설 추가. 새15PASS+기존47/병렬2PASS. 전체manifest(operation/owner/version 포함) 일치·물리 main/thumb복원/hash/bytes/decode·취소state/card fence 최신재적용·중복replay·손상/누락거부·설정off 통과. 첫 실행은 Windows CRLF로 shell 실패해 .gitattributes에 private-images/*.sh LF 추가 후 재실행 성공. 운영 도구/암호화/외부 사본/journal 지속성/hosted Storage 복구는 미완료. 증거 evidence/2026-09-26-private-recovery-local.json. 다음1개는 W17 암호화 사본 및 최신삭제journal 수집 도구 로컬 보완.

### 2026-09-26 내일 Web 출시 목표 — 기존 W 연속 마감 (아래 일정 조정 결정 전 이력)
- 사용자 9/27 이내 출시 목표/계획 종료까지 연속 진행 지시. 신규 단계/진행판 없이 W17 백업 잔여→W08/W13/W19 최종 제품 흐름→W15 운영 수치/경보→W20 정확한 후보를 진행한다. 실기기와 사용자 정책 결정은 필요한 범위만 요청하며 독립 작업을 계속한다.
- W17 구현: Node 내장 AES-256-GCM으로 파일별 streaming 암호화, 암호화 manifest, project/release 결속, 손상/키오류/경로탈출/기존출력 덮어쓰기 거부. 복원은 새 격리 폴더에만 수행하고 DB/Public을 활성화하지 않는다. 입력은 운영자가 고른 DB dump/Storage 사본/최신 journal이며 자동 사용자 이미지 수집은 하지 않는다.
- 기존 private 사본 리허설에 최신 삭제정보 export(SQL snapshot), 암호화 사본 왕복/변조검사를 연결한다. 최신 삭제journal은 card/asset 상태·존재계정·취소·사본상태를 포함하되 개인 메모/제목/이미지바이트를 일반로그에 남기지 않는다. 외부 사본/키보관·자동주기/RPO는 미확정 그대로다.
- 변경지도: tools/private-images 백업 module/CLI/journal SQL, tests/unit backup 회귀, 기존 리허설 연결, release-v2 현재 요약/카드/증거. 신규 의존성/운영 migration 없음. 롤백은 도구 revert이며 원본과 기존 사본은 삭제하지 않는다.
- 검증: 정상 파일 및 큰 streaming 입력 왕복, 잘못된 키/바이트변조/manifest변조/project불일치/경로탈출/중복출력 실패, 실제 로컬 SQL journal+합성 WebP 복원. 운영 백업 가동/실기기/후보 승인과 분리한다.

### W06/W08 출시 차단 발견 — 새 기기의 카탈로그 카드 제목 참조
- 실제 hosted→빈 브라우저 sync 이후 Boards 로딩 실패를 관찰. remote MEMORY_CARD는 catalogAnimeId/titleSnapshot을 받지만 animeRefId는 null로 투영되고 getCardBundle이 IndexedDB.get(null)을 호출한다. 이전 개인작품 기반 왕복 검사는 이 경계를 다루지 못했다.
- 먼저 실제 IndexedDB 회귀로 재현한다. 기존 getCardBundle에서 로컬 제목 참조가 없는 정상 카탈로그 카드의 snapshot 참조를 owner/card 단위로 복원하고, PROVIDER_CANDIDATE 출처를 유지한다. 기존 verified/legacy 카탈로그/원본/remote version은 수정하지 않는다. 잘못된 참조는 null 반환해 전체 목록 오류를 막는다.
- 파일: IndexedDbMemoryRepository.js, tests/memory-indexeddb.spec.ts, 현재 진행판/증거. schema·운영 변경 없음. hosted 제품UI로 같은 보드를 다시 열고 private 사본→공개 준비/게시/익명 decode/철회를 이어서 검증한다. 롤백은 해당 client 수정 revert, 생성된 private local snapshot 참조는 역삭제하지 않는다.

### 2026-09-26 사용자 승인 범위 확대·출시 일정 조정
- AGE12-ADULT-AREA-01: 첫 Web-only 출시에 12세 이용 및 성인 전용 영역을 포함하고 기한을 조정한다. 기존 진행판만 유지하며 날짜를 임의 확정하지 않는다.
- 기존 W06은 보호자 동의와 인증 상태/철회, W08은 분류된 이미지의 전달 경계, W14는 분류·신고·재검토·이의, W15는 인증 비용/남용 방어, W19는 미성년/미인증/성인/만료/철회/직접 URL·캐시 우회 검사, W20은 새 계약을 반영한 정확한 RC를 맡는다. 구현 전 실제 코드·스키마의 적용 지점을 조사하고 이 계획의 변경 지도/검증/롤백을 구체화한다.
- D04에서 국가·허용 이미지/검토 전 노출·법정대리인 확인/성인 자격 기준을 확정하고 D03에서 공급자 자격·비용을 검토한다. 현행 권리 게이트를 해제하거나 운영 Public을 열지 않는다. 서버 경계는 기본 거부 원칙으로 설계하고 민감한 인증 원문을 일반 로그에 남기지 않는다.
- 진행 중인 일반 합성 이미지 공개 UI 검증과 테스트 설정 원복을 먼저 마감한다. 해당 PASS를 새 연령 계약 통과로 확대하지 않는다. 외부 인증 공급자 계약·유료 변경·실 개인정보 검증은 로컬 모형 검사와 구분한다.

조사 근거: createMemoryCard.js:233 및 replaceMemoryCardImage.js:102는 contentRating을 UNSPECIFIED로 만든다. publicImages/handler.js:109~114는 owner preview와 익명 공개 조회를 나누며 공개 resolve는 service backend로 실행한다. 따라서 나중에 auth.uid 검사만 SQL에 붙이면 전달 요청자의 자격이 전달되지 않는다. 기존 read_memory_publication, 미니홈/작성자 조회, 이미지 resolve와 인증된 전달 경로를 함께 검토해야 한다. 아직 변경·성인 접근 구현 완료 아님. 공급자 후보의 공식 안내(https://blog.portone.io/authorization-payment-2/, https://www.niceid.co.kr/prod_list.nc)를 확인했으나 개인 운영자 계약 자격·실 견적·해외 지원은 확정하지 않았다.

일반 공개 UI 마감: 실제 사본 선택·준비·미리보기·게시와 새 익명96×64 이미지 표시 확인. 철회 native confirm 도구 timeout/getJsDialog undefined로 이번 UI 철회 PASS 보류. test helper의 실제 owner RPC로 철회하고 원설정 전체복원/합성 tombstone/권리철회/시험 세션 scope local logout 수행. 원래 cleanup fence 이후 scoped 정리로 private/public DELETED·Storage객체0·quota0 확인. 운영 변경0.

### W17 암호화 백업 복원 가능성 보완
- 국가/인증 공급자 결정 대기 중 독립 작업. encrypted-backup.mjs의 개별 safeName/동일 이름 검사만으로는 `objects`와 `objects/main.webp` 같은 파일/디렉터리 충돌을 거부하지 못할 가능성이 있다. 먼저 생성 거부 회귀를 실행해 확인한다.
- 실제 결함이면 생성과 복원 manifest 검증에서 대소문자를 구분하지 않는 조상 경로 충돌을 거부한다. 순서와 플랫폼에 관계없이 동일하게 처리하고, 원본 및 출력에 변화 없이 실패해야 한다. 정상 형제 파일은 기존 streaming 왕복으로 검증한다.
- 파일: 기존 encrypted-backup.mjs와 encryptedBackup.test.mjs, 기존 증거/현재 W17 요약. DB/외부 백업/새 의존성 없음. 롤백은 도구 수정 revert, 원본은 건드리지 않는다.

결과: 수정 전 실제 회귀에서 Missing expected rejection으로 결함 재현. 공통 checkNames가 생성/복원 양쪽에서 모든 조상 경로를 검사한다. 순서·대소문자 충돌과 인증된 옛 manifest의 충돌도 BACKUP_INVALID로 거부하며 출력/임시잔여 없음·원본 보존. 최종 전체 unit361PASS, 실제 로컬 DB dump/journal/합성 WebP 암호화 왕복을 포함한 복구17+기존49=66PASS. 외부 사본/운영 스케줄 PASS 아님. evidence/2026-09-26-backup-path-hardening.json.

### W06/W08/W14 연령 경계의 현재 적용 지점 조사
- W06 유실 복구 결과: POST status로 같은 user/session/purpose의 대기/만료/정책교체/기록완료만 반환. 실제 완료 직후 응답 socket 파기→클라이언트 실패→재조회 성공/provider 재호출0/DB RECORDED:1 유지. 로컬HTTP/DB25 PASS·전체unit383 PASS. evidence/2026-09-26-identity-status-recovery.json. Auth/provider합성, 완료이력은 성인/보호자 자격이 아니다. 다음은 공급자 연결 준비도와 국가/동의 평가에 필요한 증거 계약 검토이며 공개route/remote0.
- W06 응답 유실 복구 범위: identity handler에 POST status action을 추가한다. 기존 service-only load로 같은 user/session/purpose의 요청만 조회하고 provider 재호출 없이 기록완료/대기/만료/정책교체 상태만 반환한다. 기록완료는 신원 증거의 과거 처리 결과이며 현재 성인 접근/보호자 동의 허가가 아니다. 실제 HTTP 응답 socket을 완료 직후 끊고 재조회로 RECORDED를 확인·provider 호출/DB revision 추가0 검증한다. 원격 적용0.
- W06 HTTP/DB 결과: 실제 loopback 발급→core→DB RECORDED:1/최소응답, 완료 replay409/중복0, provider 조회 중 실제 session 삭제→401/PENDING:0 확인. 신규3 포함24 PASS/exit0. evidence/2026-09-26-identity-http-store.json. Auth/provider는합성·전송psql, 실제 인증/JWKS/hosted PASS 아님. 다음은 성공 응답 유실 후 동일 owner/session의 상태 재조회로 재인증 없이 복구하는 경계다. provider 계약/국가 정책/보호자 관계는 외부 및 구현 잔여로 유지.
- W06 HTTP/DB 연결 범위: 기존 core/store integration의 폐기 DB에 loopback HTTP handler를 연결한다. 발급→완료→DB RECORDED:1과 replay거절, 합성 provider조회 중 실제 session행 삭제→완료401 및 PENDING보존을 확인한다. 인증 helper는 별도 모의 단위 근거이고 이번 authenticate는 합성 세션을 주입하므로 실제 OAuth/JWT 검증이라 하지 않는다. 중단된 직전 턴은 파일 읽기만 했으며 새 실행 프로세스/수정 없음 확인.
- W06 HTTP 결과: default-off handler factory+getClaims/getUser 검증 helper 구현. loopback HTTP 신규5PASS, 전체unit381PASS. method/origin/Bearer/1KiB·정확한 필드·owner주입 거부/최소receipt/완료·재시도/오류비식별 검증. Auth 응답은 모의이므로 실제 JWT암호검증/Google OAuth PASS가 아니다. evidence/2026-09-26-identity-http-boundary.json. 공개api경로/업체/원격변경0. 다음은 HTTP와 로컬 실제 SQL store를 연결한 발급/완료 및 세션 철회 검사다.
- W06 서버 진입점 범위: default-off HTTP handler factory와 Supabase getClaims+getUser 기반 세션 검증 helper를 구현한다. POST/정확한 origin/Bearer/1KiB JSON·필드 whitelist를 적용하며 user/session은 본문에서 받지 않는다. 발급은 최소 request DTO만 반환, 완료는 기존 core로 전달한다. 기존 deps만 사용하고 loopback 실제 HTTP로 검증하되 Auth/provider/store는 합성이다. 업체·정식 자격 migration 미완성이므로 `api/` 공개 경로는 아직 만들지 않는다.
- W06 core/store 통합 결과: service-only조회 RPC와 Supabase store adapter를 실제 폐기 DB에 연결, 기존15+getter권한2+core연결4=21 PASS. 다른 동일 사용자 session 차단/core session UUID검사 추가, 전체unit376 PASS. evidence/2026-09-26-identity-core-store.json. 공급자/Auth fixture·psql 전송만 사용, hosted/HTTP/보호자 관계/성인 접근 PASS 아님. 다음은 verified token에서 user/session을 얻는 default-off 서버 진입점과 요청 크기·허용 origin 경계다. 원격/정식migration0, 분류 migration 승인대기 유지.
- W06 실제 core/store 연결: service-only request 조회/정책 조회 RPC와 서버 Supabase store adapter를 추가하고 Node core를 실제 폐기 DB에 연결한다. load에서 user/session/purpose 일치를 검사하고 core도 같은 sessionId를 확인해 공급자 호출 전에 막는다. 발급→조회→합성 provider 검증→DB 기록과 교차 세션/정책 변경/replay를 통합 검증한다. provider/Auth는 여전히 합성, 정식 migration/remote HTTP는 연결하지 않는다.
- W06 DB 저장소 결과: private 정책/요청 ledger·service-only발급/완료 prototype, defaultoff·owner/session·purpose·expiry·정책·한도·클라이언트 거부 및 실제2세션 완료 경쟁 포함15 PASS/exit0. evidence/2026-09-26-identity-request-store.json. 최소 auth.sessions fixture 사용으로 실제 Supabase Auth검증 아님. 기존 JS core/업체/HTTP와 미연결, 원격0/정식migration0. 다음은 core와 이 실제 로컬 DB를 adapter로 연결하는 완료 흐름 검증이다. 저장 증거를 성인 접근/보호자 관계/동의로 변환하지 않는다.
- W06 DB 요청 저장소 범위: 별도 폐기 PostgreSQL에서 private 정책/요청 ledger와 service-role 전용 발급/완료 함수를 prototype로 시험한다. 정책 기본off/한도0, 서버 UUID 발급, 세션 owner 결속, 정책→session→요청 잠금과 clock_timestamp 만료 확인, 예상 전체 DTO 일치, PENDING→RECORDED 단일 전이를 검증한다. Supabase auth.sessions는 로컬 최소 fixture로 모델링하며 실제 Auth 서비스 검증 아님. 권한 부여/개인정보 원문 저장/정식 migration/원격 적용은 하지 않는다. 운영 로그아웃은 JWT 존재만으로 판정하지 않는 공식 session 지침을 따른다: https://supabase.com/docs/guides/auth/sessions .
- W06 요청 결속 core 결과: completeIdentityEvidence와 신규 단위6 추가, 전체unit375 PASS/exit0. 계정/용도/만료/정책·provider request/channel 불일치/민감 오류 제거/처리 중 취소/중복 완료 계약 검증. evidence/2026-09-26-identity-evidence-core.json. fake store의 원자성만 검사했으며 실제 DB 원자성·업체/HTTP 연결·자격 부여 구현 없음. 다음은 폐기 로컬 DB에서 서버 발급 요청/원자 저장소 구현이다. 이미 대기 중인 분류 migration 승인 범위에 새 자격 DB 작업을 자동 추가하지 않는다.
- W06 서버 요청 결속 구현 범위: 공급자 독립 `completeIdentityEvidence`를 추가한다. 인증된 세션 user와 서버 발급 request의 owner/purpose/provider/channel/policy/만료가 일치한 뒤에만 공급자 조회를 호출하고, 조회 이후 서버 저장소가 요청·정책·세션을 재검사해 원자적으로 증거를 기록하도록 계약을 둔다. ADULT_IDENTITY/GUARDIAN_IDENTITY는 신원 증거 용도일 뿐 성인 접근/보호자 관계/서비스 동의가 아니다. HTTP route·DB adapter·업체 SDK·자동 권한 부여는 이번 범위 밖이며 local fake adapters로 시간 경계·교차 계정·purpose·결과 ID·조회 도중 만료/정책 변경·중복 완료를 검증한다. 실제 운영 연결 완료로 표시하지 않는다.
- W06 보호자/자격 조사 결과: authRepo/require_memory_user/profile·device·mutation·pull·promotion과 이미지 backend를 확인했다. 현재 신원 로그인만 있고 연령/보호자 증거 없음. 공통 helper 일괄 차단 대신 cloud 신규 작성/승격과 기존 정보 회수의 용도 분리를 C02에 기록했다. 공급자 인증완료는 보호자 관계가 아니며 일부 foreigner 필드는 자기 입력이라는 PortOne 공식 근거를 확인, 개인 단독 계약/PH·TH 지원/관계확인/비용은 외부 미확인으로 유지한다. 코드/DB/네트워크 설정 변경0, 신규 실행 PASS0. 다음 로컬 작업은 W06 서버 자격 상태와 검증 요청의 계정·용도 결속 계약 구현 준비. D01승인대기와 독립.
- W03 결과: write-build-info에 checkoutCommit 일치 강제 및 공개 vercel.json 원본/빌드본 hash·semanticMatch 추가. 임시 실제 Git 저장소 통합1test(서식/값 변경·SHA 불일치/누락 포함)PASS, build19페이지 PASS. 로컬 config는 semanticMatch=true이나 과거 운영 dirty 원인 해결로 확대하지 않는다. evidence/2026-09-26-build-provenance.json. 운영변경0/D01승인대기. 다음 독립 작업은 연령/보호자 구현 계약의 현행 적용점 검토다.
- 독립 W03 배포 출처 보완: D01 승인을 기다리는 동안 운영 get_deployment로06d2e38/master/source git/READY를 재확인했다. 빌드 로그 connector는 Tool not found로 실패하여 vercel.json 실제 변경 내용은 아직 미확인이다. write-build-info에서 환경 SHA와 checkout HEAD 일치를 강제하고 vercel.json의 Git/빌드본 SHA256 및 JSON 의미 일치 여부만 기록한다(내용/환경값 출력 금지). 임시 Git 저장소에서 clean/서식만 변경/실제 설정 변경/잘못된 SHA를 검사한다. 과거 dirty 상태를 새 검사로 PASS 처리하지 않으며 원격 배포0.
- 실제 browser/DB 결과: Chromium `/moderation/`에서 실제 DB bio 표시→MATURE 선택→명시 확인→저장·DB MATURE:2 확인→새로고침 목록 제외2개 추가, 전체382 PASS notice/exit0. evidence/2026-09-26-content-review-db-browser.json. Auth 합성·RPC psql 전송이며 hosted OAuth/PostgREST/성인 열람 PASS 아님. 전용 browser/dev 서버/폐기 DB 정리. 다음은 D01의 정확한 신규 test migration 적용 범위 승인 확보다. 과거 public/role 임시 승인으로 새 schema 변경을 자동 포함하지 않는다.
- 브라우저/DB 통합 범위: 기존 gateway 통합 hook에 선택적 Chromium 흐름을 추가한다. 실제 Astro 운영자 화면의 테스트 RPC 요청을 같은 폐기 DB 함수로 전달하고, 미니홈 MATURE 선택→명시 확인→저장→DB revision/rating 확인→새로고침 시 대기 목록 제외를 확인한다. Auth는 합성 세션, 원격 네트워크는 차단하며 종료 시 전용 브라우저/dev 서버를 정리한다. 성인 이용자 열람 허용 검증은 아니다.
- gateway/DB 결과: 실제 SupabasePublicationGateway import와 psql RPC 전송 adapter로 미니홈 목록/open/re-read/분류 저장/큐 제외·stale/일반 계정 오류 매핑5개 통과. 기존375 포함380 PASS notice/exit0. evidence/2026-09-26-content-gateway-integration.json. 반환 DTO는 실제 DB 함수 생성이며 OAuth/PostgREST/브라우저와 live DB 연결/hosted 검증 아님. 제품 코드 수정 불필요. 다음은 기존 운영 화면을 실제 로컬 DB 응답에 연결하는1개 분류 흐름 확인이다.
- 앱 gateway/DB 통합 범위: 기존 폐기 DB runner 끝에서 선택적 Node hook으로 실제 SupabasePublicationGateway를 실행한다. RPC 전송만 로컬 psql adapter로 연결하고 반환 DTO/오류는 실제 정식 migration 함수가 생성한다. 미니홈 큐→open→저장→큐 제외, stale 저장, 일반 계정 거부를 검증한다. 이 단계는 OAuth/PostgREST/화면 검증이 아니며 기존 모의 browser PASS와 합쳐 hosted PASS로 표시하지 않는다.
- 정식 파일 결과: CLI 생성 migration에 검증 DDL을 옮기고 candidate는 psql include로 축소. 최종 publication375 PASS/exit0, 전체 migration 순차 적용 private49 PASS/exit0. UNCONFIGURED와 기존 미분류 보드 차단, 긴급 flags 중지와 audit 보존 검증. evidence/2026-09-26-content-review-migration.json. pg_cron은 기존 local harness 제외, hosted advisors/원격 적용0. 다음은 실제 DB 응답과 운영자 HTTP/UI의 통합 및 정확한 hosted 시험 적용 범위 준비다. 원격 apply 승인을 문서 준비로 대체하지 않는다.
- 정식 migration 적용/복구 조건: `20260926140122_memory_content_review.sql`은 content policy를 UNCONFIGURED로 생성하여 이미 게시된 미분류 보드도 숨긴다. test/운영 적용 전 대상 프로젝트·DB 사본·현재 flags·정책 및 적용 SHA를 기록하고 승인을 대조한다. 적용 자체가 정책 승인/분류 일괄 승인/성인 영역 활성화가 아니다. 장애 시 승인된 대상에 `tools/publication-boundary/close-content-review.sql`로 reads/writes/images/minihomes를 닫고 검토/통지/감사 원장을 보존한다. 앱을 이전 버전으로 되돌려도 DB 조회 gate를 제거하지 않는다. 재개는 수정·검증된 migration과 정확한 flags/정책 별도 승인 후에만 한다. destructive down migration은 제공하지 않는다. 공개 중지 및 audit 보존을 폐기 DB에서 검증한다.
- 정식 파일 준비 범위: 설치된 Supabase CLI `migration new memory_content_review`로 생성한20260926140122 파일에 검증된 candidate DDL을 단일 원본으로 옮긴다. 기존 candidate는 해당 migration을 읽는 로컬 psql adapter로 남긴다. publication runner는 변경 전 baseline을 먼저 실행하고 각 rollback 계약 및 마지막 upgrade/race 단계에서 정식 파일을 적용한다. 별도 private runner는 모든 migration을 순서대로 적용해 신규 설치 호환성을 검사한다. rollback은 분류 자료를 삭제하거나 옛 무분류 조회로 되돌리지 않고 공개 관련 flags를 닫는 운영 중지 절차로 준비한다. 원격 apply/정책 설정/공개 활성화 없음.
- 동시성 결과: 두 실제 세션에서 snapshot 변경·철회·정책 변경 선행 잠금을 관측하고 stale 분류 요청을 제출, 각각 PUBLICATION_CONFLICT/NOT_FOUND/CONTENT_POLICY_CHANGED 거절 및 revision1/audit1 보존. 신규3 race 포함372 PASS notice/exit0. 제품 SQL 수정 없음. evidence/2026-09-26-content-mutation-races.json. 직접 합성 행 변경/변경 선행 순서의 DB 경계 검사이며 실제 publish UI/RPC 전체 순서를 증명하지 않는다. 다음은 default-closed를 유지한 정식 migration 파일 준비와 rollback 검토; 원격 적용은 해당 gate 없이 하지 않는다.
- 동시성 추가 범위: 폐기 로컬 DB의 두 실제 세션에서 정책/게시 snapshot 변경/철회가 먼저 잠금을 잡은 뒤 옛 hash·policy 검토를 제출한다. PgSleep 관측으로 겹침을 확인하고 옛 분류/audit revision이 증가하지 않는지 검사한다. 이는 실제 게시 UI/RPC 검증과 구분하는 DB 행 경계 실험이며 실패가 있을 때만 제품 SQL을 수정한다.
- 미니홈 큐 결과: content-home-queue-contract.sql을 기존 home transaction에 연결했다. 신규15 포함 전체369 PASS notice/exit0, 최초 검토/재사용/분류 제외/내용 변경 충돌/철회와25개 페이지 경계 통과. 기존 구현 수정 불필요. 합성 fixture savepoint rollback, DB runner 종료 정지, 원격0. evidence/2026-09-26-home-review-queue.json. 다음은 정식 migration 준비 전 게시/정책 변경과 검토의 동시성 및 candidate 적용 준비도 검토다. 이전 unit/browser/build는 이번 재실행하지 않았다.
- 이번 검증 범위: 기존 미니홈 fixture에서 최초 검토→동일 사건 재사용→분류 후 큐 제외→소개 변경/철회 후 옛 승인 거절을 확인한다. 별도 rollback savepoint의 합성 미니홈 25개로 20개 페이지·cursor·중복/누락·끝 페이지를 검증한다. 제품 SQL은 실패가 재현될 때만 최소 수정하며 원격 환경은 건드리지 않는다.
- 최초 검토/UI 결과: 보드·미니홈 대기 목록과 기존 이의 목록을 `/moderation/`에 연결했다. 이미지 로드 완료·분류 선택·명시 확인 후 exact case/content revision/hash/policy로 저장하며 실패/세션 변경은 저장을 막는다. 신규 SQL10 포함354 PASS notice, 전체 unit368 PASS, Chromium publication-ui29 PASS/기능 설정에 따른1 skip(신규4 포함), build19페이지. 첫 browser 실패는 select label 연결을 명시해 수정했고 최종 targeted/full 통과. evidence/2026-09-26-content-review-workspace.json. SQL은 폐기 로컬 DB, 브라우저는 실제 앱+mock Auth/RPC이므로 hosted/실기기 근거로 확대하지 않는다. 다음은 최초 미니홈 큐/페이지 경계 SQL 검증. 정식 migration/원격 적용0, 성인 자격·보호자 동의·국가별 조건 미완료.
- 최초 검토 경로: board/home별 cursor 목록에서 published snapshot/selection hash와 현재 분류·policy를 대조해 미검토/변경분만 반환한다. 운영자가 열 때만 대상 row 잠금 하에 hash/policy별 사건을 재사용/생성한다. 기존 get/review image/이의 해결 경로를 초기 contentRevision0에도 연결하고 최초 사건은 RECEIVED 상태에서 정확한 hash/policy를 검증해 처리한다. 목록 조회는 쓰기/자동승인이 아니다. 같은 열기 재시도·정책 변경·stale 공개본·완료 후 큐 제외를 로컬 검사한 뒤 화면에 연결한다.
- 검토 이미지 결과: default-off `MOEMOA_CONTENT_REVIEW_IMAGE_ENABLED`와 기존 handler review GET 경로/인증된 사용자 resolver 추가. 사건/hash/policy/content revision/asset 소속을 검사하며 Storage 전후 재확인·quota/hash/no-store 재사용. 신규SQL8 포함344 PASS notice, 실제 loopback HTTP+모의backend 신규6 포함28PASS, 구현 수정 후 전체unit366PASS(마지막 추가 검사 전; 마지막 검사는28회차 포함). 다운로드 도중 운영자 권한 제거/철회 시 bytes 미전달 확인. evidence/2026-09-26-moderator-image-preview.json. 운영 env/원격 migration0. 다음은 최초 미검토 대상 큐와 운영자 검토 화면을 이 조회/전달 경로로 연결하는 W14 작업. 현재 경로는 이미 사건에 연결된 분류 검토용이며 최초 게시를 자동 승인하지 않는다.
- 운영자 이미지 전달 범위: 기존 public-image handler에 default-off moderationPreviewsEnabled 경로를 추가한다. Bearer 검증 후 사용자 RPC로 사건/hash/정책/분류 revision과 해당 published USER_IMAGE 소속을 확인하고 full/thumb 사본만 조회한다. 서비스 권한으로 moderator 판정을 대체하지 않는다. 기존 전송 quota/hash/no-store와 Storage 전후 resolve를 재사용해 다운로드 도중 권한 해제·철회·정책 변경 시 bytes를 반환하지 않는다. SQL resolver 권한/버전/소속과 실제 HTTP handler+모의 backend 전송을 각각 검증한다. 운영 env flag/DB 변경0.
- 운영 조회 결과: 기존 큐에 CONTENT/REPORT 구분, moderator-only 현재 공개 선택/hash/policy/사건·분류 revision 조회 추가. 일반/B/anon 및 철회본 거부. 테스트 추가 중 reviewed_by FK가 계정 삭제를 막는 실제 실패 재현; 현재 분류는 대상 삭제 cascade, 검토자는 기존 감사 방식의 UUID 기록으로 수정했다. 합성 계정 삭제/분류 제거/감사 보존까지 통과. 신규9 포함336 PASS notice/exit0, evidence/2026-09-26-moderator-review-package.json. 운영자 UI/이미지 검토 경로는 아직 없으며 다음 기존 W14 작업이다. SQL 원격 적용/실제 계정 삭제 없음.
- 운영자 조회 보완 범위: 기존 운영 UI는 없고 RPC/절차만 존재함을 확인했다. 우선 list_memory_moderation의 항목에 REPORT/CONTENT 구분을 추가하고 사건에 결속된 get_memory_content_review를 제공한다. 현재 공개된 선택만 반환하고 source private notes/localRef/owner ID는 제외한다. 철회·삭제·현재 읽을 수 없는 원본 카드가 있으면 조회를 거부한다. policy/hash/분류 revision/사건 revision을 같은 응답으로 묶어 후속 화면이 그대로 제출하게 한다. 호출자 role·사건 종류·철회와 private 데이터 비포함을 로컬 SQL로 검증한다. 실제 운영자 이미지 preview/화면은 다음 구현이며 이 조회만으로 검토 UI 완료 처리하지 않는다.
- 통지/이의 결과: content audit trigger가 기존 사건/소유자 알림/감사를 원자 생성하고 기존 safety inbox/appeal RPC에 연결. 전용 재검토 RPC는 사건·분류 revision 및 policy/hash를 확인하고 새 분류/통지와 옛 사건 종료를 원자 처리한다. 일반 RESTORE는 분류 사건에 CONTENT_REVIEW_REQUIRED. 신규SQL17 포함327 PASS notice/exit0, Chromium 실제앱+mock Auth/RPC 분류3종 알림→이의→로그아웃 제거3PASS, build18페이지 통과. evidence/2026-09-26-content-notice-local.json. 실제 hosted 왕복/운영자 검토 화면/성인 자격/실기기 PASS 아님. 다음은 운영자 분류·이의 검토 화면에 필요한 정확한 공개본 조회와 사건 구분 연결.
- 통지/이의 로컬 범위: 성공한 content audit에 기존 memory_reports 사건과 memory_moderation_notices를 원자 결속한다. 기존 list_memory_safety/appeal_memory_notice를 재사용하고 분류 사건에 일반 RESTORE를 적용해 잘못 해결된 것으로 표시하지 않도록 guard한다. 별도 resolve_memory_content_appeal은 사건 revision·현재 분류 revision·snapshot/policy 검증 뒤 재분류/통지/사건 종료를 한 transaction으로 처리한다. 소유자/B/익명 격리·중복 이의·stale 해결·실제 재분류를 로컬 SQL로 검증한다. 안전함 UI에는 분류 action의 한영 이름을 추가한다. 원격 적용/메시지 전송0, 실제 UI 검증은 별도다.
- 정책/감사 후속 결과: current policy를 명시 인자로 검증하고 승인 행에 결속, 정책 교체 시 보드/미니홈 기존 승인 무효화. 성공 변경만 원문 없는 감사 행에 원자 기록, 운영자 직접 삭제 거부. 실제 두 세션에서 첫 승인 잠금 보유를 관찰 후 같은 revision 요청을 실행해 1승인/1충돌/감사1 확인. 신규10 포함 전체310 PASS notice/exit0. 첫 동시성 실행은 앞선 철회로 snapshot이 없어 fixture lookup 실패했으며 전용 합성 payload로 보완했다. 최종 레이스만 폐기 로컬 cluster에 commit, 이후 정지. evidence/2026-09-26-content-policy-local.json. 실제 게시/정책 변경과 동시 검토, 검토 UI·통지/이의, 인증 공급자 및 hosted 검증은 미완료다.
- 다음 로컬 구현: 분류 RPC에 검토한 policy revision을 필수 인자로 추가하고 singleton 설정과 비교/공유잠금 후 게시본 잠금을 취한다. 보드/미니홈 조회는 현재 정책과 분류 정책이 일치할 때만 계속한다. 성공한 변경의 target/hash/rating/revision/actor/policy만 private 감사에 같은 transaction으로 기록하며 원문 내용은 저장하지 않는다. stale/거절은 성공 이력으로 남기지 않는다. 정책 교체/누락·감사 직접 변조 거부와 두 실제 세션의 같은 revision 경쟁을 검사한다. prototype만 적용, 최종 동시성 실험은 폐기되는 local cluster에서만 commit하며 종료 후 정지한다.
- 후속 결과: 미니홈 published_selection hash/운영자 분류를 독립 wrapper로 연결했다. 미니홈 신규14 + 이미지 resolver 신규7 + 이전 분류12 재실행, 전체300 PASS notice/exit0. 미니홈 negative control은 합성 retirement를 transaction 안에서 되돌려 실제 표시 가능한 보드가 있는지 먼저 확인했다. 서비스 role의 기존 full/thumb resolver도 분류 전 null→GENERAL 실제 path→MATURE null을 검증했다. 정식 migration/HTTP bytes 검증이 아니며 prototype DDL은 rollback했다. evidence/2026-09-26-content-surfaces-local.json. 다음은 분류 정책 버전·감사/이의·동시 수정 경계 보완, 이후 인증된 성인 접근 연결. 성인 기능을 영구 차단으로 대체하지 않는다.
- 후속 범위: 미니홈은 published_selection의 nickname/bio를 독립적으로 읽으므로 보드 분류만으로 해당 문구를 보호하지 못한다. 같은 로컬 candidate에 미니홈 선택 전체 hash에 결속한 별도 운영자 분류와 read_memory_minihome 경계를 추가한다. 기존 build_memory_minihome은 보드 reader를 재사용하므로 대표/보드 내용은 각 보드의 분류까지 만족해야 한다. 원 함수 권한 회수·author 경로·변경 후 무효화를 기존 미니홈 fixture 뒤 transaction rollback 검사로 검증한다. 새 정식 migration/운영 적용 없음.
- 로컬 실험 결과: content-review-candidate.sql + content-review-contract.sql을 기존 publication runner의 동일 psql 세션에 연결했다. 기존 unclassified 공개 negative control 포함 신규12검사, 전체279 PASS notice/exit0. 정확한 snapshot hash/review revision, 운영자 권한, 원 reader 직접 접근 차단, 제목 변경 무효화, 기존 kill switch 확인. 전체 실험 transaction rollback 후 기존 검사 계속 통과. PostgreSQL14 기본 경로 실패는 설치된16 PG_BIN 명시로 해결했다. 아직 정식 migration/성인 인증/검토 UI/감사·이의/미니홈 metadata/직접 이미지 전체검증 아님. evidence/2026-09-26-content-review-local.json. 다음은 분류 감사·재검토와 미니홈/이미지 경로의 우회 검증이며 인증 공급자 미정과 독립적으로 진행한다.
- 로컬 SQL 실험 범위: tools/publication-boundary/content-review-candidate.sql에서 게시 snapshot 전체 hash에 결속한 운영자 분류와 기존 read_memory_publication 호출 경계를 시험한다. 기존 함수는 private으로 옮겨 직접 호출 권한을 회수하고 wrapper가 검토 일치 뒤 호출한다. GENERAL만 익명 전달하며 성인 자격 연결 전 MATURE는 닫는다. 이는 성인 기능 완료를 대체하지 않는 중간 구현이다. 별도 contract를 기존 로컬 runner에서 transaction rollback으로 검증하고 이후 정식 migration으로 정리한다. 기존 권리/철회 함수는 보존한다. 운영/원격 적용0, rollback은 실험 transaction 전체 rollback이다.
- C04를 분류 상태×방문자 자격의 전달 계약으로 구체화했다. 기존 분류 UNSPECIFIED를 승인으로 승격하지 않으며 image hash/version 결속·검토 대기 차단·Storage 전후 재확인·metadata/직접 URL을 포함한다. 다음 구현은 기존 publication SQL의 readable 판정과 검토 RPC에 trusted 분류를 연결하는 로컬 수직 흐름이다. 인증 공급자는 아직 미정이므로 실제 성인 인증 PASS/활성화는 별도다. 원격 migration0, 과거 PASS 보존.
- 공식 자료 조사: 태국 MDES 제공 PDPA 비공식 영문 번역 제20조는 미성년자의 단독 행위 가능 여부에 따른 친권자 동의와 10세 미만 규정을 구분한다(https://www.mdes.go.th/law/detail/3577-Personal-Data-Protection-Act-B-E--2562--2019-). 따라서 한국의 14세 기준을 태국에 복제하지 않는다. 필리핀 NPC Advisory 2024-03의 최종 서명본 존재는 확인했으나 본문 재조회가 2회 403/오류로 실패해 세부 동의 기준 확정 근거로 사용하지 않는다. 초안으로 대체하지 않고 다른 독립 작업으로 이동한다. 이러한 조회는 MOEMOA의 국가별 법률 검토 완료가 아니다.
- 콘텐츠 결정 갱신: ADULT-CONTENT-SCOPE-01에 따라 비노골적인 성인 취향 일러스트부터 포함한다. 분류 미확정/재검토 상태를 성인 자격 확인만으로 노출시키지 않는다. W14의 기존 검토·조치 경로와 W08의 공개 snapshot/이미지 전달을 대상으로 세부 계약을 정리한다. 사용자 결정 완료와 해당 기능 구현 완료를 구분한다.
- 지역 결정 갱신: 사용자 “국가는 그렇게 확정하자” 승인으로 한국·필리핀·태국 확정(RELEASE-REGIONS-01). 기존 D04 안에서 국가별 동의·인증·콘텐츠 제공 조건을 대조한다. 필리핀 NPC의 최종 서명된 Advisory 2024-03, 태국 MDES의 PDPA 제20조 번역을 조사하고 초안과 확정 문서를 구분한다. 국가 코드 또는 단순 나이 비교를 법적 적격성의 대체로 구현하지 않는다. 국가 선정은 운영 공개/유료 계약 승인이 아니다.
- authRepo.js:44~77의 공통 Google OAuth 시작은 현재 연령/보호자 동의 없이 진행한다. 가입 후 체크박스를 추가하는 것만으로 가입 전 개인정보 동의를 충족했다고 판단하지 않는다. 실제 공급자/적용 국가 결정 뒤 가입 전 절차와 서버 가입 제한을 함께 설계해야 한다.
- platformPublication.js:14~20은 세션 저장이 꺼진 별도 익명 reader이고 PublicBoardSnapshot.jsx:30은 공개 이미지 URL을 img src로 직접 사용한다. 따라서 기존 계정 로그인을 성인 인증으로 간주하거나 SQL auth.uid 검사만 추가하는 것은 불충분하다.
- handler.js:109~127의 실제 전달은 preview만 user RPC, 일반 공개는 service RPC이며 Storage 읽기 전후 resolve를 재확인한다. 이 재확인과 no-store를 유지하면서 검증된 요청자 세션을 전달해야 한다. storage 경로/토큰을 URL이나 공개 DTO에 넣는 방식은 사용하지 않는다.
- read_memory_publication의 card 필터와 이를 재사용하는 미니홈·작성자/관계 읽기를 함께 검증해야 한다. 성인 카드뿐 아니라 title/description/대표 이미지·집계의 노출 정책도 D04에서 확정해야 한다. 기존 일반 UGC 동작은 아직 새 연령 정책을 구현하지 않는다.
- 공급자 조사: PortOne의 현행 V2 문서는 브라우저 완료 후 서버 API에서 VERIFIED 결과를 조회하도록 설명한다(https://developers.portone.io/opi/ko/extra/identity-verification/readme-v2). 사용자/일회용 요청 결속·만료/재사용·guardian 관계/동의는 MOEMOA에서 별도로 검증할 항목이다. 2024년 공급자 블로그의 단가를 현재 견적으로 확정하지 않는다. 공급자 계약/키/유료 변경 없음.
