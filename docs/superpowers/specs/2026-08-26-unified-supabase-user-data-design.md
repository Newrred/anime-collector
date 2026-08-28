# MOEMOA 통합 Supabase 사용자 데이터 설계

> **문서 상태: `CURRENT_APPROVED_DESIGN / IMPLEMENTATION_GATED` — 2026-08-26**
> 사용자 승인 범위: 현재 카탈로그 Supabase 프로젝트를 단일 운영 프로젝트로 확장하고, 실제 사용자가 없었던 legacy Supabase의 계정·기록·snapshot 구조는 이관하거나 재현하지 않는다. 이 문서는 설계 기준이며 migration 적용, OAuth 설정 변경, Vercel 환경변수 변경, 원격 데이터 쓰기를 승인하지 않는다.

관련 결정: [`docs/moemoa/decisions/2026-08-26-unified-supabase-user-data.md`](../../moemoa/decisions/2026-08-26-unified-supabase-user-data.md)

## 1. 목적과 검증된 현재 상태

MOEMOA의 카탈로그, 로그인, 사용자 Memory Card metadata를 한 Supabase 프로젝트에서 운영하되 공개 카탈로그와 개인 사용자 데이터의 권한·client·수명주기를 분리한다.

설계 승인 전 확인한 현재 상태는 다음과 같다.

- 현재 카탈로그 프로젝트 ref는 `okchpyagfucpzpyrfgol`이다.
- active catalog에는 search/detail/assets 각 3,998개, people 4,899 page가 있다.
- 현재 프로젝트의 Supabase Auth 사용자는 0명이다.
- 신규 프로젝트에는 `user_snapshots`, `user_library_items`, `user_watch_logs`, `memory_cards` 등 사용자 테이블이 없다.
- Web/Android artifact는 현재 `PUBLIC_CATALOG_SUPABASE_*`만 포함하며, legacy `PUBLIC_SUPABASE_*` 연결은 활성 artifact에 없다.
- 사용자는 legacy Supabase에 실제 사용자가 없었으며 기존 구조의 production 이관·호환이 필요 없다고 확인했다.
- 신규 Memory Card는 현재 `moemoa-memory-v1` IndexedDB의 owner-scoped store에만 존재한다.

## 2. 확정 범위

### 포함

- 같은 Supabase 프로젝트의 Auth, public Postgres, catalog read model 사용.
- Google OAuth를 첫 인증 공급자로 사용.
- `auth.users.id`를 remote private row의 직접 소유 키로 사용.
- 로그인 전 Guest Owner는 local-only로 유지하고 명시적 승격 후 account namespace로 전환.
- Memory Card, PrivateTitle, VisualAsset metadata, Board, preference의 정규화된 remote schema.
- optimistic version, idempotent operation, monotonic change sequence, tombstone 기반 metadata sync.
- catalog anonymous read와 private user data RLS 분리.
- Web과 Android가 같은 contract를 사용하는 adapter/RPC 경계.

### 제외

- legacy Supabase Auth 사용자·세션·UUID·테이블·snapshot migration.
- `user_snapshots`, `user_library_items`, `user_watch_logs`, `user_character_pins`, legacy Tier cloud schema.
- legacy Library/WatchLog/Tier를 신규 Card/Board로 자동 변환하는 기능.
- 사용자 이미지 원본의 cloud upload, private bucket, signed URL.
- Public profile/Card/Board, follow/showcase, moderation.
- email OTP, magic link, provider linking.
- 사용자용 계정 삭제 flow와 Auth 관리자 삭제 자동화.
- thin standalone application server.

`IMAGE-SYNC-01`, `STORAGE-01`, `PRIVACY-01`은 계속 열린 gate다. Phase 1 remote VisualAsset은 `LOCAL_ONLY/PRIVATE` metadata만 받는다. User table은 향후 Auth 계정 삭제 시 안전하게 cascade할 수 있도록 설계하되, 실제 계정 삭제 UX·재인증·유예 기간·복구 정책은 `PRIVACY-01` 승인 전 구현 범위에 넣지 않는다.

## 3. Supabase 경계

물리적으로는 프로젝트 하나를 사용하지만 browser runtime client는 역할별로 분리한다.

```text
PUBLIC_CATALOG_SUPABASE_* ──> session 없는 catalog read-only client
PUBLIC_SUPABASE_*         ──> PKCE session을 유지하는 user/Auth client
```

두 환경변수 세트는 같은 project URL과 publishable key를 가리킨다. catalog client는 Auth session을 유지하지 않고, user client는 `persistSession`, `autoRefreshToken`, PKCE를 사용한다. service-role/secret key는 browser, APK, Vercel client environment에 넣지 않는다.

Catalog table은 기존 active-release RLS/RPC를 유지한다. User table은 authenticated owner만 읽을 수 있으며 write는 검증된 RPC로 제한한다.

## 4. Identity와 local promotion

Remote에 별도 Workspace/Owner table을 만들지 않는다. 첫 제품은 개인 소유만 지원하므로 remote content의 owner는 `auth.users.id`다.

Local `owners` store는 다음 두 kind를 지원하도록 확장한다.

```text
GUEST   -> guest:<installation uuid>
ACCOUNT -> account:<auth.users uuid>
```

Guest row는 remote에 생성하지 않는다. 첫 로그인 승격은 다음 순서를 따른다.

1. local Guest bundle을 읽어 immutable backup/export 가능 상태로 둔다.
2. manifest count와 deterministic source hash를 계산한다.
3. Auth session을 확인하고 account owner namespace를 준비한다.
4. `promote_guest_memory` RPC에 operation ID, device ID, guest ID, source hash, bounded entity bundle을 보낸다.
5. server는 동일 `(user_id, guest_owner_id)` 완료 기록을 재사용하고 중복 생성하지 않는다.
6. server transaction이 완료된 뒤에만 local entity의 owner를 account namespace로 원자적으로 전환한다.
7. 실패하면 Guest 원본을 유지하고 재시도한다.

Entity UUID는 승격 전후 동일하게 유지한다. 다른 account 로그인 시 기존 account namespace를 합치지 않고 숨긴다. account 전환과 local cache 제거 UX는 구현 계획에서 검증하되, account 간 자동 병합은 금지한다.

## 5. 공통 SQL 계약

모든 user-owned entity는 client-generated UUID와 아래 sync field를 사용한다.

```text
version            bigint      not null default 1 check (version >= 1)
created_at         timestamptz not null
client_updated_at  timestamptz not null
server_updated_at  timestamptz not null default now()
deleted_at         timestamptz
```

`version`과 `server_updated_at`은 mutation RPC가 관리한다. Client timestamp는 사용자 기록의 local chronology 보존용이며 충돌 우선순위를 정하지 않는다. Delete는 `deleted_at` tombstone으로 표현하고 30일 retention 뒤 별도 관리 작업이 물리 삭제할 수 있다.

Text와 array는 모든 API/RPC에서 길이와 item 수를 제한한다. Database constraint와 RPC validation을 함께 사용하고 client validation만 신뢰하지 않는다.

## 6. Table 계약

### 6.1 `user_profiles`

| column | contract |
| --- | --- |
| `user_id` | `uuid primary key references auth.users(id) on delete cascade` |
| `display_name` | `text not null`, 1~50자 |
| `handle` | nullable, 3~24자 lowercase ASCII/digit/hyphen, unique |
| `bio` | `text not null default ''`, 최대 300자 |
| `locale` | BCP-47 형태의 bounded text, 기본 `en` |
| `time_zone` | bounded IANA timezone text, 기본 `UTC` |
| `profile_public` | `boolean not null default false`; Phase 1 public RLS 없음 |
| timestamps | `created_at`, `server_updated_at` |

Auth insert trigger는 사용하지 않는다. 로그인 완료 후 idempotent `ensure_user_profile()` RPC가 생성한다. Profile RPC 실패가 Auth signup 자체를 rollback하지 않게 한다.

### 6.2 `user_devices`

| column | contract |
| --- | --- |
| `id` | uuid PK |
| `user_id` | FK auth.users, cascade |
| `installation_id` | local installation UUID |
| `platform` | `WEB` 또는 `ANDROID` |
| `app_version` | bounded text |
| `last_sync_seq` | bigint, 기본 0 |
| `last_seen_at` | server timestamptz |
| `created_at` | server timestamptz |

`unique(user_id, installation_id)`와 `unique(user_id, id)`를 둔다. 후자는 promotion/sync operation의 same-owner composite FK에 사용한다.

### 6.3 `user_account_promotions`

| column | contract |
| --- | --- |
| `operation_id` | uuid PK |
| `user_id`, `device_id` | same-owner composite FK |
| `guest_owner_id` | `guest:<uuid>` 형식 |
| `source_hash` | lowercase SHA-256 |
| `status` | `STARTED`, `COMPLETED`, `FAILED` |
| `imported_counts` | bounded jsonb |
| timestamps | `started_at`, `completed_at` |

`unique(user_id, guest_owner_id)`로 동일 Guest 승격을 한 번만 완료한다.

### 6.4 `user_preferences`

| column | contract |
| --- | --- |
| `user_id` | PK/FK auth.users |
| `schema_version` | positive integer |
| `payload` | bounded jsonb, 최대 32 KiB |
| sync fields | version/timestamps |

Preference는 비핵심·가변 UI 설정이므로 versioned JSON document를 허용한다. Card/Board/content는 JSON snapshot으로 저장하지 않는다.

### 6.5 `memory_private_titles`

| column | contract |
| --- | --- |
| `id` | uuid PK |
| `user_id` | FK auth.users, cascade |
| `display_title` | 1~120자 |
| `normalized_title` | NFKC/trim/case-normalized bounded text |
| `optional_genres` | text array, 최대 16개/항목 48자 |
| sync fields | version/timestamps/tombstone |

`unique(user_id, id)`를 same-owner FK 대상으로 두고, active row에 `(user_id, normalized_title)` non-unique index를 둔다. 같은 제목을 가진 별도 개인 작품 생성을 금지하지 않는다.

### 6.6 `memory_cards`

| column | contract |
| --- | --- |
| `id` | uuid PK |
| `user_id` | FK auth.users, cascade |
| `catalog_anime_id` | nullable `anime:<uuid>` text |
| `private_title_id` | nullable uuid |
| `title_snapshot` | 1~120자, catalog 변경/누락 시 fallback |
| `status` | `DRAFT`, `COMPLETE_PRIVATE`, `DELETED` |
| `note` | 최대 10,000자 |
| `watched_at` | nullable date |
| `watched_at_precision` | `DAY`, `MONTH`, `YEAR`, `UNKNOWN` |
| `episode` | nullable positive integer |
| `scene_cue` | nullable, 최대 500자 |
| `emotion_tags` | text array, 최대 20개/항목 48자 |
| `rewatch_intent` | nullable bounded text |
| `visibility` | Phase 1은 `PRIVATE`만 허용 |
| sync fields | version/timestamps/tombstone |

Constraint:

- `catalog_anime_id`와 `private_title_id` 중 정확히 하나만 존재한다.
- `(user_id, private_title_id)`는 `memory_private_titles(user_id, id)`를 참조한다.
- `DELETED` status와 `deleted_at`은 함께 설정되거나 함께 비어 있어야 한다.
- `catalog_anime_id`는 release별 composite catalog row에 FK를 걸지 않는다. Active catalog lookup으로 검증하고 `title_snapshot`으로 역사 기록을 보존한다.

Index:

- `(user_id, status, server_updated_at desc)`
- `(user_id, catalog_anime_id) where deleted_at is null`
- `(user_id, private_title_id) where deleted_at is null`

### 6.7 `memory_visual_assets`

| column | contract |
| --- | --- |
| `id` | uuid PK |
| `user_id`, `card_id` | same-owner composite FK |
| `asset_type` | `USER_IMAGE`, `SYSTEM_DESIGN` |
| `state` | `READY`, `DELETE_PENDING`, `DELETED` |
| `storage_scope` | Phase 1은 `LOCAL_ONLY`만 허용 |
| `visibility` | Phase 1은 `PRIVATE`만 허용 |
| `rights_basis` | `UNKNOWN`, `USER_ORIGINAL`, `LICENSED`, `SYSTEM_GENERATED` |
| file metadata | checksum, MIME, byte size, width, height; 모두 nullable |
| `design_spec` | system design일 때 required bounded jsonb |
| cloud fields | `cloud_bucket`, `cloud_object_path`; Phase 1은 반드시 null |
| `is_current` | active Card asset 표시 |
| sync fields | version/timestamps/tombstone |

Server에는 device-specific `localRef`를 저장하지 않는다. `SYSTEM_DESIGN`은 `design_spec`으로 다른 기기에서 재현할 수 있다. `USER_IMAGE/LOCAL_ONLY`는 다른 기기에서 unavailable placeholder를 표시한다.

Partial unique index는 한 Card에 active current asset 하나만 허용한다.

```sql
create unique index memory_visual_assets_current_card_idx
  on public.memory_visual_assets (card_id)
  where is_current and deleted_at is null;
```

Complete Card가 commit 시점에 current `READY` asset을 정확히 하나 갖는 조건은 multi-table invariant이므로 mutation RPC와 deferred validation trigger로 검증한다.

### 6.8 `memory_boards`

| column | contract |
| --- | --- |
| `id`, `user_id` | uuid PK + owner FK |
| `title` | 1~80자 |
| `description` | 최대 500자 |
| `visibility` | Phase 1 `PRIVATE` |
| sync fields | version/timestamps/tombstone |

Archive는 별도 table이 아니다. `memory_cards`의 owner/status/tombstone index를 통해 Complete Card를 최신순으로 조회하는 read model이다.

### 6.9 `memory_board_cards`

| column | contract |
| --- | --- |
| `id` | uuid PK, universal sync entity ID |
| `user_id`, `board_id`, `card_id` | same-owner composite FK |
| `position_key` | bounded lexicographic ordering token |
| sync fields | version/timestamps/tombstone |

`unique(board_id, card_id)`를 두고 active ordering index는 `(user_id, board_id, position_key) where deleted_at is null`이다.

### 6.10 `sync_operations`

| column | contract |
| --- | --- |
| `operation_id` | uuid PK/idempotency key |
| `user_id`, `device_id` | same-owner FK |
| `entity_type`, `entity_id` | allowlisted entity key |
| `operation_type` | `UPSERT`, `DELETE`, `PROMOTE`, `RESOLVE_CONFLICT` |
| `base_version` | client가 읽은 entity version |
| `request_hash` | normalized request SHA-256 |
| `result_status` | `APPLIED`, `CONFLICT`, `REJECTED` |
| result | applied version/seq 또는 bounded error code |
| `result_payload` | 최대 1 MiB의 완전한 mutation result snapshot. 이후 entity가 바뀌어도 동일 operation/hash 재시도에 최초 결과를 그대로 반환한다. |
| `created_at` | server time |

동일 operation ID와 동일 request hash는 기존 결과를 반환한다. 같은 ID에 다른 hash가 오면 거부한다.

### 6.11 `sync_changes`

| column | contract |
| --- | --- |
| `sync_seq` | global bigint identity PK |
| `user_id` | owner FK |
| `entity_type`, `entity_id` | changed entity |
| `operation_type` | `UPSERT`, `DELETE` |
| `entity_version` | applied version |
| `changed_at` | server time |

Index는 `(user_id, sync_seq)`다. Device는 `last_sync_seq` 이후 change를 pull한다. Retention 이전 cursor를 가진 device는 incremental pull을 시도하지 않고 full metadata resync를 수행한다.

## 7. Mutation과 pull contract

Authenticated client는 private content table에 직접 INSERT/UPDATE/DELETE하지 않는다. 아래 RPC만 execute할 수 있다.

```text
ensure_user_profile
register_user_device
promote_guest_memory
apply_memory_card_mutation
apply_board_mutation
pull_memory_changes
resolve_memory_conflict
```

RPC는 `security definer set search_path = ''`와 명시적 schema-qualified object를 사용하고 항상 `auth.uid()`를 확인한다. Entity owner, payload size, state transition, base version, operation ID를 검증한다.

Read는 RLS가 적용된 table/view 또는 bounded read RPC로 제공한다. Mutation이 성공하면 같은 transaction에서 entity version 증가, server timestamp 갱신, `sync_operations` result 기록, `sync_changes` append를 완료한다.

## 8. Conflict와 delete

- `base_version`이 현재 version과 같으면 자동 적용한다.
- 다르면 server row를 덮어쓰지 않고 `CONFLICT` 결과와 비교용 bounded payload를 반환한다.
- Card note 등 사용자 기억은 timestamp 기반 last-write-wins로 자동 손실시키지 않는다.
- 사용자가 local/cloud 중 하나를 선택하면 새 `RESOLVE_CONFLICT` operation으로 적용한다.
- Board membership/reorder도 base version을 검사하며 stale reorder는 충돌로 반환한다.
- Delete tombstone은 stale update보다 우선한다.
- Deleted row와 tombstone은 30일 보존하며 복구는 명시적 operation으로만 가능하다.
- 물리 삭제 job, retention, full-resync 최소 cursor는 구현 계획과 운영 검증에 포함한다.

## 9. RLS와 grant

- User table은 모두 RLS를 enable한다.
- `anon`은 user table privilege가 없다.
- `authenticated`는 own-row SELECT만 grant한다.
- INSERT/UPDATE/DELETE는 authenticated에 직접 grant하지 않는다.
- Mutation function execute만 authenticated에 grant한다.
- Policy는 `auth.uid() is not null and auth.uid() = user_id`를 명시한다.
- Composite FK와 RPC validation으로 다른 사용자의 Title/Card/Board/Device 참조를 차단한다.
- Phase 1에는 `profile_public`, Card/Board `visibility` 값과 무관하게 anon public user-content policy를 만들지 않는다.
- Catalog table/RPC의 기존 anon read-only policy는 유지한다.

Service-role/secret은 migration, 검증, 관리 작업에만 사용하고 runtime bundle/log/Git에 포함하지 않는다.

## 10. Error와 recovery

- Auth 실패: Guest local data를 유지한다.
- Promotion network 실패: server operation result를 조회해 retry하고 local owner를 바꾸지 않는다.
- Local owner 전환 실패: remote promotion은 idempotent하므로 재시도하며 Guest backup을 유지한다.
- Mutation conflict: remote row를 변경하지 않고 conflict UI로 전환한다.
- Incremental cursor 만료: full metadata resync 후 새 cursor를 저장한다.
- `LOCAL_ONLY` image가 없는 device: Card metadata와 system-design은 표시하고 user image는 unavailable 상태로 표시한다.
- Account logout/switch: account namespace를 다른 account와 합치지 않는다.

## 11. Migration과 rollback

첫 migration은 additive다.

- 기존 catalog schema, active release, cover bucket을 변경하지 않는다.
- 신규 user table은 empty 상태에서 생성한다.
- legacy SQL을 신규 migration에 복사하지 않는다.
- 신규 Auth user부터 시작하며 old project export/import가 없다.
- `PUBLIC_SUPABASE_*`를 현재 catalog project로 전환하기 전 schema/RLS/RPC 검증을 완료한다.

Rollback은 user env를 비활성화하고 신규 adapter feature flag를 끄는 방식으로 local-only Memory Card를 유지한다. Catalog client는 별도이므로 user sync rollback이 catalog 검색을 중단하지 않는다. Production user data가 생긴 뒤 table drop이나 destructive cleanup은 별도 승인·export·count 검증 없이는 실행하지 않는다.

## 12. Verification gate

Implementation 완료 조건에는 최소 다음이 포함된다.

- migration dry-run/local database apply와 schema diff.
- anon catalog read 성공, anon user table read/write 실패.
- user A/B 상호 row read/write/reference 차단.
- RPC payload/state/size validation.
- 같은 operation 재시도 결과 동일, hash mismatch 거부.
- Guest promotion 성공/중단/재시도/local commit 실패 복구.
- same-card stale mutation conflict, 명시적 resolution.
- delete 대 stale update에서 tombstone 우선.
- Board same-owner FK와 reorder conflict.
- system-design cross-device 재현, local image unavailable placeholder.
- Web PKCE callback과 Android App Link/재시작 실기기 검증.
- client bundle service-role/secret 0건.
- catalog 3,998 count/hash/cover regression 없음.

## 13. 구현 전 남은 절차

1. 사용자가 이 문서를 검토한다.
2. 승인 뒤 별도 ExecPlan을 작성한다.
3. ExecPlan은 migration/RLS contract test, local DB owner upgrade, Supabase adapter, Auth UX, promotion, sync, Web/Android E2E를 작은 commit 단위로 분리한다.
4. 원격 migration 적용과 environment cutover는 dry-run과 명시적 실행 gate를 둔다.
