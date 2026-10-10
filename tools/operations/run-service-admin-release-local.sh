#!/usr/bin/env bash
# First run: node tools/operations/prepare-service-admin-release-fixtures.mjs
# Tests generated deployment SQL only in a new local PostgreSQL cluster.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
fixtures="$root/.cache/service-admin-release-fixtures"
pg_bin="${PG_BIN:-/usr/lib/postgresql/16/bin}"
work="$(mktemp -d /tmp/moemoa-service-admin-release.XXXXXX)"
trap '"$pg_bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
"$pg_bin/initdb" -D "$work/data" -A trust --no-locale -E UTF8 > "$work/init.log"
"$pg_bin/pg_ctl" -D "$work/data" -l "$work/server.log" -o "-k $work -p 55458 -c listen_addresses=''" start >/dev/null
psql=("$pg_bin/psql" -h "$work" -p 55458 -U "$(id -un)" -d postgres -X -q -v ON_ERROR_STOP=1)
"${psql[@]}" -f "$root/tools/publication-boundary/bootstrap.sql" > "$work/setup.log" 2>&1
for migration in "$root"/supabase/migrations/*.sql; do
 name="$(basename "$migration")"
 [[ "$name" != '20260902055512_memory_user_retention.sql' ]] || continue
 [[ "$name" < '20261010170000' ]] || continue
 if [[ "$name" == '20260924115258_memory_resource_controls.sql' ]]; then
  "${psql[@]}" -f "$root/tools/publication-boundary/legacy-resource-fixture.sql" >> "$work/setup.log" 2>&1
 fi
 "${psql[@]}" -f "$migration" >> "$work/setup.log" 2>&1 || { cat "$work/setup.log"; exit 1; }
done
"${psql[@]}" <<'SQL'
create schema supabase_migrations;
alter table auth.users add column email_confirmed_at timestamptz;
create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
insert into supabase_migrations.schema_migrations values('20261009143000','simple_signup_admission',array['local fixture']);
update private.memory_private_media_policy set revision='TEST_ONLY_PHONE_WEB_20260927_01';
SQL
run() { "${psql[@]}" -f "$1" > "$work/run.log" 2>&1 || { cat "$work/run.log"; exit 1; }; }
denied() {
 if "${psql[@]}" -f "$1" > "$work/denied.log" 2>&1; then echo 'FAIL: release unexpectedly passed'; exit 1; fi
 grep -q "$2" "$work/denied.log" || { cat "$work/denied.log"; exit 1; }
 echo "PASS: $3"
}
run "$fixtures/schema-rollback.sql"
[[ "$("${psql[@]}" -Atc "select to_regclass('private.memory_service_operators') is null and not exists(select 1 from supabase_migrations.schema_migrations where version='20261010170000');")" == t ]]
echo 'PASS: generated rehearsal rolls back both migrations and ledger entries'
run "$fixtures/schema-apply.sql"
[[ "$("${psql[@]}" -Atc "select count(*) from supabase_migrations.schema_migrations where version in ('20261010170000','20261010180000');")" == 2 ]]
echo 'PASS: generated schema apply installs two exact migrations and ledger entries'
run "$fixtures/schema-apply.sql"
echo 'PASS: exact existing ledger and live definitions permit an idempotent recheck'
"${psql[@]}" -c "update supabase_migrations.schema_migrations set statements=array[replace(statements[1],chr(10),chr(13)||chr(10))] where version in ('20261010170000','20261010180000');" >/dev/null
run "$fixtures/schema-rollback.sql"
echo 'PASS: Windows editor CRLF-only ledger normalization is accepted'
denied "$fixtures/production-guard.sql" PRIVATE_POLICY_TARGET_MISMATCH 'production SQL refuses the test target policy marker'
denied "$fixtures/operator-apply.sql" EXACT_CONFIRMED_GOOGLE_OPERATOR_REQUIRED 'operator grant refuses a missing approved account'
"${psql[@]}" <<'SQL'
insert into auth.users(id,email,raw_user_meta_data) values('11111111-1111-4111-8111-111111111111','godburgundy@gmail.com','{"email_verified":true}');
SQL
denied "$fixtures/operator-apply.sql" EXACT_CONFIRMED_GOOGLE_OPERATOR_REQUIRED 'email alone without a Google identity cannot receive the role'
"${psql[@]}" -c "insert into auth.identities(user_id,provider,identity_data) values('11111111-1111-4111-8111-111111111111','google','{}');" >/dev/null
denied "$fixtures/operator-apply.sql" EXACT_CONFIRMED_GOOGLE_OPERATOR_REQUIRED 'Google identity with an unconfirmed account email cannot receive the role'
"${psql[@]}" -c "update auth.users set email_confirmed_at=now() where id='11111111-1111-4111-8111-111111111111';" >/dev/null
run "$fixtures/operator-rollback.sql"
[[ "$("${psql[@]}" -Atc 'select count(*) from private.memory_service_operators;')" == 0 ]]
echo 'PASS: separate operator grant rehearsal does not persist a role'
run "$fixtures/operator-apply.sql"
[[ "$("${psql[@]}" -Atc 'select count(*) from private.memory_service_operators where enabled;')" == 1 ]]
echo 'PASS: separate explicit operator step grants only the selected existing account'
"${psql[@]}" -c "alter function public.get_my_simple_signup_receipts() stable security invoker;" >/dev/null
denied "$fixtures/schema-rollback.sql" MIGRATION_FUNCTION_MISMATCH 'unchanged ledger cannot hide a modified live function security property'
"${psql[@]}" -c "alter function public.get_my_simple_signup_receipts() security definer;" >/dev/null
run "$fixtures/schema-rollback.sql"
"${psql[@]}" -c "grant execute on function public.get_my_simple_signup_receipts() to anon;" >/dev/null
denied "$fixtures/schema-rollback.sql" MIGRATION_FUNCTION_ACL_MISMATCH 'same-version recheck rejects excessive live RPC permissions'
"${psql[@]}" -c "revoke execute on function public.get_my_simple_signup_receipts() from anon; alter table private.memory_service_admin_audit disable trigger memory_service_admin_audit_immutable;" >/dev/null
denied "$fixtures/schema-rollback.sql" ADMIN_TRIGGER_MISMATCH 'same-version recheck rejects a disabled audit protection trigger'
"${psql[@]}" -c "alter table private.memory_service_admin_audit enable trigger memory_service_admin_audit_immutable; update supabase_migrations.schema_migrations set statements=array[statements[1] || '-- changed'] where version='20261010170000';" >/dev/null
denied "$fixtures/schema-rollback.sql" EXISTING_MIGRATION_LEDGER_MISMATCH 'same-version recheck rejects mismatching committed source in the ledger'
echo 'LOCAL generated SQL verification complete; no remote connection or real account role change.'
