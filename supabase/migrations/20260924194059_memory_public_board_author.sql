-- A separate reader avoids recursive board -> home -> board snapshot construction.
create function public.read_memory_publication_author(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare home_id uuid; snapshot jsonb;
begin
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if public.read_memory_publication(p_id) is null then return null; end if;
 select h.id into home_id from private.memory_publications p join private.memory_minihomes h on h.user_id=p.user_id where p.id=p_id;
 if home_id is null then return null; end if;
 snapshot:=public.read_memory_minihome(home_id);
 if snapshot is null then return null; end if;
 return jsonb_build_object('id',home_id,'nickname',snapshot->>'nickname');
end $$;
revoke all on function public.read_memory_publication_author(uuid) from public,anon,authenticated;
grant execute on function public.read_memory_publication_author(uuid) to anon,authenticated;
