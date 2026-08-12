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

현재 구현은 `MainActivity`, `ImageIntakeRuntime`, custom `ImageIntakePlugin`, React composer까지 연결됐다. Card/VisualAsset IndexedDB 영구 저장은 의도적으로 다음 milestone에 남겼다.

## 5. Checkpoint regression

| 명령 | 결과 | 비고 |
| --- | --- | --- |
| `gradlew testDebugUnitTest assembleDebug` | PASS | generated example 포함 Android unit 25개, debug APK build |
| `npm run test:unit` | PASS | 43/43 |
| `npm run test:e2e -- tests/memory-card-composer.spec.ts --project=chromium --workers=1` | PASS | browser route에서 file input 0개, Android-only 안내와 save gate 확인 |
| `npm run build` | PASS | Astro static 9 pages, Memory composer 15.24 kB, baseline large chunk warning 유지 |
| `cap sync android` | PASS | 최신 `dist`를 Android assets로 반영 |
| sync 후 `gradlew testDebugUnitTest assembleDebug` | PASS | 최신 static asset과 custom plugin 포함 APK |
| `react-doctor --scope files --include-untracked` | PASS | 이번 변경 7개 React/JS 파일, 100/100, 신규 진단 없음 |

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

첫 ADB synthetic share는 `EXTRA_STREAM`만 넣어 URI grant 대상이 없어서 media provider가 접근을 거부했다. 일반 공유 앱이 구성하는 것처럼 같은 URI를 Intent data에도 두고 read grant를 적용한 재실행은 성공했다. 이는 앱의 typed `IMAGE_READ_FAILED` 경로와 테스트 인텐트 차이를 함께 확인한 결과다.

남은 device gate:

- 물리 실기기에서 Gallery/Instagram 등 실제 앱의 share sheet 진입.
- Photo Picker에서 JPEG/WebP 선택과 PNG 외 포맷별 오류/회전 확인.
- EXIF orientation 사진 표시 확인.
- source grant 만료, storage full, 강제 종료·process death 뒤 pending ticket 재claim.
- API 24~32 `ACTION_OPEN_DOCUMENT` fallback.

## 7. Dependency audit finding

`npm audit --omit=dev` 결과 production dependency tree에 17건이 남아 있다: high 12, moderate 3, low 2. 주요 경로는 Astro/Vite/Rollup/Sharp 및 그 전이 의존성이다. 자동 전체 수정은 Astro 7 breaking upgrade를 요구하므로 첫 native spike와 결합하지 않는다.

- 현재 단계: internal build/spike 진행 가능.
- production 공개 배포: 취약점 정리와 전체 Web regression 전까지 금지.
- 다음 조치: non-breaking `npm audit fix` 후보를 별도 diff로 검토하고, Astro major upgrade는 독립 ExecPlan/rollback으로 수행.
