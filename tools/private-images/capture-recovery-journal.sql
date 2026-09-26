-- Run only against an explicitly selected authorized database. Redirect stdout
-- to protected temporary input for backup-cli; never to ordinary CI logs.
-- No notes, titles, email addresses, tokens, credentials or image bytes.
-- This is a current-state recovery snapshot, not a durable change feed.
-- Keep collecting after the older DB backup; verify completeness before serving.
\set QUIET on
\pset format unaligned
\pset tuples_only on
begin isolation level repeatable read read only;
select jsonb_build_object(
  'format','moemoa-private-recovery-journal-v1',
  'capturedAt',transaction_timestamp(),
  'snapshot',pg_current_snapshot()::text,
  'accounts',coalesce((select jsonb_agg(id order by id) from auth.users),'[]'::jsonb),
  'cards',coalesce((select jsonb_agg(jsonb_build_object('id',id,'ownerId',user_id,'deletedAt',deleted_at) order by id) from public.memory_cards),'[]'::jsonb),
  'assets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'ownerId',user_id,'cardId',card_id,'version',version,'current',is_current,'state',state,'deletedAt',deleted_at) order by id) from public.memory_visual_assets),'[]'::jsonb),
  'cardFences',coalesce((select jsonb_agg(to_jsonb(f) order by user_id,card_id) from private.memory_publication_delete_fences f),'[]'::jsonb),
  'cancelled',coalesce((select jsonb_agg(to_jsonb(c) order by owner_id,operation_id) from private.memory_private_media_cancelled c),'[]'::jsonb),
  'media',coalesce((select jsonb_agg(to_jsonb(m) order by id) from private.memory_private_media m),'[]'::jsonb)
 );
commit;
