# MOEMOA Codex Handoff — 문서 패키지 목록

> **문서 상태: `CURRENT_INVENTORY` — 2026-08-16**
> 이 목록은 MOEMOA 작업 문서와 배포 artifact의 역할을 정리한다. 저장소 전체 파일 manifest가 아니며, 최신 상태·우선순위는 `docs/moemoa/README.md`가 설명한다.

## 1. 현행 진입점과 작업 규칙

- `AGENTS.md` — repository 작업 안전 규칙
- `CODEX_START_HERE.md` — 현재 phase와 읽기 순서
- `PLANS.md` — ExecPlan 작성 규격
- `PACKAGE_MANIFEST.md` — 이 inventory
- `docs/moemoa/README.md` — 전체 문서 상태와 source-of-truth 지도

## 2. 제품·기술·운영 기준 문서

- `docs/moemoa/00_SESSION_HANDOFF_AND_CONTEXT.md`
- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `docs/moemoa/03_REPOSITORY_AUDIT_PROTOCOL.md`
- `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- `docs/moemoa/05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- `docs/moemoa/06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `docs/moemoa/07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- `docs/moemoa/08_CODEX_PHASE_RUNBOOK.md`
- `docs/moemoa/09_CHANGE_CONTROL_AND_REPORTING.md`

`01`만 확정 제품 결정의 canonical source다. `04`, `05`, `06`, `08`의 실행은 각 gate와 Phase 2 승인을 따른다.

## 3. 저장소 감사와 계획

- `docs/moemoa/reports/repository-audit.md` — `master@e71f211` evidence snapshot
- `docs/moemoa/reports/implementation-gap-analysis.md` — Gap 분석과 권장 순서; 승인된 ExecPlan 아님
- `docs/moemoa/reports/architecture-options.md` — TECH-01 확정 이력과 backend/세부 architecture proposal
- `docs/moemoa/reports/open-decision-questions.md` — 사용자 decision queue
- `docs/moemoa/reports/architecture-decision-proposal.md` — 승인된 첫 local-only slice 상세 architecture
- `docs/moemoa/reports/private-slice-test-evidence.md` — first slice baseline/toolchain/TDD evidence
- `docs/moemoa/plans/2026-08-11-document-consolidation.md` — 이번 문서 정리 ExecPlan
- `docs/moemoa/plans/2026-08-11-foundation-decision-recording.md` — 기반 세 결정 기록 작업
- `docs/moemoa/plans/first-private-vertical-slice.md` — 승인된 첫 Private Vertical Slice 구현 계획; 현재 Web-first Shared UI Readiness 선행 gate
- `docs/moemoa/decisions/2026-08-11-foundation-decisions.md` — TECH/STORAGE/LEGACY 사용자 승인 기록
- `docs/moemoa/decisions/2026-08-12-first-private-slice-approval.md` — architecture/ExecPlan 사용자 승인 기록
- `docs/moemoa/decisions/2026-08-16-web-first-shared-ui-readiness.md` — 첫 slice 내부 Web→Android UI 검증 순서 승인 기록
- `docs/moemoa/adr/0001-capacitor-client-and-local-media-boundary.md` — accepted client/local media 기술 경계
- `docs/moemoa/adr/0002-memory-local-domain-and-owner-boundary.md` — accepted Memory/Guest Owner/local DB 경계
- `docs/moemoa/adr/0003-android-image-intake-spike-toolchain.md` — accepted-for-spike Android toolchain과 terminal gate 결과
- `docs/superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md` — 현재 승인된 공용 Memory UI 설계·품질 gate

승인된 후속 산출물 위치:

- `docs/moemoa/plans/` — 실행 ExecPlan
- `docs/moemoa/decisions/` — 실제 Decision Log. 첫 기록 생성 완료
- `docs/moemoa/adr/` — 승인된 Architecture Decision Record. ADR-0001 생성 완료

`decisions/`와 `adr/`에는 첫 기반 결정과 accepted ADR-0001이 기록됐다. 후속 backend/sync 세부는 별도 승인 시 추가한다.

## 4. Reference

- `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md`
- `docs/moemoa/references/2026-08-06-product-direction-decision-draft.md`

References는 제품·시장·정책 배경이며 현재 코드 사실이나 확정 결정이 아니다.

## 5. 단계별 프롬프트

- `prompts/moemoa/README.md` — prompt 상태와 실행 gate 인덱스
- `prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md` — 최초 감사 완료, 재감사용 reference
- `prompts/moemoa/02_ARCHITECTURE_AND_EXECPLAN.md` — architecture proposal/ExecPlan 작성·승인 완료 이력
- `prompts/moemoa/03_CATALOG_PIPELINE.md` — Source/ExecPlan gate 이후
- `prompts/moemoa/04_PRIVATE_VERTICAL_SLICE.md` — 기술·저장·legacy gate 이후
- `prompts/moemoa/05_UGC_IMPLEMENTATION.md` — cloud/UGC gate 이후
- `prompts/moemoa/06_CODE_REVIEW.md` — 반복 사용 가능
- `prompts/moemoa/07_RELEASE_READINESS.md` — release gate 이후

## 6. 기록 템플릿

- `templates/moemoa/README.md` — 템플릿 용도와 저장 위치 인덱스
- `templates/moemoa/DECISION_LOG_TEMPLATE.md`
- `templates/moemoa/EXEC_PLAN_TEMPLATE.md`
- `templates/moemoa/SOURCE_REGISTRY_TEMPLATE.md`
- `templates/moemoa/TASK_COMPLETION_REPORT_TEMPLATE.md`
- `templates/moemoa/TEST_EVIDENCE_TEMPLATE.md`
- `templates/moemoa/UGC_LAUNCH_GATE_TEMPLATE.md`

템플릿은 기록 형식이며 제품 결정 source가 아니다.

## 7. Legacy·compatibility 문서

- `README.md` — 현재 legacy Web/PWA runtime 설명
- `docs/UI_EDIT_GUIDE.md` — 현재 legacy UI 편집 가이드
- `docs/product/MOEMOA_PRODUCT_BASELINE.md` — `SUPERSEDED`
- `docs/product/2026-08-06-product-direction-decision-draft.md` — `SUPERSEDED_DUPLICATE`
- `docs/superpowers/README.md` — 현행 설계와 legacy plan을 구분하는 상태표
- `docs/superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md` — 현행 승인 설계
- 그 외 `docs/superpowers/plans/*`, `docs/superpowers/specs/*` — 완료 이력 또는 superseded 출시안
- `docs/design_spec_v1.extracted.clean.txt` — legacy design reference
- `docs/design_spec_v1.extracted.txt` — raw duplicate, 실행 기준에서 제외

## 8. 배포·인수인계 artifact

- `INSTALL_README_FIRST.md` — 설치용 distribution guide; 현재 저장소에는 설치·감사 완료
- `MOEMOA_CODEX_BOOTSTRAP_PROMPT.md` — `prompts/moemoa/01...`의 상태 안내를 덧붙인 root mirror
- `MOEMOA_CODEX_HANDOFF_SINGLE_FILE.md` — audit 이전 `FROZEN_SNAPSHOT`
- `word/MOEMOA_CODEX_01_HANDOFF_GUIDE.docx` — audit 이전 `FROZEN_SNAPSHOT`
- `word/MOEMOA_CODEX_02_IMPLEMENTATION_REFERENCE.docx` — audit 이전 `FROZEN_SNAPSHOT`

배포 artifact를 직접 수정해 최신 원본으로 만들지 않는다. Markdown canonical source를 갱신하고, 재생성 절차가 생긴 뒤 별도 snapshot으로 배포한다.
