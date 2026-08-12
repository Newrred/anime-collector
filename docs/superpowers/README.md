# Legacy superpowers 문서 상태표

> **문서 상태: `LEGACY_INDEX` — 2026-08-11**
> 이 폴더는 현재 실행 중인 legacy Web/PWA의 구현 이력과 과거 출시안을 보존한다. 신규 MOEMOA 제품 결정·구현 순서는 [`docs/moemoa/README.md`](../moemoa/README.md)와 [`01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`](../moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md)를 따른다.

## 분류

| 문서 | 상태 | 사용 범위 |
| --- | --- | --- |
| `plans/2026-08-03-product-readiness.md` | `COMPLETED_LEGACY_PLAN` | 현재 Library/WatchLog 기반 onboarding 구현 이력. 새 Card P0 계획으로 재실행 금지 |
| `plans/2026-08-03-round-2-data-safety.md` | `COMPLETED_LEGACY_PLAN` | legacy 저장·동기화 데이터 안전 계약과 회귀 참고 |
| `plans/2026-08-03-round-3-durable-sync.md` | `COMPLETED_LEGACY_PLAN` | legacy snapshot sync 내구성 구현 이력 |
| `plans/2026-08-03-media-rights-and-provider-safety.md` | `SUPERSEDED` | AniList 차단 가능성의 문제의식만 참고. 새 catalog/image/domain 명세가 대체 |
| `specs/2026-08-03-sea-launch-and-monetization-design.md` | `SUPERSEDED` | tracker/log/tier 기반 60만원·4주 출시 가정. 현재 승인 예산·국가·KPI 아님 |
| `plans/2026-08-03-sea-beta-launch.md` | `SUPERSEDED` | 위 과거 출시안을 구현하는 계획. `GROWTH-01~03` 승인 전 집행 금지 |

## 사용 규칙

- 완료된 legacy 계획은 당시 구현 의도와 회귀 원인을 찾을 때만 사용한다.
- `COMPLETED_LEGACY_PLAN`은 미완료 task list가 보여도 다시 실행하지 않는다.
- 현재 제품 모델에서 `Library = Archive`, `WatchLog = Complete MemoryCard`, `Tier = Board`로 자동 대응시키지 않는다.
- AniList ID를 신규 canonical 관계 키로 승격하지 않는다. 신규 catalog는 내부 Anime ID와 provenance 규칙을 따른다.
- 과거 600,000원 광고 한도, 필리핀/싱가포르 순서, 작품 3개+로그 1개 activation은 현재 결정이 아니다. `docs/moemoa/reports/open-decision-questions.md`의 `BETA-01`, `GROWTH-01~03`을 사용한다.

파일은 역사 보존을 위해 이동·삭제하지 않는다. 직접 열었을 때도 오인하지 않도록 각 문서 상단 상태 배너를 함께 유지한다.
