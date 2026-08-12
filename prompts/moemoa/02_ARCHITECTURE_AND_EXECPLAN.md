# Phase 2 프롬프트 — 아키텍처 결정안과 ExecPlan

저장소 감사 산출물과 `docs/moemoa/decisions/2026-08-11-foundation-decisions.md`, `docs/moemoa/adr/0001-capacitor-client-and-local-media-boundary.md`, `docs/moemoa/06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`, `PLANS.md`를 읽어라.

코드를 수정하기 전에:

1. 확정된 Astro/React + Capacitor shell, app-private filesystem + DB metadata, 보수적 legacy 이전을 변경하지 않고 세부 아키텍처를 제시한다.
2. 기존 코드 재사용 경계, native image intake bridge, offline/local DB transaction, Guest Owner namespace, Web-only surface, 테스트와 빌드를 구체화한다.
3. 첫 Private Vertical Slice의 ExecPlan을 작성한다.
4. schema, API, migration, feature flags, tests, observability, rollback을 포함한다.
5. BACKEND-01 등 아직 미정인 항목은 local-only slice에서 분리하고, 새 선택이 필요하면 옵션과 권장안을 제안하되 CONFIRMED로 기록하지 않는다.

산출물:

- `docs/moemoa/reports/architecture-decision-proposal.md`
- `docs/moemoa/plans/first-private-vertical-slice.md`
- 필요 시 `docs/moemoa/reports/decision-proposals.md`

승인 전 구현하지 마라.
