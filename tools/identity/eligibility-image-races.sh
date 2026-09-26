#!/usr/bin/env bash
# Actual completion RPC, isolated synthetic metadata. No Storage bytes implied.
wait_image_activity() {
 local seen=false
 for attempt in $(seq 1 150); do
  if [[ "$("${psql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='$1' and $2)")" == t ]]; then seen=true;break;fi
  sleep 0.02
 done
 [[ "$seen" == true ]]
}
index=0
for order in revoke-first complete-first expiry-wait; do
 index=$((index+1))
 card="99999999-9999-4999-8999-00000000000$index"
 asset="99999999-9999-4999-8999-00000000001$index"
 "${psql[@]}" >/dev/null <<SQL
update private.memory_eligibility_evidence set state='GRANTED',expires_at=clock_timestamp()+interval '1 hour',revision=revision+1;
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at)
 values('$card','77777777-7777-4777-8777-777777777777','anime:77777777-7777-4777-8777-777777777951','Synthetic race','DRAFT',now());
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at)
 values('$asset','77777777-7777-4777-8777-777777777777','$card','USER_IMAGE','READY',true,repeat('a',64),'image/png',500,10,10,now());
SQL
 media=$("${psql[@]}" -qAtc "set role service_role;select public.reserve_memory_private_image('77777777-7777-4777-8777-777777777777','$asset',1,gen_random_uuid(),'ELIGIBILITY_LOCAL',repeat('b',64),repeat('c',64),repeat('d',64),800,200,10,10)->>'id'")
 cat > "$work/image-complete.sql" <<SQL
begin;
set local application_name='eligibility-image-complete';
set local role service_role;
select public.complete_memory_private_image('$media');
select pg_sleep(:hold);
commit;
SQL
 cat > "$work/image-revoke.sql" <<'SQL'
begin;
set local application_name='eligibility-image-revoke';
select 1 from private.memory_eligibility_policies where purpose='CLOUD_WRITE' for share;
update private.memory_eligibility_evidence set state='REVOKED',revision=revision+1;
select pg_sleep(:hold);
commit;
SQL
 if [[ "$order" == expiry-wait ]]; then
  "${psql[@]}" -c "update private.memory_eligibility_evidence set expires_at=clock_timestamp()+interval '2 seconds'" >/dev/null
  "${psql[@]}" -c "begin;set local application_name='eligibility-image-blocker';select private.lock_private_media();select pg_sleep(3);commit" > "$work/image-blocker.log" 2>&1 &
  blocker=$!
  wait_image_activity eligibility-image-blocker "wait_event='PgSleep'"
  "${psql[@]}" -v hold=0 -f "$work/image-complete.sql" > "$work/image-expiry.log" 2>&1 &
  completer=$!
  wait_image_activity eligibility-image-complete "wait_event_type='Lock'"
  wait "$blocker"
  if wait "$completer"; then echo 'FAIL: completion accepted after eligibility expired during media lock wait';exit 1;fi
  grep -q ELIGIBILITY_EXPIRED "$work/image-expiry.log"
  expected=PREPARING
 else
  first=revoke;second=complete;expected=PREPARING
  if [[ "$order" == complete-first ]]; then first=complete;second=revoke;expected=READY;fi
  "${psql[@]}" -v hold=1 -f "$work/image-$first.sql" > "$work/image-first-$order.log" 2>&1 &
  first_pid=$!
  wait_image_activity "eligibility-image-$first" "wait_event='PgSleep'"
  if "${psql[@]}" -v hold=0 -f "$work/image-$second.sql" > "$work/image-second-$order.log" 2>&1; then
   [[ "$order" == complete-first ]]
  else
   [[ "$order" == revoke-first ]]
   grep -q ELIGIBILITY_REQUIRED "$work/image-second-$order.log"
  fi
  wait "$first_pid"
 fi
 [[ "$("${psql[@]}" -Atc "select state from private.memory_private_media where id='$media'")" == "$expected" ]]
 [[ "$("${psql[@]}" -Atc "select main_bytes+thumb_bytes from private.memory_private_media where id='$media'")" == 1000 ]]
 echo "PASS: image completion $order preserves expected state and reserved bytes"
done
