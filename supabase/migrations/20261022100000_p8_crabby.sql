-- P8: Crabby daily cap, action previews, AI review pre-screen flags, place similarity (pgvector).

insert into public.app_config (key, value, notes) values
  ('ai_daily_cap', '20', 'P8: Crabby messages per user per IST day (BACKEND §11.5)');

-- ---------------------------------------------------------------- daily cap (BACKEND §11.5)
-- Counts one message for the caller on today's IST date; refuses past the cap (errcode CW429).
create function public.ai_take_message() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cap integer := coalesce((select value::integer from public.app_config where key = 'ai_daily_cap'), 20);
  today date := (now() at time zone 'Asia/Kolkata')::date;
  used integer;
begin
  if auth.uid() is null then
    raise exception 'sign in' using errcode = '42501';
  end if;
  insert into public.ai_usage (user_id, date, message_count) values (auth.uid(), today, 0)
  on conflict (user_id, date) do nothing;
  update public.ai_usage set message_count = message_count + 1, updated_at = now()
  where user_id = auth.uid() and date = today and message_count < cap
  returning message_count into used;
  if used is null then
    raise exception 'daily cap reached' using errcode = 'CW429';
  end if;
  return cap - used;
end;
$$;
revoke execute on function public.ai_take_message from anon;

-- ---------------------------------------------------------------- action previews (BACKEND §11.3)
-- Server inserts proposals with the user's session; the user applies or discards them.
create policy "own propose" on public.ai_actions for insert
  with check (user_id = auth.uid() and status = 'proposed');
create policy "own decide" on public.ai_actions for update
  using (user_id = auth.uid() and status = 'proposed')
  with check (user_id = auth.uid() and status in ('applied', 'discarded'));

-- ---------------------------------------------------------------- review pre-screen (PLAN P8 task 9)
-- The model only flags; reviewers still approve/reject. Authors can't set or keep a flag on edit.
alter table public.reviews
  add column ai_flag text check (ai_flag in ('ok', 'flagged')),
  add column ai_reason text check (char_length(ai_reason) <= 200);

create function app.guard_review_ai_flag() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not (app.has_role('reviewer') or app.is_admin()) then
    if tg_op = 'INSERT' or new.text is distinct from old.text then
      new.ai_flag := null;
      new.ai_reason := null;
    else
      new.ai_flag := old.ai_flag;
      new.ai_reason := old.ai_reason;
    end if;
  end if;
  return new;
end;
$$;
create trigger guard_review_ai_flag before insert or update on public.reviews
  for each row execute function app.guard_review_ai_flag();

-- ---------------------------------------------------------------- recommendations (no LLM)
create index if not exists place_embeddings_hnsw on public.place_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- Most similar published places by embedding (G7), excluding the place itself.
create function public.similar_places(_slug text, _limit integer default 4)
returns table (slug text, category text, name_en text, name_hi text, name_mr text, km numeric)
language sql stable security invoker set search_path = '' as $$
  with me as (
    select p.id, p.location, e.embedding
    from public.places p join public.place_embeddings e on e.place_id = p.id
    where p.slug = _slug
  )
  select p.slug, p.category::text,
    (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'en'),
    (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'hi'),
    (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'mr'),
    round((extensions.st_distance(p.location, me.location) / 1000)::numeric, 1)
  from me
  join public.place_embeddings e on e.place_id <> me.id
  join public.places p on p.id = e.place_id and p.status = 'published'
  order by e.embedding operator(extensions.<=>) me.embedding
  limit least(greatest(_limit, 1), 10);
$$;

-- Less-crowded alternative: when this place is typically busy on that weekday, the most similar
-- published places within 50 km that are typically calm/empty that day (rules + embeddings).
create function public.less_crowded_alternatives(_slug text, _weekday smallint)
returns table (slug text, category text, name_en text, name_hi text, name_mr text, km numeric, level text)
language sql stable security invoker set search_path = '' as $$
  with me as (
    select p.id, p.location, e.embedding
    from public.places p join public.place_embeddings e on e.place_id = p.id
    where p.slug = _slug
      and exists (select 1 from public.crowd_typical c where c.place_id = p.id and c.weekday = _weekday and c.level = 'busy')
  )
  select p.slug, p.category::text,
    (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'en'),
    (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'hi'),
    (select t.name from public.place_translations t where t.place_id = p.id and t.lang = 'mr'),
    round((extensions.st_distance(p.location, me.location) / 1000)::numeric, 1),
    c.level::text
  from me
  join public.place_embeddings e on e.place_id <> me.id
  join public.places p on p.id = e.place_id and p.status = 'published'
  join public.crowd_typical c on c.place_id = p.id and c.weekday = _weekday and c.level in ('calm', 'empty')
  where extensions.st_dwithin(p.location, me.location, 50000)
  order by e.embedding operator(extensions.<=>) me.embedding
  limit 2;
$$;
