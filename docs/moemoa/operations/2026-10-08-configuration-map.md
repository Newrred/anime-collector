# MOEMOA 운영 설정 지도

> 확인 기준: 2026-10-08 KST, Git `master` 및 운영 Web `adba637024cef78a576dbe5b6289f442c159fd73`.
> 이 문서는 **현재 설정의 위치와 적용 경로**를 기록한다. 비밀키의 값, 사용자 기록, 사진 원본은 기록하지 않는다. 시간이 지나면 대시보드 값을 다시 확인한다.

## 먼저 구분할 것

| 층 | 맡는 일 | 변경 위치 | 적용 시점 |
| --- | --- | --- | --- |
| Git의 웹 설정 | 화면 노출, 브라우저가 연결할 공개 주소, 빌드 동작 | `.env.production`, `vercel.json`, `astro.config.mjs`, 웹 코드 | `master`를 통한 새 Vercel 빌드 후 |
| Vercel Project 환경 변수 | 운영 서버 API의 연결·비밀값·작동 여부, 일부 웹 빌드 값 | `anime-collector`의 **Production** 변수 | 새 배포 후. 기존 배포에는 소급되지 않음 |
| Supabase 운영 프로젝트 | 로그인, 데이터·이미지 저장, RLS, DB 정책·한도 | 프로젝트 Dashboard와 적용된 SQL | Dashboard 변경 또는 운영 SQL 적용 후 |
| GitHub Actions | 예약 작업의 실행 여부·대상·호출 자격 | Repository Variables/Secrets와 `.github/workflows/` | 다음 예약 실행/수동 실행부터. 워크플로 변경은 Git push 후 |
| 개발 PC | 로컬 서버·CLI 개발 설정 | `.env.local`, `supabase/config.toml` | 이 PC에만 적용. Git 이전 대상 아님 |

운영 사이트는 `https://www.moemoa.xyz`, Git 저장소는 `https://github.com/Newrred/anime-collector`, Vercel 프로젝트는 `newrreds-projects/anime-collector`이다. Supabase 운영 프로젝트의 참조 ID는 `okchpyagfucpzpyrfgol`이다. **프로젝트 표시 이름이 `moemoa-preview`여도 현재 운영 사이트가 사용하는 DB**이며 Dashboard에는 `main PRODUCTION`으로 표시된다. 운영 Web `/build-info.json`의 commit과 Git `master` SHA는 위 확인 시점에 일치했다.

**중복 이름의 우선순위:** Vercel Production에 같은 이름의 환경 변수가 있으면 빌드 과정에서 Git의 `.env.production` 값보다 우선한다. Production, 일반 Preview, `codex/phone-test` 전용 Preview, Development는 서로 다른 범위다. `PUBLIC_` 변수는 브라우저 코드에 포함될 수 있으므로 비밀값을 넣지 않는다. [Astro 환경 변수](https://docs.astro.build/en/guides/environment-variables/), [Vite의 로딩 우선순위](https://vite.dev/guide/env-and-mode/), [Vercel 환경 변수와 배포](https://vercel.com/docs/environment-variables).

## 1. Git에 있는 웹·배포 설정

파일: [`.env.production`](../../../.env.production). 다음은 모두 **운영용 빌드 파일의 값**이다. 같은 이름의 Vercel Production 변수가 있으면 실제 빌드값은 달라질 수 있으므로 Dashboard 검색도 함께 한다.

| 변수 | 파일 값 | 사용하는 곳과 의미 | Vercel Production 중복 확인 |
| --- | --- | --- | --- |
| `PUBLIC_CATALOG_SUPABASE_URL` | 운영 프로젝트 URL | `src/features/catalog/catalogSupabaseClient.js`: 작품·표지·캐릭터 카탈로그 읽기 | 프로젝트 변수 검색에서 없음 |
| `PUBLIC_CATALOG_SUPABASE_ANON_KEY` | 공개용 키. 값 생략 | 같은 카탈로그 클라이언트의 공개 조회 | 프로젝트 변수 검색에서 없음 |
| `PUBLIC_MEMORY_WEB_IMAGE_INTAKE_V1` | `1` | `src/features/memory/adapters/platform/nativeImageIntake.js`: 웹에서 사진 선택·준비 허용 | Production 검색에서 없음. `codex/phone-test` Preview에는 별도 값 |
| `PUBLIC_MEMORY_CARD_CLASSIFICATION_SYNC_V1` | `1` | `src/features/memory/domain/cardClassification.js`: 카드별 태그·캐릭터 분류 동기화 | Production 검색에서 없음 |
| `PUBLIC_TITLE_STATE_SYNC_V1` | `1` | `src/lib/supabaseClient.js`: 작품 저장·감상 기록 계정 동기화 | Production 검색에서 없음 |
| `PUBLIC_MEMORY_PRIVATE_IMAGE_SYNC_V1` | `1` | `src/features/memory/runtime/platformPrivateImages.js`: 비공개 사진 UI·전송 경로 진입 | Production 검색에서 없음. `codex/phone-test` Preview에는 별도 값 |
| `PUBLIC_MEMORY_PUBLIC_PRIVATE_SOURCE_V1` | `0` | `src/features/memory/components/MemoryPublicationPanel.jsx`: 개인 사진을 공개 이미지 원본으로 선택하는 UI | Production 검색에서 없음. `codex/phone-test` Preview에는 별도 값 |
| `PUBLIC_MEMORY_PUBLICATION_V1` | `0` | `src/features/memory/runtime/platformPublication.js`: 공개 게시 UI | Production 검색에서 없음. `codex/phone-test` Preview에는 별도 값 |
| `PUBLIC_MEMORY_MINIHOME_V1` | `0` | 같은 runtime: 공개 미니홈 UI | Production 검색에서 없음. `codex/phone-test` Preview에는 별도 값 |
| `PUBLIC_MEMORY_FOLLOWS_V1` | `0` | 같은 runtime: 팔로우 UI | Production 검색에서 없음. `codex/phone-test` Preview에는 별도 값 |
| `PUBLIC_MEMORY_MODERATION_V1` | `0` | 같은 runtime: 공개 모더레이션 UI | Production 검색에서 없음. `codex/phone-test` Preview에는 별도 값 |

`PUBLIC_...=1` 하나만으로 해당 기능이 완료되거나 서버에서 허용되는 것은 아니다. 예를 들어 비공개 사진 저장에는 아래 Vercel API 및 Supabase 정책이 모두 필요하다. 반대로 공개 기능은 위 UI 스위치가 `0`이고 운영 DB의 공개 게시 정책 테이블도 현재 없다. 공개 기능을 `1`로 바꿔서 시험할 상태가 아니다.

그 밖의 Git 배포 설정:

| 파일·변수 | 역할 |
| --- | --- |
| [`vercel.json`](../../../vercel.json) | Astro 빌드, `sin1` 지역, `npm ci`/`npm run build`, `dist`, 보안·캐시 HTTP 헤더 |
| [`astro.config.mjs`](../../../astro.config.mjs) / `PUBLIC_SITE_URL` | Astro의 site URL. Vercel **All Environments** 값은 `https://www.moemoa.xyz`이며 `codex/phone-test` Preview에는 별도 분기 값이 있다 |
| `src/layouts/BaseLayout.astro` / `PUBLIC_DISABLE_VERCEL_ANALYTICS` | `1`이면 운영 Analytics 삽입을 끔. Vercel 프로젝트 변수 검색에서 별도 값이 없었고 코드 기본 동작은 운영에서 켜짐 |
| `scripts/write-build-info.mjs` / `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` | Vercel이 제공하는 시스템 변수로 배포 출처와 SHA를 검증·기록. 사람이 비밀값처럼 등록하는 항목이 아님 |

## 2. Vercel Project 환경 변수

위치: [Project → Settings → Environment Variables](https://vercel.com/newrreds-projects/anime-collector/settings/environment-variables). 반드시 **Production** 필터 또는 각 행의 환경 배지를 본다. 목록은 최근 항목만 먼저 표시될 수 있어 이름으로 검색했다. Shared 탭에는 연결된 변수가 없음을 확인했다. 아래는 **값을 공개하지 않고 이름·범위·역할만** 기록한다.

| Production 변수 | 현재 확인 | 역할·코드 근거 |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | 등록됨 | `src/lib/supabaseClient.js`의 브라우저 로그인·계정 데이터 연결 |
| `PUBLIC_SUPABASE_ANON_KEY` | 등록됨 | 같은 브라우저 클라이언트의 공개용 키. 서버 관리자 키와 다름 |
| `PUBLIC_MEMORY_ACCOUNT_SYNC_V1` | `1` | 같은 클라이언트에서 Memory 계정 동기화 허용 |
| `SUPABASE_URL` | 등록됨 | `src/server/privateImages/supabaseBackend.js`의 서버 측 프로젝트 연결 |
| `SUPABASE_ANON_KEY` | 등록됨 | 같은 서버 백엔드의 공개 인증 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret 등록됨** | 서버 관리자 자격. 브라우저·Git·문서에 값을 두면 안 됨 |
| `MOEMOA_PRIVATE_IMAGE_API_ENABLED` | `true` | `api/private-image.js`: 비공개 사진 API 요청 수락 |
| `MOEMOA_PRIVATE_IMAGE_ALLOWED_ORIGINS` | 등록됨 | 같은 API에서 허용하는 웹 출처 목록 |
| `MOEMOA_PRIVATE_IMAGE_CLEANUP_ENABLED` | `true` | `api/private-image-cleanup.js`: 정리 API 수락 |
| `MOEMOA_PRIVATE_IMAGE_OBSERVE_ENABLED` | `true` | `api/private-image-observe.js`: 용량 관측 API 수락 |
| `MOEMOA_PRIVATE_IMAGE_CLEANUP_PROJECT` | 등록됨 | 두 관리 API가 의도한 Supabase 프로젝트인지 검사 |
| `MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET` | **Secret 등록됨** | GitHub 예약 작업이 관리 API를 호출할 때 맞춰야 하는 비밀값 |

공개 이미지 서버용 `MOEMOA_PUBLIC_IMAGE_API_ENABLED`, `MOEMOA_PUBLIC_IMAGE_PRIVATE_SOURCE_ENABLED`, `MOEMOA_PUBLIC_IMAGE_VIEWER_ENABLED`, `MOEMOA_CONTENT_REVIEW_IMAGE_ENABLED`는 코드 `api/public-image.js`에 있지만 **Vercel 검색에서는 `codex/phone-test` Preview 전용만 확인했고 Production 항목은 확인되지 않았다**. 웹의 `PUBLIC_MEMORY_CONTENT_REVIEW_V1`, `PUBLIC_MEMORY_AUTHENTICATED_VIEWER_V1`도 Preview 전용 항목만 확인했다. Preview 설정을 운영 설정으로 읽으면 안 된다. 검색에서 보이지 않은 것을 Vercel의 모든 설정에 대한 영구 부재 증명으로 취급하지 않는다.

Vercel의 변수 변경은 기존 배포의 실행 환경을 고치지 않는다. 운영 변경 시 새 Git `master` 배포 또는 같은 소스의 재배포가 필요하고, 새 배포의 SHA와 `/build-info.json`을 확인한다. [Vercel 공식 설명](https://vercel.com/docs/environment-variables).

## 3. Supabase 운영 프로젝트

Dashboard: [프로젝트](https://supabase.com/dashboard/project/okchpyagfucpzpyrfgol). Git의 [`supabase/config.toml`](../../../supabase/config.toml)은 로컬 Supabase CLI용이며, 파일에 적힌 `127.0.0.1` Site URL은 이 운영 프로젝트의 Auth 설정이 아니다.

### 로그인과 도메인

| 위치 | 현재 확인 상태 | 관련 변경 |
| --- | --- | --- |
| [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/okchpyagfucpzpyrfgol/auth/providers) | Email·Google 켜짐. 익명 로그인은 꺼짐. 신규 가입·이메일 확인 켜짐 | 로그인 제공자와 가입 방식 변경 |
| [Authentication → URL Configuration](https://supabase.com/dashboard/project/okchpyagfucpzpyrfgol/auth/url-configuration) | Site URL `https://www.moemoa.xyz`. 운영 `www`/비-`www`, 앱 딥링크, 기존 Vercel 콜백 등 허용 URL 등록 | OAuth/이메일 로그인 후 돌아올 URL 변경 |
| [Authentication → Rate Limits](https://supabase.com/dashboard/project/okchpyagfucpzpyrfgol/auth/rate-limits) | 가입·로그인 5분/IP 30건, 토큰 갱신 5분/IP 150건, 토큰 확인 5분/IP 30건 | **Auth 요청** 제한. 사진·카드·카탈로그 API의 사용자별 호출 한도가 아님 |

### 사진과 카탈로그 Storage

| 버킷 | 공개 여부·개별 파일 최대 크기 | 용도·근거 |
| --- | --- | --- |
| `catalog-covers-preview` | 공개, 8,388,608바이트 | 작품 공식 표지. `supabase/migrations/20260819021327_catalog_preview_read_model.sql` |
| `memory-private-representations` | 비공개, 1,000,000바이트, WebP | 사용자가 선택한 사진의 최적화 사본. 원본 전체 백업이 아님. `supabase/migrations/20260925152859_memory_private_image_boundary.sql` |

비공개 버킷의 `storage.objects`에는 브라우저의 직접 접근을 막는 제한 정책이 있고, 서비스 사진 API가 소유자·원본 버전·권한을 검사한다. 버킷이 비공개라는 설정과 DB/RLS 정책은 서로 다른 층이다. [Supabase 버킷·접근 제어 설명](https://supabase.com/docs/guides/storage/buckets/fundamentals).

### DB 정책·한도

운영에서 `private.memory_private_media_policy` 1행을 직접 조회해 `revision=MOEMOA_PRIVATE_20261008_01`, `approved=true`, `enabled=true`, `paused=false`를 확인했다. 운영 초기값은 [`tools/private-images/activate-production-20261008.sql`](../../../tools/private-images/activate-production-20261008.sql)에 재현돼 있다.

| 항목 | 운영 확인값 | 뜻 |
| --- | ---: | --- |
| `quota_bytes` | 50,000,000 | 계정별 사진 사본 저장량 |
| `physical_bytes` | 100,000,000 | 서비스 전체 물리 저장량 |
| `asset_count_max` | 60 | 계정별 사진 수 |
| `main_bytes` / `thumb_bytes` | 1,000,000 / 120,000 | 사진별 큰 사본/작은 사본 최대 크기 |
| `preparations_per_day` / `decode_attempts_per_day` | 20 / 30 | 계정별 하루 준비/디코드 시도 |
| `upload_max_in_flight` | 2 | 동시에 진행할 수 있는 업로드 |
| `read_bytes_per_month` | 250,000,000 | 계정별 월 이미지 읽기량 |
| `global_read_bytes_per_month` | 500,000,000 | 서비스 전체 월 이미지 읽기량 |

값은 파일에 적혀 있다는 이유만으로 DB에서 바뀌지 않는다. 운영 DB에 승인된 SQL을 적용하고 릴리스 ID 및 `supabase_migrations.schema_migrations` 이력을 대조해야 한다. 이번 사진 기능의 DB 경계는 `20260925152858`, `20260925152859`, `20261008090000`을 적용했고, 저장 오류 호환용 `20261008093000`을 추가 적용한 기록이 있다. 적용 순서·검증은 `docs/moemoa/plans/2026-10-08-save-to-account-on-save.md`와 `CODEX_START_HERE.md`의 최신 항목을 따른다.

**공개 게시와 일반 자원 한도는 구분한다.** 공개 게시용 `private.memory_publication_settings`는 Git 마이그레이션 `20260923090000_memory_publication_boundary.sql`에 정의돼 있지만, 위 확인 시점의 운영 DB 직접 조회에서는 테이블이 **없었다**. `20260924115258_memory_resource_controls.sql`에는 일반 저장·게시 등의 예산 테이블 `private.memory_resource_policies`가 정의돼 있다. 이 일반 정책의 **운영 설치·활성 상태는 이 문서에서 새로 확인하지 않았다**. 따라서 코드에 정책이 있다는 이유로 운영에서 계정별 모든 API 호출량이 통제된다고 말하지 않는다. Supabase Auth rate limit도 이를 대신하지 않는다.

## 4. GitHub Actions 예약 설정

위치: [Repository Actions](https://github.com/Newrred/anime-collector/actions), [Variables](https://github.com/Newrred/anime-collector/settings/variables/actions), [Secrets](https://github.com/Newrred/anime-collector/settings/secrets/actions). 변수·Secret **이름의 존재**는 GitHub CLI로 확인했고 Secret 값은 읽지 않았다.

| 작업 | Git 워크플로 | GitHub 측 설정 | 주기·영향 |
| --- | --- | --- | --- |
| 비공개 사진 정리·용량 관측 | `.github/workflows/private-image-cleanup.yml` | Variable `MOEMOA_PRIVATE_IMAGE_CLEANUP_ENABLED=true`, `MOEMOA_PRIVATE_IMAGE_CLEANUP_ORIGIN=https://www.moemoa.xyz`; Secret `MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET` 존재 | 매일 03:07·09:07·15:07·21:07 KST. 운영 Vercel의 정리/관측 API 두 개 호출 |
| 카탈로그 상태 점검 | `.github/workflows/catalog-health.yml` | Variables `PUBLIC_CATALOG_SUPABASE_URL`, `PUBLIC_CATALOG_SUPABASE_ANON_KEY` 존재 | 매일 08:17 KST. 익명 카탈로그 검색·상세·표지의 읽기 전용 검사. **새 애니 데이터 수집·수정은 하지 않음** |
| 코드 품질 검사 | `.github/workflows/quality.yml` | 워크플로 안의 테스트용 값. 운영 변수와 분리 | Git 변경 후 검사. **배포 작업은 아님**; Vercel Git 연동이 운영 배포 수행 |

사진 정리 작업은 GitHub의 실행 스위치와 Vercel의 API 수락 스위치가 **둘 다** 켜져야 한다. GitHub Secret과 Vercel Secret의 값도 맞아야 하지만 그 값은 이 문서에 남기지 않는다. GitHub 예약은 지연되거나 실패할 수 있으므로 실제 실행 기록과 결과를 Actions 화면에서 확인한다.

## 5. 자주 하는 변경의 정확한 위치

| 하고 싶은 변경 | 먼저 수정·확인할 곳 | 반영 확인 |
| --- | --- | --- |
| 웹 기능의 표시 여부 | `.env.production`과 같은 이름의 Vercel **Production** 변수 존재 여부; 해당 `src/` 코드 | Git `master` 배포 후 실제 화면과 `/build-info.json` |
| 운영 서버 사진 API 중단/재개 | Vercel Production의 `MOEMOA_PRIVATE_IMAGE_API_ENABLED`; Supabase 사진 정책의 `enabled`/`paused` | 새 배포 이후 서버 응답, DB 정책, 기존 로컬 카드 보존 여부 |
| 사진 용량·개수 한도 | Supabase `private.memory_private_media_policy`의 승인된 버전 관리 SQL | DB 행·릴리스 ID·실제 허용/초과 동작. Git 파일 수정만으로는 미반영 |
| 로그인 제공자·콜백 URL | Supabase Auth Dashboard; 필요 시 웹/Android 콜백 코드 | 실제 로그인 왕복. `.env.production`의 주소와 다른 층 |
| 비밀키 교체 | 해당 서비스와 Vercel Production; 예약 관리 Secret이면 GitHub Actions도 | 새 배포·예약 호출 성공. 값은 Git/문서/일반 로그에 기록하지 않음 |
| 예약 정리 중단/재개 | GitHub Variable `MOEMOA_PRIVATE_IMAGE_CLEANUP_ENABLED`; API 자체는 Vercel 설정 | 다음 Actions 실행 상태와 Vercel API 결과 |
| 작품 데이터·표지 갱신 | `tools/catalog-lab/`, 릴리스 검증, Supabase catalog DB/Storage | active catalog release·ID 보존·검색/표지 점검. `catalog-health`는 갱신기가 아님 |
| 공개 게시 시작 | 현행 0인 웹 flags뿐 아니라 미적용 공개 DB 마이그레이션·권한/정책/신고·관리·권리 검증 전체 | **단일 설정 변경으로 시작하지 않음**. 출시 게이트와 별도 승인 필요 |

## 6. 운영 확인·문서 갱신 절차

1. Git `master` SHA와 `https://www.moemoa.xyz/build-info.json`의 `commit`, `source=vercel-git`을 대조한다.
2. 바꾸려는 변수명을 Git `.env.production`과 Vercel Dashboard에서 **둘 다** 찾는다. Vercel에서는 Production/Preview/Development 배지를 각각 읽는다.
3. DB 사항은 `supabase/migrations/`와 승인된 릴리스 SQL을 먼저 확인하고, Dashboard의 실제 테이블·정책·버킷과 대조한다. 파일 존재를 운영 적용으로 표시하지 않는다.
4. 예약 사항은 워크플로 cron·GitHub Variable/Secret **이름**·최근 Actions 결과를 확인한다. Secret 값을 출력하지 않는다.
5. 변경 기록에는 시각, Git SHA, DB 릴리스 ID, 변경한 설정의 **이름/범위**, 배포·검증 결과, 되돌릴 방법을 남긴다. 비밀값이나 개인 데이터는 남기지 않는다.

`CODEX_START_HERE.md`, `docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md`, `docs/moemoa/plans/2026-10-08-save-to-account-on-save.md`의 “사진 flag off/운영 미반영” 문장은 각 작업 **당시**의 이력이다. 시작 문서와 작업판 맨 위에 현재 상태를 따로 표시했고 `.env.production` 주석도 현재 사진 활성 상태로 갱신했다. 다음 배포·DB 정책 변경 뒤에는 이 문서의 확인 날짜·SHA·상태를 갱신해야 한다.
