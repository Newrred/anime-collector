# Unified Supabase User Data 테스트 증거

> **상태: `IN PROGRESS — TASK 12 LOCAL NON-DB CHECKS COMPLETE / EXTERNAL GATES BLOCKED`**
> 시작일: 2026-08-26
> ExecPlan: `../../superpowers/plans/2026-08-26-unified-supabase-user-data.md`
> Worktree: `D:\hong\Web\Anime\anime-collector\.worktrees\unified-supabase-user-data`
> Branch/base: `feat/unified-supabase-user-data` / `f00e81c`

## 1. Task 0 workspace preservation

- 원래 `master` 작업공간의 미커밋 UI/APK 파일은 staging, checkout, reset, 삭제 없이 그대로 보존했다.
- repository의 ignored `.worktrees/` 아래에 별도 worktree를 생성했다.
- 구현 branch에는 계획 커밋 이외의 원래 미커밋 파일을 복사하지 않았다.

## 2. Toolchain

| 항목 | 결과 |
| --- | --- |
| Project Node | `24.19.0` — package engine `>=22 <27` 충족 |
| npm CLI | `10.8.2` |
| Dependency install | PASS, `npm ci` |
| npm audit summary | 25건: low 2, moderate 9, high 14; 자동 수정 미실행 |

기본 PowerShell의 Node 20으로 실행한 최초 `npm ci`는 engine warning을 냈다. 이후 모든 기준선 검증은 Codex bundled Node 24.19.0으로 다시 설치한 dependency를 사용했다.

## 3. Baseline verification

| 명령 | 결과 | 증거 |
| --- | --- | --- |
| `npm run test:unit` | PASS | 119 passed, 0 failed, 0 skipped |
| `npm run build` | PASS | Astro static 12 pages |
| `npm run android:sync` | PASS | fresh worktree의 Capacitor generated files 생성 |
| `npm run android:test` | PASS | 30 tests, 0 failures, 0 skipped |
| `npm run android:assemble:debug` | PASS | `app-debug.apk`, 11,520,657 bytes |

Known baseline warnings:

- Vite는 `useUiPreferences` client chunk 867.04 kB에 대해 500 kB warning을 출력한다.
- Android Gradle은 `flatDir`, SDK XML tool-version mismatch, unchecked operation warning을 출력한다.
- 이번 Task에서는 dependency version, bundle splitting, Gradle/SDK 설정을 변경하지 않았다.

## 4. Clean-checkout finding

fresh worktree의 최초 `android:test`는 아래 generated file이 없어 실패했다.

```text
android/capacitor-cordova-android-plugins/cordova.variables.gradle
```

제품 코드 실패가 아니라 clean checkout setup 누락이었다. `android:sync` 실행 후 같은 `android:test`와 `android:assemble:debug`가 통과했다. 후속 기준선·CI 명령은 Android test 전에 `android:sync`를 실행해야 한다.

## 5. Ordering gate

현재 canonical 문서상 First Private Slice에는 다음이 남아 있다.

- 설명 없는 독립 사용자의 전체 acceptance.
- Android 적용과 물리 실기기 검증.
- ZIP export, 전체 filesystem orphan scan, 최종 rollback rehearsal.

따라서 `FIRST_SLICE_GATE=CLOSED`는 기록하지 않았다. 사용자는 2026-08-26 16:01 KST에 남은 First Private Slice 항목보다 이 ExecPlan의 계정·동기화 구현을 먼저 진행하도록 다음 값을 명시적으로 승인했다.

```text
FIRST_SLICE_GATE=EXPLICITLY_REORDERED_BY_USER
```

이 승인은 Production 배포, Preview migration, Google provider 설정, Vercel 환경 변경, Public/UGC, 사용자 이미지 cloud upload 승인이 아니다. 해당 항목은 ExecPlan의 개별 실행 게이트를 그대로 유지한다.

## 6. Task 1 local Supabase toolchain

| 항목 | 결과 |
| --- | --- |
| Supabase CLI | PASS, exact `2.115.0` dev dependency 및 lockfile pin |
| npm scripts | PASS, start/stop/reset/test/lint contract 일치 |
| generated state | PASS, `supabase/.temp/`, `supabase/.branches/` ignore |
| Auth callback allowlist | PASS, loopback 2개와 Android custom scheme 1개 |
| secret hygiene | PASS, `config.toml`에 Google secret 또는 원격 credential 없음 |
| local API | PASS, `http://127.0.0.1:54321` |
| local migrations | PASS, catalog migration 2개 reset 및 local history 일치 |
| DB lint | PASS, 0 schema errors |
| existing regression | PASS, unit 119 tests 및 Web 12-page build |

`supabase:test`는 Task 2에서 pgTAP contract test를 처음 추가한 뒤 실행한다. CLI 2.115.0은 test file이 0개이면 실패하므로 Task 1에서는 script 존재와 명령 contract만 검증하고, 빈 test suite를 성공으로 오인하지 않았다.

### Windows Vector local limitation

Docker Desktop 4.63.0의 현재 안전한 설정에서는 Supabase Vector container가 `http://host.docker.internal:2375`의 Docker log source에 연결하지 못하고 재시작했다. DB, Auth, REST, Storage, Studio 등 core service는 모두 정상 상태였고 migration reset 및 lint도 통과했다.

Docker daemon을 비암호화 TCP 2375로 노출하지 않았다. 대신 실행 중인 local stack을 정상 종료한 뒤 아래 명령으로 Vector 로그 수집기만 제외해 core stack을 재기동하고 검증했다.

```powershell
npm.cmd run supabase:start -- --exclude vector
```

이 제한은 local Analytics/Studio Logs 가시성에만 해당한다. Task 1의 범위에서는 원격 Supabase project, hosted catalog data, OAuth provider, Vercel environment를 읽거나 변경하지 않았다.

## 7. Task 2 schema TDD

### RED

Migration을 만들기 전에 `memory_user_schema.test.sql`을 먼저 작성하고 실행했다.

```text
Files=1, Tests=19, Failed=18
Result: FAIL
```

신규 user table·column·index 18개가 없어서 실패했고, 계획대로 legacy `user_snapshots` 부재 검사 1개만 통과했다.

Migration 적용 직후 첫 GREEN 시도에서는 실제 DB에 11개 table이 존재했지만 pgTAP 검사가 계속 실패했다. 로컬 함수 정의와 공식 pgTAP signature를 확인한 결과, 설명이 없는 문자열 인자가 `schema/table` 대신 `table/description` overload로 해석된 것이 원인이었다. 각 schema assertion에 명시적인 description 인자를 추가해 대상 schema/table/column/index를 고정했다.

### GREEN

| 검증 | 결과 |
| --- | --- |
| `supabase:reset` | PASS, catalog 2개 + user schema 1개 migration 적용 |
| schema pgTAP | PASS, 19/19 |
| `supabase:lint` | PASS, 0 schema errors |
| catalog table 보존 | PASS, 6/6 |
| 신규 user table | PASS, 11/11 |
| 신규 user row | PASS, 0 |
| legacy compatibility table | PASS, 0 |
| same-owner composite FK | PASS, 6/6 |
| required partial/sequence index | PASS, 2/2 |

임시 SQL transaction에서 정상 Profile/Device/PrivateTitle/Card/VisualAsset insert를 수행한 뒤 아래 위반이 실제 constraint로 거부되는 것도 확인했다.

- Card title source가 0개 또는 2개인 경우.
- 다른 user의 PrivateTitle을 참조하는 경우.
- note가 10,000자를 초과하거나 visibility가 `PRIVATE`이 아닌 경우.
- DRAFT Card에 tombstone이 설정된 경우.
- `LOCAL_ONLY` VisualAsset에 cloud path를 저장하는 경우.
- 한 Card에 active current asset을 두 개 저장하는 경우.

검증 fixture와 행은 transaction 종료 시 모두 rollback했다.

### Explicit operational bounds

설계에서 숫자 없이 `bounded`로 표현된 필드는 보수적인 DB 상한을 명시했다.

| 필드 | 상한 |
| --- | --- |
| locale | 35자, BCP-47 형태 검사 |
| time zone, app version, rewatch intent | 각 100자 |
| normalized private title | 160자 |
| imported counts JSON | UTF-8 representation 4 KiB |
| preference payload, system design spec | 각 UTF-8 representation 32 KiB |
| MIME type | 255자 |
| Board position key | 128자 |

RPC, deferred Complete Card invariant, RLS, grants, retention maintenance는 Task 3 범위로 남겼다. 원격 Supabase에는 migration을 적용하지 않았다.

## 8. Task 3~11 구현 증거 요약

| Task | commit | 핵심 결과 | 검증 |
| ---: | --- | --- | --- |
| 3 | `c0239c6` | owner RLS 11개, RPC 7개, direct write 차단, 30일 tombstone/cron | local pgTAP 92/92, DB lint 0 errors |
| 4 | `e0f159f` | Account/Guest owner, catalog ID, IndexedDB v2 sync stores | unit 129/129, real IDB 3/3, build 12 pages |
| 5 | `894ad5` | Private Board CRUD와 N:M membership, `/boards/` | unit 135/135, Board E2E 3/3, build 13 pages |
| 6 | `1cd3200` | remote DTO redaction, SHA-256 request, Supabase gateway | unit 146/146, build 13 pages |
| 7 | `831f298` | feature-flagged Web account runtime, PKCE callback, profile/device | unit 158/158, account E2E 5/5 |
| 8 | `2291917` | 명시적 Guest promotion과 server-first/local-second 복구 journal | unit 164/164, account/IDB E2E 10/10 |
| 9 | `f0c19d1` | entity outbox push/pull, conflict, tombstone, cursor full-resync | 관련 unit/E2E와 build 통과 |
| 10 | `e24c80a` | Card/Board mutation 원자 outbox와 cross-device 상태 | unit 176/176, focused E2E 26/26, real IDB 7/7 |
| 11 | `a098d5c` | Capacitor Browser/App 기반 Android external OAuth callback | unit 180/180 당시, Android static 2/2, Android unit/APK PASS |

Task 11의 물리기기 Google OAuth는 연결된 Android 기기가 없어 아직 실행하지 않았다. 구현은 exact `com.newrred.moemoa://auth/callback`, one-time PKCE code exchange, cold/warm callback, 중복 callback 차단을 자동 검증한다.

## 9. Task 12 로컬 검증 — 2026-09-02

### 완료

| 항목 | 결과 |
| --- | --- |
| allowlisted remote verifier | `okchpyagfucpzpyrfgol` 외 project 거부, Management API read-only endpoint만 사용 |
| catalog regression guard | target/search/detail/assets/cover 3,998 및 현재 hosted release hash `8af2e0…3bb4c` 고정 |
| secret boundary | access token은 환경변수 전용, 출력은 count/hash/boolean만 허용 |
| JS unit | 185 passed, 0 failed, 0 skipped |
| Chromium E2E | 103 passed, 0 failed, 3 intentional live skips, 2.8분 |
| Astro build | 13 pages, PASS |
| React Doctor | changed scope 100/100, issue 0 |
| Android sync | Web 13 pages + `@capacitor/app`, `@capacitor/browser` 2 plugins |
| Android unit | 31 passed, 0 failed, 0 skipped |
| Android APK | 14,807,372 bytes, SHA-256 `457416CF43EF488EB01CB62B738043A6213A8F0A40C26AE068B225A8231CEBCC` |

전체 E2E 첫 실행은 신규 Memory account 문구로 바뀐 뒤 남아 있던 legacy `Unavailable`/이전 local-only 문구 assertion 1건 때문에 102 pass, 3 skip, 1 fail이었다. 실제 패널은 `Local only`, Guest namespace, cloud backup 미주장을 올바르게 표시했다. 테스트를 현재 계약으로 교정한 뒤 대상 10/10과 전체 103/103이 통과했다.

### 현재 환경 차단

- Docker Desktop 앱과 `com.docker.service`가 정지 상태다. Codex의 비관리자 세션에서는 service를 시작할 수 없어 Task 12의 fresh `supabase:reset/test/lint` 재실행이 남았다. Task 3 시점의 마지막 실제 local DB 결과는 pgTAP 92/92 및 lint 0 errors다.
- 현재 process/user/machine scope에 `SUPABASE_ACCESS_TOKEN`이 없어서 CLI link와 Management API read-only BEFORE 검증을 실행하지 못했다.
- 원격 migration, Google provider/callback, Vercel Preview env, test Auth row, Production에는 변경을 가하지 않았다.

### Remote read-only BEFORE audit

연결된 Supabase 커넥터로 project `okchpyagfucpzpyrfgol`을 읽기 전용 조회했다.

- project는 `moemoa-preview`, Singapore, `ACTIVE_HEALTHY`다.
- 원격 migration은 `20260819021327 catalog_preview_read_model`, `20260819021408 catalog_preview_foreign_key_indexes` 두 개뿐이다.
- 로컬 catalog migration의 SQL 의미는 원격 6개 table/column/constraint, RLS policy 6개, index 14개, 함수 2개와 권한, Storage bucket/policy와 일치했다.
- 로컬 파일 timestamp를 원격 이력과 동일하게 정렬했다. 원격 migration repair나 DB mutation은 실행하지 않았다.
- hosted active release는 `catalog-v2-8af2e03bc80789f59b4eaf7c`, hash `8af2e03bc80789f59b4eaf7c2d6904242561ddafecd3b6c9f7351f0a8cb3bb4c`다.
- active target/search/detail/assets/cover는 각각 3,998, people page/row는 각각 4,899다.
- 신규 user table 11개, legacy `user_snapshots`, Auth user는 모두 0이다.

로컬 외부 workspace의 현재 Projection v2 pointer는 역사적으로 기록된 `52487f…f556` release를 가리키지만 hosted active release는 위 `8af2e0…3bb4c`다. 이번 user migration의 회귀 기준은 실제 변경 대상인 hosted BEFORE hash로 고정했다. 두 catalog release 내용의 차이를 임의로 업로드하거나 활성화하지 않는다.

공식 Supabase 계약상 local stack은 실행 중인 Docker-compatible runtime이 필요하며, remote read-only query는 `database_read` 권한이 있는 access token을 요구한다. 두 환경 조건이 준비되면 Task 12 Step 2와 Step 4를 재개한다. Step 5의 명시적 Preview mutation 승인은 그 결과가 일치한 뒤 별도로 받는다.
