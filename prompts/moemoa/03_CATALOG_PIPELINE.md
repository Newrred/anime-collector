# Phase 3 프롬프트 — 카탈로그 표본 파이프라인

`docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`, 승인된 Source Registry와 ExecPlan을 읽어라.

전체 작품을 수집하지 말고 대표 표본만 대상으로 다음을 구현하라.

- Source Registry enforcement
- immutable raw staging
- parser/normalizer version
- internal Anime/Organization/Character/Person IDs
- FieldClaim and revision
- format/status/relation/source-material mapping
- duplicate candidate and conflict queue
- tag candidate mapping
- idempotent re-run
- import preview and rollback
- `legacy_unverified` isolation

각 source는 승인된 method와 field만 사용한다. source status가 pending/blocked이면 실행하지 말고 보고하라.

테스트에는 재실행 중복, partial failure, conflict, provider unavailable, ambiguous merge, rollback을 포함하라.

전체 수집은 별도 승인 게이트로 남겨라.
