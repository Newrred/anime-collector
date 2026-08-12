# ADR-0001 — Capacitor client와 local media 경계

- Status: `ACCEPTED`
- Date: 2026-08-11
- Approved by: 사용자
- Related decisions: `TECH-01`, `STORAGE-LOCAL-01`
- Decision Log: `../decisions/2026-08-11-foundation-decisions.md`

## Context

현재 Astro 5 + React 19 Web/PWA를 유지하면서 Android Share Intent, Photo Picker, process death 복구, app-private file lifecycle을 지원해야 한다. source URI는 장기 원본으로 신뢰할 수 없고, image byte를 DB Blob으로 저장하면 DB 크기·메모리·backup 비용이 커질 수 있다.

## Decision

1. Android client는 기존 Astro/React surface와 JS/TS domain contract를 재사용하는 Capacitor shell로 구성한다.
2. Android native 기능은 명시적 bridge/plugin adapter 뒤에 둔다.
3. 외부에서 받은 image는 app-private filesystem에 내구성 있게 복사한다.
4. DB에는 VisualAsset metadata와 file reference를 저장하며 image byte를 기본 Blob 모델로 두지 않는다.
5. source URI는 intake source일 뿐 Complete Card의 canonical 원본이 아니다.
6. LOCAL_ONLY file과 metadata commit은 실패 보상·orphan reconciliation이 가능한 transaction protocol로 설계한다.

## Boundary

```text
Shared Astro/React + JS/TS domain
        │
Capacitor platform adapter
        ├── Share Intent intake
        ├── Photo Picker
        ├── app-private filesystem
        ├── App Link/auth callback
        └── lifecycle/process-death recovery

VisualAsset metadata DB
        └── localRef → app-private file
```

## Consequences

### Positive

- 기존 React 자산을 재사용한다.
- native file lifecycle과 intent 복구를 platform boundary에서 시험할 수 있다.
- 대용량 image byte와 metadata query를 분리한다.
- Web/PWA와 Android가 같은 domain invariant를 공유한다.

### Negative

- Capacitor/plugin 호환성과 Android build/release를 추가로 관리해야 한다.
- file copy와 DB commit이 하나의 물리 transaction이 아니므로 보상 protocol이 필요하다.
- 일부 Android UX는 Web surface 재사용보다 native adapter가 더 복잡할 수 있다.

## Not decided by this ADR

- Capacitor와 plugin의 정확한 버전
- Android 최소 SDK/target SDK
- bridge method/event schema
- local metadata DB engine과 실제 directory path
- BACKEND-01, AUTH-01, SYNC-01
- private cloud backup과 Public media
- dependency 설치와 scaffold 실행 시점

위 항목은 첫 Private Vertical Slice ExecPlan과 필요한 후속 ADR에서 확정한다.

## Required validation before implementation approval

- 동일 image의 Share Intent/Photo Picker intake
- source URI permission 만료 뒤 복사본 접근
- copy 도중 process kill과 재실행 recovery
- DB commit 실패와 orphan file reconciliation
- storage full/permission denial/cancel
- duplicate intent와 exact hash 처리
- export/delete 후 file/metadata 일관성

## Review triggers

- 필수 plugin의 유지보수 중단 또는 Play 정책 비호환
- process death/file durability acceptance test 실패
- bridge 복잡도가 재사용 이점을 상쇄한다는 구현 증거
- 실기기 성능·저장 비용이 beta 목표를 충족하지 못함
