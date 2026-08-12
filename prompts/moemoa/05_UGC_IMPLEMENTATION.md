# Phase 5~7 프롬프트 — 이미지 클라우드와 UGC 기반

`docs/moemoa/05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`, `07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`, UGC gate checklist를 읽고 승인된 ExecPlan을 사용하라.

먼저 PRIVATE_CLOUD를 구현하고, 로그인만으로 자동 업로드하지 않는 것을 테스트하라.

그 다음 Public 기능을 feature flag 뒤에서 구현한다.

- policy acceptance
- rights/source metadata
- quarantine
- file validation/re-encode/EXIF removal
- derivatives and hashes
- publish request
- content/user report
- user block
- moderation queue/action
- uploader notification
- appeal/restore
- strike/suspension
- deletion propagation
- audit log
- global and image-type kill switches

Generic UGC gate가 통과되어도 ANIME_SCREENSHOT과 THIRD_PARTY_FANART는 별도 rights gate가 없으면 Public allowlist에 넣지 마라.

Public 기능은 기본 off로 유지하고, E2E evidence와 운영 준비 보고서를 작성하라.
