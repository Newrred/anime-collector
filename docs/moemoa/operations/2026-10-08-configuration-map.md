# MOEMOA 운영 설정 지도

> **2026-10-10 D05 외부 사본 회수 검증:** 기존 Drive 다운로드 ZIP918,803,598bytes의 SHA256이 승인 업로드 원본과 일치했다. 새 비공개 quarantine에서 AES-GCM4,308파일/917,084,869bytes 인증·해시·크기 일치 PASS, PG17 클라이언트로 복원 dump 목차 읽기 PASS. 합성 안전검사6PASS. 이는 DB 재가동/삭제 재노출 방지 PASS가 아니다. 사용자 확인: 복구키는 아직 이 PC에만 있음. 로컬 PG17 서버는 있으나 pg_cron/supabase_vault 확장 부재로 전체 운영 dump import 미실행. 회전/RPO/RTO·최신 삭제 대조도 미완료, D05 PARTIAL 유지. 운영 DB/master/Public/추가 전송 변경0. 다음1개는 필요한 확장을 갖춘 격리 복구 환경에서 DB 재가동과 최신 삭제 대조 준비. 아래 기록은 각 실행 당시의 근거다.

## 2026-10-10 보존·삭제 실제 상태

- 읽기 전용 inspection: 운영/test 일별30일 정리 활성·최근 성공, 초과 tombstone/사진 정리 대기/고아 응답 사본0. test 단기 가입 정리 활성·최근 성공/만료 잔여0. 운영 간편 가입 테이블은 미설치 상태를 유지한다.
- 사진 정리 GitHub run37934721842(10/9, master8fb4b49) SUCCESS. 매6시간 의도 예약은 지연될 수 있고 회당50건이므로 삭제 기한 보장이 아니다. 신규 코드의 `PRIVATE_CLEANUP_BATCH_LIMIT_REACHED`는50건 포화 가능성 경보이며 아직 master 미반영이다.
- 동기화 삭제 사본 보완 SQL은 사용자 승인으로 test에만 release `MOEMOA_RETENTION_RESPONSE_TEST_20261010_01` 적용. 도구 `tools/operations/apply-test-retention.py`(기본inspect,명시apply), source ebdff44/guard4502da7. 기존 함수 지문/승인 SHA 검증, 기존 건수 유지·실제 제거0·service-only·별도 연결 확인 PASS. production 미적용. 운영/test `DELETED` 사진 metadata1/13행의 별도 보존 기준과 Drive 사본 회전은 미완료다.
- [이번 집계/검증](../release-v2/evidence/2026-10-10-retention-closeout.json), [현재 계약](../release-v2/02_ACCEPTANCE_CONTRACTS.md). 기존 비밀값 위치/백업 파일·키는 변경하지 않았다.

> **2026-10-10 현재 재개점 — 가입 시각 오차 보완:** 실제 신규 C 가입·동의 결속·로그인 PASS(add55d3)는 유지한다. start 요청에서 클라이언트가 서버보다1ms 빠르면503이 나는 별도 결함을 합성 재현했고, 최대60초 미래값만 서버 수신시각으로 낮추도록 보완했다. 과거30분 만료/10분 OAuth 만료·나이·약관·정책·계정 검증은 유지한다. 이번 unit479/가입 Chromium4/build24 PASS, 이전 add55d3 CI37965007645 전체SUCCESS. 최초 hosted503의 정확한 원인은 당시 진단 부족으로 미확정이며 이번 재현과 구분한다. 현재 보완은 테스트 Git Preview 반영 대상; 운영/master/Public/DB migration 변경0. 신규 시계오차의 실제 hosted 재현은 미검증이다. 다음1개는 C02 국가별 최종 가입 정책·고지 마감; 기존 D05 외부 복구/키 보관도 남는다. 아래 기록은 각 실행 시점의 근거다.

> **2026-10-10 테스트 가입 연결:** 교체된 키를 재조회하지 않고 Preview `codex/phone-test`의 signup 설정을 등록했다. 기존 Supabase 서버 설정은 중복 거부로 보존했다. Google callback 추가 저장, test Before User Created Hook 활성, 시간별 만료 임시정보 정리 예약 완료. Google 프로젝트는 외부/프로덕션 게시 상태라 Preview 서버에 승인 A/B 계정 해시 제한을 추가했다(누락·타 계정은 fail-closed). unit476/build24 PASS. DB 가입 policy는 아직 off이며 다음은 Git Preview 배포 확인→test policy 활성→사용자 직접 생년월일/동의 후 실제 Google 왕복이다. 운영/master/Public 변경0. 실제 신규 가입 PASS는 아직 아니다.

- test configuration release: `MOEMOA_SIMPLE_SIGNUP_TEST_20261010_02`, version-controlled `tools/identity/configure-simple-signup-test.py` (inspect/prepare/enable/disable). Cleanup job `moemoa-simple-signup-purge`: `17 * * * *`, expired admissions/handoffs only.

## 2026-10-09 간단한 가입 후보 (운영 미적용)

**2026-10-10 복구 확인:** 사용자 직접 test Google 키 생성·test Supabase/Vercel 저장 후 이전9/24 키를 사용 중지했다. Google 날짜별 관리 상태(이전 중지/새10/10 활성)와 그 후 Chrome의 완전히 새 Google 로그인 왕복·A 계정 복귀를 확인했다. 새 키 원문 재조회0. 기존 Supabase OAuth 복구 PASS이며 Vercel 새 signup 서버의 실제 키 사용은 미배포라 미검증이다. 나머지 서버 변수·새 callback·Hook·purge는 아래 절차로 이어간다. 운영 변경0. 아래 교체 전 중단/로딩 오류는 과거 상태다.

**실제 test 적용 후속:** 릴리스 `MOEMOA_SIMPLE_SIGNUP_TEST_20261009_01`로 moemoa-test에 두 migration을 적용했다. `enabled=false/admission_enabled=false`; 익명 정책 조회·admission401 확인. Vercel `MOEMOA_GOOGLE_CLIENT_SECRET`만 Preview `codex/phone-test`에 Secret 등록했다. 이 과정의 도구 응답 노출로 **키 교체 전 사용/새 배포 금지**, 다른 사용처 확인 후 사용자 직접 교체한다. 나머지 신규 변수/Google callback/Hook/purge는 미설정. Google Cloud 클라이언트 페이지는 최초/재시도 모두 로딩 오류였다. 운영은 변경하지 않았다.

**최신 서버 연결 후보:** 아래 PKCE/사후 영수증 설명은 이전 후보다. 신규 flag-on 흐름은 서버 Google code 교환→Supabase ID-token→암호화 일회 전달을 사용한다. 기본 off PKCE는 유지한다. 유료 공급자/의존성 추가 없음.

| 설정 위치 | 이번 후보의 정확한 설정 이름/값 형식 |
| --- | --- |
| Vercel 테스트 배포의 Web 변수 | `PUBLIC_SIMPLE_SIGNUP_V1=1` (운영은 아직 off) |
| Vercel 동일 환경의 서버 변수 | `MOEMOA_SIMPLE_SIGNUP_SERVER_ENABLED=true`, `MOEMOA_SIGNUP_ORIGIN=https://정확한-고정-테스트-host` |
| 같은 서버의 비밀 변수 | 기존 Google client의 `MOEMOA_GOOGLE_CLIENT_ID`, `MOEMOA_GOOGLE_CLIENT_SECRET`; 별도 무작위32byte hex `MOEMOA_SIGNUP_COOKIE_KEY` (값 기록/출력 금지) |
| 같은 서버의 Supabase 변수 | 해당 **테스트** 프로젝트 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (운영 값을 재사용하지 않음) |
| Google Auth Platform → Clients → 기존 Web OAuth client | Authorized redirect URI에 정확한 `https://테스트-host/api/signup?action=callback` 추가. 기존 Supabase callback 삭제하지 않음. scope는 기존 openid/email/profile만 |
| Supabase 테스트 DB | `20261009130000` 다음 `20261009143000` 후보 적용·이력 기록. 국가 정책/문서 버전 확인 후 `simple_signup_policy.enabled/admission_enabled`를 함께 다룸 |
| Supabase Auth → Hooks → Before User Created | `public.check_simple_signup_admission` 선택. 자체 INSERT trigger가 실제 ID를 결속하므로 Hook의 임시 UUID에 의존하지 않음 |
| 테스트 DB 예약/운영 정리 | `public.purge_simple_signup_transients()`를 최소 매시간 호출하는 제한된 예약 구성 및 실제 성공 확인. 현재 미예약. 만료 즉시 거부와 물리 삭제 시점은 다름 |

검증 순서: 기본 off로 migration 적용→테스트 서버/Google callback 준비→policy/Hook 활성→합성 신규 Google 계정 실제 가입/기존 계정 로그인/취소/만료/직접 Auth 생성 거부 확인. 현재 첫 DB 단계만 실환경에서 완료했다. 기존 브라우저 테스트는 API/Google 모의 응답이며 실제 Google 왕복 증거가 아니다. 로그인 실패율과 승인 거부는 개인 데이터 없는 코드/건수로만 관측한다.

롤백은 **브라우저 flag만 끄지 않는다**. 이전 서버/UI Git 후보, `admission_enabled=false`와 기존 Auth Hook 설정을 함께 복원한다. 사용자/영수증 삭제 없음. 새 callback URI 제거는 이전 로그인 복구 확인 뒤 진행한다. 운영은 정확한 Git SHA·DB release ID·D06을 기록하고 Git master→Vercel Git 배포 방식만 사용한다.

- Web 진입: `PUBLIC_SIMPLE_SIGNUP_V1=1`에서 `/auth/start/`를 거쳐 기존 PKCE로 이동. 기본 off는 기존 로그인 유지.
- DB 후보: migration `20261009130000_simple_signup_declarations.sql`. `private.simple_signup_policy.enabled` 기본 false. 정책/문서 버전과 국가별 최소 연령은 DB에서 읽고, 영수증 쓰기는 해당 auth.uid만 가능하다.
- 운영에 아직 적용하지 않았으며 flag만 켜면 안 된다. 직접 Auth 가입 경계·최종 국가별 정책/고지·D06 후보를 먼저 마감한다. seed의 US/GB13은 작업값이고 미설정 유럽 국가를 일괄13으로 판정하지 않는다.
- 검증: `node scripts/run-simple-signup-e2e.mjs`는 운영 자격값을 전달하지 않는 독립 로컬 서버와 가짜 loopback Supabase 응답을 사용한다. `wsl -u postgres -e bash /mnt/e/web/anime/tools/identity/run-simple-signup-local.sh`는 임시 로컬 PostgreSQL만 사용한다.

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
| 비공개 사진 정리·용량 관측 | `.github/workflows/private-image-cleanup.yml`, `scripts/private-image-maintenance.mjs` | Variable `MOEMOA_PRIVATE_IMAGE_CLEANUP_ENABLED=true`, `MOEMOA_PRIVATE_IMAGE_CLEANUP_ORIGIN=https://www.moemoa.xyz`; Secret `MOEMOA_PRIVATE_IMAGE_CLEANUP_SECRET` 존재 | 기존 cron 유지. 수동 Run workflow는 관측만 하고 삭제를 호출하지 않음. 예약은 기존 정리+관측. 기본 저장/예약80MB·월읽기400MB 이상 또는 관측/정리 오류면 실패/경보 코드 |
| 카탈로그 상태 점검 | `.github/workflows/catalog-health.yml` | Variables `PUBLIC_CATALOG_SUPABASE_URL`, `PUBLIC_CATALOG_SUPABASE_ANON_KEY` 존재 | 매일 08:17 KST. 익명 카탈로그 검색·상세·표지의 읽기 전용 검사. **새 애니 데이터 수집·수정은 하지 않음** |
| 코드 품질 검사 | `.github/workflows/quality.yml` | 워크플로 안의 테스트용 값. 운영 변수와 분리 | Git 변경 후 검사. **배포 작업은 아님**; Vercel Git 연동이 운영 배포 수행 |

사진 정리 작업은 GitHub의 실행 스위치와 Vercel의 API 수락 스위치가 **둘 다** 켜져야 한다. GitHub Secret과 Vercel Secret의 값도 맞아야 하지만 그 값은 이 문서에 남기지 않는다. GitHub 예약은 지연되거나 실패할 수 있으므로 실제 실행 기록과 결과를 Actions 화면에서 확인한다.

2026-10-09 추가: `MOEMOA_PRIVATE_STORAGE_ALERT_BYTES` / `MOEMOA_PRIVATE_READ_ALERT_BYTES` GitHub Variables로 경보 임계값을 바꿀 수 있다(미설정 기본80,000,000/400,000,000). 이는 DB의 강제 한도 변경이 아니다. Actions 실패 알림은 운영자 GitHub 알림 설정/수신 여부를 별도로 확인한다. 수동 관측 [37909102233](https://github.com/Newrred/anime-collector/actions/runs/37909102233)은 `4a85aba`에서 성공했으며09:06:19 UTC 저장/예약682,714bytes·월읽기1,054,194bytes·경보없음/삭제SKIPPED였다. 임계 경보의 실제 메일 수신 PASS는 아니다. 금액 청구서 전체나 다른 서비스 비용을 측정하지 않는다.

2026-10-09 백업 접근: 운영 Supabase는 Free로 관리형 백업 다운로드가 없고, 운영 DB 비밀번호는 사용자도 현재 모름. 현재 로그인에서 Database Settings의 Reset password 버튼 비활성화/설정 권한 부족 안내 확인. Vercel Project 환경 변수 `DB` 검색 결과0(임의 이름이나 외부 도구까지 부재 증명 아님). 원래 비밀번호 보관처 확인 또는 조직 소유자/해당 권한 계정에서 복구가 필요하다. 인증정보 변경은 사용자가 직접 처리하고, 알려지지 않은 직접 DB 연결에 대한 영향은 별도 확인한다. 웹의 조사한 운영 경로는 REST/서버 API 키를 사용한다. Git 제외 `.env.moemoaprod.server.local`에는 확인한 Session pooler host/user와 빈 비밀번호·서버 키 입력란만 준비했고 현재 사용자/SYSTEM 파일 접근으로 제한했다. 비밀값·신분증·원본을 채팅/Git에 넣지 않는다. Drive와 복구 키를 같은 저장소에 두지 않는다.

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

2026-10-09 후속: 사용자가 조직 소유자 로그인과 DB 비밀번호 재설정/로컬 저장을 직접 완료했다. 운영 PG17.6에 인증서 검증(verify-full)으로 연결했고 기존 service_role을 해당 Git 제외 파일에 저장했다(키 재발급 없음). 공식 PG17.11 client를 WSL 임시 파일로만 사용, 시스템/운영 DB 업그레이드 없음. DB dump57,829,282bytes 및 Storage4304개856,669,715bytes, 최신 삭제journal을 수집했다. Storage 수집 전후 목록이 일치하고 개별 크기/ETag 확인. AES-GCM4308파일917,084,869bytes를 독립 Python cryptography로 복호화하여 모든 SHA256/길이 일치와 복원 사진12 decode 확인. Windows Node 복원 도구는 최종폴더 rename EPERM이 반복되어 성공으로 기록하지 않으며 추측성 retry 수정은 원복했다. 현재 운영 SQL 변경/공개 flags 변경/정기 백업 활성화 없음. 구체 파일/계정의 사용자 전송 승인 후 Drive 비공개 폴더 업로드100%/1개 완료를 확인했다. 재다운로드는 브라우저 시간 제한/대체 locator 부재로 로컬 경로 미확보. 외부 회수 무결성·별도 복구키 보관·DB 재구동/canonical 원본 완전성은 아직 미완료. 로컬 민감 staging은 `.cache/operations-private` ACL 현재 사용자/SYSTEM으로 제한하며 일반 Git/CI에 포함하지 않는다.
