DO $$ BEGIN
 IF current_user<>'moemoa_recovery_admin' OR current_setting('listen_addresses')<>''
 OR current_setting('cron.launch_active_jobs')<>'off' THEN RAISE EXCEPTION 'NOT_ISOLATED'; END IF;
END $$;
BEGIN;
UPDATE private.memory_private_media_policy SET enabled=true,approved=true,paused=false,observed_at=now();
CREATE TEMP TABLE access_result(result jsonb);
DO $$
DECLARE r record; v jsonb; owner_ok integer:=0; other_denied integer:=0; anon_denied boolean:=false; leaked boolean;
BEGIN
 FOR r IN SELECT * FROM private.memory_private_media WHERE state='READY' LOOP
  PERFORM set_config('request.jwt.claim.sub',r.owner_id::text,true);
  SET LOCAL ROLE authenticated;
  v:=public.read_memory_private_image(r.asset_id,r.source_version,'main',false);
  RESET ROLE;
  IF (v->>'id',v->>'hash',(v->>'bytes')::bigint) IS DISTINCT FROM (r.id::text,r.main_hash,r.main_bytes) THEN RAISE EXCEPTION 'OWNER_MANIFEST_MISMATCH'; END IF;
  owner_ok:=owner_ok+1;
  PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  SET LOCAL ROLE authenticated;
  BEGIN
   PERFORM public.read_memory_private_image(r.asset_id,r.source_version,'main',false);
   RAISE EXCEPTION 'OTHER_OWNER_ALLOWED';
  EXCEPTION WHEN others THEN IF sqlerrm<>'NOT_FOUND' THEN RAISE; END IF; END;
  RESET ROLE;
  other_denied:=other_denied+1;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
 SET LOCAL ROLE authenticated;
 SELECT EXISTS(SELECT 1 FROM public.memory_cards) INTO leaked;
 RESET ROLE;
 IF leaked THEN RAISE EXCEPTION 'CARD_RLS_LEAK'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 SET LOCAL ROLE anon;
 BEGIN
  PERFORM public.read_memory_private_image('00000000-0000-4000-8000-000000000001',1,'main',false);
  RAISE EXCEPTION 'ANON_ALLOWED';
 EXCEPTION WHEN others THEN
  IF sqlerrm<>'AUTH_REQUIRED' AND sqlstate<>'42501' THEN RAISE; END IF;
 END;
 RESET ROLE;
 anon_denied:=true;
 IF owner_ok=0 THEN RAISE EXCEPTION 'NO_ELIGIBLE_RESTORED_IMAGES'; END IF;
 INSERT INTO access_result VALUES(jsonb_build_object('ownerReads',owner_ok,'otherOwnerDenied',other_denied,'anonymousDenied',anon_denied,'realRestoredRpc',true,'wrongOwnerCardRlsDenied',true,'imageBytesDecodedThisRun',false));
END $$;
SELECT result FROM access_result;
ROLLBACK;
