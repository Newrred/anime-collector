-- Isolated quarantine only. Never install as an application/production function.
CREATE OR REPLACE FUNCTION pg_temp.reconcile_public_recovery(c jsonb,p jsonb) RETURNS jsonb LANGUAGE plpgsql AS $replay$
DECLARE k text; n bigint; counts jsonb:='{}';
BEGIN
 IF current_user<>'moemoa_recovery_admin' OR current_setting('listen_addresses')<>'' OR current_setting('cron.launch_active_jobs')<>'off' THEN RAISE EXCEPTION 'NOT_ISOLATED'; END IF;
 IF p->>'capturedAt' IS NULL OR p->>'snapshot' IS NULL OR c->>'capturedAt' IS NULL OR c->>'snapshot' IS NULL OR c->>'format' IS DISTINCT FROM 'moemoa-private-recovery-journal-v1' OR p->>'format' IS DISTINCT FROM 'moemoa-public-recovery-state-v1'
 OR c->>'snapshot' IS DISTINCT FROM p->>'snapshot' OR c->>'capturedAt' IS DISTINCT FROM p->>'capturedAt'
 OR (p->>'capturedAt')::timestamptz < now()-interval '1 hour' OR (p->>'capturedAt')::timestamptz>now()+interval '1 minute' THEN RAISE EXCEPTION 'INVALID_LATEST_STATE'; END IF;
 FOREACH k IN ARRAY ARRAY['accounts','cards','assets','cardFences','cancelled','media'] LOOP
  IF jsonb_typeof(c->k) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INCOMPLETE_PRIVATE_STATE'; END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['boards','publications','homes','publicCards','publicAssets','rights','representationRights','reviews','homeReviews','restrictions','sanctions','relationships'] LOOP
  IF jsonb_typeof(p->k) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INCOMPLETE_PUBLIC_STATE'; END IF;
  IF k<>'boards' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p->k) x WHERE x->>'fingerprint' IS NULL OR x->>'fingerprint' !~ '^[a-f0-9]{64}$') THEN RAISE EXCEPTION 'INVALID_PUBLIC_FINGERPRINT'; END IF;
 END LOOP;
 -- Keep every reader/writer closed even when the source backup had enabled flags.
 UPDATE private.memory_publication_settings SET reads_enabled=false,writes_enabled=false,images_enabled=false,minihomes_enabled=false,follows_enabled=false,reports_enabled=false;
 UPDATE private.memory_private_media_policy SET enabled=false;
 -- Latest absent accounts are removed only from this isolated DB; FK cascades prevent private resurrection.
 DELETE FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(c->'accounts') a WHERE a=u.id::text);
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('deletedAccounts',n);
 UPDATE public.memory_cards t SET deleted_at=now(),status='DELETED' WHERE t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'cards') x WHERE x->>'id'=t.id::text AND x->>'ownerId'=t.user_id::text AND x->>'deletedAt' IS NULL);
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('deletedCards',n);
 UPDATE public.memory_visual_assets t SET deleted_at=now(),state='DELETED',is_current=false WHERE t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'assets') x WHERE x->>'id'=t.id::text AND x->>'ownerId'=t.user_id::text AND x->>'deletedAt' IS NULL);
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('deletedAssets',n);
 UPDATE public.memory_boards t SET deleted_at=now() WHERE t.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'boards') x WHERE x->>'id'=t.id::text AND x->>'ownerId'=t.user_id::text AND x->>'deletedAt' IS NULL);
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('deletedBoards',n);
 INSERT INTO private.memory_publication_delete_fences(user_id,card_id) SELECT (x->>'user_id')::uuid,(x->>'card_id')::uuid FROM jsonb_array_elements(c->'cardFences') x WHERE EXISTS(SELECT 1 FROM auth.users u WHERE u.id=(x->>'user_id')::uuid) ON CONFLICT DO NOTHING;
 -- Restored idempotency replies must not carry pre-deletion content back to a client.
 UPDATE public.sync_operations o SET result_payload=jsonb_set(o.result_payload,'{remoteEntity}','null'::jsonb,false)
 WHERE o.entity_type IN ('MEMORY_CARD','VISUAL_ASSET','MEMORY_BOARD','MEMORY_BOARD_CARD') AND o.result_payload ? 'remoteEntity' AND o.result_payload->'remoteEntity' IS DISTINCT FROM 'null'::jsonb
 AND NOT EXISTS(SELECT 1 FROM public.memory_cards e WHERE o.entity_type='MEMORY_CARD' AND e.id=o.entity_id AND e.user_id=o.user_id AND e.deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.memory_visual_assets e WHERE o.entity_type='VISUAL_ASSET' AND e.id=o.entity_id AND e.user_id=o.user_id AND e.deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.memory_boards e WHERE o.entity_type='MEMORY_BOARD' AND e.id=o.entity_id AND e.user_id=o.user_id AND e.deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.memory_board_cards e JOIN public.memory_boards b ON b.id=e.board_id JOIN public.memory_cards c ON c.id=e.card_id WHERE o.entity_type='MEMORY_BOARD_CARD' AND e.id=o.entity_id AND e.user_id=o.user_id AND e.deleted_at IS NULL AND b.deleted_at IS NULL AND c.deleted_at IS NULL);
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('scrubbedRetryBodies',n);
 -- Never upgrade an old approval. Missing/changed/revoked exact evidence remains revoked.
 UPDATE private.memory_public_image_rights t SET revoked_at=now() WHERE revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'rights') x WHERE x->>'fingerprint'=encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AND x->>'revoked_at' IS NULL);
 UPDATE private.memory_representation_public_rights t SET revoked_at=now() WHERE revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'representationRights') x WHERE x->>'fingerprint'=encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AND x->>'revoked_at' IS NULL);
 UPDATE private.memory_public_cards t SET revoked=true WHERE NOT revoked AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'publicCards') x WHERE x->>'fingerprint'=encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AND x->>'revoked'='false' AND x->>'hidden'='false');
 -- Quarantine changed/withdrawn snapshots; never replace them with a newer positive consent.
 UPDATE private.memory_publications t SET state='REVOKED',published_snapshot=NULL,preview=NULL,preview_hash=NULL,revision=revision+1 WHERE state<>'REVOKED' AND (
 NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'publications') x WHERE x->>'fingerprint'=encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AND x->>'state'='PUBLISHED' AND x->>'hidden'='false')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'reviews') x WHERE x->>'publication_id'=t.id::text AND x->>'rating'<>'GENERAL'));
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('quarantinedBoards',n);
 UPDATE private.memory_minihomes t SET published_selection=NULL,preview=NULL,review_hash=NULL,revision=revision+1 WHERE published_selection IS NOT NULL AND (
 NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'homes') x WHERE x->>'fingerprint'=encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AND x->>'hidden'='false')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'homeReviews') x WHERE x->>'home_id'=t.id::text AND x->>'rating'<>'GENERAL'));
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('quarantinedHomes',n);
 INSERT INTO private.memory_publication_accounts(user_id,hidden,write_blocked)
 SELECT DISTINCT u.id,true,true FROM auth.users u WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(p->'restrictions') x WHERE x->>'user_id'=u.id::text AND (x->>'hidden'='true' OR x->>'write_blocked'='true')) OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'sanctions') x WHERE x->>'user_id'=u.id::text AND x->>'active'='true')
 ON CONFLICT(user_id) DO UPDATE SET hidden=true,write_blocked=true;
 -- Old follows cannot survive unfollow/block; latest blocks are conservative deny-only replay.
 UPDATE private.memory_relationships t SET following=false WHERE following AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'relationships') x WHERE x->>'owner_id'=t.owner_id::text AND x->>'target_id'=t.target_id::text AND x->>'following'='true' AND x->>'blocked'='false');
 INSERT INTO private.memory_relationships(owner_id,target_id,following,blocked)
 SELECT (x->>'owner_id')::uuid,(x->>'target_id')::uuid,false,true FROM jsonb_array_elements(p->'relationships') x WHERE x->>'blocked'='true' AND EXISTS(SELECT 1 FROM auth.users WHERE id=(x->>'owner_id')::uuid) AND EXISTS(SELECT 1 FROM auth.users WHERE id=(x->>'target_id')::uuid)
 ON CONFLICT(owner_id,target_id) DO UPDATE SET following=false,blocked=true;
 -- Preserve cleanup identity and reserved quota until physical bytes are reconciled.
 UPDATE private.memory_public_assets t SET state='DELETING' WHERE state NOT IN ('DELETED','DELETING') AND (
 NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p->'publicAssets') x WHERE x->>'fingerprint'=encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AND x->>'state'='READY')
 OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=t.user_id)
 OR NOT EXISTS(SELECT 1 FROM public.memory_cards WHERE id=t.card_id AND user_id=t.user_id AND deleted_at IS NULL)
 OR NOT EXISTS(SELECT 1 FROM public.memory_visual_assets WHERE id=t.source_asset_id AND user_id=t.user_id AND version=t.source_version AND deleted_at IS NULL AND is_current)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'assets') x WHERE x->>'id'=t.source_asset_id::text AND x->>'ownerId'=t.user_id::text AND x->>'version'=t.source_version::text AND x->>'current'='true' AND x->>'state'='READY' AND x->>'deletedAt' IS NULL)
 OR EXISTS(SELECT 1 FROM private.memory_publication_delete_fences WHERE user_id=t.user_id AND card_id=t.card_id)
 OR NOT EXISTS(SELECT 1 FROM private.memory_public_image_rights WHERE user_id=t.user_id AND asset_id=t.source_asset_id AND source_version=t.source_version AND revoked_at IS NULL)
 OR (t.private_representation_id IS NOT NULL AND NOT private.public_representation_rights_current(t.id)));
 GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('quarantinedImages',n);
 RETURN counts||jsonb_build_object('safeToServe',false,'scope','Deny-only quarantine; no new positive consent or moderation audit fabricated');
END $replay$;
