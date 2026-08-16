# 첫 Private Vertical Slice 승인 기록

- Status: `CONFIRMED`
- Date: 2026-08-12
- Approved by: 사용자
- Related decisions: `TECH-01`, `STORAGE-LOCAL-01`, `LEGACY-01`, `ACCOUNT-01`, `CARD-01`
- Architecture proposal: `../reports/architecture-decision-proposal.md`
- ExecPlan: `../plans/first-private-vertical-slice.md`

## 승인 내용

사용자는 architecture proposal과 ExecPlan 설명을 확인한 뒤 구현 진행을 승인했다.

승인 범위:

1. 첫 구현은 Android local-only Card + Archive로 제한한다.
2. 신규 owner-scoped IndexedDB `moemoa-memory-v1`과 설치별 Guest Owner를 사용한다.
3. Android native image intake는 전체 제품 구현 전에 실기기 spike로 검증한다.
4. Web에서는 공통 React UI와 domain을 개발하되, Web production의 실제 LOCAL_ONLY image 영구 저장은 첫 slice에서 제외한다.
5. Board/Web production read path, 계정 승격·sync, private cloud, 본격 catalog ingestion, Public은 후속 slice로 분리한다.
6. 첫 slice에는 export를 포함하고 restore/import는 후속 계획으로 둔다.

## 구현 순서 해석

승인은 `Web 제품 전체를 완성한 뒤 Android를 새로 시작`한다는 의미가 아니다.

```text
최소 Android 실기기 spike
→ 공통 Web/React domain·Card·Archive 개발
→ Android native adapter 결합
→ 실기기 end-to-end 검증
```

이 순서를 사용해 Web 구현이 browser-only API에 고정되는 것을 막는다.

2026-08-16 사용자 승인으로, 위 native/local 기반이 실제로 구축된 다음 단계의 UI 실행 순서를 아래처럼 보완했다.

```text
구축된 Android native/local 기반 유지·기능 확장 동결
→ Web 내부 테스트 surface에서 공용 Memory UI readiness 검증
→ Android 전용 적응·실기기 검증
→ 첫 slice 잔여 기능과 안전 gate 마감
```

이는 기존 승인과 충돌하지 않는다. Web production의 실제 LOCAL_ONLY 이미지 저장, Board/Web production read path, sync/cloud/Public은 계속 후속 범위다. 상세 결정은 `2026-08-16-web-first-shared-ui-readiness.md`, UI 기준은 `../../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`를 따른다.

## 승인하지 않은 내용

- production 배포
- Public UGC 또는 Public image
- private image 자동 업로드
- 기존 Library/WatchLog/Tier destructive migration

위 항목은 각 gate 또는 별도 환경 변경 승인 뒤 진행한다.

## 후속 환경 결정

2026-08-12 사용자는 다음 환경 변경도 승인했다.

- Android application ID는 `com.newrred.moemoa`로 확정한다.
- Capacitor 8을 위한 Node 22+ 환경을 준비한다.
- Computer Use는 사용하지 않고 terminal 기반 scaffold·build·검증을 사용한다.
- 시스템 Node 교체가 현재 실행 호스트와 충돌하므로 MOEMOA 작업에는 공식 Node 24.19.0 portable runtime을 사용한다. 시스템 Node 20은 다른 프로젝트 호환성을 위해 변경하지 않는다.
- Android Studio UI 업데이트를 선행 조건으로 삼지 않는다. 설치된 JBR 21, Android SDK 36, generated Gradle wrapper로 CLI build를 먼저 검증하고 IDE 업데이트는 필요 시 별도로 수행한다.
