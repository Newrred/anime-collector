-- Separate trusted evidence for the exact optimized input. No client self-approval.
create table private.memory_representation_public_rights (
 representation_id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 asset_id uuid not null, source_version bigint not null check(source_version>0),
 representation_hash text not null check(representation_hash ~ '^[a-f0-9]{64}$'),
 policy_revision text not null check(length(policy_revision) between 1 and 120),
 image_type text not null check(image_type in ('USER_ORIGINAL','LICENSED_IMAGE')),
 evidence_ref text not null check(length(evidence_ref) between 1 and 240),
 approved_at timestamptz not null default now(), revoked_at timestamptz
);
alter table private.memory_representation_public_rights enable row level security;
revoke all on private.memory_representation_public_rights from public,anon,authenticated;
alter table private.memory_public_assets add column private_representation_id uuid,
 add column representation_hash text,
 add constraint memory_public_representation_pair check(
  (private_representation_id is null and representation_hash is null) or
  (private_representation_id is not null and representation_hash is not null and representation_hash ~ '^[a-f0-9]{64}$'));

create function private.public_representation_rights_current(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.memory_public_assets a where a.id=p_id and
  (a.private_representation_id is null or exists(select 1 from private.memory_representation_public_rights r
   where r.representation_id=a.private_representation_id and r.user_id=a.user_id
    and r.asset_id=a.source_asset_id and r.source_version=a.source_version
    and r.representation_hash=a.representation_hash and r.policy_revision=a.policy_revision and r.revoked_at is null)))
$$;
revoke all on function private.public_representation_rights_current(uuid) from public,anon,authenticated;

-- Preserve the established reservation/rights/quota implementation, adding provenance to the response.
alter function public.reserve_memory_public_asset(uuid,bigint,uuid,text) set schema private;
alter function private.reserve_memory_public_asset(uuid,bigint,uuid,text) rename to reserve_memory_public_asset_original;
revoke all on function private.reserve_memory_public_asset_original(uuid,bigint,uuid,text) from public,anon,authenticated,service_role;
create function public.reserve_memory_public_asset(p_asset_id uuid,p_source_version bigint,p_operation_id uuid,p_policy_revision text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; a private.memory_public_assets;
begin
 result:=private.reserve_memory_public_asset_original(p_asset_id,p_source_version,p_operation_id,p_policy_revision);
 select * into strict a from private.memory_public_assets where id=(result->>'id')::uuid;
 if not private.public_representation_rights_current(a.id) then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
 return result||jsonb_build_object('privateRepresentationId',a.private_representation_id,'representationHash',a.representation_hash);
end $$;
revoke all on function public.reserve_memory_public_asset(uuid,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_memory_public_asset(uuid,bigint,uuid,text) to authenticated;

create function public.reserve_memory_public_asset_from_private(p_asset_id uuid,p_source_version bigint,p_operation_id uuid,
 p_policy_revision text,p_representation_id uuid,p_representation_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); m private.memory_private_media; result jsonb; a private.memory_public_assets;
begin
 if actor is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into m from private.memory_private_media where id=p_representation_id and owner_id=actor
  and asset_id=p_asset_id and source_version=p_source_version and main_hash=p_representation_hash and state='READY';
 if not found or not private.private_media_source(actor,p_asset_id,p_source_version) then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
 perform 1 from private.memory_representation_public_rights where representation_id=m.id and user_id=actor
  and asset_id=p_asset_id and source_version=p_source_version and representation_hash=m.main_hash
  and policy_revision=p_policy_revision and revoked_at is null;
 if not found then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
 result:=public.reserve_memory_public_asset(p_asset_id,p_source_version,p_operation_id,p_policy_revision);
 -- Take the established owner/source locks first, then pin the rendition and its approval.
 -- Recheck after obtaining locks: cancellation/revocation while waiting must roll back the reservation.
 perform 1 from private.memory_private_media where id=m.id and owner_id=actor and asset_id=p_asset_id
  and source_version=p_source_version and main_hash=p_representation_hash and state='READY' for share;
 if not found then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
 perform 1 from private.memory_representation_public_rights where representation_id=m.id and user_id=actor
  and asset_id=p_asset_id and source_version=p_source_version and representation_hash=m.main_hash
  and policy_revision=p_policy_revision and revoked_at is null for share;
 if not found then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
 select * into strict a from private.memory_public_assets where id=(result->>'id')::uuid for update;
 if a.private_representation_id is not null and (a.private_representation_id<>m.id or a.representation_hash<>m.main_hash)
   or (a.state='READY' and a.private_representation_id is null) then raise exception 'OPERATION_MISMATCH'; end if;
 update private.memory_public_assets set private_representation_id=m.id,representation_hash=m.main_hash where id=a.id;
 return result||jsonb_build_object('privateRepresentationId',m.id,'representationHash',m.main_hash);
end $$;
revoke all on function public.reserve_memory_public_asset_from_private(uuid,bigint,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_memory_public_asset_from_private(uuid,bigint,uuid,text,uuid,text) to authenticated;

alter function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) set schema private;
alter function private.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) rename to complete_memory_public_asset_original;
revoke all on function private.complete_memory_public_asset_original(uuid,text,text,integer,integer,integer,integer) from public,anon,authenticated,service_role;
create function public.complete_memory_public_asset(p_id uuid,p_full_hash text,p_thumb_hash text,p_full_bytes integer,p_thumb_bytes integer,p_width integer,p_height integer)
returns void language plpgsql security definer set search_path='' as $$
declare a private.memory_public_assets;
begin
 select * into a from private.memory_public_assets where id=p_id for update;
 if not found or not private.public_representation_rights_current(p_id) then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
 if a.private_representation_id is not null then
  perform 1 from private.memory_private_media where id=a.private_representation_id and owner_id=a.user_id
   and asset_id=a.source_asset_id and source_version=a.source_version and main_hash=a.representation_hash and state='READY' for share;
  if not found then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
  perform 1 from private.memory_representation_public_rights where representation_id=a.private_representation_id and user_id=a.user_id
   and asset_id=a.source_asset_id and source_version=a.source_version and representation_hash=a.representation_hash
   and policy_revision=a.policy_revision and revoked_at is null for share;
  if not found or not private.public_representation_rights_current(p_id) then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
 end if;
 perform private.complete_memory_public_asset_original(p_id,p_full_hash,p_thumb_hash,p_full_bytes,p_thumb_bytes,p_width,p_height);
end $$;
revoke all on function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.complete_memory_public_asset(uuid,text,text,integer,integer,integer,integer) to service_role;

alter function private.resolve_memory_public_visual(uuid,public.memory_visual_assets,text) rename to resolve_memory_public_visual_original;
create function private.resolve_memory_public_visual(p_user uuid,p_asset public.memory_visual_assets,p_anime text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.resolve_memory_public_visual_original(p_user,p_asset,p_anime);
 if result->>'type'='USER_IMAGE' and not private.public_representation_rights_current((result->>'assetId')::uuid) then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
 return result;
end $$;
revoke all on function private.resolve_memory_public_visual(uuid,public.memory_visual_assets,text) from public,anon,authenticated;

alter function private.memory_public_card_readable(uuid,jsonb) rename to memory_public_card_readable_original_representation;
create function private.memory_public_card_readable(p_user uuid,p_card jsonb) returns boolean
language sql stable security definer set search_path='' as $$
 select private.memory_public_card_readable_original_representation(p_user,p_card) and
  (p_card->'visual'->>'type'<>'USER_IMAGE' or private.public_representation_rights_current((p_card->'visual'->>'assetId')::uuid))
$$;
revoke all on function private.memory_public_card_readable(uuid,jsonb) from public,anon,authenticated;

alter function public.resolve_memory_image_preview(uuid,text) set schema private;
alter function private.resolve_memory_image_preview(uuid,text) rename to resolve_memory_image_preview_original;
revoke all on function private.resolve_memory_image_preview_original(uuid,text) from public,anon,authenticated,service_role;
create function public.resolve_memory_image_preview(p_asset_id uuid,p_variant text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.public_representation_rights_current(p_asset_id) then return null; end if;
 return private.resolve_memory_image_preview_original(p_asset_id,p_variant);
end $$;
revoke all on function public.resolve_memory_image_preview(uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_memory_image_preview(uuid,text) to authenticated;
