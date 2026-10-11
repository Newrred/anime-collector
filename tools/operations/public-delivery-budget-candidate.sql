-- W15/D03 candidate; no hosted authorization implied. Default: transaction ROLLBACK.
-- Commit only after exact target approval: psql -X -v ON_ERROR_STOP=1 -v apply_delivery_budget=true -f ...
-- Prerequisite: verified deployed sized-delivery flag=true; SQL cannot inspect Vercel.
\set ON_ERROR_STOP on
\if :{?apply_delivery_budget}
\else
\set apply_delivery_budget false
\endif
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE private.memory_resource_policies IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE private.memory_resource_overrides IN SHARE MODE;
DO $$ BEGIN
 IF to_regprocedure('public.authorize_memory_sized_image_delivery(uuid,text,text,text)') IS NULL THEN
  RAISE EXCEPTION 'SIZED_DELIVERY_DEPENDENCY_REQUIRED'; END IF;
 IF (SELECT count(*) FROM private.memory_resource_policies WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES')
  AND NOT enabled AND NOT paused AND daily_limit=0)<>2 THEN
  RAISE EXCEPTION 'DELIVERY_BASELINE_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM private.memory_resource_overrides
  WHERE actor='00000000-0000-0000-0000-000000000000' AND scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES') AND expires_at>now()) THEN
  RAISE EXCEPTION 'ACTIVE_DELIVERY_OVERRIDE'; END IF;
END $$;
UPDATE private.memory_resource_policies SET enabled=true,
 daily_limit=CASE scope WHEN 'IMAGE_DELIVERY' THEN 2000 ELSE 64000000 END
 WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
SELECT scope,enabled,paused,daily_limit,live_limit FROM private.memory_resource_policies
 WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES') ORDER BY scope;
\if :apply_delivery_budget
COMMIT;
\else
ROLLBACK;
\endif
