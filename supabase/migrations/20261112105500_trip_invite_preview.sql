-- Hardening 2026-11, SEC-20: opening an invite link shows "Join this trip?" first and joins only on POST, so link
-- previews and prefetching never add anyone. The confirm page needs the trip title and the invite's role.
create function public.trip_invite_preview(_token text) returns table (title text, role public.trip_role)
language sql stable security definer set search_path = '' as $$
  select t.title, i.role
  from public.trip_invites i join public.trips t on t.id = i.trip_id
  where i.token = _token and i.revoked_at is null;
$$;
revoke all on function public.trip_invite_preview(text) from public, anon;
grant execute on function public.trip_invite_preview(text) to authenticated;
