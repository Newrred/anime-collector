# Sample100 의미 품질 보완 ExecPlan

> **계획 상태: `COMPLETE`**
> 승인일: 2026-08-18
> 적용 범위: 로컬 `sample100` TEST_ONLY 데이터의 병합·검토·오프라인 재가공
> 상위 계획: `docs/moemoa/plans/2026-08-17-three-source-local-catalog-lab.md`
> 전체 3,998개 수집 상태: `FULL-CATALOG-INGESTION-GATE-01` 미통과

> **후속 정책:** 이 문서의 26개 review backlog는 초기 보수 기준의 완료 증거다. 현재 운영 기준은 `2026-08-18-review-queue-minimization.md`가 대체하며, 낮은 위험 후보는 warning/자동 처리로 분리한다.

## 1. 목적과 사용자 결과

100개 실데이터에서 확인한 한국어 별칭 오염, 단일 공식 사이트 모델의 과도한 충돌, 필드별 누락과 구조 품질 게이트의 차이를 보완한다. 구현 후 사용자는 네트워크를 다시 호출하지 않고 저장된 `SourceRecord`로 claims·canonical·품질 보고서를 재생성하고, 서비스 노출 가능 값과 검토 대기 값을 구분해서 확인할 수 있다.

## 2. 관련 확정 결정

- `CATALOG-01/02`: 제한된 자체 카탈로그와 provenance를 유지한다.
- `LEGACY-01`: 기존 한국어 `ko`는 TEST_ONLY 기본 제목으로 보존하고 원본을 수정하지 않는다.
- `REPRESENTATIVE-100-INGESTION-01`: 변경·검증 범위는 이미 승인된 로컬 100개뿐이다.
- `FULL-CATALOG-INGESTION-GATE-01`: 이번 보완으로 자동 통과시키지 않는다.
- Source Registry의 AniList `PROHIBITED`, Wikidata `FIELD_REVIEW_REQUIRED`, 이미지 `PROHIBITED` 등급을 변경하지 않는다.

## 3. 현재 상태와 저장소 증거

- 외부 workspace `D:\hong\Web\Anime\MOEMOA_CATALOG_LAB_TEST`에 target/canonical/cover 각 100개와 AniList·Wikidata SourceRecord 각 100개가 있다.
- 구조·해시·이미지 quality gate는 통과했지만 공식 사이트는 `VALUE 70 / CONFLICTED 14 / SOURCE_NOT_AVAILABLE 16`, 제작사 95, core genre 98, 캐릭터·일본어 성우 98이다.
- canonical 한국어 제목은 100개 모두 존재하지만 17개에 복수 후보가 있고, `카노콘→카논`, `무한열차편 TVA→유곽 편`, `@장판`, `쵸파의` 같은 의미 품질 문제가 발견됐다.
- 공식 URL 충돌에는 HTTP/HTTPS, 언어별 경로, 제작사·방송사·스트리밍 링크가 함께 있어 단일 scalar 충돌로는 표현이 부정확하다.
- 현재 CLI에는 immutable raw를 네트워크 없이 다시 normalize/claim/canonical로 조립하는 명시적 `rebuild` 명령이 없다.

## 4. 범위

### 포함

- legacy `ko`를 유일한 자동 노출 한국어 대표 제목으로 유지한다.
- Wikidata 한국어 label/alias는 provenance와 검토 상태를 유지하되 자동 검색 별칭에서 격리한다.
- 이미 별도 수정으로 해결된 다중 AniList ID Wikidata identity 경계를 유지한다.
- 공식 링크를 정규화된 복수 후보와 역할/언어/검토 상태로 표현하고, 호환용 대표 URL을 결정론적으로 파생한다.
- 필드를 `REQUIRED / RECOMMENDED / OPTIONAL` 서비스 완성도 등급으로 보고한다.
- `VALUE / SOURCE_NOT_AVAILABLE / CONFLICTED`를 데이터 처리 성공과 서비스 완성도에서 분리한다.
- 저장된 SourceRecord만 사용한 `catalog:rebuild --profile golden|sample100`을 구현한다.
- 알려진 실데이터 문제를 합성 fixture 회귀 테스트로 고정한다.
- 기존 sample100을 오프라인 재가공하고 전후 품질을 비교한다.

### 제외

- 외부 네트워크 재수집, 100개 초과 실행, AniLife 재시도.
- 기존 raw·cover·canonical revision 삭제 또는 덮어쓰기.
- production DB, Web production, Android APK에 TEST_ONLY 데이터를 포함하는 작업.
- 한국어 성우 이름을 외부 소스에서 새로 수집하거나 자동 번역하는 작업.
- production core genre 어휘 확정 및 기존 `src/data/aliases.json` 수정.

## 5. 아키텍처·데이터 흐름

```text
stored SourceRecord + approved TargetRecord
→ source schema 재검증
→ normalize
→ exact identity 재검증
→ FieldClaim 재생성
→ immutable CanonicalAnime 재검증/재생성
→ 기존 CoverRecord 재검증 입력
→ 노출 정책(title/link/field tier)으로 ServiceProjection 파생
→ strict validation 후 current pointer 전환
→ semantic quality report
```

오프라인 rebuild는 raw payload를 신뢰해 직접 canonical을 쓰지 않고 기존 인증 경계를 그대로 다시 통과한다. 표지는 checksum이 검증된 기존 CoverRecord만 재사용하며 다운로드하지 않는다.

## 6. 변경 파일 지도

- `tools/catalog-lab/pipeline/service-projection.mjs`: canonical 증거를 바꾸지 않는 대표 제목·검색 제목·공식 링크·field tier 파생.
- `tools/catalog-lab/config/semantic-review-overrides.mjs`: 수정값을 추측하지 않는 알려진 수동 검토 항목.
- `tools/catalog-lab/pipeline/artifact-store.mjs`: ServiceProjection 저장과 staged canonical/current 전환, rebuild snapshot.
- `tools/catalog-lab/pipeline/runner.mjs`: 네트워크 없는 profile rebuild와 원자적 current 전환.
- `tools/catalog-lab/reports/quality-report.mjs`: 구조 gate와 서비스 completeness gate를 분리.
- `tools/catalog-lab/cli.mjs`, `package.json`: `rebuild` 명령과 안전 옵션.
- `tests/catalog-lab/service-projection.test.mjs`: 알려진 제목·링크·field tier 회귀.
- `tests/catalog-lab/runner-resume.test.mjs`, `tests/catalog-lab/runner-cli-report.test.mjs`: offline rebuild·보고서·무네트워크 회귀.
- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`: 승인된 sample100 의미 품질 결정 기록.
- `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`: 승인된 노출/검토/필수도 기준.
- 본 ExecPlan: 진행 기록과 완료 증거.

실제 조사 후 더 작은 파일 집합으로 끝나면 이 지도를 갱신한다.

## 7. 데이터·스키마 마이그레이션

프로덕션 DB migration은 없다. 기존 raw·claim·canonical·cover를 유지하고 외부 TEST_ONLY workspace에 `service-projections/*.json`과 `runs/<profile>/rebuild-current.json`만 추가한다. current pointer는 모든 대상의 재구성이 성공한 뒤 전환하고 전환 실패 시 이미 바꾼 pointer를 이전 hash로 복구한다.

## 8. 마일스톤

### Milestone 1 — 의미 품질 회귀 고정

- 잘못된 Wikidata 한국어 별칭이 대표/검색 별칭으로 자동 승격되지 않는 RED 테스트.
- 동일 도메인·언어 변형 공식 링크가 충돌 대신 복수 링크로 보존되는 RED 테스트.
- 다중 ID Wikidata entity의 비식별 필드가 review-only가 되는 RED 테스트.

상태: 완료. 다중 ID identity 문제는 선행 fix를 유지하고, 이번 범위에서는 한국어 격리·링크 후보·field tier·불완전 legacy 제목 회귀를 고정했다.

### Milestone 2 — 노출 정책과 completeness

- legacy 한국어 대표 제목 고정, source title 후보 분리.
- official links 역할/언어/정규화와 대표 URL 파생.
- 필수도 등급별 coverage와 검토 backlog 생성.

상태: 완료. canonical을 변경하지 않는 additive ServiceProjection으로 구현했다.

### Milestone 3 — Offline rebuild

- profile manifest와 저장 SourceRecord를 재인증한다.
- 네트워크 adapter와 downloader를 호출하지 않는다.
- 새 canonical revision을 만들고 전체 성공 후 current pointer를 전환한다.
- 같은 코드로 두 번 rebuild해 신규 claim/revision/image 증가가 없음을 확인한다.

상태: 완료. 두 번째 sample100 rebuild의 모든 growth가 0이며 network request는 0이다.

### Milestone 4 — Sample100 재검수

- 100개 구조 gate와 서비스 completeness 보고서를 생성한다.
- 잘못된 한국어 검색 별칭 0건, 대표 제목 100개 유지 여부를 확인한다.
- 공식 링크 conflict 감소와 review backlog를 기록한다.

상태: 완료. 구조 gate와 service gate 모두 PASS이며 상세 수치는 17절에 기록한다.

## 9. 테스트와 검증

- focused canonical/runner/CLI tests.
- `npm run catalog:test`.
- `npm run test:unit`.
- `npm run build`.
- `npm run catalog:guard`.
- 외부 workspace `catalog:rebuild --profile sample100`.
- `catalog:validate/report --profile sample100`.
- rebuild 전후 raw·cover count/checksum 불변, current hash와 revision 증가만 확인.
- 두 번째 동일 rebuild에서 claim/canonical/image 중복 성장 0 확인.

## 10. 보안·개인정보·권리 영향

- 네트워크를 호출하지 않고 사용자가 승인한 외부 TEST_ONLY workspace만 읽고 쓴다.
- raw payload와 cover bytes를 Git/build/APK/report attachment로 복사하지 않는다.
- AniList/legacy claim과 cover의 `PROHIBITED` 상태를 유지한다.
- 사용자 Memory Card, 개인 이미지, 검색어, 계정 데이터에는 접근하지 않는다.

## 11. 관찰 가능성·분석 이벤트

서비스 analytics는 추가하지 않는다. 로컬 report에 다음 집계만 추가한다.

```text
structuralGate
serviceReadiness
fieldTierCoverage
quarantinedTitleCount
officialLinkCandidateCount
officialLinkReviewCount
manualOverrideCount
rebuildInputRecordCount
rebuildReusedCoverCount
```

## 12. 롤백·복구

- tracked 변경은 단일 scoped commit revert로 복구한다.
- 외부 raw/cover/이전 canonical revision은 삭제하지 않는다.
- rebuild 실패 시 current pointer를 유지한다.
- rebuild 성공 후 문제 발견 시 저장해 둔 이전 pointer map으로 원자적으로 복구한다.

## 13. 위험과 완화

- **Wikidata 유용한 한국어 제목 과격리:** 후보는 삭제하지 않고 review-only evidence로 보존한다.
- **공식 링크 schema 호환성:** 기존 `officialSiteUrl`은 파생 필드로 유지하고 `officialLinks`를 additive로 추가한다.
- **rebuild 중 부분 전환:** 모든 대상 staging 검증 후 pointer를 일괄 전환하고 실패 시 원복한다.
- **품질 gate 과도한 엄격성:** 구조 무결성과 서비스 완성도를 별도 gate로 보고한다.
- **테스트 fixture와 실데이터 혼동:** 실제 payload는 외부 workspace에서만 검증하고 저장소에는 합성 fixture만 추가한다.

## 14. 필요한 사용자 결정

이번 범위는 사용자가 2026-08-18 승인한 권장 균형안을 구현한다. 다음은 여전히 별도 승인 대상이다.

- 3,998개 네트워크 수집.
- TEST_ONLY 결과의 production promotion.
- 누락 공식 사이트·제작사·성우를 위한 신규 외부 source 추가.
- 한국어 성우 이름 자동 번역 또는 별도 수집.

## 15. 진행 기록

```text
[2026-08-18] 완료: sample100 100개 AniList+Wikidata 수집, 구조 gate 통과, 의미 품질 분석.
[2026-08-18] 발견: 공식 URL 70/14/16, studio 95, character/casting 98, core genre 98, 잘못된 한국어 후보와 scalar link 모델 문제.
[2026-08-18] 승인: 사용자 권장 균형안 보완 진행.
[2026-08-18] 시작: 본 ExecPlan 작성, 네트워크 없는 semantic hardening 범위 고정.
[2026-08-18] RED: ServiceProjection 모듈 부재와 offline rebuild export 부재를 focused test로 확인.
[2026-08-18] GREEN: 제목·링크·field tier 4/4, runner 12/12, CLI/report 18/18.
[2026-08-18] 전체 회귀: catalog 170 pass / 0 fail / 기존 Windows 조건부 skip 1, unit 91/91, build 성공, guard no leaks.
[2026-08-18] 실데이터: sample100 offline rebuild, validate, report PASS. 네트워크 요청 0.
[2026-08-18] 멱등성: 두 번째 rebuild source/claim/canonical/image/projection growth 모두 0.
```

## 16. 발견 사항과 계획 변경

- canonical schema를 바꾸면 기존 증거 모델과 회귀 범위가 불필요하게 커진다. 따라서 대표 제목·검색 허용 제목·공식 링크·서비스 완성도는 별도 ServiceProjection으로 파생했다.
- 실제 100개에는 격리 대상 한국어 후보가 35개 있었다. 삭제하지 않고 projection의 review-only 후보로 보존했다.
- 공식 링크는 총 97개 후보이며 이 중 22개가 검토 대기다. 서로 다른 사이트를 임의로 대표 URL로 고르지 않았다.
- `ANILIST:204432`의 legacy 제목 `쵸파의`는 불완전하지만 정답을 추측하지 않고 수동 검토 사유만 등록했다.
- 재가공 전후 raw 200개, image 100개, cover observation 100개, current 100개, canonical 200개, claim 9,490개의 count와 tree digest가 동일했다.

## 17. 완료 보고

- 실제 변경 파일은 6절의 최종 파일 지도와 일치하며 본 ExecPlan과 함께 범위 커밋한다.
- sample100 결과: `READY 69`, `READY_WITH_REVIEW 26`, `READY_WITH_GAPS 5`, `BLOCKED 0`.
- 검토 backlog: 격리 한국어 제목 35개, 공식 링크 후보 97개 중 검토 대기 22개, 검토 대상 작품 26개.
- 권장 누락: studios 5개. 선택 누락/충돌: startDate conflict 7, officialLinks review 11/없음 16, relations 6, season 3, coreGenres 2, characters 2, castings 2.
- 첫 rebuild는 ServiceProjection 100개만 새로 생성했다. source/claim/canonical/image growth는 0이었다.
- 두 번째 rebuild는 ServiceProjection까지 포함한 모든 growth가 0이고 projection tree digest도 동일했다.
- raw/image/cover/current/canonical/claims tree digest는 rebuild 전후 모두 동일했다.
- `FULL-CATALOG-INGESTION-GATE-01`은 통과시키지 않았고 전체 3,998개 수집은 여전히 별도 승인 대상이다.
