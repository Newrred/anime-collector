# DF-02 동기화 응답 본문 정리 · 운영 대조와 후보 — 2026-10-19

**운영 읽기 대조·로컬 후보 검증 완료. 운영 적용/수동 정리/배포는 미실행.** 정확 후보 SHA는 기존 단일 작업판의 현재 카드에 결속한다. [실제 집계와 지문](../release-v2/evidence/2026-10-19-df02-production-candidate.json).

## 실행 8항 보고

1. **읽은 자료/파일.** AGENTS, CODEX_START_HERE, 확정결정01, PLANS, QA07·변경통제09, 기존 release-v2/01~03, 10/18 법률/운영 인수보고와 10/10 retention 증거를 대조했다. `20260902054119_memory_user_functions.sql:120–219`의 저장/재생, `20260902054107_memory_user_schema.sql:363–364`의5종 제약, 기존 retention migration과 test 승인 SQL·검사·조회 도구를 확인했다. 원래 정리의30일 기준은 entity/변경 이력 기준이며 모든 operation의30일 TTL이 아니다.
2. **가정/미결.** 현재 운영은3e1f9f3이며 실제 원격 master/build-info와 일치한다. test는 기존 승인 함수 fingerprint가 일치하고 service-only ACL을 유지한다. test의 과거 base migration ledger는 없지만 실제 수정 함수는 존재한다. 이 차이를 이번에 이력 재작성으로 해결하지 않는다. 현재 대상0은 미래에도0이라는 뜻이 아니다.
3. **계획.** 기존 [W17/D05·D06 ExecPlan](../release-v2/01_RELEASE_EXECUTION_PLAN.md#w17d05d06-df-02-운영-대조와-최소-후보--2026-10-19)을 따른다. production/test 읽기→원본/승인 함수·ACL/예약/영향 대조→기존 SQL 본문 재사용→정확 적용 SQL/복귀를 격리 로컬에서 확인→운영 후보 인계.
4. **변경 파일.** 새 migration `20261019090000_memory_retention_response_cleanup.sql`은 ebdff44의 함수/ACL 본문을 그대로 재사용한다(헤더만 후보 설명). 새 readonly inspector는 함수 지문·권한·집계/예약만 출력하고 함수 정의는 복귀용 로컬 ignored cache에 보존한다. production executor는 기본 읽기, 명시 apply+정확 Git HEAD/파일 일치·기존 함수/권한/예약 확인 후 함수/ledger만 원자 반영하도록 준비했다. 안전 검사·합성 적용/복귀 fixture와 기존 local runner를 연결했다. 앱/가입/공개/사진/요금 변경0.
5. **DB/복귀.** 후보 version `20261019090000`, release `MOEMOA_DF02_RETENTION_RESPONSE_PROD_20261019_01`. 함수1개와 적용 이력1행이 대상이다. 수동 purge는 호출하지 않고 기존 매일03:15 UTC(12:15 JST/KST) 예약을 유지한다. 다음 예약부터 owner의5종 entity가 실제 사라졌을 때 `result_payload.remoteEntity`만 JSON null로 바꾸며 operation 행/ID/hash/status/나머지 결과는 보존한다. 실제 entity가 남은 활성/삭제대기 본문은 유지한다. 함수 정의를 복귀할 수 있지만 이미 정리된 본문은 함수 원복으로 되살릴 수 없다. 재시도 안전 때문에 operation 전체 삭제나 전체DB 복원은 복귀 수단이 아니다.
6. **검사/실측.** 10/19 **02:35~02:38 JST**의 운영 read-only에서 원본 함수 일치/후보 미적용, base ledger 존재, service-only/SECURITY DEFINER/빈 search_path·default 동일, 기존 예약 active/명령 일치와10/18 12:15 JST 최신 성공을 확인했다. 운영 응답 본문50개 중 활성 entity 연결38·삭제대기 entity 연결12·이미 부재한 entity 연결0,30일 초과 entity5종 모두0, 알 수 없는 type0이다. test도 승인 함수/같은 ACL, 고아 사본0을 확인했다. 로컬 PostgreSQL15항목(기존12+실제 executor DDL/ledger·권한·캡처 정의 복귀3), 안전 단위7, 동기화 engine26 PASS. 최초 복귀 fixture는 원본 CRLF를 LF 재구성해 exact body 비교에 실패했고, 실제 캡처한 pg_get_functiondef를 복귀하도록 고쳐15PASS했다. 그 실패는 로컬이며 운영 쓰기0이다. 실제 hosted purge·사용자 재시도·브라우저 PASS로 확대하지 않는다.
7. **개인정보/관측.** 사용자 본문·ID·사진·cron 명령/오류 내용은 출력/문서화하지 않았다. 대상 집계는 실제 본문 내용을 반환하지 않는다. verified TLS·read-only transaction·timeout으로 조회했다. 함수 정의는 내용별 SHA 파일로 보존해 후속 조회가 이전 복귀 정의를 덮지 않는다. 공급자/공개 정책·과거 약관 수락·법률 고지·외부 백업은 그대로다.
8. **남은 조건/다음 행동.** 이 후보의 정확 운영 적용 승인만 남는다. 승인 후 exact CI→master Git/Vercel 소스 확인→함수/ledger 적용과 독립 readback을 진행한다. 적용 직전 함수/ACL/예약·대상 수를 다시 읽고 다르면 중단한다. 초기 대상0이어도 이후 예약에서 본문 정리가 비가역적으로 이루어질 수 있으므로 그 영향을 승인 범위에 포함한다. 기존 test 승인과 직전 법률 고지 승인을 이 운영 쓰기 승인으로 재사용하지 않는다.

## 적용·복귀 실행 경계

- 적용 전: exact source checkout에서 readonly `tools/operations/apply-production-retention-response.py` 실행. 본문 지문 `1685c42612f6214296cf06258ab37e919244fbf11e5977701ce71f1e49a5ef9a`, metadata SHA `5c24cef493b342844aeeaef5a02468c8b2b86de072feb3ba2d017eb57818d8ae`, 기존 예약·이력 부재를 대조한다.
- 승인 후 실행: WSL에서 `python3 -B tools/operations/apply-production-retention-response.py --apply --expected-commit <정확 승인 전체 SHA>`. 키·주소를 명령에 넣지 않는다. 기존 로컬 server env와 CA를 사용한다. 다른 PC는 이 비밀 설정/CA가 필요하며 Git에는 포함하지 않는다.
- source 파일은 migration/실행기/조회기/연결기/기존 승인SQL/기존 retention migration의 Git blob와 모두 대조한다. DDL 결과·ACL·ledger를 확인하고 별도 연결로 함수/예약을 다시 읽는다. 불확실 결과는 apply 재시도 전에 기본 readonly부터 확인한다.
- 복귀 기준 정의는 ignored `.cache/operations-private/df02-production-function-a4cf15bedd98d8b9a91a28de90170e7ba4f3f9ddbcb81aad1abbc0de4aa8fb22.sql`에 보존했다. 적용 직전 정의가 달라졌으면 새 캡처를 검토한다. 복귀는 이 함수 정의와 기존 ACL의 복원 후보를 만들고 적용 이력을 정정하는 별도 명시 작업이다. 이미 null 처리된 본문을 복원한다고 약속하지 않는다.
- 신규 기능·국가/요금·이미지 공개 범위·cron 시간 변경, 수동 purge, 원본/보관 기록/operation 행 삭제는 이번 후보에 없다.

법률 고지 배포와 DF-01은 이미 운영 완료다. D04 사실표/법정 수령인, 사진 진단, quota 라벨 등 기존 잔여는 이 후보로 완료 처리하지 않는다.
