# 09. 변경 통제와 보고 규칙

> **문서 상태: `CANONICAL GOVERNANCE`**
> Decision Log, ADR, ExecPlan, 검증·완료 보고를 구분하는 현행 작업 규칙이다.

## 1. 문서의 Source of Truth

- 제품 결정: `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- 구현 계획: 승인된 ExecPlan
- 현재 기술 사실: repository code/tests/config
- 데이터 수집 규칙: `04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- 이미지·UGC: `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`

## 2. Decision Log

새 결정을 만들거나 변경할 때:

```text
ID
status
context
options
chosen option
reason
consequences
files/modules affected
migration impact
review date/trigger
approved by/date
```

Codex가 제안한 결정은 `PROPOSED`로 작성한다. 사용자 승인 후 `CONFIRMED`로 변경한다.

## 3. ADR와 Decision Log 구분

- 제품·정책·범위: Decision Log.
- 기술 선택과 trade-off: ADR.
- 둘이 연결되면 상호 참조한다.

## 4. 변경 크기

### Small

- 한 모듈, schema 없음, behavior 제한.
- 간단한 task plan 가능.

### Medium

- 여러 파일, API 변화, feature flag.
- 짧은 ExecPlan 필요.

### Large

- DB migration, cross-client, provider replacement, UGC, security.
- 전체 ExecPlan과 승인 필수.

## 5. 커밋 원칙

- docs/decision 먼저.
- schema/migration과 application change를 추적 가능하게 분리.
- generated bulk data를 코드 변경과 같은 커밋에 섞지 않음.
- destructive cleanup은 cutover 검증 뒤 별도 커밋.

권장 예:

```text
docs: record catalog provenance decision
feat(catalog): add raw source and field claim schema
feat(catalog): add sample importer
migrate(catalog): mark legacy aliases unverified
```

## 6. Pull request / 변경 보고

필수 항목:

- why
- related decision/plan
- what changed
- screenshots/demo if UI
- schema/API
- tests
- migration/rollback
- feature flags
- analytics
- security/privacy/rights
- known limitations

## 7. 테스트 증거

단순히 “테스트 통과”라고 쓰지 않는다.

```text
Command:
Environment:
Result:
Coverage/scenario:
Failure or skipped reason:
```

## 8. 마이그레이션 보고

- before counts
- after counts
- unmatched/conflicts
- duration
- backup reference
- rollback result
- user-visible impact

## 9. 문서 갱신 조건

| 변경 | 갱신 문서 |
| --- | --- |
| 카드 필드·상태 | `01`, `02`, API/schema docs |
| catalog field/source | `04`, Source Registry |
| image state/public | `01`, `05`, policy |
| architecture | `06`, ADR, ExecPlan |
| event/KPI | `07`, event dictionary |
| phase/gate | `08`, gate checklist |

## 10. Codex 리뷰 규칙

리뷰 시 우선순위:

1. data loss/private exposure/security.
2. confirmed decision violations.
3. migration correctness.
4. offline/sync correctness.
5. report/delete propagation.
6. tests and observability.
7. maintainability/performance.
8. style.

각 finding은 severity, evidence, impact, fix path를 포함한다.
