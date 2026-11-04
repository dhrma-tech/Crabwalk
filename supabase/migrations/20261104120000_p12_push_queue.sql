-- P12: push notices for Crabby's new flows — our team answered (10.1), a stay request for an owner and the
-- owner's reply (10.2), "one year ago" (10.10). The web app has no push key and no service role, so these DB
-- triggers queue a notice and the trip-nudges Edge Function (every 5 min, the only holder of the VAPID private
-- key) sends it in the user's language and marks it sent. No message text from users goes into a push.
create table public.push_queue (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('team_answer', 'stay_request', 'stay_reply', 'year_ago')),
  params jsonb not null default '{}',
  url text not null check (url ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index push_queue_unsent_idx on public.push_queue (created_at) where sent_at is null;
create index push_queue_user_idx on public.push_queue (user_id);
-- No policies: written by the triggers below (security definer), read by the Edge Function (service role).
alter table public.push_queue enable row level security;
revoke all on public.push_queue from anon, authenticated;

-- ---------------------------------------------------------------- Ask our team (10.1)
-- The asker has seen the answer in Crabby (answers show once, then stay under "Your questions").
alter table public.team_questions add column seen_at timestamptz;

-- The guard (step A) lets the team write answers; the asker may only mark their answer seen.
create or replace function app.guard_team_question() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- No signed-in user = service role or the SQL editor (maintenance).
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.asker is distinct from auth.uid() or new.status <> 'open' or new.answer is not null then
      raise exception 'bad question' using errcode = '42501';
    end if;
    if (select count(*) from public.team_questions
        where asker = auth.uid() and created_at > now() - interval '1 day') >= 5 then
      raise exception 'too many questions today' using errcode = 'CW429';
    end if;
    return new;
  end if;
  if not app.is_team() then
    if old.asker = auth.uid()
       and (new.question, new.asker, new.status, new.answer, new.answered_by, new.answered_at, new.expires_at,
            new.entity_type, new.entity_id, new.lang)
         is not distinct from (old.question, old.asker, old.status, old.answer, old.answered_by, old.answered_at,
            old.expires_at, old.entity_type, old.entity_id, old.lang) then
      return new;
    end if;
    raise exception 'team only' using errcode = '42501';
  end if;
  if new.question is distinct from old.question or new.asker is distinct from old.asker then
    raise exception 'question text is the asker''s' using errcode = '42501';
  end if;
  if new.status = 'answered' and old.status <> 'answered' then
    new.answered_by := auth.uid();
    new.answered_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function public.mark_team_answers_seen() returns void
language sql security definer set search_path = '' as $$
  update public.team_questions set seen_at = now()
  where asker = auth.uid() and status = 'answered' and seen_at is null;
$$;
revoke execute on function public.mark_team_answers_seen() from public, anon;
grant execute on function public.mark_team_answers_seen() to authenticated;

create function app.queue_team_answer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'answered' and old.status <> 'answered' and new.asker is not null then
    insert into public.push_queue (user_id, kind, url) values (new.asker, 'team_answer', '/crabby');
  end if;
  return new;
end;
$$;
create trigger queue_team_answer after update on public.team_questions
  for each row execute function app.queue_team_answer();

-- A reworded question still finds the stored answer: best of whole-string and word similarity.
create or replace function public.match_team_answers(_q text, _entity uuid default null)
returns table (id uuid, question text, answer text, answered_at timestamptz, entity_id uuid, sim real)
language sql stable security definer set search_path = '' as $$
  select t.id, t.question, t.answer, t.answered_at, t.entity_id,
         greatest(extensions.similarity(t.question, _q), extensions.word_similarity(t.question, _q)) as sim
  from public.team_questions t
  where t.status = 'answered' and (t.expires_at is null or t.expires_at > now())
    and (_entity is null or t.entity_id is null or t.entity_id = _entity)
    and greatest(extensions.similarity(t.question, _q), extensions.word_similarity(t.question, _q)) > 0.4
  order by sim desc, t.answered_at desc
  limit 3;
$$;

-- ---------------------------------------------------------------- stay requests (10.2)
-- Same maintenance rule as the team questions guard (service role / SQL editor pass).
create or replace function app.guard_stay_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _owner uuid := app.listing_owner(new.entity_type, new.entity_id);
  _answerer boolean := auth.uid() = _owner or (_owner is null and app.is_team());
begin
  -- No signed-in user = service role or the SQL editor (maintenance): not a traveller, owner or team edit.
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() or new.status <> 'sent' or new.owner_price is not null
       or new.counter_price is not null or new.contact_phone is not null then
      raise exception 'bad request' using errcode = '42501';
    end if;
    if (select count(*) from public.stay_requests
        where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
      raise exception 'too many requests today' using errcode = 'CW429';
    end if;
    return new;
  end if;
  if (new.user_id, new.entity_type, new.entity_id, new.check_in, new.check_out, new.guests, new.budget, new.note)
     is distinct from (old.user_id, old.entity_type, old.entity_id, old.check_in, old.check_out, old.guests, old.budget, old.note) then
    raise exception 'request details are fixed' using errcode = '42501';
  end if;
  if auth.uid() = old.user_id and not _answerer then
    if new.status not in ('cancelled', 'accepted', 'declined')
       or (new.status = 'accepted' and old.status not in ('available', 'countered'))
       or (new.owner_price, new.owner_note, new.counter_price, new.relayed_by)
          is distinct from (old.owner_price, old.owner_note, old.counter_price, old.relayed_by) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if new.contact_phone is not null and old.contact_phone is null then
      new.contact_shared_at := now();
    end if;
  elsif _answerer then
    if new.contact_phone is distinct from old.contact_phone
       or new.status not in ('relayed', 'available', 'unavailable', 'countered')
       or old.status in ('accepted', 'declined', 'cancelled') then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if new.counter_price is distinct from old.counter_price and old.counter_price is not null then
      raise exception 'one counter offer only' using errcode = '42501';
    end if;
    if new.status = 'relayed' then
      new.relayed_by := auth.uid();
    end if;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A claimed owner hears about a new request; the traveller hears about the reply. Unclaimed listings go to the
-- team's queue in the dashboard instead (relayed by WhatsApp, no push).
create function app.queue_stay_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _owner uuid := app.listing_owner(new.entity_type, new.entity_id);
begin
  if tg_op = 'INSERT' then
    if _owner is not null then
      insert into public.push_queue (user_id, kind, params, url)
      values (_owner, 'stay_request', jsonb_build_object('guests', new.guests), '/owner/requests');
    end if;
  elsif new.status is distinct from old.status and new.status in ('available', 'unavailable', 'countered') then
    insert into public.push_queue (user_id, kind, url) values (new.user_id, 'stay_reply', '/me/requests');
  end if;
  return new;
end;
$$;
create trigger queue_stay_request after insert or update on public.stay_requests
  for each row execute function app.queue_stay_request();

-- ---------------------------------------------------------------- one year ago (10.10)
-- Daily: trips whose last day was a year ago today → a nudge to revisit the journal or plan a return.
create function app.queue_year_ago() returns void
language sql security definer set search_path = '' as $$
  insert into public.push_queue (user_id, kind, params, url)
  select t.owner_id, 'year_ago', jsonb_build_object('trip', left(t.title, 60)), '/plan/' || t.id || '/journal'
  from public.trips t
  where t.start_date is not null
    and t.start_date + t.days - 1 = ((now() at time zone 'Asia/Kolkata')::date - interval '1 year')::date;
$$;
select cron.schedule('p12-year-ago', '30 3 * * *', $$select app.queue_year_ago()$$); -- 09:00 IST
