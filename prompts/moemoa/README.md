# MOEMOA 단계별 prompt 상태

> **문서 상태: `CURRENT PROMPT INDEX`**
> Prompt는 해당 단계의 작업 입력일 뿐 제품 결정 source가 아니다. `docs/moemoa/README.md`, `01`, 승인된 Decision Log/ADR/ExecPlan이 우선한다.

| Prompt | 상태 | 실행 조건 |
| --- | --- | --- |
| `01_BOOTSTRAP_REPOSITORY_AUDIT.md` | `COMPLETED_REUSABLE` | 2026-08-11 최초 실행 완료. code/config/migration이 크게 바뀔 때 재감사 |
| `02_ARCHITECTURE_AND_EXECPLAN.md` | `COMPLETED_APPROVED` | 상세 architecture proposal과 first slice ExecPlan 승인 완료 |
| `03_CATALOG_PIPELINE.md` | `GATED` | `SOURCE-01`, Source Registry, 표본 ExecPlan 승인 뒤 |
| `04_PRIVATE_VERTICAL_SLICE.md` | `ACTIVE_VIA_EXECPLAN` | 승인된 `first-private-vertical-slice.md`의 현재 milestone만 실행. prompt 전체를 일괄 실행하지 않음 |
| `05_UGC_IMPLEMENTATION.md` | `GATED` | private lifecycle 검증과 UGC/rights gate 구현 범위 승인 뒤 |
| `06_CODE_REVIEW.md` | `CURRENT_REUSABLE` | 실제 코드 변경의 독립 검토가 필요할 때 |
| `07_RELEASE_READINESS.md` | `GATED` | 대상 release scope와 운영 gate가 정해진 뒤 |

`TECH-01`, `STORAGE-LOCAL-01`, `LEGACY-01`과 prompt 02 산출물은 승인됐다. Android toolchain/native-local 기반과 첫 Card/Archive 기능 흐름도 이미 구현됐다. prompt 04를 한 번에 실행하지 않고 `docs/moemoa/plans/first-private-vertical-slice.md`의 현재 milestone을 따른다. 2026-08-16 현재는 Web-first Shared UI Readiness 설계 검토 뒤 구현 계획을 작성하는 단계다.
