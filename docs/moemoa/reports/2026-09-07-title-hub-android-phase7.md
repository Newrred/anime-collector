# Title Hub Android Phase 7 — 테스트 APK 준비

상태: **공용 UI 적용·debug APK 검증 완료, 물리 실기기 검증 대기** (2026-09-07).

## 사용자 확인과 범위

사용자는 Web 기능을 간단히 직접 확인했고 “UI적인 개선은 많이 필요하지만 기능적으로 큰 문제는 없어 보였다”고 보고했다. Android 적용을 위한 기능 사용성 선행 확인을 수용한다. UI 완성도와 정식 출시 승인은 미완료다.

읽은 자료: `AGENTS.md`, `CODEX_START_HERE.md`, 확정 결정 `01`, 아키텍처 `06`, QA `07`, 변경 관리 `09`, `PLANS.md`, Title Hub ExecPlan/UI 명세, Android toolchain ADR-0003, 기존 unified-user-data 검증 및 Web 배포 보고서. 실제 `capacitor.config.ts`, native MainActivity/Manifest, 공통 Memory runtime와 image adapter, OAuth callback, Gradle 설정 및 경로 검사 코드를 교차 확인했다.

계획: [Phase 7 ExecPlan](../plans/2026-09-07-title-hub-android-phase7.md). 기존 UI·도메인·앱 ID를 재사용하며 UI 재설계는 이번에 수행하지 않았다.

## 결과물

- APK: `D:/hong/Web/Anime/.moemoa-android-2026-09-07-phase7/MOEMOA-Phase7-debug.apk`
- 크기: 14,706,610 bytes.
- SHA-256: `2E42F45F290E82E8A6DCA6CAC1DCBFBCDC4AF569EE2076C633E8E0965051BF92`.
- 앱 ID: `com.newrred.moemoa`, versionCode 1 / versionName 1.0, minSdk 24 / targetSdk 36.
- 기존 2026-08-26 로컬 APK와 서명 인증서가 일치하며 APK signature 검증 통과.
- Title Hub, My Titles, Poster/Memory View, 메뉴·기존 주소 호환, 첫 Memory 안내를 포함한 공용 화면을 Capacitor assets에 반영했다.

## 변경 파일과 이유

- `scripts/verify-android-static-routes.mjs` — `/titles/`를 packaged route contract에 추가했다. 이전에는 dist의 파일 존재만 확인해 APK용 assets 누락을 검출하지 못했다.
- `tests/unit/nativeAppNavigation.test.mjs` — 기존 화면이 전부 있어도 packaged `titles/index.html`이 없으면 실패하는 회귀 검사를 추가했다.
- 현재 상태 문서와 계획에 사용자의 기능 확인, UI 개선 미완료, Android APK 준비 결과를 기록했다.
- Capacitor가 생성한 assets와 APK는 기존 ignored 경로에 있다. native Java·Gradle·Manifest·앱 ID·의존성 버전은 변경하지 않았다.

## 빌드와 검증

Node 24.20.0 + JBR 21 + 기존 Android SDK를 사용했다. 직전 운영 배포에서 검증한 동일 Supabase의 public 계정/catalog 설정과 계정 sync flag를 명시적으로 전달했다. 두 key의 public anon 역할을 확인했으며 키 원문을 로그에 출력하지 않았다. 테스트 APK의 Vercel Analytics는 비활성화했다.

| 검사 | 결과 |
| --- | --- |
| JS unit (`npm run test:unit`) | 222 passed, 0 failed |
| Astro production build | 15 pages 성공 |
| Capacitor sync | 성공, 기존 App/Browser plugin 유지 |
| Android static/packaged route 검사 | 15 routes 통과 |
| Gradle `testDebugUnitTest assembleDebug` | BUILD SUCCESSFUL, native unit 31 passed / 0 failed / 0 skipped |
| 기존 native URL 모의 E2E | 6 passed: Home/composer/search/account 이동과 첫 Memory View 선택 |
| APK 내부 검사 | 15개 HTML 페이지 포함, 환경·DB·로그 파일 없음 |
| APK 서명/식별 | 서명 유효, 이전 로컬 debug APK와 동일 인증서·앱 ID |

로그·빌드 스크립트·이전 APK 백업은 `D:/hong/Web/Anime/.moemoa-android-2026-09-07-phase7/`에 있다. 이 폴더의 build script는 이전 Web 배포의 로컬 production 환경 파일을 참조하므로 다른 PC에서는 같은 public 설정을 별도로 준비해야 한다.

## 데이터·보안·복구

DB/data migration은 없다. 기존 app ID, 로컬 origin, 저장소 구조를 유지했다. 기기에 설치하거나 기존 데이터를 지우지 않았다. 기존 APK는 `previous-2026-08-26-debug.apk`로 보존했으며, 동일 서명의 업데이트 설치를 통해 앱 화면 버전을 교체할 수 있다. Web 운영 배포, Public UGC, 사용자 이미지 cloud, 신규 analytics 수집은 변경하지 않았다.

## 남은 확인

현재 `adb devices -l`에 연결 기기가 없어 물리 실기기 실행은 하지 못했다. 브라우저의 native URL 모의 검사를 실기기 통과로 해석하지 않는다.

1. 기존 앱을 제거하지 않고 테스트 APK 업데이트 설치.
2. 작품 검색 → Title Hub → 공식 표지/시스템 디자인 기억 저장 → 내 작품·아카이브 이동.
3. 사진 선택·취소 및 다른 앱에서 이미지 공유.
4. Android 뒤로가기, 키보드, 상태표시줄·하단 영역.
5. 앱 강제 종료 후 기존 기록·이미지 복원, 오프라인 개인 기억 저장.
6. Google 로그인 후 앱 복귀. 계정 데이터 승격·동기화는 사용자가 명시적으로 선택할 때만 확인.

UI 개선은 별도 후속 항목이다. 현재 결과물은 debug 테스트 APK이며 정식 Android 출시 완료로 보고하지 않는다.
