# Private Vertical Slice 테스트 증거

> **상태: `IN PROGRESS`**
> 시작일: 2026-08-12
> ExecPlan: `../plans/first-private-vertical-slice.md`

## 1. Baseline

실행 기준: implementation 시작 전 `master@e71f211` + 문서 working tree.

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `npm run test:unit` | PASS | 40/40 |
| `npm run test:e2e -- --project=chromium --workers=1` | PASS | 36 passed, live 2 skipped |
| `npm run build` | PASS | Astro static 8 pages |

Build known warning:

- `useUiPreferences` 관련 client chunk 843.87 kB, Vite 500 kB warning.
- baseline warning이며 이번 slice가 만든 regression은 아니다. 신규 Memory route는 lazy boundary를 유지해 증가를 최소화한다.

## 2. Local toolchain evidence

| 항목 | 결과 |
| --- | --- |
| 일반 Node | 20.20.1 |
| MOEMOA project Node | 24.19.0 portable |
| MOEMOA project npm | 11.17.0 |
| system Java | 1.8.0_441 — 사용 금지 |
| Android Studio JBR | OpenJDK 21.0.6 |
| Android Studio | 2025.1.1 |
| Android SDK root | `C:\Users\hongs\AppData\Local\Android\Sdk` |
| Android SDK | platform 34/36, build-tools 34/35/36 |
| ADB | API 36 headless emulator 연결·설치·런타임 검증 완료, 물리 실기기 연결 없음 |

## 3. Compatibility finding

Capacitor 8.5.0은 active/latest stable이고 Node 22+, Android Studio 2025.2.1+, Android API 24+를 요구한다. 현재 일반 Node와 Android Studio가 공식 하한보다 낮다.

결론 및 실행 결과:

- Capacitor 7 downgrade는 채택하지 않는다.
- `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` 8.5.0 exact version을 설치했다.
- application ID `com.newrred.moemoa`, min API 24, compile/target API 36 scaffold를 생성했다.
- JBR 21과 Gradle 8.14.3으로 `assembleDebug`가 성공했고 11,416,717-byte debug APK를 생성했다.
- 시스템 Node 20은 보존하고 MOEMOA project command만 Node 24.19.0을 사용한다.
- Android Studio UI 자동화는 사용하지 않는다. 첫 spike는 terminal build를 기준으로 진행한다.

초기 Gradle 실행은 repository root를 작업 폴더로 사용해 `settings.gradle`을 찾지 못했다. Android project root를 작업 폴더로 지정한 재실행은 성공했다. 이 결과에 맞춰 npm Android scripts는 `cd android`를 유지한다.

## 4. TDD evidence

| 계약 | RED | GREEN |
| --- | --- | --- |
| 단일 `ACTION_SEND image/*` + content URI만 수락 | `ImageShareIntentPolicy` 부재 및 신규 scheme 계약 compile 실패 | 5 tests PASS |
| pending intake 재시작 복구·선택 삭제·ticket path 격리 | `PendingIntakeTicket`/`PendingIntakeStore` 부재 및 손상 ticket path 회귀 실패 | 5 tests PASS |
| original streaming copy, SHA-256, 20 MiB 상한, 실패 cleanup | `ImageStager` 부재로 compile 실패 | 3 tests PASS |
| 1024px preview sample 계산과 안전한 preview file naming | 대상 class 부재로 compile 실패 | 5 tests PASS |
| original → preview → durable ticket 조정과 실패 보상 | `ImageIntakeCoordinator` 부재로 compile 실패 | 2 tests PASS |
| JS 공개 ticket에서 URI/path/hash 제거 | `PublicIntakeTicket` 부재로 compile 실패 | 1 test PASS |
| API 33 Photo Picker / API 24 document fallback 선택 | `PhotoPickerIntentPolicy` 부재로 compile 실패 | 2 tests PASS |
| Capacitor static asset exact route | `/memory/new/`가 native local server에서 root fallback을 반환하는 emulator 실패 | 1 test PASS, `/memory/new/index.html`로 수정 |
| Web ticket sanitization과 bridge response normalization | adapter module 부재로 unit import 실패 | 3 tests PASS |
| 일반 Web에서 LOCAL_ONLY file input 차단 | `/memory/new/` 404로 Playwright 실패 | Chromium E2E PASS |
| 교체 전 기존 Card/image 보존과 commit 뒤 이전 file 삭제 | replace command module 부재, 이후 old-file 선삭제·native 오류 노출 변이에서 unit 실패 | replacement unit 8 tests PASS |
| commit 뒤 old-file cleanup 실패의 재시작 복구 | REPLACE journal이 recoverable operation에서 제외되고 native delete `false`를 성공으로 오인해 unit/실제 IndexedDB reopen test 실패 | startup reconciliation unit + IndexedDB reopen E2E PASS |
| 상세 교체 preview·권리 확인·누락 이미지 복구·ticket ownership | 교체 control 부재, picker 연타 2회 호출, late/pre-reservation ticket 유실로 E2E 실패 | Card detail Chromium E2E 4 tests PASS |
| runtime 교체 결과와 최종 화면 refresh 경계 | refresh bundle/preview 누락 및 post-commit read failure 전파로 unit 실패 | committed success 보존 포함 runtime unit 2 tests PASS |
| 교체 중 metadata/concurrent replacement | stale Card snapshot이 동시 note를 덮어쓰고 같은 Card의 두 REPLACE reservation을 허용해 실제 IndexedDB test 실패 | latest Card merge + active REPLACE transaction guard E2E PASS |
| discard 미확인 ticket의 durable cleanup | late/unmount discard `false` 뒤 opaque ticket ownership을 잃는 E2E·unit 실패 | bounded local cleanup queue + 다음 runtime startup retry PASS |

현재 구현은 `MainActivity`, `ImageIntakeRuntime`, custom `ImageIntakePlugin`, React composer, owner-scoped Card/VisualAsset 영구 저장, create/replace/delete journal과 Archive/detail까지 연결됐다.

### UI Readiness finding — 2026-08-16

실제 APK 검토에서 정보 위계와 가독성이 약하고 작은 화면에서 문구·조작부가 잘리거나 밀리는 문제가 확인됐다. 기능·데이터 안전 테스트가 통과했더라도 현 UI는 실사용 제품 가설을 평가할 준비가 되지 않은 것으로 판정한다.

자동 검증 공백:

- 기존 mobile/layout/design-system 검사가 `/memory/new/`, `/archive/`, `/memory/card/`를 충분히 포함하지 않는다.
- 현재 검사는 주로 기하·overflow 중심이며 승인된 screenshot visual baseline이 없다.
- 기존 button 검사 기준 32px는 새 Memory UI의 44×44px touch target 기준에 미달한다.
- React 정적 진단 통과는 정보 위계, 읽기 쉬움, 카피 이해도를 증명하지 않는다.
- Web 검증만으로 Android safe-area, keyboard, back, 실제 native media 표시를 증명할 수 없다.

판정과 조치:

- 기능 기반을 폐기하지 않고 Web-first Shared UI Readiness를 첫 slice의 선행 gate로 추가한다.
- Web 모바일·데스크톱에서 공용 UI gate를 통과한 뒤 Android 전용 적응과 실기기 검증으로 복귀한다.
- 이 판정으로 코드, IndexedDB schema, native media directory, APK는 변경하지 않았다.

## 5. Checkpoint regression

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `gradlew testDebugUnitTest assembleDebug` | PASS | generated example 포함 Android unit 25개, debug APK build |
| `npm run test:unit` | PASS | 91/91; replacement fault matrix/recovery/runtime/deferred cleanup, TitleResolver, AnimeRef, isolated DB schema와 기존 unit 포함 |
| `npm run test:e2e -- --project=chromium --workers=1` | PASS | 49 passed, live 2 skipped; image replacement·missing image recovery·picker races와 legacy 전체 회귀 포함 |
| `npm run build` | PASS | Astro static 11 pages; Detail 8.25 kB, Composer 11.62 kB, resolver 3.78 kB, lazy alias chunk 662.82 kB |
| `cap sync android` | PASS | 최신 `dist`를 Android assets로 반영 |
| sync 후 `gradlew testDebugUnitTest assembleDebug` | PASS | Android unit 30/30, debug APK 11,730,977 bytes |
| `react-doctor --verbose --scope changed --base HEAD` | PASS | 100/100; 변경분 진단 issue 0건, detail reducer와 runtime 최종-view 경계 정리 후 재검증 |

### Milestone 4A-1 discoverability checkpoint — 2026-08-20

구현·검증 기준은 `docs/superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`와 이 ExecPlan의 Milestone 4A-1이다. Production/master 병합과 최종 배포는 수행하지 않았다.

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| 행동 분리 E2E | PASS | `memory-card-discovery.spec.ts` 2/2. catalog Card action은 exact internal `animeId`를 composer에 전달하면서 Library/Card draft를 변경하지 않고, Library action은 Library row만 추가하며 Memory Card/Draft를 만들지 않음 |
| 관련 Chromium 회귀 | PASS | `index`, `memory-card-discovery`, `memory-card-composer`, `library-userflow` 합계 28 passed, live 2 skipped |
| Web unit | PASS | 103/103 |
| Astro production build | PASS | 12 pages; 기존 `aliases` 662.82 kB chunk warning만 유지 |
| production test seam | PASS | `dist`에서 `__MOEMOA_TEST_GLOBAL_SEARCH__` marker 0건 |
| catalog artifact guard | PASS | 생성된 E2E test output 정리 후 `Catalog guard: no leaks` |
| React quality scan | PASS | changed scope score 97 |
| Vercel feature Preview | PASS | `d937126`, target `preview`, 상태 `READY`; production/master 미변경 |
| 실제 catalog 검색 | PASS | Supabase `나루토` 검색에서 8개 결과와 분리된 `Create card`/`Add to Library` action 확인 |
| 실제 Card 진입 | PASS | 첫 결과가 내부 catalog UUID와 제목 `나루토`를 `/memory/new/`에 전달하고 지연 조회 뒤 `작품 정보 있음` AnimeRef로 복원; 저장 전 Archive는 비어 있음 |
| 실제 Library 진입 | PASS | 첫 결과가 `/library/?animeId=20`에 1건만 추가; 이후 Archive는 계속 empty state와 첫 Card CTA를 표시 |
| responsive/console | PASS | 320×844, 390×844, 1440×900 horizontal overflow 0; Preview console error 0 |

남은 승인 gate:

- 설명을 받지 않은 사용자가 첫 화면에서 10초 안에 `Create memory card`를 지목한다.
- 같은 사용자가 `Create card`와 `Add to Library`의 결과 차이를 설명한다.
- 이 사람 검토 전에는 Milestone 4A-1을 완전 완료로 표시하지 않는다.

### Milestone 4A post-discovery reliability checkpoint — 2026-08-21

이 checkpoint는 Milestone 4A-1의 자동/Preview 통과 이후 발견된 Library quick action 문맥, 공용 Memory route shell, offline deep-link, modal 접근성 회귀를 보강한 결과다. Production 배포나 사람 사용성 gate 통과를 의미하지 않는다.

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| Library quick action 문맥·데이터 격리 | PASS | `defdafa`; 저장 완료를 기다린 뒤 현재 quick-action에서 성공 상태와 Library refresh를 표시하고, Card/Draft를 만들지 않음. detail modal close 뒤 URL query 제거 회귀 포함 |
| Memory route shell·offline navigation | PASS | `c3f7618`; 세 Memory route의 공통 base-aware navigation, 단일 main landmark, query를 보존하는 PWA offline detail route 정책 |
| Library modal keyboard 격리 | PASS | `9d3505b`; dialog semantics, focus trap, trigger focus 복귀, background scroll lock |
| Web unit | PASS | 107/107 |
| Library Chromium | PASS | 9 passed, live 2 skipped |
| 관련 Memory/layout Chromium | PASS | 23 passed |
| 가장 최근 전체 Chromium 완전 실행 | PASS | 54 passed, live 2 skipped; 이후 변경은 위 영향받는 focused suite로 재검증 |
| Astro production build | PASS | 기존 large chunk warning 유지, build failure 없음 |
| Android checkpoint | BLOCKED | 로컬 SDK platform 36 package metadata/라이선스 환경 문제로 unit/sync/APK를 이번 checkpoint에서 재실행하지 못함. Web 통과를 Android 통과로 간주하지 않음 |

남은 gate:

- 설명 없는 사람의 10초 발견성·Card/Library 행동 구분.
- 320/360/390/412px, 768px, 1280/1440px의 전체 state/accessibility/approved visual baseline.
- Android toolchain 복구 뒤 `cap sync`·unit·APK·cold launch smoke와 최종 실기기 검증.

### Home Memory Archive source checkpoint — 2026-08-21

Commit `32a9389`는 Home의 “기억” 의미를 legacy WatchLog가 아니라 실제 `moemoa-memory-v1` Complete Card와 연결한다. 기존 Library/WatchLog는 삭제·변환·병합하지 않고 별도 legacy 화면과 데이터로 유지한다.

| 검증 | 결과 | 증거 |
| --- | --- | --- |
| onboarding unit RED | EXPECTED FAIL | 3 pass/1 fail; Memory Card 1개가 있어도 actual `add-first-title`, expected `active` |
| 실제 Home flow RED | EXPECTED FAIL | Composer에서 system design Card 저장→Home 이동 뒤 `Memory Archive` region 부재 |
| Memory-only legacy 혼입 RED | EXPECTED FAIL | Memory Card만 있는 Home에서 legacy `Add your first anime`가 함께 노출됨 |
| Web unit GREEN | PASS | 108/108; `memoryCardCount > 0`의 Home 활성화와 기존 onboarding 계약 포함 |
| Home Chromium GREEN | PASS | 9/9; 실제 Card 저장→Home 최근 카드·1개 count·detail/Archive 링크, WatchLog 0건 유지, 320×720 overflow 없음 |
| Memory composer/discovery | PASS | 13/13; create/replace/recovery/AnimeRef와 Library/Card 역방향 격리 유지 |
| layout/design-system | PASS | 12/12; `.last-run.json` status `passed`, failed test 0 |
| Astro production build | PASS | 12 pages; 기존 `useUiPreferences` 850.55 kB warning만 유지 |
| React Doctor | PASS | changed scope, base `a661a94`, score 92/100, issue 0 |

미변경 범위: IndexedDB schema 1, Android native media, Supabase, legacy migration, backup/export, Public/UGC, production deployment.

## 6. API 36 emulator runtime evidence

Computer Use 없이 Android emulator/ADB와 WebView CDP만 사용했다.

| 시나리오 | 결과 | 증거 |
| --- | --- | --- |
| cold launch | PASS | `MainActivity` 3.166초, foreground 유지, `Registering plugin instance: ImageIntake`, fatal exception 없음 |
| `ACTION_SEND image/png` | PASS | MediaStore `content://` + read grant를 전달하고 running/cold activity 양쪽에서 수신 |
| native-private staging | PASS | original 96,760 B, preview JPEG 13,566 B, ticket 370 B 생성; 이름은 opaque UUID만 사용 |
| native → Capacitor → Web | PASS | URL `https://localhost/memory/new/index.html`, composer heading과 bounded JPEG data URL preview 확인 |
| 공개 bridge payload | PASS | DOM에는 1080×2400/94KB와 preview만 표시; source URI/path/checksum은 public ticket contract에서 제외 |
| Web cancel/discard | PASS | image remove 후 preview가 사라지고 대응 original/preview/ticket 3개가 함께 삭제됨 |
| system Photo Picker | PASS | Web button으로 system picker가 열림; Back 취소 후 복귀하고, PNG 실제 선택 시 새 private ticket 세트·bounded JPEG preview 생성과 composer 표시 확인 |
| permanent promotion | PASS | 저장 확정 시 staging ticket을 `files/moemoa-media`의 original/preview/metadata set으로 승격; bridge/DB에는 opaque `asset:<uuid>`만 저장 |
| Card create/restart/read | PASS | 실제 Photo Picker PNG로 PrivateTitle Card 저장, Archive 표시, 앱 강제 종료·재실행 뒤 WebView IndexedDB와 native preview를 다시 열어 제목 확인 |
| Card delete | PASS | 상세 화면 확인 대화상자 후 Archive row 제거, tombstone의 note/path/hash scrub, `files/moemoa-media`가 빈 디렉터리임을 확인 |
| system design fallback | PASS | 이미지와 권리 확인 없이 deterministic private VisualAsset을 저장하고 Archive에서 표시 |

첫 ADB synthetic share는 `EXTRA_STREAM`만 넣어 URI grant 대상이 없어서 media provider가 접근을 거부했다. 일반 공유 앱이 구성하는 것처럼 같은 URI를 Intent data에도 두고 read grant를 적용한 재실행은 성공했다. 이는 앱의 typed `IMAGE_READ_FAILED` 경로와 테스트 인텐트 차이를 함께 확인한 결과다.

남은 device gate:

- 물리 실기기에서 Gallery/Instagram 등 실제 앱의 share sheet 진입.
- Photo Picker에서 JPEG/WebP 선택과 PNG 외 포맷별 오류/회전 확인.
- EXIF orientation 사진 표시 확인.
- source grant 만료, storage full, 강제 종료·process death 뒤 pending ticket 재claim.
- API 24~32 `ACTION_OPEN_DOCUMENT` fallback.

Browser persistence evidence:

- `moemoa-memory-v1` schema 1을 닫고 다시 연 뒤 같은 Guest Owner와 Complete Card를 조회했다.
- 서로 다른 두 Guest Owner fixture의 Archive 조회가 섞이지 않았다.
- 중단된 IMPORT/DELETE journal을 startup reconciliation이 재시도하고 안전한 완료 상태로 수렴시켰다.
- REPLACE는 신규 asset과 Card pointer가 commit되기 전 기존 asset을 유지하고, commit 뒤 이전 asset만 `DELETE_PENDING`으로 전환한다.
- 이전 file 삭제 실패 뒤 DB를 닫고 다시 연 실제 IndexedDB test에서 새 Card를 유지한 채 old-file cleanup만 재개했으며 ticket promotion은 반복하지 않았다.
- native delete의 `false` 반환은 성공으로 처리하지 않으며, post-switch DB cleanup과 failure 기록이 함께 실패해도 Card 교체 성공을 유지하고 journal을 다음 startup 복구 대상으로 남긴다.
- 교체 media promotion 중 다른 탭이 수정한 note를 실제 IndexedDB pointer commit이 보존하고, 같은 Card의 두 번째 active REPLACE reservation은 transaction 안에서 `OPERATION_IN_PROGRESS`로 거부한다.
- 교체 완료 뒤 도착한 stale metadata 저장도 Card 전체 snapshot을 쓰지 않고 note만 최신 row에 병합하므로 새 asset pointer를 되돌리지 않는다.
- 테스트용 legacy DB marker가 전후 동일해 신규 Memory DB가 `anime-collector-db`를 변경하지 않았음을 확인했다.
- Playwright에서 image Card create→중복 저장 방지→Archive→reload→detail note edit→reload→delete→Archive reload와 system design create를 통과했다.
- Playwright 상세 화면에서 기존 image 유지→새 bounded preview→권리 확인 전 적용 차단→교체→이전 asset scrub을 검증했고, preview 누락 Card에는 `이미지 복구`와 `카드 삭제`를 함께 표시했다.
- picker 연타는 synchronous mutex로 한 번만 실행하고, detail 이탈 뒤 늦게 도착한 ticket은 discard한다. command가 journal을 만들기 전 거절한 ticket은 UI가 유지하며 native discard가 `true`로 확인될 때만 제거한다.
- late/unmount discard가 `false` 또는 throw이면 안전한 opaque ticket ID만 최대 32개 cleanup queue에 남기고 다음 runtime startup에서 재시도한다. source URI, path, hash, preview는 queue에 기록하지 않는다.

TitleResolver/AnimeRef evidence:

- local alias unit fixture에서 한글 검색이 네트워크 없이 `LEGACY_UNVERIFIED` 후보를 반환했다.
- AniList adapter fixture에 cover/banner/site URL을 포함해도 결과에는 제목·별칭·장르·`ANILIST:<id>` binding만 남았다.
- remote error와 bounded timeout에서 자유 오류 문자열 대신 `UNAVAILABLE`/`TIMED_OUT` 상태를 반환하고 local result·PrivateTitle 진행을 유지했다.
- 동일 provider ID의 remote 후보는 local 한국어 제목을 alias로 보존하되 verification은 `PROVIDER_CANDIDATE`로 명시했다.
- selected catalog candidate를 저장한 뒤 IndexedDB에는 AnimeRef와 `card.animeRefId`만 있고 PrivateTitle row는 없었으며, 재개된 IMPORT journal도 같은 AnimeRef를 보존했다.
- Composer E2E에서 candidate 선택 저장, provider unavailable PrivateTitle 저장, 검색 중 query 변경 뒤 stale response 폐기를 검증했다.
- alias/AniList resolver는 dynamic import로 분리돼 검색 전 Archive/detail 초기 bundle에는 포함되지 않는다.

Memory locale/backup boundary evidence:

- 작성·Archive·상세 route가 하나의 locale context를 사용하며 fresh 기본값은 영어, 한국어 선택도 페이지 이동 뒤 유지한다.
- 저장 완료·이미지 오류 상태는 번역된 문장을 저장하지 않고 message key/error code를 보존해 화면 언어 변경 즉시 다시 번역한다.
- 준비된 private image가 있는 상태에서 언어를 바꿔도 native ticket claim은 한 번만 실행되며 preview와 ticket ownership을 유지한다.
- legacy JSON 수동 backup은 Memory Card/이미지를 포함하거나 복구하지 않는다고 Data 화면에 명시한다. 신규 Memory DB/export 구현은 추가하지 않았다.
- RED→GREEN locale E2E, Web unit 108/108, 관련 Chromium 37/37, late picker cleanup 10회 반복, Astro build, React Doctor 100/100, 독립 review 승인을 확인했다.

현재 한계:

- 현재 Memory UI는 기능 검증용이며 가독성·잘림·시각 회귀 gate를 통과하기 전에는 dogfood-ready로 간주하지 않는다.
- 물리 실기기와 실제 외부 앱 Share Target은 아직 검증하지 않았다.
- orphan final file, DB-only missing file의 전체 filesystem reconciliation과 `MISSING` 자동 분류는 아직 없다. 상세 화면의 수동 교체·삭제 복구 진입점만 구현됐다.
- ZIP export/Android share, staging/export TTL cleanup은 구현 전이다.
- image replacement는 Web fake-native·실제 IndexedDB까지 검증했지만 물리 Android 실기기에서 기존 native file 교체와 재시작 cleanup은 아직 검증하지 않았다.
- 2.5초 제한은 UI 응답을 해제하지만 이미 시작한 AniList 요청 자체를 취소하지는 않는다.
- schema v1의 `anime_refs.source_key` index는 비고유이므로 여러 탭이 동시에 같은 후보를 최초 저장하면 중복 AnimeRef가 생길 여지가 있다.
- alias 데이터는 검색 시에만 lazy-load되지만 662.82 kB chunk 경고가 남아 있어 후속 인덱싱·분할 최적화가 필요하다.

## 7. Dependency audit finding

`npm audit --omit=dev` 결과 production dependency tree에 17건이 남아 있다: high 12, moderate 3, low 2. 주요 경로는 Astro/Vite/Rollup/Sharp 및 그 전이 의존성이다. 자동 전체 수정은 Astro 7 breaking upgrade를 요구하므로 첫 native spike와 결합하지 않는다.

- 현재 단계: internal build/spike 진행 가능.
- production 공개 배포: 취약점 정리와 전체 Web regression 전까지 금지.
- 다음 조치: non-breaking `npm audit fix` 후보를 별도 diff로 검토하고, Astro major upgrade는 독립 ExecPlan/rollback으로 수행.
