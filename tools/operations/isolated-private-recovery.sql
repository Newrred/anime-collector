-- Only run inside the network-none isolated restore runner, as local bootstrap admin.
-- latest_context is a temp table supplied by that runner; no production connection.
DO $$ BEGIN
 IF current_user<>'moemoa_recovery_admin' OR current_setting('listen_addresses')<>''
 OR current_setting('cron.launch_active_jobs')<>'off' THEN RAISE EXCEPTION 'NOT_ISOLATED'; END IF;
END $$;
CREATE TEMP TABLE before_media AS SELECT id,operation_id,source_version,main_hash,thumb_hash,main_bytes,thumb_bytes FROM private.memory_private_media;
CREATE TEMP TABLE latest_media AS SELECT m.* FROM latest_context c,
 jsonb_populate_recordset(null::private.memory_private_media,c.j->'media') m;
INSERT INTO private.memory_publication_delete_fences(user_id,card_id)
 SELECT (f->>'user_id')::uuid,(f->>'card_id')::uuid FROM latest_context c,jsonb_array_elements(c.j->'cardFences') f
 ON CONFLICT DO NOTHING;
UPDATE private.memory_private_media m SET state='DELETING',cleanup_after=now()
 WHERE m.state NOT IN ('DELETED','DELETING') AND (
 NOT EXISTS(SELECT 1 FROM latest_media l WHERE l.id=m.id AND l.state='READY'
 AND (l.owner_id,l.asset_id,l.source_version,l.operation_id,l.pipeline,l.main_hash,l.thumb_hash,l.main_bytes,l.thumb_bytes,l.width,l.height)
 IS NOT DISTINCT FROM (m.owner_id,m.asset_id,m.source_version,m.operation_id,m.pipeline,m.main_hash,m.thumb_hash,m.main_bytes,m.thumb_bytes,m.width,m.height))
 OR NOT EXISTS(SELECT 1 FROM latest_context c,jsonb_array_elements_text(c.j->'accounts') a WHERE a=m.owner_id::text)
 OR EXISTS(SELECT 1 FROM latest_context c,jsonb_array_elements(c.j->'cancelled') x WHERE x->>'owner_id'=m.owner_id::text AND x->>'operation_id'=m.operation_id::text)
 OR NOT EXISTS(SELECT 1 FROM latest_context c,jsonb_array_elements(c.j->'assets') a,jsonb_array_elements(c.j->'cards') k
 WHERE a->>'id'=m.asset_id::text AND a->>'ownerId'=m.owner_id::text AND a->>'version'=m.source_version::text
 AND a->>'assetType'='USER_IMAGE' AND a->>'state'='READY' AND a->>'current'='true' AND a->>'deletedAt' IS NULL
 AND k->>'id'=a->>'cardId' AND k->>'ownerId'=m.owner_id::text AND k->>'deletedAt' IS NULL
 AND NOT EXISTS(SELECT 1 FROM private.memory_publication_delete_fences f WHERE f.user_id=m.owner_id AND f.card_id::text=k->>'id')));
SELECT jsonb_build_object('rows',(SELECT count(*) FROM private.memory_private_media),
 'ready',(SELECT count(*) FROM private.memory_private_media WHERE state='READY'),
 'nonReady',(SELECT count(*) FROM private.memory_private_media WHERE state<>'READY'),
 'operationSourceHashQuotaPreserved',NOT EXISTS(SELECT * FROM before_media EXCEPT SELECT id,operation_id,source_version,main_hash,thumb_hash,main_bytes,thumb_bytes FROM private.memory_private_media),
 'scope','Private manifests and card fences only; no restored entity deletion or Public rights replay claimed');
