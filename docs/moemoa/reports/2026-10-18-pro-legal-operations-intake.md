# GPT Pro 법적·운영 검토안 대조 — 2026-10-18

**인수·정적 대조와 내부 문서 정정까지 완료했다. 앱 수정, DB 실행, 새 약관 게시, 자동 메일 연결은 이번 결과가 아니다.** 새 메시지는 첨부 3개만 제공했으므로 첨부의 실행 지시·일정·정책 선택을 일괄 승인으로 취급하지 않았다.

검토 기준 `dfa6426`, 인수 HEAD `9d151dd`. 해당 앱/API/검사/DB 코드에 후속 차이가 없어 지적된 소스 경로를 그대로 대조할 수 있었다. 마지막 실제 운영 확인은 같은 날 앞선 작업의 `a65f557`이며, 이번에 운영 함수·실제 이용자 영향 건수를 조회하지 않았다. [원문·해시·누락 자료](../references/legal-operations-review-20261018/README.md), [기존 작업판](../release-v2/03_RELEASE_WORKBOARD.md).

## 1. 우선 처리할 실제 문제

| 기존 ID / 지적 | 대조 결과 | 가장 작은 다음 작업 |
| --- | --- | --- |
| W09/W14, Q12/Q17 — DF-01 | 2카드 공개 후 1카드를 비공개로 바꾸면 남은 snapshot은 공개지만 `published_operation`은 null이다. 신규 신고는 그 필드가 있어야 접수해 `NOT_FOUND`가 될 수 있다. **현재 소스의 계약 불일치**, 운영 사례 발생 여부는 미확인 | 새 신고자·새 operation으로 격리 SQL 재현 후 대상 인정 조건만 additive 수정. 중복·quota·비공개 존재 비노출·숨김/철회 대상의 기존 신고 정책 유지 |
| W06/W17, D05 — DF-02 | 삭제된 entity의 과거 `result_payload.remoteEntity`가 남는 문제는 **10/10 로컬 12검사와 test-only 적용까지 이미 완료**했다. 운영 반영 후속 근거는 찾지 못했다 | 기존 후보 재사용. 현재 운영 함수 fingerprint·대상 집계를 본문 없이 읽어 차이를 확인하고 정확한 운영 후보를 준비. 실제 본문 정리는 별도 승인 뒤 수행 |
| W15/W18, C09 — 한도 라벨 | 관리자 화면은 전역 이미지 요청/전송량 한도도 모두 ‘계정별’로 안내한다. **표시 오류**, 실제 한도 계산 변경 필요 없음 | 기존 제공 patch의 범위 열 추가. KO/EN에서 전역 2행과 계정별 대표 행, 320px·키보드 표 접근만 확인 |
| W17, C02/C08/D04 — 처리 고지 | Vercel 이미지 변환·중계, GitHub runner의 백업 작성·복호 중 본문 처리가 현행 안내에 충분히 설명되지 않았다 | 실제 제공처·지역·보관 사실표를 채우고 새 고정 KO/EN 고지 후보와 필요한 버전 전환 준비. 기존 고정 문서 덮어쓰기 금지 |

DF-01 근거: `supabase/migrations/20261011120000_simple_card_sharing.sql:48–59`, `20260923213901_memory_moderation.sql:43–65`, reader `20260923090000_memory_publication_boundary.sql:211–221` 및 `20260927042334_memory_general_postmoderation.sql:68–87`, `src/features/memory/components/PublicMemoryBoard.jsx:17–65`. 기존 회귀 위치는 `tools/publication-boundary/simple-card-sharing-contract.sql:34–39`다. **reader 결과가 있는 대상만 신고 가능하게 바꾸는 것도 기존 숨김/철회 신고 범위를 줄일 수 있어 그대로 적용하지 않는다.**

DF-02 근거: `supabase/migrations/20260902054119_memory_user_functions.sql:141–162,183–219`, `20260902055512_memory_user_retention.sql:49–82`, `tools/operations/retention-response-candidate.sql:86–98`, `retention-response-contract.sql:24–51`. 실제 이전 검증은 [10/10 retention evidence](../release-v2/evidence/2026-10-10-retention-closeout.json)의155–165,187–222행이다. test 실제 제거는0건이며 현재 운영 영향 건수가 아니다. 후보는 operation 생성일 TTL이 아니라 **owner의 entity 부재**로 본문을 지운다. 기존30일 entity purge와의 결합을 operation 자체의 일괄30일 삭제라고 설명하지 않는다.

계정 전체 탈퇴는 Auth cascade가 있는 별도 경로다. DF-02를 타계정 읽기/쓰기 취약점으로 확대할 근거도 없다. 현재 RLS·owner/operation 재생 검사는 `20260902054132_memory_user_security.sql:19–35`, `20260902054119_memory_user_functions.sql:203–206,835–856`에 있다. 이 대조가 모든 공격 조합의 보안 감사 완료를 뜻하지는 않는다.

한도 근거: `src/components/AdminDashboard.jsx:113–119`, 전역 actor `supabase/migrations/20260924115258_memory_resource_controls.sql:124–142`. 첨부 patch의 `git apply --check`는 성공했으나 적용/UI 검사는 하지 않았다. 첨부 테스트는 헤더만 바꾸므로 실제 범위 값도 기존 `tests/admin-ui.spec.ts:92–134`에서 확인해야 한다.

## 2. 현재 안내에서 정정할 사실

- **이미지 처리:** `src/server/privateImages/handler.js:48–84`는 바이트를 받아 변환·해시·업로드하고 조회 시 중계한다. 공개 처리도 `src/server/publicImages/handler.js:129–161`에서 바이트를 제공한다. Vercel이 별도 영구 사진 저장소가 아니라는 설명과 이미지 내용을 처리한다는 사실은 함께 안내할 수 있다.
- **백업 처리:** `.github/workflows/moemoa-weekly-backup.yml:31–37`, `tools/operations/run-weekly-backup.mjs:81–101`, `capture-daily-backup.py:77–88`, `prepare-daily-backup.mjs:107–126`의 GitHub runner는 암호화 전 자료와 복호한 기존 사본을 처리한다. Google Drive의 암호문 저장과 구분해야 한다. runner OS 이름을 처리 국가로 쓰지 않는다.
- **백업 주기:** 주간 생성은 설치·첫 schedule 성공까지 확인됐다. 세대 보존/정리는 수동이며 주간 생성이 자동 파기 주기를 의미하지 않는다. 삭제 후30일이 지난 entity 정리, 이미지 정리, 응답 사본, 백업 보관을 하나의 삭제 시한으로 합치지 않는다.
- **공급자 계약:** Supabase 약관 §7(b)의 DPA 편입을 확인했다. 별도 서명서를 보지 못했다는 이유만으로 미체결이라고 하지 않는다. 실제 주문 예외·법인·리전 외 처리는 확인 잔여다. [공식 약관](https://supabase.com/terms), [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum).
- **고정 문서:** `src/components/legal/Privacy20261010.astro:57–61,73–80`의 부족한 설명을 과거 이용자의 수락 문서에서 바로 바꾸지 않는다. 새 고지와 실제 버전/기존회원 전환을 함께 검토한다.

Vercel Hobby 적용 범위, GitHub 실제 계정 계약·처리 국가·로그, 소비자 Drive/One의 계약상 역할, 운영자의 법적 표시·보관기준은 확인할 사실로 남긴다. 그 불확실성만으로 유료 전환·외부 문의·기존 백업 삭제를 실행하지 않는다. Google 소비자 DPA 설명은 첨부의 주장이며 공식 FAQ 본문을 다시 확보해 정확한 상품 범위에 결속한다.

## 3. 법률별 절차와 구현 제안을 구분

| 쟁점 | 이번 대조 판단 | 기존 작업과의 연결 |
| --- | --- | --- |
| 한국 국외 처리 | 계약 필요 위탁·보관의 적정 고지 경로도 있어 모든 처리에 새 체크박스가 필요한 것은 아님. 실제 처리 근거·위탁계약·보호조치는 별도 | D04/C02 사실표와 새 고지 후보 |
| 사생활·명예훼손 요청 | 제44조의2 적용 시 조치·양측 통지·조치 안내와 임시조치 기간을 구분. 30일은 모든 신고 답변 시한이나 자동 복원 규칙이 아님 | W14/C08의 수기 접수·시각·대상·통지 기록부터 연결 |
| 반복 저작권 침해 | 제102조의 책임제한 조건과 실제 해지 방침·합리적 시행을 검토. ‘3회 신고 자동 탈퇴’로 바꾸지 않음 | 새 제재 범위/개인 기록 처리·이의는 별도 정책 후보 |
| 불법촬영물·비동의 성적 이미지 | 한국 적용 사업자의 인지 후 지체 없는 조치와 미국 적용 플랫폼의 유효 요청 수신 후 가능한 한 빨리/최대48시간을 구분. 미국 알려진 동일 사본 노력도 같은 기간 | 새 테이블 완성을 기다리지 않고 기존 접수·수동 조치·결과 기록으로 필요한 부분부터 준비 |
| 직접 제작 이미지 | 직접 그리거나 촬영한 사실만으로 포함된 제3자 권리가 모두 해결되지 않음 | 기존 권리 gate 유지. 모든 팬아트/굿즈/코스프레 일괄 금지로 확대하지 않음 |

이번 공식 대조: [개인정보 보호법 제28조의8](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1020398611), [정보통신망법 제44조의2](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029562697), [저작권법 제102조](https://www.law.go.kr/lsLawLinkInfo.do?chrClsCd=010202&lsJoLnkSeq=900605760), [전기통신사업법 제22조의5](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029562969), [TAKE IT DOWN Act §3–4](https://www.govinfo.gov/content/pkg/PLAW-119publ12/html/PLAW-119publ12.htm). 법률별 사업자/플랫폼 적용 사실은 별도 판단이며 첨부를 법률 적합성 인증으로 채택하지 않는다.

기존 HIDE는 한 공개 대상의 가림이다. 알려진 다른 위치·파생본·객체/캐시 제거·신청자 통지는 별도 결과다. `public_asset_referenced`가 숨긴 snapshot도 참조하는 것과 공개 reader가 가려진 이미지를 계속 내보내는 것은 다르다. 실제 handler는 전송 전후 공개 상태를 재검사한다. 근거: `20260923213901_memory_moderation.sql:67–82,129–146`, `20260923093000_memory_public_images.sql:98–102`, `src/server/publicImages/handler.js:129–158`.

## 4. 그대로 도입하지 않을 제안과 자료의 한계

1. **관리자 전면 확장:** 사건/rules/copies/notices 및 추가 RPC·테이블은 새 설계다. 기존 신고/가림/이의가 없다는 판정이 아니다. 작은 수기 기록·기존 관리자 연결을 우선할 수 있으며 대규모 콘솔이 모든 운영의 선행조건은 아니다.
2. **메일 자동화:** renderer는 본문 생성기일 뿐 실제 발신·outbox·중복 방지·재시도·발신 OAuth·누락 감시는 미연결이다. 기존 Google 로그인 권한을 발신 권한으로 재사용하지 않는다. `code/README.txt:23`의 dedupe 요소에는 template가 없지만 `admin-implementation-spec.html:195`에는 있다. 실제 연결 전 한 계약으로 정리한다.
3. **정책 변수:** `policy-decisions.json`은38개 정책 변수+1개 문법 예시가 모두 null이고 `publication_ready=false`다. 문서가 있는 것과 게시 가능한 것은 다르다. 현재 없는 폼·보관기간·담당자·계약값을 추정하지 않는다.
4. **새 보관기한:** 지원90일·신고180일·감사1년·로그30일·4주 기준 사본/2세대 보관은 제안이다. 현행 주간 증분/RPO7일·RTO24시간 목표·자동 부모 사본 삭제 없음은 유지한다.
5. **8주 홍보:** 한국어권19세 이상 모집·10→20명·주15–20시간·10/19 시작은 새 가정이며 현행 KR14/US13/TH13을 바꾸지 않는다. 지금 신규 제품 기능이나 홍보 발송을 착수하지 않는다.
6. **빠진 원문:** `research/dataflow_audit.md`, `research/legal.md`, 대화형 관리자 mock은 원본33파일에 없다. 실제 경로가 있는 주요 지적은 현재 소스로 대조했으며 나머지 누락 원문을 본 것처럼 표시하지 않는다.
7. **검증 분리:** 첨부의 renderer6개·브라우저9개·레이아웃 검수 PASS는 작성자 기록이다. 이 PC의 재실행 결과나 실제 메일/운영 PASS가 아니다.

## 5. 기존 작업판에 넣을 순서

**다음 하나: W09/W14의 부분 철회 후 신규 신고를 격리 DB에서 재현하고 최소 수정한다.** 신고 경로의 구체 불일치가 확인돼 사진 진단보다 먼저 제안한다. W06/W18의 기존 사진 로딩 원인 진단은 취소하지 않는다.

그다음 DF-02의 기존 후보와 운영 함수/영향 집계를 대조해 W17/D05/D06 적용 후보를 준비한다. 표시 라벨은 W15/W18의 작은 UI 수정으로 처리할 수 있다. 공급자 사실표·권리 요청 수기 절차·새 고정 문서와 회원 전환은 W14/W17/D04에 연결하고, 자동메일/홍보/새 기능은 별도 필요성이 확정될 때 이어간다.

첨부의4–8일·5–10일·8주를 확정 일정이나 법정 유예로 쓰지 않는다. DF-02는 기존 수정/테스트 증거가 있어 그 개발 시간을 다시 더하지 않는다. 계약 확인·정확한 원격 승인·실제 배포 대기는 코드 작업시간과 구분한다. 기존 주간 예약·독립키·기본 복구를 재실행 조건으로 되살리지 않는다.

## 6. 이번 완료 범위

- 읽음: 필수 시작/확정/PLANS·UGC/QA/변경통제·기존01/02/03, 첨부3개 및 내부 DOCX2개, 관련 소스·retention 증거·공식 법령/공급자 원문.
- 변경: 참고 텍스트/출처 해시 보존, 이 보고, 기존 운영 안내·계획·수용 경계·현재 작업 카드의 사실/우선순위. 고정 약관·앱·migration·workflow 변경0.
- 검증: 원본ZIP33개 entry/경로·크기·CRC, 참고 텍스트35개 해시 대조와 credential 패턴0, 제공 patch의 적용 가능성만 검사. 본문·비밀키·실제 사건 조회0.
- 한계: 운영 SQL 재현·현재 영향 집계·새 정책 전환·메일 발송·실기기 검사는 실행하지 않았다. 문서 링크/manifest/diff 최종 검사는 기존01 실행 보고에 기록한다.
- 복귀/다음 승인: 이번 문서 변경만 역적용 가능. 새로운 원격 migration·권리/정책·계정 제재·메일/예약·배포는 정확한 대상과 영향이 준비된 시점의 승인 범위를 따른다.
