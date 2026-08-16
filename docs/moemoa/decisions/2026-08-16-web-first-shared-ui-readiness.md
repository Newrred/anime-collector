# Web-first Shared UI Readiness 실행 순서 결정

- ID: `UI-SEQUENCE-01`
- Status: `CONFIRMED`
- Date: 2026-08-16
- Approved by: 사용자
- Related decisions: `PLATFORM-01`, `TECH-01`, `CARD-01`, `STORAGE-LOCAL-01`
- Design spec: `../../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`
- ExecPlan: `../plans/first-private-vertical-slice.md`

## Context

Android local-only Card/Archive의 native intake, 저장, 복구 기반과 공통 React UI가 구현됐지만 실제 APK에서 가독성 부족, 조작부 잘림, 불명확한 정보 위계가 관찰됐다. 기존 자동 테스트는 기능 안정성 중심이며 Memory route의 시각·사용성 readiness를 충분히 증명하지 않는다.

## Options considered

1. Web 제품 전체를 먼저 완성한 뒤 Android를 다시 시작한다.
2. 현재 UI 상태에서 Android 기능과 첫 Slice 잔여 기능을 계속 추가한다.
3. Android native 기반은 유지·동결하고, Web 내부 테스트 surface에서 공통 Memory UI를 먼저 완성한 뒤 Android 적용과 실기기 검증으로 복귀한다.

## Decision

옵션 3을 채택한다.

```text
기능 확장 일시 동결
→ Web-first Shared Memory UI
→ Web UI Readiness Gate
→ Android 전용 적응
→ 첫 Slice 잔여 기능·실기기 gate
→ 첫 Slice 종료
```

## Reason

- Astro/React 공통 surface를 재사용한다는 `TECH-01`을 지킨다.
- 이미 검증한 Android image intake와 local media 기반을 버리지 않는다.
- 빠른 Web 반복으로 UI 결함을 고치면서 native 전용 위험은 별도 gate로 유지한다.
- 실제 Web image persistence, backend, auth, sync, cloud 결정을 앞당기지 않는다.
- 사용성 검증 전에 Board·sync·Public 같은 후속 기능을 추가하지 않는다.

## Consequences

- 첫 Slice ExecPlan에 Web-first UI readiness sub-milestone을 추가한다.
- Memory route를 mobile/layout/design-system/visual regression test 범위에 포함한다.
- Web UI gate 통과 전에는 Android UI 확장과 후속 기능을 시작하지 않는다.
- 각 큰 UI checkpoint에서 Android build/cold-launch smoke는 유지한다.
- 실제 Web production read path와 image behavior는 후속 Slice라는 기존 경계를 유지한다.

## Migration and rollback

- DB schema, media directory, legacy data migration 변경은 없다.
- UI 변경은 feature flag와 route boundary에서 rollback 가능해야 한다.
- rollback은 `moemoa-memory-v1` 또는 app-private media 삭제를 의미하지 않는다.

## Affected documents

- `CODEX_START_HERE.md`
- `docs/moemoa/README.md`
- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `docs/moemoa/08_CODEX_PHASE_RUNBOOK.md`
- `docs/moemoa/plans/first-private-vertical-slice.md`
- `docs/moemoa/reports/architecture-decision-proposal.md`
- `docs/moemoa/reports/implementation-gap-analysis.md`
- `docs/moemoa/reports/private-slice-test-evidence.md`
- `docs/superpowers/README.md`

## Review triggers

- Web UI와 Android WebView의 차이 때문에 공통 component 유지 비용이 별도 Android UI보다 커지는 증거.
- Android smoke에서 shared UI checkpoint마다 반복적인 구조 파손이 발생.
- 실제 Web image persistence를 첫 Slice에 포함해야 한다는 새 제품 결정.
- UI 안정화가 기존 local media/domain contract 변경을 요구.
