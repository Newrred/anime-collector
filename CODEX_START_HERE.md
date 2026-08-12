# CODEX START HERE — MOEMOA

> **현재 저장소 상태 — 2026-08-11**
> MOEMOA 인수인계 패키지 설치와 최초 저장소 감사가 완료됐고, `TECH-01`, `STORAGE-LOCAL-01`, `LEGACY-01`과 첫 Private Vertical Slice가 사용자 승인으로 확정됐다. 현재는 **Milestone 0 environment gate 진행 중**이다. 아래 Phase 0~1 설명은 새 저장소에 다시 설치하거나 코드가 크게 바뀌어 재감사할 때 사용한다.

## 1. 목적

이 파일은 Codex가 기존 ChatGPT 세션 없이도 MOEMOA의 제품 맥락, 확정 결정, 금지사항, 참조 문서, 작업 순서를 재구성하게 하는 진입점이다.

Codex는 세션 대화를 추측하거나 이전 요약을 현재 코드 상태로 간주하지 않는다. 모든 구현 상태는 실제 저장소에서 확인한다.

## 2. 제품 기준점

> MOEMOA는 사용자가 애니를 보며 남기고 싶은 장면을 이미지 중심 Memory Card로 만들고, 이를 Archive와 Board에 수집·재구성하며, 준비된 범위 안에서 공유하는 서비스다.

핵심 구조:

```text
작품 검색 또는 개인 작품 생성
→ 사용자 이미지 또는 서비스 디자인 카드 선택
→ 선택적 기억 신호 추가
→ Memory Card 저장
→ Archive 자동 축적
→ Board 선택 분류
→ 로그인 후 Web·백업·다기기
→ 권리·UGC 게이트 통과 시 제한적 Public
```

## 3. 소스 계층

| 우선순위 | 자료 | 용도 |
| ---: | --- | --- |
| 1 | `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md` | 현재 확정 결정과 미정 게이트 |
| 2 | 실제 저장소 코드·설정·테스트·마이그레이션 | 현재 구현 상태의 유일한 기술적 사실 |
| 3 | `reports/repository-audit.md` | 2026-08-11 시점의 증거 기반 구현 snapshot. 코드 변경 시 재검증 |
| 4 | 승인된 Decision Log/ADR/ExecPlan | 해당 범위의 결정·기술 경계·실행 계획. `01`을 변경할 수 없음 |
| 5 | `02`~`09` 실행 명세 | `CURRENT/GATED`가 섞인 구현·검수·운영 기준. 개별 문서 banner와 index 확인 |
| 6 | `reports/implementation-gap-analysis.md` | 확정 결정과 현재 코드 사이의 Gap·권장 이전 순서. 승인된 ExecPlan은 아님 |
| 7 | `reports/architecture-options.md`, `reports/open-decision-questions.md` | TECH/STORAGE/LEGACY 확정 이력과 나머지 승인 전 선택지 |
| 8 | `references/2026-08-10-product-direction-research-integrated.md` | 시장·경쟁·제품 권고 배경 |
| 9 | `references/2026-08-06-product-direction-decision-draft.md` 및 legacy 문서 | 최초 방향과 과거 상태 기록 |

상위 자료와 하위 자료가 충돌하면 상위 자료를 우선한다. 실제 코드 상태와 제품 결정이 충돌하면 Codex가 임의로 화해시키지 않고 Gap으로 보고한다.

## 4. 작업별 필수 참조 문서

| 작업 종류 | 반드시 읽을 문서 | 보조 문서 |
| --- | --- | --- |
| 최초 저장소 감사 | `03_REPOSITORY_AUDIT_PROTOCOL.md` | `01`, 과거 references |
| 제품 흐름·UI | `01`, `02_PRODUCT_SCOPE_AND_USER_FLOWS.md` | `06` |
| Web/Android 구조 | `01`, `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`, `reports/architecture-options.md` | `reports/repository-audit.md`, `reports/open-decision-questions.md`, `07` |
| 작품 카탈로그·수집 | `01`, `04_CATALOG_DATA_AND_INGESTION_SPEC.md` | Source Registry 템플릿 |
| 이미지 저장·동기화 | `01`, `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md` | `06`, `07` |
| 공개 UGC | `01`, `05`, `07` | UGC launch gate 템플릿 |
| 인증·로컬 승격·동기화 | `01`, `06`, `07` | `02` |
| DB 마이그레이션 | `03`, `06`, `09` + `PLANS.md` | 해당 도메인 명세 |
| QA·회귀 테스트 | `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md` | `09` |
| 베타·출시 | `07`, `08_CODEX_PHASE_RUNBOOK.md` | `05` |
| 코드 리뷰 | `09_CHANGE_CONTROL_AND_REPORTING.md` | `prompts/moemoa/06_CODE_REVIEW.md` |
| 결정 변경 | `01`, `09` | Decision Log 템플릿 |

## 5. 단계별 읽기 순서

### Phase 0 — 패키지 설치와 지침 확인

읽기:

1. `AGENTS.md`
2. 이 파일
3. `01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`

행동:

- 기존 `AGENTS.md`, `README`, package manifest, build scripts를 확인한다.
- 기존 지침과 충돌을 보고한다.
- 코드 변경은 하지 않는다.

### Phase 1 — 저장소 감사

현재 상태: **2026-08-11 최초 감사 완료.** `docs/moemoa/reports/`의 4개 문서를 사용한다. 코드·인프라가 바뀌면 이 phase를 다시 실행한다.

읽기:

- `03_REPOSITORY_AUDIT_PROTOCOL.md`
- 과거 reference 문서의 현재 프로젝트 상태 메모

행동:

- 프레임워크, 앱 구조, DB, 인증, 이미지, AniList 의존, aliases, 테스트, CI/CD를 증거 기반으로 확인한다.
- `reports/repository-audit.md` 등 4개 산출물을 작성한다.

### Phase 2 — 기술 방향과 ExecPlan

현재 상태: **제안서와 ExecPlan 승인 완료, Milestone 0 진행 중.**

읽기:

- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `PLANS.md`
- `decisions/2026-08-11-foundation-decisions.md`
- `adr/0001-capacitor-client-and-local-media-boundary.md`
- `reports/repository-audit.md`
- `reports/implementation-gap-analysis.md`
- `reports/architecture-options.md`
- `reports/open-decision-questions.md`
- `reports/architecture-decision-proposal.md`
- `plans/first-private-vertical-slice.md`

행동:

- 현재 스택을 최대한 활용하는 옵션을 우선 제시한다.
- Web+Android를 완전히 별개로 재구축하지 않는다.
- 확정된 Astro/React + Capacitor, app-private filesystem + DB metadata, 보수적 legacy 이전을 입력 조건으로 사용한다.
- 첫 Vertical Slice와 단계별 마이그레이션 ExecPlan을 작성한다.
- 최소 catalog adapter와 본격 catalog ingestion을 분리하고 Phase 3 이후 실제 실행 순서를 제안한다.
- 승인 전 대규모 구현을 시작하지 않는다.

> **Phase 3 이후 순서 주의:** 아래 번호는 audit 이전 runbook의 작업 묶음이지 승인된 실행 순서가 아니다. 새 architecture proposal과 ExecPlan은 `local-only Card/Archive → Board/Web → sync → private cloud → 제한 catalog`를 제안한다. 사용자 승인 전에는 이 순서를 확정으로 간주하거나 Phase 3·4 구현을 시작하지 않는다.

### Phase 3 — 카탈로그 기반

읽기:

- `04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- Source Registry 템플릿

행동:

- 소스 승인 체계와 raw staging을 먼저 구현한다.
- 소규모 대표 표본으로 수집·정규화·중복·충돌·멱등성을 검증한다.
- 전체 대상 대량 수집은 표본 파이프라인과 승인 게이트 통과 후 진행한다.
- Private Slice에 필요한 최소 검색 adapter와 본격 ingestion은 서로 다른 마일스톤으로 계획한다.

### Phase 4 — Private Vertical Slice

읽기:

- `02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- `06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

행동:

```text
Android Share Target 또는 Photo Picker
→ 작품 검색/PrivateTitle
→ 이미지 우선 Memory Card
→ LOCAL_ONLY 저장
→ Archive
→ Board
→ 선택 로그인
→ Web에서 동기화된 카드 확인
```

### Phase 5 — 이미지 클라우드와 UGC 기반

읽기:

- `05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`

행동:

- `LOCAL_ONLY / PRIVATE_CLOUD / PUBLIC`을 분리한다.
- 로그인만으로 이미지를 자동 업로드하지 않는다.
- Quarantine, 파일 검사, 권리 메타데이터, 신고·차단·심사·삭제·이의제기·감사 로그를 구현한다.
- Public 기능은 플래그 뒤에 둔다.

### Phase 6 — 제한적 Public 베타

행동:

- Generic UGC gate와 이미지 유형별 rights gate를 각각 확인한다.
- 시스템 디자인, 사용자 원본, 명확한 라이선스 이미지부터 검토한다.
- 애니 장면 캡처와 타인 팬아트는 별도 게이트 없이는 활성화하지 않는다.

### Phase 7 — QA, 베타, 운영

읽기:

- `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- `08_CODEX_PHASE_RUNBOOK.md`

행동:

- 데이터 손실, 비공개 노출, 삭제 전파, 동기화, 신고 처리, kill switch를 E2E로 검증한다.
- 제품 지표와 안정성 지표를 분리해 계측한다.

## 6. Codex가 매 작업 전에 확인할 질문

1. 이 작업은 어떤 확정 결정과 연결되는가?
2. 필요한 참조 문서를 모두 읽었는가?
3. 현재 코드 상태를 파일과 실행 결과로 확인했는가?
4. 데이터 마이그레이션 또는 권리·개인정보 영향이 있는가?
5. 기능 플래그와 롤백 경로가 필요한가?
6. 어떤 테스트가 완료 조건을 증명하는가?
7. 이 작업이 새로운 제품 결정을 암묵적으로 만들고 있지 않은가?

## 7. 최초 사용자 행동

새 저장소에서 아직 감사하지 않았다면 Codex에 다음 파일의 내용을 첫 프롬프트로 전달한다.

```text
prompts/moemoa/01_BOOTSTRAP_REPOSITORY_AUDIT.md
```

이 저장소에서는 최초 감사, 기반 세 결정, prompt 02 architecture proposal과 first slice ExecPlan 승인까지 완료됐다. 다음 행동은 `docs/moemoa/adr/0003-android-image-intake-spike-toolchain.md`의 Node/Android Studio/application ID gate를 해결하고 Milestone 1 native spike를 시작하는 것이다.
