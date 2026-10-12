-- Serialize this owner's publication mutations with privacy changes. A prepare/publish
-- already in flight must finish before withdrawal inspects and invalidates its snapshot.
alter function public.prepare_memory_publication(uuid,bigint,jsonb) rename to prepare_memory_publication_before_card_privacy_lock;
alter function public.prepare_memory_publication_before_card_privacy_lock(uuid,bigint,jsonb) set schema private;
alter function public.publish_memory_publication(uuid,bigint,text,text,uuid) rename to publish_memory_publication_before_card_privacy_lock;
alter function public.publish_memory_publication_before_card_privacy_lock(uuid,bigint,text,text,uuid) set schema private;
revoke all on function private.prepare_memory_publication_before_card_privacy_lock(uuid,bigint,jsonb),
 private.publish_memory_publication_before_card_privacy_lock(uuid,bigint,text,text,uuid) from public,anon,authenticated,service_role;
create function private.lock_memory_card_sharing() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('memory-card-sharing:'||auth.uid()::text,0));
end $$;
revoke all on function private.lock_memory_card_sharing() from public,anon,authenticated;
create function public.prepare_memory_publication(p_board_id uuid,p_expected_revision bigint,p_selection jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform private.lock_memory_card_sharing();return private.prepare_memory_publication_before_card_privacy_lock(p_board_id,p_expected_revision,p_selection);end $$;
create function public.publish_memory_publication(p_id uuid,p_expected_revision bigint,p_review_hash text,p_policy_revision text,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin perform private.lock_memory_card_sharing();return private.publish_memory_publication_before_card_privacy_lock(p_id,p_expected_revision,p_review_hash,p_policy_revision,p_operation_id);end $$;
revoke all on function public.prepare_memory_publication(uuid,bigint,jsonb),public.publish_memory_publication(uuid,bigint,text,text,uuid) from public,anon,authenticated;
grant execute on function public.prepare_memory_publication(uuid,bigint,jsonb),public.publish_memory_publication(uuid,bigint,text,text,uuid) to authenticated;

-- CARD-PUBLIC-SIMPLE-01. Additive owner-only APIs; no flag or policy changes.
-- Reversible privacy removes current snapshots; permanent retirement/moderation fences remain intact.
create function public.get_memory_card_sharing(p_card_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); pc private.memory_public_cards%rowtype; n integer; v integer;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 if not exists(select 1 from public.memory_cards where user_id=u and id=p_card_id and deleted_at is null) then raise exception 'NOT_FOUND'; end if;
 select * into pc from private.memory_public_cards where user_id=u and card_id=p_card_id;
 select count(*),count(*) filter(where exists(select 1 from jsonb_array_elements(public.read_memory_publication(p.id)->'cards') visible_card where visible_card->>'id'=pc.id::text))
 into n,v from private.memory_publications p cross join lateral jsonb_array_elements(p.published_snapshot->'cards') c
 where p.user_id=u and c.value->>'id'=pc.id::text and p.state in ('PUBLISHED','PREPARING');
 return jsonb_build_object('published',n>0,'visible',v>0,'restricted',coalesce(pc.revoked or pc.hidden,false));
end $$;
create function public.make_memory_card_private(p_card_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); pc uuid; p private.memory_publications%rowtype; remaining jsonb; snapshot jsonb; affected integer:=0;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 perform private.lock_memory_card_sharing();
 perform 1 from public.memory_cards where user_id=u and id=p_card_id and deleted_at is null for update;
 if not found then raise exception 'NOT_FOUND'; end if;
 select id into pc from private.memory_public_cards where user_id=u and card_id=p_card_id for update;
 if pc is null then return jsonb_build_object('published',false,'affected',0); end if;
 for p in select * from private.memory_publications
 where user_id=u and (published_snapshot->'cards' @> jsonb_build_array(jsonb_build_object('id',pc))
   or selection->'cards' @> jsonb_build_array(jsonb_build_object('cardId',p_card_id))) order by id for update loop
   select coalesce(jsonb_agg(c.value order by c.ordinality),'[]'::jsonb) into remaining
     from jsonb_array_elements(p.published_snapshot->'cards') with ordinality c(value,ordinality) where c.value->>'id'<>pc::text;
   snapshot:=case when jsonb_array_length(remaining)>0 then jsonb_set(p.published_snapshot,'{cards}',remaining) else null end;
   update private.memory_publications set revision=revision+1,state=case when snapshot is null then 'REVOKED' else 'PUBLISHED' end,
     -- Removing a subset cannot broaden the owner's existing consent. Carry forward only a valid binding.
     general_consent_hash=case when snapshot is not null and p.general_consent_hash=encode(sha256(convert_to(p.published_snapshot::text,'UTF8')),'hex')
       then encode(sha256(convert_to(snapshot::text,'UTF8')),'hex') else null end,
     published_snapshot=snapshot,preview=null,preview_hash=null,selection=null,
     published_operation=null,published_hash=null,published_revision=null where id=p.id;
   affected:=affected+1;
 end loop;
 return jsonb_build_object('published',false,'affected',affected);
end $$;
revoke all on function public.get_memory_card_sharing(uuid),public.make_memory_card_private(uuid) from public,anon,authenticated;
grant execute on function public.get_memory_card_sharing(uuid),public.make_memory_card_private(uuid) to authenticated;
