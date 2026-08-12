# MOEMOA 저장소 감사 보고서

> **문서 상태: `EVIDENCE_SNAPSHOT`**
> 아래 구현 사실은 `master@e71f211`, 2026-08-11 기준이다. 코드·설정·migration이 바뀌면 재검증한다.

작성일: 2026-08-11  
감사 기준: `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`, `docs/moemoa/03_REPOSITORY_AUDIT_PROTOCOL.md`  
감사 대상: `D:/hong/Web/Anime/anime-collector`의 `master` / `e71f211`  
감사 성격: 구현 전 read-only 감사. 제품 코드, 설정, lockfile, 데이터, DB는 변경하지 않았다.

## 1. 결론

현재 저장소는 **AniList 중심의 개인 애니 감상 기록 Web/PWA**로서는 실행 가능한 기반을 갖고 있다. Astro/React 화면, 모바일 대응, 로컬 저장, JSON 백업, Google OAuth, Supabase RLS 초안, 계정 전환 중 stale mutation 방지, 단위/E2E 테스트 일부는 재사용 가치가 높다.

그러나 확정된 MOEMOA의 핵심인 **이미지 우선 Memory Card → 자동 Archive → N:M Board**, Android Share Target/Photo Picker, 내부 작품 ID와 출처 추적, 계정별 local-first 저장, 이미지 수명주기, Public UGC 안전장치는 아직 구현되어 있지 않다. 기존 구조를 그대로 확장하면 다음 문제가 제품 기반에 고착될 가능성이 높다.

1. `anilistId`가 작품의 내부 ID이자 저장소 PK로 사용된다.
2. 동일 브라우저에서 로컬 데이터가 계정별로 분리되지 않는다.
3. 이미지 파일을 수집·보관·동기화·삭제하는 경로가 없다.
4. 현재 Tier와 Public Showcase는 새 Board/Public Memory Card의 데이터 모델이 아니다.
5. Public 기능이 신고·차단·심사·삭제·kill switch 없이 이미 코드 경로에 존재한다.

따라서 첫 구현 전에는 `MemoryCard`, `VisualAsset`, `Anime/PrivateTitle`, `Board/BoardCard`, 익명 workspace/계정 ownership, 동기화·삭제 계약을 확정해야 한다. 기존 기능은 아래 분류에 따라 `KEEP / ADAPT / MIGRATE / ISOLATE / DEPRECATE`한다.

## 2. 감사 범위와 당시 상태

먼저 다음 지침·제품·감사 문서를 읽고 source hierarchy를 적용했다.

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `docs/moemoa/03_REPOSITORY_AUDIT_PROTOCOL.md`
- `docs/moemoa/06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `docs/moemoa/07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md`
- `docs/moemoa/references/2026-08-06-product-direction-decision-draft.md`
- repository `README.md`, package/build/test/deploy 설정

확정 결정은 `01_CONFIRMED...`을 우선하고, 과거 메모와 draft는 비교·근거 자료로만 사용했다.

### 2.1 Git과 작업 트리

- Git root: `D:/hong/Web/Anime/anime-collector`
- branch: `master`
- HEAD 및 `origin/master`: `e71f211 docs: define memory card and board product direction`
- 최근 이력: `e71f211`, `f5a4c2a`, `7f22545`, `a527e14`, `a763ac8`
- package manager: npm. `package-lock.json`이 존재하며 `package.json:5-21`에 실행 script가 있다.
- 감사 시작 시 bootstrap 문서 묶음, `docs/moemoa/`, `docs/product/MOEMOA_PRODUCT_BASELINE.md`, `debug.log` 등이 이미 untracked 상태였다. 이 감사에서는 삭제·이동·정리하지 않았다.

검증 명령:

```text
git status --short --branch
git log -5 --oneline --decorate
git ls-files .github .env.example docs/deploy OWNER_DEPLOY_GUIDE.md VERCEL_SETUP.md
```

### 2.2 저장소 형태와 기술 스택

- 단일 npm package이며 workspace/monorepo 선언은 없다 (`package.json:1-36`).
- Astro 5 + React 19 + Supabase JS + Vercel Analytics + Playwright 구성이다 (`package.json:23-36`).
- Astro server adapter와 `output: "server"`가 없어 정적 사이트로 빌드된다 (`astro.config.mjs:6-11`).
- 저장소 내 별도 API 서버, ORM, queue worker, Android Gradle 프로젝트는 발견되지 않았다.
- Vercel 설정과 GitHub Pages 배포 workflow가 모두 존재한다 (`vercel.json:1-29`, `.github/workflows/astro.yml:5-92`). 현재 사용자가 Vercel을 `master`와 연결했다고 했으므로 canonical production은 Vercel로 추정되지만, 실제 GitHub Pages 활성 상태는 `UNKNOWN`이다.

## 3. 실행 및 테스트 감사

### 3.1 확인한 명령

```text
npm run test:unit
npm run build
npm run test:e2e -- --project=chromium
npm run test:e2e -- tests/index.spec.ts --project=chromium --workers=1
npm run test:e2e -- tests/library-userflow.spec.ts --project=chromium --workers=1
npm run test:e2e -- --project=chromium --workers=1
rg --files -g "*gradle*" -g "AndroidManifest.xml" -g "capacitor.config.*" -g "assetlinks.json" -g "*.kt" -g "*.java"
node -e "const fs=require('node:fs');const rows=JSON.parse(fs.readFileSync('src/data/aliases.json','utf8'));const ids=new Set(rows.map(x=>x.anilistId));const empty=rows.filter(x=>!Array.isArray(x.aliases)||x.aliases.length===0).length;console.log(JSON.stringify({rows:rows.length,uniqueAniListIds:ids.size,emptyAliasRows:empty,fields:[...new Set(rows.flatMap(x=>Object.keys(x)))].sort()}))"
```

Android/Gradle/Capacitor 검색은 0건이었다. aliases 집계 결과는 `{"rows":3998,"uniqueAniListIds":3998,"emptyAliasRows":23,"fields":["aliases","anilistId","ko"]}`였다.

설치/개발/정적 검사 상태:

- `README.md:214-215`는 `npm install`, `npm run dev`를 안내한다. 감사에서는 dependency 설치·upgrade와 lockfile 변경을 금지했으므로 `npm install`/`npm ci`를 실행하지 않고 이미 존재한 dependency 환경만 사용했다.
- `npm run dev`는 별도로 장시간 실행하지 않았다. E2E runner가 테스트 범위에서 Astro dev server를 `127.0.0.1:4321`에 시작하고 종료했다 (`scripts/run-e2e.mjs:1-4`, `scripts/run-e2e.mjs:44-51`).
- `package.json:5-21`에는 lint, format, typecheck/check script가 없다. `@astrojs/check`와 TypeScript는 dev dependency지만 실행 계약이 없으므로 임의의 `npx astro check`, formatter, lint를 실행하지 않았다 (`package.json:33-36`).
- `npm run preview`는 script로 존재하지만 production build 검증에 추가 이득이 제한적이어서 실행하지 않았다 (`package.json:5-9`).

### 3.2 결과

| 검증 | 결과 | 해석 |
| --- | --- | --- |
| Unit | 40/40 통과 | migration, sync ownership guard, durability, presentation, watch-log source 관련 기반은 현재 통과 |
| Production build | 8개 page 빌드 성공 | 정적 배포 가능. `useUiPreferences` chunk 약 844KB, gzip 약 319KB 경고 존재 |
| Chromium E2E, 기본 병렬 설정 | 30 통과, 2 스킵, 6 실패 | 초기 화면 요소 탐색 실패와 mobile/desktop fixture 120초 timeout. 로컬 병렬 cold-start 안정성 문제 |
| `index.spec.ts`, 1 worker | 7/7 통과 | 핵심 shell은 순차 실행에서 통과 |
| `library-userflow.spec.ts`, 1 worker | 7 통과, live-only 2 스킵 | fixture 기반 주요 Library 흐름 통과 |
| 전체 Chromium, 1 worker | 36 통과, live-only 2 스킵, 실패 0 | 약 1분 42초. Playwright의 CI-mode worker 설정과 같은 단일 worker에서 통과; 현재 GitHub workflow가 E2E를 실행한다는 뜻은 아님 |

lint/typecheck/format 결과는 “통과”가 아니라 **미구성/미실행**이다. `astro check`를 향후 CI gate로 추가할지는 구현 단계에서 별도 변경 승인을 받아야 한다.

Playwright 설정은 Chromium/Firefox/WebKit을 정의하지만 mobile project는 주석 처리되어 있다 (`playwright.config.ts:43-73`). CI 설정은 npm install/build만 수행하며 unit/E2E/typecheck를 필수 gate로 실행하지 않는다 (`.github/workflows/astro.yml:68-80`).

현재 E2E의 외부 검색 흐름은 fixture 중심이고 live-only 2건은 기본 실행에서 skip된다 (`tests/library-userflow.spec.ts:242-261`, `tests/library-userflow.spec.ts:551-570`). 실제 AniList/Wikidata contract, production Supabase RLS/OAuth, provider kill switch, image URL validation, private→public leak, moderation, Android lifecycle을 검증하는 integration/E2E는 발견되지 않았다.

판정:

- 테스트 자산과 Playwright의 CI 1-worker 설정: `KEEP / ADAPT`
- 로컬 기본 병렬 실행 안정성: `ADAPT`
- Android 실제 기기, OAuth/RLS live, PWA update, 이미지 lifecycle 테스트: `UNKNOWN / 신규 필요`

## 4. Web과 PWA

### 4.1 라우트와 렌더링

현재 라우트는 `/`, `/library/`, `/tier/`, `/data/`, `/profile/`, `/u/`, `/help/`, `/auth/callback/`이다 (`src/pages/*.astro`). 주요 제품 화면은 모두 `client:only="react"`로 렌더링된다 (`src/pages/index.astro:2-6`, `src/pages/library.astro:2-6`, `src/pages/tier.astro:2-6`, `src/pages/profile.astro:2-6`).

Private Archive 성격의 앱에는 client-only가 치명적이지 않지만, 향후 공개 Board/Profile 검색 노출에는 다음이 부족하다.

- 공개 사용자 URL이 `/u/[handle]/`이 아니라 `/u/?handle=...` 형태다 (`src/components/PublicProfilePage.jsx:45`).
- 공통 title 외 description, canonical, Open Graph 카드가 없다 (`src/layouts/BaseLayout.astro:43-54`).
- 공개 콘텐츠를 서버/빌드 시점에 렌더링하지 않는다.

판정:

- 공통 Web shell, locale/theme, 반응형 기반: `KEEP`
- Archive/Card 화면: `ADAPT`
- 향후 공개 페이지 routing/SSR/SEO: `MIGRATE`

### 4.2 PWA

설치 manifest와 service worker 등록은 존재한다 (`public/manifest.webmanifest:1-23`, `public/register-sw.js:25-53`). auth callback과 query URL을 cache bypass하고 navigation에 network-first fallback을 사용한다 (`public/sw.js:15-22`, `public/sw.js:41-82`).

부족한 항목:

- manifest `share_target`과 file handler 없음
- 이미지 수신용 service worker/route 없음
- background sync와 이미지 upload queue 없음
- cache version이 고정 `v1`
- precache가 홈/Tier 중심이며 Archive/Data/Profile 전체를 포함하지 않음 (`public/sw.js:1-9`)
- Android App Link용 `assetlinks.json` 없음

판정: 설치·offline shell은 `KEEP / ADAPT`, Android 이미지 intake 기반으로는 불충분하다.

## 5. Android 현황

`AndroidManifest.xml`, Gradle, Kotlin/Java, Capacitor/Cordova 설정, Digital Asset Links는 검색 결과 0건이었다. 다음 기능도 없다.

- Android Share Target/Intent filter
- Android Photo Picker
- 앱 전용 이미지 파일 복사
- SQLite/Room 등 Android local DB
- WorkManager/offline operation queue
- Android OAuth callback/App Link
- FCM/push

현재 Web deep link는 `/library/?animeId=&focus=` 정도다 (`src/domain/search/quickActionActions.js:89-98`, `src/components/Library.jsx:624-642`). 360px/390px Web viewport 회귀 테스트는 존재하지만 실제 Android lifecycle 검증을 대신하지 못한다 (`tests/layout-mobile.spec.ts:4-95`).

판정: 모바일 반응형 UI는 `KEEP`, Android 앱 기반은 신규 구현이다. 구체 옵션은 `architecture-options.md`에서 비교한다.

## 6. 현재 도메인과 저장 구조

### 6.1 Library

Library는 작품당 하나의 tracker record다. `anilistId`로 중복 제거하며 IndexedDB key와 클라우드 PK도 같은 외부 ID를 사용한다 (`src/domain/animeState.js:45-93`, `src/storage/idb.js:47-52`, `docs/deploy/supabase-split-sync.sql:4-16`).

주요 값은 상태, 점수, 메모, 재시청 횟수/일자다. 이는 MOEMOA의 `AnimeRef` 또는 legacy 보관함 index로는 활용할 수 있지만, 한 작품에 여러 개 만들 수 있고 VisualAsset이 필요한 Memory Card는 아니다.

판정: `MIGRATE`.

### 6.2 WatchLog

WatchLog는 작품당 여러 record를 허용하며 `cue`, `note`, context tag, 시점 점수, 캐릭터 reference를 보유한다 (`src/repositories/watchLogRepo.js:128-159`, `src/repositories/watchLogRepo.js:192-227`). 날짜·짧은 기억 신호는 Memory Card seed로 재사용할 수 있다.

다만 VisualAsset이 없으므로 기존 WatchLog를 자동으로 Complete Card로 승격하면 확정된 CARD-01과 충돌한다. 기본 이전은 `DRAFT` 또는 별도 `LegacyMemorySignal`이어야 한다.

판정: `ADAPT + MIGRATE`.

### 6.3 TierTopic

현재 Tier는 Anime ID를 S/A/B/C/D 등에 배치하는 랭킹 구조다 (`src/domain/tierTopics.js:24-58`, `src/domain/tierTopics.js:81-107`). 여러 topic은 지원하지만 관계의 주체가 `MemoryCard.id`가 아니라 `anilistId`다.

확정된 Board는 Card↔Board N:M이며 Board에서 membership을 지워도 원본 Card를 지우지 않아야 한다 (`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:41-50`). 현재 Tier를 자동으로 Board로 바꾸는 것은 의미 손실과 오분류 위험이 있다.

판정: drag/drop·정렬 UX 일부는 `ADAPT`, 저장 모델은 `ISOLATE / MIGRATE`. 자동 migration 여부는 사용자 결정 필요.

### 6.4 새 도메인 부재

다음 핵심 entity는 구현 코드와 SQL에서 발견되지 않았다.

- `Anime`의 MOEMOA 내부 ID와 source identifier mapping
- `PrivateTitle`
- `MemoryCard`의 Draft/Complete 상태
- `VisualAsset`과 storage/rights/moderation metadata
- `Archive` query/index
- `Board`, `BoardCard` N:M membership와 position
- `DeviceIdentity` 또는 익명 workspace owner
- entity tombstone와 영속 `SyncOperation`

이는 첫 vertical slice 전에 schema와 invariant로 확정해야 한다.

## 7. 로컬 저장, 계정, 동기화

### 7.1 로컬 저장

전역 localStorage key는 계정/익명 workspace namespace가 없다 (`src/storage/keys.js:1-23`). IndexedDB v1은 `library_items`, `watch_logs`, `character_pins`, `tier_state`, `media_cache`, `search_cache`, `meta`를 가진다 (`src/storage/idb.js:1-10`, `src/storage/idb.js:37-87`).

중단 가능한 legacy migration이 IDB와 localStorage를 병합하고 마지막에 완료 marker를 기록하는 패턴은 보존 가치가 높다 (`src/storage/legacyMigration.js:68-125`). 반면 localStorage와 IDB가 원본/mirror 역할을 혼합하는 현재 구조는 새 cross-platform 저장 계약으로 가져가면 안 된다.

Library와 Tier의 일반 UI 갱신은 `useStoredState`로 localStorage에 쓰고 (`src/hooks/useStoredState.js:4-11`), IDB에는 `mirrorOnly`로 반영한다 (`src/components/Library.jsx:313-390`, `src/components/TierBoard.jsx:170-171`, `src/components/TierBoard.jsx:362-370`). 이 경로는 `markLocalDirty()`를 호출하지 않으므로 `sync.pending` 기반 자동 동기화가 누락될 수 있다 (`src/repositories/libraryRepo.js:18-23`, `src/repositories/tierRepo.js:63-69`). 자동 sync hook도 현재 `/data`의 `DataCenter`에서만 `autoSync: true`로 사용한다 (`src/components/DataCenter.jsx:11-34`).

판정:

- migration 재실행 안전 패턴: `KEEP`
- repository boundary: `ADAPT`
- 전역 key와 이중 원본 구조: `MIGRATE`
- dirty tracking 누락: 기존 서비스 결함으로 별도 수정 필요

### 7.2 인증과 ownership

Supabase client는 PKCE, session persistence, token refresh를 설정하고 Google OAuth를 사용한다 (`src/lib/supabaseClient.js:3-17`, `src/repositories/authRepo.js:40-52`). Web 인증 경로 자체는 재사용 가능하다.

그러나 로그아웃은 Supabase session만 종료하며 로컬 제품 데이터를 계정별로 분리하거나 지우지 않는다 (`src/repositories/authRepo.js:55-63`). 같은 브라우저에서 A 로그아웃 후 B 로그인 시 A의 Library/로그가 계속 보이거나 B의 sync 후보가 될 수 있다. 계정별로 분리된 것은 sync baseline metadata 일부뿐이다 (`src/repositories/syncRepo.js:397-468`).

확정된 local-first 요구에는 익명 workspace를 생성하고, 로그인 시 해당 owner를 계정으로 안전하게 승격하며, 계정 전환 시 local namespace를 분리하는 규칙이 필요하다.

판정:

- Web PKCE: `KEEP`
- Android OAuth redirect: `ADAPT`
- guest→account promotion과 account-scoped local DB: `MIGRATE`

### 7.3 Supabase sync

브라우저가 Supabase에 직접 접근한다. private table에는 본인 행만 접근하는 RLS SQL이 있다 (`docs/deploy/supabase-user-snapshots.sql:11-40`, `docs/deploy/supabase-split-sync.sql:57-176`). 실제 운영 프로젝트에 이 SQL과 동일한 정책이 배포됐는지는 `UNKNOWN`이다.

현재 구조는 split record table과 tier snapshot, 과거 full snapshot fallback이 섞여 있다 (`src/repositories/syncRepo.js:29-33`, `src/repositories/syncRepo.js:125-215`). 빈 split table이 “전부 삭제”인지 “migration 전”인지 명시 marker 없이 구분하기 어려우며, 과거 snapshot 부활 위험이 있다 (`src/repositories/syncRepo.js:138-155`). 다섯 저장 작업은 서버 transaction 없이 순차 실행된다 (`src/repositories/syncRepo.js:356-394`). conflict는 record/field 단위가 아니라 전체 local 또는 cloud 선택이다 (`src/hooks/useSyncStatus.js:180-186`, `src/hooks/useSyncStatus.js:469-530`).

계정 전환 중 stale operation 차단과 guarded mutation은 재사용 가치가 높다 (`src/services/syncOperationCoordinator.js:6-47`, `src/services/guardedMutationSteps.js:10-23`).

판정:

- own-row RLS 패턴, stale mutation guard: `KEEP`
- conflict UI: `ADAPT`
- revision/tombstone/atomic commit 또는 record sync: `MIGRATE`
- 수동 SQL 파일: versioned migration 체계로 `MIGRATE`

## 8. 카탈로그와 외부 데이터

### 8.1 AniList/Wikidata 결합

브라우저에서 AniList GraphQL과 Wikidata/WDQS를 직접 호출한다 (`src/lib/anilist.js:1-82`, `src/lib/wikidata.js:2-6`, `src/lib/wikidata.js:123-177`). UI와 search domain이 provider 응답/함수를 직접 import하므로 provider abstraction이 없다 (`src/components/AddAnime.jsx:2-6`, `src/components/Library.jsx:3`, `src/domain/search/quickActionRemote.js:1-6`).

검색어가 외부 provider로 전송되므로 privacy disclosure와 logging 금지 규칙이 필요하다. retry/TTL cache는 유지할 수 있지만 내부 DTO와 `CatalogProvider` 뒤로 격리해야 한다.

판정:

- timeout/retry/cache 패턴: `KEEP`
- provider direct import: `ISOLATE / ADAPT`
- `anilistId` 중심 identity: `MIGRATE`

### 8.2 aliases 데이터

`src/data/aliases.json`은 감사 시점 3,998행, 고유 AniList ID 3,998개였고 필드는 `anilistId`, `ko`, `aliases`뿐이다 (`src/data/aliases.json:1-16`). 23행은 alias 배열이 비어 있다. source, retrievedAt, parser version, license, review status가 없다.

`package.json:18-21`의 catalog script가 참조하는 수집 script들은 checkout에 없고 `.gitignore:40-56` 대상이다. 따라서 현재 데이터는 재현 가능한 ingestion 결과로 검증할 수 없다.

판정: 전부 `legacy_unverified`로 격리하고 검색 fallback으로만 사용한다. 삭제나 공용 catalog 승격은 승인된 mapping과 provenance migration 전에는 금지한다.

### 8.3 권리 상태

AniList, AniLife, Wikidata 데이터·이미지의 현재 상업 이용, 영구 저장, 재배포, hotlink 허용 범위는 이 저장소 증거만으로 확정할 수 없다. 모두 `UNKNOWN`이다. 권리 검토 전에는 provider image kill switch와 system design fallback이 필요하다.

## 9. 이미지 수명주기

현재 제품의 이미지는 사용자 `VisualAsset`이 아니라 AniList가 반환한 poster/banner/character 외부 URL이다 (`src/lib/anilist.js:85-190`, `src/components/Library.jsx:1830-1834`). 유일한 file input은 JSON 복원용이다 (`src/components/data/ManualDataTools.jsx:305-319`).

없는 기능:

- 이미지 MIME/크기/dimension 검증
- 앱 전용 로컬 복사와 원본 URI 유실 처리
- thumbnail/resize/EXIF 제거
- `LOCAL_ONLY / PRIVATE_CLOUD / PUBLIC` storage scope
- Supabase Storage bucket, signed URL, ACL
- retry 가능한 upload/delete operation
- export manifest와 byte backup
- provider/image type별 kill switch
- rights basis와 moderation metadata

WatchLog/CharacterPin은 캐릭터 외부 image URL을 snapshot으로 저장하고 cloud row에도 포함한다 (`src/components/Library.jsx:1587-1593`, `src/domain/cloudSyncTables.js:99-134`, `docs/deploy/supabase-split-sync.sql:33-47`). JSON import의 image URL은 허용 scheme/host 검증이 부족한 채 공개 SVG 렌더링에 사용될 수 있다 (`src/domain/snapshotCodec.js:185-205`, `src/domain/snapshotCodec.js:246-263`, `src/components/showcase/ShowcaseGrid.jsx:376-377`). 이는 임의 외부 resource 요청과 tracking 가능성을 만들므로 URL validation/allowlist가 필요하다.

판정: 기존 외부 URL은 `ISOLATE`, 새 VisualAsset pipeline은 local-only부터 신규 구현한다.

## 10. Public UGC와 개인정보

현재 로그인 사용자는 feature flag 없이 profile 생성, public showcase publish, follow/unfollow를 실행할 수 있다 (`src/components/ProfileCenter.jsx:290-348`, `src/repositories/showcaseRepo.js:123-142`, `src/repositories/profileRepo.js:222-239`, `src/repositories/profileRepo.js:314-339`). public snapshot은 private WatchLog의 cue/note/tag와 외부 poster/character URL을 파생해 포함한다 (`src/domain/showcase/showcaseSelectors.js:111-123`, `src/domain/showcase/showcaseSelectors.js:354-386`, `src/domain/showcase/showcaseSelectors.js:432-465`, `src/domain/showcase/showcaseSelectors.js:590-608`).

다음 안전장치는 발견되지 않았다.

- 약관/정책 version 동의 기록
- 콘텐츠/사용자 신고와 차단
- moderation queue와 관리자 역할
- takedown, appeal, strike/suspension
- 감사 로그와 처리 SLA
- public/image type별 feature flag와 kill switch
- 명시적인 unpublish/delete repository 경로

follow graph는 anon select가 허용되는 SQL 정책을 갖는다 (`docs/deploy/supabase-social.sql:82-87`). 실제 production 적용 여부는 `UNKNOWN`이지만, public 전환 전 privacy 결정을 다시 받아야 한다.

판정: `/profile`, `/u`, publish, follow와 관련 public data path 전체를 `ISOLATE`. 일반 UGC gate와 이미지 유형별 권리 gate를 모두 통과하기 전 기본값은 off여야 한다.

## 11. 분석, 로그, 보안, 운영

- production에서 Vercel Analytics가 공통 layout에 로드된다 (`src/layouts/BaseLayout.astro:3`, `src/layouts/BaseLayout.astro:9-10`, `src/layouts/BaseLayout.astro:62`). custom product event schema는 없다.
- auth callback도 공통 layout을 사용한다 (`src/pages/auth/callback.astro:7-22`). service worker의 callback/query cache bypass와 same-origin `next` 검사는 좋은 기반이지만 (`public/sw.js:15-22`, `src/components/auth/AuthCallbackClient.jsx:23-42`), callback에서 Analytics를 별도 비활성화하지 않는다. Vercel Analytics가 query/hash를 실제 수집하는지는 `UNKNOWN`이므로 확인 전에는 callback telemetry를 격리하는 편이 안전하다.
- crash/error collector와 release tagging은 없다. 여러 화면이 raw `console.error(error)`를 사용하며 sync metadata에 raw message가 저장될 수 있다 (`src/repositories/syncRepo.js:485-488`).
- 자유 텍스트 note/cue, 검색어, image URL을 analytics/log에 보내지 않는 중앙 redaction 규칙이 없다.
- `vercel.json:6-27`에 nosniff, frame deny, referrer, permissions policy가 있으나 CSP는 없다. `camera=()`는 향후 Web capture 요구와 충돌할 수 있다.
- account deletion UI, retention map, image/object delete 검증, backup/PITR/region 정보가 없다.
- README가 언급하는 `.env.example`은 없고 `.gitignore:75`가 해당 파일을 무시한다. 배포 가이드 파일도 현재 checkout에 없거나 ignore 대상이다 (`README.md:121-133`, `README.md:293-299`, `.gitignore:75-77`).

판정:

- 기본 security header: `KEEP / ADAPT`
- event taxonomy, redaction, error monitoring: 신규 구현
- delete/retention/backup 운영 계약: `UNKNOWN`, PRIVACY-01에서 결정

## 12. 2026-08-10 방향 메모와 현재 코드의 차이

`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md`는 MOEMOA를 일반 tracker가 아니라 개인 Memory Card/Archive/Board로 정의하고, private beta를 먼저 검증하도록 제안한다 (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:64-104`, `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:298-358`). 현재 코드는 이 메모 이전의 tracker 구조가 대부분 유지된 상태다.

| 2026-08-10 메모의 방향 | 현재 코드 | 판정 |
| --- | --- | --- |
| 한 작품에 여러 Memory Card, Card N:M Board (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:334-353`, `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:507-510`) | Library와 Tier가 `anilistId` 중심이고 MemoryCard/BoardCard entity가 없음 (`src/domain/animeState.js:45-93`, `src/domain/tierTopics.js:24-58`) | 구현 전, `MIGRATE` |
| Card가 Archive에 자동 축적되고 2~3개 후 Board 제안 (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:380-382`, `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:470-481`) | WatchLog resurfacing selector만 있고 Complete Card Archive/Board prompt가 없음 (`src/domain/homeSelectors.js:22-84`) | `ADAPT + 신규` |
| 기본 디자인과 선택적 기기 local image (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:518-533`, `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:693-700`) | 이미지 file input/store가 없고 AniList 외부 URL을 표시 (`src/components/data/ManualDataTools.jsx:305-319`, `src/components/Library.jsx:1830-1834`) | `MIGRATE`; 외부 이미지는 `ISOLATE` |
| 로그인 없는 local 사용 + 선택 sync (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:518-533`, `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:752`) | 로그인 없이 local 사용은 되지만 account/guest namespace가 없고 snapshot sync 중심 (`src/storage/keys.js:1-23`, `src/repositories/syncRepo.js:125-215`) | 기반 `KEEP`, ownership/sync `MIGRATE` |
| AniList runtime 의존 제거, aliases를 `legacy_unverified`로 격리 (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:594-614`, `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:1006-1034`) | AniList/Wikidata direct runtime call과 `anilistId` PK가 유지됨 (`src/lib/anilist.js:1-82`, `src/lib/wikidata.js:123-177`, `src/storage/idb.js:47-60`) | `ISOLATE + MIGRATE` |
| Public SNS·광고·대형 catalog를 반복 사용 검증 전 보류 (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:99-104`) | public profile/showcase/follow 코드 경로가 feature flag 없이 존재 (`src/components/ProfileCenter.jsx:290-348`, `src/repositories/showcaseRepo.js:123-142`) | 현재 결정과 충돌, 우선 `ISOLATE` |
| 분석 event, 오류 관찰, image kill switch (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:518-533`, `docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:804-821`) | Vercel page analytics만 있고 custom event/error collector/image kill switch 없음 (`src/layouts/BaseLayout.astro:3`, `src/layouts/BaseLayout.astro:62`) | 신규 필요 |
| import한 목록은 자동 Memory Card로 만들지 않음 (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:485-490`) | snapshot v5는 legacy model만 처리하며 새 migration은 아직 없음 (`src/domain/snapshotCodec.js:307-321`, `src/domain/snapshotCodec.js:636-662`) | 향후 migration의 필수 보존 원칙 |

메모의 Card 완료 규칙은 “제목만으로 완료되지 않으며 기억 신호를 남긴다”는 제품 탐색 관점이었다 (`docs/moemoa/references/2026-08-10-product-direction-research-integrated.md:387-406`). 이후 확정 문서는 이를 `Anime 또는 PrivateTitle + VisualAsset 1개`로 더 엄격하게 고정했고, 사용자 image가 없으면 system design VisualAsset을 만든다 (`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:22-39`). 구현은 최신 확정 결정을 따른다.

메모가 제안한 출시 단계와 지표는 방향성 자료로는 유효하지만, 실제 code 상태·Android 기술·이미지 권리·backend 운영 확인이 끝나지 않았으므로 실행 확정안으로 취급하지 않는다.

## 13. 재사용 분류 요약

### KEEP

- Astro/React Web shell과 반응형 기반
- locale/theme bootstrap
- WatchLog의 다중 기록과 기억 신호 일부
- 중단 후 재실행 가능한 legacy migration 패턴
- JSON export/restore의 기본 UX
- Google PKCE Web 인증
- own-row RLS의 기본 패턴
- 계정 전환 중 stale mutation guard
- unit/E2E fixture 기반

### ADAPT

- Library/WatchLog UI → Memory Card/Archive 작성·회상 UI
- Tier drag/drop interaction → Board membership UX
- repository/service 경계
- PWA 설치·offline shell
- conflict/export UI
- 공개 페이지 routing/SEO
- CI 검증 단계

### MIGRATE

- `anilistId` PK → MOEMOA 내부 Title ID + provider identifier mapping
- Library/WatchLog → AnimeRef/LegacyMemorySignal/MemoryCard draft
- TierTopic → 별도 Board/BoardCard 모델
- 전역 localStorage/IDB → guest/account별 local DB
- 혼합 snapshot sync → versioned entity sync와 tombstone
- 수동 SQL → versioned migration
- aliases → `legacy_unverified` staging

### ISOLATE

- AniList/Wikidata 직접 호출
- provider poster/banner/character URL
- 현재 profile/showcase/follow 경로
- E2E mock auth
- GitHub Pages production deployment 후보
- 출처/권리 미확정 legacy 데이터

### DEPRECATE 후보

- 재현 불가능한 catalog 수집 script 계약
- 목적이 확인되지 않는 IDB `media_cache` store (`src/storage/idb.js:8`, `src/storage/idb.js:73-77`)
- 새 Board와 의미가 겹치지 않는 legacy Tier naming

즉시 삭제는 금지한다. migration과 rollback 경로 승인 후에만 `REMOVE`로 전환할 수 있다.

## 14. 상위 5개 구현 Gap

1. **도메인/ID Gap** — 내부 `Anime`, `PrivateTitle`, `MemoryCard`, `VisualAsset`, `BoardCard`와 invariant가 없다.
2. **Android 이미지 intake Gap** — Share Target, Photo Picker, 앱 전용 파일 저장, lifecycle 복구가 전무하다.
3. **ownership/sync Gap** — guest workspace와 account-scoped local DB가 없고 snapshot 중심 sync가 Android 동시 편집에 부족하다.
4. **카탈로그/권리 Gap** — 외부 provider와 `anilistId`에 직접 결합되며 aliases provenance와 이미지 이용 범위가 불명확하다.
5. **Public 안전/운영 Gap** — 기존 공개 경로는 활성 코드지만 moderation, delete, audit, flag, kill switch가 없다.

## 15. 다른 역사 문서와 현재 결정의 충돌

감사 시작 전에 존재하던 `docs/product/MOEMOA_PRODUCT_BASELINE.md`에는 Complete Card를 “title + memory signal” 중심으로 기술한 부분이 있다. 반면 현재 최상위 확정 결정은 `Anime 또는 PrivateTitle + VisualAsset 1개`를 Complete 조건으로 명시한다 (`docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md:22-39`).

현재 source hierarchy에서는 `docs/moemoa/01...`이 우선한다. 이전 baseline을 구현 근거로 동시에 사용하면 Draft/Complete migration 규칙이 갈라지므로, 다음 문서 정리 때 baseline을 `superseded`로 표시하거나 Decision Log에 차이를 병합해야 한다. 이 감사에서는 어느 문서도 수정하지 않았다.

## 16. 확인 불가 항목

다음은 저장소만으로 사실처럼 확정하지 않는다.

- 운영 Supabase schema/RLS/Storage/Edge Function의 실제 상태
- production 데이터와 실사용자 수, legacy snapshot 규모
- Supabase region, backup, PITR, retention, processor 계약
- GitHub Pages가 실제로 활성 배포 중인지
- AniList/AniLife/Wikidata 데이터와 이미지의 현재 이용 조건
- `aliases.json`의 정확한 원본, 수집일, parser와 검수 이력
- Vercel Analytics의 callback URL query/hash 수집 동작
- Android minSdk, Play Store/TWA 허용 여부
- private image backup quota, region, format과 삭제 기간
- Public profile/showcase가 production에서 실제 활성화되었는지

이 항목은 계정/인프라 read-only 확인, 이용약관·법률 검토 또는 사용자 결정 없이는 `UNKNOWN`으로 유지한다.
