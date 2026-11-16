-- SEC-01 (hardening 2026-11): a trip owner must not be able to publish an "official" itinerary.
-- "own all" on public.trips lets owners write every column; is_ready_made / slug make a row public on Discover,
-- /itineraries and the sitemap. Only staff (reviewer, admin) and the service role may set them.
create function app.guard_trip_public() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or app.is_admin() or app.has_role('reviewer') then
    return new; -- service role, seeds, staff
  end if;
  if tg_op = 'INSERT' then
    if new.is_ready_made or new.slug is not null or new.owner_id is distinct from auth.uid() then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  elsif new.is_ready_made is distinct from old.is_ready_made
     or new.slug is distinct from old.slug
     or new.owner_id is distinct from old.owner_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke all on function app.guard_trip_public() from public, anon, authenticated;
create trigger guard_trip_public before insert or update on public.trips
  for each row execute function app.guard_trip_public();
