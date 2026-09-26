#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-identity-test.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55439 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55439 -U "$(id -un)" -d postgres -X -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" >/dev/null
# Minimal local auth model, NOT the hosted Auth service/schema validation.
"${psql[@]}" -c 'create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),not_after timestamptz)' >/dev/null
"${psql[@]}" -f "$root/tools/identity/request-store-candidate.sql" >/dev/null
"${psql[@]}" -f "$root/tools/identity/request-store-contract.sql"
expected=$("${psql[@]}" -Atc "select (private.memory_identity_request_dto(r)-'id'-'status')||jsonb_build_object('requestId',r.id) from private.memory_identity_requests r where status='PENDING' limit 1")
"${psql[@]}" -v expected="$expected" -v hold=1 -f "$root/tools/identity/complete-race.sql" > "$work/winner.log" 2>&1 &
writer=$!
ready=false
for attempt in $(seq 1 100); do
 if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='identity-completion-race' and wait_event='PgSleep')")" == t ]]; then ready=true;break;fi
 sleep 0.02
done
[[ "$ready" == true ]]
if "${psql[@]}" -v expected="$expected" -v hold=0 -f "$root/tools/identity/complete-race.sql" > "$work/loser.log" 2>&1; then exit 1;fi
grep -q VERIFICATION_REQUEST_CHANGED "$work/loser.log"
wait "$writer"
[[ "$("${psql[@]}" -Atc "select count(*) from private.memory_identity_requests where status='RECORDED' and revision=1")" == 2 ]]
echo "PASS: two real sessions consume pending request once with one revision increment"
"${psql[@]}" -f "$root/tools/identity/eligibility-candidate.sql" >/dev/null
"${psql[@]}" -f "$root/tools/identity/eligibility-contract.sql"
source "$root/tools/identity/eligibility-races.sh"
if [[ -n "${IDENTITY_TEST_NODE:-}" ]]; then
 "$IDENTITY_TEST_NODE" "$(wslpath -w "$root/tools/identity/core-store-integration.mjs")" "$work" "$pg_bin/psql"
fi
echo "Identity request-store local contract PASS"
