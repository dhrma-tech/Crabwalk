-- Field-form IDs are assigned by the database, not typed by admins: <REGION>-P-001 (places), -S- (stays),
-- -F- (eateries), DISH-001 (dishes). The region prefix comes from the listing's taluka (regions.code_prefix),
-- numbering continues from the highest ID already used for that prefix. Rows that already have an ID keep it.

create or replace function app.assign_entry_code() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _letter text := case tg_table_name when 'places' then 'P' when 'stays' then 'S' when 'eateries' then 'F' end;
  _prefix text;
  _n int;
begin
  if new.code is not null then
    return new;
  end if;
  if tg_table_name = 'dishes' then
    _prefix := 'DISH';
  else
    select r.code_prefix || '-' || _letter into _prefix
    from public.talukas t join public.regions r on r.id = t.region_id
    where t.id = new.taluka_id;
    if _prefix is null then
      return new;
    end if;
  end if;
  -- One writer per prefix at a time, so two new rows never get the same number.
  perform pg_advisory_xact_lock(hashtext('entry_code:' || _prefix));
  execute format(
    'select coalesce(max(right(code, 3)::int), 0) + 1 from public.%I where code like %L',
    tg_table_name, _prefix || '-%'
  ) into _n;
  new.code := _prefix || '-' || lpad(_n::text, 3, '0');
  return new;
end;
$$;
revoke all on function app.assign_entry_code() from public, anon, authenticated;

create trigger assign_code before insert or update on public.places
  for each row execute function app.assign_entry_code();
create trigger assign_code before insert or update on public.stays
  for each row execute function app.assign_entry_code();
create trigger assign_code before insert or update on public.eateries
  for each row execute function app.assign_entry_code();
create trigger assign_code before insert or update on public.dishes
  for each row execute function app.assign_entry_code();

-- Backfill, oldest first so the numbers follow the order entries were added.
do $$
declare
  _t text;
  _id uuid;
begin
  foreach _t in array array['places', 'stays', 'eateries', 'dishes'] loop
    for _id in execute format('select id from public.%I where code is null order by created_at, id', _t) loop
      execute format('update public.%I set code = null where id = $1', _t) using _id;
    end loop;
  end loop;
end;
$$;
