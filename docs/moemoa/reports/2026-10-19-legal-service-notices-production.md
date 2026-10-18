# 법률 고지 승인 후보 운영 적용 — 2026-10-19

**운영 적용 완료.** 정확 후보 `3e1f9f3`의 원격 CI 두 job 성공 후 master를 fast-forward했고, Vercel Git Production의 READY·Current/www 연결과 실제 사이트의 동일 SHA를 확인했다. 운영 약관·개인정보·보충 안내 및 가입 화면 링크의 읽기 검증도 완료했다. DB·설정·동의 기록 변경은 없다.

사용자가 후보 `3e1f9f3553f9a03d22670ef2edbfe48f8914414b`에 **“이 후보 운영 적용 승인”**했다. 기존 구현·법률 검토와 로컬 검증은 [준비 보고](2026-10-19-legal-service-notices.md)를 따른다. 이 보고는 승인 후 실제 적용 결과를 기록하며, 새 작업판이나 전체 법적 적합성 인증을 만들지 않는다.

## 실행 8항 보고

1. **읽은 자료와 범위.** AGENTS, CODEX_START_HERE, 확정결정01, PLANS, 기존 release-v2/01·02·03, 법률 고지 준비 보고와 [보존된 첨부 출처](../references/legal-operations-review-20261018/README.md)를 기준으로 승인 범위를 대조했다. 직접 검사한 파일은 `SimpleSignup.jsx`, `AccountPrivacyPanel.jsx`, 현재·고정 약관/개인정보 컴포넌트, 보충 안내, 해당 페이지와 테스트2개다. 기존 신고 수정의 운영 완료는 [DF-01 보고](2026-10-19-partial-privacy-report-production-application.md)와 구분한다.

2. **가정·미결.** KR14/US13/TH13, 무료·기존 공개 범위와 가입 동의 방식을 유지한다. 이번 승인은 설명 보완과 연결 화면의 배포이며 새 처리 목적·동의 기록·국가 활성·유료 계약을 승인한 것으로 해석하지 않는다. 공급자별 실제 국외처리 정보·계약 범위·보관 종료 기준, 법정 저작권 수령인과 반복 침해 계정 종료 기준/실행은 미결로 남는다.

3. **계획·승인.** [기존 W17/D04·W14 ExecPlan](../release-v2/01_RELEASE_EXECUTION_PLAN.md#w17d04w14-법률-검토안-서비스-고지-반영--2026-10-19)의 승인된 순서로 진행했다. 후보 branch push → 정확 SHA Service quality 두 job 성공 → origin/master가981d13e임을 확인한 뒤 fast-forward → Vercel Git Production 및 실제 www SHA 대조 → 운영 약관·개인정보·보충 안내·가입 링크 읽기 확인을 마쳤다. 진행 결과는 기존 [단일 작업판](../release-v2/03_RELEASE_WORKBOARD.md)에 반영한다.

4. **변경 파일과 목적.** 후보는 부모 `981d13e0eb7a60e6ce86838f821f71c84d1d518b`에 **앱8·검사2·문서/검토 근거50파일**만 추가한다. `TermsCurrent.astro`는 기존 계약 본문과 보충 안내를 구별하고, `PrivacyCurrent.astro`와 `ServiceOperationsNotice20261019.astro`는 이미지 처리·백업·삭제·권리 요청의 실제 경계를 설명한다. 페이지3개와 가입/계정 컴포넌트2개가 이를 연결한다. 원본 첨부는 참고자료이며 샘플 스크립트·메일을 실행하지 않는다.

5. **DB·데이터와 복귀.** 이 후보의 DB migration·환경 설정·가입 tuple·공개 revision·수락 기록 변경은 **0**이다. 배포 실패 또는 고지 문제 시 고지·진입점의 앱8파일만 필요한 범위에서 되돌리는 Git revert 후보를 만들고, 같은 Git→Vercel 절차로 확인한다. 과거 수락 원문/기록과 이미 적용한 DF-01 신고 함수·migration 이력은 그대로 유지한다. master 이력 강제 변경, DB 원복 또는 개인정보 삭제는 복귀 수단으로 사용하지 않는다.

6. **검사·실행 결과.** 독립 정적 대조에서 후보의 앱/검사10개 Git blob가 로컬 검증 소스 `c285ca1dad9662f00494117c2f010a1a3264a375`와 모두 일치했다. 고정 Terms20261010·Privacy20261010, 가입 문서 매핑, 공개 정책·안내·고정 공개 페이지는 운영 부모와 blob가 동일하며, TermsCurrent의 계약 본문도 기존 원문과 동일하다. `git diff --check` 통과. 기존 로컬 build34페이지·관련 Chromium4개 PASS와 중간 실패/재실행 한계는 [로컬 증거](../release-v2/evidence/2026-10-19-legal-service-notices.json)에 보존한다. 실제 원격 CI39146108987 두 job SUCCESS, master/Vercel/www exact SHA 확인, 공개 HTTP7경로200 및 고정 문서3개의 원본 HTML SHA·본문 배포 전후 동일을 확인했다. 실제 브라우저에서 현재 약관 배너→KO/EN 보충 안내 이동, 정책을 불러온 가입 화면의 고정 약관/개인정보 링크·한 개의 미선택 체크박스·새 읽기 링크, 현재 처리 안내 링크가 새 탭의10/19 개인정보 페이지를 여는 동작을 확인했다. 가입 정보 입력·동의 선택·제출 없이 읽기만 진행했다. [운영 증거](../release-v2/evidence/2026-10-19-legal-service-notices-production.json)와 [운영 화면](../release-v2/evidence/2026-10-19-legal-notice-production.png)을 참조한다.

7. **보안·개인정보·권리·관측.** 새 인증정보·회원자료·사진이나 동의 기록을 생성/이동하지 않는다. 새 체크박스·메일 발송·분석 이벤트·Public flag 변경은 없다. 운영자 책임의 포괄 전가를 피하고, 조건부 한국 임시조치와 미국 TAKE IT DOWN Act 요청의 기한·사본 범위를 구별한다. 문구·링크 확인은 실제 신고 접수, 양측 통지, 알려진 동일 사본 삭제나 긴급 대응의 성공 증거가 아니다. 관측은 CI와 Vercel Git/실제 사이트 소스 일치 및 읽기 확인에 한정한다.

8. **남은 조건과 다음 행동.** 이 승인 후보의 운영 반영은 완료됐고 같은 범위의 추가 승인은 남아 있지 않다. 다음 하나는 **DF-02의 기존 test-only 동기화 재시도 응답 본문 정리를 운영과 읽기 전용으로 대조하고 필요한 최소 후보를 준비**하는 것이다. 실제 공급자 처리국가·보관 종료/계약 표, 법정 저작권 수령인, 반복 침해 계정 조치, 담당자의 긴급 메일 모니터링·통지·사본 대응은 D04 잔여로 유지한다. 실제 Google 가입, 로그인 계정의 수락 기록 화면, 긴급 신고 접수·조치는 이번에 검증하지 않았다. DF-02 운영 쓰기나 실질 정책 변경이 필요하면 그 정확한 새 후보만 별도 승인 경계로 다룬다.

## 실제 실행 기록

| 항목 | 확인된 상태 |
| --- | --- |
| 승인 후보 | `3e1f9f3553f9a03d22670ef2edbfe48f8914414b` |
| 후보 branch | `codex/legal-notices-20261019`, push 완료 |
| 기준 운영 master | `981d13e0eb7a60e6ce86838f821f71c84d1d518b`; 실제 반영 직전 원격값을 재확인 |
| 원격 CI | [Service quality 39146108987](https://github.com/Newrred/anime-collector/actions/runs/39146108987), `workflow_dispatch`, 정확 후보 SHA |
| CI 세부 | `verify`117730170387·`publication-contract`117730170616 모두 SUCCESS, master 반영 전 완료 |
| master 반영 | 위 기준에서 정확 후보3e1f9f3으로 fast-forward 완료; 강제 push 없음 |
| Vercel Git Production | [dpl_6Ekgdu8FUhcEQdsfXvZL7U31MYsP](https://vercel.com/newrreds-projects/anime-collector/6Ekgdu8FUhcEQdsfXvZL7U31MYsP), READY·Production·Current/www를 실제 브라우저에서 확인 |
| GitHub Production | deployment7157716192,16:56:35 UTC success, 생성 URL `anime-collector-3dqp7vdvd-newrreds-projects.vercel.app` |
| 실제 www 소스 | 16:57:02 UTC `/build-info.json`: commit/checkoutCommit 모두3e1f9f3 전체 SHA, source=`vercel-git`, semanticMatch=true |
| 빌드 메타데이터 | workingTreeDirty=true는 이전 배포와 같은 빌드 중 생성 설정에 따른 값; 숨기거나 clean으로 바꾸어 기록하지 않음 |
| 공개 HTTP |7경로200; 고정 Terms10/10·Privacy10/10·공개 안내10/11의 원본 HTML SHA와 텍스트 배포 전후 동일 |
| 실제 고지·가입 링크 | 현재 약관 배너→KO/EN 보충 안내, 가입 정책 로딩 완료 후 고정 수락 URL·미선택 체크1개·새 읽기 링크, 새 탭의 현재 개인정보10/19 안내 확인 |
| DB·설정 쓰기 | 이 작업 대상 아님, 변경0 |
| 미실행 범위 | 실제 Google 가입·로그인 수락 기록·동의 선택/제출·메일 발송·긴급 조치 없음 |

master push가 추가 실행한 [Service quality39147243120](https://github.com/Newrred/anime-collector/actions/runs/39147243120)은16:56:59 UTC 조회 시 진행 중이었다. 이는 같은 SHA에 대한 자동 중복 실행이며, master 반영 전에 통과시킨 필수 정확 후보 실행39146108987과 구분한다. 이 중복 실행을 완료했다고 주장하거나 기존 통과 결과와 합산하지 않는다.

이번 완료 범위는 승인된 고지 배포와 실제 읽기 동작이다. 법적 사실의 미결이나 실제 운영자의 사건 대응까지 완료한 것으로 확대하지 않는다.
