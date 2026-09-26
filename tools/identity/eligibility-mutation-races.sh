#!/usr/bin/env bash
# Sourced only inside the disposable private-image runner, after mutation fixtures.
for order in revoke-first write-first; do
 "${psql[@]}" -c "update private.memory_eligibility_evidence set state='GRANTED',revision=revision+1 where user_id='77777777-7777-4777-8777-777777777777'" >/dev/null
 entity=77777777-7777-4777-8777-777777777901
 operation=77777777-7777-4777-8777-777777777903
 if [[ "$order" == write-first ]]; then entity=77777777-7777-4777-8777-777777777902;operation=77777777-7777-4777-8777-777777777904;fi
 cat > "$work/mutation-race-write.sql" <<SQL
begin;
set local application_name='eligibility-real-write';
set local role authenticated;
set local "request.jwt.claim.sub"='77777777-7777-4777-8777-777777777777';
select public.apply_memory_card_mutation('$operation','77777777-7777-4777-8777-777777777770','PRIVATE_TITLE','$entity','UPSERT',0,repeat('9',64),'{"displayTitle":"Race $order","normalizedTitle":"race $order","clientUpdatedAt":"2026-09-27T00:00:00Z"}');
select pg_sleep(:hold);
commit;
SQL
 cat > "$work/mutation-race-revoke.sql" <<'SQL'
begin;
set local application_name='eligibility-real-revoke';
select 1 from private.memory_eligibility_policies where purpose='CLOUD_WRITE' for share;
update private.memory_eligibility_evidence set state='REVOKED',revision=revision+1 where user_id='77777777-7777-4777-8777-777777777777';
select pg_sleep(:hold);
commit;
SQL
 first=revoke;second=write;expected=0
 if [[ "$order" == write-first ]]; then first=write;second=revoke;expected=1;fi
 "${psql[@]}" -v hold=1 -f "$work/mutation-race-$first.sql" > "$work/first-$order.log" 2>&1 &
 first_pid=$!
 ready=false
 for attempt in $(seq 1 100); do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='eligibility-real-$first' and wait_event='PgSleep')")" == t ]]; then ready=true;break;fi
  sleep 0.02
 done
 [[ "$ready" == true ]]
 if "${psql[@]}" -v hold=0 -f "$work/mutation-race-$second.sql" > "$work/second-$order.log" 2>&1; then
  [[ "$order" == write-first ]]
 else
  [[ "$order" == revoke-first ]]
  grep -q ELIGIBILITY_REQUIRED "$work/second-$order.log"
 fi
 wait "$first_pid"
 [[ "$("${psql[@]}" -Atc "select count(*) from public.memory_private_titles where id='$entity'")" == "$expected" ]]
 [[ "$("${psql[@]}" -Atc "select count(*) from public.sync_operations where operation_id='$operation'")" == "$expected" ]]
 [[ "$("${psql[@]}" -Atc "select state from private.memory_eligibility_evidence where user_id='77777777-7777-4777-8777-777777777777'")" == REVOKED ]]
 echo "PASS: actual mutation $order serializes record and operation ledger with revocation"
done
