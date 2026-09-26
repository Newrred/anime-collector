-- Local integration only. Existing validators and mutation implementation remain intact.
alter function private.apply_memory_mutation(uuid,uuid,uuid,text,uuid,text,bigint,text,jsonb)
 rename to apply_memory_mutation_without_eligibility;
create function private.apply_memory_mutation(
 p_user_id uuid,p_operation_id uuid,p_device_id uuid,p_entity_type text,p_entity_id uuid,
 p_operation_type text,p_base_version bigint,p_request_hash text,p_payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare guarded boolean; result jsonb;
begin
 -- A recorded result (including rejected replay) does not create a new write.
 guarded:=p_operation_type in ('UPSERT','RESOLVE_CONFLICT')
    and private.replay_memory_operation(p_operation_id,p_user_id,p_request_hash) is null;
 if guarded then
   perform private.require_memory_eligibility(p_user_id,'CLOUD_WRITE');
 end if;
 result:=private.apply_memory_mutation_without_eligibility(
   p_user_id,p_operation_id,p_device_id,p_entity_type,p_entity_id,
   p_operation_type,p_base_version,p_request_hash,p_payload);
 if guarded then perform private.require_memory_eligibility(p_user_id,'CLOUD_WRITE');end if;
 return result;
end $$;
revoke all on function private.apply_memory_mutation(uuid,uuid,uuid,text,uuid,text,bigint,text,jsonb),
 private.apply_memory_mutation_without_eligibility(uuid,uuid,uuid,text,uuid,text,bigint,text,jsonb)
 from public,anon,authenticated,service_role;

alter function public.promote_guest_memory(uuid,uuid,text,text,jsonb) rename to promote_guest_memory_without_eligibility;
revoke all on function public.promote_guest_memory_without_eligibility(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
create function public.promote_guest_memory(p_operation_id uuid,p_device_id uuid,p_guest_owner_id text,p_source_hash text,p_bundle jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_memory_user(); guarded boolean; result jsonb;
begin
 guarded:=not exists(select 1 from public.user_account_promotions where user_id=actor and guest_owner_id=p_guest_owner_id);
 if guarded then
   perform private.require_memory_eligibility(actor,'CLOUD_WRITE');
 end if;
 result:=public.promote_guest_memory_without_eligibility(p_operation_id,p_device_id,p_guest_owner_id,p_source_hash,p_bundle);
 if guarded then perform private.require_memory_eligibility(actor,'CLOUD_WRITE');end if;
 return result;
end $$;
revoke all on function public.promote_guest_memory(uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.promote_guest_memory(uuid,uuid,text,text,jsonb) to authenticated;
