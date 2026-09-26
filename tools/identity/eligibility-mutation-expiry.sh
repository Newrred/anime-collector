#!/usr/bin/env bash
# Real writes wait behind a separate SQL transaction, then expire before completion.
for kind in mutation promotion; do
 entity=77777777-7777-4777-8777-777777777971
 operation=77777777-7777-4777-8777-777777777973
 if [[ "$kind" == promotion ]]; then entity=77777777-7777-4777-8777-777777777972;operation=77777777-7777-4777-8777-777777777974;fi
 "${psql[@]}" -c "update private.memory_eligibility_evidence set state='GRANTED',expires_at=clock_timestamp()+interval '2 seconds' where user_id='77777777-7777-4777-8777-777777777777' and purpose='CLOUD_WRITE'" >/dev/null
 "${psql[@]}" -c "begin;set local application_name='eligibility-title-lock';lock table public.memory_private_titles in share mode;select pg_sleep(3);commit;" > "$work/expiry-lock-$kind.log" 2>&1 &
 lock_pid=$!
 ready=false
 for attempt in $(seq 1 100); do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='eligibility-title-lock' and wait_event='PgSleep')")" == t ]];then ready=true;break;fi
  sleep 0.02
 done
 [[ "$ready" == true ]]
 if [[ "$kind" == mutation ]];then
  call="select public.apply_memory_card_mutation('$operation','77777777-7777-4777-8777-777777777770','PRIVATE_TITLE','$entity','UPSERT',0,repeat('d',64),'{\"displayTitle\":\"Expiry synthetic\",\"normalizedTitle\":\"expiry synthetic\",\"clientUpdatedAt\":\"2026-09-27T00:00:00Z\"}');"
 else
  call="select public.promote_guest_memory('$operation','77777777-7777-4777-8777-777777777770','guest:$entity',repeat('e',64),'{\"privateTitles\":[{\"id\":\"$entity\",\"displayTitle\":\"Expiry promotion\",\"normalizedTitle\":\"expiry promotion\"}]}');"
 fi
 "${psql[@]}" -c "set application_name='eligibility-expiring-write';set role authenticated;set \"request.jwt.claim.sub\"='77777777-7777-4777-8777-777777777777';$call" > "$work/expiry-write-$kind.log" 2>&1 &
 write_pid=$!
 waiting=false
 for attempt in $(seq 1 100);do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='eligibility-expiring-write' and wait_event_type='Lock')")" == t ]];then waiting=true;break;fi
  sleep 0.02
 done
 [[ "$waiting" == true ]]
 wait "$lock_pid"
 if wait "$write_pid";then echo "FAIL: $kind committed after eligibility expiry";exit 1;fi
 grep -q ELIGIBILITY_EXPIRED "$work/expiry-write-$kind.log"
 [[ "$("${psql[@]}" -Atc "select count(*) from public.memory_private_titles where id='$entity'")" == 0 ]]
 [[ "$("${psql[@]}" -Atc "select count(*) from public.sync_operations where operation_id='$operation'")" == 0 ]]
 [[ "$("${psql[@]}" -Atc "select count(*) from public.user_account_promotions where guest_owner_id='guest:$entity'")" == 0 ]]
 echo "PASS: actual $kind lock-wait expiry rolls back title and operation/promotion ledger"
done
# Restore the preceding race fixture's revoked state for independent image tests.
"${psql[@]}" -c "update private.memory_eligibility_evidence set state='REVOKED',expires_at=clock_timestamp()+interval '1 hour' where purpose='CLOUD_WRITE'" >/dev/null
