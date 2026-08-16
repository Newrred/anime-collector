# Web-first Shared UI Readiness 디자인 명세

> **문서 상태: `APPROVED DESIGN`**
> 승인일: 2026-08-16
> 승인자: 사용자
> 적용 범위: 첫 Private Vertical Slice의 공통 Memory UI 안정화
> 실행 계획: `docs/moemoa/plans/first-private-vertical-slice.md`
> 결정 기록: `docs/moemoa/decisions/2026-08-16-web-first-shared-ui-readiness.md`

## 1. 결정 요약

첫 Private Vertical Slice의 Android native 기반과 local-only 데이터 경계는 유지한다. 새 기능 개발을 잠시 동결하고, 공통 React Memory UI를 Web 내부 테스트 환경에서 모바일 우선으로 완성·검증한 뒤 Android 전용 적응과 실기기 검증으로 복귀한다.

```text
Android native 기반 유지·동결
→ Web 내부 테스트 surface에서 공통 Memory UI 안정화
→ Web 모바일·데스크톱 UI Readiness Gate
→ Android 호환성·전용 UX 적용
→ 첫 Slice 잔여 안전 기능과 실기기 dogfood
→ 첫 Slice 종료
→ Private Board + Web read path
```

이 결정은 Web 제품 전체를 Android보다 먼저 출시한다는 의미가 아니다. Web production의 실제 LOCAL_ONLY 이미지 영구 저장, 로그인·동기화, private cloud, Public은 기존 gate를 유지한다.

## 2. 배경과 문제

현재 구현은 Card 생성·재시작·Archive 재열람·이미지 교체·삭제의 기능 안정성은 검증했지만 실제 APK에서 다음 문제가 관찰됐다.

- 정보 위계가 약하고 화면이 조잡하게 보인다.
- 작은 화면에서 문구와 조작부가 잘리거나 밀린다.
- 핵심 행동과 설명을 빠르게 구분하기 어렵다.
- 기능을 평가하기 전에 UI 자체가 사용을 방해한다.

현재 자동 검증에도 다음 공백이 있다.

- 공통 mobile layout suite가 Memory 작성·Archive·상세 route를 포함하지 않는다.
- 시각 회귀용 기준 스크린샷이 없다.
- 기존 layout 검사는 주로 document overflow와 기하 수치에 집중한다.
- Android 상태바·하단 시스템 영역·키보드·뒤로가기는 Web 검사만으로 증명할 수 없다.
- 통과한 React 정적 진단은 제품 가독성과 시각적 위계를 보증하지 않는다.

따라서 기능 추가보다 공통 UI Readiness를 먼저 확보해야 첫 제품 가설을 유효하게 테스트할 수 있다.

## 3. 목표

사용자가 설명 없이 다음 흐름을 완료할 수 있는 공통 UI를 만든다.

```text
카드 만들기 진입
→ 이미지 또는 시스템 디자인 확인
→ 작품 검색 또는 PrivateTitle
→ 선택적 짧은 감상
→ 저장 가능 조건 이해
→ Archive에서 카드 발견
→ 상세 재열람·수정·이미지 교체·삭제
```

Web은 이 UI를 빠르게 반복·검증하는 작업 surface다. Android는 동일한 React UI와 domain을 사용하되 native image intake, app-private media, 안전영역, 키보드, back navigation을 플랫폼 adapter와 shell로 처리한다.

## 4. 범위

### 포함

- `/memory/new/` 카드 작성 UI.
- `/archive/` 목록·빈 상태·재방문 UI.
- `/memory/card/` 상세·수정·교체·삭제 UI.
- 핵심 Memory 흐름으로 들어가는 최소 navigation entry.
- Memory 범위의 typography, spacing, surface, button, input, feedback, image frame 규칙.
- 모바일 우선 responsive layout과 데스크톱 확장.
- loading, empty, error, offline, provider failure, missing image, cleanup pending 상태.
- English-first 기준 copy와 Korean 개발 locale의 레이아웃 호환.
- Web 기능 E2E, layout, accessibility, visual regression.
- Android 단계별 smoke와 최종 실기기 UI 검증 계약.

### 제외

- Web production 이미지 업로드·영구 저장.
- Board/BoardCard.
- 로그인, guest→account 승격, metadata sync.
- private cloud image backup.
- Public, UGC, moderation.
- 기존 Library/Tier/Profile/Data 전체 재설계.
- 전체 `global.css` 일괄 재작성.
- 신규 디자인 시스템 dependency 도입.

## 5. 아키텍처 경계

기존 modular monolith와 port/adapter 경계를 유지한다.

```text
Shared Memory UI
├─ Memory screen components
├─ Memory-scoped UI primitives/tokens
├─ view state와 accessibility contract
└─ application/runtime port 호출

Web internal test surface
├─ responsive layout 검증
├─ deterministic fake native adapter
└─ visual/interaction test harness

Android app surface
├─ 동일한 Shared Memory UI
├─ Capacitor ImageIntake/LocalMedia bridge
├─ safe-area/status/navigation bar shell
└─ back/keyboard/lifecycle 처리
```

UI는 IndexedDB, Capacitor plugin, AniList를 직접 호출하지 않는다. 데이터·media lifecycle·privacy 계약은 변경하지 않는다. Web fake adapter의 preview나 Blob은 production persistence로 취급하지 않는다.

## 6. UI 기반 규칙

### 정보 위계

- 한 화면의 primary action은 원칙적으로 하나다.
- 제목, 상태, 설명, 행동을 시각적으로 구분한다.
- 내부 개발 용어인 `vertical slice`, operation state, provider provenance는 사용자 행동을 방해하지 않는 위치로 내린다.
- 필수 입력과 선택 입력을 문구와 배치로 분리한다.
- 저장 불가 상태는 disabled 버튼만 두지 않고 부족한 조건을 바로 설명한다.

### 가독성

- 모바일 본문 기준 크기는 16px를 기본으로 하고 보조 문구도 읽을 수 있는 대비와 줄 간격을 유지한다.
- 긴 한글·영문·일본어 작품 제목은 컨테이너를 밀어내지 않고 자연스럽게 줄바꿈한다.
- 버튼 문구는 의미가 손실되는 말줄임을 사용하지 않는다.
- English-first 제품 방향을 기준 copy로 사용하되 한국어에서 레이아웃이 깨지지 않아야 한다.
- Thai/Vietnamese 정식 번역은 이번 범위가 아니지만 30% 길어진 문구 fixture로 확장성을 검사한다.

### 조작

- 터치 대상은 최소 44×44px이다.
- 모바일 primary action은 엄지 접근이 가능하고 키보드·시스템 영역에 가리지 않는다.
- 위험 행동은 primary action과 충분히 분리하고 명시적 확인을 요구한다.
- 비동기 행동 중 중복 탭을 막되 취소·재시도 가능 여부를 분명히 표시한다.

### 이미지

- 원본 비율을 과도하게 자르지 않고 `contain`과 bounded frame을 기본으로 한다.
- 목록 thumbnail과 상세 preview의 목적을 분리한다.
- 이미지가 없거나 누락된 상태는 깨진 아이콘이 아니라 설명과 복구 행동을 제공한다.
- 시스템 디자인은 이미지 실패의 오류 화면처럼 보이지 않아야 한다.

## 7. 화면별 구조

### 카드 작성

```text
간결한 상단 navigation
→ 이미지/시스템 디자인 선택과 큰 preview
→ 작품 검색·선택 또는 PrivateTitle
→ 선택적 감상
→ 권리·로컬 저장 안내
→ 저장 조건 설명과 primary save action
```

모바일은 단일 열을 사용한다. 데스크톱에서는 preview와 form을 2열로 확장할 수 있지만 DOM 순서와 키보드 탐색 순서는 모바일 흐름을 유지한다.

### Archive

- 첫 화면에서 저장된 카드 수와 새 카드 만들기 행동을 바로 이해할 수 있어야 한다.
- 빈 상태는 제품 설명, 시스템 디자인 대안, 첫 카드 행동을 제공한다.
- 카드에는 이미지, 작품 제목, 짧은 기억 신호, 시점만 우선 노출한다.
- 긴 note 전체를 목록에 표시하지 않는다.

### 카드 상세

- 이미지와 작품 기억이 먼저 보이고 수정 도구는 다음 위계에 둔다.
- 일반 보기와 이미지 교체 mode를 분리한다.
- missing image에서는 `이미지 복구`와 `카드 삭제`를 함께 제공한다.
- post-commit cleanup pending은 저장 실패처럼 오해시키지 않고 새 이미지 성공과 백그라운드 정리 상태를 구분한다.

## 8. 상태와 오류 처리

각 화면은 최소 다음 상태를 독립적으로 표현한다.

| 상태 | 사용자 결과 |
| --- | --- |
| 초기 로딩 | 레이아웃 이동이 적은 skeleton 또는 명확한 loading |
| 빈 Archive | 제품 가치와 첫 행동 설명 |
| 이미지 없음 | 시스템 디자인 또는 Android 선택 행동 |
| provider unavailable | PrivateTitle로 계속 진행 가능 |
| offline | 로컬 저장 가능 여부를 명확히 표시 |
| validation 부족 | 저장에 필요한 항목을 해당 위치에서 설명 |
| 저장 중 | 중복 제출 방지와 진행 상태 |
| 저장 실패 | 데이터 보존 여부와 재시도 행동 |
| missing image | Card 보존, 복구·삭제 행동 |
| cleanup pending | 새 Card 성공 유지, 다음 시작 시 정리 재시도 |
| 삭제 확인 | 되돌릴 수 없는 범위 설명 |

자유 형식 native 오류, source URI, localRef, hash, note 원문은 일반 로그나 분석 이벤트에 포함하지 않는다.

## 9. Web UI Readiness Gate

### viewport

- 320px: 핵심 흐름 사용 가능.
- 360×740, 390×844, 412×915: 모바일 기준 통과.
- 768×1024: 태블릿 통과.
- 1280×800, 1440×900: 데스크톱 통과.

### 자동 검증

- Memory 세 route의 document/body/child horizontal overflow 0.5px 이하.
- 사용자에게 보이는 text button 최소 높이 44px.
- long-title, long-copy, empty, error, missing-image fixture.
- create→Archive→detail→edit→replace/delete E2E.
- keyboard-only focus order와 visible focus.
- 주요 화면의 승인된 screenshot baseline과 visual diff.
- `prefers-reduced-motion`에서 핵심 행동 유지.
- 기존 legacy route 회귀.

### 사람 검토

- 설명 없이 첫 Card를 2분 이내 저장.
- 저장 직후 Archive에서 방금 만든 Card를 발견.
- 이미지가 왜 필요한지와 시스템 디자인 대안을 이해.
- Private/LOCAL_ONLY 상태를 Public 또는 cloud backup으로 오해하지 않음.
- 상세에서 수정과 삭제의 차이를 이해.

90초 first-card time은 승인된 KPI가 아니라 내부 마찰 진단용 참고값으로만 기록한다.

## 10. Android 적용 Gate

Web UI Gate 통과 전에는 Android UI 확장을 시작하지 않는다. 단, 각 큰 UI checkpoint에서 다음 smoke는 유지한다.

- `astro build`와 `cap sync android` 성공.
- debug APK build 성공.
- cold launch와 핵심 route mount 확인.

Web UI Gate 뒤 Android에서 추가 검증한다.

- status bar, camera cutout, navigation bar safe area.
- Android back과 confirmation dialog.
- soft keyboard resize/pan과 focused input 가시성.
- Share Target, Photo Picker, permission cancel.
- background/foreground, rotation, process death.
- 실제 Gallery/외부 앱 share와 app-private preview.
- API 24~32 fallback 및 최신 API.

Web screenshot 통과를 Android UI 통과로 간주하지 않는다.

## 11. 데이터·보안·권리 영향

- IndexedDB schema version은 변경하지 않는다.
- app-private media directory와 operation journal을 변경하지 않는다.
- legacy data migration은 없다.
- LOCAL_ONLY/PRIVATE/Public off 기본값을 유지한다.
- 사용자가 선택한 이미지의 개인 기록 권리 확인을 유지한다.
- Web fake adapter는 production build에서 노출하지 않는다.
- rollback 시 UI feature flag를 끄더라도 사용자 Card와 media를 자동 삭제하지 않는다.

## 12. 실행 순서

1. 문서와 state matrix를 기준선으로 고정한다.
2. Memory-scoped UI primitives와 layout shell을 정리한다.
3. 카드 작성 화면을 모바일 우선으로 재구성한다.
4. Archive와 상세 화면을 같은 규칙으로 맞춘다.
5. Web 기능·layout·accessibility·visual gate를 통과한다.
6. Android shell 적응과 실기기 UI gate를 수행한다.
7. 첫 Slice의 orphan/MISSING, export, TTL, feature flag, device matrix를 완료한다.
8. Milestone 7 완료 보고 뒤 Private Board + Web read path 승인을 연다.

## 13. 롤백

- 기존 domain/application/repository contract는 유지하므로 UI 변경은 route/feature flag 수준에서 되돌릴 수 있어야 한다.
- 전역 CSS를 일괄 제거하지 않고 Memory 범위에서 새 규칙을 적용한다.
- 새 UI가 gate를 통과하지 못하면 이전 UI를 자동 삭제하지 않고 비교 가능한 상태로 유지한다.
- rollback은 데이터 삭제를 의미하지 않는다.

## 14. 문서 Source of Truth

| 내용 | 기준 문서 |
| --- | --- |
| 제품 역할·범위 | `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` |
| Web/Android 아키텍처 | `docs/moemoa/06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md` |
| 현재 구현 순서 | `docs/moemoa/plans/first-private-vertical-slice.md` |
| UI 디자인 계약 | 이 문서 |
| QA·출시 gate | `docs/moemoa/07_QA_ANALYTICS_LAUNCH_OPERATIONS.md` |
| 현재 검증 증거 | `docs/moemoa/reports/private-slice-test-evidence.md` |

과거 `docs/superpowers` 계획은 이 명세를 제외하면 legacy 또는 superseded 상태를 유지한다.

## 15. 승인 결과

2026-08-16 사용자는 다음을 승인했다.

1. Android native 기반과 첫 local-only Slice를 유지한다.
2. 새 기능을 잠시 동결하고 Web 내부 테스트 surface에서 공통 Memory UI를 먼저 완성한다.
3. Web UI Readiness Gate 뒤 Android 전용 적응과 실기기 검증으로 복귀한다.
4. 실제 Web production 이미지·sync·cloud/Public은 기존 후속 gate를 유지한다.
5. 기존 문서의 상태와 실행 순서를 이 결정에 맞게 정리한다.
