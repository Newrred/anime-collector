-- Only executed inside run-public-capacity-local.sh's disposable socket-only DB.
\set ON_ERROR_STOP on
CREATE OR REPLACE FUNCTION pg_temp.ok(v boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF v IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF; RAISE NOTICE 'PASS: %',label; END $$;
UPDATE private.memory_resource_policies SET enabled=false,paused=false,daily_limit=0
 WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
UPDATE private.memory_resource_policies SET live_limit=123 WHERE scope='IMAGE_DELIVERY';
DELETE FROM private.memory_resource_usage WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
CREATE TEMP TABLE unchanged_policies AS SELECT * FROM private.memory_resource_policies WHERE scope NOT IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
CREATE TEMP TABLE unchanged_public AS SELECT to_jsonb(t) AS row FROM private.memory_publication_settings t;
\unset apply_delivery_budget
\ir public-delivery-budget-candidate.sql
SELECT pg_temp.ok((SELECT bool_and(NOT enabled AND daily_limit=0) FROM private.memory_resource_policies WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES')),'candidate default dry-run leaves policies disabled');
\set apply_delivery_budget true
\ir public-delivery-budget-candidate.sql
SELECT pg_temp.ok((SELECT daily_limit=2000 AND enabled AND live_limit=123 FROM private.memory_resource_policies WHERE scope='IMAGE_DELIVERY') AND (SELECT daily_limit=64000000 AND enabled FROM private.memory_resource_policies WHERE scope='IMAGE_DELIVERY_BYTES'),'exact candidate applied; live limit preserved');
SELECT set_config('request.jwt.claim.role','service_role',false);
INSERT INTO private.memory_resource_usage(actor,scope,window_day,used) VALUES
 ('00000000-0000-0000-0000-000000000000','IMAGE_DELIVERY',(now() AT TIME ZONE 'UTC')::date,1999),
 ('00000000-0000-0000-0000-000000000000','IMAGE_DELIVERY_BYTES',(now() AT TIME ZONE 'UTC')::date,100);
SELECT public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111','full','22222222-2222-4222-8222-222222222222/full.webp',repeat('b',64));
SELECT pg_temp.ok((SELECT used=2000 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY') AND (SELECT used=500 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY_BYTES'),'2000th GET allowed and reserves actual 400-byte full');
DO $$ BEGIN PERFORM public.authorize_memory_image_delivery(1); RAISE EXCEPTION 'FAIL request cap'; EXCEPTION WHEN OTHERS THEN IF sqlerrm<>'RATE_LIMITED' THEN RAISE; END IF; END $$;
SELECT pg_temp.ok((SELECT used=2000 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY') AND (SELECT used=500 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY_BYTES'),'2001st GET rejected without byte charge');
UPDATE private.memory_resource_usage SET used=CASE scope WHEN 'IMAGE_DELIVERY' THEN 10 ELSE 63999958 END;
SELECT public.authorize_memory_sized_image_delivery('11111111-1111-4111-8111-111111111111','thumb','22222222-2222-4222-8222-222222222222/thumb.webp',repeat('c',64));
SELECT pg_temp.ok((SELECT used=64000000 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY_BYTES'),'42-byte thumb reaches exact 64MB cap');
DO $$ BEGIN PERFORM public.authorize_memory_image_delivery(1); RAISE EXCEPTION 'FAIL byte cap'; EXCEPTION WHEN OTHERS THEN IF sqlerrm<>'RATE_LIMITED' THEN RAISE; END IF; END $$;
SELECT pg_temp.ok((SELECT used=11 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY') AND (SELECT used=64000000 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY_BYTES'),'64MB plus one rejected; request increment rolled back');
UPDATE private.memory_resource_usage SET window_day=(now() AT TIME ZONE 'UTC')::date-1;
SELECT public.authorize_memory_image_delivery(42);
SELECT pg_temp.ok((SELECT used=1 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY') AND (SELECT used=42 AND window_day=(now() AT TIME ZONE 'UTC')::date FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY_BYTES'),'previous UTC day resets counters on next request');
\set apply_delivery_budget false
\ir public-delivery-budget-rollback.sql
SELECT pg_temp.ok((SELECT bool_and(enabled) FROM private.memory_resource_policies WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES')),'rollback default dry-run retains active candidate');
\set apply_delivery_budget true
\ir public-delivery-budget-rollback.sql
SELECT pg_temp.ok((SELECT bool_and(NOT enabled AND daily_limit=0) FROM private.memory_resource_policies WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES')) AND (SELECT used=42 FROM private.memory_resource_usage WHERE scope='IMAGE_DELIVERY_BYTES') AND (SELECT live_limit=123 FROM private.memory_resource_policies WHERE scope='IMAGE_DELIVERY'),'rollback restores baseline without clearing usage/live limit');
SELECT pg_temp.ok(NOT EXISTS((SELECT * FROM unchanged_policies EXCEPT SELECT * FROM private.memory_resource_policies) UNION ALL (SELECT * FROM private.memory_resource_policies WHERE scope NOT IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES') EXCEPT SELECT * FROM unchanged_policies)) AND NOT EXISTS((SELECT row FROM unchanged_public EXCEPT SELECT to_jsonb(t) FROM private.memory_publication_settings t) UNION ALL (SELECT to_jsonb(t) FROM private.memory_publication_settings t EXCEPT SELECT row FROM unchanged_public)),'other policies and Public configuration preserved');
