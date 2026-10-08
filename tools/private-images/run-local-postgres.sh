#!/usr/bin/env bash
# Disposable local cluster only; no remote URL, credentials or hosted reset.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-private-image-test.XXXXXX)"
cleanup() { "$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true; }
trap cleanup EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55438 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55438 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
for migration in "$root"/supabase/migrations/*.sql; do
  [[ "$(basename "$migration")" != '20260902055512_memory_user_retention.sql' ]] || continue
  if [[ "$(basename "$migration")" == '20260924115258_memory_resource_controls.sql' ]]; then
    "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >/dev/null
  fi
  "${psql[@]}" -f "$migration" >/dev/null
done
"${psql[@]}" -f "$root/tools/private-images/contract.sql"
source <(sed 's/\r$//' "$root/tools/private-images/races.sh")
if [[ "${ELIGIBILITY_MUTATION_TEST:-0}" == 1 ]]; then
  "${psql[@]}" -f "$root/tools/identity/eligibility-candidate.sql" >/dev/null
  "${psql[@]}" -f "$root/tools/identity/eligibility-mutation-candidate.sql" >/dev/null
  "${psql[@]}" -f "$root/tools/identity/eligibility-mutation-contract.sql"
  source "$root/tools/identity/eligibility-mutation-races.sh"
  source "$root/tools/identity/eligibility-mutation-expiry.sh"
  "${psql[@]}" -f "$root/tools/identity/eligibility-image-candidate.sql" >/dev/null
  "${psql[@]}" -f "$root/tools/identity/eligibility-image-contract.sql"
  source "$root/tools/identity/eligibility-image-races.sh"
  "${psql[@]}" -f "$root/tools/identity/eligibility-publication-candidate.sql" >/dev/null
  "${psql[@]}" -f "$root/tools/identity/eligibility-publication-contract.sql"
  source "$root/tools/identity/eligibility-publication-races.sh"
  "${psql[@]}" -f "$root/tools/identity/eligibility-public-asset-contract.sql"
  "${psql[@]}" -c 'create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz)' >/dev/null
  "${psql[@]}" -f "$root/tools/identity/eligibility-viewer-candidate.sql" >/dev/null
  "${psql[@]}" -f "$root/tools/identity/eligibility-viewer-contract.sql"
  "${psql[@]}" -f "$root/tools/identity/eligibility-viewer-image-contract.sql"
  "${psql[@]}" -f "$root/tools/identity/eligibility-publisher-read-contract.sql"
  if [[ -n "${ELIGIBILITY_HTTP_NODE:-}" ]]; then
    "$ELIGIBILITY_HTTP_NODE" "$(wslpath -w "$root/tools/identity/eligibility-viewer-http.mjs")" "$work" "$pg_bin/psql"
    "$ELIGIBILITY_HTTP_NODE" "$(wslpath -w "$root/tools/identity/eligibility-image-http.mjs")" "$work" "$pg_bin/psql"
  fi
fi
if [[ -n "${PRIVATE_RECOVERY_FIXTURES:-}" ]]; then
  source "$root/tools/private-images/recovery-rehearsal.sh"
fi
echo "Private media PostgreSQL contract PASS; local artifacts: $work"
