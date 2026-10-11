-- Metadata only: safe state/identity plus row fingerprints, never free text.
-- Execute in the same readonly transaction as the private recovery journal.
select jsonb_build_object(
 'format','moemoa-public-recovery-state-v1','capturedAt',transaction_timestamp(),
 'snapshot',pg_current_snapshot()::text,
 'boards',coalesce((select jsonb_agg(jsonb_build_object('id',id,'ownerId',user_id,'deletedAt',deleted_at)) from public.memory_boards),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'user_id',t.user_id,'state',t.state,'hidden',t.hidden,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_publications t),'[]'::jsonb),
 'homes',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'user_id',t.user_id,'hidden',t.hidden,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_minihomes t),'[]'::jsonb),
 'publicCards',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'user_id',t.user_id,'card_id',t.card_id,'revoked',t.revoked,'hidden',t.hidden,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_public_cards t),'[]'::jsonb),
 'publicAssets',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'user_id',t.user_id,'card_id',t.card_id,'source_asset_id',t.source_asset_id,'source_version',t.source_version,'state',t.state,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_public_assets t),'[]'::jsonb),
 'rights',coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'asset_id',t.asset_id,'source_version',t.source_version,'revoked_at',t.revoked_at,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_public_image_rights t),'[]'::jsonb),
 'representationRights',coalesce((select jsonb_agg(jsonb_build_object('representation_id',t.representation_id,'user_id',t.user_id,'asset_id',t.asset_id,'source_version',t.source_version,'revoked_at',t.revoked_at,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_representation_public_rights t),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(jsonb_build_object('publication_id',t.publication_id,'rating',t.rating,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_content_reviews t),'[]'::jsonb),
 'homeReviews',coalesce((select jsonb_agg(jsonb_build_object('home_id',t.home_id,'rating',t.rating,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_home_content_reviews t),'[]'::jsonb),
 'restrictions',coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'hidden',t.hidden,'write_blocked',t.write_blocked,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_publication_accounts t),'[]'::jsonb),
 'sanctions',coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'active',t.active,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_account_sanctions t),'[]'::jsonb),
 'relationships',coalesce((select jsonb_agg(jsonb_build_object('owner_id',t.owner_id,'target_id',t.target_id,'following',t.following,'blocked',t.blocked,'fingerprint',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))) from private.memory_relationships t),'[]'::jsonb)
);
