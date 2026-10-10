#!/usr/bin/env bash
# Disposable local PostgreSQL only. No hosted URLs, env credentials or production writes.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-service-admin.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55457 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55457 -U "$(id -un)" -d postgres -X -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/setup.log" 2>&1
for migration in "$root"/supabase/migrations/*.sql; do
 name="$(basename "$migration")"
 [[ "$name" != '20260902055512_memory_user_retention.sql' ]] || continue
 # Keep this contract tied to its reviewed migration, not later unrelated work.
 [[ "$name" < '20261010180001' ]] || continue
 if [[ "$name" == '20260924115258_memory_resource_controls.sql' ]]; then
  "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >> "$work/setup.log" 2>&1
 fi
 "${psql[@]}" -f "$migration" >> "$work/setup.log" 2>&1 || { cat "$work/setup.log"; exit 1; }
done
"${psql[@]}" -f "$root/tools/operations/service-admin-contract.sql" > "$work/results.log" 2>&1 || { cat "$work/results.log"; exit 1; }
grep 'PASS:' "$work/results.log"
claims="set request.jwt.claim.role='authenticated'; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; set role authenticated;"
revision="$("${psql[@]}" -Atc "$claims select public.get_moemoa_admin_status()->>'revision';")"
[[ "$revision" =~ ^[a-f0-9]{64}$ ]]
audit_before="$("${psql[@]}" -Atc 'select count(*) from private.memory_service_admin_audit;')"
# Both requests carry the same observed state. One must lose at the row lock/token boundary.
set +e
"${psql[@]}" -c "begin; $claims select public.set_moemoa_signup_paused('$revision',true)->'signup'->>'enabled'; select pg_sleep(0.2); commit;" > "$work/race-a.log" 2>&1 & pid_a=$!
"${psql[@]}" -c "begin; $claims select public.set_moemoa_signup_paused('$revision',true)->'signup'->>'enabled'; select pg_sleep(0.2); commit;" > "$work/race-b.log" 2>&1 & pid_b=$!
wait "$pid_a"; status_a=$?
wait "$pid_b"; status_b=$?
set -e
if ! { [ "$status_a" = 0 ] && [ "$status_b" != 0 ]; } && ! { [ "$status_b" = 0 ] && [ "$status_a" != 0 ]; }; then
 cat "$work/race-a.log" "$work/race-b.log"; exit 1
fi
grep -q ADMIN_REVISION_CONFLICT "$work/race-a.log" "$work/race-b.log"
[[ "$("${psql[@]}" -Atc 'select count(*) from private.memory_service_admin_audit;')" == "$((audit_before+1))" ]]
[[ "$("${psql[@]}" -Atc 'select not enabled and admission_enabled from private.simple_signup_policy;')" == t ]]
echo 'PASS: simultaneous same-revision changes commit one pause and one audit event; loser gets revision conflict'
echo 'LOCAL PostgreSQL service-admin contract only; no hosted administrator grant, signup activation or physical deletion.'
