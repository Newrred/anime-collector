# 08. Codex 단계별 행동 지침

> **문서 상태: `CURRENT RUNBOOK / APPROVED LOCAL-FIRST ORDER`**
> Phase 0~2의 감사·제안·승인은 완료됐고 첫 Private Vertical Slice를 구현 중이다. Phase 3 이후 기존 번호는 audit 이전 작업 묶음이며 승인된 local-first 순서가 우선한다. 2026-08-16 첫 slice 내부에 Web-first Shared UI Readiness 단계를 추가 승인했다.

## Phase 0 — 문서 설치와 지침 충돌 확인

### 참고 문서

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`

### 행동

- 기존 저장소 지침을 찾는다.
- 패키지 지침과 충돌을 표로 만든다.
- 기존 빌드·테스트 명령은 보존한다.

### 산출물

- `reports/instruction-merge-report.md`

### 금지

- 코드 수정
- 기존 AGENTS 덮어쓰기

### 승인 게이트

- 지침 병합 확인

---

## Phase 1 — Repository Audit

### 참고 문서

- `03_REPOSITORY_AUDIT_PROTOCOL.md`
- `00_SESSION_HANDOFF_AND_CONTEXT.md`

### 행동

- read-only 조사.
- 앱·서버·데이터·이미지·인증·테스트 지도.
- 과거 상태 메모를 재검증.

### 산출물

- repository audit
- gap analysis
- architecture options
- open decisions

### 완료 조건

- 모든 핵심 주장에 repository evidence.
- 현재 실행 가능한 테스트 확인.

### 금지

- package install/upgrade
- migration
- mass format

### 다음 프롬프트

- `02_ARCHITECTURE_AND_EXECPLAN.md`

---

## Phase 2 — Architecture Decision and ExecPlan

현재 상태: **산출물 작성·사용자 승인 완료 / 첫 slice 구현 중.**

### 참고 문서

- 감사 결과
- `decisions/2026-08-11-foundation-decisions.md`
- `adr/0001-capacitor-client-and-local-media-boundary.md`
- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `PLANS.md`

### 행동

- 확정된 Astro/React + Capacitor 방향의 세부 architecture와 spike contract 작성.
- STORAGE-LOCAL-01과 LEGACY-01의 transaction/migration 경계 구체화.
- 첫 vertical slice ExecPlan.
- schema/API/migration/test/rollback 포함.

### 산출물

- `reports/architecture-decision-proposal.md`
- `plans/first-private-vertical-slice.md`

### 승인 게이트

- TECH-01/STORAGE-LOCAL-01/LEGACY-01 결정 반영 확인
- 상세 ADR와 첫 vertical slice ExecPlan 사용자 승인
- Phase 3 이후 실행 순서와 최소 catalog adapter/본격 ingestion 분리 승인
- migration 범위 승인

### 금지

- 대규모 구현
- 새 production dependency 확정

---

## Phase 3 이후 승인된 실행 순서

상태: `APPROVED — 2026-08-12`, 첫 단계 UI 순서 보완 `CONFIRMED — 2026-08-16`

```text
1. Android local-only Card + Archive
2. Private Board + Web read path
3. guest→account 승격 + metadata sync
4. 명시적 private image backup
5. 제한 catalog ingestion
6. Public 준비 상태 재평가
```

첫 단계의 실행 source는 `plans/first-private-vertical-slice.md`다. 현재 첫 단계 내부에서는 아래 순서를 사용한다.

```text
구축된 Android native/local 기반 유지
→ Web 모바일·데스크톱에서 공용 Memory UI readiness gate
→ Android shell 적용과 실기기 적응 검증
→ export·복구·rollback·device matrix 등 첫 slice 잔여 항목 마감
```

UI 상세 기준은 `decisions/2026-08-16-web-first-shared-ui-readiness.md`와 `../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`를 따른다. 아래 기존 Phase 3~10 절은 전체 작업 범위를 보존하기 위한 목록이며, 충돌할 때 승인된 Decision/ExecPlan을 우선한다.

---

## Phase 3 — Catalog Foundation

### 참고 문서

- `04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- Source Registry template
- approved ExecPlan

### 행동

1. Source Registry.
2. raw staging.
3. internal IDs.
4. normalization enums.
5. FieldClaim/revision.
6. sample ingestion.
7. dedupe/conflict/idempotency tests.
8. legacy isolation.

### 산출물

- schema/migrations
- sample import tool
- catalog quality report
- source registry entries

### 완료 조건

- sample rerun without duplicates.
- source provenance available.
- provider failure does not block PrivateTitle.

### 승인 게이트

- full ingestion gate.

### 금지

- unapproved source automation
- full catalog crawl
- legacy deletion

---

## Phase 4 — Private Vertical Slice

### 참고 문서

- `02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

### 구현 순서

1. domain model/local DB.
2. Android image intake.
3. catalog search/PrivateTitle.
4. Draft/Complete MemoryCard.
5. LOCAL_ONLY image lifecycle.
6. Archive.
7. Board N:M.
8. account promotion.
9. metadata sync.
10. Web Archive/Board.
11. export/delete.

### 각 milestone 보고

- files changed
- demo flow
- tests
- events
- known limitations

### 완료 조건

- offline card.
- no data loss on login.
- Web sees synced metadata.
- local image state not misrepresented.

---

## Phase 5 — Private Cloud Image

### 참고 문서

- `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- architecture ExecPlan

### 행동

- explicit opt-in.
- quarantine/private storage.
- signed URL.
- derivatives.
- deletion propagation.
- quota and cost metrics.

### 완료 조건

- login alone never uploads.
- unauthorized access tests pass.
- delete removes all objects.

### 승인 게이트

- storage limits/cost.

---

## Phase 6 — UGC Foundation

### 참고 문서

- `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- UGC launch gate template

### 행동

- terms acceptance.
- rights metadata.
- publish request.
- report content/user.
- block.
- moderation queue.
- action/notification.
- appeal/restore.
- strike/suspension.
- audit log.
- kill switch.

### 완료 조건

- all E2E gate scenarios.
- public off by default.

### 승인 게이트

- UGC-GATE-01.

---

## Phase 7 — Limited Public

### 행동

- allowlisted imageTypes only.
- initially small tester group.
- optional pre-moderation.
- public card/Board URL.
- SavedReference points to original.
- report and takedown operations.

### 금지

- anime screenshot public without gate.
- third-party fanart public without permission gate.
- comments/DM.

### 완료 조건

- deletion propagates.
- public/private transitions are correct.
- moderation capacity measured.

---

## Phase 8 — QA and Closed Beta

### 참고 문서

- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

### 행동

- matrix tests.
- migration rehearsal.
- performance.
- privacy/security.
- activation/retention dashboards.
- user observation.

### 산출물

- beta readiness report
- known issue register
- rollback rehearsal report

### 승인 게이트

- closed beta launch.

---

## Phase 9 — Launch and Operations

### 행동

- release checklist.
- flag configuration.
- monitoring.
- moderator coverage.
- incident response.
- cohort review.

### Codex 역할

- release evidence 정리.
- 자동화·대시보드·runbook 지원.
- 사업·법적 최종 승인 대신하지 않음.

---

## Phase 10 — Post-launch Iteration

우선순위:

1. card creation friction.
2. second/third card.
3. Archive revisit.
4. Board retention.
5. catalog failures.
6. image cost.
7. report operations.

Public feed, follows, AI, ads, subscription은 core retention이 확인된 뒤 별도 Decision Log와 ExecPlan으로 시작한다.

## 공통 작업 규칙

### 작업 시작

```text
- 이번 작업의 결정 ID
- 읽은 문서
- current repository evidence
- scope/exclusions
- test plan
```

### 작업 중

- plan progress 업데이트.
- 예상 밖 발견 기록.
- 결정 충돌 시 중지.

### 작업 종료

```text
- user-visible outcome
- changed files
- commands/tests
- migrations/rollback
- privacy/rights/security
- analytics
- remaining risks
- next gate
```
