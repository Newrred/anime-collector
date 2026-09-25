# CODEX START HERE — MOEMOA

> **2026-09-26 간이 Web 배포:** 사용자가 폰·지인 테스트용 Git 배포를 승인했다. 기존 계정·기록 및 브라우저 로컬 이미지 선택만 제공하고 private 이미지 연동/Public은 닫는다. 정식 출시 완료 아님. 최신 배포 SHA/검증은 [단일 진행판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)과 해당 배포 증거를 따른다. 아래 미배포 표기는 당시 이력이다.

> **2026-09-26 현재 범위:** 사용자 승인 `FREE-PRIVATE-IMAGE-SYNC-01`에 따라 첫 Web-only 출시에 무료 비공개 최적화 이미지 연동을 포함한다. 기존 W06/W08/W15에서 이어간다. Web 파일 선택·원본 로컬 저장 경로는 default-off 개발 flag로 연결했으며 원격 이미지 연동은 아직 미완료다. MOEMOA 추가 운영비 월50,000원 목표, 50MB/1MB는 승인 전 후보. 아래 원본 백업 제외 이력과 새 최적화 사본 연동을 구분하고 [단일 진행판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)의 현재 카드를 따른다.

> **2026-09-25 Pro 중간 검토:** 최신 개발본은 검토 브랜치 `review/pro-interim-2026-09-25`로 인계한다. [중간 검토 안내](docs/moemoa/reports/2026-09-25-pro-interim-review.md)에서 읽기 순서·증거·출시 잔여를 확인한다. 아래 날짜별 미커밋/환경 미제공 표기는 당시 이력이다. 최신 테스트 계정·서버 키 준비 및72테이블 복원 검증은 완료했으며, 실제 공개 흐름 마감과 운영 결정·후보 승인은 남아 있다. 운영 배포 완료 보고가 아니다.

> 2026-09-24 새 PC 이전: 사용자 승인으로 개발본을 master에 반영한다. [Windows/Codex 설치 안내](docs/moemoa/operations/2026-09-24-desktop-setup.md). 아래 과거 미커밋 표기는 당시 기록이며 최신 결과는 진행판의 9/24 기록 참조.

> **활성 출시 계획 (2026-09-24):** V2의 계정·공개 보드·공개 미니홈·팔로우·최소 운영 목표를 사용자 승인으로 채택했다. **W16~W20의 가능한 로컬 구현/검증/후보 점검까지 연속 실행했다. unit320·catalog256·Chromium174·SQL235·native31, 웹/테스트 APK 빌드 통과(선택 검사 skip 별도 기록). 실제 계정·기기·정책·예산·복구 사본·정확한 후보 승인 D01~D06이 남아 정식 출시/모든 W 완료는 아니다.** 운영 SHA는0330a54지만 build-info의 workingTreeDirty=true 원인도 확인이 필요하다. 미커밋·운영 적용 없음. [단일 진행판](docs/moemoa/release-v2/03_RELEASE_WORKBOARD.md)과 [ExecPlan](docs/moemoa/release-v2/01_RELEASE_EXECUTION_PLAN.md)을 따른다. 아래 Private-only 마감과 이전 상태는 과거 근거로 보존한다.

> **현재 기능 마무리 (2026-09-22):** 추가 기능 개발을 중단하고 모달·카드 이미지 클릭·미저장 이동/취소·보드 작업·오류 복귀를 보완했다. 옛 공개 프로필 경로를 닫고 운영 ID 연속성/일일 health/CI/Git build 추적을 추가했다. 단위 238, 카탈로그 251, 최종 브라우저 18, build 통과. **미커밋·미배포, 예약 자동화 미가동.** 계정별 서버 한도·계정 삭제·Public 관리·실제 OAuth/Android는 출시 전 미완료 게이트다. [감사/수정 결과](docs/moemoa/reports/2026-09-22-service-finishing.md), [운영 절차](docs/moemoa/operations/2026-09-22-minimum-operations.md).

> **최신 로컬 개선 (2026-09-22):** Pro 리뷰 및 홈 재발견 보완에 따라 표지 카드 수정 검증·미평가·개인 작품 후속 기록·자체 카탈로그 시청 편집·범위를 구분한 백업/복원·홈 재발견·보드 이미지·Archive 검색을 구현했다. 단위 236개, build 통과. 브라우저 통합의 한 회귀는 수정 후 해당 suite 통과. 아직 commit/push/운영 배포하지 않았다. 리뷰 전체/출시 게이트 완료는 아님. [상세 결과와 남은 범위](docs/moemoa/reports/2026-09-22-pro-review-improvements.md).

> **배포 원칙 (2026-09-09 사용자 확정):** 앞으로 운영 웹은 검토한 변경을 Git에 commit/push하고 Vercel의 Git 연동 배포와 운영 commit SHA를 확인한다. 별도 명시 승인 없이 로컬 CLI로 운영 배포하지 않는다. [확정 결정](docs/moemoa/decisions/2026-09-09-git-based-production-deployment.md).

> **Pro 제품 상세 검토 자료 (2026-09-09):** 운영 화면 91장, 화면 요소 목록, 20개 검토 흐름, 주요 7개 흐름 및 갤러리 보조 실행 결과, 최신 미커밋 소스를 검토 ZIP으로 준비했다. GitHub가 최신 소스와 동일하다는 의미는 아니다. 로그인·실기기 등 미검증 범위를 분리했다. [작업 기록](docs/moemoa/plans/2026-09-09-pro-review-package.md). 산출물: 상위 workspace `deliverables/MOEMOA-Pro-Review-2026-09-09.zip`.

> **최신 카탈로그 (2026-09-08 누락 배치 복원):** 225개 후보 검토 후 131개 운영 추가, 기존 4,161개 보존 → **4,292개**, active `catalog-add-7e982253b551b92984460a5e`. 방영 전 87개·이미 수록 1개·판단 보류 6개 제외. 신규 131개 전체 표지/익명 검색/상세 검증 완료. [수록 결과와 보류 목록](docs/moemoa/reports/2026-09-08-missing-catalog-batch.md). 다음 전체 재생성에는 `.moemoa-missing-batch-2026-09-08` 보충 target/canonical도 반드시 포함한다.

> **이전 카탈로그 (2026-09-08 니세코이 복원):** 당시 운영 4,160개를 보존하고 니세코이 2기를 독립 추가해 **4,161개**, active `catalog-add-cfd7de57fd596c974547fb15`. 1·2기 분리 검색과 실제 상세 확인. 당시 발견한 우선 후보 24개와 TV 시즌 후보 201개는 위 배치 보고서에서 후속 검토했다. [복원·감사 기록](docs/moemoa/reports/2026-09-08-nisekoi-restoration.md). 다음 전체 재생성은 보고서의 보충 canonical 경로를 포함해야 한다.

> **최신 Web 배포 (2026-09-08 UI 정리):** 중복 필터·반복 안내 축소, 고급 필터/보드 도구 접기를 운영 반영했다. Deployment `dpl_9XFykvvfB6weyT64JByvKg11BJ3r`; 후보 및 운영 각각 16개 기능 검사, 운영 파일 78개 대조 통과. DB 변경 없음. [배포 기록](docs/moemoa/reports/2026-09-08-ui-simplification.md).

> **최신 Web 배포 (2026-09-08):** 기존 표지 갤러리 UI를 `/titles/`에 복원해 운영 반영했다. 장르 검색·태그, 열 크기 저장, Poster/Memory 전환, 모바일 배치를 검증했다. Deployment `dpl_7CswVCMgTNWLU8vzh7A3ULPCeGxm`; 운영 smoke 14개 및 배포 파일 78개 대조 통과. DB 변경 없음. [검증·배포 결과](docs/moemoa/reports/2026-09-08-gallery-production.md).

> **최신 Web 배포 (2026-09-07):** 자체 ID 작품 지원과 AniList 외부 이동 제거를 검토·수정 후 운영 반영했다. Deployment `dpl_9cQZqinSPXfT8uRbfdamz59qtyQY`. 운영 DB는 기존 3,999개 유지, 226개 추가와 provider SQL 적용은 미실행. [검토·배포 결과](docs/moemoa/reports/2026-09-07-source-independent-production.md).

> **현재 저장소 상태 — 2026-09-07**
> Android local image intake, Private Card/Archive/Board, Supabase catalog와 user metadata sync 기반, Web-first Memory UI가 구현돼 있다. 2026-09-03 사용자는 기존 Library와 Memory write model을 유지하면서 `작품 / Titles`, `Title Hub`, My Titles의 Poster/Memory View로 읽기 경험을 통합하고, 명시적으로 선택한 승인된 대표 표지를 개인 기억 신호가 있는 `CATALOG_COVER` Memory visual로 사용하는 방향을 확정했다. stable cover identity/immutable revision, 개인 기억 신호, bytes 비복제, 공용 표지 비삭제 계약과 additive user schema/RPC migration이 local 및 hosted Supabase에 반영됐다. 카드 작성 화면의 공식 표지 선택, Archive·Memory Detail, Title projection·Title Hub와 신규 `/titles/` Poster/Memory dual view까지 구현됐다. Phase 5 메뉴·검색·한영 문구·기존 주소 호환까지 구현됐다. Phase 6 Home·화면 간 연결·첫 기억 작성 후 Memory View 제안도 로컬 Web 검증을 마쳤다. 2026-09-07 사용자의 배포 승인으로 https://www.moemoa.xyz 운영 Web에 반영하고 실제 저장·검색·320px 화면을 검증했다. 배포·복구와 후속 catalog 환경값은 `docs/moemoa/reports/2026-09-07-title-hub-web-release.md`를 참조한다. 2026-09-07 사용자가 Web 기능을 직접 확인해 큰 문제는 없다고 보고했고, UI 개선은 미완료로 남긴 채 Phase 7 Android 테스트 APK를 생성했다. JS 222·native 31·native URL 모의 검사 6개를 통과했으며 실기기 확인은 대기한다. 결과는 `docs/moemoa/reports/2026-09-07-title-hub-android-phase7.md`를 참조한다. Public·사용자 이미지 cloud는 계속 비활성화한다.

> **최신 카탈로그 상태:** 카탈로그 제목 교정 운영 반영 완료(2026-09-07): 운영 3,998개를 유지한 새 DB 릴리스에 35개 제목·별칭(대표 제목 변경 16개)을 반영하고 웹을 배포했다. 실제 5등분 1기 검색→상세 및 기호 생략 검색 검증 완료. 5등분 2기와 운영 미수록 프리렌 미니 애니는 추가하지 않았다. [운영 반영/복구 보고서](docs/moemoa/reports/2026-09-07-catalog-correction-production.md)를 최신 상태로 따른다.

> **후속 복원 완료:** 5등분 2기 AniList 109261을 독립 ID로 운영 DB에 추가했다. 현재 3,999개, active `catalog-add-81297cd638290f972ca84c28`. 실제 1기·2기 분리 검색 확인. 신규 canonical은 별도 보충 workspace에 있으므로 다음 전체 재생성에 반드시 포함한다. [복원 보고서](docs/moemoa/reports/2026-09-07-quintuplets-season2-restoration.md).

## 1. 목적

카탈로그 품질 후속 작업(2026-09-07): 4,224개 감사 후 제목 연결 32개를 검토해 16개 표시 제목을 로컬 교정했다. 원본·운영 데이터는 유지하고 앱 alias 소비 경로와 재발 방지 검사를 수정했다. 누락 후보 32개, 한국어 명칭 7개 및 나머지 전수 검토는 미완료이며 AniList 추가 요청이 403으로 중단됐다. 다음 작업은 [교정 보고서](docs/moemoa/reports/2026-09-07-catalog-identity-corrections.md)와 [ExecPlan](docs/moemoa/plans/2026-09-07-catalog-identity-quality.md)을 따른다. 아직 배포하지 않았다.

이 파일은 Codex가 기존 ChatGPT 세션 없이도 MOEMOA의 제품 맥락, 확정 결정, 금지사항, 참조 문서, 작업 순서를 재구성하게 하는 진입점이다.

Codex는 세션 대화를 추측하거나 이전 요약을 현재 코드 상태로 간주하지 않는다. 모든 구현 상태는 실제 저장소에서 확인한다.

## 2. 제품 기준점

> MOEMOA는 사용자가 애니를 보며 남기고 싶은 장면을 이미지 중심 Memory Card로 만들고, 이를 Archive와 Board에 수집·재구성하며, 준비된 범위 안에서 공유하는 서비스다.

핵심 구조:

```text
작품 검색 또는 개인 작품 생성
→ 사용자 이미지, 승인된 공식 표지 또는 서비스 디자인 선택
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
| 4 | 승인된 Decision Log/ADR/ExecPlan/설계 명세 | 해당 범위의 결정·기술 경계·실행 계획. `01`을 변경할 수 없음 |
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
| 제품 흐름·UI | `01`, `02_PRODUCT_SCOPE_AND_USER_FLOWS.md`, `../superpowers/specs/2026-09-03-title-hub-dual-view-ui.md` | `06`, `plans/2026-09-03-title-hub-dual-view.md` |
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

현재 상태: **Title Hub·대표 표지 Memory·My Titles dual view와 Phase 5 메뉴·검색·문구·주소 호환까지 완료됐다. Phase 6 Home·화면 간 연결·첫 Memory 안내까지 로컬 Web 검증을 마쳤으며, 다음은 사람 사용성 확인 후 Phase 7 Android 적용이다.** 검증 결과와 남은 gate는 [Phase 6 보고서](docs/moemoa/reports/2026-09-07-title-cross-surface-phase6.md)를 따른다.

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
- `decisions/2026-08-16-web-first-shared-ui-readiness.md`
- `../superpowers/specs/2026-08-16-web-first-shared-ui-readiness-design.md`

행동:

- 현재 스택을 최대한 활용하는 옵션을 우선 제시한다.
- Web+Android를 완전히 별개로 재구축하지 않는다.
- 확정된 Astro/React + Capacitor, app-private filesystem + DB metadata, 보수적 legacy 이전을 입력 조건으로 사용한다.
- 첫 Vertical Slice와 단계별 마이그레이션 ExecPlan을 작성한다.
- 최소 catalog adapter와 본격 catalog ingestion을 분리하고 Phase 3 이후 실제 실행 순서를 제안한다.
- 승인되지 않은 범위의 대규모 구현을 시작하지 않는다.

> **Phase 3 이후 순서 주의:** 아래 번호는 audit 이전 runbook의 작업 묶음이지 승인된 실행 순서가 아니다. 현재 실행 순서는 `catalog cover identity/revision → CATALOG_COVER vertical slice → Title projection/Title Hub → My Titles dual view → Web gate → Android 적용`이다. Remote migration, local data 삭제, Public은 각각 별도 승인 대상이다.

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

이 저장소에서는 local-only Card/Archive/Board, Android media boundary, catalog, account metadata sync, Web-first UI 기반까지 구현됐다. 최신 제품 방향은 `docs/moemoa/decisions/2026-09-03-title-hub-dual-view-and-catalog-cover.md`, UI는 `docs/superpowers/specs/2026-09-03-title-hub-dual-view-ui.md`, 실행 gate는 `docs/moemoa/plans/2026-09-03-title-hub-dual-view.md`, 현재 코드 차이는 `docs/moemoa/reports/2026-09-03-title-hub-code-conflict-audit.md`를 따른다.

카탈로그 후속 검토 수정: 게시 시 현재 제목 규칙 재대조, 모든 검색 별칭의 시즌 검사, 일반 기호 생략 검색을 반영했다. 4,224개 재검사에서 추가 4개를 검토 대상으로 보류했다. [후속 개선 보고서](docs/moemoa/reports/2026-09-07-catalog-identity-review-fixes.md)를 먼저 확인한다. 로컬 수정이며 미배포다.

추가 4개 검토 완료: 정상 번호 별칭 3건 유지, 퀸즈 블레이드의 모호한 별칭 1개 격리. 전체 검토 기록 36개/앱 AniList 별칭 35개. 4,224개 재검사에서 현재 제목 감지 미해결 0, 관련 ID 미보유 후보 40, 한국어 대기 7이다. 운영/원본 미변경. 상세: [4개 검토 보고서](docs/moemoa/reports/2026-09-07-catalog-four-title-reviews.md).
