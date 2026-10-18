-- Partial card withdrawal clears the publish retry token while preserving the
-- remaining public snapshot. That token alone is not a publication-history test.
-- Keep the old operation path (including previously published withdrawn targets),
-- home admission, report quotas, idempotency, locking and existing function ACLs.
create or replace function public.submit_memory_report(p_kind text,p_target uuid,p_category text,p_operation uuid,p_note text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r private.memory_reports; quota integer;
begin
 if u is null then raise exception 'AUTH_REQUIRED'; end if;
 perform set_config('response.headers','[{"Cache-Control":"no-store"}]',true);
 if p_kind is null or p_kind not in ('home','board') or p_category is null or p_category not in ('SAFETY','RIGHTS','SPAM','OTHER') or p_operation is null or p_note is null or length(p_note)>1000 then raise exception 'INVALID_SELECTION'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('report:'||u::text,0));
 select * into r from private.memory_reports where reporter=u and operation_id=p_operation;
 if found then
  if r.target_kind<>p_kind or r.target_id is distinct from p_target or r.category<>p_category or r.note<>p_note then raise exception 'OPERATION_MISMATCH'; end if;
  return jsonb_build_object('id',r.id,'status',r.status);
 end if;
 select * into r from private.memory_reports where reporter=u and target_kind=p_kind and target_id=p_target and category=p_category and status in ('RECEIVED','APPEALED') order by created_at desc limit 1;
 if found then return jsonb_build_object('id',r.id,'status',r.status); end if;
 select report_daily_limit into quota from private.memory_publication_settings where reports_enabled;
 if quota is null then raise exception 'PUBLICATION_DISABLED'; end if;
 if (select count(*) from private.memory_reports where reporter=u and created_at>now()-interval '24 hours')>=quota then raise exception 'RATE_LIMITED'; end if;
 if not (case when p_kind='home' then exists(select 1 from private.memory_minihomes where id=p_target and published_operation is not null)
 else exists(select 1 from private.memory_publications where id=p_target and (
  published_operation is not null
  or (state in ('PUBLISHED','PREPARING') and published_snapshot is not null)
 )) end) then raise exception 'NOT_FOUND'; end if;
 insert into private.memory_reports(reporter,operation_id,target_kind,target_id,category,note) values(u,p_operation,p_kind,p_target,p_category,p_note) returning * into r;
 return jsonb_build_object('id',r.id,'status',r.status);
end $$;
