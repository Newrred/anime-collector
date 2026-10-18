# DF-01 부분 비공개 후 신고 오류 — 운영 반영 완료

사용자가 승인한 **981d13e0eb7a60e6ce86838f821f71c84d1d518b**를 master Git과 운영 DB에 반영했다. 공개 카드 일부를 비공개로 바꾼 뒤에도 남은 공개 보드를 신고 대상으로 인정하는 함수 수정이다. **Git/Vercel 배포와 운영 함수·이력·권한 검증은 완료**했으며, 이번에 실제 사용자의 신규 신고를 만들거나 hosted 신고 화면을 조작하지는 않았다.

전체 단계와 해시는 [운영 적용 증거](../release-v2/evidence/2026-10-19-partial-privacy-report-production-application.json), 준비 범위는 [기존 후보 보고](2026-10-19-partial-privacy-report-production-candidate.md)를 따른다. W09/W14·C03/C05·Q12/Q17의 후속 기록이며 새 작업판이 아니다.

## 실행 8항 보고

1. **읽은 문서와 파일.** AGENTS, CODEX_START_HERE, 확정 결정01, 기존 release-v2/01의 「DF-01 승인 후보 운영 실행」, 수용 계약02와 단일 작업판03, QA07·변경 통제09, 승인 후보 보고와 로컬/test 증거를 대조했다. 승인된 [migration](../../../supabase/migrations/20261018090000_memory_report_partial_privacy.sql) 1–30행, [운영 실행 도구](../../../tools/publication-boundary/apply-partial-privacy-report-production.py) 176–235행, 기존 quality workflow, 실제 CI·GitHub 배포·live build-info·운영 적용/readback 출력을 확인했다.

2. **승인과 미검증 범위.** 사용자가 「후보981d13e 운영 적용 승인. 문서대로 push·배포·DB 반영」을 승인했다. 대상은 정확한 13파일 후보와 운영 신고 함수1개·migration 이력1건이다. 새 신고행 생성, 정책·공개 범위·가입·한도·권한 변경은 포함하지 않았다. 로컬 SQL의 실제 행동 회귀, 원격 CI의 격리 검사, hosted 운영 metadata 검증을 구분한다. 실제 hosted 신고 UI 성공은 이번 완료 근거에 포함하지 않는다.

3. **계획과 순서.** [기존 ExecPlan](../release-v2/01_RELEASE_EXECUTION_PLAN.md#w09w14-df-01-승인-후보-운영-실행--2026-10-19)의 후보 branch→정확 SHA CI 두 job 성공→master fast-forward→Vercel Git/운영 alias/live 확인→운영 함수 적용·별도 readback 순서로 완료했다. 검증했던 후보를 변경하거나 개발 브랜치를 통째로 병합하지 않았다. 같은 승인에 대한 재확인도 요구하지 않았다.

4. **반영 파일과 배포.** 후보의 SQL/회귀4파일은 검증 소스 `a6a63b6`와 byte-identical이며, 운영 실행 도구1개와 문서·증거8개가 함께 반영됐다. UI/API/의존성/CI workflow 차이는 없다. master는 `a65f557`에서 `981d13e`로 fast-forward됐다. GitHub Production deployment **7157184549**와 Vercel **dpl_7LYZRTeLmZ6PZJzGJt9qtRNcQN4K**가 성공했고, 실행 담당자의 Vercel 브라우저 관찰에서 READY·Production·www.moemoa.xyz Current를 확인했다. [운영 build-info](https://www.moemoa.xyz/build-info.json)의 commit/checkoutCommit은 모두 승인 SHA, source는 `vercel-git`, semanticMatch는 true다. workingTreeDirty=true도 관측값 그대로 보존하며 깨끗한 작업 트리 빌드였다고 주장하지 않는다.

5. **DB와 복귀.** 운영 `okchpyagfucpzpyrfgol`에서 migration **20261018090000**, release **MOEMOA_DF01_REPORT_PROD_20261019_01**로 `public.submit_memory_report(text,uuid,text,uuid,text)`와 정확 이력1건을 단일 transaction으로 반영했다. SQL SHA256은 `145ecdefac5dfc0435e4ef16fc1e3b6ae1354e1e128152c7d7e0af1ce1c51161`이며 이력의 sourceCommit은 승인 SHA다. 적용 직전 원본은 ignored `.cache/df01-production-20261018T161327082881Z-rollback.sql`과 동명 JSON에 보존했다. 원본 정의 SHA256은 `eede81fc8e11861bde71af4f7996865d76d8e7ce5a5f6790d13903f6587ed15a`. 실제 복귀는 실행하지 않았다. commit 전 오류는 원자적으로 rollback하며, commit 후 역변경은 현재 함수와 exact release 이력을 다시 확인한 정확 범위로 진행해야 한다. Git revert만으로 DB 함수가 복원되지는 않는다.

6. **검사와 실제 결과.** [Service quality 39142736022](https://github.com/Newrred/anime-collector/actions/runs/39142736022)가 승인 SHA에서 `publication-contract`와 `verify` 모두 completed/success로 끝났다. 새 신고 경계를 포함하는 `run-local-postgres.sh`, `run-public-signup-local.sh` 단계도 성공했다. 기존 실패 시에만 실행되는 artifact 단계의 skipped는 정상이며 검사 누락이 아니다. 정확 checkout에서 `python3 tools/publication-boundary/apply-partial-privacy-report-production.py --apply --expected-commit 981d13e0eb7a60e6ce86838f821f71c84d1d518b` 실행 후 **10/19 01:13:29 JST/KST**에 `APPLIED_AND_READ_BACK/CANDIDATE_PRESENT`를 얻었다. 이어 `--expected-commit`만 지정한 독립 read-only 실행에서 **01:13:39**에 같은 상태와 이력을 재확인했다. 함수 body는 `724a91fd…b8cf1`에서 `b7b58512…a7641`로 바뀌었고 metadata·설정·다른 함수·기존 migration 이력의 지문은 모두 보존됐다. master push가 다시 시작한 동일 SHA의 중복 CI 39143904413은 16:12:50 UTC 관측 당시 verify 진행 중이었지만, 배포 전 승인 SHA 전체 CI가 이미 통과한 사실과 혼동하지 않는다.

7. **보안·개인정보·권리·관측.** 기존 운영 연결과 verify-full TLS를 재사용했다. 함수 OID/owner/ACL·인자/default·SECURITY DEFINER·빈 search_path가 보존되었고 authenticated 실행 허용 및 anon/PUBLIC 실행 거절을 확인했다. 테이블/사용자 기록·신고행·사진·원본·flags·권리정책·국가·가입·한도 변경은 없다. 비밀값이나 원시 DB 오류, 사용자 본문을 증거에 넣지 않았다. 이번 출력은 함수/ledger metadata와 해시이며 실제 신고 사용자 경험을 대신하는 증거로 확대하지 않는다.

8. **남은 위험과 다음 작업.** 승인된 DF-01 운영 코드 배포와 함수 반영은 닫는다. 별도 실제 hosted 신규 신고/브라우저 검사는 미실행으로 남긴다. 비협조적 동시 DDL을 release advisory lock만으로 막을 수 없으며, 향후 불확실 결과는 재실행 전에 함수/이력 읽기부터 확인한다. DF-02·개인 사진·다른 법적/운영 잔여는 이번 결과로 완료 처리하지 않는다. 다음 작업은 현재 [단일 작업판](../release-v2/03_RELEASE_WORKBOARD.md#현재-작업-카드--새-파일-대신-이-위치를-갱신)의 사용자 승인 법률 검토안 서비스 고지 반영을 이어가며, 신고 배포 승인이나 완료 검사를 다시 요구하지 않는다.

독립 검토자는 저장된 실행 출력과 후보 blob·로컬 origin/master를 대조해 모순이나 차단 사항을 발견하지 않았다. 검토 과정에서 원격 접속·비밀파일 읽기·추가 테스트·운영 쓰기를 실행하지 않았다.
