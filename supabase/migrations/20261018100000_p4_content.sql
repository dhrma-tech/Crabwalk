-- P4: eatery contact, media buckets, re-check queue, content approval, owner-claim approval.

-- ---------------------------------------------------------------- eatery contact (DECISIONS P4-1)
alter table public.eateries add column phone text, add column whatsapp text;

create or replace function app.guard_owner_eateries() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and app.has_role('owner', 'eatery', old.id) and not app.is_staff_for('eatery', old.id)
     and (to_jsonb(new) - array['price_for_two', 'menu', 'phone', 'whatsapp', 'updated_at'])
         is distinct from
         (to_jsonb(old) - array['price_for_two', 'menu', 'phone', 'whatsapp', 'updated_at']) then
    raise exception 'owners can edit fact fields only' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- media buckets (DECISIONS P4-2)
-- Public read. Paths: <entity_type>/<entity_id>/<file>. Writes: staff for the listing, or its owner.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('photos', 'photos', true, 3145728, array['image/webp']),
  ('audio', 'audio', true, 10485760, array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm'])
on conflict (id) do nothing;

create function app.can_write_media(_path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  parts text[] := string_to_array(_path, '/');
  t public.listing_type;
  i uuid;
begin
  if array_length(parts, 1) < 3 or parts[1] not in ('place', 'stay', 'eatery', 'dish') then return false; end if;
  t := parts[1]::public.listing_type;
  begin i := parts[2]::uuid; exception when others then return false; end;
  return app.is_staff_for(t, i) or (t in ('stay', 'eatery') and app.has_role('owner', t, i));
end;
$$;

-- Upserts use INSERT … ON CONFLICT … RETURNING, which also needs a SELECT policy. Both buckets are public anyway.
create policy "media read" on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'audio'));
create policy "media write" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos', 'audio') and app.can_write_media(name));
create policy "media update" on storage.objects for update to authenticated
  using (bucket_id in ('photos', 'audio') and app.can_write_media(name));
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'audio') and app.can_write_media(name));

-- Audio uploads are staff-only (owners: photos only).
create policy "audio staff only" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'audio' or app.is_admin() or app.has_role('reviewer'));

-- ---------------------------------------------------------------- re-check queue (PLAN P4 task 4)
-- Every verification schedules the next monthly re-check; a user report pulls it forward to now.
create function app.schedule_recheck() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.last_verified_at is distinct from old.last_verified_at and new.last_verified_at is not null then
    new.next_recheck_at := new.last_verified_at + interval '1 month';
  end if;
  return new;
end;
$$;
create trigger schedule_recheck before update on public.places
  for each row execute function app.schedule_recheck();

create function app.report_flags_recheck() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.entity_type = 'place' then
    update public.places set next_recheck_at = now() where id = new.entity_id;
  end if;
  return new;
end;
$$;
create trigger report_flags_recheck after insert on public.reports
  for each row execute function app.report_flags_recheck();

-- ---------------------------------------------------------------- content approval (PLAN P4 task 2)
-- Reviewer text lives in content_drafts (one row per entity/lang/field; P8 AI drafts use the same rows).
-- approve_listing copies pending drafts into *_translations, marks them approved and publishes.
-- Runs as the caller: RLS + guard_publish enforce reviewer/admin.
create unique index content_drafts_pending_uniq on public.content_drafts (entity_type, entity_id, lang, field)
  where status = 'draft';

create function public.approve_listing(_type public.listing_type, _id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  d record;
  tbl text := _type::text || '_translations';
  fk text := _type::text || '_id';
  allowed text[] := case _type
    when 'place' then array['name', 'short_story', 'history', 'significance', 'dos', 'donts', 'safety_text']
    when 'dish' then array['name', 'what_it_is', 'story']
    else array['name', 'description'] end;
begin
  if not (app.is_admin() or app.has_role('reviewer')) then
    raise exception 'only reviewers can approve' using errcode = '42501';
  end if;
  for d in
    select * from public.content_drafts
    where entity_type = _type and entity_id = _id and status = 'draft'
    order by (field = 'name') desc
  loop
    if not d.field = any (allowed) then
      raise exception 'unknown field % for %', d.field, _type;
    end if;
    if d.field = 'name' then
      execute format(
        'insert into public.%I (%I, lang, name) values ($1, $2, $3) on conflict (%I, lang) do update set name = excluded.name',
        tbl, fk, fk) using _id, d.lang, d.draft_text;
    else
      execute format('update public.%I set %I = $3 where %I = $1 and lang = $2', tbl, d.field, fk)
        using _id, d.lang, d.draft_text;
    end if;
    update public.content_drafts set status = 'approved', reviewer_id = auth.uid(), updated_at = now() where id = d.id;
  end loop;

  if _type = 'place' then
    update public.place_translations set approved_by = auth.uid(), approved_at = now() where place_id = _id;
    update public.places set status = 'published', last_verified_at = coalesce(last_verified_at, now()) where id = _id;
  elsif _type = 'stay' then
    update public.stays set status = 'published', last_verified_at = coalesce(last_verified_at, now()) where id = _id;
  elsif _type = 'eatery' then
    update public.eateries set status = 'published', last_verified_at = coalesce(last_verified_at, now()) where id = _id;
  end if;
end;
$$;
grant execute on function public.approve_listing to authenticated;

-- ---------------------------------------------------------------- owner claims (G5)
-- Admin approves after calling the listed number; grants the owner role for that listing only.
create function public.review_owner_claim(_claim uuid, _approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.owner_claims;
begin
  if not app.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  update public.owner_claims set status = case when _approve then 'approved' else 'rejected' end::public.review_status,
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where id = _claim and status = 'pending' returning * into c;
  if c.id is null then raise exception 'claim not pending'; end if;
  if _approve then
    insert into public.user_roles (user_id, role, entity_type, entity_id)
    values (c.user_id, 'owner', c.entity_type::text::public.listing_type, c.entity_id) on conflict do nothing;
    if c.entity_type = 'stay' then
      update public.stays set owner_id = c.user_id, claimed_at = now() where id = c.entity_id;
    else
      update public.eateries set owner_id = c.user_id where id = c.entity_id;
    end if;
  end if;
end;
$$;
revoke execute on function public.review_owner_claim from public, anon;
grant execute on function public.review_owner_claim to authenticated;

-- ---------------------------------------------------------------- report throttle (anon write endpoint)
-- At most 20 reports per listing per hour (BACKEND §14: write endpoints rate-limited; per-IP limits in P10).
create function app.throttle_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports
      where entity_type = new.entity_type and entity_id = new.entity_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'too many reports' using errcode = '54000';
  end if;
  return new;
end;
$$;
create trigger throttle_reports before insert on public.reports
  for each row execute function app.throttle_reports();

-- ---------------------------------------------------------------- field form helper
-- Taluka containing a GPS point (null when boundaries aren't loaded yet → verifier picks one).
create function public.taluka_at(lon float8, lat float8) returns uuid
language sql stable security invoker set search_path = '' as $$
  select id from public.talukas
  where boundary is not null
    and extensions.st_covers(boundary, extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography)
  limit 1;
$$;
grant execute on function public.taluka_at to authenticated;
