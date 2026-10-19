# DF-02 운영 적용·독립 확인 완료 — 2026-10-19

**완료:** 사용자 승인 source `724eaddb252db6ee00ba272f10ee5c6940151330`의 정확 CI 성공→master Git/Vercel READY/실제 www 동일 SHA→함수·migration 이력 적용→독립 readback을 완료했다. [본문 없는 검증 근거](../release-v2/evidence/2026-10-19-df02-production-application.json).

## 1. 읽은 근거
AGENTS/CODEX_START_HERE/확정 결정/PLANS, QA·변경 통제, 기존 W17/D05·D06 ExecPlan,
후보 보고·증거, 정확 적용기/조회기/기존 함수/후보 migration·합성 계약과 실제 운영 집계를 대조했다.
현재 Supabase 함수의 SECURITY DEFINER/search_path 지침과 changelog도 확인했으며 기존 ACL을 바꾸지 않았다.

## 2. 승인·가정·한계
사용자 “DF-02 후보 724eadd 운영 적용 승인. 문서 절차대로 검증하고 반영 진행”으로
정확 후보의 Git 배포·함수/ledger 적용을 승인했다. 수동 purge·cron 시간 변경은 범위에 없다.
부모 운영은3e1f9f3. 준비 당시와 적용 직전 함수·ACL·예약이 일치했다. 대상0은 미래에도0이라는 뜻이 아니다.
실제 hosted 정리 실행은 호출하지 않았고 기존 예약의 새 함수 실행 관찰은 다음 차례다.

## 3. 계획·실행 순서
기존 release-v2/01의 W17/D05·D06 계획에 이번 정확 승인을 기록했다. 후보 격리 checkout,
전체 exact CI·로컬15/7/26·prod/test 읽기 대조 후 master를 후보로 fast-forward push했다.
Vercel Production/READY/current www와 실제 build-info 일치를 확인한 뒤 적용기를 실행했다.
적용기는 자체 별도 연결 readback을 수행했고, 이후 별도 프로세스로 함수/예약과 ledger를 추가 확인했다.

## 4. 변경 파일·배포 소스
승인 후보는 부모3e1f9f3 대비 migration/운영 도구/검사6파일과 문서/근거11파일이다.
새 migration `20261019090000_memory_retention_response_cleanup.sql`은 이미 검증한 기존 후보 함수/ACL을 재사용한다.
이 PC에서 후보 소스를 수정하지 않았고, Git HEAD와 관련6개 파일 blob 일치를 적용 직전에 검사했다.
앱/API/가입·공개 설정·package/lock은 기존 운영과 동일하다. 완료 문서는 개발 branch에서 갱신해 운영 source는 승인 SHA로 유지한다.

## 5. DB·복귀
release `MOEMOA_DF02_RETENTION_RESPONSE_PROD_20261019_01`, migration `20261019090000`.
함수1개와 적용 이력1행을 같은 트랜잭션에서 반영했다. 함수/ACL/owner/search_path와 예약은 guard로 대조했고
실제 반환 자료에서도 metadata 지문이 동일하다. 수동 purge·operation 행/원본 변경은 수행하지 않았다.
기존 매일03:15 UTC(**12:15 KST**) 예약에서5종 owner entity가 실제 부재할 때만 remoteEntity 본문을 JSON null로 바꾼다.
활성/삭제대기 entity와 operation ID/hash/status/결과 영수증은 보존한다.
적용 직전 함수 정의/ACL은 ignored 로컬 복귀 사본에 보존했고 합성 복귀를 검증했다.
함수 복귀가 향후 정리된 본문을 되살리지는 않으며 operation 전체 삭제/전체 DB 복원으로 되돌리지 않는다.

## 6. 실제 검증 결과
- 정확 후보 CI **39151591067**, verify/publication-contract 두 job SUCCESS. 이 성공을 배포 gate로 사용했다.
- 이 PC의 격리 PostgreSQL16.15 SQL15·안전 단위7·동기화 engine26 PASS.
- 초기 PC에는 client만 있어 공식 Ubuntu16.15 서버 패키지를 임시 추출했다. 첫 local cluster의 OS 사용자 owner가
  운영 guard의 postgres와 달라 실패했으며, 새 합성 cluster의 superuser를 postgres로 설정해15개를 통과했다.
  외부 runner의 경로/cluster 계정만 맞췄고 후보 SQL·guard를 완화하거나 운영 source를 수정하지 않았다.
- Windows Git worktree는 WSL 경로를 명시한 GIT_DIR/GIT_WORK_TREE로 선택했으며 동일 후보 HEAD/6blob 검사를 통과했다.
- master Git→Vercel **dpl_J4RE2nQWFSxAa1GN6XaRAEwUKF81** Production READY/current www/source=git, SHA724eadd.
- 실제 build-info commit/checkoutCommit=724eadd, source=vercel-git, deploymentConfig.semanticMatch=true.
  generated config로 workingTreeDirty=true인 기존 특성을 깨끗한 build로 보고하지 않는다.
- 적용기 `APPLIED_AND_INDEPENDENTLY_READ_BACK`, 이후 별도 프로세스의 함수/예약 readback과
  ledger1행·이름/release/sourceCommit/정확 migration hash 일치 모두 PASS.
- 적용 전후 응답 본문50: 활성38·삭제대기12·고아0·알 수 없는 type0,30일 초과 entity5종0.
- 실제 /·/titles/·/minihome/·/terms/·/privacy/·10/19 보충 안내6 URL HTTP200.
- master push가 중복 실행한 같은 SHA CI39194782730은 별도 진행 상태로 기록하며 이미 성공한 gate와 구분한다.

## 7. 보안·권리·관측
server 환경/키/DB 암호/사용자 ID·본문·사진·cron 명령/오류 본문을 출력하거나 Git에 넣지 않았다.
TLS verify-full, 연결 대상 검증, 읽기 transaction/timeout, DDL 전 source/baseline guard를 유지했다.
익명/일반 계정 실행 권한은 false이고 기존 service-role 전용 권한·postgres owner가 그대로다.
기존 법률 고지/과거 동의/가입 범위/외부 백업·예약은 유지한다. 완료 JSON은 집계·지문·공개 배포 정보만 기록한다.

## 8. 잔여와 다음 확인
적용 후12:29 KST 독립 조회에서 최신 정리 성공은 **10/19 12:15 KST의 적용 전 실행**이다.
새 함수의 기존 예약 첫 예정 시각은 **10/20 12:15 KST**이며 실행 후 상태·대상/보존 집계를 읽기로 관찰한다.
이번에 예약을 추가하거나 수동 정리를 호출하지 않았다. 현재 대상0이므로 실제 hosted 본문 제거를 검증했다고 쓰지 않는다.
신규 승인 대기는 없으며 기능/권리/사진 진단·용량 라벨·전체 복구 등 기존 작업판 잔여는 별도로 유지한다.
