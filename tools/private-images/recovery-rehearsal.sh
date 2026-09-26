# Sourced by the disposable local cluster runner. Never accepts a remote DB URL.
# All files are generated synthetic fixtures, not production backup material.
fixture="$PRIVATE_RECOVERY_FIXTURES"
main_hash=$(sha256sum "$fixture/main.webp" | cut -d ' ' -f 1)
thumb_hash=$(sha256sum "$fixture/thumb.webp" | cut -d ' ' -f 1)
main_bytes=$(stat -c %s "$fixture/main.webp")
thumb_bytes=$(stat -c %s "$fixture/thumb.webp")
"${psql[@]}" -v main_hash="$main_hash" -v thumb_hash="$thumb_hash" -v main_bytes="$main_bytes" -v thumb_bytes="$thumb_bytes" <<'SQL' >/dev/null
insert into public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at)
select ('dddddddd-dddd-4ddd-8ddd-'||lpad(n::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111',
'anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic recovery','DRAFT',now() from generate_series(1,3) n;
insert into public.memory_visual_assets(id,user_id,card_id,asset_type,state,is_current,checksum_sha256,mime_type,byte_size,width,height,client_updated_at)
select ('eeeeeeee-eeee-4eee-8eee-'||lpad(n::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111',
('dddddddd-dddd-4ddd-8ddd-'||lpad(n::text,12,'0'))::uuid,'USER_IMAGE','READY',true,repeat('a',64),'image/png',500,64,64,now() from generate_series(1,3) n;
insert into private.memory_private_media(id,owner_id,asset_id,source_version,operation_id,policy_revision,pipeline,input_hash,main_hash,thumb_hash,main_bytes,thumb_bytes,width,height,state)
select ('99999999-9999-4999-8999-'||lpad(n::text,12,'0'))::uuid,'11111111-1111-4111-8111-111111111111',
('eeeeeeee-eeee-4eee-8eee-'||lpad(n::text,12,'0'))::uuid,1,
('88888888-8888-4888-8888-'||lpad(n::text,12,'0'))::uuid,'LOCAL_TEST','private-webp-v1',repeat('b',64),
:'main_hash',:'thumb_hash',:main_bytes,:thumb_bytes,64,64,'READY' from generate_series(1,3) n;
SQL
mkdir "$work/byte-backup" "$work/byte-restore"
for n in 1 2 3; do
  id="99999999-9999-4999-8999-$(printf '%012d' "$n")"
  mkdir "$work/byte-backup/$id"
  cp "$fixture/main.webp" "$fixture/thumb.webp" "$work/byte-backup/$id/"
done
manifest_query="select md5(string_agg(to_jsonb(m)::text,',' order by id)) from private.memory_private_media m where id::text like '99999999-%'"
manifest_before=$("${psql[@]}" -Atc "$manifest_query")
"$pg_bin/pg_dump" -h "$work" -p 55438 -U "$(id -un)" -d postgres -Fc -f "$work/private-stale.dump"
# Changes AFTER the backup: card fence and known operation cancellation are distinct.
"${psql[@]}" <<'SQL' >/dev/null
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.retire_memory_card_publications('dddddddd-dddd-4ddd-8ddd-000000000002');
select public.cancel_memory_private_image('88888888-8888-4888-8888-000000000003');
SQL
"${psql[@]}" -c "copy private.memory_publication_delete_fences to stdout csv" > "$work/latest-fences.csv"
"${psql[@]}" -c "copy (select id,state,cleanup_after from private.memory_private_media where state in ('DELETING','DELETED')) to stdout csv" > "$work/latest-retired.csv"
"${psql[@]}" -q -f "$root/tools/private-images/capture-recovery-journal.sql" > "$fixture/latest-journal.json"
cp "$work/private-stale.dump" "$fixture/database.dump"
"$pg_bin/createdb" -h "$work" -p 55438 -U "$(id -un)" private_recovery
"$pg_bin/pg_restore" -h "$work" -p 55438 -U "$(id -un)" -d private_recovery --exit-on-error "$work/private-stale.dump"
recovered=("$pg_bin/psql" -h "$work" -p 55438 -U "$(id -un)" -d private_recovery -X -v ON_ERROR_STOP=1)
"${recovered[@]}" -c "update private.memory_private_media_policy set enabled=false; update private.memory_publication_settings set reads_enabled=false,writes_enabled=false,images_enabled=false,minihomes_enabled=false,follows_enabled=false,reports_enabled=false" >/dev/null
[[ "$("${recovered[@]}" -Atc "select count(*) from private.memory_private_media where id::text like '99999999-%' and state='READY'")" == 3 ]]
[[ "$("${recovered[@]}" -Atc "$manifest_query")" == "$manifest_before" ]]
echo 'PASS: complete restored manifests match pre-retirement snapshot including operation IDs'
[[ "$("${recovered[@]}" -Atc "select count(*) from private.memory_private_media where id::text like '99999999-%' and main_hash='$main_hash' and thumb_hash='$thumb_hash' and main_bytes=$main_bytes and thumb_bytes=$thumb_bytes and source_version=1 and owner_id='11111111-1111-4111-8111-111111111111'")" == 3 ]]
"${recovered[@]}" <<'SQL' >/dev/null
begin;
update private.memory_private_media_policy set enabled=true,observed_at=now();
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
select public.read_memory_private_image('eeeeeeee-eeee-4eee-8eee-000000000002',1,'main',false);
select public.read_memory_private_image('eeeeeeee-eeee-4eee-8eee-000000000003',1,'main',false);
rollback;
SQL
echo 'PASS: stale DB restores all three old READY manifests (negative control)'
echo 'PASS: without latest journals both deleted images still resolve through owner RPC (negative control)'
# Replay is monotonic and repeatable; never change a terminal row back to READY.
for replay in 1 2; do
  "${recovered[@]}" <<SQL >/dev/null
begin;
create temp table latest_fences (like private.memory_publication_delete_fences) on commit drop;
\copy latest_fences from '$work/latest-fences.csv' csv
insert into private.memory_publication_delete_fences select * from latest_fences on conflict do nothing;
create temp table latest_retired(id uuid,state text,cleanup_after timestamptz) on commit drop;
\copy latest_retired from '$work/latest-retired.csv' csv
update private.memory_private_media m set state=r.state,cleanup_after=r.cleanup_after
from latest_retired r where m.id=r.id and m.state<>'DELETED';
commit;
SQL
done
"${recovered[@]}" -f "$root/tools/private-images/recovery-assert.sql"
# Copy only eligible surviving bodies after replay, verifying manifests first.
verify_body() {
  [[ -f "$1" ]] && [[ "$(sha256sum "$1" | cut -d ' ' -f 1)" == "$2" ]] && [[ "$(stat -c %s "$1")" == "$3" ]]
}
if verify_body "$fixture/main.webp" "$thumb_hash" "$main_bytes"; then exit 1; fi
if verify_body "$work/missing.webp" "$main_hash" "$main_bytes"; then exit 1; fi
if verify_body "$fixture/main.webp" "$main_hash" "$((main_bytes+1))"; then exit 1; fi
echo 'PASS: corrupt hash, missing body and mismatched byte count are rejected before copy'
while IFS='|' read -r id mh th mb tb; do
  verify_body "$work/byte-backup/$id/main.webp" "$mh" "$mb"
  verify_body "$work/byte-backup/$id/thumb.webp" "$th" "$tb"
  mkdir "$work/byte-restore/$id"
  cp "$work/byte-backup/$id/"*.webp "$work/byte-restore/$id/"
done < <("${recovered[@]}" -Atc "select id,main_hash,thumb_hash,main_bytes,thumb_bytes from private.memory_private_media where id::text like '99999999-%' and state='READY' and private.private_media_source(owner_id,asset_id,source_version)")
[[ "$(find "$work/byte-restore" -type f | wc -l)" == 2 ]]
[[ ! -e "$work/byte-restore/99999999-9999-4999-8999-000000000002" ]]
[[ ! -e "$work/byte-restore/99999999-9999-4999-8999-000000000003" ]]
cp "$work/byte-restore/99999999-9999-4999-8999-000000000001/main.webp" "$fixture/restored-main.webp"
cp "$work/byte-restore/99999999-9999-4999-8999-000000000001/thumb.webp" "$fixture/restored-thumb.webp"
echo 'PASS: only surviving main/thumb physically restored; cancelled and card-deleted bytes excluded'
