-- Exact candidate rollback; default dry-run. Disable public reads first for production rollback.
-- Preserve all usage and live limits; never refund consumed traffic.
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
 IF (SELECT count(*) FROM private.memory_resource_policies WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES')
  AND enabled AND NOT paused AND daily_limit=CASE scope WHEN 'IMAGE_DELIVERY' THEN 2000 ELSE 64000000 END)<>2 THEN
  RAISE EXCEPTION 'DELIVERY_CANDIDATE_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM private.memory_resource_overrides
  WHERE actor='00000000-0000-0000-0000-000000000000' AND scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES') AND expires_at>now()) THEN
  RAISE EXCEPTION 'ACTIVE_DELIVERY_OVERRIDE'; END IF;
END $$;
UPDATE private.memory_resource_policies SET enabled=false,daily_limit=0
 WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES');
SELECT scope,enabled,paused,daily_limit,live_limit FROM private.memory_resource_policies
 WHERE scope IN ('IMAGE_DELIVERY','IMAGE_DELIVERY_BYTES') ORDER BY scope;
\if :apply_delivery_budget
COMMIT;
\else
ROLLBACK;
\endif
