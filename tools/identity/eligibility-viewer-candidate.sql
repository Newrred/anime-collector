-- LOCAL prototype only. MATURE_VIEW policy defaults off; no identity grants issued here.
-- PostgREST must supply verified JWT claims. Clients cannot supply a separate viewer id.
create function private.memory_publisher_allowed(p_owner uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.memory_eligibility_evidence e
 join private.memory_eligibility_policies p on p.purpose=e.purpose
 where e.user_id=p_owner and e.purpose='PUBLIC_PUBLISH' and e.state='GRANTED'
 and e.expires_at>clock_timestamp() and p.enabled and p.revision<>'UNCONFIGURED'
 and e.policy_revision=p.revision)
$$;
revoke all on function private.memory_publisher_allowed(uuid) from public,anon,authenticated,service_role;
create function private.memory_mature_viewer_allowed() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=nullif(current_setting('request.jwt.claims',true),'')::jsonb;
 actor uuid:=auth.uid(); sid text:=claims->>'session_id';
begin
 if actor is null or claims->>'sub' is distinct from actor::text
  or claims->>'role' is distinct from 'authenticated'
  or claims->>'is_anonymous' is distinct from 'false'
  or sid is null or sid !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' then return false; end if;
 if (claims->>'exp')::numeric<=extract(epoch from clock_timestamp()) then return false; end if;
 return exists(select 1 from auth.sessions s
  join private.memory_eligibility_evidence e on e.user_id=s.user_id and e.purpose='MATURE_VIEW'
  join private.memory_eligibility_policies p on p.purpose=e.purpose
  where s.id=sid::uuid and s.user_id=actor and (s.not_after is null or s.not_after>clock_timestamp())
  and p.enabled and p.revision<>'UNCONFIGURED' and e.policy_revision=p.revision
  and e.state='GRANTED' and e.expires_at>clock_timestamp());
end $$;
revoke all on function private.memory_mature_viewer_allowed() from public,anon,authenticated,service_role;

create or replace function public.read_memory_publication(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if not exists(select 1 from private.memory_publications p join private.memory_content_reviews r on r.publication_id=p.id
  where p.id=p_id and private.memory_publisher_allowed(p.user_id)
  and (r.rating='GENERAL' or (r.rating='MATURE' and private.memory_mature_viewer_allowed()))
  and r.policy_revision=(select content_policy_revision from private.memory_publication_settings)
  and r.snapshot_hash=encode(sha256(convert_to(p.published_snapshot::text,'UTF8')),'hex')) then return null; end if;
 return private.read_memory_publication_before_content_review(p_id);
end $$;
create or replace function public.read_memory_minihome(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if not exists(select 1 from private.memory_minihomes p join private.memory_home_content_reviews r on r.home_id=p.id
  where p.id=p_id and private.memory_publisher_allowed(p.user_id)
  and (r.rating='GENERAL' or (r.rating='MATURE' and private.memory_mature_viewer_allowed()))
  and r.policy_revision=(select content_policy_revision from private.memory_publication_settings)
  and r.snapshot_hash=encode(sha256(convert_to(p.published_selection::text,'UTF8')),'hex')) then return null; end if;
 return private.read_memory_minihome_before_content_review(p_id);
end $$;
-- Existing image resolver remains service-only. A verified server viewer context
-- must be connected separately; never expose storage coordinates through a client RPC.
create function public.resolve_memory_viewer_image(p_publication_id uuid,p_asset_id uuid,p_variant text,p_viewer uuid,p_session uuid,p_expires bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prior_claims text:=current_setting('request.jwt.claims',true);
 prior_sub text:=current_setting('request.jwt.claim.sub',true); result jsonb;
begin
 if p_viewer is null or p_session is null or p_expires is null or p_expires<=extract(epoch from clock_timestamp())
  or not exists(select 1 from auth.sessions where id=p_session and user_id=p_viewer and (not_after is null or not_after>clock_timestamp())) then return null; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_viewer,'session_id',p_session,'role','authenticated','is_anonymous',false,'exp',p_expires)::text,true);
 perform set_config('request.jwt.claim.sub',p_viewer::text,true);
 result:=public.resolve_memory_public_image(p_publication_id,p_asset_id,p_variant);
 perform set_config('request.jwt.claims',coalesce(prior_claims,''),true);
 perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
 return result;
end $$;
revoke all on function public.resolve_memory_viewer_image(uuid,uuid,text,uuid,uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.resolve_memory_viewer_image(uuid,uuid,text,uuid,uuid,bigint) to service_role;
