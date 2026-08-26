# Superpowers 설계·계획 문서 상태표

> **문서 상태: `MIXED CURRENT + LEGACY INDEX` — 2026-08-17**
> 이 폴더에는 현행 설계서와 legacy Web/PWA 구현 이력이 함께 있다. 신규 MOEMOA 제품 결정·실행 순서는 [`docs/moemoa/README.md`](../moemoa/README.md)와 [`01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`](../moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md)를 따르며, 아래 표에서 현행으로 명시한 문서만 현재 구현 기준으로 사용한다.

## 분류

| 문서 | 상태 | 사용 범위 |
| --- | --- | --- |
| `specs/2026-08-26-unified-supabase-user-data-design.md` | `CURRENT_APPROVED_DESIGN_GATED` | 단일 Supabase project의 Auth·Memory Card metadata·Board·sync schema/RLS/RPC 계약. 사용자 이미지 cloud backup/Public은 별도 gate이며 구현은 후속 ExecPlan 승인 전 금지 |
| `specs/2026-08-17-three-source-local-catalog-lab-design.md` | `CURRENT_APPROVED_DESIGN_GATED` | 기존 3,998개 target roster와 AniList·Wikidata·AniLife 공개 페이지를 이용한 로컬 10→100 표본 수집·검증 설계. 전체 수집과 production 발행은 별도 gate |
| `specs/2026-08-16-web-first-shared-ui-readiness-design.md` | `CURRENT_APPROVED_DESIGN` | 첫 Private Slice 안에서 Web 공용 UI를 먼저 검증하고 Android에 적용하는 UI 범위·품질 gate. 구현 계획 작성 전 사용자 검토 기준 |
| `plans/2026-08-03-product-readiness.md` | `COMPLETED_LEGACY_PLAN` | 현재 Library/WatchLog 기반 onboarding 구현 이력. 새 Card P0 계획으로 재실행 금지 |
| `plans/2026-08-03-round-2-data-safety.md` | `COMPLETED_LEGACY_PLAN` | legacy 저장·동기화 데이터 안전 계약과 회귀 참고 |
| `plans/2026-08-03-round-3-durable-sync.md` | `COMPLETED_LEGACY_PLAN` | legacy snapshot sync 내구성 구현 이력 |
| `plans/2026-08-03-media-rights-and-provider-safety.md` | `SUPERSEDED` | AniList 차단 가능성의 문제의식만 참고. 새 catalog/image/domain 명세가 대체 |
| `specs/2026-08-03-sea-launch-and-monetization-design.md` | `SUPERSEDED` | tracker/log/tier 기반 60만원·4주 출시 가정. 현재 승인 예산·국가·KPI 아님 |
| `plans/2026-08-03-sea-beta-launch.md` | `SUPERSEDED` | 위 과거 출시안을 구현하는 계획. `GROWTH-01~03` 승인 전 집행 금지 |

## 사용 규칙

- `CURRENT_APPROVED_DESIGN`과 `CURRENT_APPROVED_DESIGN_GATED`는 대응 Decision/ExecPlan과 함께 현재 범위의 설계 기준으로 사용한다. `GATED` 문서는 명시된 선행 gate를 우회하지 않는다.
- 완료된 legacy 계획은 당시 구현 의도와 회귀 원인을 찾을 때만 사용한다.
- `COMPLETED_LEGACY_PLAN`은 미완료 task list가 보여도 다시 실행하지 않는다.
- 현재 제품 모델에서 `Library = Archive`, `WatchLog = Complete MemoryCard`, `Tier = Board`로 자동 대응시키지 않는다.
- AniList ID를 신규 canonical 관계 키로 승격하지 않는다. 신규 catalog는 내부 Anime ID와 provenance 규칙을 따른다.
- 과거 600,000원 광고 한도, 필리핀/싱가포르 순서, 작품 3개+로그 1개 activation은 현재 결정이 아니다. `docs/moemoa/reports/open-decision-questions.md`의 `BETA-01`, `GROWTH-01~03`을 사용한다.

파일은 역사 보존을 위해 이동·삭제하지 않는다. 직접 열었을 때도 오인하지 않도록 각 문서 상단 상태 배너를 함께 유지한다.
