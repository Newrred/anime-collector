# MOEMOA 문서 기준점 통합 ExecPlan

상태: `COMPLETE`  
작성일: 2026-08-11  
작업 성격: 문서 거버넌스 정리. 제품 코드·설정·DB·데이터는 변경하지 않는다.

## 1. 목적과 사용자 결과

신규 `docs/moemoa/` 패키지와 저장소 감사 보고서를 현행 기준으로 삼아, 과거 방향 문서가 현재 제품 결정이나 구현 계획으로 오인되지 않게 한다. 문서를 삭제하거나 대규모로 재작성하지 않고 각 문서의 역할, 우선순위, 현재성, 다음 읽기 경로를 한 곳에서 확인할 수 있게 만든다.

## 2. 관련 확정 결정

- 모든 제품 결정은 `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`가 우선한다.
- 실제 구현 상태는 repository code/tests/config와 감사 증거가 기준이다.
- 기존 `legacy_unverified` 데이터와 역사 문서를 승인 없이 삭제·승격하지 않는다.
- 기술 선택과 미정 gate는 감사 보고서의 제안을 확정 결정처럼 취급하지 않는다.

## 3. 현재 상태와 저장소 증거

- `CODEX_START_HERE.md:26-36`은 신규 00~09 문서와 references의 source hierarchy를 정의하지만 완료된 감사 보고서를 별도 계층으로 표시하지 않는다.
- `README.md:1-73`은 현재 실행 중인 legacy tracker/PWA를 설명하며 새 MOEMOA 제품 목표와 역할이 다르다.
- `docs/product/MOEMOA_PRODUCT_BASELINE.md:3-8`, `:42-47`은 자신을 실행 기준이자 최우선 문서로 선언해 최신 hierarchy와 충돌한다.
- `docs/product/2026-08-06-product-direction-decision-draft.md`와 `docs/moemoa/references/2026-08-06-product-direction-decision-draft.md`는 현재 동일 hash의 중복 역사 자료다.
- `docs/superpowers/` 계획은 2026-08-03 legacy tracker 안정화/SEA 출시 방향의 이력이며 현재 vertical slice 승인 계획이 아니다.
- `MOEMOA_CODEX_HANDOFF_SINGLE_FILE.md`와 `word/*.docx`는 audit 이전 패키지 snapshot/distribution artifact다.

## 4. 범위

### 포함

- `docs/moemoa/README.md`를 canonical 문서 인덱스로 추가
- source hierarchy에 감사 보고서와 문서 상태를 반영
- root README를 “현재 legacy 구현 설명”으로 명확히 표시
- 과거 product baseline/draft에 superseded/reference 상태 표시
- legacy superpowers 계획을 이력으로 분류
- bootstrap/single-file/Word 배포본의 역할과 최신성 표시
- package manifest와 handoff context의 감사 완료 상태 갱신

### 제외

- 제품 결정 자체 변경
- TECH-01 등 열린 gate 선택
- 코드·schema·dependency·배포 변경
- 과거 문서 삭제·이동·내용 전체 재작성
- Word `.docx` 내부 편집
- 구현용 Phase 2 ExecPlan 작성

## 5. 아키텍처·데이터 흐름

문서 읽기 흐름을 다음으로 고정한다.

```text
docs/moemoa/README.md
→ 01 confirmed decisions
→ repository code/tests/config + reports/repository-audit.md
→ task-specific 02~09
→ reports의 gap/options/open decisions
→ historical references / legacy plans / distribution snapshots
```

## 6. 변경 파일 지도

- 신규 `docs/moemoa/README.md`: 문서 상태표, source hierarchy, 현재 phase, legacy mapping
- 신규 이 ExecPlan: 변경 범위·검증·완료 이력
- `CODEX_START_HERE.md`: 인덱스 진입점과 audit-complete 상태 반영
- `README.md`: current runtime/legacy implementation banner와 새 제품 문서 링크
- `docs/product/MOEMOA_PRODUCT_BASELINE.md`: superseded banner와 잘못된 우선순위 수정
- `docs/product/2026-08-06-product-direction-decision-draft.md`: historical duplicate banner
- `docs/superpowers/README.md`: legacy plan status index
- `docs/moemoa/00_SESSION_HANDOFF_AND_CONTEXT.md`: 2026-08-11 감사 완료 상태 추가
- `PACKAGE_MANIFEST.md`: 인덱스·reports·plans 포함
- `INSTALL_README_FIRST.md`: 설치·감사 완료 후 읽기 경로 추가
- `MOEMOA_CODEX_HANDOFF_SINGLE_FILE.md`: frozen pre-audit snapshot banner

## 7. 데이터·스키마 마이그레이션

없음. 파일 이동·삭제도 하지 않는다. 역사 문서는 상태 banner와 중앙 index만 추가한다.

## 8. 마일스톤

### Milestone 1 — 문서 inventory와 충돌 분류

- 신규 00~09/reports와 기존 README/product/superpowers/handoff 문서를 비교한다.
- `CURRENT / CURRENT_RUNTIME / PROPOSAL / GATED / REFERENCE / SUPERSEDED / SNAPSHOT` 상태를 부여한다.

### Milestone 2 — canonical index와 상태 banner

- `docs/moemoa/README.md`를 추가한다.
- 주요 충돌 문서 상단에 현재 source-of-truth 링크를 추가한다.
- root 진입 문서의 링크를 갱신한다.

### Milestone 3 — 상호참조 검증

- 모든 새 Markdown 링크의 대상 존재 여부를 확인한다.
- confirmed/proposed/historical 표현이 섞이지 않는지 검색한다.
- Git 변경 범위가 문서로만 제한되는지 확인한다.

## 9. 테스트와 검증

```text
rg --files -g "*.md"
rg -n "MOEMOA_PRODUCT_BASELINE|repository-audit|SUPERSEDED|CURRENT_RUNTIME"
PowerShell Test-Path 기반 Markdown local link 대상 검사
git status --short --untracked-files=all
```

문서 변경이므로 제품 build/E2E를 다시 실행하지 않는다. 코드가 바뀌지 않았음을 Git 상태로 검증한다.

## 10. 보안·개인정보·권리 영향

운영 credential, 사용자 데이터, 이미지 byte를 읽거나 변경하지 않는다. Public/권리 gate 상태를 낮추지 않는다. 오히려 legacy public 계획이 현재 활성 계획으로 오인되는 위험을 줄인다.

## 11. 관찰 가능성·분석 이벤트

없음. 이벤트 schema와 코드 변경 없음.

## 12. 롤백·복구

모든 변경은 Markdown 추가/수정뿐이다. 새 index와 banner를 되돌리면 원상복구된다. 기존 문서 본문과 파일 경로는 보존한다.

## 13. 위험과 완화

- 위험: 역사 자료가 과도하게 숨겨짐. 완화: 삭제하지 않고 reference 경로와 원본 위치를 index에 유지.
- 위험: 감사 제안이 확정 결정으로 오인됨. 완화: report 상태를 `EVIDENCE / GAP / PROPOSAL`로 분리.
- 위험: duplicate 파일 drift. 완화: canonical reference 경로를 하나만 명시하고 duplicate는 편집 금지 대상으로 표시.
- 위험: root README가 새 제품 설명으로 오인됨. 완화: `CURRENT_RUNTIME` banner로 역할을 한정.

## 14. 필요한 사용자 결정

이번 정리에는 새 제품 결정이 필요하지 않다. TECH-01 등은 `reports/open-decision-questions.md`에 열린 상태로 유지한다.

## 15. 진행 기록

```text
[2026-08-11] 시작: 신규 MOEMOA package/reports를 기준으로 전체 문서 inventory 확인.
[2026-08-11] 발견: 이전 MOEMOA_PRODUCT_BASELINE이 자신을 최우선 기준으로 선언해 현재 01 문서와 충돌.
[2026-08-11] 발견: 2026-08-06 draft가 product와 moemoa/references에 동일 hash로 중복.
[2026-08-11] 완료: docs/moemoa/README.md를 canonical index로 추가하고 source hierarchy와 문서 상태표 확정.
[2026-08-11] 완료: VisualAsset, Guest Owner, backend boundary, Public UI, beta target, first slice 산출물 경로를 신규 명세 안에서 정합화.
[2026-08-11] 완료: product/superpowers/UI/handoff/distribution 문서를 CURRENT_RUNTIME, COMPLETED_LEGACY_PLAN, SUPERSEDED, FROZEN_SNAPSHOT으로 비파괴 분류.
[2026-08-11] 완료: prompt/template 상태 README와 전체 package inventory 추가.
[2026-08-11] 검증: 51개 Markdown의 local link 대상 존재, manifest core path 존재, git diff whitespace 오류 없음, master/origin-master e71f211 일치.
```

## 16. 발견 사항과 계획 변경

- audit 이전 `CODEX_START_HERE`/`08`의 catalog-first 번호와 Gap 분석의 local-first 권장 순서는 아직 사용자 승인이 없다. 한쪽을 canonical 실행 순서로 올리지 않고 Phase 2 ADR/ExecPlan에서 해결하도록 `GATED / NEEDS_RECONCILIATION`으로 표시했다.
- `ImageAsset`은 신규 현행 명세에서 `VisualAsset`으로 통일하고 `intakeSource`, `imageType`, `storageScope`, `visibility`, `rightsBasis`, lifecycle `state`를 분리했다. frozen/legacy/reference 내부의 과거 용어는 상태 banner와 함께 보존했다.
- local slice는 AUTH-01 없이 가능하지만 데이터 혼입 방지를 위한 Guest Owner ID와 owner-scoped namespace는 `ACCOUNT-01`의 필수 불변조건임을 분리했다. AUTH-01은 account linking/promotion과 전환을 차단한다.
- LOCAL_ONLY, PRIVATE_CLOUD opt-in, Public 게시 요청의 동의·권리 확인 흐름이 섞여 있던 부분을 분리했다.
- Vercel과 GitHub Pages의 canonical production은 repository evidence만으로 확정되지 않았다. README의 이전 권장 서술을 제거하고 `DEPLOY-01` 뒤로 모든 배포 변경을 보냈다.
- 단일 합본과 Word 문서는 audit 이전 생성물이며 재생성 script가 없다. 삭제·이동·내부 편집 없이 frozen snapshot으로 격리했다.
- 범위에 `prompts/moemoa/README.md`, `templates/moemoa/README.md`, reference status banner와 깨진 relative link 수정이 추가됐다. 이는 문서 오인과 실행 순서 drift를 막기 위한 비파괴 보완이다.

## 17. 완료 보고

### 사용자 결과

- `docs/moemoa/README.md` 한 곳에서 확정 결정, 현재 구현 증거, gated 명세, proposal, reference, legacy, frozen artifact를 구분해 찾을 수 있다.
- 현재 Web/PWA 설명과 미래 MOEMOA 목표를 분리했고 과거 계획을 신규 ExecPlan처럼 재실행하지 않도록 했다.
- 문서 정리 과정에서 제품·기술 선택을 새로 확정하지 않았다.

### 검증

```text
LOCAL_MD_LINKS_OK files=51
MANIFEST_CORE_PATHS_OK count=13
git diff --check: 오류 없음 (Windows LF→CRLF 안내만 존재)
branch: master
HEAD: e71f211
origin/master: e71f211
independent documentation review: must-fix 6건 수정 후 remaining must-fix 0
```

문서 작업이므로 product build/unit/E2E는 재실행하지 않았다. 현재 구현 테스트 사실은 `reports/repository-audit.md`의 evidence snapshot을 그대로 보존했다.

### 남은 gate와 Git 상태

다음 실제 단계는 `TECH-01`, `STORAGE-LOCAL-01`, `LEGACY-01` 검토와 Phase 2 proposal/ExecPlan이다. BACKEND/AUTH/SYNC/Public/성장 결정은 각 명시된 시점까지 보류한다.

이번 정리는 commit/push하지 않았다. 신규 MOEMOA package는 여전히 untracked이며, 기존 unrelated `debug.log`도 그대로 두었다.
