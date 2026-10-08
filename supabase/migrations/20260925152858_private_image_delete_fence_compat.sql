-- The private-image boundary also runs on the selective production schema,
-- where publication remains disabled and the publication migrations have not
-- been applied. Preserve its deletion fence without enabling publication.
-- On a full migration replay, source-status created this identical table first.
create table if not exists private.memory_publication_delete_fences (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null,
  primary key(user_id,card_id)
);
alter table private.memory_publication_delete_fences enable row level security;
revoke all on private.memory_publication_delete_fences from public,anon,authenticated;
