# 3,998개 로컬 배치 수집 코드 ExecPlan

> **계획 상태: `COMPLETE`**
> 승인일: 2026-08-18
> 실행 범위: 코드·모의 테스트만. 실제 네트워크 전체 수집은 이번 작업에서 실행하지 않는다.
> 권한 근거: 사용자 진술에 따라 2026-08-17 약 20:00 KST에 AniList로부터 로컬 테스트 저장 허가를 받음. 증빙 원문은 저장소 밖에서 사용자가 보관한다.

## 1. 목적과 사용자 결과

검증이 끝난 `sample100` 수집 경로를 바꾸지 않고, 기존 3,998개 목록을 최대 100개씩 순차 처리하는 재개 가능한 `full3998` 실행 코드를 추가한다. 한 번 중단되어도 이미 완료한 source-target과 표지는 다시 내려받지 않으며, 배치별 진행 상태를 외부 TEST_ONLY workspace에 남긴다.

## 2. 관련 확정 결정

- `CATALOG-01/02`, `LEGACY-01`, `SAMPLE100-SEMANTIC-HARDENING-01`의 provenance·legacy 한국어 제목·ServiceProjection 원칙을 유지한다.
- 2026-08-18 사용자 승인: 검증된 100개 수집기를 기반으로 3,998개를 100개 배치와 휴식으로 처리하는 코드를 구현한다.
- 2026-08-18 사용자 진술: AniList 로컬 테스트 저장 허가를 2026-08-17 약 20:00 KST에 받았다.
- 허가는 TEST_ONLY 로컬 저장으로만 해석한다. production 승격, Git/Vercel/APK 포함, 재배포, 상업 이용 권한으로 확대하지 않는다.

## 3. 현재 상태와 저장소 증거

- `tools/catalog-lab/pipeline/targets.mjs`는 `golden` 10개와 `sample100` 100개만 허용한다.
- `tools/catalog-lab/cli.mjs`의 `collect`는 한 profile manifest를 한 번에 runner로 전달한다.
- `tools/catalog-lab/pipeline/runner.mjs`는 source-target별 checkpoint와 기본 resume을 구현했지만 profile 전체와 batch 일부를 구분하지 않는다.
- `tools/catalog-lab/contracts/catalogContracts.mjs`와 Source Registry는 AniList를 `LOCAL_TEST_MAX_100`, 800ms로 제한한다.
- `src/data/aliases.json`은 고유 AniList ID와 한국어 제목을 가진 3,998개 row다.
- sample100 최종 결과는 100 canonical/cover/service projection, 수동 review 0, 두 번째 rebuild growth 0이다.

## 4. 범위

### 포함

- `full3998` immutable target manifest.
- 최대 100개 batch plan과 순차 실행 coordinator.
- batch 완료 직후 aggregate progress snapshot 저장.
- 기존 source-target checkpoint 기반 기본 resume.
- 실제 네트워크 작업이 없었던 완전 재개 batch의 휴식 생략.
- 실제 작업이 있었던 batch 사이마다 120~200초 범위에서 새로 뽑는 랜덤 휴식과 CLI 범위 검증.
- AniList 전체 로컬 테스트 허가 metadata와 최대 100개 batch 제한.
- AniList 요청 시작 간격을 매번 2.5~10초 범위에서 새로 뽑고 rate-limit response header가 요구하는 더 느린 하한을 우선 적용.
- source pause 발생 시 다음 batch로 진행하지 않는 fail-closed 동작.
- 코드·mock 기반 검증과 전체 회귀.

### 제외

- 실제 3,998개 네트워크 실행.
- AniLife 전체 수집, Wikidata 전체 scope 변경 또는 새로운 외부 source.
- production catalog 승격, 배포, cloud 업로드, Git에 수집 결과 포함.
- 외부 권한 증빙 원문·이메일 저장.

## 5. 아키텍처·데이터 흐름

```text
aliases.json 3,998 rows
→ immutable full3998 manifest + stable id-map
→ 100개 이하 deterministic batch plan
→ 기존 runCatalogPipeline(batch, approvedTargetCount=3998)
→ source-target checkpoint / raw / canonical / cover / projection
→ batch aggregate snapshot 저장
→ 실제 요청이 있었고 다음 batch가 있으면 120~200초 랜덤 휴식
→ SOURCE_PAUSED면 즉시 정지
→ 재실행 시 COMPLETED source-target과 저장된 cover 재사용
```

전체 profile 크기와 현재 batch 크기를 별도로 검증한다. `LOCAL_TEST_MAX_100` source는 100개 batch로 잘라도 전체 profile이 100개를 넘으면 거부한다. 사용자 진술 기반 별도 허가가 기록된 AniList만 `LOCAL_TEST_FULL_ROSTER_BATCHED` scope에서 전체 3,998개/배치 100개를 허용한다.

## 6. 변경 파일 지도

- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`: 코드 전용 승인과 실행 미포함 범위 기록.
- `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`: full3998 batch/resume/rate 규칙 기록.
- `docs/moemoa/plans/2026-08-18-full3998-batched-local-ingestion.md`: 본 ExecPlan과 진행 증거.
- `tools/catalog-lab/config/source-registry.json`: 사용자 진술 기반 AniList 로컬 테스트 허가 metadata와 보수적 속도.
- `tools/catalog-lab/contracts/catalogContracts.mjs`: 전체 profile/부분 batch scope를 함께 검증.
- `tools/catalog-lab/pipeline/targets.mjs`: full3998 manifest.
- `tools/catalog-lab/pipeline/batches.mjs`: 순차 batch coordinator와 aggregate snapshot.
- `tools/catalog-lab/pipeline/runner.mjs`: 승인 profile count와 batch count 분리, snapshot 위임, 동적 감속.
- `tools/catalog-lab/cli.mjs`: full3998 collect 옵션과 progress 출력.
- `tools/catalog-lab/reports/quality-report.mjs`: full3998 보고서 표기.
- 관련 `tests/catalog-lab/*.test.mjs`: target, registry, batching, CLI, limiter 회귀.

## 7. 데이터·스키마 마이그레이션

프로덕션 DB/schema migration은 없다. 외부 TEST_ONLY workspace에서 최초 `targets --profile full3998` 실행 시 기존 id-map의 100개 ID를 재사용하고 나머지 3,898개 ID를 추가한다. full manifest는 immutable하며, 잘못 생성되면 외부 workspace를 별도 보관 후 새 TEST_ONLY workspace에서 다시 생성한다.

## 8. 마일스톤

1. full3998 manifest와 source scope RED 회귀.
2. deterministic batch plan·pause·pause-stop·resume 판단 RED 회귀.
3. runner/CLI 최소 구현과 mock GREEN.
4. AniList 2.5~10초 랜덤 간격 및 response-header 감속 GREEN.
5. 전체 catalog/unit/build/guard 회귀와 문서 완료 기록.

## 9. 테스트와 검증

- full3998 3,998개·고유 target/ID·기존 ID map 재사용.
- 40개 batch, 앞 39개 100개, 마지막 98개, 누락·중복 없음.
- batch별 aggregate snapshot과 source pause 조기 종료.
- 완전 resume batch는 추가 batch pause를 만들지 않음.
- non-full source가 100개 batch로 전체 scope를 우회하지 못함.
- AniList는 full3998/100 batch 허용, 101 batch와 3,999 profile 거부.
- limiter의 2.5~10초 랜덤 시작 간격 경계값, 낮은 server limit와 remaining/reset header 반영.
- batch 휴식의 120~200초 랜덤 경계값과 테스트 난수 주입 재현성.
- `npm run catalog:test`, `npm run test:unit`, `npm run build`, `npm run catalog:guard`, `git diff --check`.
- 실제 AniList/Wikidata/AniLife/cover 네트워크 요청은 0.

## 10. 보안·개인정보·권리 영향

- 권한 증빙 원문·이메일·계정 정보는 저장하지 않고 사용자 진술의 최소 metadata만 기록한다.
- 수집 결과는 승인된 외부 TEST_ONLY workspace에만 저장한다.
- 보고서와 로그에는 raw payload, URL, 절대 workspace 경로를 기록하지 않는다.
- 권한 scope는 로컬 테스트 저장으로 제한하며 production/redistribution는 계속 금지한다.

## 11. 관찰 가능성·분석 이벤트

- batch index/count, 처리 target 수, 누적 canonical/cover 수, source state count, growth를 aggregate snapshot과 CLI 진행 줄로 남긴다.
- source pause가 있으면 해당 batch에서 중단했는지만 구조화해 남긴다.
- 외부 응답 본문·URL·제목은 progress log에 남기지 않는다.

## 12. 롤백·복구

- 코드 commit revert로 `full3998` 명령을 제거할 수 있다.
- sample100/golden manifest와 artifact는 다른 profile 경로이므로 영향을 받지 않는다.
- 중단 후 같은 명령을 다시 실행하면 기존 per-target checkpoint를 재사용한다.
- `--refresh`는 full3998에서 금지해 실수로 전체 재다운로드하지 못하게 한다.

## 13. 위험과 완화

- batch 분할로 기존 100개 제한을 우회: 전체 profile count를 source contract에 함께 전달해 허가 없는 source는 차단한다.
- API degraded limit: 2.5~10초 랜덤 간격과 response header 감속, 429 `Retry-After`, 120~200초 랜덤 batch 휴식을 함께 사용한다.
- 장시간 실행 중 중단: batch 직후 snapshot과 per-target checkpoint를 기록한다.
- 재실행 때 불필요한 장시간 휴식: 모든 source가 resumed인 batch는 batch 간 휴식을 생략한다.
- 권한 오해: user-attested local-test permission과 금지된 production/redistribution를 Registry에 분리한다.

## 14. 필요한 사용자 결정

- 코드 구현은 승인됐다.
- 실제 full3998 네트워크 실행은 이번 작업에 포함하지 않으며, 코드 검증 결과 확인 뒤 별도 실행한다.
- 권한 범위가 변경·철회되면 AniList full scope를 즉시 원래 100개 제한으로 되돌린다.

## 15. 진행 기록

```text
[2026-08-18] 사용자 승인: 검증된 sample100 기반 100개 batch 구조 코드 구현.
[2026-08-18] 권한 진술: 2026-08-17 약 20:00 KST AniList 로컬 테스트 저장 허가 획득, 증빙은 사용자 보관.
[2026-08-18] 범위 고정: 코드와 mock 검증만 수행하고 실제 전체 네트워크 실행은 제외.
[2026-08-18] RED: full3998 profile 부재와 기존 100개 source scope로 target/registry 회귀 2개 실패 확인.
[2026-08-18] GREEN: aliases 3,998개 순서·고유 ID·한국어 제목과 전체 profile/100개 batch 이중 범위 계약 통과.
[2026-08-18] RED→GREEN: batch module 부재, server rate header 미반영, runner의 부분 batch 거부, CLI batch 옵션 부재를 각각 회귀로 고정 후 구현.
[2026-08-18] 보강: 잘못된 target/result가 aggregate snapshot으로 들어가는 경계를 RED→GREEN으로 차단.
[2026-08-18] 전체 검증: catalog 182 pass / 0 fail / 기존 Windows skip 1, unit 91/91, build 성공, guard no leaks, syntax/diff check 통과.
[2026-08-18] 사용자 조정 승인: batch 간 휴식은 매번 120~200초, AniList 요청 간격은 매번 2.5~10초 범위에서 새로 선택한다. 실제 네트워크 실행 제외는 유지한다.
[2026-08-18] 조정 RED→GREEN: 고정 120초/2.5초와 새 CLI·Registry 계약 부재로 focused 6개 실패를 확인한 뒤, 최소·중간·최대 난수 경계와 resume 생략을 포함해 focused 55/55 통과.
[2026-08-18] 조정 후 전체 검증: catalog 183 pass / 0 fail / 기존 Windows skip 1, unit 91/91, build 성공, guard no leaks, syntax/diff check 통과.
```

## 16. 발견 사항과 계획 변경

- `sample100`의 source-target checkpoint는 profile과 무관한 target/source key이므로 full3998에서 동일 작품을 만나면 안전하게 재사용된다.
- 단순히 runner에 100개만 전달하면 기존 source scope를 우회할 수 있어, `approvedTargetCount=3998`와 실제 `targets.length<=100`을 동시에 검증하도록 계약을 분리했다.
- AniList 공식 rate-limit response는 다음 요청 전에 확인할 수 있으므로 wrapper가 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`을 관찰한다. 일반 구간은 2.5~10초 균등 정수 난수로 시작 간격을 선택하고, 서버가 10초보다 느린 하한을 요구하면 그 하한을 적용한다. 기존 HTTP 계층의 `Retry-After` 처리는 유지한다.
- production 난수는 `Math.random`을 사용하되 테스트에서는 난수 함수를 주입해 최소·중간·최대 경계와 resume 휴식 생략을 결정적으로 검증한다.
- aggregate snapshot은 batch 결과의 target 순서·identity·count가 승인 slice와 정확히 일치할 때만 기록한다.
- full3998에서 `--refresh`를 금지하고 기본 resume만 제공해 우발적인 전체 재다운로드를 막았다.

## 17. 완료 보고

- 목표 달성: `full3998` immutable manifest, 40개 기본 batch(39×100 + 1×98), batch별 120~200초 랜덤 휴식, resume-aware 휴식 생략, source-pause 조기 종료, aggregate snapshot, 2.5~10초 랜덤 AniList limiter를 구현했다.
- 기존 10개·100개 명령과 데이터 schema는 유지했다. 프로덕션 DB/data migration은 없다.
- 실제 AniList/Wikidata/AniLife/cover 네트워크 요청은 0이며 `D:\hong\Web\Anime\MOEMOA_CATALOG_LAB_TEST`의 기존 수집 데이터도 변경하지 않았다.
- 검증: Node v24.19.0에서 catalog 183 pass / 0 fail / 기존 Windows symlink 조건부 skip 1, unit 91/91, Astro build 11 pages 성공(기존 662.82kB chunk warning), catalog guard no leaks, syntax 및 `git diff --check` 통과.
- 권리 경계: user-attested permission metadata만 저장했고 증빙 원문은 사용자 보관이다. production 승격·재배포·상업 이용은 계속 금지한다.
- 남은 게이트: 실제 full3998 네트워크 실행, 완료 후 validate/report/rebuild 결과 검수, production source 권리 결정은 별도다.
