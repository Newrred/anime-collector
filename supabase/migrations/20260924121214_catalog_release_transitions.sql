-- Candidate activation and rollback share validation; no rows or cover revisions are deleted.
create function public.activate_catalog_release_checked(requested_release_id text, requested_release_hash text, expected_active_release_id text)
returns void language plpgsql security invoker set search_path='' as $$
declare candidate public.catalog_releases; current_id text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-release-transition',0));
 select release_id into current_id from public.catalog_active_release where singleton;
 select * into candidate from public.catalog_releases where id=requested_release_id and release_hash=requested_release_hash for update;
 if not found or candidate.target_count=0 then raise exception 'CATALOG_RELEASE_INVALID'; end if;
 -- A lost successful response is safely replayed even with the original expected predecessor.
 if current_id=requested_release_id and candidate.status='ACTIVE' then return; end if;
 if current_id is distinct from expected_active_release_id then raise exception 'CATALOG_RELEASE_CONFLICT'; end if;
 if candidate.status not in ('STAGING','RETIRED') then raise exception 'CATALOG_RELEASE_INVALID'; end if;
 -- Also block concurrent trusted uploader mutations while checking the complete candidate.
 lock table public.catalog_assets,public.catalog_anime_search,public.catalog_anime_details,public.catalog_anime_people in share mode;
 if (select count(*) from public.catalog_anime_search where release_id=requested_release_id)<>candidate.target_count
 or (select count(*) from public.catalog_anime_details where release_id=requested_release_id)<>candidate.target_count
 or (select count(*) from public.catalog_assets where release_id=requested_release_id)<>candidate.target_count
 or (select count(*) from public.catalog_assets a where a.release_id=requested_release_id and exists(select 1 from storage.objects o where o.bucket_id=a.bucket_id and o.name=a.object_path))<>candidate.target_count
 then raise exception 'CATALOG_RELEASE_INCOMPLETE'; end if;
 if (select count(*) from public.catalog_anime_people where release_id=requested_release_id)<>candidate.people_page_count then raise exception 'CATALOG_RELEASE_PEOPLE_INCOMPLETE'; end if;
 -- Covers must belong to the same title; row-count equality alone is insufficient.
 if exists(select 1 from public.catalog_anime_search s join public.catalog_assets a on a.release_id=s.release_id and a.asset_id=s.cover_asset_id where s.release_id=requested_release_id and s.anime_id<>a.anime_id)
 then raise exception 'CATALOG_RELEASE_IDENTITY_INVALID'; end if;
 update public.catalog_releases set status='RETIRED' where status='ACTIVE' and id<>requested_release_id;
 update public.catalog_releases set status='ACTIVE',activated_at=now() where id=requested_release_id;
 insert into public.catalog_active_release(singleton,release_id,updated_at) values(true,requested_release_id,now())
 on conflict(singleton) do update set release_id=excluded.release_id,updated_at=excluded.updated_at;
end $$;
revoke all on function public.activate_catalog_release_checked(text,text,text) from public,anon,authenticated;
grant execute on function public.activate_catalog_release_checked(text,text,text) to service_role;

-- Compatibility for existing trusted callers, serialized but without an operator-supplied predecessor.
create or replace function public.activate_catalog_release(requested_release_id text,requested_release_hash text)
returns void language plpgsql security invoker set search_path='' as $$
declare predecessor text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-release-transition',0));
 select release_id into predecessor from public.catalog_active_release where singleton;
 perform public.activate_catalog_release_checked(requested_release_id,requested_release_hash,predecessor);
end $$;
revoke all on function public.activate_catalog_release(text,text) from public,anon,authenticated;
grant execute on function public.activate_catalog_release(text,text) to service_role;
