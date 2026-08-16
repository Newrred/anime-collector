# ADR-0003 — Android image intake spike toolchain

- Status: `ACCEPTED FOR SPIKE`
- Date: 2026-08-12
- Related decisions: `TECH-01`, `STORAGE-LOCAL-01`
- ExecPlan: `../plans/first-private-vertical-slice.md`

## Context

Capacitor client 방향은 확정됐지만 exact version, Android 지원 범위, Share Target bridge 방식은 spike 증거가 필요하다. 2026-08-12 현재 공식 지원 정책과 로컬 PC 상태는 다음과 같다.

| 항목 | 공식 Capacitor 8 기준 | 현재 PC | 판정 |
| --- | --- | --- | --- |
| Capacitor | active v8, latest stable 8.5.0 | core/cli/android 8.5.0 설치 | 충족 |
| Node | 22+ | project portable 24.19.0, system 20.20.1 보존 | project command 충족 |
| Android Studio | 2025.2.1+ | IDE 2025.1.1, JBR/Gradle CLI 사용 | CLI spike 통과, IDE upgrade 별도 |
| JDK | Android Studio bundled JDK | JBR 21.0.6 존재 | 충족 |
| Android minimum | API 24 | platform 34/36, build-tools 34/35/36 | 충족 |

공식 근거:

- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/main/reference/support-policy
- https://github.com/ionic-team/capacitor/releases/tag/8.5.0
- https://developer.android.com/training/data-storage/shared/photo-picker
- https://developer.android.com/training/sharing/receive

## Decision

1. 신규 project는 지원 종료가 가까운 Capacitor 7로 낮추지 않고 Capacitor 8.5.0을 사용한다.
2. application ID는 사용자가 확인한 `com.newrred.moemoa`를 사용한다.
3. minimum Android는 Capacitor 8 공식 하한인 API 24로 시작한다.
4. JDK는 Android Studio bundled JBR 21을 사용한다.
5. API 33+는 platform `ACTION_PICK_IMAGES` single-image Photo Picker를 사용하고, API 24~32는 permissionless `ACTION_OPEN_DOCUMENT` fallback을 사용한다. broad media read permission은 요청하지 않는다.
6. Share Target은 Android `ACTION_SEND` + `image/*`만 지원한다. `ACTION_SEND_MULTIPLE`, text, video는 첫 spike에서 제외한다.
7. native bridge는 MOEMOA의 durable ticket과 app-private staging 요구를 직접 구현하는 최소 custom Capacitor plugin으로 시작한다.
8. `@capgo/capacitor-share-target` v8은 유지보수 중인 대안이지만 event가 raw URI/file path를 전달하고 MOEMOA의 durable ticket/recovery contract를 제공하지 않으므로 첫 선택으로 고정하지 않는다.

## Bridge spike contract

```text
claimPendingIntake() -> IntakeTicket | null
pickImage() -> IntakeTicket | null
importToPrivate(ticketId, ownerKey, assetId, operationId) -> ImportedMedia
discardIntake(ticketId)
stat(localRef) -> LocalMediaStat | null
deleteLocal(localRef, operationId)
```

native queue는 source URI를 JS/localStorage/analytics에 영구 노출하지 않는다. JS에는 ticket ID와 검증된 display metadata만 전달한다.

## Toolchain gate result

다음 gate는 2026-08-12 terminal 기반 검증으로 통과했다.

- Node 24.19.0 portable runtime과 `.nvmrc`/`.node-version`으로 project version 재현
- application ID `com.newrred.moemoa` 확인
- Android SDK platform 36과 build-tools 36.0.0 확인
- JBR 21 + generated Gradle 8.14.3으로 `assembleDebug` 성공

공식 문서가 권장하는 Android Studio IDE 하한보다 로컬 IDE는 낮다. 그러나 첫 spike는 IDE 기능에 의존하지 않고 동일 Android toolchain을 terminal에서 사용해 빌드 가능함을 검증했다. IDE 전용 기능이 필요해지거나 CLI와 IDE 간 차이가 발견되면 최신 안정판을 side-by-side 설치하는 gate를 다시 연다.

## Rejected alternative

### Capacitor 7로 임시 시작

현재 Node 20과 Android Studio 2025.1.1에는 맞지만 v7 maintenance는 2026-06-08에 끝났고 extended support도 2026-12-08 종료 예정이다. 신규 제품 기반으로 채택하면 수개월 안에 major migration이 필요하므로 권장하지 않는다.

## Review after spike

- custom plugin code가 third-party plugin보다 현저히 복잡한가
- process death 뒤 ticket recovery가 가능한가
- source grant 만료 후 app-private copy가 열리는가
- API 24와 현재 Android 기기에서 Photo Picker fallback이 동작하는가
- invalid MIME, oversized stream, storage full을 typed error로 반환하는가

## Spike implementation result — 2026-08-12

- custom plugin은 raw URI를 JS에 전달하지 않고 background copy 완료 뒤 opaque ticket과 bounded JPEG preview만 공개한다.
- original은 20 MiB streaming limit, JPEG/PNG/WebP allowlist, SHA-256을 적용한다.
- pending ticket은 app-private file로 유지되어 process restart 뒤 claim 가능한 구조다. 실제 process-death 재claim은 물리 실기기 gate로 남는다.
- API 36 emulator에서 ACTION_SEND 수신, app-private original/preview/ticket 생성, Web composer 표시, discard cleanup, system Photo Picker launch/cancel을 확인했다.
- native local server의 trailing-slash route가 root document로 fallback하는 것을 발견해 composer는 exact static asset `/memory/new/index.html`로 연다.
- 손상된 ticket이 다른 app-private file을 preview로 참조하지 못하도록 ticket ID와 derived file name을 재검증한다.
