# Unified Supabase User Data 테스트 증거

> **상태: `IN PROGRESS — TASK 0 COMPLETE`**
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
