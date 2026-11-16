-- SEC-05 (hardening 2026-11): direct PostgREST writes skip the app's Zod limits and IP rate limits, so the size
-- limits, per-user quotas and the report path must hold in SQL.

-- ---------------------------------------------------------------- length / size limits
-- Added NOT VALID so the ALTER never fails on legacy rows; then validated. Over-long report and review text is
-- truncated first (safe: free text). The other tables are validated as they are and fail loudly on bad data.
alter table public.reports  add constraint reports_text_len  check (text is null or char_length(text) <= 1000) not valid;
alter table public.reviews  add constraint reviews_text_len  check (text is null or char_length(text) <= 2000) not valid;
alter table public.trips    add constraint trips_title_len   check (char_length(title) between 1 and 120) not valid;
alter table public.profiles add constraint profiles_name_len check (display_name is null or char_length(display_name) <= 80) not valid;
alter table public.ai_actions   add constraint ai_actions_preview_size check (pg_column_size(preview) <= 16384) not valid;
alter table public.user_profile add constraint user_profile_lines_size check (pg_column_size(lines) <= 16384) not valid;

do $$
begin
  update public.reports set text = left(text, 1000) where char_length(text) > 1000;
  -- Row triggers on reviews (moderation reset, updated_at) must not fire for this clean-up.
  alter table public.reviews disable trigger user;
  update public.reviews set text = left(text, 2000) where char_length(text) > 2000;
  alter table public.reviews enable trigger user;
end $$;
alter table public.reports  validate constraint reports_text_len;
alter table public.reviews  validate constraint reviews_text_len;
alter table public.trips    validate constraint trips_title_len;
alter table public.profiles validate constraint profiles_name_len;
alter table public.ai_actions   validate constraint ai_actions_preview_size;
alter table public.user_profile validate constraint user_profile_lines_size;

-- ---------------------------------------------------------------- reports only through a checked RPC
-- The web server calls this with the service role after its per-IP limit. The per-listing throttle trigger
-- (throttle_reports) and the re-check trigger (report_flags_recheck) still fire on the insert.
drop policy "anyone insert" on public.reports;
create function public.file_report(_type public.qr_entity_type, _id uuid, _kind public.report_type,
                                   _text text, _qr text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if _text is not null and char_length(_text) > 1000 then
    raise exception 'too long' using errcode = '22001';
  end if;
  if app.qr_entity_location(_type, _id) is null then
    raise exception 'unknown listing' using errcode = 'P0002';
  end if;
  if (select count(*) from public.reports where created_at > now() - interval '1 hour') >= 200 then
    raise exception 'too many reports' using errcode = '54000';
  end if;
  insert into public.reports (entity_type, entity_id, type, text, qr_code)
  values (_type, _id, _kind, nullif(trim(_text), ''), _qr);
end; $$;
revoke execute on function public.file_report(public.qr_entity_type, uuid, public.report_type, text, text)
  from public, anon, authenticated;
grant execute on function public.file_report(public.qr_entity_type, uuid, public.report_type, text, text) to service_role;

-- ---------------------------------------------------------------- per-user row quotas
-- Generic: create trigger quota before insert on <table> ... execute function app.enforce_quota('<owner column>', '<max>').
-- Service role and seeds (no auth.uid()) are not limited.
create function app.enforce_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  if auth.uid() is null then return new; end if;
  execute format('select count(*) from public.%I where %I = $1', tg_table_name, tg_argv[0]) into n using auth.uid();
  if n >= tg_argv[1]::bigint then
    raise exception 'limit reached' using errcode = 'CW429';
  end if;
  return new;
end; $$;
revoke all on function app.enforce_quota() from public, anon, authenticated;
create trigger quota before insert on public.trips       for each row execute function app.enforce_quota('owner_id', '100');
create trigger quota before insert on public.saved_items for each row execute function app.enforce_quota('user_id', '1000');
create trigger quota before insert on public.ai_actions  for each row execute function app.enforce_quota('user_id', '500');

-- Per-trip cap on stops (any writer, including tripmates with edit rights).
create function app.enforce_trip_stop_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;
  if (select count(*) from public.trip_stops where trip_id = new.trip_id) >= 300 then
    raise exception 'limit reached' using errcode = 'CW429';
  end if;
  return new;
end; $$;
revoke all on function app.enforce_trip_stop_cap() from public, anon, authenticated;
create trigger stop_cap before insert on public.trip_stops for each row execute function app.enforce_trip_stop_cap();

-- ---------------------------------------------------------------- storage object quota per user folder
create function app.storage_count(_bucket text, _prefix text) returns bigint
language sql stable security definer set search_path = '' as $$
  select count(*) from storage.objects where bucket_id = _bucket and name like _prefix || '/%';
$$;
revoke all on function app.storage_count(text, text) from public, anon;
grant execute on function app.storage_count(text, text) to authenticated;
create policy "review photos quota" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'review-photos' or app.storage_count('review-photos', auth.uid()::text) < 200);
create policy "journal quota" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'journal' or app.storage_count('journal', auth.uid()::text) < 40);
