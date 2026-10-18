# DF-01 부분 비공개 후 신고 — 운영 반영 후보

상태: **후보 준비 / 운영 미반영**. 기존 W09/W14·C03/C05·Q12/Q17 작업이며 별도 작업판이 아니다. 이번 사용자 요청은 운영 읽기 대조와 후보 준비까지다. 정확 후보 SHA는 [기존 단일 작업판](../release-v2/03_RELEASE_WORKBOARD.md#현재-작업-카드--새-파일-대신-이-위치를-갱신)의 후속 기록을 따른다.

## 실제 운영 대조

- 2026-10-19 00:27 JST/KST(10-18 15:27 UTC) 운영 DB `okchpyagfucpzpyrfgol`을 read-only transaction으로 조회했다. 신고 함수는 재현 당시 원본과 동일하고 `20261018090000` 이력은 없다. 운영 사용자 신고 생성/사진/신고 본문을 읽지 않았다.
- 운영 prerequisite는 `20260923213901 / memory_moderation`, `20261011120000 / simple_card_sharing`. 테스트의 과거 적용시각 alias를 운영에 복사하지 않는다.
- authenticated EXECUTE 허용, anon/PUBLIC 거절, SECURITY DEFINER·빈 search_path·기존 인자/default 확인. 기존 ACL/owner를 유지해야 한다.
- 같은 조회 시점 원격 master와 [실제 build-info](https://www.moemoa.xyz/build-info.json)는 `a65f557e84659a0638ee44a8c4a911173dd554b2`, source `vercel-git`, checkoutCommit 일치, deploymentConfig.semanticMatch=true. workingTreeDirty=true도 그대로 기록하며 깨끗한 빌드였다고 바꾸지 않는다. 이번 Vercel 관리 API 재조회나 신규 배포 검증은 아니다.

## 최소 변경과 근거

1. **문서/파일:** AGENTS·CODEX_START_HERE·확정01·PLANS·QA07·변경09·기존 release01/02/03, moderation 원본43–65행, simple-card-sharing30–61행, test 적용 도구와 실제 인수 증거, 기존 quality workflow23/28행을 대조했다.
2. **가정/미확정:** 승인된 로컬/test 결과를 운영 성공으로 간주하지 않는다. 실제 hosted 신고 UI/신규 신고행 검사는 아직 없고, 이번 요청은 원격 쓰기/배포 승인이 아니다.
3. **계획:** [기존 ExecPlan의 2026-10-19 DF-01 절](../release-v2/01_RELEASE_EXECUTION_PLAN.md#w09w14-df-01-운영-대조후보-준비--2026-10-19). 개발 브랜치 전체 병합 대신 현재 master 기준에 아래 파일만 이식한다.
4. **변경:** 검증한 `a6a63b687a8f29d748ffa8047a17e6d9f5826ee6`의 migration1개·회귀3파일과 운영 실행 도구1개, 이 작업에 해당하는 문서/증거만 포함한다. UI/API/의존성/workflow 변경은 없다.
5. **DB/복귀:** `public.submit_memory_report(text,uuid,text,uuid,text)`의 board 판정만 바뀐다. 남아 있는 PUBLISHED/PREPARING 공개 snapshot을 신고 대상으로 인정하며 기존 published_operation 경로는 보존한다. 테이블/사용자행/권한/flags/가입/정책/한도 변경0. 적용 시 이력1건에 release `MOEMOA_DF01_REPORT_PROD_20261019_01`·실제 Git SHA·SQL SHA256을 저장한다.
6. **검증:** [로컬 실제 SQL 재현/회귀/복귀](../release-v2/evidence/2026-10-18-partial-privacy-report-fix.json)와 [승인된 test DB 적용/별도 readback](../release-v2/evidence/2026-10-18-partial-privacy-report-test-application.json)을 재사용한다. 네 코드 blob가 동일하므로 동일 행동 검사를 단순 반복하지 않는다. 새 운영 helper 로컬33항목 PASS: 잘못된 commit/대상/dirty source 거절, 기본읽기 무변경, transaction 중 실패시 함수/이력 rollback, 실제apply/독립readback/중복적용방지. Git subprocess·운영 metadata/settings는 명시 mock이며 실제 SQL은 격리 socket PostgreSQL16에서 실행했다. 운영 기본읽기도 15:32 UTC BASELINE_MATCH이고 독립 검토 차단지적0. [이번 증거](../release-v2/evidence/2026-10-19-partial-privacy-report-production-candidate.json). 원격 CI는 후보 적용 승인 후 실행할 잔여다.
7. **보안/개인정보/관측:** 운영 연결은 기존 target allowlist/verify-full TLS를 재사용한다. 키·원시 오류·사용자 본문은 로그/문서에 넣지 않는다. 신규 원격 신고·모더레이션·원본 전송·알림/예약·요금 변경0. 운영 사전 함수 정의는 ignored cache에 보존한다.
8. **남은 게이트:** 이 후보의 branch push/원격 CI→master Git 배포→함수 migration 실행·readback에 대한 정확 승인이 필요하다. 실패/불일치 시 다음 단계로 넘어가지 않는다. 이번 기록은 배포 완료 증거가 아니다.

### 이식 코드

| 파일 | 목적 |
|---|---|
| `supabase/migrations/20261018090000_memory_report_partial_privacy.sql` | 신규 신고 대상 판정1곳 보완; 기존 함수만 CREATE OR REPLACE |
| `tools/publication-boundary/partial-privacy-report-contract.sql` | 부분 비공개·재준비·숨김·마지막 카드 제거·권한/한도 경계 |
| `tools/publication-boundary/simple-card-sharing-contract.sql` | 기존 CI 경로에서 새 회귀 실행 |
| `tools/publication-boundary/moderation-contract.sql` | 기존 Board/home 일반 철회 후 신고 유지 |
| `tools/publication-boundary/apply-partial-privacy-report-production.py` | 기본 읽기, 명시 commit 고정/불일치 중단/원자적 적용/독립 readback |

SQL SHA256: `145ecdefac5dfc0435e4ef16fc1e3b6ae1354e1e128152c7d7e0af1ce1c51161`.

## 승인 후 실행 순서

1. 대상 후보 commit과 origin/master 기준을 다시 대조한다. master가 다른 변경으로 이동했으면 덮거나 강제 push하지 않고 새 후보를 대조한다. 관련 SQL/tool/connection helper가 커밋 원문과 달라졌으면 적용하지 않는다.
2. 후보 branch를 push하고 기존 **Service quality**를 workflow_dispatch로 해당 ref에 실행하거나 동일 SHA PR 검사로 확인한다. 새 `codex/*` branch push만으로 이 workflow가 실행되는 것은 아니다. `publication-contract`와 `verify` 두 job이 exact SHA로 성공해야 한다.
3. 승인 SHA를 master에 fast-forward하고 연결된 Vercel Git 배포의 READY/production alias와 live build-info(commit/checkoutCommit/source/semanticMatch)를 확인한다. 로컬 CLI 빌드 승격은 사용하지 않는다. Git push는 이 SQL을 DB에 자동 적용하지 않는다.
4. production helper를 기본 읽기로 실행해 baseline/ledger/ACL을 재조회한다. 준비된 old body와 다르거나 ledger가 예상과 다르면 중단한다. 운영 유지보수 작업 중 동일 함수 DDL을 겹쳐 실행하지 않는다.
5. 승인된 exact SHA checkout에서 `python3 tools/publication-boundary/apply-partial-privacy-report-production.py --apply --expected-commit <승인한 전체 SHA>`를 WSL로 실행한다. 기존 운영 env와 CA를 해당 실행 checkout에서만 사용하며 값은 출력/커밋하지 않는다. 함수1개와 이력1건을 한 transaction으로 적용하고 별도 연결에서 정의/ACL·설정/다른 함수/기존 이력 보존을 확인한다.
6. 읽기 모드에 같은 expected commit을 지정해 최종 상태를 확인하고 01/02/03에 실제 결과를 기록한다. 이 증거만으로 hosted 브라우저 신고 성공을 주장하지 않는다. 실제 신규 신고행을 만드는 검사는 별도 정확 범위로 다룬다.

## 중단·복귀

- 이번 실제 운영 원본: `.cache/df01-production-20261019-rollback.sql`, SHA256 `eede81fc8e11861bde71af4f7996865d76d8e7ce5a5f6790d13903f6587ed15a`. 함수 DDL만 있으며 비밀값·사용자행이 아니다. 다음 실행은 직전 원본도 별도로 보존한다.
- commit 전 guard/SQL 실패: 동일 transaction 전체 rollback. 기존 신고 함수와 ledger 유지.
- timeout/통신 단절/commit 후 readback 실패: 결과를 추정해서 재실행하지 말고 기본 read-only 검사로 함수와 exact release ledger를 먼저 대조한다.
- 이미 commit한 DB를 되돌릴 경우: 현재 new body/metadata와 해당 release/source/hash 이력이 그대로인지 재검사하고, 그 조건 안에서 보존한 old 함수만 복원한다. 이력 처리도 해당 version/release1건만 대상으로 한 복귀 계획에 명시한다. 사용자 신고행 삭제는 하지 않는다. 복귀는 오류 조건·영향을 보고한 뒤 정확 범위로 진행한다.
- Git revert는 배포 소스만 되돌리며 이미 적용한 DB 함수는 복원하지 않는다. 반대로 DB old 함수 복원은 기존 DF-01 오류도 다시 만든다는 점을 기록한다.
- 같은 함수에 비협조적 동시 DDL이 들어오는 상황까지 release advisory lock이 막아 주지는 않는다. 이 한계를 숨기지 않는다.
