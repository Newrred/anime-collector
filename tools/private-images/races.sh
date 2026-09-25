# Sourced from the isolated runner; all inputs below are synthetic local fixtures.
"${psql[@]}" <<'SQL' >/dev/null
insert into private.memory_private_media(owner_id,asset_id,source_version,operation_id,policy_revision,pipeline,input_hash,main_hash,thumb_hash,main_bytes,thumb_bytes,width,height,state)
select '11111111-1111-4111-8111-111111111111',gen_random_uuid(),1,gen_random_uuid(),'LOCAL_TEST','private-webp-v1',repeat('b',64),repeat('c',64),repeat('d',64),979000,1000,100,100,'READY' from generate_series(1,50);
SQL
"${psql[@]}" -v asset=aaaaaaaa-aaaa-4aaa-8aaa-000000000002 -v operation=ffffffff-ffff-4fff-8fff-000000000002 -f "$root/tools/private-images/concurrent-reserve.sql" > "$work/race-a.log" 2>&1 &
a=$!
"${psql[@]}" -v asset=aaaaaaaa-aaaa-4aaa-8aaa-000000000003 -v operation=ffffffff-ffff-4fff-8fff-000000000003 -f "$root/tools/private-images/concurrent-reserve.sql" > "$work/race-b.log" 2>&1 &
b=$!
success=0
if wait "$a"; then success=$((success+1)); else grep -q PRIVATE_IMAGE_QUOTA_EXCEEDED "$work/race-a.log"; fi
if wait "$b"; then success=$((success+1)); else grep -q PRIVATE_IMAGE_QUOTA_EXCEEDED "$work/race-b.log"; fi
[[ "$success" == 1 ]]
[[ "$("${psql[@]}" -Atc "select sum(main_bytes+thumb_bytes) from private.memory_private_media where state<>'DELETED'")" == 49800000 ]]
echo 'PASS: 49MB plus two concurrent 800KB requests admits one, reserves 49.8MB'
# Same operation in two simultaneous sessions must share one row and preparation debit.
"${psql[@]}" -c "update private.memory_private_media_policy set quota_bytes=100000000" >/dev/null
"${psql[@]}" -c "select public.complete_memory_private_image(id) from private.memory_private_media where state='PREPARING'" >/dev/null
for suffix in a b; do
  "${psql[@]}" -v asset=aaaaaaaa-aaaa-4aaa-8aaa-000000000004 -v operation=ffffffff-ffff-4fff-8fff-000000000004 -f "$root/tools/private-images/concurrent-reserve.sql" > "$work/replay-$suffix.log" 2>&1 &
  if [[ "$suffix" == a ]]; then a=$!; else b=$!; fi
done
wait "$a"; wait "$b"
[[ "$("${psql[@]}" -Atc "select count(*) from private.memory_private_media where operation_id='ffffffff-ffff-4fff-8fff-000000000004'")" == 1 ]]
[[ "$("${psql[@]}" -Atc "select preparations from private.memory_private_media_meter where owner_id='11111111-1111-4111-8111-111111111111'")" == 4 ]]
echo 'PASS: simultaneous same-operation reservations use one row and one preparation'
