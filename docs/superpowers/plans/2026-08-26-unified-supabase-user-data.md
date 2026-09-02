# Unified Supabase User Data Implementation ExecPlan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before every completion claim.

**Goal:** Add a private, local-first account layer in which a Guest user's Memory Cards and Boards can be explicitly promoted to the existing catalog Supabase project, synchronized as normalized metadata, and viewed safely on Web and Android without uploading local image files.

**Architecture:** Preserve `moemoa-memory-v1` as the offline source of work and add an owner-aware IndexedDB v2 sync journal. The existing catalog Supabase project receives additive user tables, owner-only read RLS, and allowlisted mutation RPCs; Web and Android share the same JS domain/gateway while Android OAuth uses an external browser plus a verified app callback. Existing Library/WatchLog/Tier snapshot sync remains present but is disconnected from the new Memory account surfaces rather than migrated or deleted.

**Tech Stack:** Astro 5.17, React 19.2, JavaScript/TypeScript, IndexedDB, Supabase JS 2.99, Supabase CLI 2.115, PostgreSQL 17/pgTAP, Capacitor 8.5, official Capacitor App 8.1 and Browser 8.0 plugins, Playwright 1.58, Android Java/Gradle.

**Spec:** `docs/superpowers/specs/2026-08-26-unified-supabase-user-data-design.md`

## Global Constraints

- `BACKEND-01`: one existing catalog Supabase project; catalog and user clients remain logically separate.
- `AUTH-01`: Google is the only first provider; remote owner is `auth.users.id`; no automatic account-to-account merge.
- `SYNC-01`: normalized entity rows, optimistic base version, explicit conflict resolution, delete tombstone precedence, 30-day tombstone retention, idempotent operation ID/request hash, server `sync_seq`.
- `LEGACY-01`: no production legacy Auth/Library/WatchLog/Tier/snapshot migration or compatibility table.
- User image bytes and device `localRef` remain `LOCAL_ONLY`; only metadata and reproducible system-design specs synchronize.
- Public profile/Card/Board policies, private image cloud backup, account-deletion UX, provider linking, email OTP, and standalone backend are out of scope.
- No service-role/secret value may enter Git, Vercel client variables, browser bundles, APK resources, ordinary logs, or test snapshots.
- Production deployment remains deferred. Remote migration, Google provider configuration, Preview environment cutover, and Production cutover are separate execution gates.
- Existing uncommitted UI/APK changes must be committed, moved to their own worktree, or otherwise preserved before this plan is executed; they must never be discarded to make this plan's workspace clean.

---

## 1. 목적과 사용자 결과

완료된 Preview 사용자는 다음 흐름을 수행할 수 있다.

```text
로그인 없이 Card/Archive/Private Board 사용
→ Google 로그인 선택
→ 이 기기의 Guest 데이터 개수와 변환 필요 항목 확인
→ 명시적 승격 승인
→ Card/Board metadata를 account owner로 원자 승격
→ 다른 Web/Android 기기에서 metadata pull
→ LOCAL_ONLY 사용자 이미지는 unavailable placeholder, 시스템 디자인은 재현
→ 충돌 시 local/cloud 중 사용자가 선택
```

로그인 실패, 네트워크 중단, 중복 callback, RPC retry, local commit 실패가 발생해도 Guest 원본 또는 account local copy가 사라지거나 다른 계정에 섞이면 안 된다.

## 2. 관련 확정 결정

| Decision | 구현 기준 |
| --- | --- |
| `ACCOUNT-01` | 로그인은 선택이며 Guest 로컬 사용을 막지 않음 |
| `BOARD-01` | Archive는 파생 read model, Board는 N:M private entity |
| `BACKEND-01` | 같은 project, catalog anonymous read와 private Auth client 분리 |
| `AUTH-01` | `auth.users.id` 직접 소유, 명시적·멱등 Guest promotion |
| `SYNC-01` | entity별 RPC와 `sync_seq`, 자동 LWW 금지 |
| `STORAGE-LOCAL-01` | Android file은 app-private, remote에 local path 저장 금지 |
| `LEGACY-01` | legacy cloud schema 재현·이관 없음 |

구현 source of truth 우선순위는 canonical decision → 승인된 설계 → 이 ExecPlan → 실제 코드다. 이 계획이 설계와 충돌하면 구현을 멈추고 설계를 다시 승인받는다.

## 3. 현재 상태와 저장소 증거

- `master@988f8cd`에는 승인된 설계와 결정 문서가 있고 `origin/master`는 `9b0bd18`이다.
- 현재 작업 트리에는 APK route/navigation 관련 미커밋 파일이 존재한다. 이 계획 문서 외에는 이번 계획 작성 커밋에 포함하지 않는다.
- `src/features/memory/domain/memoryDomain.js`의 owner validator는 `guest:<uuid>`만 허용한다.
- `src/features/memory/adapters/indexeddb/memoryDb.js`는 `moemoa-memory-v1`, schema version 1이며 Board/account/sync store가 없다.
- `IndexedDbMemoryRepository.js`는 local Card/media journal을 제공하지만 account owner 전환, promotion bundle, outbox, cursor, conflict API가 없다.
- Supabase catalog candidate에는 `anime:<uuid>`가 있지만 `createAnimeRef()`가 현재 그 값을 보존하지 않아 remote `catalog_anime_id`로 직접 매핑할 수 없다.
- `src/lib/supabaseClient.js`는 PKCE session client, `catalogSupabaseClient.js`는 session 없는 catalog client로 이미 역할이 분리되어 있다.
- `src/repositories/syncRepo.js`와 `useSyncStatus.js`는 `user_snapshots`, `user_library_items`, `user_watch_logs`, `user_character_pins` 기반 legacy whole-snapshot sync다. 신규 Memory sync에 재사용하지 않는다.
- `DataCenter.jsx`와 `TopNavDataMenu.jsx`가 legacy `useSyncStatus()`를 호출하므로 `PUBLIC_SUPABASE_*`를 새 project에 연결하기 전에 consumer 교체가 선행되어야 한다.
- `supabase/migrations/`에는 catalog migration 2개만 있고 user table/pgTAP test는 없다.
- Supabase CLI는 현재 package/PATH에 없고 Docker Desktop client 29.2.1은 설치됐지만 daemon은 실행 중이 아니다.
- 공식 Supabase 문서는 local CLI를 project dev dependency로 pin하고 pgTAP/RLS test를 사용하도록 안내하며, `security definer`는 `search_path = ''`와 schema-qualified object를 요구한다.
- 현재 Google Web callback route와 PKCE exchange는 있지만 Android manifest App Link/custom callback과 external-browser OAuth adapter는 없다.
- 첫 Private Slice 계획상 독립 사용자 검토, Android 물리기기 검증, export/orphan rollback gate가 남아 있다. Remote/Auth cutover 전에 이 gate를 닫거나 실행 순서 변경을 명시적으로 승인받는다.

## 4. 범위

### 포함

- Supabase CLI local test toolchain과 pgTAP.
- Additive user schema, owner RLS, restricted grants, validated RPCs.
- `user_profiles`, `user_devices`, `user_account_promotions`, and default `user_preferences` row initialization. Preference editing/sync UI is deferred until a dedicated mutation contract is approved.
- `memory_private_titles`, `memory_cards`, `memory_visual_assets`, `memory_boards`, `memory_board_cards`.
- `sync_operations`, `sync_changes`, optimistic conflict/tombstone contract.
- local IndexedDB v2 owner/Board/promotion/outbox/conflict/cursor stores.
- current catalog internal ID preservation and unmatched AnimeRef promotion preview.
- Private Board local UI/read path needed before account sync.
- Web Google OAuth, profile/device registration, Guest promotion UI.
- Memory Card/Board metadata push/pull and explicit conflict UI.
- Android external-browser Google OAuth and verified callback.
- Preview-only migration/env/callback rollout and rollback rehearsal.

### 제외

- User image file upload, Supabase Storage private bucket, signed URL.
- Public profile/Card/Board, follow/showcase/moderation.
- Legacy cloud table creation, old Auth UUID migration, old session preservation.
- Legacy Library/WatchLog/Tier to Card/Board conversion.
- Account deletion UX or Auth admin deletion automation before `PRIVACY-01`.
- Production deployment or Production feature flag activation.
- iOS and additional authentication providers.

## 5. 아키텍처·데이터 흐름

```text
Catalog client (no session) ── anon read ──> existing catalog tables/RPC

Memory UI
  ├─ Local Memory runtime ────────────────> IndexedDB v2 + Android local media
  └─ Memory account coordinator
       ├─ Auth client (PKCE session) ─────> Supabase Auth
       ├─ SupabaseMemoryGateway ─────────> owner read + validated RPC
       └─ MemorySyncEngine ──────────────> outbox / pull cursor / conflicts

Guest owner:   guest:<installation uuid>  (local only)
Account owner: account:<auth user uuid>   (local namespace)
Remote owner:  auth.users.id              (database FK/RLS)
```

### 5.1 Local sync envelope

Remote `version`을 local edit 횟수와 혼동하지 않는다. User-owned local entity에는 다음 envelope를 둔다.

```js
{
  remoteVersion: 0,
  syncState: "LOCAL_ONLY",
  clientUpdatedAt: "2026-08-26T00:00:00.000Z",
  serverUpdatedAt: null,
  lastOperationId: null
}
```

허용 `syncState`는 `LOCAL_ONLY | PENDING | SYNCED | CONFLICT | DELETED_PENDING`이다. 신규 local entity의 `remoteVersion`은 0이고, server apply 결과를 받은 뒤에만 1 이상이 된다.

### 5.2 Catalog binding

Supabase catalog 선택으로 생성한 `AnimeRef`는 `catalogAnimeId: anime:<uuid>`를 보존한다. 기존 provider-only AnimeRef는 promotion preview에서 다음 중 하나를 명시적으로 선택한다.

1. active catalog의 동일 AniList ID에 정확히 매칭해 `catalogAnimeId`를 저장.
2. 사용자가 `개인 작품으로 유지`를 선택해 같은 AnimeRef UUID로 PrivateTitle을 만들고 Card reference를 local transaction에서 교체.

자동 fuzzy match나 조용한 PrivateTitle 변환은 금지한다.

### 5.3 Promotion transaction

```text
buildGuestPromotionManifest(guestOwnerId)
→ count/hash/unsupported binding 확인
→ 사용자 preview/choice
→ promote_guest_memory(operationId, deviceId, guestOwnerId, sourceHash, bundle)
→ 동일 operation/hash면 기존 결과 반환
→ server transaction commit
→ local commitPromotionToAccount()
→ active owner = account:<userId>
→ promoted Guest source는 recovery journal로 유지
→ 신규 비로그인용 Guest owner ID 회전
```

Promotion bundle hard limit은 UTF-8 JSON 2 MiB, PrivateTitle 250, Card 500, VisualAsset 500, Board 100, BoardCard 2,000개다. 초과 시 `PROMOTION_BUNDLE_TOO_LARGE`로 중단하고 local data를 변경하지 않는다.

### 5.4 Incremental sync

```text
local mutation commit
→ same transaction에서 sync_outbox append
→ apply_*_mutation RPC(baseVersion, operationId, requestHash)
→ APPLIED: local remoteVersion/cursor 갱신
→ CONFLICT: server payload를 sync_conflicts에 저장, local 값 유지
→ pull_memory_changes(lastSyncSeq)
→ outbox가 없는 entity만 자동 적용
→ local pending entity와 겹치면 conflict 생성
```

Delete tombstone은 stale upsert보다 우선한다. User image `localRef`는 gateway DTO 생성 단계에서 제거한다.

### 5.5 Canonical application contract types

These declarations document JS object shapes shared across tasks; implementation remains plain JavaScript with runtime validation.

```ts
type OwnerKind = "GUEST" | "ACCOUNT";
type SyncState = "LOCAL_ONLY" | "PENDING" | "SYNCED" | "CONFLICT" | "DELETED_PENDING";
type EntityType = "PRIVATE_TITLE" | "MEMORY_CARD" | "VISUAL_ASSET" | "MEMORY_BOARD" | "MEMORY_BOARD_CARD";
type OperationType = "UPSERT" | "DELETE" | "PROMOTE" | "RESOLVE_CONFLICT";
type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

type MemoryOwner = {
  id: string;
  kind: OwnerKind;
  userId?: string;
  createdAt: string;
};

type SyncEnvelope = {
  remoteVersion: number;
  syncState: SyncState;
  clientUpdatedAt: string;
  serverUpdatedAt: string | null;
  lastOperationId: string | null;
};

type LocalSyncOperation = {
  id: string;
  ownerId: string;
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  baseVersion: number;
  requestHash: string;
  payload: JsonValue;
  state: "PENDING" | "APPLIED" | "CONFLICT" | "REJECTED";
  createdAt: string;
};

type DeviceSyncState = {
  ownerId: string;
  userId: string;
  installationId: string;
  deviceId: string;
  lastSyncSeq: number;
  updatedAt: string;
};

type LocalAnimeRef = {
  id: string;
  catalogAnimeId: string | null;
  displayTitle: string;
  normalizedTitle: string;
  aliases: string[];
  genres: string[];
  sourceKey: string;
  sourceBinding: { provider: "ANILIST"; externalId: string };
  verificationState: "LEGACY_UNVERIFIED" | "PROVIDER_CANDIDATE";
  createdAt: string;
  updatedAt: string;
};

type LocalPrivateTitle = {
  id: string;
  ownerId: string;
  displayTitle: string;
  normalizedTitle: string;
  optionalGenres: string[];
  updatedAt: string;
  deletedAt: string | null;
  sync: SyncEnvelope;
};

type LocalVisualAsset = {
  id: string;
  ownerId: string;
  imageType: "UNKNOWN" | "SYSTEM_DESIGN" | "USER_IMAGE";
  storageScope: "LOCAL_ONLY";
  visibility: "PRIVATE";
  rightsBasis: "UNKNOWN" | "USER_ORIGINAL" | "LICENSED" | "SYSTEM_GENERATED";
  state: "READY" | "DELETE_PENDING" | "DELETED";
  localRef: string | null;
  checksumSha256: string | null;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  designSpec: JsonValue | null;
  isCurrent: boolean;
  updatedAt: string;
  deletedAt: string | null;
  sync: SyncEnvelope;
};

type LocalMemoryCardBundle = {
  card: {
    id: string;
    ownerId: string;
    animeRefId: string | null;
    privateTitleId: string | null;
    visualAssetId: string;
    status: "DRAFT" | "COMPLETE_PRIVATE" | "DELETED";
    note: string | null;
    watchedAt: string | null;
    watchedAtPrecision: "DAY" | "MONTH" | "YEAR" | "UNKNOWN";
    episode: number | null;
    sceneCue: string | null;
    emotionTags: string[];
    rewatchIntent: string | null;
    updatedAt: string;
    deletedAt: string | null;
    sync: SyncEnvelope;
  };
  title: LocalAnimeRef | LocalPrivateTitle;
  asset: LocalVisualAsset;
};

type LocalMemoryBoard = {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  visibility: "PRIVATE";
  updatedAt: string;
  deletedAt: string | null;
  sync: SyncEnvelope;
};

type LocalMemoryBoardCard = {
  id: string;
  ownerId: string;
  boardId: string;
  cardId: string;
  positionKey: string;
  updatedAt: string;
  deletedAt: string | null;
  sync: SyncEnvelope;
};

type CreateMemoryBoardInput = Omit<LocalMemoryBoard, "visibility" | "updatedAt" | "deletedAt" | "sync"> & { now: string };
type CreateBoardCardInput = Omit<LocalMemoryBoardCard, "positionKey" | "updatedAt" | "deletedAt" | "sync"> & {
  leftPosition: string | null;
  rightPosition: string | null;
  now: string;
};

type RemotePrivateTitleDto = Omit<LocalPrivateTitle, "ownerId" | "updatedAt" | "sync"> & { clientUpdatedAt: string };
type RemoteMemoryCardDto = Omit<LocalMemoryCardBundle["card"], "ownerId" | "animeRefId" | "privateTitleId" | "visualAssetId" | "updatedAt" | "sync"> & {
  catalogAnimeId: string | null;
  privateTitleId: string | null;
  titleSnapshot: string;
  clientUpdatedAt: string;
};
type RemoteVisualAssetDto = Omit<LocalVisualAsset, "ownerId" | "imageType" | "localRef" | "updatedAt" | "sync"> & {
  cardId: string;
  assetType: "USER_IMAGE" | "SYSTEM_DESIGN";
  clientUpdatedAt: string;
  cloudBucket: null;
  cloudObjectPath: null;
};
type RemoteMemoryBoardDto = Omit<LocalMemoryBoard, "ownerId" | "updatedAt" | "sync"> & { clientUpdatedAt: string };
type RemoteMemoryBoardCardDto = Omit<LocalMemoryBoardCard, "ownerId" | "updatedAt" | "sync"> & { clientUpdatedAt: string };
type MutationInput = {
  operationId: string;
  deviceId: string;
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  baseVersion: number;
  payload: JsonValue;
};
type MutationRequest = MutationInput & { requestHash: string };
type MutationResult = {
  status: "APPLIED" | "CONFLICT" | "REJECTED";
  entityVersion: number | null;
  syncSeq: number | null;
  errorCode: string | null;
  remoteEntity: JsonValue | null;
};
type PullResult = {
  changes: JsonValue[];
  nextSyncSeq: number;
  minimumRetainedSyncSeq: number;
  requiresFullResync: boolean;
};
type PromotionResult = { status: "COMPLETED"; importedCounts: Record<string, number>; nextSyncSeq: number };
```

## 6. 변경 파일 지도

### Tooling / database

| Path | Responsibility |
| --- | --- |
| `package.json`, `package-lock.json` | Supabase CLI exact dev dependency, DB scripts, Capacitor Auth plugins |
| `.gitignore` | `supabase/.temp/`, `.branches/` 제외 |
| `supabase/config.toml` | local callback URLs; Google secret은 `env()` reference만 사용 |
| `supabase/migrations/20260826000100_memory_user_schema.sql` | tables, checks, indexes, cascade FKs |
| `supabase/migrations/20260826000200_memory_user_functions.sql` | validation helpers, profile/device/promotion/mutation/pull RPC |
| `supabase/migrations/20260826000300_memory_user_security.sql` | RLS, grants, function execute allowlist |
| `supabase/migrations/20260826000400_memory_user_retention.sql` | 30-day tombstone purge function and daily pg_cron job |
| `supabase/tests/database/memory_user_schema.test.sql` | schema/constraint/index contract |
| `supabase/tests/database/memory_user_security.test.sql` | anon/user A/user B RLS and grant contract |
| `supabase/tests/database/memory_user_rpc.test.sql` | idempotency/version/tombstone/promotion/pull contract |

### Shared domain / local persistence

| Path | Responsibility |
| --- | --- |
| `src/features/memory/domain/memoryDomain.js` | Guest/Account owner and catalog binding invariants |
| `src/features/memory/domain/memoryBoard.js` | Board/BoardCard normalization and position keys |
| `src/features/memory/sync/memorySyncContract.js` | DTO validation, stable request hash input, RPC result parsing |
| `src/features/memory/adapters/indexeddb/memoryDb.js` | schema version 2 and new stores/indexes |
| `src/features/memory/adapters/indexeddb/memoryOwnerStore.js` | active owner, account owner, promotion journal |
| `src/features/memory/adapters/indexeddb/memoryBoardStore.js` | local Board N:M persistence |
| `src/features/memory/adapters/indexeddb/memorySyncStore.js` | outbox, cursor, conflict, remote apply transaction |
| `src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js` | delegate facade preserving existing Card/media methods |

### Remote adapter / application

| Path | Responsibility |
| --- | --- |
| `src/features/memory/adapters/supabase/SupabaseMemoryGateway.js` | allowlisted RPC/read calls and response validation |
| `src/features/memory/application/buildGuestPromotionManifest.js` | deterministic counts/hash and unresolved binding list |
| `src/features/memory/application/promoteGuestMemory.js` | server-first, local-second idempotent promotion saga |
| `src/features/memory/application/syncMemoryMetadata.js` | outbox flush, incremental pull, retry/conflict behavior |
| `src/features/memory/application/resolveMemoryConflict.js` | explicit local/cloud selection operation |
| `src/features/memory/runtime/createMemoryAccountRuntime.js` | Auth session + gateway + local repository composition |
| `src/features/memory/runtime/platformMemoryAccountRuntime.js` | browser/Capacitor platform composition and feature flag |

### Auth / UI / Android

| Path | Responsibility |
| --- | --- |
| `src/lib/supabaseClient.js` | validated user/Auth config, PKCE session client |
| `src/repositories/authRepo.js` | Web/native Google sign-in routing, session API |
| `src/features/auth/webOAuth.js` | PKCE-code-only Web callback parsing and base-aware next validation |
| `src/features/auth/nativeOAuth.js` | external browser, launch URL/appUrlOpen, safe code exchange |
| `src/components/auth/AuthCallbackClient.jsx` | Web PKCE exchange UI without implicit-token fallback |
| `src/hooks/useMemoryAccountSync.js` | session/account/promotion/sync presentation state |
| `src/components/data/MemoryAccountPanel.jsx` | login, promotion preview, device/sync status |
| `src/components/data/MemoryConflictDialog.jsx` | entity-level local/cloud diff and explicit selection |
| `src/features/memory/components/MemoryBoardView.jsx` | private Board list/detail/membership/reorder |
| `src/pages/boards.astro` | static shared Board route |
| `src/components/DataCenter.jsx` | Memory account panel and explicit legacy-local tools boundary |
| `src/components/TopNavDataMenu.jsx` | new account/sync hook; no legacy snapshot cloud call |
| `src/layouts/BaseLayout.astro` | native auth callback bootstrap once per app load |
| `src/messages/en.js`, `src/messages/ko.js` | account/promotion/conflict/LOCAL_ONLY copy |
| `android/app/src/main/AndroidManifest.xml` | exact MOEMOA auth callback intent filter |

### Tests / operations

| Path | Responsibility |
| --- | --- |
| `tests/unit/memoryAccountOwner.test.mjs` | owner/account namespace and logout isolation |
| `tests/unit/memoryDbV2.test.mjs` | v1→v2 schema, legacy DB non-mutation, retry |
| `tests/unit/memoryBoard.test.mjs` | Board N:M and ordering |
| `tests/unit/memorySyncContract.test.mjs` | DTO/redaction/hash/result validation |
| `tests/unit/supabaseMemoryGateway.test.mjs` | exact RPC calls and malformed response rejection |
| `tests/unit/guestPromotion.test.mjs` | success/retry/network/local-commit recovery |
| `tests/unit/memorySyncEngine.test.mjs` | push/pull/conflict/tombstone/cursor behavior |
| `tests/unit/webOAuth.test.mjs` | code-only callback and safe navigation contract |
| `tests/unit/nativeOAuth.test.mjs` | callback allowlist and duplicate callback handling |
| `tests/memory-board.spec.ts` | Board user flow |
| `tests/memory-account-sync.spec.ts` | Guest preview/promotion/cross-device placeholders/conflict |
| `tests/android-auth-static.spec.ts` | Web callback route and bootstrap behavior in built Preview mode |
| `tools/supabase-user-data/verify.mjs` | allowlisted project/count/hash/grant verification; never prints secrets |
| `docs/moemoa/reports/unified-user-data-test-evidence.md` | exact commands/results/migration counts/rollback evidence |

## 7. 데이터·스키마 마이그레이션

### 7.1 Remote migration order

1. `20260826000100`: additive tables, constraints, indexes only.
2. `20260826000200`: private helpers, deferred invariant trigger, public RPCs.
3. `20260826000300`: enable RLS, revoke direct mutations/function defaults, grant own-row SELECT and exact RPC execute.
4. `20260826000400`: enable `pg_cron`, add a service-role-only tombstone purge function, and schedule the named daily retention job.

Catalog tables, active release pointer, cover bucket, and existing catalog functions are not altered. Every user-owned FK to `auth.users(id)` uses `on delete cascade`, but account deletion UI is not implemented.

### 7.2 Local IndexedDB migration

`MEMORY_DB_VERSION` becomes 2. Upgrade creates these stores without rewriting existing Card/media rows inside `onupgradeneeded`.

| Store | Key | Indexes |
| --- | --- | --- |
| `memory_boards` | `id` | `[ownerId, deletedAt, updatedAt]` |
| `memory_board_cards` | `id` | `[ownerId, boardId, positionKey]`, `[ownerId, cardId]` |
| `sync_outbox` | `id` | `[ownerId, state, createdAt]`, `[ownerId, entityType, entityId]` |
| `sync_conflicts` | `id` | `[ownerId, state, createdAt]`, `[ownerId, entityType, entityId]` |
| `account_promotions` | `operationId` | `[userId, guestOwnerId]`, `status` |
| `device_sync_state` | `ownerId` | `userId`, `deviceId` |

Existing v1 entities get sync defaults through read normalization. They are written with explicit sync envelopes only when edited, promoted, or pulled. Existing `anime-collector-db` and legacy localStorage keys are never opened by the v2 migration.

### 7.3 Migration history gate

Before any linked push:

```powershell
npx.cmd supabase migration list --linked
npx.cmd supabase db push --linked --dry-run --skip-vault
```

If remote migration history does not include the two already-applied catalog migrations, stop. Verify remote catalog table/function definitions and row counts first; only then propose exact `migration repair --status applied <version>` commands for separate approval. Never use `--include-all` to bypass an unexplained history mismatch.

### 7.4 Remote application gate

Remote apply is not implied by implementation approval. After local tests and dry-run evidence, request explicit approval for:

```powershell
npx.cmd supabase db push --linked --skip-vault
```

Record before/after Auth user count, every new user table count, catalog 3,998 counts, active release hash, and cover object count. A first empty migration expects all new user table counts to be zero.

## 8. 마일스톤과 작업 단위

### Task 0: Isolated baseline and execution gate

**Files:**
- Modify during execution: `docs/superpowers/plans/2026-08-26-unified-supabase-user-data.md`
- Create during execution: `docs/moemoa/reports/unified-user-data-test-evidence.md`

**Interfaces:**
- Consumes: committed repository state and the current First Private Slice completion report.
- Produces: a clean isolated worktree, exact baseline commit, baseline test evidence, and an explicit decision on the remaining First Slice ordering gate.

- [x] **Step 1: Preserve the current dirty workspace**

Run in the current workspace:

```powershell
git status --short
git diff --name-only
git diff --cached --name-only
```

Expected: existing UI/APK edits are listed and no command discards or stages them. If execution starts from another machine, verify the changes were committed or intentionally excluded before creating the feature worktree.

- [x] **Step 2: Create the implementation worktree using the required skill**

Invoke `superpowers:using-git-worktrees` and create a branch named `feat/unified-supabase-user-data` from the latest committed `master` containing this plan. Do not copy uncommitted files into the worktree.

- [x] **Step 3: Run the current baseline**

```powershell
npm.cmd run test:unit
npm.cmd run build
npm.cmd run android:sync
npm.cmd run android:test
npm.cmd run android:assemble:debug
```

Expected: all commands exit 0. If a command fails, record the exact failure before editing implementation files and stop if the required environment cannot be restored.

- [x] **Step 4: Record the ordering gate**

Add an evidence row stating one of these exact outcomes:

```text
FIRST_SLICE_GATE=CLOSED
FIRST_SLICE_GATE=EXPLICITLY_REORDERED_BY_USER
```

Remote/Auth cutover tasks cannot begin without one of these values. Local schema and adapter work may be prepared behind a disabled feature flag.

Recorded result: `FIRST_SLICE_GATE=EXPLICITLY_REORDERED_BY_USER` — explicitly approved by the user on 2026-08-26 16:01 KST. All later remote/Preview/Production gates remain separate.

- [x] **Step 5: Commit baseline evidence**

```powershell
git add docs/superpowers/plans/2026-08-26-unified-supabase-user-data.md docs/moemoa/reports/unified-user-data-test-evidence.md
git commit -m "docs: record unified user data baseline"
```

### Task 1: Pin the local Supabase test toolchain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Modify: `supabase/config.toml`
- Test: local Supabase CLI smoke

**Interfaces:**
- Consumes: Node 22+ and a running Docker Desktop Linux engine.
- Produces: `npm run supabase:start`, `supabase:reset`, `supabase:test`, `supabase:lint`, all pinned to CLI 2.115.0.

- [x] **Step 1: Add the exact dev dependency and scripts**

```powershell
npm.cmd install --save-dev --save-exact supabase@2.115.0
```

Add these scripts to `package.json`:

```json
{
  "supabase:start": "supabase start",
  "supabase:stop": "supabase stop",
  "supabase:reset": "supabase db reset --local",
  "supabase:test": "supabase test db --local",
  "supabase:lint": "supabase db lint --local --level error"
}
```

- [x] **Step 2: Ignore only generated local Supabase state**

Append to `.gitignore`:

```gitignore
supabase/.temp/
supabase/.branches/
```

- [x] **Step 3: Keep local Auth configuration secret-free**

Keep `site_url = "http://127.0.0.1:4321"` and add exact callback allowlist entries:

```toml
additional_redirect_urls = [
  "http://127.0.0.1:4321/auth/callback/",
  "http://localhost:4321/auth/callback/",
  "com.newrred.moemoa://auth/callback"
]
```

Do not put a Google client secret in `config.toml`. Local Google OAuth configuration, when manually exercised, uses `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"`.

- [x] **Step 4: Start Docker Desktop and verify the pinned CLI**

```powershell
npx.cmd supabase --version
npm.cmd run supabase:start
npx.cmd supabase status
```

Expected: CLI reports `2.115.0`; local API is `http://127.0.0.1:54321`; no credential value is copied into evidence.

Windows note: Docker Desktop 4.63.0에서 비암호화 Docker API `tcp://localhost:2375`를 열지 않은 경우 Supabase Vector 로그 수집기만 재시작한다. 보안 설정을 낮추지 않고 core local stack을 사용할 때는 `npm run supabase:start -- --exclude vector`를 사용한다. 이 예외는 local Analytics/Studio Logs에만 영향을 주며 DB, Auth, REST, Storage, Studio UI에는 영향을 주지 않는다. 기본 `supabase:start` script는 cross-platform 기준 명령으로 유지한다.

- [x] **Step 5: Reset the existing catalog migrations locally**

```powershell
npm.cmd run supabase:reset
npm.cmd run supabase:lint
```

Expected: both catalog migrations apply and lint exits 0.

- [x] **Step 6: Commit the test toolchain**

```powershell
git add package.json package-lock.json .gitignore supabase/config.toml
git commit -m "chore(db): pin local Supabase test tooling"
```

### Task 2: Create the additive user schema with pgTAP contract tests

**Files:**
- Create: `supabase/migrations/20260826000100_memory_user_schema.sql`
- Create: `supabase/tests/database/memory_user_schema.test.sql`

**Interfaces:**
- Consumes: existing `auth.users` and catalog schema without changing either.
- Produces: the eleven approved user tables, same-owner composite keys, checks, indexes, and empty additive migration.

- [x] **Step 1: Write the failing schema test**

Create a pgTAP test that checks every approved table and the critical columns:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table('public', 'user_profiles');
select has_table('public', 'user_devices');
select has_table('public', 'user_account_promotions');
select has_table('public', 'user_preferences');
select has_table('public', 'memory_private_titles');
select has_table('public', 'memory_cards');
select has_table('public', 'memory_visual_assets');
select has_table('public', 'memory_boards');
select has_table('public', 'memory_board_cards');
select has_table('public', 'sync_operations');
select has_table('public', 'sync_changes');
select col_is_pk('public', 'memory_cards', 'id');
select has_column('public', 'memory_cards', 'version');
select has_column('public', 'memory_cards', 'deleted_at');
select has_column('public', 'memory_visual_assets', 'design_spec');
select has_column('public', 'user_profiles', 'minimum_retained_sync_seq');
select has_index('public', 'memory_visual_assets', 'memory_visual_assets_current_card_idx');
select has_index('public', 'sync_changes', 'sync_changes_user_seq_idx');
select hasnt_table('public', 'user_snapshots');

select * from finish();
rollback;
```

- [x] **Step 2: Run the test and verify RED**

```powershell
npm.cmd run supabase:test -- supabase/tests/database/memory_user_schema.test.sql
```

Expected: FAIL because `public.user_profiles` and the other new tables do not exist.

- [x] **Step 3: Implement the schema migration**

Use `text` + check constraints for states so the contract can be extended through reviewed migrations. Every user-owned content table includes:

```sql
version bigint not null default 1 check (version >= 1),
created_at timestamptz not null default now(),
client_updated_at timestamptz not null,
server_updated_at timestamptz not null default now(),
deleted_at timestamptz
```

Implement exact table fields and limits from the design, including these non-negotiable checks:

```sql
check ((catalog_anime_id is not null)::integer + (private_title_id is not null)::integer = 1),
check (status in ('DRAFT', 'COMPLETE_PRIVATE', 'DELETED')),
check (visibility = 'PRIVATE'),
check (storage_scope = 'LOCAL_ONLY'),
check (cloud_bucket is null and cloud_object_path is null),
check (char_length(note) <= 10000),
check ((deleted_at is null) = (status <> 'DELETED'))
```

`user_profiles.minimum_retained_sync_seq bigint not null default 0` is the per-user retention watermark required by the approved full-resync contract. It is operational sync state, not user-visible profile data.

Use same-owner composite FKs for `device_id`, `private_title_id`, `card_id`, and `board_id`. Create the current-asset partial unique index exactly as approved:

```sql
create unique index memory_visual_assets_current_card_idx
  on public.memory_visual_assets (card_id)
  where is_current and deleted_at is null;
```

- [x] **Step 4: Reset and verify GREEN**

```powershell
npm.cmd run supabase:reset
npm.cmd run supabase:test -- supabase/tests/database/memory_user_schema.test.sql
npm.cmd run supabase:lint
```

Expected: schema test passes and lint exits 0.

- [x] **Step 5: Verify the migration is additive**

Run local SQL counts through `npx supabase db dump --local --data-only --schema public` or Studio query and record:

```text
catalog tables present
new user tables present
new user row counts = 0
legacy compatibility tables absent
```

- [x] **Step 6: Commit the schema**

```powershell
git add supabase/migrations/20260826000100_memory_user_schema.sql supabase/tests/database/memory_user_schema.test.sql
git commit -m "feat(db): add normalized memory user schema"
```

### Task 3: Add validated RPCs, deferred invariants, RLS, and grants

**Files:**
- Create: `supabase/migrations/20260826000200_memory_user_functions.sql`
- Create: `supabase/migrations/20260826000300_memory_user_security.sql`
- Create: `supabase/migrations/20260826000400_memory_user_retention.sql`
- Create: `supabase/tests/database/memory_user_security.test.sql`
- Create: `supabase/tests/database/memory_user_rpc.test.sql`

**Interfaces:**
- Consumes: Task 2 tables.
- Produces: `ensure_user_profile`, `register_user_device`, `promote_guest_memory`, `apply_memory_card_mutation`, `apply_board_mutation`, `pull_memory_changes`, `resolve_memory_conflict`, plus service-role-only retention maintenance.

- [x] **Step 1: Write failing security tests for anon, user A, and user B**

Create transaction-scoped users and JWT claims. Test these exact outcomes:

```sql
set local role anon;
select throws_ok(
  $$ select * from public.memory_cards $$,
  '42501'
);

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::integer from public.memory_cards),
  1,
  'user A reads only user A card'
);
select throws_ok(
  $$ insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,note,watched_at_precision,emotion_tags,visibility,client_updated_at)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','anime:11111111-1111-4111-8111-111111111111','x','DRAFT','', 'UNKNOWN','{}','PRIVATE',now()) $$,
  '42501'
);
```

Also assert user A cannot read/reference user B rows and `anon` cannot execute any private mutation RPC. Create matching `auth.users` fixtures before inserting user-owned rows; do not rely on JWT claims alone to satisfy auth foreign keys.

- [x] **Step 2: Write failing RPC tests**

Test exact behaviors:

```text
ensure_user_profile called twice returns one profile and one default preferences row
register_user_device rejects device owned by another user
same operation_id + same request_hash returns the stored result
same operation_id + different request_hash returns OPERATION_HASH_MISMATCH
base_version mismatch returns CONFLICT without changing row
stale UPSERT after tombstone returns TOMBSTONE_WINS
successful mutation increments version and appends one sync_changes row
pull after cursor returns only caller rows ordered by sync_seq
pull nextSyncSeq equals the last row in the bounded page, not a later unreturned row
cursor below minimum_retained_sync_seq returns requiresFullResync with no partial page
same guest_owner_id promotion called twice does not duplicate entities
promotion bundle over 2 MiB returns PROMOTION_BUNDLE_TOO_LARGE
COMPLETE_PRIVATE commit without one current READY asset fails
```

- [x] **Step 3: Run both tests and verify RED**

```powershell
npm.cmd run supabase:test -- supabase/tests/database/memory_user_security.test.sql
npm.cmd run supabase:test -- supabase/tests/database/memory_user_rpc.test.sql
```

Expected: FAIL because policies/functions are absent.

- [x] **Step 4: Implement private helpers and public RPC signatures**

Create non-exposed helper schema and pin every definer function:

```sql
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function public.pull_memory_changes(
  p_after_seq bigint default 0,
  p_limit integer default 200
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_after_seq < 0 or p_limit < 1 or p_limit > 500 then
    raise exception 'SYNC_PULL_INVALID';
  end if;
  if p_after_seq < (
    select minimum_retained_sync_seq
    from public.user_profiles
    where user_id = v_user_id
  ) then
    return jsonb_build_object(
      'changes', '[]'::jsonb,
      'nextSyncSeq', greatest(
        (select minimum_retained_sync_seq from public.user_profiles where user_id = v_user_id),
        coalesce((select max(sync_seq) from public.sync_changes where user_id = v_user_id), 0)
      ),
      'minimumRetainedSyncSeq',
        (select minimum_retained_sync_seq from public.user_profiles where user_id = v_user_id),
      'requiresFullResync', true
    );
  end if;

  return (
    with page as (
      select sync_seq, entity_type, entity_id, operation_type, entity_version, changed_at
      from public.sync_changes
      where user_id = v_user_id and sync_seq > p_after_seq
      order by sync_seq
      limit p_limit
    )
    select jsonb_build_object(
      'changes', coalesce(jsonb_agg(to_jsonb(page) order by sync_seq), '[]'::jsonb),
      'nextSyncSeq', coalesce(max(sync_seq), p_after_seq),
      'minimumRetainedSyncSeq',
        (select minimum_retained_sync_seq from public.user_profiles where user_id = v_user_id),
      'requiresFullResync', false
    )
    from page
  );
end;
$$;
```

All other RPCs use the same `auth.uid()` guard, empty search path, schema-qualified names, bounded text/array/json validation, operation result recording, and one database transaction. `apply_memory_card_mutation` accepts only `PRIVATE_TITLE`, `MEMORY_CARD`, and `VISUAL_ASSET`; `apply_board_mutation` accepts only `MEMORY_BOARD` and `MEMORY_BOARD_CARD`. Unknown or cross-family entity types are rejected before any row change.

`sync_operations.result_payload` stores the complete bounded mutation response (maximum 1 MiB). This is required so an old operation replay returns the original `remoteEntity` snapshot even after the entity receives later mutations; reconstructing the response from the current row is not idempotent.

- [x] **Step 5: Add complete-card deferred validation**

Create a constraint trigger that runs at transaction end and requires each non-deleted `COMPLETE_PRIVATE` Card to have exactly one non-deleted `READY` current asset owned by the same user. DRAFT and DELETED cards are exempt. Promotion and card mutation RPC tests must exercise both valid insert orders.

- [x] **Step 6: Apply RLS and least-privilege grants**

For every user table:

```sql
alter table public.memory_cards enable row level security;
revoke all on public.memory_cards from public, anon, authenticated;
grant select on public.memory_cards to authenticated;
create policy memory_cards_select_own
  on public.memory_cards for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
```

Repeat the owner-select policy for each table with `user_id`. Revoke execute from `public`, `anon`, and `authenticated` on all new functions, then grant only the seven public RPC signatures to `authenticated`. Do not alter existing catalog grants/policies.

- [x] **Step 7: Implement and test 30-day retention**

Create `public.purge_expired_memory_tombstones(p_now timestamptz default now())` as a pinned `security definer` maintenance function. It must be executable only by `service_role`/database owner, never by `anon` or `authenticated`. In one transaction it:

1. computes each affected user's highest `sync_seq` older than 30 days;
2. advances `user_profiles.minimum_retained_sync_seq` monotonically before deleting those old change rows;
3. physically deletes eligible tombstoned `memory_board_cards`, `memory_visual_assets`, `memory_cards`, `memory_boards`, and `memory_private_titles` in FK-safe order;
4. skips any parent still referenced by a retained row and never deletes active content;
5. returns only aggregate counts and watermarks, never content.

The retention migration enables `pg_cron` and creates one named daily job, `moemoa-memory-retention-daily`, calling the function. pgTAP must prove 29-day tombstones remain, 31-day tombstones purge, the watermark advances, an older pull requests full resync, and authenticated users cannot invoke the maintenance function.

- [x] **Step 8: Reset and verify GREEN**

```powershell
npm.cmd run supabase:reset
npm.cmd run supabase:test
npm.cmd run supabase:lint
```

Expected: all pgTAP files pass, lint exits 0, catalog anonymous read tests remain green.

- [x] **Step 9: Commit functions and security separately from application code**

```powershell
git add supabase/migrations/20260826000200_memory_user_functions.sql supabase/migrations/20260826000300_memory_user_security.sql supabase/migrations/20260826000400_memory_user_retention.sql supabase/tests/database/memory_user_security.test.sql supabase/tests/database/memory_user_rpc.test.sql
git commit -m "feat(db): add memory sync RPC and owner RLS"
```

### Task 4: Preserve catalog IDs, add Account owners, and migrate IndexedDB to v2

**Files:**
- Modify: `src/features/memory/domain/memoryDomain.js`
- Modify: `src/features/memory/application/createMemoryCard.js`
- Modify: `src/features/memory/adapters/indexeddb/memoryDb.js`
- Create: `src/features/memory/adapters/indexeddb/memoryOwnerStore.js`
- Create: `src/features/memory/adapters/indexeddb/memorySyncStore.js`
- Modify: `src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js`
- Modify: `src/features/memory/runtime/createMemoryRuntime.js`
- Test: `tests/unit/memoryAccountOwner.test.mjs`
- Test: `tests/unit/memoryDbV2.test.mjs`
- Modify: `tests/unit/memoryDomain.test.mjs`
- Modify: `tests/unit/createMemoryCard.test.mjs`

**Interfaces:**
- Consumes: current v1 Guest/Card/Asset/media journal and catalog candidate `animeId`.
- Produces: `createAccountOwner`, `requireOwnerId`, `catalogAnimeId`, active owner APIs, schema-v2 stores, sync-envelope normalization.

- [x] **Step 1: Write failing owner and catalog-binding tests**

```js
const account = createAccountOwner({
  userId: "11111111-1111-4111-8111-111111111111",
  now: "2026-08-26T00:00:00.000Z",
});
assert.equal(account.id, "account:11111111-1111-4111-8111-111111111111");
assert.equal(account.kind, "ACCOUNT");

const anime = createAnimeRef({
  id: "22222222-2222-4222-8222-222222222222",
  catalogAnimeId: "anime:33333333-3333-4333-8333-333333333333",
  displayTitle: "Frieren",
  aliases: [],
  genres: ["Fantasy"],
  sourceBinding: { provider: "ANILIST", externalId: "154587" },
  verificationState: "PROVIDER_CANDIDATE",
  now: "2026-08-26T00:00:00.000Z",
});
assert.equal(anime.catalogAnimeId, "anime:33333333-3333-4333-8333-333333333333");
```

Also assert a malformed account UUID or catalog ID is rejected, and provider-only legacy AnimeRef may keep `catalogAnimeId: null` until promotion preview.

- [x] **Step 2: Write the failing v1→v2 database test**

Seed a fake version-1 database with one Guest Card and verify the v2 upgrade:

```js
assert.equal(MEMORY_DB_VERSION, 2);
assert.deepEqual([...database.stores.keys()].sort(), [
  "account_promotions",
  "anime_refs",
  "device_sync_state",
  "media_operations",
  "memory_board_cards",
  "memory_boards",
  "memory_cards",
  "meta",
  "owners",
  "private_titles",
  "sync_conflicts",
  "sync_outbox",
  "visual_assets",
].sort());
assert.equal(existingCard.ownerId, OWNER_GUEST);
assert.equal(existingCard.note, "preserve me");
```

Assert the legacy `anime-collector-db` test fixture is never opened or mutated.

- [x] **Step 3: Run focused tests and verify RED**

```powershell
node tests/unit/memoryAccountOwner.test.mjs
node tests/unit/memoryDbV2.test.mjs
node tests/unit/memoryDomain.test.mjs
node tests/unit/createMemoryCard.test.mjs
```

Expected: missing Account owner/catalog field and DB version assertions fail.

- [x] **Step 4: Implement the owner and AnimeRef contract**

Replace the Guest-only validator with:

```js
export function requireOwnerId(ownerId) {
  const value = String(ownerId || "");
  if (value.startsWith("guest:") && OWNER_UUID.test(value.slice(6))) return value;
  if (value.startsWith("account:") && OWNER_UUID.test(value.slice(8))) return value;
  throw new MemoryDomainError("INVALID_OWNER_ID", "A valid Memory owner id is required");
}

export function createAccountOwner({ userId, now }) {
  const id = requireOwnerId(`account:${String(userId || "").toLowerCase()}`);
  return Object.freeze({ id, kind: "ACCOUNT", userId: id.slice(8), createdAt: String(now) });
}
```

`createAnimeRef()` validates and stores `catalogAnimeId` when present. `createMemoryCardCommand()` passes `input.titleChoice.animeId` into that field. Provider artwork remains excluded.

- [x] **Step 5: Implement schema v2 and owner/sync store modules**

`memoryOwnerStore.js` exports these exact functions:

```ts
export declare function getActiveOwner(database: IDBDatabase): Promise<MemoryOwner | null>;
export declare function ensureInstallationIdentity(
  database: IDBDatabase,
  input: { uuid: string; now: string },
): Promise<{ installationId: string; guestOwner: MemoryOwner }>;
export declare function ensureAccountOwner(
  database: IDBDatabase,
  input: { userId: string; now: string },
): Promise<MemoryOwner>;
export declare function activateOwner(
  database: IDBDatabase,
  input: { ownerId: string; now: string },
): Promise<MemoryOwner>;
export declare function rotateGuestOwnerAfterPromotion(
  database: IDBDatabase,
  input: { uuid: string; now: string },
): Promise<MemoryOwner>;
```

`memorySyncStore.js` exports:

```ts
export const defaultSyncEnvelope = (now) => ({
  remoteVersion: 0,
  syncState: "LOCAL_ONLY",
  clientUpdatedAt: String(now),
  serverUpdatedAt: null,
  lastOperationId: null,
});
export declare function appendSyncOperation(
  database: IDBDatabase,
  operation: LocalSyncOperation,
): Promise<void>;
export declare function listPendingSyncOperations(
  database: IDBDatabase,
  ownerId: string,
  limit?: number,
): Promise<LocalSyncOperation[]>;
export declare function readDeviceSyncState(
  database: IDBDatabase,
  ownerId: string,
): Promise<DeviceSyncState | null>;
export declare function writeDeviceSyncState(
  database: IDBDatabase,
  state: DeviceSyncState,
): Promise<void>;
```

The actual implementations use IndexedDB request/transaction helpers and validate owner scope before returning rows.

- [x] **Step 6: Make runtime commands use the active owner**

`initialize()` returns the active Guest or Account owner. Existing create/list/get/update/delete/replace methods continue passing one explicit owner ID. Signing out later changes only active owner selection; it does not rewrite account rows into Guest rows.

- [x] **Step 7: Run all local Memory tests and verify GREEN**

```powershell
npm.cmd run test:unit
npm.cmd run build
```

Expected: all unit tests and build pass; v1 Card content is unchanged after v2 open.

- [x] **Step 8: Commit the local identity/schema upgrade**

```powershell
git add src/features/memory tests/unit/memoryAccountOwner.test.mjs tests/unit/memoryDbV2.test.mjs tests/unit/memoryDomain.test.mjs tests/unit/createMemoryCard.test.mjs
git commit -m "feat(memory): add account owner and sync-ready local schema"
```

### Task 5: Implement Private Board locally before account sync

**Files:**
- Create: `src/features/memory/domain/memoryBoard.js`
- Create: `src/features/memory/adapters/indexeddb/memoryBoardStore.js`
- Modify: `src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js`
- Modify: `src/features/memory/runtime/createMemoryRuntime.js`
- Create: `src/features/memory/components/MemoryBoardView.jsx`
- Create: `src/features/memory/components/memory-board.css`
- Create: `src/pages/boards.astro`
- Modify: `src/features/memory/components/MemoryRouteShell.jsx`
- Modify: `src/components/TopNavDataMenu.jsx`
- Modify: `src/messages/en.js`
- Modify: `src/messages/ko.js`
- Modify: `package.json` to ensure the static Android route verifier is available
- Create: `scripts/verify-android-static-routes.mjs` when it is not already present in the preserved APK baseline
- Create: `tests/unit/nativeAppNavigation.test.mjs` when it is not already present in the preserved APK baseline
- Test: `tests/unit/memoryBoard.test.mjs`
- Test: `tests/memory-board.spec.ts`

**Interfaces:**
- Consumes: active local owner and COMPLETE_PRIVATE cards.
- Produces: `createBoard`, `updateBoard`, `deleteBoard`, `addCardToBoard`, `removeCardFromBoard`, `reorderBoardCard`, `listBoards`, `getBoard`.

- [ ] **Step 1: Write failing Board domain tests**

```js
const board = createMemoryBoard({
  id: BOARD_ID,
  ownerId: OWNER_ID,
  title: "Scenes I remember",
  description: "",
  now: NOW,
});
assert.equal(board.visibility, "PRIVATE");
assert.equal(board.title, "Scenes I remember");
assert.throws(() => createMemoryBoard({
  id: BOARD_ID,
  ownerId: OWNER_ID,
  title: "x".repeat(81),
  description: "",
  now: NOW,
}), { code: "BOARD_TITLE_TOO_LONG" });
```

Test one Card in two Boards, duplicate membership rejection, cross-owner Card rejection, stable position ordering, remove-membership without Card deletion, and Board tombstone behavior.

- [ ] **Step 2: Run unit test and verify RED**

```powershell
node tests/unit/memoryBoard.test.mjs
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement Board domain and repository methods**

Use bounded lexicographic position keys with a pure interface:

```ts
export declare function positionBetween(left: string | null, right: string | null): string;
export declare function createMemoryBoard(input: CreateMemoryBoardInput): LocalMemoryBoard;
export declare function createBoardCard(input: CreateBoardCardInput): LocalMemoryBoardCard;
```

Repository membership writes include Board/Card/owner validation in one readwrite transaction. Deleting a Card tombstones active memberships; deleting a Board does not delete Cards.

- [ ] **Step 4: Run unit test and verify GREEN**

```powershell
node tests/unit/memoryBoard.test.mjs
npm.cmd run test:unit
```

Expected: Board tests and the full unit suite pass.

- [ ] **Step 5: Write the failing Board E2E**

The Playwright flow must prove:

```text
seed 3 Complete Cards
→ Archive suggests Board
→ create Board
→ add Card A and B
→ add Card A to second Board
→ reorder A/B
→ remove A from first Board
→ Card A remains in Archive and second Board
```

Include 320×720 keyboard/touch assertions and PRIVATE copy.

- [ ] **Step 6: Implement the shared Board route and navigation**

`MemoryBoardView` reads only the Memory runtime. It displays list/detail in the static `/boards/` route using `?id=<board uuid>`, never imports Supabase directly, and exposes create/edit/delete/membership/reorder actions.

- [ ] **Step 7: Run Board E2E and build**

```powershell
npm.cmd run test:e2e -- tests/memory-board.spec.ts --project=chromium --workers=1
npm.cmd run build
npm.cmd run android:verify:web-routes
```

Expected: Board flow passes, `/boards/index.html` exists, Android route verification passes.

- [ ] **Step 8: Commit the local Board slice**

```powershell
git add package.json scripts/verify-android-static-routes.mjs src/features/memory src/components/TopNavDataMenu.jsx src/messages/en.js src/messages/ko.js src/pages/boards.astro tests/unit/nativeAppNavigation.test.mjs tests/unit/memoryBoard.test.mjs tests/memory-board.spec.ts
git commit -m "feat(memory): add private boards"
```

### Task 6: Define the sync DTO contract and Supabase gateway

**Files:**
- Create: `src/features/memory/sync/memorySyncContract.js`
- Create: `src/features/memory/adapters/supabase/SupabaseMemoryGateway.js`
- Test: `tests/unit/memorySyncContract.test.mjs`
- Test: `tests/unit/supabaseMemoryGateway.test.mjs`

**Interfaces:**
- Consumes: local entity bundles and `supabase` Auth client.
- Produces: validated DTO builders and the exact gateway methods later tasks call.

```js
gateway.ensureUserProfile(input)
gateway.registerDevice(input)
gateway.promoteGuest(input)
gateway.applyCardMutation(input)
gateway.applyBoardMutation(input)
gateway.pullChanges(input)
gateway.readEntities(input)
gateway.resolveConflict(input)
```

- [ ] **Step 1: Write failing redaction/hash tests**

```js
const dto = toRemoteVisualAsset(localCardBundle);
assert.equal("localRef" in dto, false);
assert.equal("previewDataUrl" in dto, false);
assert.equal(dto.storageScope, "LOCAL_ONLY");
assert.equal(dto.cloudBucket, null);
assert.equal(dto.cloudObjectPath, null);
assert.equal(dto.assetType, "USER_IMAGE");
assert.equal(dto.cardId, localCardBundle.card.id);

const first = await buildMutationRequest(input);
const second = await buildMutationRequest({ ...input, payload: { ...input.payload } });
assert.equal(first.requestHash, second.requestHash);
assert.match(first.requestHash, /^[a-f0-9]{64}$/u);
```

Test all length/item/state bounds and reject a remote response with an unknown field/state/version.

- [ ] **Step 2: Write failing gateway call tests**

With a fake Supabase client, assert exact RPC names and parameter keys. Example:

```js
assert.deepEqual(calls[0], ["apply_memory_card_mutation", {
  p_operation_id: OPERATION_ID,
  p_device_id: DEVICE_ID,
  p_entity_type: "MEMORY_CARD",
  p_entity_id: CARD_ID,
  p_operation_type: "UPSERT",
  p_base_version: 0,
  p_request_hash: REQUEST_HASH,
  p_payload: CARD_DTO,
}]);
```

Assert gateway errors expose only allowlisted codes, not Postgres query text or payload content.

- [ ] **Step 3: Run tests and verify RED**

```powershell
node tests/unit/memorySyncContract.test.mjs
node tests/unit/supabaseMemoryGateway.test.mjs
```

- [ ] **Step 4: Implement pure contract functions**

Export these exact functions:

```ts
export declare function toRemotePrivateTitle(entity: LocalPrivateTitle): RemotePrivateTitleDto;
export declare function toRemoteMemoryCard(bundle: LocalMemoryCardBundle): RemoteMemoryCardDto;
export declare function toRemoteVisualAsset(bundle: LocalMemoryCardBundle): RemoteVisualAssetDto;
export declare function toRemoteBoard(entity: LocalMemoryBoard): RemoteMemoryBoardDto;
export declare function toRemoteBoardCard(entity: LocalMemoryBoardCard): RemoteMemoryBoardCardDto;
export declare function buildMutationRequest(input: MutationInput): Promise<MutationRequest>;
export declare function parseMutationResult(value: unknown): MutationResult;
export declare function parsePullResult(value: unknown): PullResult;
export declare function parsePromotionResult(value: unknown): PromotionResult;
```

`toRemoteMemoryCard` resolves `catalogAnimeId` from the bundle's `LocalAnimeRef`; a missing catalog ID is rejected until the user explicitly maps it or converts it to a PrivateTitle. `toRemoteVisualAsset` maps a completed local image's `imageType: "UNKNOWN"` to remote `assetType: "USER_IMAGE"`, derives `cardId` from the bundle, and strips `localRef`/preview/source-path data.

Use the existing stable serialization style, but only SHA-256 is accepted for remote requests; an FNV fallback must not be sent to the server.

- [ ] **Step 5: Implement the gateway with dependency injection**

The constructor rejects clients without `rpc`/`from`, never imports service-role values, and validates every returned row before exposing it to the application layer.

- [ ] **Step 6: Run tests and verify GREEN**

```powershell
node tests/unit/memorySyncContract.test.mjs
node tests/unit/supabaseMemoryGateway.test.mjs
npm.cmd run test:unit
```

- [ ] **Step 7: Commit the remote contract adapter**

```powershell
git add src/features/memory/sync src/features/memory/adapters/supabase tests/unit/memorySyncContract.test.mjs tests/unit/supabaseMemoryGateway.test.mjs
git commit -m "feat(memory): add Supabase metadata gateway"
```

### Task 7: Register Web Auth profiles and devices without starting sync

**Files:**
- Modify: `src/lib/supabaseClient.js`
- Modify: `src/repositories/authRepo.js`
- Create: `src/features/auth/webOAuth.js`
- Modify: `src/components/auth/AuthCallbackClient.jsx`
- Create: `src/features/memory/runtime/createMemoryAccountRuntime.js`
- Create: `src/features/memory/runtime/platformMemoryAccountRuntime.js`
- Create: `src/hooks/useMemoryAccountSync.js`
- Create: `src/components/data/MemoryAccountPanel.jsx`
- Modify: `src/components/DataCenter.jsx`
- Modify: `src/components/TopNavDataMenu.jsx`
- Modify: `src/messages/en.js`
- Modify: `src/messages/ko.js`
- Test: `tests/unit/webOAuth.test.mjs`
- Test: `tests/unit/memoryAccountRuntime.test.mjs`
- Test: `tests/memory-account-sync.spec.ts`

**Interfaces:**
- Consumes: Supabase Auth session, Task 4 local owner repository, Task 6 gateway.
- Produces: feature-flagged `initializeAccountSession(session)`, profile/device registration, login/logout namespace behavior; sync remains disabled in this task.

- [ ] **Step 1: Write failing account runtime and Web callback tests**

Prove these cases:

```text
flag off → no user RPC and Guest runtime unchanged
Auth session → ensure profile once + register stable device once
same installation reload → same deviceId
sign out → account rows remain, active owner changes to a fresh Guest namespace
sign in account B → account A local namespace is hidden and never merged
profile/device RPC failure → Auth session remains valid, Guest data unchanged
Web callback accepts only a PKCE code, rejects token fragments, and sanitizes next to the current app base
```

- [ ] **Step 2: Write the failing UI E2E state test**

Using injected test Auth/gateway adapters, assert Data Center shows these distinct states without contacting legacy snapshot tables:

```text
Local only
Signed in — promotion available
Signed in — no Guest data
Account initialization failed — retry
```

Capture fake Supabase calls and assert no call targets `user_snapshots`, `user_library_items`, `user_watch_logs`, or `user_character_pins`.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
node tests/unit/webOAuth.test.mjs
node tests/unit/memoryAccountRuntime.test.mjs
npm.cmd run test:e2e -- tests/memory-account-sync.spec.ts --project=chromium --workers=1
```

- [ ] **Step 4: Implement feature-flagged account composition**

Resolve `PUBLIC_MEMORY_ACCOUNT_SYNC_V1 === "1"`. When disabled, return:

```js
{
  enabled: false,
  status: "LOCAL_ONLY",
  initializeAccountSession: async () => null,
  buildPromotionPreview: async () => null,
  promote: async () => null,
  syncNow: async () => null,
}
```

When enabled and authenticated, call `ensureUserProfile` and `registerDevice`, but do not promote or sync without an explicit user action.

Harden the existing Web callback at the same boundary: `AuthCallbackClient` delegates query parsing and base-aware `next` validation to pure `webOAuth.js`, exchanges only a one-time PKCE `code`, and removes the implicit `access_token`/`refresh_token` fallback. Error logging uses an allowlisted code and never prints the callback URL, token, or raw provider error.

- [ ] **Step 5: Replace new Memory UI consumers, not legacy local tools**

`TopNavDataMenu` and `DataCenter` use `useMemoryAccountSync`. Keep manual legacy export/import tools visually labeled as Library/Tier/WatchLog local tools. Do not delete `syncRepo.js`, `useSyncStatus.js`, or legacy tables in this task; ensure the new Memory surfaces no longer import them.

- [ ] **Step 6: Run focused and full verification**

```powershell
node tests/unit/webOAuth.test.mjs
node tests/unit/memoryAccountRuntime.test.mjs
npm.cmd run test:e2e -- tests/memory-account-sync.spec.ts --project=chromium --workers=1
npm.cmd run test:unit
npm.cmd run build
```

Expected: account initialization states pass; existing Memory/Library UI tests remain green.

- [ ] **Step 7: Commit Web account registration**

```powershell
git add src/lib/supabaseClient.js src/repositories/authRepo.js src/features/auth/webOAuth.js src/features/memory/runtime src/hooks/useMemoryAccountSync.js src/components/auth/AuthCallbackClient.jsx src/components/data/MemoryAccountPanel.jsx src/components/DataCenter.jsx src/components/TopNavDataMenu.jsx src/messages/en.js src/messages/ko.js tests/unit/webOAuth.test.mjs tests/unit/memoryAccountRuntime.test.mjs tests/memory-account-sync.spec.ts
git commit -m "feat(auth): register memory accounts and devices"
```

### Task 8: Build deterministic Guest promotion and recovery

**Files:**
- Create: `src/features/memory/application/buildGuestPromotionManifest.js`
- Create: `src/features/memory/application/promoteGuestMemory.js`
- Modify: `src/features/memory/adapters/indexeddb/memoryOwnerStore.js`
- Modify: `src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js`
- Modify: `src/features/memory/runtime/createMemoryAccountRuntime.js`
- Modify: `src/components/data/MemoryAccountPanel.jsx`
- Modify: `src/messages/en.js`
- Modify: `src/messages/ko.js`
- Test: `tests/unit/guestPromotion.test.mjs`
- Modify: `tests/memory-account-sync.spec.ts`

**Interfaces:**
- Consumes: authenticated account, stable device, Guest bundle, catalog bindings, `promoteGuest()` gateway.
- Produces: `buildGuestPromotionManifest`, `resolvePromotionTitleChoice`, `promoteGuestMemory.execute`, `recoverPromotion`.

- [ ] **Step 1: Write failing manifest tests**

For a deterministic Guest fixture assert:

```js
const manifest = await buildGuestPromotionManifest({ repository, guestOwnerId: OWNER_GUEST });
assert.deepEqual(manifest.counts, {
  privateTitles: 1,
  cards: 2,
  visualAssets: 2,
  boards: 1,
  boardCards: 2,
});
assert.deepEqual(manifest.unresolvedAnimeRefs, [ANIME_REF_WITHOUT_CATALOG_ID]);
assert.match(manifest.sourceHash, /^[a-f0-9]{64}$/u);
assert.equal(JSON.stringify(manifest.remoteBundle).includes("localRef"), false);
```

Build the same logical bundle in different insertion order and assert the same hash. A changed note must produce a different hash.

- [ ] **Step 2: Write failing promotion saga tests**

Test the state matrix:

```text
unresolved AnimeRef → RPC not called
explicit catalog choice → local AnimeRef gains catalogAnimeId
explicit personal title → same UUID becomes PrivateTitle and Card reference changes
network failure → Guest rows and active owner unchanged
server COMPLETED + local commit failure → recovery journal remains
retry same operation/hash → no duplicate remote rows, local commit completes
retry same operation/different hash → hard failure, no local owner switch
success → all owner-scoped entities/media operations move to account owner in one local transaction
success → localRef remains local on this device but never appears in remote bundle
success → a new installation Guest owner is created for later signed-out use
```

- [ ] **Step 3: Run tests and verify RED**

```powershell
node tests/unit/guestPromotion.test.mjs
```

- [ ] **Step 4: Implement manifest and title-decision transaction**

`buildGuestPromotionManifest` reads a transactionally consistent owner bundle and returns:

```js
{
  guestOwnerId,
  counts,
  sourceHash,
  encodedByteSize,
  unresolvedAnimeRefs,
  remoteBundle,
}
```

It rejects counts/bytes above the approved hard limits before network access. `resolvePromotionTitleChoice` requires the displayed AnimeRef ID and either an exact `catalogAnimeId` or `KEEP_PRIVATE`; it never accepts a fuzzy title string as identity.

- [ ] **Step 5: Implement the server-first/local-second saga**

The application command signature is:

```ts
type PromoteGuestMemoryInput = {
  userId: string;
  guestOwnerId: string;
  accountOwnerId: string;
  deviceId: string;
  operationId: string;
};

type PromoteGuestMemoryResult = {
  status: "COMPLETED";
  importedCounts: Record<string, number>;
  nextSyncSeq: number;
};
```

Persist a local `STARTED` journal before RPC. Mark it `REMOTE_COMPLETED` with the validated result before attempting the local owner transaction. Local recovery searches only these journals at runtime initialization.

- [ ] **Step 6: Add explicit promotion preview UX**

The panel displays counts, LOCAL_ONLY image limitation, each unresolved title choice, and a single confirmation. Closing/cancelling makes no change. Never imply that logging in alone uploads files.

- [ ] **Step 7: Verify unit and E2E GREEN**

```powershell
node tests/unit/guestPromotion.test.mjs
npm.cmd run test:e2e -- tests/memory-account-sync.spec.ts --project=chromium --workers=1
npm.cmd run test:unit
```

- [ ] **Step 8: Commit Guest promotion**

```powershell
git add src/features/memory/application src/features/memory/adapters/indexeddb src/features/memory/runtime src/components/data/MemoryAccountPanel.jsx src/messages/en.js src/messages/ko.js tests/unit/guestPromotion.test.mjs tests/memory-account-sync.spec.ts
git commit -m "feat(auth): promote guest memory idempotently"
```

### Task 9: Implement outbox push, incremental pull, and explicit conflict resolution

**Files:**
- Create: `src/features/memory/application/syncMemoryMetadata.js`
- Create: `src/features/memory/application/resolveMemoryConflict.js`
- Modify: `src/features/memory/adapters/indexeddb/memorySyncStore.js`
- Modify: `src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js`
- Modify: `src/features/memory/runtime/createMemoryAccountRuntime.js`
- Create: `src/components/data/MemoryConflictDialog.jsx`
- Modify: `src/components/data/MemoryAccountPanel.jsx`
- Modify: `src/hooks/useMemoryAccountSync.js`
- Test: `tests/unit/memorySyncEngine.test.mjs`
- Modify: `tests/memory-account-sync.spec.ts`

**Interfaces:**
- Consumes: Task 6 gateway, promoted account owner, local outbox/cursor.
- Produces: `enqueueMutation`, `flushOutbox`, `pullChanges`, `syncNow`, `resolveConflict`.

- [ ] **Step 1: Write failing sync engine tests**

Test these exact scenarios with fake gateway/repository clocks:

```text
new entity remoteVersion 0 → baseVersion 0 UPSERT → APPLIED version 1
same operation retry → same result and outbox marked APPLIED once
two local updates before flush → ordered operations, second base follows first applied version
remote version mismatch → local row unchanged, conflict persisted
remote change with no pending local operation → applied and cursor advanced
remote change overlapping pending local operation → conflict, cursor advances only after conflict record is durable
remote DELETE vs local stale UPSERT → tombstone wins
pull cursor below retention minimum → full metadata resync
network failure → outbox remains retryable with bounded error code
malformed remote payload → no local mutation and sync status ERROR
account switch during request → stale result discarded
```

- [ ] **Step 2: Write failing conflict UI E2E**

Seed one local note and one remote note for the same Card. Assert the dialog shows title snapshot plus local/cloud note values, allows backup export, and applies only the explicitly selected version. Analytics/test logs must not contain either note.

- [ ] **Step 3: Run tests and verify RED**

```powershell
node tests/unit/memorySyncEngine.test.mjs
npm.cmd run test:e2e -- tests/memory-account-sync.spec.ts --project=chromium --workers=1
```

- [ ] **Step 4: Implement bounded outbox processing**

`flushOutbox({ ownerId, signal })` processes at most 50 operations in creation order and stops on conflict, auth failure, or network failure. It may continue past an `APPLIED` idempotent retry. It returns only counts and codes:

```js
{
  applied: 3,
  conflicts: 0,
  rejected: 0,
  remaining: 2,
  lastErrorCode: null,
}
```

- [ ] **Step 5: Implement pull and full-resync transactions**

`pullChanges` requests at most 200 changes. For each change it fetches only allowlisted entity fields, validates owner/version, and commits row + cursor together. Full resync replaces only clean `SYNCED` metadata in the current account namespace; pending/outbox/conflict rows are preserved and compared against the resync result. It never removes another account namespace, a pending local edit, a conflict backup, or a local file. After the bounded full read commits, the cursor becomes the validated `nextSyncSeq` returned with the full-resync response.

- [ ] **Step 6: Implement explicit conflict resolution**

`resolveMemoryConflict` accepts:

```ts
type ConflictSelection = "KEEP_LOCAL" | "USE_CLOUD";
```

`KEEP_LOCAL` submits `RESOLVE_CONFLICT` using the current remote version. `USE_CLOUD` first writes an exportable local conflict backup record, then applies the validated remote entity. Both mark the conflict resolved only after durable local commit.

- [ ] **Step 7: Run focused and full tests GREEN**

```powershell
node tests/unit/memorySyncEngine.test.mjs
npm.cmd run test:e2e -- tests/memory-account-sync.spec.ts --project=chromium --workers=1
npm.cmd run test:unit
npm.cmd run build
```

- [ ] **Step 8: Commit sync and conflict behavior**

```powershell
git add src/features/memory/application src/features/memory/adapters/indexeddb src/features/memory/runtime src/components/data/MemoryConflictDialog.jsx src/components/data/MemoryAccountPanel.jsx src/hooks/useMemoryAccountSync.js tests/unit/memorySyncEngine.test.mjs tests/memory-account-sync.spec.ts
git commit -m "feat(sync): synchronize memory metadata by entity"
```

### Task 10: Enqueue Card/Board mutations and expose truthful cross-device states

**Files:**
- Modify: `src/features/memory/application/createMemoryCard.js`
- Modify: `src/features/memory/application/updateMemoryCard.js`
- Modify: `src/features/memory/application/deleteMemoryCard.js`
- Modify: `src/features/memory/application/replaceMemoryCardImage.js`
- Modify: `src/features/memory/adapters/indexeddb/IndexedDbMemoryRepository.js`
- Modify: `src/features/memory/components/ArchiveView.jsx`
- Modify: `src/features/memory/components/MemoryCardDetail.jsx`
- Modify: `src/features/memory/components/MemoryVisual.jsx`
- Modify: `src/features/memory/components/MemoryBoardView.jsx`
- Modify: `src/components/DataCenter.jsx`
- Modify: `src/components/TopNavDataMenu.jsx`
- Modify: `src/messages/en.js`
- Modify: `src/messages/ko.js`
- Create: `tests/unit/updateMemoryCard.test.mjs`
- Test: existing Memory command unit tests
- Modify: `tests/memory-account-sync.spec.ts`
- Modify: `tests/memory-card-composer.spec.ts`
- Modify: `tests/memory-board.spec.ts`

**Interfaces:**
- Consumes: Task 9 outbox APIs.
- Produces: every account-owned local content mutation and outbox append in the same IndexedDB transaction.

- [ ] **Step 1: Write failing transaction tests**

For create/update/delete/replace/Board mutations assert:

```text
Guest owner → content changes, no remote outbox
Account owner → content change and outbox append commit together
outbox add failure → content transaction aborts
LOCAL_ONLY image replacement → asset metadata enqueued, localRef excluded
Card delete → Card/asset/membership tombstones enqueued in deterministic order
```

- [ ] **Step 2: Run command tests and verify RED**

```powershell
node tests/unit/createMemoryCard.test.mjs
node tests/unit/updateMemoryCard.test.mjs
node tests/unit/deleteMemoryCard.test.mjs
node tests/unit/replaceMemoryCardImage.test.mjs
node tests/unit/memoryBoard.test.mjs
```

- [ ] **Step 3: Append the outbox in existing local transactions**

Repository methods receive a `syncOperation` only for `ACCOUNT` owners. The operation contains remote DTO, base version, operation ID, request hash, and no image bytes/path. Existing media operation journal remains separate.

- [ ] **Step 4: Render cross-device asset availability honestly**

UI state rules:

```text
SYSTEM_DESIGN + designSpec → render normally on every device
USER_IMAGE + localRef available → render local image
USER_IMAGE + localRef absent + LOCAL_ONLY → show unavailable-on-this-device placeholder
sync error/conflict → Card remains readable and editable locally with status badge
```

Never show catalog cover as a replacement for the user's missing VisualAsset.

- [ ] **Step 5: Remove legacy cloud sync consumers from Memory account surfaces**

The import graph for `TopNavDataMenu`, `DataCenter`, Memory routes, and Board routes must not reach `syncRepo.js`, `snapshotCodec.js`, or `cloudSyncTables.js`. Legacy manual local tools may retain their own imports.

- [ ] **Step 6: Run regression E2E and import-boundary assertions**

```powershell
npm.cmd run test:e2e -- tests/memory-account-sync.spec.ts tests/memory-card-composer.spec.ts tests/memory-board.spec.ts --project=chromium --workers=1
npm.cmd run test:unit
npm.cmd run build
rg -n "syncRepo|snapshotCodec|cloudSyncTables" src/components/TopNavDataMenu.jsx src/components/DataCenter.jsx src/features/memory
```

Expected: tests/build pass; the final `rg` returns no Memory account consumer import.

- [ ] **Step 7: Commit mutation integration**

```powershell
git add src/features/memory src/components/DataCenter.jsx src/components/TopNavDataMenu.jsx src/messages/en.js src/messages/ko.js tests
git commit -m "feat(memory): enqueue account metadata changes"
```

### Task 11: Add Android external-browser OAuth and verified callback handling

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/auth/nativeOAuth.js`
- Modify: `src/repositories/authRepo.js`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Test: `tests/unit/nativeOAuth.test.mjs`
- Test: `tests/android-auth-static.spec.ts`
- Modify: `android/app/src/test/java/com/newrred/moemoa/NativeRoutesTest.java`

**Interfaces:**
- Consumes: Supabase PKCE client and approved custom URI `com.newrred.moemoa://auth/callback`.
- Produces: external Google consent, safe callback exchange, duplicate/cold-start handling, and base-aware local navigation.

- [ ] **Step 1: Add official plugins at verified compatible versions**

```powershell
npm.cmd install --save-exact @capacitor/app@8.1.1 @capacitor/browser@8.0.4
```

These versions declare `@capacitor/core >=8.0.0` and match the current Capacitor 8 project. Do not add a community OAuth plugin or native Google token SDK in this slice.

- [ ] **Step 2: Write failing callback allowlist tests**

```js
assert.deepEqual(parseNativeAuthCallback(
  "com.newrred.moemoa://auth/callback?code=one-time-code"
), { code: "one-time-code" });
assert.equal(parseNativeAuthCallback("https://evil.example/auth/callback?code=x"), null);
assert.equal(parseNativeAuthCallback("com.newrred.moemoa://other?code=x"), null);
assert.equal(parseNativeAuthCallback("com.newrred.moemoa://auth/callback?access_token=x"), null);
```

Test `App.getLaunchUrl()` cold start, `appUrlOpen` warm start, same code handled once, code exchange error redaction, and safe `next` navigation.

- [ ] **Step 3: Write failing Android/static route tests**

The Playwright test asserts the built callback route initializes the Web callback bootstrap. `NativeRoutesTest` separately asserts the manifest includes one VIEW/BROWSABLE callback filter with the exact scheme/host/path. The build/resource scan asserts no service-role string is present in `dist` or merged Android resources.

- [ ] **Step 4: Run tests and verify RED**

```powershell
node tests/unit/nativeOAuth.test.mjs
npm.cmd run test:e2e -- tests/android-auth-static.spec.ts --project=chromium --workers=1
```

- [ ] **Step 5: Implement native PKCE flow**

On native platform, call `signInWithOAuth` with:

```js
{
  provider: "google",
  options: {
    redirectTo: "com.newrred.moemoa://auth/callback",
    skipBrowserRedirect: true,
  },
}
```

Open the returned HTTPS authorization URL with `Browser.open`. The callback installer handles both launch URL and warm events, accepts only exact scheme/host/path, exchanges `code` in the WebView that owns the PKCE verifier, closes the browser, consumes the callback once, and navigates to the sanitized stored `next` path.

- [ ] **Step 6: Add the exact Android intent filter**

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="com.newrred.moemoa"
        android:host="auth"
        android:path="/callback" />
</intent-filter>
```

Keep `launchMode="singleTask"` and existing image Share Target filter unchanged.

- [ ] **Step 7: Sync Android and run automated verification**

```powershell
npm.cmd run build
npm.cmd run android:sync
npm.cmd run android:test
npm.cmd run android:assemble:debug
node tests/unit/nativeOAuth.test.mjs
npm.cmd run test:e2e -- tests/android-auth-static.spec.ts --project=chromium --workers=1
```

Expected: all commands exit 0; no secret in `dist`/APK resource scan.

- [ ] **Step 8: Run physical-device OAuth smoke**

After Preview redirect allowlist is configured, verify:

```text
cold app → Google login → callback → account panel
warm app → login → callback once
cancel Google → Guest data unchanged
kill app during browser → callback relaunch → exchange or safe retry
logout → fresh Guest namespace, account rows hidden
```

- [ ] **Step 9: Commit Android Auth**

```powershell
git add package.json package-lock.json src/features/auth/nativeOAuth.js src/repositories/authRepo.js src/layouts/BaseLayout.astro android/app/src/main/AndroidManifest.xml android/app/src/test/java/com/newrred/moemoa/NativeRoutesTest.java tests/unit/nativeOAuth.test.mjs tests/android-auth-static.spec.ts
git commit -m "feat(android): complete Google OAuth callback"
```

### Task 12: Verify, apply to Preview, rehearse rollback, and document evidence

**Files:**
- Create: `tools/supabase-user-data/verify.mjs`
- Modify: `package.json`
- Modify: `docs/moemoa/reports/unified-user-data-test-evidence.md`
- Modify: `docs/moemoa/README.md`
- Modify: `CODEX_START_HERE.md`
- Modify: `docs/moemoa/08_CODEX_PHASE_RUNBOOK.md`
- Modify: `docs/superpowers/plans/2026-08-26-unified-supabase-user-data.md`

**Interfaces:**
- Consumes: all local implementation tasks and explicit Preview execution approval.
- Produces: local full verification, linked dry-run, additive Preview migration, Preview OAuth/env smoke, feature-flag rollback evidence, and no Production change.

- [ ] **Step 1: Implement an allowlisted verification tool**

The tool requires:

```text
--project-ref okchpyagfucpzpyrfgol
--expected-catalog-count 3998
```

It reads credentials only from environment, refuses another project ref, prints table counts/hashes/grant booleans but never keys/tokens/row notes, and exits nonzero on catalog count/hash regression or unexpected legacy/new table state.

- [ ] **Step 2: Run the complete local verification ladder**

```powershell
npm.cmd run supabase:reset
npm.cmd run supabase:test
npm.cmd run supabase:lint
npm.cmd run test:unit
npm.cmd run test:e2e -- --project=chromium --workers=1
npm.cmd run build
npm.cmd run android:sync
npm.cmd run android:test
npm.cmd run android:assemble:debug
```

Expected: 0 failures. Record counts, skips, environment, and duration rather than only writing “pass”.

- [ ] **Step 3: Run React quality verification**

Use the `react-doctor` skill on the changed React scope. Any regression from the recorded baseline must be fixed or documented before Preview migration.

- [ ] **Step 4: Link and inspect remote migration history read-only**

```powershell
npx.cmd supabase link --project-ref okchpyagfucpzpyrfgol
npx.cmd supabase migration list --linked
npx.cmd supabase db push --linked --dry-run --skip-vault
node tools/supabase-user-data/verify.mjs --project-ref okchpyagfucpzpyrfgol --expected-catalog-count 3998 --mode before
```

Expected: only the four 20260826 migrations appear in dry-run and before counts match the recorded catalog release. If not, stop at the migration-history gate in section 7.3.

- [ ] **Step 5: Request and record explicit Preview mutation approval**

Approval must separately cover:

```text
additive user migrations
Google provider/redirect configuration in project okchpyagfucpzpyrfgol
Preview PUBLIC_SUPABASE_* pointing to the same project as catalog
Preview PUBLIC_MEMORY_ACCOUNT_SYNC_V1=1
temporary test Auth/account rows created by the smoke flow
```

Production env/deployment is not included.

- [ ] **Step 6: Apply additive migrations after approval**

```powershell
npx.cmd supabase db push --linked --skip-vault
node tools/supabase-user-data/verify.mjs --project-ref okchpyagfucpzpyrfgol --expected-catalog-count 3998 --mode after
```

Expected: new user tables exist empty, RLS/grants/RPC signatures match, the named retention job exists once and is active, and catalog counts/hash remain unchanged.

- [ ] **Step 7: Configure Google and Preview variables without exposing secrets**

In Supabase Dashboard, enable Google on the current catalog project and add only approved Web Preview callback patterns plus:

```text
com.newrred.moemoa://auth/callback
```

In Vercel Preview, set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to the same project as the catalog client, then set `PUBLIC_MEMORY_ACCOUNT_SYNC_V1=1`. Do not put the Google client secret or service-role key in Vercel client variables.

- [ ] **Step 8: Execute Preview user-flow smoke**

Verify with one test account and two client contexts:

```text
Guest creates system-design Card and local-image Card
→ login and preview counts
→ promote
→ second Web context sees both metadata rows
→ system design renders
→ local image shows unavailable-on-this-device
→ offline note edit on each context creates conflict
→ explicit choice resolves without hidden LWW
→ delete beats stale edit
→ Card in two Boards preserves N:M semantics
→ fixed-time retention test preserves 29-day tombstones, purges 31-day tombstones, and forces an expired cursor to full resync
→ logout isolates account rows
```

Delete only the explicitly identified test Auth user/rows if cleanup is approved; otherwise retain them as labeled Preview test data. Never issue a broad table delete.

- [ ] **Step 9: Rehearse non-destructive rollback**

Set Preview `PUBLIC_MEMORY_ACCOUNT_SYNC_V1=0` and redeploy Preview. Verify local Guest/Card/Archive/Board and catalog search still work, account UI becomes local-only, and remote rows remain intact. Re-enable only after the rollback evidence is recorded.

- [ ] **Step 10: Update canonical execution status and commit evidence**

```powershell
git add tools/supabase-user-data/verify.mjs package.json docs/moemoa/reports/unified-user-data-test-evidence.md docs/moemoa/README.md CODEX_START_HERE.md docs/moemoa/08_CODEX_PHASE_RUNBOOK.md docs/superpowers/plans/2026-08-26-unified-supabase-user-data.md
git commit -m "docs: record unified user data verification"
```

- [ ] **Step 11: Run final verification before branch handoff**

```powershell
git diff master...HEAD --check
git status --short
git log --oneline --decorate master..HEAD
```

Then invoke `superpowers:requesting-code-review`, resolve findings, rerun affected checks, and use `superpowers:finishing-a-development-branch` for the integration choice. Do not push, merge, or deploy Production without the user's separate instruction.

## 9. 테스트와 검증

### 9.1 Automated ladder

| Layer | Command | Proves |
| --- | --- | --- |
| DB reset | `npm.cmd run supabase:reset` | migrations reproduce from zero |
| DB contract | `npm.cmd run supabase:test` | schema/RLS/RPC/idempotency/conflict |
| DB lint | `npm.cmd run supabase:lint` | PL/pgSQL type/control-flow checks |
| JS unit | `npm.cmd run test:unit` | owner/Board/promotion/sync/gateway behavior |
| Web E2E | `npm.cmd run test:e2e -- --project=chromium --workers=1` | account/Board/Memory UI and regressions |
| Static build | `npm.cmd run build` | Astro output and secret-free client bundle |
| Android sync | `npm.cmd run android:sync` | current Web artifact copied to shell |
| Android unit | `npm.cmd run android:test` | native route/intake callback contracts |
| APK | `npm.cmd run android:assemble:debug` | buildable Android artifact |

### 9.2 Required security scenarios

- `anon` cannot read/write user tables or execute private RPCs.
- Auth user A cannot read, mutate, reference, or infer user B content/device/promotion/operation.
- Direct `authenticated` INSERT/UPDATE/DELETE is denied.
- Same operation ID/hash is idempotent; hash mismatch is rejected.
- Malformed/oversized payload cannot reach persistent rows.
- Secret/service-role scan reports zero client/APK findings.
- Auth callback rejects foreign scheme/host/path and implicit token fragment.

### 9.3 Required data-safety scenarios

- v1 local data survives v2 upgrade unchanged.
- Promotion network/remote/local-commit failures keep a recoverable source.
- Account switch never merges namespaces.
- Outbox and local content commit atomically.
- Explicit conflict selection is required for divergent user notes.
- Tombstone wins against stale update.
- Catalog count/hash/cover remains unchanged.
- LOCAL_ONLY user image never enters remote DTO, logs, analytics, export evidence, or another device.

### 9.4 Manual Preview/device matrix

| Surface | Minimum |
| --- | --- |
| Web | Chromium desktop + 390px mobile viewport, two isolated browser contexts |
| Android | one API 36 emulator plus one physical supported device |
| Network | online, offline edit, reconnect, interrupted promotion |
| Auth | success, cancel, duplicate callback, cold callback, logout/account switch |
| Visual | system design cross-device, USER_IMAGE unavailable placeholder |

## 10. 보안·개인정보·권리 영향

- Remote user rows are private metadata with own-row SELECT and RPC-only mutation.
- `security definer` functions use empty `search_path`, schema-qualified objects, explicit `auth.uid()`, and exact execute grants.
- Device `localRef`, file path, preview data URL, source URI, image bytes, note text, Board title, and search query are excluded from ordinary logs/analytics.
- Promotion preview shows data counts and title decisions but never image bytes or absolute paths.
- User image rights metadata may sync, but this does not grant cloud storage or Public use.
- Catalog cover remains a presentation asset and is never substituted into a Memory VisualAsset.
- Account deletion cascade capability exists at FK level, while deletion UX/retention/recovery remains blocked by `PRIVACY-01`.
- Google provider secret stays in Supabase/Google configuration; service-role stays in approved local/CI secret storage only.

## 11. 관찰 가능성·분석 이벤트

No new analytics vendor is added. Existing telemetry adapter remains disabled unless separately approved. Test spies and local diagnostic status may emit only:

```text
account_session_initialized { platform, resultCode }
guest_promotion_previewed { cardCountBucket, unresolvedTitleCount }
guest_promotion_finished { resultCode, entityCountBucket }
memory_sync_started { platform, pendingCountBucket }
memory_sync_finished { resultCode, appliedCountBucket, conflictCountBucket }
memory_conflict_resolved { entityType, selection }
```

Never attach user ID, email, note, image reference/hash, title, Board name, or full operation UUID to analytics. Operational DB verification records counts/hash/grant booleans only.

## 12. 롤백·복구

### Client rollback

- Set `PUBLIC_MEMORY_ACCOUNT_SYNC_V1=0`.
- Catalog client and local Memory runtime continue independently.
- Do not delete local account namespaces or remote rows.
- Existing legacy local export tools remain available but are not a Memory sync fallback.

### Local schema recovery

- Never downgrade IndexedDB from v2 to v1.
- v2 stores are additive; old v1 Card/media stores remain readable.
- A failed post-open promotion/sync migration stays in a journal and does not change active owner.
- Feature off leaves new stores intact for a fixed build or explicit export.

### Remote migration rollback

- Before real users: feature flag off is the primary rollback; additive tables/functions may remain dormant.
- After any real user row exists: no table/function drop, owner rewrite, or bulk delete without counts/export/new approval.
- Function regression is rolled forward with a new timestamped migration; never edit an already-applied migration.
- Catalog migrations/bucket/release are outside rollback scope and must remain unchanged.

### Promotion/sync recovery

- `STARTED` with no remote result retries same operation/hash.
- `REMOTE_COMPLETED` retries local commit only.
- Conflict keeps both local and validated remote payload until explicit resolution.
- Cursor-expired devices perform full metadata resync while preserving local file availability.

## 13. 위험과 완화

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Dirty UI/APK work mixed into branch | lost/accidental unrelated changes | worktree isolation and exact staged manifest |
| Remote migration history mismatch | catalog migration replay | linked list + dry-run; stop and repair only after exact audit |
| `createAnimeRef` lacks catalog ID | Card cannot map to remote schema | preserve `catalogAnimeId`; explicit unresolved-title choice |
| Legacy `useSyncStatus` calls missing tables after env cutover | repeated cloud errors | replace consumers before setting `PUBLIC_SUPABASE_*` |
| Promotion RPC payload too large | timeout/partial expectation | exact 2 MiB/entity caps, preflight, no local change on reject |
| Local commit fails after remote promotion | apparent duplicate/loss | `REMOTE_COMPLETED` journal and idempotent recovery |
| Cross-account stale async response | namespace contamination | generation/user token guard on every async mutation |
| Google OAuth in embedded WebView | provider rejection/insecure UX | official external Browser + App callback plugins |
| Custom URI hijack | callback interception | exact Android scheme/host/path; one-time PKCE code; no token fragment |
| User assumes images are backed up | trust/data-loss risk | explicit LOCAL_ONLY/unavailable copy before and after promotion |
| Generic RPC grows unsafe | privilege escalation | entity allowlist, separate Card/Board RPCs, pgTAP negative cases |
| Tombstone purge loses slow-device changes | resurrection/full-sync gap | 30-day retention, minimum cursor, forced full resync |
| Board implementation expands account scope | schedule risk | complete local Board as its own reviewer gate before sync |

## 14. 필요한 사용자 결정과 실행 게이트

이 계획을 작성하는 데 추가 제품 결정은 필요하지 않다. 실행 중 다음 항목은 별도 승인이 필요하다.

1. 남은 First Private Slice gate를 닫았는지, account 작업을 먼저 하도록 순서를 명시적으로 바꾸는지.
2. Preview remote additive migration 적용.
3. Current catalog Supabase project에서 Google provider와 callback allowlist 변경.
4. Vercel Preview의 `PUBLIC_SUPABASE_*` 및 `PUBLIC_MEMORY_ACCOUNT_SYNC_V1=1` 설정.
5. Preview test Auth/metadata 생성과 선택적 cleanup.
6. Production migration/env/deployment. 이 계획의 기본 범위에서는 계속 보류한다.

`IMAGE-SYNC-01`, `STORAGE-01`, `PRIVACY-01`, Public 관련 gate는 이 계획으로 확정되지 않는다.

## 15. 진행 기록

```text
[2026-08-26] 완료: BACKEND-01/AUTH-01/SYNC-01/수정 LEGACY-01 설계 승인.
[2026-08-26] 완료: 실제 repository, current dirty state, local DB v1, legacy snapshot sync, Auth callback, Android manifest, Supabase migration/toolchain 상태 재검토.
[2026-08-26] 발견: Docker client는 설치됐으나 daemon은 실행 중이 아니며 Supabase CLI는 project에 아직 pin되지 않음.
[2026-08-26] 발견: Supabase catalog candidate의 anime:<uuid>가 local AnimeRef에 저장되지 않아 promotion 전 catalog binding 보완이 필요함.
[2026-08-26] 결정 반영: legacy cloud sync consumer를 신규 Memory account surface에서 제거하되 legacy local code/data는 삭제하지 않음.
[2026-08-26] 상태: 이 ExecPlan 작성만 수행. 제품 코드, local/remote DB, OAuth, Vercel env는 변경하지 않음.
[2026-08-26 15:54] 완료: Task 0 Steps 1~3 / worktree feat/unified-supabase-user-data@f00e81c / unit 119 pass, Web build 12 pages, Android unit 30 pass, debug APK 11,520,657 bytes.
[2026-08-26 15:54] 발견: fresh worktree Android 검증은 generated Cordova Gradle file 때문에 android:sync를 먼저 요구함. sync 후 동일 test/build 통과.
[2026-08-26 15:54] 차단: First Private Slice 독립 사용자·Android 실기기·export/orphan/rollback gate가 남아 있어 FIRST_SLICE_GATE 승인 값 필요.
[2026-08-26 16:01] 변경: First Private Slice 완결 후 account 순서 → FIRST_SLICE_GATE=EXPLICITLY_REORDERED_BY_USER / 사용자가 account·sync 구현 선행을 명시 승인 / remote·Preview·Production gate는 유지.
[2026-08-26 16:12] 완료: Task 1 / Supabase CLI 2.115.0 exact pin, local scripts, generated-state ignore, Web·Android callback allowlist를 추가하고 secret-free config를 확인.
[2026-08-26 16:12] 검증: local catalog migration 2개 reset·parity PASS, DB lint 0 errors, 기존 unit 119 pass, Web build 12 pages.
[2026-08-26 16:12] 환경 발견: Windows Docker Desktop 4.63.0의 안전한 기본 설정에서는 Vector의 Docker log source가 닫힌 2375 포트에 연결하지 못함. core stack은 `--exclude vector`로 정상 검증했으며 비암호화 Docker API는 열지 않음.
[2026-08-26 16:12] 범위: local Docker와 feature worktree만 변경. remote Supabase, Vercel, OAuth provider, 사용자 데이터에는 변경 없음.
[2026-08-26 16:26] 완료: Task 2 / 신규 정규화 user table 11개, same-owner composite FK 6개, sync·tombstone·PRIVATE/LOCAL_ONLY 제약과 승인 index 구현.
[2026-08-26 16:26] TDD: migration 전 pgTAP 18/19 expected FAIL → migration 후 19/19 PASS. pgTAP schema overload는 description 인자로 명확히 고정.
[2026-08-26 16:26] 검증: local reset migration 3개 PASS, DB lint 0 errors, catalog table 6개 보존, 신규 table 11개/row 0, legacy compatibility table 0.
[2026-08-26 16:26] 검증: 임시 transaction에서 valid insert와 title-source XOR, cross-owner FK, note 10,000자, PRIVATE, tombstone, LOCAL_ONLY cloud-null, current-asset uniqueness를 확인하고 rollback.
[2026-08-26 16:26] 범위: local migration/test와 feature worktree 문서만 변경. RPC/RLS/retention 및 remote Supabase 적용은 Task 3 이후 gate로 유지.
[2026-08-28 11:36] 완료: Task 3 / public RPC 7개, owner RLS 11개, direct write 차단, deferred COMPLETE_PRIVATE asset invariant, 30일 retention/cron 구현.
[2026-08-28 11:36] TDD: security/RPC missing-feature RED 확인 → local reset 후 pgTAP 92/92 PASS, DB lint 0 errors.
[2026-08-28 11:36] 발견 및 보완: 현재 entity에서 operation 결과를 재구성하면 후속 mutation 뒤 idempotent replay가 달라짐 → bounded result_payload snapshot으로 최초 결과를 고정하고 회귀 테스트 1개 추가.
[2026-08-28 11:36] 검증: SECURITY DEFINER 8개 모두 empty search_path, authenticated RPC grant 정확히 7개, private function execute 0개, RLS table 11개, write grant 0개, daily cron 1개, catalog table 6개/anon read 보존.
[2026-08-28 11:36] 범위: local Supabase와 feature worktree만 변경. remote Supabase, Vercel, OAuth provider, 실제 사용자 데이터에는 변경 없음.
[2026-09-02 09:44] 완료: Task 4 / Account·Guest active owner, catalogAnimeId 보존, IndexedDB v2 13-store schema, owner-scoped sync 준비 저장소 구현.
[2026-09-02 09:44] TDD: owner/catalog/schema focused test 4개 파일 expected RED → focused 32/32 PASS, 전체 unit 129/129 PASS, Chromium IndexedDB 3/3 PASS, Web build 12 pages.
[2026-09-02 09:44] 검증: moemoa-memory-v1 이름 유지, 기존 v1 Card note/owner 보존, anime-collector-db 미접근, Account owner 재시작 후 활성 상태 및 catalogAnimeId 영속화 확인.
[2026-09-02 09:44] 범위: local IndexedDB/domain/runtime와 feature worktree 문서만 변경. remote Supabase, Vercel, OAuth provider, 실제 사용자 데이터에는 변경 없음.
```

실행자는 각 Task 완료 시 다음 형식으로 한 줄을 추가한다.

```text
[YYYY-MM-DD HH:MM] 완료: Task N / commit <hash> / tests <exact result>
[YYYY-MM-DD HH:MM] 발견: <repository or runtime fact>
[YYYY-MM-DD HH:MM] 변경: <old plan> → <new plan> / <reason> / <approval>
[YYYY-MM-DD HH:MM] 차단: <exact gate and required action>
```

## 16. 발견 사항과 계획 변경 규칙

다음 발견은 계획 안에서 구현 세부로 처리할 수 있다.

- 기존 helper 이름과 충돌하지 않는 파일명 조정.
- 테스트 fixture ID/시간 변경.
- PostgreSQL planner가 요구하는 추가 non-semantic index.
- UI copy의 뜻을 유지하는 간결한 번역 조정.

다음 발견은 구현을 멈추고 설계/결정 승인을 다시 받아야 한다.

- Guest promotion이 entity UUID를 유지할 수 없음.
- User image file upload가 metadata sync 성공에 필요함.
- Direct table mutation 또는 service-role browser 사용이 필요함.
- Account 간 자동 merge가 필요함.
- Current catalog project를 사용할 수 없어 backend project가 다시 분리됨.
- Public policy/bucket이 private metadata 구현에 필요함.
- Destructive local/remote migration이 필요함.

## 17. 완료 보고

완료 보고는 다음을 실제 값으로 채운다.

```text
Goal achieved:
Final commit:
Changed files:
DB migrations applied locally:
DB migrations applied remotely:
Before/after user table counts:
Catalog count/hash regression check:
Unit result:
pgTAP result:
Web E2E result:
Android unit/APK result:
Physical-device OAuth result:
Promotion retry/local-commit recovery result:
Conflict/tombstone result:
Feature-flag rollback result:
Secrets/privacy/rights review:
Known limitations:
Remaining approval gate:
```

Do not mark the plan complete if remote migration or Preview verification was intentionally deferred; instead record the highest completed Task and exact remaining gate.

## 18. 공식 구현 참고

- [Supabase CLI local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase database testing and pgTAP](https://supabase.com/docs/guides/database/testing)
- [Supabase database functions and function privileges](https://supabase.com/docs/guides/database/functions)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase redirect URLs and mobile deep links](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase Cron and pg_cron jobs](https://supabase.com/docs/guides/cron)
