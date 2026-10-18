# 첨부 법률 검토안의 서비스 고지 반영 — 2026-10-19

**로컬 구현·화면 검증 완료 / 운영 미배포.** 신고 수정981d13e의 운영 반영은 [별도 완료 보고](2026-10-19-partial-privacy-report-production-application.md)를 따른다. 이번 후보는 현재 약관·개인정보 페이지와 가입/계정 화면에 보충 안내를 연결한다. 과거 동의 원문, 가입 정책, 공개 revision을 바꾸지 않는다. 이 보고는 법률 적합성 전체를 인증하거나 새 운영 작업판을 만드는 문서가 아니다.

## 실행 8항 보고

1. **읽은 자료.** AGENTS, CODEX_START_HERE, 확정결정01, PLANS, QA07·변경통제09, 기존 release-v2/01·02·03, [10/18 인수보고](2026-10-18-pro-legal-operations-intake.md)와 [첨부 보존·출처](../references/legal-operations-review-20261018/README.md)를 읽었다. 법률 검토 DOCX의 보존 텍스트, Corrections A/B, 운영팩의 KO/EN 초안·미결38항을 사실/제안으로 분리했다. 실제 Terms/Privacy20261010, signupDocuments.js1–29행, SimpleSignup.jsx114–124행, AccountPrivacyPanel.jsx66–80행, privateImages/handler.js와 run-weekly-backup.mjs29–101행을 대조했다. 아래 공식 근거는10/19 재확인했다.

2. **가정과 미결.** 현재 KR14/US13/TH13·무료·일반 공개 범위를 유지한다. 첨부의 support90일/report180일/audit1년/backup4주 등의 제안, 자동메일·DMCA 등록·운영자 법적 실명/주소·미확정 공급자 계약을 확정 사실로 쓰지 않았다. 기존 법률 원문에 있는 조건부 다른 국가 설명은 국가 활성으로 취급하지 않는다. 정확한 실제 계약·처리국가·보관 종료 기준과 저작권 법정 수령인 정보는 여전히 D04 잔여다.

3. **계획과 변경 판단.** [기존 W17/D04·W14 ExecPlan](../release-v2/01_RELEASE_EXECUTION_PLAN.md#w17d04w14-법률-검토안-서비스-고지-반영--2026-10-19)을 실행했다. 이번은 확인된 실제 처리 설명과 권리 요청 안내의 보완이다. `20261010160000_publication_signup_connection.sql`15–23행은 최신 tuple receipt를 요구하며, `20260927042334_memory_general_postmoderation.sql`74–105행은 공개 revision 불일치 시 reader를 제한한다. 따라서 문안 보강만으로 이 값을 교체하지 않는다. 미래 실질 계약/처리 목적 변경은 별도의 버전 전환·필요 동의·기존회원 영향 후보로 다룬다.

4. **변경 파일.** `TermsCurrent.astro`는 기존 약관 본문을 보존하고 고정 원문과 보충 안내를 구별한다. `PrivacyCurrent.astro`는 Vercel 이미지 바이트 변환/중계, GitHub 임시 실행 중 암호화 전/복호 처리, Drive 암호문 보관, 주간 DB/이미지 증분 생성과 수동 세대 정리, 삭제 단계·실패/대기 범위를 본문에 반영한다. `ServiceOperationsNotice20261019.astro`와 날짜 경로는 KO/EN 공급자·백업·무계정 개인정보 요청·신고/이의·한국 임시조치·조건부 미국 긴급 삭제 절차를 제공한다. `/terms`, `/privacy`, `SimpleSignup.jsx`, `AccountPrivacyPanel.jsx`에서 연결하며 새 체크박스는 없다. 가입/계정 테스트2개 파일에는 구문서와 새 안내의 구별·링크·무변경 검사를 추가했다. 기존 운영 가이드는 실제 수동 접수·기한·통지·사본별 조치를 구체화했다.

5. **DB와 복귀.** 이번 법률 고지 후보의 DB/migration/환경/공개 정책/receipt 변경은0이다. 운영에 반영하려면 현재 master981d13e 위에 이 안내·검사·해당 문서만 담은 정확 후보를 승인받아 Git 배포한다. 승인된 신고 DB를 되돌릴 필요는 없다. 법률 고지 배포에 문제가 있으면 그 안내·진입 변경만 revert하고 고정 문서와 기존 수락 이력은 유지한다.

6. **검사 결과.** [증거 JSON](../release-v2/evidence/2026-10-19-legal-service-notices.json)에 원문/정책5파일의 LF SHA256 불변과 Terms 계약 본문 동일을 기록했다. `npm run build`34페이지 PASS, 최종 책임 설명 추가 문장은 Astro 컴파일 PASS. 격리 Chromium 관련4개 PASS: 과거/신규 receipt 구별, 계정→현재 개인정보→보충 안내→고정 원문 이동, 320/1440px overflow 없음, 기존 가입 한 체크/tuple 보존. 모의 backend 결과이며 실제 Google/운영 동의/긴급조치 성공이 아니다. 중간 build와 dev 검사를 병행한 실행은 hydration 빈 화면으로4개 실패했고, 코드 추가 수정 없이 단독 재실행4개가 통과했다. 공유 캐시 간섭 추정은 확정 원인으로 쓰지 않는다. [모바일 화면](../release-v2/evidence/2026-10-19-legal-notice-320.png), [PC 화면](../release-v2/evidence/2026-10-19-legal-notice-1440.png). 마지막 면책 제한 문장 추가는 이 스크린샷의 첫 화면 밖이며 최종 소스 컴파일과 localhost HTTP 본문으로 확인한다.

7. **개인정보·권리·운영.** 새 비밀값/회원자료/사진을 읽거나 전송하지 않았다. 이메일은 기존 공개 지원 주소이며 실제 발송0. 직접 제작을 제3자 권리 해결로 간주하지 않고 이용자에게 운영자 책임을 포괄 전가하지 않는다. 불필요한 인증정보/신분증·피해 성적 이미지 재첨부를 요구하지 않는다. TIDA 조건부48시간은 유효 요청 수신 시점부터이며 한국 인지 후 조치를 기다리게 하지 않는다. 한국 임시조치 최대30일은 자동 복원일/모든 신고 답변기한이 아니다. 수동 절차 문서와 실제 담당자의 접수/통지/사본 제거 완료는 구분한다.

8. **남은 위험·다음 게이트.** 다음 하나는 **이 법률 고지의 정확한 운영 후보 승인→Git 배포**다.10/11 사용자 지시의 정확 후보별 승인 경계를 유지한다. 운영자 표시/저작권 법정 수령인·반복 침해 계정 종료의 구체 기준/실행, 공급자별 국외이전 필수표와 계약 적용 범위·보유 종료 기준은 별도 최소 항목으로 마감해야 한다. 실제 긴급 메일 수신·기한 관리·양측 통지와 알려진 동일 사본 대응을 수행/검증한 것은 아니므로 ‘법적 준비 전체 완료’라고 쓰지 않는다. 새 인증·유료 전환·국가 축소나38개 일괄 질문을 선행 조건으로 만들지 않는다.

## 첨부 수정사항과 반영 범위

| 검토 항목 | 이번 반영 | 남은 조건 |
| --- | --- | --- |
| Vercel·GitHub 이미지/평문 처리 누락 | 현재 개인정보 본문과 상세 안내 반영 | 제공처별 실제 처리국가·기간/계약 표의 법정 완결 |
| 주간 백업 vs 세대 삭제 | 실행마다 DB 덤프·이미지 증분, 수동 정리와 지연 설명 | 실제 보관 종료 기준과 후속 수동 정리 |
| 삭제 사본/동기화 응답 | 30일이 모든 사본 삭제 보장 아님 설명 | DF-02 test-only 수정의 운영 대조·정확 후보 |
| 권리·이의·NCII | 무계정 메일, 최소 요청, 한국 임시조치/조건부 TIDA 명시 | 실제 통지/기한/사본 조치와 법정 저작권 수령인 공시 |
| 과도한 책임 전가 | 기존 제한적 이용허락/미성년 법정 권리 보존, 고의·중과실 면책 제한 | 포괄 면책을 새로 도입하지 않음 |
| 가입/공개 버전 | 고정 원문·receipt·정책 보존, 현재 안내 별도 노출 | 미래 실질 변경은 active bundle까지 함께 전환하는 별도 계약 |

## 공식 근거 — 2026-10-19 확인

- 국외이전은 체크박스 추가만으로 해결되지 않으며 실제 항목·수령인·국가·목적·보관/거절 안내를 갖춰야 한다. [개인정보보호법28조의8](https://law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1020398611).
- 공급자 계약은 개별 판단한다. [Supabase 약관](https://supabase.com/terms)과 [지역/지원/로그 FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq), [Vercel DPA 적용범위](https://vercel.com/legal/dpa), [소비자 Gmail/Drive는 DPA를 제공하지 않는다는 Google 공식 FAQ의 Enterprise customer requests & resources](https://support.google.com/policies/answer/9581826?hl=en). 소비자 Drive 사용만으로 위법/유료 필수라고 단정하지 않으며 Workspace 계약으로 오인하지 않는다.
- 한국 권리침해 임시조치·양측 통지·공시·30일 범위: [정보통신망법44조의2](https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029562697). 일반 저작권 문의와 [저작권법103조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029423165) 법정 중단/재개 절차를 동일시하지 않는다.
- 조건부 유효 NCII 요청 요건·48시간·알려진 동일 사본: [TAKE IT DOWN Act §3 원문](https://www.govinfo.gov/content/pkg/PLAW-119publ12/html/PLAW-119publ12.htm). 한국 적용 사업자의 인지 후 지체 없는 조치는 [전기통신사업법22조의5](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1029562969).
- 고의·중과실/부당 책임 전가 제한: [약관법7조](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025032399). 이용자가 자기 권리를 확인한다는 체크로 운영자의 모든 의무를 없애지 않는다.

이번 고지는 위 법령의 조건부 설명을 담은 구현이며, 특정 사건의 법적 판단이나 모든 지역의 요건 충족 증명은 아니다.
