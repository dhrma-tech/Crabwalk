-- Desk import guards (user 2026-11-05).
-- A desk place can't go live (approve_listing, or any status change through the API) until it has an English
-- story: desk rows can arrive with no English text at all. Field rows keep the earlier rule. Checked on the change
-- to published, after approve_listing has written the approved drafts, so approving a story and publishing in one
-- step works.
create function app.guard_en_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' and new.verification_method = 'desk'
  and not exists (
    select 1 from public.place_translations t
    where t.place_id = new.id and t.lang = 'en' and coalesce(btrim(t.short_story), '') <> ''
  ) then
    raise exception 'English text needed to publish this place' using errcode = '23514';
  end if;
  return new;
end;
$$;
-- Named to sort after guard_publish (triggers fire in name order): who may publish is checked first.
create trigger guard_publish_en_text before update of status on public.places
  for each row execute function app.guard_en_text();

-- Imported events are drafts: the public sees published ones only; reviewers and admins see all (their write
-- policy covers select).
drop policy "public read" on public.events_calendar;
create policy "public read" on public.events_calendar for select using (status = 'published');
