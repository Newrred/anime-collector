-- Explicit own-creation declarations are not trusted reviews or third-party licenses.
alter table private.memory_public_image_rights
 add column evidence_kind text not null default 'TRUSTED' check(evidence_kind in ('TRUSTED','SELF_DECLARED')),
 add column declaration_policy text,
 add column declaration_source_hash text,
 add column declared_at timestamptz,
 alter column approved_at drop not null,
 add constraint memory_source_declaration_check check(evidence_kind='TRUSTED' or
  (image_type='USER_ORIGINAL' and approved_at is null and declared_at is not null
   and length(declaration_policy) between 1 and 120 and declaration_policy is not null
   and declaration_source_hash is not null and declaration_source_hash ~ '^[a-f0-9]{64}$'));
alter table private.memory_representation_public_rights
 add column evidence_kind text not null default 'TRUSTED' check(evidence_kind in ('TRUSTED','SELF_DECLARED')),
 add column declared_at timestamptz,
 alter column approved_at drop not null,
 add constraint memory_representation_declaration_check check(evidence_kind='TRUSTED' or
  (image_type='USER_ORIGINAL' and approved_at is null and declared_at is not null));

-- Every existing prepare/complete/preview/publish/read path already uses this helper.
create or replace function private.public_representation_rights_current(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.memory_public_assets a
 join private.memory_public_image_rights s on s.user_id=a.user_id and s.asset_id=a.source_asset_id and s.source_version=a.source_version
 cross join private.memory_publication_settings cfg
 where a.id=p_id and cfg.singleton and s.revoked_at is null
 and (s.evidence_kind='TRUSTED' or (s.declaration_source_hash=a.source_hash and s.declaration_policy=a.policy_revision
   and cfg.general_publication_policy_revision<>'UNCONFIGURED' and a.policy_revision=cfg.general_publication_policy_revision
   and a.policy_revision=cfg.policy_revision and a.policy_revision=cfg.content_policy_revision))
 and (a.private_representation_id is null or exists(select 1 from private.memory_representation_public_rights r
   where r.representation_id=a.private_representation_id and r.user_id=a.user_id
   and r.asset_id=a.source_asset_id and r.source_version=a.source_version
   and r.representation_hash=a.representation_hash and r.policy_revision=a.policy_revision and r.revoked_at is null
   and (r.evidence_kind='TRUSTED' or (cfg.general_publication_policy_revision<>'UNCONFIGURED'
    and a.policy_revision=cfg.general_publication_policy_revision and a.policy_revision=cfg.policy_revision
    and a.policy_revision=cfg.content_policy_revision)))))
$$;

create function public.reserve_memory_declared_public_asset(p_asset_id uuid,p_source_version bigint,p_operation_id uuid,
 p_policy_revision text,p_source_hash text,p_representation_id uuid,p_representation_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_publication_writer(); a public.memory_visual_assets; cfg private.memory_publication_settings;
 s private.memory_public_image_rights; r private.memory_representation_public_rights; m private.memory_private_media;
begin
 select * into cfg from private.memory_publication_settings where singleton for share;
 if not cfg.images_enabled then raise exception 'PUBLIC_IMAGE_DISABLED'; end if;
 if cfg.general_publication_policy_revision='UNCONFIGURED' or p_policy_revision is distinct from cfg.general_publication_policy_revision
  or p_policy_revision is distinct from cfg.policy_revision or p_policy_revision is distinct from cfg.content_policy_revision
 then raise exception 'CONSENT_MISMATCH'; end if;
 -- Match the existing account/source lock order. Failed reservation rolls back the declaration too.
 perform 1 from public.user_profiles where user_id=actor for update;
 if not found then raise exception 'AUTH_REQUIRED'; end if;
 select * into a from public.memory_visual_assets where user_id=actor and id=p_asset_id and version=p_source_version
  and asset_type='USER_IMAGE' and state='READY' and is_current and deleted_at is null for share;
 if not found or a.checksum_sha256 is null then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
 if p_representation_id is null then
  if p_representation_hash is not null or p_source_hash is distinct from a.checksum_sha256 then raise exception 'SOURCE_IMAGE_MISMATCH'; end if;
 else
  if p_source_hash is not null then raise exception 'SOURCE_IMAGE_MISMATCH'; end if;
  select * into m from private.memory_private_media where id=p_representation_id and owner_id=actor
   and asset_id=a.id and source_version=a.version and main_hash=p_representation_hash and state='READY' for share;
  if not found or not private.private_media_source(actor,a.id,a.version) then raise exception 'PUBLIC_VISUAL_NOT_READY'; end if;
 end if;
 select * into s from private.memory_public_image_rights where user_id=actor and asset_id=a.id and source_version=a.version for update;
 if found and s.revoked_at is not null then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
 -- Never overwrite trusted approvals, including their type, evidence and review timestamp.
 insert into private.memory_public_image_rights(user_id,asset_id,source_version,image_type,evidence_ref,approved_at,
  evidence_kind,declaration_policy,declaration_source_hash,declared_at)
 values(actor,a.id,a.version,'USER_ORIGINAL','OWN_CREATION_DECLARATION',null,'SELF_DECLARED',p_policy_revision,a.checksum_sha256,clock_timestamp())
 on conflict(user_id,asset_id,source_version) do update set declaration_policy=excluded.declaration_policy,
  declaration_source_hash=excluded.declaration_source_hash,declared_at=excluded.declared_at
 where memory_public_image_rights.evidence_kind='SELF_DECLARED';
 if p_representation_id is not null then
  select * into r from private.memory_representation_public_rights where representation_id=m.id for update;
  if found and (r.revoked_at is not null or r.user_id<>actor or r.asset_id<>a.id or r.source_version<>a.version
   or r.representation_hash<>m.main_hash) then raise exception 'IMAGE_RIGHTS_REQUIRED'; end if;
  insert into private.memory_representation_public_rights(representation_id,user_id,asset_id,source_version,representation_hash,
   policy_revision,image_type,evidence_ref,approved_at,evidence_kind,declared_at)
  values(m.id,actor,a.id,a.version,m.main_hash,p_policy_revision,'USER_ORIGINAL','OWN_CREATION_DECLARATION',null,'SELF_DECLARED',clock_timestamp())
  on conflict(representation_id) do update set policy_revision=excluded.policy_revision,declared_at=excluded.declared_at
  where memory_representation_public_rights.evidence_kind='SELF_DECLARED';
  return public.reserve_memory_public_asset_from_private(a.id,a.version,p_operation_id,p_policy_revision,m.id,m.main_hash);
 end if;
 return public.reserve_memory_public_asset(a.id,a.version,p_operation_id,p_policy_revision);
end $$;
revoke all on function public.reserve_memory_declared_public_asset(uuid,bigint,uuid,text,text,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.reserve_memory_declared_public_asset(uuid,bigint,uuid,text,text,uuid,text) to authenticated;
