# 통합 Supabase 사용자 데이터 결정 기록

- Status: `CONFIRMED`
- Date: 2026-08-26
- Owner/Approver: 사용자
- Scope: `BACKEND-01`, `AUTH-01`, `SYNC-01`, `LEGACY-01` revision
- Source discussion: 2026-08-26 Codex 대화와 실제 repository/remote read-only audit
- Related design: `../../superpowers/specs/2026-08-26-unified-supabase-user-data-design.md`

## Context

카탈로그 Service Projection v2와 대표 표지는 현재 Supabase 프로젝트에 적재되어 있지만 로그인·사용자 기록 client는 legacy 별도 project 환경변수를 전제로 남아 있었다. 현재 project에는 Auth user와 user data table이 없고, 사용자는 legacy project에 실제 사용자가 0명이었으며 기존 구조의 migration/compatibility가 필요 없다고 확인했다.

신규 Memory Card는 local owner-scoped IndexedDB에 저장되며, legacy snapshot/split-sync schema는 Card/VisualAsset/Board invariant를 표현하지 못한다.

## Options considered

1. 현재 catalog Supabase project를 Auth·user metadata까지 담당하는 단일 project로 확장.
2. Catalog와 legacy Auth/user project를 계속 분리.
3. Catalog data를 legacy project로 다시 이동.
4. User data를 legacy JSON snapshot schema에 맞춰 재구성.

## Decision

### BACKEND-01

**옵션 1을 채택한다.** 현재 catalog Supabase project를 단일 운영 project로 사용한다. Catalog는 session 없는 read-only client, Auth/user data는 PKCE session client로 논리 분리한다. Private mutation은 direct table write가 아니라 RLS와 검증 RPC를 사용한다. 별도 standalone backend는 초기 범위에 두지 않는다.

### AUTH-01

Supabase Auth와 기존 Google OAuth를 첫 provider로 사용한다. Remote private row owner는 `auth.users.id`다. Guest Owner는 local-only이며 첫 로그인 시 preview 가능한 local bundle을 idempotent promotion operation으로 account namespace에 승격한다. Entity UUID를 유지하고 account 간 자동 병합을 금지한다.

### SYNC-01

Legacy whole snapshot을 사용하지 않고 Card/Asset/Board 등 entity별 정규화 row를 동기화한다. Version mismatch는 자동 덮어쓰지 않고 사용자 conflict resolution을 요구한다. Delete tombstone이 stale update보다 우선하고 30일 보존한다. Operation ID와 request hash로 retry를 idempotent하게 만들고 server-generated sync sequence로 incremental pull한다.

### LEGACY-01 revision

2026-08-11의 보수적 legacy migration 결정은 실제 사용자 데이터가 존재할 가능성을 전제로 했다. 실제 사용자가 0명임이 확인됐으므로 production remote schema에서 legacy Library/WatchLog/Tier/snapshot migration과 compatibility table을 만들지 않는다. Legacy runtime code와 개발자 로컬 데이터의 즉시 destructive 삭제를 승인하는 것은 아니지만 신규 Auth/sync contract에는 포함하지 않는다.

### Image boundary

Card metadata sync와 image cloud backup은 계속 분리한다. Phase 1 VisualAsset은 `LOCAL_ONLY/PRIVATE` metadata와 reproducible system-design spec만 동기화한다. 사용자 이미지 file upload는 `IMAGE-SYNC-01`, `STORAGE-01`, `PRIVACY-01` 승인 전 금지한다.

## Rationale

- 실제 사용자 migration 비용과 계정 위험이 없다.
- 한 project로 Auth, RLS, catalog, future Storage의 운영 지점을 줄인다.
- Catalog와 private data를 client/grant/RLS로 분리해 rollback 범위를 제한한다.
- Memory Card 자유 텍스트를 timestamp last-write-wins로 잃지 않는다.
- Legacy snapshot과 normalized row를 동시에 유지하는 이중 sync 복잡도를 제거한다.
- Local-first와 선택 로그인을 유지하면서 remote account row의 소유 모델을 단순화한다.

## Consequences

- `PUBLIC_SUPABASE_*`와 `PUBLIC_CATALOG_SUPABASE_*`는 같은 project를 가리키지만 client 역할은 유지한다.
- 신규 schema/RPC/RLS migration과 local IndexedDB account owner upgrade가 필요하다.
- 기존 `syncRepo.js`, `useSyncStatus.js`, legacy deploy SQL을 신규 Card sync 구현 기준으로 재사용하지 않는다.
- Web OAuth callback과 Android App Link/PKCE를 별도 검증한다.
- Public user content와 private image bucket은 활성화되지 않는다.
- User table은 Auth owner 삭제에 대응 가능한 참조 구조로 설계하지만, 계정 삭제 UX·재인증·유예·복구 정책은 `PRIVACY-01`의 열린 결정으로 유지한다.

## Migration/rollback impact

- 첫 remote migration은 empty user table을 추가하는 additive change다.
- Catalog schema/release/bucket과 3,998개 data는 변경하지 않는다.
- Legacy project export/import, Auth UUID migration, session preservation은 없다.
- Cutover 전 schema/RLS/RPC를 검증하고 feature flag/env 제거로 local-only rollback이 가능해야 한다.
- 실제 user data가 생긴 뒤 destructive schema rollback은 export/count/별도 승인 없이 금지한다.

## Review trigger/date

- 공동 소유·team workspace 요구가 생겨 direct `user_id` owner가 부족해짐.
- Google-only가 beta 접근성의 명확한 장애로 측정됨.
- RPC throughput/운영 복잡도가 standalone thin API보다 커짐.
- Version conflict UI가 실제 사용 빈도에 비해 과도하거나 데이터 손실을 막지 못함.
- Private image backup gate가 승인되어 `LOCAL_ONLY` constraint 확장이 필요함.

## Affected files/modules/docs

- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `docs/moemoa/reports/open-decision-questions.md`
- `docs/superpowers/specs/2026-08-26-unified-supabase-user-data-design.md`
- 향후 `supabase/migrations/*`, Auth/user adapter, IndexedDB owner migration, Web/Android tests

이 기록은 설계 결정을 확정한다. Migration 적용, remote write, OAuth/provider 설정 변경, Vercel environment cutover는 승인된 후속 ExecPlan의 별도 실행 gate를 따른다.
