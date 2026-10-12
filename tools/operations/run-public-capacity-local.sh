#!/usr/bin/env bash
# Disposable PostgreSQL only; no URL, credentials or hosted changes.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-public-capacity.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55456 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55456 -U "$(id -un)" -d postgres -X -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/setup.log" 2>&1
for migration in "$root"/supabase/migrations/*.sql; do
 case "$(basename "$migration")" in
  20260902055512_memory_user_retention.sql) continue ;;
  20260924115258_memory_resource_controls.sql)
   "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >> "$work/setup.log" 2>&1 ;;
 esac
 "${psql[@]}" -f "$migration" >> "$work/setup.log" 2>&1 || { tail -35 "$work/setup.log"; exit 1; }
done
"${psql[@]}" -f "$root/tools/operations/public-capacity-contract.sql" > "$work/result.log" 2>&1 || { cat "$work/result.log"; exit 1; }
"${psql[@]}" -f "$root/tools/operations/sized-image-delivery-contract.sql" >> "$work/result.log" 2>&1 || { cat "$work/result.log"; exit 1; }
"${psql[@]}" -f "$root/tools/operations/public-delivery-budget-contract.sql" >> "$work/result.log" 2>&1 || { cat "$work/result.log"; exit 1; }
# Exercise the exact scripts' abort paths against this disposable DB only.
expect_guard() {
 local file="$1" expected="$2"
 if "${psql[@]}" -v apply_delivery_budget=true -f "$root/tools/operations/$file" > "$work/guard.log" 2>&1; then
  echo "FAIL: expected $expected"; exit 1
 fi
 grep -q "$expected" "$work/guard.log" || { cat "$work/guard.log"; exit 1; }
 echo "PASS: exact SQL rejects $expected" >> "$work/result.log"
}
"${psql[@]}" -c "UPDATE private.memory_resource_policies SET paused=true WHERE scope='IMAGE_DELIVERY'"
expect_guard public-delivery-budget-candidate.sql DELIVERY_BASELINE_CHANGED
"${psql[@]}" -c "UPDATE private.memory_resource_policies SET paused=false WHERE scope='IMAGE_DELIVERY'; INSERT INTO private.memory_resource_overrides(actor,scope,daily_limit,expires_at,reason) VALUES ('00000000-0000-0000-0000-000000000000','IMAGE_DELIVERY',9000,now()+interval '1 hour','local contract') ON CONFLICT(actor,scope) DO UPDATE SET expires_at=excluded.expires_at;"
expect_guard public-delivery-budget-candidate.sql ACTIVE_DELIVERY_OVERRIDE
expect_guard public-delivery-budget-rollback.sql DELIVERY_CANDIDATE_CHANGED
grep "PASS:" "$work/result.log"
echo "LOCAL aggregate/authorization contract only; no remote mutation."
