-- General-only, post-publication moderation. No remote policy/flag activation.
-- The operator must select a NEW matching publication/content policy revision
-- after deploying the corresponding consent UI. Existing snapshots are not opted in.
alter table private.memory_publication_settings
  add column general_publication_policy_revision text not null default 'UNCONFIGURED';
alter table private.memory_publications
  add column general_consent_hash text,
  add column general_consent_policy text;
alter table private.memory_minihomes
  add column general_consent_hash text,
  add column general_consent_policy text;

alter function public.publish_memory_publication(uuid,bigint,text,text,uuid) set schema private;
alter function private.publish_memory_publication(uuid,bigint,text,text,uuid) rename to publish_memory_publication_before_postmoderation;
revoke all on function private.publish_memory_publication_before_postmoderation(uuid,bigint,text,text,uuid) from public,anon,authenticated,service_role;
create function public.publish_memory_publication(p_id uuid,p_expected_revision bigint,p_review_hash text,p_policy_revision text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare settings private.memory_publication_settings; result jsonb; previous_operation uuid;
begin
 select * into settings from private.memory_publication_settings where singleton for share;
 if settings.general_publication_policy_revision <> 'UNCONFIGURED' then
  if p_policy_revision is distinct from settings.general_publication_policy_revision
   or p_policy_revision is distinct from settings.content_policy_revision
   or p_policy_revision is distinct from settings.policy_revision then raise exception 'CONSENT_MISMATCH'; end if;
  -- Serialize with moderator review, which locks this same publication row.
  select published_operation into previous_operation from private.memory_publications where id=p_id and user_id=auth.uid() for update;
  if found and exists(select 1 from private.memory_content_reviews where publication_id=p_id and rating <> 'GENERAL') then
   raise exception 'PUBLICATION_RESTRICTED';
  end if;
 end if;
 result:=private.publish_memory_publication_before_postmoderation(p_id,p_expected_revision,p_review_hash,p_policy_revision,p_operation_id);
 if settings.general_publication_policy_revision <> 'UNCONFIGURED' and previous_operation is distinct from p_operation_id then
  update private.memory_publications set general_consent_hash=encode(sha256(convert_to(published_snapshot::text,'UTF8')),'hex'),
   general_consent_policy=p_policy_revision where id=p_id and user_id=auth.uid() and published_snapshot is not null;
 end if;
 return result || jsonb_build_object('visible',public.read_memory_publication(p_id) is not null);
end $$;
revoke all on function public.publish_memory_publication(uuid,bigint,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.publish_memory_publication(uuid,bigint,text,text,uuid) to authenticated;

alter function public.publish_memory_minihome(bigint,text,text,uuid) set schema private;
alter function private.publish_memory_minihome(bigint,text,text,uuid) rename to publish_memory_minihome_before_postmoderation;
revoke all on function private.publish_memory_minihome_before_postmoderation(bigint,text,text,uuid) from public,anon,authenticated,service_role;
create function public.publish_memory_minihome(p_expected_revision bigint,p_review_hash text,p_policy_revision text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare settings private.memory_publication_settings; result jsonb; v_home_id uuid; previous_operation uuid;
begin
 select * into settings from private.memory_publication_settings where singleton for share;
 if settings.general_publication_policy_revision <> 'UNCONFIGURED' then
  if p_policy_revision is distinct from settings.general_publication_policy_revision
   or p_policy_revision is distinct from settings.content_policy_revision
   or p_policy_revision is distinct from settings.policy_revision then raise exception 'CONSENT_MISMATCH'; end if;
  select id,published_operation into v_home_id,previous_operation from private.memory_minihomes where user_id=auth.uid() for update;
  if exists(select 1 from private.memory_home_content_reviews where home_id=v_home_id and rating <> 'GENERAL') then
   raise exception 'PUBLICATION_RESTRICTED';
  end if;
 end if;
 result:=private.publish_memory_minihome_before_postmoderation(p_expected_revision,p_review_hash,p_policy_revision,p_operation_id);
 if settings.general_publication_policy_revision <> 'UNCONFIGURED' and previous_operation is distinct from p_operation_id then
  update private.memory_minihomes set general_consent_hash=encode(sha256(convert_to(published_selection::text,'UTF8')),'hex'),
   general_consent_policy=p_policy_revision where user_id=auth.uid() and published_selection is not null;
 end if;
 return result || jsonb_build_object('visible',public.read_memory_minihome((result->>'id')::uuid) is not null);
end $$;
revoke all on function public.publish_memory_minihome(bigint,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.publish_memory_minihome(bigint,text,text,uuid) to authenticated;

create or replace function public.read_memory_publication(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare settings private.memory_publication_settings;
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 select * into settings from private.memory_publication_settings where singleton;
 if settings.general_publication_policy_revision <> 'UNCONFIGURED' then
  if settings.general_publication_policy_revision is distinct from settings.policy_revision
   or settings.general_publication_policy_revision is distinct from settings.content_policy_revision then return null; end if;
  -- A blocked decision survives edits and policy changes; only a moderator can clear it.
  if exists(select 1 from private.memory_content_reviews where publication_id=p_id and rating <> 'GENERAL') then return null; end if;
  if not exists(select 1 from private.memory_publications p where p.id=p_id
   and p.general_consent_policy=settings.general_publication_policy_revision
   and p.general_consent_hash=encode(sha256(convert_to(p.published_snapshot::text,'UTF8')),'hex')) then return null; end if;
 else
  if not exists(select 1 from private.memory_publications p join private.memory_content_reviews r on r.publication_id=p.id
   where p.id=p_id and r.rating='GENERAL' and r.policy_revision=settings.content_policy_revision
   and r.snapshot_hash=encode(sha256(convert_to(p.published_snapshot::text,'UTF8')),'hex')) then return null; end if;
 end if;
 return private.read_memory_publication_before_content_review(p_id);
end $$;

create or replace function public.read_memory_minihome(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare settings private.memory_publication_settings;
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 select * into settings from private.memory_publication_settings where singleton;
 if settings.general_publication_policy_revision <> 'UNCONFIGURED' then
  if settings.general_publication_policy_revision is distinct from settings.policy_revision
   or settings.general_publication_policy_revision is distinct from settings.content_policy_revision then return null; end if;
  if exists(select 1 from private.memory_home_content_reviews where home_id=p_id and rating <> 'GENERAL') then return null; end if;
  if not exists(select 1 from private.memory_minihomes p where p.id=p_id
   and p.general_consent_policy=settings.general_publication_policy_revision
   and p.general_consent_hash=encode(sha256(convert_to(p.published_selection::text,'UTF8')),'hex')) then return null; end if;
 else
  if not exists(select 1 from private.memory_minihomes p join private.memory_home_content_reviews r on r.home_id=p.id
   where p.id=p_id and r.rating='GENERAL' and r.policy_revision=settings.content_policy_revision
   and r.snapshot_hash=encode(sha256(convert_to(p.published_selection::text,'UTF8')),'hex')) then return null; end if;
 end if;
 return private.read_memory_minihome_before_content_review(p_id);
end $$;

-- Existing tables already have RLS and no client grants. Consent is not a review:
-- no GENERAL decision/audit is inserted by publication. Moderator queue, notices,
-- appeals, source rights and the original reader's kill switches remain authoritative.

alter function public.get_memory_publication(uuid) set schema private;
alter function private.get_memory_publication(uuid) rename to get_memory_publication_before_postmoderation;
revoke all on function private.get_memory_publication_before_postmoderation(uuid) from public,anon,authenticated,service_role;
create function public.get_memory_publication(p_board_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.get_memory_publication_before_postmoderation(p_board_id);
 if result is null then return null; end if;
 return result || jsonb_build_object('visible',public.read_memory_publication((result->>'id')::uuid) is not null);
end $$;
revoke all on function public.get_memory_publication(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_memory_publication(uuid) to authenticated;

alter function public.get_memory_minihome() set schema private;
alter function private.get_memory_minihome() rename to get_memory_minihome_before_postmoderation;
revoke all on function private.get_memory_minihome_before_postmoderation() from public,anon,authenticated,service_role;
create function public.get_memory_minihome() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.get_memory_minihome_before_postmoderation();
 if result is null then return null; end if;
 return result || jsonb_build_object('visible',public.read_memory_minihome((result->>'id')::uuid) is not null);
end $$;
revoke all on function public.get_memory_minihome() from public,anon,authenticated,service_role;
grant execute on function public.get_memory_minihome() to authenticated;

create or replace function private.notify_memory_content_review() returns trigger
language plpgsql security definer set search_path='' as $$
declare target_owner uuid; notice_reason text;
begin
 if new.target_kind='board' then select user_id into target_owner from private.memory_publications where id=new.target_id;
 else select user_id into target_owner from private.memory_minihomes where id=new.target_id; end if;
 if target_owner is null then raise exception 'NOT_FOUND'; end if;
 new.case_id:=gen_random_uuid();
 notice_reason:=case new.rating when 'GENERAL' then 'Reviewed as general content.'
  when 'MATURE' then 'Adult content is not available for public sharing under the current policy.'
  else 'This content is outside the current public content policy.' end;
 insert into private.memory_reports(id,reporter,operation_id,target_kind,target_id,category,note,status)
 values(new.case_id,null,gen_random_uuid(),new.target_kind,new.target_id,'SAFETY','','CLOSED');
 insert into private.memory_moderation_notices(case_id,recipient,action,reason,target_kind,target_id)
 values(new.case_id,target_owner,'CONTENT_'||new.rating,notice_reason,new.target_kind,new.target_id);
 insert into private.memory_moderation_audit(case_id,actor,action,reason,case_revision,target_revision)
 values(new.case_id,new.actor,'CONTENT_'||new.rating,notice_reason,0,new.revision);
 return new;
end $$;
