-- P12 Crabby AI (docs/P12 Crabby AI.md, DECISIONS P12-0…3): personal profile + persona, Ask our team, stay
-- requests (books the unbookable), trip group chat with polls and Crabby, trip reports, trip journals, AI leads,
-- per-feature AI caps. The web app has no service role: every write runs as the signed-in user under RLS, and
-- group chat messages (people's and Crabby's) go through one function that needs a server signature, so
-- moderation can't be skipped and nobody can post as Crabby (key in Vault: `crabby_key`, same value as the
-- server's CRABBY_SIGNING_KEY).
-- AI firewall unchanged: no Ola data, phone numbers or location history in any table an LLM tool reads.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- profile (10.7) + persona (10.9)
create type public.persona as enum ('playful', 'plain');
create type public.vehicle as enum ('car', 'two_wheeler', 'public_transport');
create type public.budget_band as enum ('budget', 'mid', 'premium');

-- One row per user. Quiz answers + per-source consents (DPDPA: each source has its own toggle, off by default
-- except the quiz the user fills in themselves); `scores` and `lines` are computed by code. `lines` is the
-- editable "What Crabby thinks about you" card: [{id, text, source, hidden}]. Folds in user_preferences.
create table public.user_profile (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vehicle public.vehicle,
  mileage_kmpl numeric(4, 1) check (mileage_kmpl between 5 and 100),
  budget_band public.budget_band,
  interests public.place_category[] not null default '{}',
  pace public.trip_pace,
  diet text check (diet in ('veg', 'non_veg', 'jain')),
  seafood boolean,
  group_type public.group_type,
  persona public.persona not null default 'playful',
  use_quiz boolean not null default true,
  use_activity boolean not null default false,
  use_chats boolean not null default false,
  use_trips boolean not null default false,
  scores jsonb not null default '{}',
  lines jsonb not null default '[]' check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) <= 30),
  quiz_done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
insert into public.user_profile (user_id, diet, group_type, budget_band)
select user_id, diet, group_type,
  case budget_level when 'budget' then 'budget'::public.budget_band when 'mid' then 'mid'::public.budget_band
    when 'premium' then 'premium'::public.budget_band end
from public.user_preferences
on conflict (user_id) do nothing;

-- In-app activity (searches, views, saves), kept only while use_activity is on, 90 days at most.
create table public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('search', 'view', 'save')),
  entity_type public.listing_type,
  entity_id uuid,
  query text check (char_length(query) <= 120),
  at timestamptz not null default now(),
  check ((kind = 'search') = (query is not null))
);
create index user_activity_user_idx on public.user_activity (user_id, at desc);

-- Turning a source off deletes what it collected (as consents do for dwell time).
create function app.on_profile_source_off() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.use_activity and not new.use_activity then
    delete from public.user_activity where user_id = new.user_id;
  end if;
  if (old.use_activity and not new.use_activity) or (old.use_chats and not new.use_chats)
     or (old.use_trips and not new.use_trips) or (old.use_quiz and not new.use_quiz) then
    new.lines := coalesce((
      select jsonb_agg(l) from jsonb_array_elements(new.lines) l
      where not (
        (l ->> 'source' = 'activity' and not new.use_activity) or (l ->> 'source' = 'chat' and not new.use_chats)
        or (l ->> 'source' = 'trips' and not new.use_trips) or (l ->> 'source' = 'quiz' and not new.use_quiz))
    ), '[]');
  end if;
  return new;
end;
$$;
create trigger profile_source_off before update on public.user_profile
  for each row execute function app.on_profile_source_off();

-- ---------------------------------------------------------------- per-feature AI caps
-- Chat keeps ai_take_message (20/day). Other AI features get their own daily caps (app_config ai_cap_<feature>).
create table public.ai_feature_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  feature text not null check (feature in ('snap', 'reel', 'journal', 'report', 'host', 'profile')),
  count integer not null default 0,
  primary key (user_id, date, feature)
);
insert into public.app_config (key, value, notes) values
  ('ai_cap_snap', '5', 'Snap and ask photos per user per day (P12)'),
  ('ai_cap_reel', '5', 'Reel to trip lookups per user per day (P12)'),
  ('ai_cap_journal', '6', 'Journal interview + story calls per user per day (P12)'),
  ('ai_cap_report', '6', 'Trip report summaries per user per day (P12)'),
  ('ai_cap_host', '20', 'Host Crabby field fills per user per day (P12)'),
  ('ai_cap_profile', '10', 'Preference extractions from chats per user per day (P12)'),
  ('crabby_group_daily', '10', 'Unprompted Crabby replies per group chat per day (P12-1)'),
  ('crabby_group_cooldown_s', '600', 'Seconds between unprompted Crabby replies in a group chat (P12-1)'),
  ('journal_photo_cap', '20', 'Shared journal photos per user (P12, Supabase free tier)')
on conflict (key) do nothing;

create function public.ai_take(_feature text) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  cap integer := coalesce((select value::integer from public.app_config where key = 'ai_cap_' || _feature), 5);
  today date := (now() at time zone 'Asia/Kolkata')::date;
  used integer;
begin
  if auth.uid() is null then
    raise exception 'sign in' using errcode = '42501';
  end if;
  insert into public.ai_feature_usage (user_id, date, feature) values (auth.uid(), today, _feature)
  on conflict do nothing;
  update public.ai_feature_usage set count = count + 1
  where user_id = auth.uid() and date = today and feature = _feature and count < cap
  returning count into used;
  if used is null then
    raise exception 'daily cap reached' using errcode = 'CW429';
  end if;
  return cap - used;
end;
$$;
revoke execute on function public.ai_take(text) from public, anon;
grant execute on function public.ai_take(text) to authenticated;

-- ---------------------------------------------------------------- Ask our team (10.1)
create type public.team_question_status as enum ('open', 'answered', 'expired', 'closed');

create table public.team_questions (
  id uuid primary key default gen_random_uuid(),
  asker uuid default auth.uid() references auth.users (id) on delete set null,
  question text not null check (char_length(question) between 3 and 500),
  lang public.lang not null default 'en',
  entity_type public.entity_type,
  entity_id uuid,
  status public.team_question_status not null default 'open',
  answer text check (char_length(answer) <= 2000),
  answered_by uuid references auth.users (id) on delete set null,
  answered_at timestamptz,
  -- Time-sensitive answers (road status, closures) expire; Crabby stops reusing them after this.
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check ((entity_type is null) = (entity_id is null)),
  check ((status = 'answered') = (answer is not null and answered_at is not null))
);
create index team_questions_trgm_idx on public.team_questions using gin (question extensions.gin_trgm_ops);
create index team_questions_status_idx on public.team_questions (status, created_at);

create function app.is_team() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_role('verifier') or app.is_admin();
$$;

-- Asker writes the question only; the team writes answer fields; 5 questions a day per user.
create function app.guard_team_question() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
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
create trigger guard_team_question before insert or update on public.team_questions
  for each row execute function app.guard_team_question();

-- Reusable verified answers similar to a question (trigram similarity; no runtime embeddings, P12-0).
create function public.match_team_answers(_q text, _entity uuid default null)
returns table (id uuid, question text, answer text, answered_at timestamptz, entity_id uuid, sim real)
language sql stable security definer set search_path = '' as $$
  select t.id, t.question, t.answer, t.answered_at, t.entity_id,
         extensions.similarity(t.question, _q) as sim
  from public.team_questions t
  where t.status = 'answered' and (t.expires_at is null or t.expires_at > now())
    and (_entity is null or t.entity_id is null or t.entity_id = _entity)
    and extensions.similarity(t.question, _q) > 0.3
  order by sim desc, t.answered_at desc
  limit 3;
$$;
revoke execute on function public.match_team_answers(text, uuid) from public, anon;
grant execute on function public.match_team_answers(text, uuid) to authenticated;

-- ---------------------------------------------------------------- books the unbookable (10.2)
create type public.stay_request_status as enum (
  'sent', 'relayed', 'available', 'unavailable', 'countered', 'accepted', 'declined', 'cancelled'
);

create table public.stay_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entity_type public.entity_type not null check (entity_type in ('stay', 'eatery')),
  entity_id uuid not null,
  check_in date not null,
  check_out date,
  guests integer not null check (guests between 1 and 50),
  budget integer check (budget between 0 and 1000000),
  note text check (char_length(note) <= 300),
  status public.stay_request_status not null default 'sent',
  owner_price integer check (owner_price between 0 and 10000000),
  owner_note text check (char_length(owner_note) <= 300),
  -- Bounded negotiation: the owner may counter once; the user decides.
  counter_price integer check (counter_price between 0 and 10000000),
  -- The user's phone reaches the owner only after the user confirms (10.2).
  contact_phone text check (contact_phone ~ '^\+?[0-9 ]{8,16}$'),
  contact_shared_at timestamptz,
  relayed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (check_out is null or check_out > check_in),
  check ((contact_phone is null) = (contact_shared_at is null)),
  check (contact_phone is null or status = 'accepted')
);
create index stay_requests_user_idx on public.stay_requests (user_id, created_at desc);
create index stay_requests_entity_idx on public.stay_requests (entity_type, entity_id);

create function app.listing_owner(_type public.entity_type, _id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case _type
    when 'stay' then (select owner_id from public.stays where id = _id)
    when 'eatery' then (select owner_id from public.eateries where id = _id)
  end;
$$;

-- Who may change what: the user sends, cancels, accepts (sharing their phone) or declines; the owner (claimed)
-- or the team (unclaimed, relayed by WhatsApp) answers available/unavailable with a price, and may counter once.
create function app.guard_stay_request() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _owner uuid := app.listing_owner(new.entity_type, new.entity_id);
  _answerer boolean := auth.uid() = _owner or (_owner is null and app.is_team());
begin
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
create trigger guard_stay_request before insert or update on public.stay_requests
  for each row execute function app.guard_stay_request();

-- ---------------------------------------------------------------- trip group chat (10.8)
create type public.message_kind as enum ('text', 'card', 'poll', 'question', 'report', 'system');

-- Trip tripmates (P11) chat here; Crabby is a member. Inserted only through post_trip_message (signed).
create table public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  -- The tripmate who wrote it; for Crabby, the tripmate whose message or tap made Crabby reply.
  member_id uuid,
  from_crabby boolean not null default false,
  proactive boolean not null default false,
  kind public.message_kind not null default 'text',
  body text check (char_length(body) <= 4000),
  payload jsonb,
  nonce uuid not null unique,
  created_at timestamptz not null default now(),
  foreign key (trip_id, member_id) references public.trip_members (trip_id, id) on delete set null (member_id),
  check (proactive = false or from_crabby)
);
create index trip_messages_trip_idx on public.trip_messages (trip_id, created_at);

create table public.trip_poll_votes (
  message_id uuid not null references public.trip_messages (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  member_id uuid not null,
  options smallint[] not null check (cardinality(options) between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (message_id, member_id),
  foreign key (trip_id, member_id) references public.trip_members (trip_id, id) on delete cascade
);

create table public.crabby_group_usage (
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  proactive integer not null default 0,
  last_spoke_at timestamptz,
  primary key (trip_id, date)
);

create function app.my_member_id(_trip uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.trip_members where trip_id = _trip and user_id = auth.uid();
$$;

-- The server signs (HMAC-SHA256, Vault `crabby_key`) every message it lets through — people's after moderation,
-- Crabby's after the reply is built — over trip|kind|crabby|proactive|nonce|body|payload (t/f for booleans; the
-- payload as the exact JSON text that was signed). A nonce is used once.
-- Unprompted Crabby replies obey the group's cooldown and daily cap (P12-1).
create function public.post_trip_message(
  _trip uuid, _kind public.message_kind, _body text, _payload text, _crabby boolean, _proactive boolean,
  _nonce uuid, _sig text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  _key text := (select decrypted_secret from vault.decrypted_secrets where name = 'crabby_key');
  _member uuid := app.my_member_id(_trip);
  _today date := (now() at time zone 'Asia/Kolkata')::date;
  _id uuid;
begin
  if _key is null then
    raise exception 'chat signing key not set' using errcode = '55000';
  end if;
  if _member is null or not app.is_trip_member(_trip) then
    raise exception 'not a tripmate' using errcode = '42501';
  end if;
  if _sig is distinct from encode(extensions.hmac(
      concat_ws('|', _trip, _kind, _crabby, _proactive, _nonce, coalesce(_body, ''), coalesce(_payload, '')),
      _key, 'sha256'), 'hex') then
    raise exception 'bad signature' using errcode = '42501';
  end if;
  if _proactive then
    if not _crabby then
      raise exception 'only Crabby speaks unprompted' using errcode = '22023';
    end if;
    insert into public.crabby_group_usage (trip_id, date) values (_trip, _today) on conflict do nothing;
    update public.crabby_group_usage
      set proactive = proactive + 1, last_spoke_at = now()
      where trip_id = _trip and date = _today
        and proactive < coalesce((select value::integer from public.app_config where key = 'crabby_group_daily'), 10)
        and (last_spoke_at is null or last_spoke_at < now() - make_interval(secs =>
          coalesce((select value::integer from public.app_config where key = 'crabby_group_cooldown_s'), 600)));
    if not found then
      raise exception 'Crabby rests' using errcode = 'CW429';
    end if;
  end if;
  insert into public.trip_messages (trip_id, member_id, from_crabby, proactive, kind, body, payload, nonce)
  values (_trip, _member, _crabby, _proactive, _kind, _body, _payload::jsonb, _nonce)
  returning id into _id;
  return _id;
end;
$$;
revoke execute on function public.post_trip_message(uuid, public.message_kind, text, text, boolean, boolean, uuid, text)
  from public, anon;
grant execute on function public.post_trip_message(uuid, public.message_kind, text, text, boolean, boolean, uuid, text)
  to authenticated;

-- Retention (P12-2): a trip's chat goes 30 days after its last day; trips without dates, 30 days after the
-- last message.
create function app.purge_trip_messages() returns void
language sql security definer set search_path = '' as $$
  delete from public.trip_messages m
  using public.trips t
  where t.id = m.trip_id and (
    (t.start_date is not null and t.start_date + t.days - 1 + 30 < (now() at time zone 'Asia/Kolkata')::date)
    or (t.start_date is null and not exists (
      select 1 from public.trip_messages n where n.trip_id = t.id and n.created_at > now() - interval '30 days')));
  delete from public.crabby_group_usage where date < (now() at time zone 'Asia/Kolkata')::date - 7;
  delete from public.user_activity where at < now() - interval '90 days';
$$;
select cron.schedule('p12-purge', '40 21 * * *', $$select app.purge_trip_messages()$$); -- 03:10 IST

-- ---------------------------------------------------------------- trip reports (10.12)
-- Versioned snapshots built from our DB by template (payload) + the short LLM summary.
create table public.trip_reports (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  version integer not null,
  lang public.lang not null,
  payload jsonb not null,
  summary text check (char_length(summary) <= 1500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, version, lang)
);

-- Anyone with the trip's read-only share link sees its latest report.
create function public.trip_report_by_token(_token text, _lang public.lang)
returns table (title text, version integer, payload jsonb, summary text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.title, r.version, r.payload, r.summary, r.created_at
  from public.trips t join public.trip_reports r on r.trip_id = t.id
  where t.share_token = _token
  order by (r.lang = _lang) desc, r.version desc
  limit 1;
$$;
revoke execute on function public.trip_report_by_token(text, public.lang) from public;
grant execute on function public.trip_report_by_token(text, public.lang) to anon, authenticated;

-- ---------------------------------------------------------------- trip journals (10.10)
create table public.trip_journals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'interview', 'written')),
  -- Interview answers per stop + the whole-trip answer (voice transcribed on the phone, or typed).
  answers jsonb not null default '{}',
  story text check (char_length(story) <= 12000),
  lang public.lang not null default 'en',
  -- Private by default; a share link only when the user turns it on.
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (trip_id, user_id)
);

create index trip_journals_user_idx on public.trip_journals (user_id);

-- Only photos the user puts in a shared journal are uploaded (P12-0); clips and other photos stay on the phone.
create table public.journal_photos (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.trip_journals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null unique,
  caption text check (char_length(caption) <= 200),
  created_at timestamptz not null default now()
);

create function app.guard_journal_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.journal_photos where user_id = new.user_id)
     >= coalesce((select value::integer from public.app_config where key = 'journal_photo_cap'), 20) then
    raise exception 'journal photo limit reached' using errcode = 'CW429';
  end if;
  if split_part(new.path, '/', 1) <> new.user_id::text then
    raise exception 'photo must be in your folder' using errcode = '42501';
  end if;
  return new;
end;
$$;
create index journal_photos_user_idx on public.journal_photos (user_id);
create index journal_photos_journal_idx on public.journal_photos (journal_id);

create trigger guard_journal_photo before insert on public.journal_photos
  for each row execute function app.guard_journal_photo();

create function public.journal_by_token(_token text)
returns table (title text, story text, lang public.lang, photos jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.title, j.story, j.lang,
         coalesce((select jsonb_agg(jsonb_build_object('path', p.path, 'caption', p.caption) order by p.created_at)
                   from public.journal_photos p where p.journal_id = j.id), '[]'),
         coalesce(j.updated_at, j.created_at)
  from public.trip_journals j join public.trips t on t.id = j.trip_id
  where j.share_token = _token and j.status = 'written';
$$;
revoke execute on function public.journal_by_token(text) from public;
grant execute on function public.journal_by_token(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('journal', 'journal', true, 409600, array['image/webp'])
on conflict (id) do nothing;
create policy "journal own write" on storage.objects for insert to authenticated
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "journal own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- AI leads (10.5, 10.6)
-- Inputs Crabby couldn't match to our DB: a to-do list for the content team (no photos stored).
create table public.ai_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('reel', 'photo', 'question')),
  input text not null check (char_length(input) <= 1000),
  url text check (char_length(url) <= 500),
  status text not null default 'new' check (status in ('new', 'done', 'dismissed')),
  created_at timestamptz not null default now()
);

create index ai_leads_user_idx on public.ai_leads (user_id);

-- ---------------------------------------------------------------- RLS
alter table public.user_profile enable row level security;
alter table public.user_activity enable row level security;
alter table public.ai_feature_usage enable row level security;
alter table public.team_questions enable row level security;
alter table public.stay_requests enable row level security;
alter table public.trip_messages enable row level security;
alter table public.trip_poll_votes enable row level security;
alter table public.crabby_group_usage enable row level security;
alter table public.trip_reports enable row level security;
alter table public.trip_journals enable row level security;
alter table public.journal_photos enable row level security;
alter table public.ai_leads enable row level security;

create policy "own" on public.user_profile for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own read" on public.user_activity for select to authenticated using (user_id = auth.uid());
create policy "own delete" on public.user_activity for delete to authenticated using (user_id = auth.uid());
create policy "own consented insert" on public.user_activity for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.user_profile p where p.user_id = auth.uid() and p.use_activity));
create policy "own read" on public.ai_feature_usage for select to authenticated using (user_id = auth.uid());

-- Questions: the asker sees theirs; the team reads and answers all. Others reach live answers only through
-- match_team_answers (no asker ids).
create policy "asker read" on public.team_questions for select to authenticated using (asker = auth.uid());
create policy "team read" on public.team_questions for select to authenticated using (app.is_team());
create policy "ask" on public.team_questions for insert to authenticated with check (asker = auth.uid());
create policy "team answer" on public.team_questions for update to authenticated
  using (app.is_team()) with check (app.is_team());

create policy "own" on public.stay_requests for select to authenticated using (user_id = auth.uid());
create policy "owner read" on public.stay_requests for select to authenticated
  using (app.listing_owner(entity_type, entity_id) = auth.uid());
create policy "team unclaimed read" on public.stay_requests for select to authenticated
  using (app.listing_owner(entity_type, entity_id) is null and app.is_team());
create policy "send" on public.stay_requests for insert to authenticated with check (user_id = auth.uid());
create policy "update" on public.stay_requests for update to authenticated
  using (user_id = auth.uid() or app.listing_owner(entity_type, entity_id) = auth.uid()
         or (app.listing_owner(entity_type, entity_id) is null and app.is_team()));

create policy "member read" on public.trip_messages for select to authenticated using (app.is_trip_member(trip_id));
create policy "author delete" on public.trip_messages for delete to authenticated
  using (not from_crabby and member_id = app.my_member_id(trip_id));
create policy "member read" on public.trip_poll_votes for select to authenticated using (app.is_trip_member(trip_id));
create policy "own vote" on public.trip_poll_votes for all to authenticated
  using (member_id = app.my_member_id(trip_id))
  with check (member_id = app.my_member_id(trip_id)
              and exists (select 1 from public.trip_messages m
                          where m.id = message_id and m.trip_id = trip_poll_votes.trip_id and m.kind = 'poll'));
create policy "member read" on public.crabby_group_usage for select to authenticated using (app.is_trip_member(trip_id));

create policy "member read" on public.trip_reports for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_reports for insert to authenticated
  with check (app.can_edit_trip(trip_id) and created_by = auth.uid());

create policy "own" on public.trip_journals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and app.is_trip_member(trip_id));
create policy "own" on public.journal_photos for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and exists (select 1 from public.trip_journals j where j.id = journal_id and j.user_id = auth.uid()));

create policy "own insert" on public.ai_leads for insert to authenticated with check (user_id = auth.uid());
create policy "team" on public.ai_leads for all to authenticated using (app.is_team()) with check (app.is_team());

revoke all on public.user_profile, public.user_activity, public.ai_feature_usage, public.team_questions,
  public.stay_requests, public.trip_messages, public.trip_poll_votes, public.crabby_group_usage,
  public.trip_reports, public.trip_journals, public.journal_photos, public.ai_leads from anon;
-- Messages only through post_trip_message.
revoke insert, update on public.trip_messages from authenticated;

create trigger set_updated_at before update on public.user_profile for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.trip_poll_votes for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.trip_journals for each row execute function app.set_updated_at();

alter publication supabase_realtime add table public.trip_messages, public.trip_poll_votes;
