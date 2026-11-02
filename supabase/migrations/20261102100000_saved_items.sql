-- Saved (phase-10b, DECISIONS T-5 / T-46): a signed-in visitor's hearted places, stays and eateries.
-- Own rows only. entity_id is polymorphic (no FK), like reviews; /api/saved only inserts published listings.
create table public.saved_items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type public.entity_type not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

alter table public.saved_items enable row level security;
create policy "own read" on public.saved_items for select to authenticated using (user_id = auth.uid());
create policy "own insert" on public.saved_items for insert to authenticated with check (user_id = auth.uid());
create policy "own delete" on public.saved_items for delete to authenticated using (user_id = auth.uid());
revoke all on public.saved_items from anon;
