# Phase 2 기반 결정 기록

- Status: `CONFIRMED`
- Date: 2026-08-11
- Owner/Approver: 사용자
- Scope: `TECH-01`, `STORAGE-LOCAL-01`, `LEGACY-01`
- Source discussion: `reports/open-decision-questions.md`
- Related ADR: `../adr/0001-capacitor-client-and-local-media-boundary.md`

## TECH-01 — Web/Android 기술 방식

### Context

현재 제품은 Astro 5 + React 19 Web/PWA이고 Android project, Share Target, Photo Picker, native file lifecycle이 없다. Web과 Android가 동일한 제품·도메인을 사용하면서 기존 React 자산을 최대한 재사용해야 한다.

### Options considered

1. PWA/TWA
2. Astro/React + Capacitor shell
3. Kotlin/Compose native

### Decision

**옵션 2, Astro/React + Capacitor Android shell을 채택한다.** 공통 React UI와 JS/TS domain contract를 재사용하고, Share Intent, Photo Picker, app-private filesystem, App Link 같은 Android 기능은 native bridge/plugin 경계로 격리한다.

### Rationale

- 현재 Web 자산의 재사용률이 높다.
- 이미지 intake와 file lifecycle은 PWA보다 Android native 경계에서 통제하기 쉽다.
- Kotlin/Compose 전체 재작성보다 1인 개발의 이중 client 유지비가 낮다.

### Consequences

- ADR-0001은 client와 local media의 논리 경계를 확정한다. Phase 2 ExecPlan과 후속 ADR에서 Capacitor 버전, Android 최소 버전, plugin 선택, bridge contract, build/release 구조를 구체화한다.
- dependency 설치와 Android scaffold 전에 공유→복사→process death→재실행 복구 spike의 완료 조건을 계획한다.
- Astro/React 화면 전체가 자동으로 Android에 적합하다고 간주하지 않는다.

### Migration/rollback impact

아직 코드·dependency·schema를 변경하지 않았으므로 즉시 rollback은 문서 결정 취소다. spike에서 URI/file lifecycle, 성능, plugin 유지보수 조건을 만족하지 못하면 PWA/TWA 축소 또는 Kotlin/Compose 경계를 재검토한다.

### Review trigger/date

- process death 후 file/draft 복구 실패
- 핵심 native plugin의 유지보수 중단 또는 Play 정책 비호환
- Web UI 재사용보다 bridge 복잡도가 더 커진다는 구현 증거 확보

## STORAGE-LOCAL-01 — Android 로컬 이미지 저장

### Context

공유 intent나 Photo Picker의 source URI는 권한 만료·원본 삭제·process death 때문에 Complete Card의 장기 원본으로 신뢰할 수 없다.

### Options considered

1. app-private filesystem + DB metadata
2. SQLite/DB Blob
3. source URI reference 유지

### Decision

**옵션 1, app-private filesystem + DB metadata를 채택한다.** 선택한 원본은 승인된 앱 전용 저장 경로에 복사하고 DB에는 VisualAsset의 ownerId, localRef, checksum, MIME, byte size, dimensions, lifecycle state 등 메타데이터를 둔다.

### Rationale

- source URI 수명과 원본 앱의 삭제에 의존하지 않는다.
- 대용량 image byte로 DB를 팽창시키지 않는다.
- 파일과 metadata의 수명주기·export·delete를 명시적으로 시험할 수 있다.

### Consequences

- 파일 복사와 DB commit 사이의 실패 보상, orphan 탐지, exact hash 중복 처리, 저장 공간 부족 UX가 필요하다.
- `LOCAL_ONLY`는 cloud backup이나 Public 게시를 의미하지 않는다.
- 실제 directory/API와 DB engine은 Phase 2 ExecPlan 또는 후속 ADR에서 확정한다.

### Migration/rollback impact

아직 실제 파일 migration은 없다. 구현 시 source URI를 canonical 원본으로 저장하지 않으며, 실패하면 미완성 파일과 Draft metadata를 안전하게 정리하거나 재개할 수 있어야 한다.

### Review trigger/date

- 선택한 filesystem API가 Android process death/OS cleanup에서 내구성을 보장하지 못함
- export/restore/delete에서 파일과 metadata 일관성을 유지하지 못함
- 실기기 저장 비용이나 성능이 beta 기준을 충족하지 못함

## LEGACY-01 — 기존 Library/WatchLog/Tier 처리

### Context

기존 Library/WatchLog/Tier에는 VisualAsset과 신규 Card/Board invariant가 없다. 이를 자동으로 Complete Card나 Board로 승격하면 사용자가 만들지 않은 기록을 생성하고 의미를 왜곡할 수 있다.

### Options considered

1. 보수적 이전
2. system design을 자동 생성하는 적극적 이전
3. 새 workspace + 선택 import

### Decision

**옵션 1, 보수적 이전을 채택한다.**

- Library는 `legacy title state`로 보존한다.
- WatchLog는 MemoryCard `DRAFT` seed 또는 `LegacyMemorySignal`로 보존한다.
- Tier는 legacy read-only로 보존하고 Board로 자동 변환하지 않는다.
- 사용자가 작품과 VisualAsset을 확인·연결한 뒤에만 Complete Card로 승격한다.
- Tier→Board opt-in 변환은 별도 결정 전 기본 제공하지 않는다.

### Rationale

- CARD-01의 Complete invariant를 지킨다.
- 과거 기록을 삭제하지 않으면서 자동 생성·오승격을 피한다.
- migration preview, idempotency, rollback을 검증할 수 있다.

### Consequences

- legacy와 신규 Card UI를 한동안 함께 유지해야 한다.
- 신규 Archive가 초기에는 과거 WatchLog 전체를 Complete Card로 표시하지 않는다.
- migration codec과 사용자 확인 UX를 별도 ExecPlan에 포함한다.

### Migration/rollback impact

원본 legacy record와 ID/timestamp를 유지하고 destructive migration을 금지한다. 변환은 opt-in·재실행 가능해야 하며 실패 시 원본 legacy 상태로 돌아갈 수 있어야 한다.

### Review trigger/date

- 실제 사용자 표본에서 Draft seed 방식이 과거 기록 접근성을 심각하게 떨어뜨림
- opt-in Tier→Board mapping을 안전하게 preview할 수 있는 명확한 규칙 확보
- legacy 데이터 품질 감사에서 별도 격리 전략이 필요하다는 증거 확보

## Affected files/modules/docs

- `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`
- `docs/moemoa/README.md`
- `docs/moemoa/reports/open-decision-questions.md`
- 향후 `docs/moemoa/adr/`와 첫 Private Vertical Slice ExecPlan

이번 기록은 문서 결정만 확정한다. code, dependency, Android scaffold, DB migration을 승인하거나 실행한 것은 아니다.
