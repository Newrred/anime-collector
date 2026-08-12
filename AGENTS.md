# MOEMOA project instructions

Codex must read this file before working in this repository. Detailed product and implementation context lives under `docs/moemoa/`.

## Mandatory reading order

Before any task:

1. Read `CODEX_START_HERE.md`.
2. Read `docs/moemoa/01_CONFIRMED_DECISIONS_AND_OPEN_GATES.md`.
3. Read the task-specific documents listed in the task-to-document matrix.
4. For multi-file, architectural, migration, ingestion, security, or release work, create or update an ExecPlan that follows `PLANS.md` before editing code.

## Non-negotiable product rules

- MOEMOA is an image-first anime memory archive, not a general anime tracker clone.
- Target platforms are Web + Android with one backend and one domain model.
- Android is the primary image intake, Share Target, and quick card creation client.
- Web is the primary Archive, Board, public page, account, and administration surface.
- A complete Memory Card requires an anime/title entity plus a visual element.
- A user image is strongly encouraged, but a service-generated design card must remain available.
- Title-only records are Drafts, not complete Memory Cards.
- Archive is automatic. Board is optional, supports N:M card membership, and is suggested after three cards.
- Local-first use is allowed without login. Login is required for cloud backup, Web sync, multi-device use, and public publishing.
- Public UGC must remain behind feature flags until all applicable launch gates pass.
- Anime screenshots and third-party fanart require separate rights gates even after generic moderation tooling exists.
- External source data must retain provenance. Do not turn unverified imported values into verified catalog data by renaming tables or changing schemas.
- Existing `legacy_unverified` data must not be deleted or promoted without an approved migration and verification plan.

## Work protocol

- Inspect before changing. Never assume the framework, storage model, authentication provider, build commands, or current implementation status.
- Cite repository evidence with file paths and line ranges in audit and design reports.
- Do not install or upgrade production dependencies without explaining the need, alternatives, risks, and rollback.
- Do not perform destructive migrations, delete legacy data, or rewrite large subsystems without an approved ExecPlan and backup/rollback path.
- Do not deploy to production, enable public UGC, run broad scraping, or upload local user images automatically unless the user explicitly approves that action.
- Prefer one end-to-end vertical slice over many disconnected partial modules.
- Preserve stable existing behavior unless the task explicitly replaces it and tests cover the replacement.
- Keep user-authored notes, image bytes, private Board names, and free-text searches out of analytics and ordinary logs.
- Use feature flags for public image types, public publishing, provider changes, and risky migrations.
- Any change to an established product decision requires an entry in the Decision Log and explicit user approval.

## Required task response format

For every implementation task, report:

1. Documents and repository files read.
2. Assumptions and unresolved questions.
3. Plan or ExecPlan reference.
4. Files changed and why.
5. Database/data migrations and rollback.
6. Tests and commands run, including results.
7. Security, privacy, rights, and observability impact.
8. Remaining risks and the next approval gate.

## Stop conditions

Stop and ask for a decision before proceeding when:

- A requested change conflicts with a confirmed decision.
- A required source license/terms status is unknown for automated ingestion.
- A migration can cause irreversible loss or ambiguous identity merges.
- Public UGC would be enabled without report, block, moderation, takedown, appeal, audit log, and kill-switch coverage.
- Anime screenshots or third-party fanart would become public without their separate rights gate.
- Private images may become public or be uploaded without explicit user action.
- Required tests cannot run or the expected environment is unavailable.
- Secrets, credentials, or production data would be exposed.

## Task-specific references

- Product and user flow: `docs/moemoa/02_PRODUCT_SCOPE_AND_USER_FLOWS.md`
- Repository audit: `docs/moemoa/03_REPOSITORY_AUDIT_PROTOCOL.md`
- Catalog and ingestion: `docs/moemoa/04_CATALOG_DATA_AND_INGESTION_SPEC.md`
- Image/UGC: `docs/moemoa/05_IMAGE_UGC_POLICY_MODERATION_SPEC.md`
- Architecture and vertical slice: `docs/moemoa/06_ARCHITECTURE_AND_VERTICAL_SLICE_PLAN.md`
- QA, analytics, launch, operations: `docs/moemoa/07_QA_ANALYTICS_LAUNCH_OPERATIONS.md`
- Phase sequence: `docs/moemoa/08_CODEX_PHASE_RUNBOOK.md`
- Change control and reporting: `docs/moemoa/09_CHANGE_CONTROL_AND_REPORTING.md`
