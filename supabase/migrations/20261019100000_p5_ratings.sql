-- P5: verdict aggregation, sub-score rules + summary, review edits + photos, booking-proof review (G6).

-- ---------------------------------------------------------------- sub-score dimensions per entity (BACKEND §5)
create function app.check_sub_score_dimension() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not (
    (new.entity_type = 'eatery' and new.dimension in ('taste', 'authenticity', 'hygiene', 'value'))
    or (new.entity_type = 'stay' and new.dimension in ('cleanliness', 'value', 'host', 'location'))
  ) then
    raise exception 'dimension % not used for %', new.dimension, new.entity_type using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger check_dimension before insert or update on public.sub_scores
  for each row execute function app.check_sub_score_dimension();

-- ---------------------------------------------------------------- verdict_agg maintenance (P1-18)
-- Refreshed on every verdict write. Tie on the winning count → higher level wins (C19).
create function app.refresh_verdict_agg(_type public.entity_type, _id uuid, _group public.group_type) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c integer[] := array[0, 0, 0, 0];
  t integer;
  best integer;
  win smallint;
  r record;
begin
  for r in select level, count(*)::int n from public.verdicts
           where entity_type = _type and entity_id = _id and group_type = _group group by level loop
    c[r.level] := r.n;
  end loop;
  t := c[1] + c[2] + c[3] + c[4];
  if t = 0 then
    delete from public.verdict_agg where entity_type = _type and entity_id = _id and group_type = _group;
    return;
  end if;
  best := greatest(c[1], c[2], c[3], c[4]);
  win := case when c[4] = best then 4 when c[3] = best then 3 when c[2] = best then 2 else 1 end;
  insert into public.verdict_agg (entity_type, entity_id, group_type, counts, total, winner_level, winner_pct, is_new, updated_at)
  values (_type, _id, _group, c, t, win, round(best::numeric / t, 4), t < 10, now())
  on conflict (entity_type, entity_id, group_type) do update
    set counts = excluded.counts, total = excluded.total, winner_level = excluded.winner_level,
        winner_pct = excluded.winner_pct, is_new = excluded.is_new, updated_at = now();
end;
$$;

create function app.on_verdict_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform app.refresh_verdict_agg(old.entity_type, old.entity_id, old.group_type);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform app.refresh_verdict_agg(new.entity_type, new.entity_id, new.group_type);
  end if;
  return null;
end;
$$;
create trigger verdict_agg_refresh after insert or update or delete on public.verdicts
  for each row execute function app.on_verdict_change();

-- "All" aggregate across group types (B13: no enum change) — for cards and the gauge's All tab.
create view public.verdict_agg_all with (security_invoker = true) as
with s as (
  select entity_type, entity_id,
    sum(counts[1])::int c1, sum(counts[2])::int c2, sum(counts[3])::int c3, sum(counts[4])::int c4, sum(total)::int total
  from public.verdict_agg group by entity_type, entity_id
)
select entity_type, entity_id, array[c1, c2, c3, c4] counts, total,
  (case when c4 = greatest(c1, c2, c3, c4) then 4 when c3 = greatest(c1, c2, c3, c4) then 3
        when c2 = greatest(c1, c2, c3, c4) then 2 else 1 end)::smallint winner_level,
  round(greatest(c1, c2, c3, c4)::numeric / total, 4) winner_pct,
  total < 10 is_new
from s;
grant select on public.verdict_agg_all to anon, authenticated;

-- Average per dimension (individual sub_scores stay private).
create function public.sub_score_summary(_type public.entity_type, _id uuid)
returns table (dimension text, avg_score numeric, n integer)
language sql stable security definer set search_path = '' as $$
  select dimension::text, round(avg(score)::numeric, 1), count(*)::int
  from public.sub_scores where entity_type = _type and entity_id = _id group by dimension;
$$;
grant execute on function public.sub_score_summary to anon, authenticated;

-- ---------------------------------------------------------------- reviews: one per user/listing/group, editable
create unique index reviews_one_per_group on public.reviews (user_id, entity_type, entity_id, group_type);
-- Editing sends the review back to moderation.
create policy "own update" on public.reviews for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and moderation_status = 'pending');

-- Review photos (DECISIONS P5-1): never listing photos (those stay verifier/owner-only, LOCKED).
create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  lqip text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index on public.review_photos (review_id);
alter table public.review_photos enable row level security;
create policy "read with review" on public.review_photos for select
  using (exists (select 1 from public.reviews r where r.id = review_id));  -- reviews RLS decides
create policy "own insert" on public.review_photos for insert
  with check (user_id = auth.uid() and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = auth.uid()));
create policy "own or moderator delete" on public.review_photos for delete
  using (user_id = auth.uid() or app.has_role('reviewer') or app.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('review-photos', 'review-photos', true, 3145728, array['image/webp']),
  ('booking-proofs', 'booking-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Paths start with the uploader's user id.
create policy "review photos own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "review photos read" on storage.objects for select to authenticated
  using (bucket_id = 'review-photos');

-- ---------------------------------------------------------------- booking proofs (G6, P1-17)
create policy "proof own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'booking-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proof read" on storage.objects for select to authenticated
  using (bucket_id = 'booking-proofs' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.booking_proofs p where p.storage_path = name
               and app.is_staff_for(p.entity_type::text::public.listing_type, p.entity_id))));
create policy "proof staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'booking-proofs' and exists (
    select 1 from public.booking_proofs p where p.storage_path = name
    and app.is_staff_for(p.entity_type::text::public.listing_type, p.entity_id)));

-- Verifier decision. The caller deletes the image first (Storage API); this records the outcome and,
-- on approval, the verified visit that unlocks hygiene/cleanliness for that user and listing.
create function public.review_booking_proof(_proof uuid, _approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.booking_proofs;
begin
  select * into p from public.booking_proofs where id = _proof and status = 'pending';
  if p.id is null then raise exception 'proof not pending'; end if;
  if not app.is_staff_for(p.entity_type::text::public.listing_type, p.entity_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.booking_proofs
  set status = case when _approve then 'approved' else 'rejected' end::public.review_status,
      reviewed_by = auth.uid(), reviewed_at = now(), storage_path = null, updated_at = now()
  where id = _proof;
  if _approve then
    insert into public.verified_visits (user_id, entity_type, entity_id, method)
    values (p.user_id, p.entity_type, p.entity_id, 'booking_proof');
  end if;
end;
$$;
revoke execute on function public.review_booking_proof from public, anon;
grant execute on function public.review_booking_proof to authenticated;

-- ---------------------------------------------------------------- crons
select cron.schedule('booking-proof-cleanup', '15 21 * * *', $$select app.invoke_edge('booking-proof-cleanup')$$); -- 02:45 IST
select cron.schedule('review-summaries', '0 22 * * *', $$select app.invoke_edge('review-summaries')$$);           -- 03:30 IST
