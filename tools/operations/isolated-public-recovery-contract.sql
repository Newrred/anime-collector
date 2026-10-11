BEGIN;
-- INCLUDE_CAPTURE_FUNCTIONS
-- INCLUDE_PUBLIC_REPLAY
CREATE TEMP TABLE public_recovery_checks(label text);
CREATE FUNCTION pg_temp.check_recovery(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'RECOVERY_CONTRACT_FAILED: %',label; END IF; INSERT INTO public_recovery_checks VALUES(label); END $$;
UPDATE private.simple_signup_policy SET admission_enabled=false;
UPDATE private.memory_resource_policies SET enabled=false;
UPDATE private.memory_publication_settings SET reads_enabled=true,writes_enabled=true,images_enabled=true,minihomes_enabled=true,follows_enabled=true,policy_revision='LOCAL_RECOVERY',content_policy_revision='LOCAL_RECOVERY',general_publication_policy_revision='LOCAL_RECOVERY',asset_limit=10,asset_bytes_limit=41943040;
INSERT INTO auth.users(id) VALUES('f1000000-0000-4000-8000-000000000001'),('f1000000-0000-4000-8000-000000000002');
INSERT INTO public.user_profiles(user_id,display_name) VALUES('f1000000-0000-4000-8000-000000000001','Recovery synthetic') ON CONFLICT DO NOTHING;
INSERT INTO public.memory_cards(id,user_id,catalog_anime_id,title_snapshot,status,client_updated_at) VALUES('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','anime:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Synthetic recovery','COMPLETE_PRIVATE',now());
INSERT INTO public.memory_visual_assets(id,user_id,card_id,asset_type,state,rights_basis,is_current,client_updated_at,checksum_sha256) VALUES('f3000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','USER_IMAGE','READY','USER_ORIGINAL',true,now(),repeat('b',64));
INSERT INTO public.memory_boards(id,user_id,title,client_updated_at) VALUES('f4000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Synthetic recovery',now());
INSERT INTO public.memory_board_cards(id,user_id,board_id,card_id,position_key,client_updated_at) VALUES(gen_random_uuid(),'f1000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','a',now());
INSERT INTO private.memory_public_image_rights(user_id,asset_id,source_version,image_type,evidence_ref) VALUES('f1000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001',1,'USER_ORIGINAL','synthetic-recovery-only');
DO $$
DECLARE a jsonb; p jsonb; h jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','f1000000-0000-4000-8000-000000000001',true);
 a:=public.reserve_memory_public_asset('f3000000-0000-4000-8000-000000000001',1,gen_random_uuid(),'LOCAL_RECOVERY');
 PERFORM public.complete_memory_public_asset((a->>'id')::uuid,repeat('c',64),repeat('d',64),100,50,10,10);
 p:=public.prepare_memory_publication('f4000000-0000-4000-8000-000000000001',0,'{"title":"Synthetic recovery","description":"","cards":[{"cardId":"f2000000-0000-4000-8000-000000000001","fields":[]}]}');
 PERFORM public.publish_memory_publication((p->>'id')::uuid,(p->>'revision')::bigint,p->>'reviewHash','LOCAL_RECOVERY',gen_random_uuid());
 h:=public.prepare_memory_minihome(0,jsonb_build_object('nickname','Synthetic','bio','','entries',jsonb_build_array(jsonb_build_object('publicationId',p->>'id'))));
 PERFORM public.publish_memory_minihome((h->>'revision')::bigint,h->>'reviewHash','LOCAL_RECOVERY',gen_random_uuid());
END $$;
INSERT INTO public.user_devices(id,user_id,installation_id,platform,app_version) VALUES('f5000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',gen_random_uuid(),'WEB','local-recovery');
DO $record$ BEGIN PERFORM private.record_memory_operation('f1000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001','MEMORY_CARD','f2000000-0000-4000-8000-000000000001','UPSERT',0,repeat('a',64),'APPLIED',1,1,null); END $record$;
CREATE TEMP TABLE original_retry AS SELECT * FROM public.sync_operations WHERE operation_id='f6000000-0000-4000-8000-000000000001';
DO $tests$
DECLARE scenario text; c jsonb; p jsonb; pub uuid; home uuid; image_id uuid; before_image jsonb; before_pub jsonb; result jsonb; visible boolean; error_caught boolean;
BEGIN
 SELECT id,to_jsonb(t) INTO pub,before_pub FROM private.memory_publications t WHERE board_id='f4000000-0000-4000-8000-000000000001';
 SELECT id INTO home FROM private.memory_minihomes WHERE user_id='f1000000-0000-4000-8000-000000000001';
 SELECT id,to_jsonb(t)-'state' INTO image_id,before_image FROM private.memory_public_assets t WHERE source_asset_id='f3000000-0000-4000-8000-000000000001';
 PERFORM set_config('request.jwt.claim.sub','',true);
 SET LOCAL ROLE anon;
 visible:=public.read_memory_publication(pub) IS NOT NULL AND public.read_memory_minihome(home) IS NOT NULL;
 RESET ROLE;
 PERFORM pg_temp.check_recovery(visible,'positive control: synthetic board and home visible through real restored RPC');
 PERFORM pg_temp.check_recovery(public.resolve_memory_public_image(pub,image_id,'full') IS NOT NULL,'positive control: actual image resolver returns synthetic manifest');
 FOREACH scenario IN ARRAY ARRAY['unchanged','board-withdraw','home-withdraw','card-delete','asset-delete','board-delete','account-delete','rights-revoke','moderator-hide','content-block','account-restrict','source-version','unfollow-block','incomplete','stale','snapshot-mismatch'] LOOP
  BEGIN
   -- Collect later state, roll it back, then reconcile the older restored rows.
   BEGIN
    CASE scenario
     WHEN 'board-withdraw' THEN UPDATE private.memory_publications SET state='REVOKED',published_snapshot=NULL WHERE id=pub;
     WHEN 'home-withdraw' THEN UPDATE private.memory_minihomes SET published_selection=NULL WHERE id=home;
     WHEN 'card-delete' THEN UPDATE public.memory_cards SET status='DELETED',deleted_at=now() WHERE id='f2000000-0000-4000-8000-000000000001';
     WHEN 'asset-delete' THEN UPDATE public.memory_visual_assets SET state='DELETED',deleted_at=now(),is_current=false WHERE id='f3000000-0000-4000-8000-000000000001';
     WHEN 'board-delete' THEN UPDATE public.memory_boards SET deleted_at=now() WHERE id='f4000000-0000-4000-8000-000000000001';
     WHEN 'account-delete' THEN DELETE FROM auth.users WHERE id='f1000000-0000-4000-8000-000000000001';
     WHEN 'rights-revoke' THEN UPDATE private.memory_public_image_rights SET revoked_at=now() WHERE asset_id='f3000000-0000-4000-8000-000000000001';
     WHEN 'moderator-hide' THEN UPDATE private.memory_publications SET hidden=true WHERE id=pub;
     WHEN 'content-block' THEN INSERT INTO private.memory_content_reviews(publication_id,snapshot_hash,rating,policy_revision,reviewed_by) VALUES(pub,repeat('c',64),'BLOCKED','LOCAL_RECOVERY','f1000000-0000-4000-8000-000000000002');
     WHEN 'account-restrict' THEN INSERT INTO private.memory_publication_accounts(user_id,hidden,write_blocked) VALUES('f1000000-0000-4000-8000-000000000001',true,true) ON CONFLICT(user_id) DO UPDATE SET hidden=true,write_blocked=true;
     WHEN 'source-version' THEN UPDATE public.memory_visual_assets SET version=version+1 WHERE id='f3000000-0000-4000-8000-000000000001';
     WHEN 'unfollow-block' THEN INSERT INTO private.memory_relationships VALUES('f1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001',false,true);
     ELSE NULL;
    END CASE;
    c:=pg_temp.capture_private(); p:=pg_temp.capture_public();
    RAISE SQLSTATE 'ZX001';
   EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL; END;
   IF scenario='incomplete' THEN p:=p-'rights'; END IF;
   IF scenario='stale' THEN c:=jsonb_set(c,'{capturedAt}',to_jsonb(now()-interval '2 hours')); p:=jsonb_set(p,'{capturedAt}',c->'capturedAt'); END IF;
   IF scenario='snapshot-mismatch' THEN p:=jsonb_set(p,'{snapshot}','"mismatch"'); END IF;
   IF scenario IN ('incomplete','stale','snapshot-mismatch') THEN
    error_caught:=false;
    BEGIN PERFORM pg_temp.reconcile_public_recovery(c,p); EXCEPTION WHEN others THEN IF sqlerrm NOT IN ('INCOMPLETE_PUBLIC_STATE','INVALID_LATEST_STATE') THEN RAISE; END IF; error_caught:=true; END;
    PERFORM pg_temp.check_recovery(error_caught,'reject '||scenario);
   ELSE
    result:=pg_temp.reconcile_public_recovery(c,p);
    PERFORM pg_temp.check_recovery((SELECT NOT (reads_enabled OR writes_enabled OR images_enabled OR minihomes_enabled OR follows_enabled OR reports_enabled) FROM private.memory_publication_settings),'closed during '||scenario);
    PERFORM pg_temp.reconcile_public_recovery(c,p);
    PERFORM pg_temp.check_recovery((SELECT to_jsonb(t)-'state'=before_image FROM private.memory_public_assets t WHERE id=image_id),'operation/source/hash/quota preserved '||scenario);
    IF scenario='card-delete' THEN
     PERFORM pg_temp.check_recovery((SELECT (to_jsonb(n)-'result_payload')=(to_jsonb(o)-'result_payload') AND (n.result_payload-'remoteEntity')=(o.result_payload-'remoteEntity') FROM public.sync_operations n JOIN original_retry o USING(operation_id)),'deleted retry preserves operation/hash/result');
     PERFORM pg_temp.check_recovery(private.replay_memory_operation('f6000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',repeat('a',64))->'remoteEntity'='null'::jsonb,'deleted retry returns no stale body');
     PERFORM pg_temp.check_recovery(private.replay_memory_operation('f6000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',repeat('b',64))->>'errorCode'='OPERATION_HASH_MISMATCH','deleted retry rejects changed request');
    ELSIF scenario='unchanged' THEN
     PERFORM pg_temp.check_recovery((SELECT to_jsonb(n)=to_jsonb(o) FROM public.sync_operations n JOIN original_retry o USING(operation_id)),'active retry content preserved');
    END IF;
    UPDATE private.memory_publication_settings SET reads_enabled=true,images_enabled=true,minihomes_enabled=true;
    IF scenario='unchanged' THEN
     PERFORM pg_temp.check_recovery((SELECT to_jsonb(t)=before_pub FROM private.memory_publications t WHERE id=pub),'unchanged published snapshot preserved');
     PERFORM pg_temp.check_recovery(public.read_memory_publication(pub) IS NOT NULL AND public.read_memory_minihome(home) IS NOT NULL AND public.resolve_memory_public_image(pub,image_id,'full') IS NOT NULL,'unchanged control remains readable');
    ELSIF scenario='home-withdraw' THEN
     PERFORM pg_temp.check_recovery(public.read_memory_minihome(home) IS NULL AND public.read_memory_publication(pub) IS NOT NULL,'home withdrawal keeps independent board');
    ELSIF scenario='unfollow-block' THEN
     PERFORM pg_temp.check_recovery((SELECT blocked AND NOT following FROM private.memory_relationships WHERE owner_id='f1000000-0000-4000-8000-000000000002' AND target_id='f1000000-0000-4000-8000-000000000001'),'latest block restored');
    ELSE
     PERFORM pg_temp.check_recovery(public.resolve_memory_public_image(pub,image_id,'full') IS NULL,'old image access denied '||scenario);
     IF scenario IN ('board-withdraw','card-delete','board-delete','account-delete','moderator-hide','content-block','account-restrict') THEN PERFORM pg_temp.check_recovery(public.read_memory_publication(pub) IS NULL OR jsonb_array_length(public.read_memory_publication(pub)->'cards')=0,'board content denied '||scenario); END IF;
    END IF;
   END IF;
   -- Keep only labels across rollback, never the synthetic rows or enabled flags.
   result:=(SELECT jsonb_agg(label) FROM public_recovery_checks);
   RAISE SQLSTATE 'ZX002';
  EXCEPTION WHEN SQLSTATE 'ZX002' THEN
   DELETE FROM public_recovery_checks;
   INSERT INTO public_recovery_checks SELECT jsonb_array_elements_text(result);
  END;
 END LOOP;
END $tests$;
SELECT jsonb_build_object('checks',(SELECT count(*) FROM public_recovery_checks),'labels',(SELECT jsonb_agg(label) FROM public_recovery_checks),'synthetic',true,'actualRestoredFunctions',true,'externalStorageHttpVerified',false);
ROLLBACK;
