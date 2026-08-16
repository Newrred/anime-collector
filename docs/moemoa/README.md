# MOEMOA 문서 인덱스와 Source of Truth

- 기준일: 2026-08-17
- 현재 단계: **로컬 카탈로그 랩 10→100 표본 ExecPlan 작성 완료 → 사용자 계획 검토와 실행 방식 선택 대기**. Web-first Shared UI 설계는 승인 상태로 대기한다.

이 파일은 문서를 찾기 위한 인덱스다. 제품 결정을 새로 만들지 않으며, 내용이 충돌할 때는 아래 source hierarchy를 따른다.

빠른 링크: [확정 결정](01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md) · [첫 Slice 승인 기록](decisions/2026-08-12-first-private-slice-approval.md) · [Web-first UI 결정](decisions/2026-08-16-web-first-shared-ui-readiness.md) · [Web-first UI 설계](../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md) · [로컬 카탈로그 랩 설계](../superpowers/specs/2026-08-17-three-source-local-catalog-lab-design.md) · [로컬 카탈로그 랩 ExecPlan](plans/2026-08-17-three-source-local-catalog-lab.md) · [상세 아키텍처](reports/architecture-decision-proposal.md) · [첫 Slice ExecPlan](plans/first-private-vertical-slice.md) · [ADR-0002](adr/0002-memory-local-domain-and-owner-boundary.md) · [ADR-0003](adr/0003-android-image-intake-spike-toolchain.md) · [테스트 증거](reports/private-slice-test-evidence.md) · [단계 runbook](08_CODEX_PHASE_RUNBOOK.md)

## 1. 먼저 읽을 것

```text
AGENTS.md
→ CODEX_START_HERE.md
→ docs/moemoa/README.md
→ docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md
→ 작업별 02~09 문서와 감사 보고서
```

현재 구현을 파악하려면 다음 순서로 읽는다.

```text
README.md                         // 현재 legacy Web/PWA 실행 설명
reports/repository-audit.md       // 2026-08-11 재검증 결과
reports/implementation-gap-analysis.md
reports/architecture-options.md
reports/open-decision-questions.md
```

## 2. Source hierarchy

| 우선순위 | 자료 | 의미 |
| ---: | --- | --- |
| 1 | `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | 현재 확정 제품 결정과 금지/승인 gate |
| 2 | 실제 repository code, tests, config, migration | 현재 구현 상태의 최종 기술 사실 |
| 3 | `reports/repository-audit.md` | 2026-08-11 시점의 증거 기반 기술 snapshot. 코드 변경 시 다시 검증 |
| 4 | 승인된 `decisions/`, `adr/`, `plans/`, 현행 `docs/superpowers/specs/` | 해당 범위의 결정·기술 경계·실행 계획·설계 명세. `01`을 변경할 수 없음 |
| 5 | `02`~`09` | 제품 흐름, 도메인, 안전, QA, 작업 protocol의 `CURRENT/GATED` 혼합 명세. 개별 상태표 확인 |
| 6 | `reports/implementation-gap-analysis.md` | 확정 결정과 코드 사이의 Gap 분석과 권장 단계안. 승인된 ExecPlan은 아님 |
| 7 | `reports/architecture-options.md`, `reports/open-decision-questions.md` | 기반 결정의 비교 이력과 아직 승인 전인 선택지를 함께 포함. 확정값은 항상 `01`/Decision Log에서 확인 |
| 8 | `references/` | 리서치 배경과 과거 방향 기록 |
| 9 | `docs/product/`, `docs/superpowers/`의 legacy 항목, 배포용 단일본/Word | legacy 또는 frozen snapshot. 단, `docs/superpowers/README.md`에서 현행 승인 설계로 분류한 문서는 우선순위 4를 따름 |

상위 자료와 하위 자료가 충돌하면 상위 자료를 우선한다. 코드와 확정 제품 결정이 충돌하면 코드를 사실로, 결정 문서를 목표로 기록하고 임의로 둘을 합치지 않는다.

## 3. 문서 상태 용어

| 상태 | 의미 |
| --- | --- |
| `CANONICAL` | 현재 제품 결정의 기준 |
| `CURRENT` | 현재 작업에 적용되는 명세·protocol |
| `CURRENT_RUNTIME` | 현재 실행 중인 legacy 코드 설명. 미래 제품 방향은 아님 |
| `EVIDENCE_SNAPSHOT` | 특정 commit/날짜를 감사한 결과. 코드 변경 시 갱신 필요 |
| `ANALYSIS` | 현재 증거를 해석한 Gap·권장안. 실행 순서는 사용자 승인과 ExecPlan 필요 |
| `PROPOSAL` | 승인 전 옵션·권장안 |
| `MIXED` | 확정 이력과 미정 제안이 함께 있음. 각 ID의 상태와 Decision Log 확인 |
| `GATED` | 준비 문서이지만 선행 결정/안전 gate 전 실행 금지 |
| `REFERENCE` | 배경·리서치·역사 기록 |
| `DUPLICATE_RAW` | 더 나은 canonical 복제본이 있는 손상·원시 중복본. 실행 기준에서 제외 |
| `COMPLETED_LEGACY_PLAN` | 현재 runtime을 만든 완료 이력. 신규 계획으로 재실행 금지 |
| `SUPERSEDED` | 최신 문서가 대체. 충돌 시 사용 금지 |
| `FROZEN_SNAPSHOT` | 배포·인수인계용 복제본. 원본 문서가 우선 |

파일 banner의 `CURRENT_CONTEXT`, `CURRENT_RUNTIME_ONLY`, `SUPERSEDED_REFERENCE`, `REFERENCE_MIRROR` 같은 표현은 위 기본 상태에 범위를 좁히는 qualifier를 붙인 것이다. 새로운 우선순위를 만들지 않으며, 이 index의 기본 상태와 역할 설명을 함께 따른다.

## 4. 현행 핵심 문서

| 문서 | 상태 | 역할 |
| --- | --- | --- |
| `00_SESSION_HANDOFF_AND_CONTEXT.md` | `CURRENT` | 제품 맥락과 금지 방향 |
| `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | `CANONICAL` | 확정 결정, 미정 gate, Public 제한 |
| `02_PRODUCT_SCOPE_AND_USER_FLOWS.md` | `CURRENT` | P0 범위, Card/Archive/Board/Android 흐름 |
| `03_REPOSITORY_AUDIT_PROTOCOL.md` | `CURRENT` | 감사 방법. 최초 감사는 완료됐지만 재감사에 재사용 |
| `04_CATALOG_DATA_AND_INGESTION_SPEC.md` | `GATED` | Source Registry와 표본 ingestion 기준 |
| `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md` | `GATED` | 이미지 수명주기와 UGC 운영 gate |
| `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md` | `CURRENT_GATED` | 승인된 첫 slice 구조와 전체 P0 제약. backend/auth/sync 등 후속 gate는 계속 미정 |
| `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md` | `CURRENT` | 테스트, privacy-safe analytics, 운영 기준. 베타 수치는 제안값 |
| `08_CODEX_PHASE_RUNBOOK.md` | `CURRENT_GATED` | 승인된 local-first 실행 순서와 단계별 gate. 첫 slice 내부 Web-first UI 순서 포함 |
| `09_CHANGE_CONTROL_AND_REPORTING.md` | `CURRENT` | Decision Log, ADR, 변경·테스트 보고 규칙 |
| `../superpowers/specs/2026-08-17-three-source-local-catalog-lab-design.md` | `CURRENT_APPROVED_DESIGN_GATED` | 3,998개 target roster 기반 세 출처 로컬 10→100 표본 수집 설계. 전체 수집과 production 발행은 별도 gate |
| `plans/2026-08-17-three-source-local-catalog-lab.md` | `DRAFT_EXECPLAN_FOR_REVIEW` | 위 설계를 Task 1~10의 TDD 구현·검증·롤백 단위로 변환. 사용자 실행 방식 선택 전 코드 작업 금지 |

## 5. 저장소 감사 산출물

| 문서 | 상태 | 사용 방법 |
| --- | --- | --- |
| `reports/repository-audit.md` | `EVIDENCE_SNAPSHOT` | `master@e71f211`, 2026-08-11 기준 현재 구현 사실 |
| `reports/implementation-gap-analysis.md` | `ANALYSIS` | legacy migration Gap과 권장 단계. 승인된 ADR/ExecPlan보다 우선하지 않음 |
| `reports/architecture-options.md` | `MIXED` | TECH-01 Capacitor 방향은 확정. BACKEND와 상세 architecture는 proposal |
| `reports/open-decision-questions.md` | `MIXED` | TECH/STORAGE/LEGACY 해결 이력과 BACKEND/AUTH/SYNC/이미지/운영 선택 queue |
| `reports/architecture-decision-proposal.md` | `APPROVED` | local-only Card/Archive의 상세 모듈, DB, native bridge, transaction 경계 |
| `plans/first-private-vertical-slice.md` | `APPROVED_IN_PROGRESS` | 구현 범위·마일스톤·검증·롤백 계획. Android 기반 구현 뒤 Web-first Shared UI Readiness가 현재 선행 gate |
| `reports/private-slice-test-evidence.md` | `IN_PROGRESS` | baseline, toolchain, TDD, Android 검증 증거 누적 |

첫 local-only slice의 기반 결정은 2026-08-11 확정됐다.

| ID | 확정 내용 |
| --- | --- |
| `TECH-01` | Astro/React + Capacitor Android shell |
| `STORAGE-LOCAL-01` | app-private filesystem + DB metadata |
| `LEGACY-01` | Library legacy state, WatchLog Draft seed, Tier read-only; 자동 Board 변환 없음 |

상세 기록: `decisions/2026-08-11-foundation-decisions.md`.

| 기록 | 상태 | 범위 |
| --- | --- | --- |
| `decisions/2026-08-11-foundation-decisions.md` | `CONFIRMED` | TECH/STORAGE/LEGACY 선택과 결과 |
| `decisions/2026-08-12-first-private-slice-approval.md` | `CONFIRMED` | Android local-only 첫 slice 범위와 후속 slice 분리 |
| `decisions/2026-08-16-web-first-shared-ui-readiness.md` | `CONFIRMED` | 첫 slice 내부에서 공용 UI를 Web로 먼저 검증한 뒤 Android에 적용하는 순서 |
| `adr/0001-capacitor-client-and-local-media-boundary.md` | `ACCEPTED` | Capacitor client와 app-private media의 논리 경계 |

BACKEND-01, AUTH-01, SYNC-01은 remote metadata sync 전에 결정할 수 있다. Public 관련 결정은 private 사용성·이미지 lifecycle 검증 뒤로 둔다.

AUTH-01을 보류해도 `ACCOUNT-01`을 지키기 위한 설치별 Guest Owner ID와 owner-scoped local namespace는 local slice에 필요하다. AUTH-01은 인증 공급자, guest→account 연결·승격, logout/account switch와 remote account schema를 차단한다.

## 6. Reference와 과거 문서

### docs/moemoa/references

| 문서 | 상태 | 비고 |
| --- | --- | --- |
| `references/2026-08-10-product-direction-research-integrated.md` | `REFERENCE` | 시장·경쟁·동남아·수익화·정책 배경. 현재 코드 사실이나 확정 결정이 아님 |
| `references/2026-08-06-product-direction-decision-draft.md` | `SUPERSEDED` | 최초 방향 초안. 선택지 역사만 참고하고 최신 01과 충돌하면 사용 금지 |

### docs/product

| 문서 | 상태 | 비고 |
| --- | --- | --- |
| `../product/MOEMOA_PRODUCT_BASELINE.md` | `SUPERSEDED` | 신규 01~09와 감사 보고서 이전의 통합 기준안. 아이디어·지표 배경만 참고 |
| `../product/2026-08-06-product-direction-decision-draft.md` | `SUPERSEDED` | 본문은 `references/`의 2026-08-06 자료를 복제한 legacy 경로이며 별도 상태 banner만 유지 |

`MOEMOA_PRODUCT_BASELINE.md`의 “자신이 최우선 기준” 선언, `title + memory signal` 중심 Complete 조건, Board `2~3개` 제안 등은 현재 기준이 아니다. 최신 기준은 VisualAsset 필수, 시스템 디자인 fallback, 카드 3개 후 Board 제안이다.

### docs/superpowers

세부 분류는 `../superpowers/README.md`를 따른다. 이 폴더는 더 이상 전부 legacy가 아니다.

- `specs/2026-08-16-web-first-shared-ui-readiness-design.md`: 현재 승인된 첫 slice UI 설계 기준
- product-readiness/round-2/round-3: 현재 legacy runtime이 만들어진 구현 이력
- media-rights/provider-safety: 일부 유효한 문제의식이 있으나 새 `04`/`05`/`06`이 대체한 legacy 계획
- SEA launch/monetization: 반복 사용 검증 전 집행하지 않는 superseded 출시안

위 현행 설계서 외 과거 계획을 현재 ExecPlan처럼 다시 실행하지 않는다.

### 현재 runtime 보조 문서와 원본 추출물

| 문서 | 상태 | 비고 |
| --- | --- | --- |
| `../UI_EDIT_GUIDE.md` | `CURRENT_RUNTIME` | legacy React/CSS 편집 가이드. 신규 제품 IA 기준은 아님 |
| `../design_spec_v1.extracted.clean.txt` | `REFERENCE` | 2026-03 legacy 설계의 정리된 역사 자료 |
| `../design_spec_v1.extracted.txt` | `DUPLICATE_RAW` | clean 파일과 같은 내용을 손상된 개행으로 담은 원시 추출물. 인덱스·실행 기준에서 제외 |

두 design-spec 파일은 이번 정리에서 삭제하지 않는다. 정리된 `clean` 파일만 역사 reference로 사용하고 raw 중복본 삭제는 별도 승인 대상으로 남긴다.

## 7. 배포·인수인계 artifact

| 경로 | 상태 | 비고 |
| --- | --- | --- |
| `/INSTALL_README_FIRST.md` | `REFERENCE` | 패키지 설치 안내. 현재 저장소에는 설치와 최초 감사가 완료됨 |
| `/PACKAGE_MANIFEST.md` | `CURRENT` | package 파일 inventory |
| `/MOEMOA_CODEX_BOOTSTRAP_PROMPT.md` | `REFERENCE` | `prompts/moemoa/01...`의 안내 mirror. 최초 감사 완료; canonical prompt를 먼저 편집 |
| `/MOEMOA_CODEX_HANDOFF_SINGLE_FILE.md` | `FROZEN_SNAPSHOT` | 00~09를 합친 audit 이전 단일 배포본. 원본 파일과 reports가 우선 |
| `/word/*.docx` | `FROZEN_SNAPSHOT` | 사람 전달용 audit 이전 문서. Markdown 원본과 이 index가 우선 |
| `/prompts/moemoa/01...` | `REFERENCE` | 완료된 최초 감사 prompt |
| `/prompts/moemoa/02...` | `COMPLETED_APPROVED` | 상세 architecture proposal/ExecPlan 승인 완료. 현재 상태는 actual ExecPlan을 따름 |
| `/prompts/moemoa/03...`, `/05...`, `/07...` | `GATED` | 각 phase의 승인 gate 이후 사용 |
| `/prompts/moemoa/04_PRIVATE_VERTICAL_SLICE.md` | `ACTIVE_VIA_EXECPLAN` | 첫 slice 승인 완료. 전체 prompt가 아니라 current ExecPlan milestone만 실행 |
| `/prompts/moemoa/06_CODE_REVIEW.md` | `CURRENT` | 실제 코드 변경의 반복 검토에 사용 |
| `/prompts/moemoa/README.md` | `CURRENT` | prompt별 완료·다음·gate 상태표 |
| `/templates/moemoa/*` | `CURRENT` | Decision/ExecPlan/Source/QA/UGC 기록 형식 |
| `/templates/moemoa/README.md` | `CURRENT` | 템플릿 용도와 실제 기록 저장 위치 |

## 8. 현재 구현과 미래 제품 문서를 구분하는 법

- root `README.md`는 지금 실행되는 Astro/React tracker/PWA를 설명한다.
- `01`/`02`/`06`은 앞으로 구현할 MOEMOA Memory Card 제품의 결정과 목표를 설명한다.
- `repository-audit.md`는 둘 사이의 실제 차이를 증거로 기록한다.
- `implementation-gap-analysis.md`는 non-destructive migration의 **권장** 순서를 설명한다. 아직 승인된 실행 순서는 아니다.
- legacy Tier를 새 Board로, WatchLog를 Complete Card로 자동 간주하지 않는다.
- 기존 Public profile/showcase/follow가 코드에 있어도 새 Public 기능 승인으로 간주하지 않는다.

## 9. 문서 갱신 규칙

- 제품 결정 변경: 먼저 `01`의 Decision Log/결정 상태를 사용자 승인과 함께 갱신
- 코드 구현 상태 변경: code/tests를 먼저 검증하고 `repository-audit` 또는 관련 report를 갱신
- Card/Archive/Board 흐름 변경: `02`, `06` 갱신
- catalog/source 변경: `04`와 Source Registry 갱신
- image/public 변경: `05`, `07`, UGC gate 갱신
- phase/approval 변경: `08`과 관련 ExecPlan 갱신
- 과거 문서: 사실 정정이 아니라 상태 banner와 새 기준 링크만 유지

## 10. 다음 작업

첫 slice와 `local-only Card/Archive → Board/Web → sync → private cloud → 제한 catalog` 순서는 승인됐다. Android native/local 기반과 emulator end-to-end 일부도 이미 구현·검증됐다. APK 사용성 피드백에 따라 현재 다음 순서는 아래와 같다.

1. `decisions/2026-08-16-web-first-shared-ui-readiness.md`와 현행 UI 설계서를 기준으로 삼는다.
2. 사용자가 설계 문서를 검토해 변경할 내용을 확정한다.
3. 검토 승인 뒤 별도 구현 계획을 작성한다.
4. Web 모바일·데스크톱 공용 UI gate를 통과시킨다.
5. 같은 UI를 Android에 적용해 safe-area·keyboard·back·native media를 실기기에서 검증한다.
6. export·전체 복구·feature flag·device matrix 등 첫 slice 잔여 항목을 마감한다.
7. 그 뒤 다음 승인 gate인 Private Board + Web read path로 이동한다.
