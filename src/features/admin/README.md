# Service administration

`/admin/` is a Web-only operator surface. It uses the existing Google session and the two narrow service-admin RPCs. It does not read or mutate private user content.

- `PUBLIC_SERVICE_ADMIN_V1=1` connects the UI. Public publication flags do not control this surface.
- The shared navigation frame is reused with `accountBoundary={false}` only on the admin route. Its separate server-checked operator boundary does not depend on successful personal archive initialization. Existing memory routes keep their default owner boundary; the navigation keeps its existing account-status behavior.
- The database checks the current authenticated subject against the service-operator role on every request. Client email addresses are never an authorization source.
- `AdminEntry` accepts `{session, locale, base}` and shows the account-page link only after a successful authenticated status response. It is not an authorization boundary.
- Status is decoded into an aggregate-only projection. Unknown errors are replaced by a safe error code; unknown document versions stay plain text, not server-controlled links.
- Each request is bounded to 20 seconds. The view clears on refresh/error/session changes, and request generations discard replies from an old request or account.
- Pause/resume uses an explicit inline confirmation and the exact revision shown to the operator. A stale revision refreshes the view but never replays the write. Initial activation is not available here.
- Queue counts are current snapshots, not evidence of successful scheduled cleanup. The run-history link provides the separate execution evidence. Reserved storage is not physical storage usage.

## Interface scope

Operate mode: a compact heading, current status, signup control, and two-column fact lists collapsing to one column below 760px. The existing neutral theme, pink action/focus accent, small-radius buttons, and navigation remain the design authority. No hero, invented metrics, personal-content browser, or new design system is introduced. Inline confirmation supports keyboard focus, Escape cancellation, and explicit actions. All labels support Korean and English.

## Verification

Run `node --test tests/unit/adminService.test.mjs` and `node scripts/run-admin-e2e.mjs`. Browser tests use the real client and local Supabase SDK with synthetic loopback network responses; they do not prove production role assignment or deployment. The isolated runner does not load production credentials.

The parent release ExecPlan owns migration, deployment, and final evidence. Never claim a successful UI fixture enables a country or satisfies its legal signup conditions.
