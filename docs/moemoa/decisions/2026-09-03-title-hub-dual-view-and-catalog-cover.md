# Title Hub·Dual View·대표 표지 Memory 결정 기록

- ID: `IA-01`, `TITLE-COLLECTION-01`, `TITLE-VIEW-01`, `LIBRARY-INTEGRATION-01`, `NAMING-01`, `CATALOG-PROD-01` revision
- Status: `CONFIRMED`
- Date: 2026-09-03
- Owner/Approver: 사용자
- Source discussion: 사용자가 GPT Pro와 검토하고 전달한 `MOEMOA_CODEX_HANDOFF_2026-09-03.zip`, 이후 이 대화에서 최신 기준 채택 승인
- Related spec: `../../superpowers/specs/2026-09-03-title-hub-dual-view-ui.md`
- Related ExecPlan: `../plans/2026-09-03-title-hub-dual-view.md`

## Context

기존 Web에는 작품당 하나의 감상 상태를 가진 Library와 작품당 여러 개인 이미지 중심 Memory Archive가 별도 최상위 경험으로 존재했다. 두 write model의 의미는 다르지만, 사용자는 둘의 관계와 두 종류의 ‘카드’를 구분하기 어려웠다. 한편 작품 대표 표지는 검색에서 작품을 빠르게 식별하는 데 효과적이고, 사용자는 2026-09-03 대표 표지를 MOEMOA에서 자유롭게 사용할 수 있는 확대 승인을 받았다고 확인했다.

## Options considered

1. Library와 Memory Archive를 계속 별도 최상위 제품으로 유지.
2. Library를 제거하고 모든 작품 상태를 Memory Card로 자동 변환.
3. write model은 독립 유지하되 작품 허브와 파생 read projection으로 통합.

## Decision

옵션 3을 채택한다.

- 사용자-facing `Library`는 `작품 / Titles`로 축소·통합한다.
- `내 작품`은 명시적으로 저장한 작품과 Complete Memory가 있는 작품의 합집합이다.
- 동일한 작품 집합을 `표지 보기`와 `기억 함께 보기`로 제공한다.
- 작품별 저장·시청 상태와 Memory 0..N은 `Title Hub`에서 함께 보여준다.
- 작품 저장과 Memory 생성은 서로를 자동 생성하지 않는다.
- 대표 표지는 작품 anchor로 표시할 수 있으며, 사용자가 명시적으로 선택한 경우 `CATALOG_COVER` Memory visual이 될 수 있다.
- 표지 기반 Memory에는 개인 기억 신호가 최소 하나 필요하다.
- 표지 bytes는 카드마다 복제하지 않고 catalog-managed reference로 재사용한다.
- 기존 local Library/Memory 데이터는 명시적 migration 승인 없이 삭제하거나 자동 변환하지 않는다.

## Rationale

- 공식 표지의 빠른 작품 탐색성과 개인 이미지 Memory의 정체성을 모두 보존한다.
- 작품당 하나의 상태와 작품당 여러 Memory라는 도메인 의미를 흐리지 않는다.
- Title Hub가 검색, 작품 목록, Memory 상세, Board 사이의 공통 문맥이 된다.
- Poster View는 밀도 높은 탐색, Memory View는 개인 기억 재발견을 각각 담당한다.

## Consequences

- `/titles/` 또는 동등한 canonical route와 Title Hub가 필요하다.
- legacy Library adapter와 Memory repository를 합치는 read projection이 필요하다.
- `CATALOG_COVER` source별 domain invariant, renderer, persistence, sync 계약이 필요하다.
- 기존 user metadata schema는 `USER_IMAGE`와 `SYSTEM_DESIGN`만 허용하므로 additive migration이 필요하다.
- 현재 catalog asset은 active release에 묶여 있으므로 장기 카드 reference용 영구 cover identity와 revision lifecycle을 구현 전에 확정해야 한다.
- `Library`, `Add to Library`, `Library Card` 문구는 호환·역사 문맥 외 사용자 화면에서 제거한다.

## Affected files/modules/docs

- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `docs/superpowers/specs/2026-09-03-title-hub-dual-view-ui.md`
- `docs/moemoa/plans/2026-09-03-title-hub-dual-view.md`
- 향후 title projection, Memory domain, catalog asset, Supabase schema, navigation/route/UI

## Migration/rollback impact

이번 결정 기록 자체는 데이터 migration을 수행하지 않는다. 후속 migration은 additive schema, feature flag, 기존 source branch 유지, local data count/export를 포함한 별도 승인 단위로 실행한다. 결정 철회 시 이 문서와 canonical 변경을 revert하고 현재 Library/Archive runtime을 유지할 수 있다.

## Review trigger/date

- 대표 표지 사용 허가의 범위·조건이 변경되거나 철회됨.
- catalog release 교체가 기존 Memory reference의 안정성을 보장하지 못함.
- 사용자 검증에서 Poster/Memory View 또는 Save Title/Add Memory 구분 실패가 반복됨.
- Title state remote sync 범위가 확정되어 legacy local adapter 경계를 재설계해야 함.
