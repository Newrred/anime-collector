# ADR-0002 — Memory local domain과 Guest Owner 경계

- Status: `ACCEPTED`
- Date: 2026-08-12
- Approved by: 사용자
- Related decisions: `CARD-01`, `STORAGE-LOCAL-01`, `ACCOUNT-01`, `LEGACY-01`
- Approval record: `../decisions/2026-08-12-first-private-slice-approval.md`

## Context

현재 runtime은 `anime-collector-db` v1과 전역 localStorage key에 Library, WatchLog, Tier, cache, sync 상태를 혼합해 저장한다. 새 Memory Card는 로그인 없이 소유자가 분리되어야 하고, VisualAsset file과 metadata의 실패 복구가 가능해야 한다. 기존 데이터를 직접 upgrade하면 legacy rollback과 데이터 보존을 동시에 검증하기 어렵다.

## Decision

1. 새 Memory 기능은 기존 Astro/React 앱 안의 기능 단위 modular monolith로 구현한다.
2. domain/application layer는 plain JavaScript + JSDoc contract로 작성하고 React, browser, Capacitor, Supabase, AniList를 직접 참조하지 않는다.
3. 신규 metadata 원본은 별도 IndexedDB database `moemoa-memory-v1`에 저장한다.
4. 앱 설치별 `guest:<uuid>` Owner를 생성하고 모든 사용자 row와 command를 owner-scoped로 제한한다.
5. `MemoryCard`는 `AnimeRef` 또는 `PrivateTitle` 중 정확히 하나를 참조한다.
6. `COMPLETE_PRIVATE`는 같은 owner의 READY VisualAsset이 있을 때만 허용한다.
7. 기존 `anime-collector-db`, localStorage, Library, WatchLog, Tier는 첫 slice에서 읽거나 변환하지 않는다.
8. `src/data/aliases.json`은 `legacy_unverified` read-only 검색 fallback으로만 사용하고 canonical catalog로 승격하지 않는다.
9. AniList는 `TitleResolver` adapter 뒤의 remote fallback이며 provider image를 Memory VisualAsset으로 사용하지 않는다.
10. first slice는 Card + Archive + edit/delete/export/recovery까지 포함하고 Board, account sync, cloud, Public을 제외한다.

## Data boundary

```text
moemoa-memory-v1
├── owners
├── anime_refs
├── private_titles
├── memory_cards
├── visual_assets
├── media_operations
└── meta

legacy untouched
├── anime-collector-db
└── existing localStorage keys
```

## Consequences

### Positive

- legacy rollback과 신규 기능 flag rollback이 분리된다.
- owner isolation을 account provider 결정 전에 검증할 수 있다.
- Web test adapter와 Android native adapter가 같은 domain contract를 사용한다.
- provider나 local DB engine을 후속 evidence에 따라 교체할 수 있다.

### Negative

- 앱 안에 두 개의 local DB가 공존한다.
- 후속 legacy Draft seed와 guest→account 승격에는 별도 migration plan이 필요하다.
- IndexedDB의 Android WebView 내구성은 실기기와 규모 test로 계속 검증해야 한다.

## Review triggers

- Android WebView에서 metadata 손실 또는 corruption 재현
- 1,000개 Card Archive query 성능 기준 미달
- owner promotion 또는 sync가 IndexedDB transaction 경계를 충족하지 못함
- legacy read-only와 신규 UI의 사용자 혼동이 반복 관찰됨

