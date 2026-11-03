-- P11 plan workspace (docs/P11 Plan workspace.md, DECISIONS P11-0…3): tripmates and roles, invite links and
-- email invites, lists + notes + checklists, expenses with equal or custom shares. Tripmates read the whole trip;
-- the owner and editors write stops, budget, lists, notes and spends; trip settings stay owner-only.
-- Expenses and tripmate names never reach the LLM (AI firewall): no Crabby tool reads these tables.

create type public.trip_role as enum ('owner', 'editor', 'viewer');
create type public.list_item_kind as enum ('place', 'note', 'check');
create type public.expense_category as enum ('stay', 'food', 'fuel', 'entry', 'activities', 'other');

-- ---------------------------------------------------------------- tripmates
-- A row with an account has a role; a name-only tripmate (a friend who never signs in, P11-2) has neither.
create table public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role public.trip_role,
  joined_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (trip_id, user_id),
  unique (trip_id, id),
  check ((user_id is null) = (role is null))
);
create index trip_members_user_id_idx on public.trip_members (user_id);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  role public.trip_role not null check (role in ('editor', 'viewer')),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index trip_invites_trip_id_idx on public.trip_invites (trip_id);

-- ---------------------------------------------------------------- lists, notes
create table public.trip_lists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index trip_lists_trip_id_idx on public.trip_lists (trip_id);

-- `place` items point at a published place, stay or eatery (polymorphic, like trip_stops); `note` and `check`
-- items carry text, `check` also a done flag.
create table public.trip_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.trip_lists (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  position smallint not null default 0,
  kind public.list_item_kind not null,
  entity_type public.entity_type,
  entity_id uuid,
  body text check (char_length(body) <= 2000),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (
    (kind = 'place' and entity_type in ('place', 'stay', 'eatery') and entity_id is not null and body is null)
    or (kind <> 'place' and entity_id is null and entity_type is null and body is not null)
  )
);
create index trip_list_items_list_id_idx on public.trip_list_items (list_id);
create index trip_list_items_trip_id_idx on public.trip_list_items (trip_id);

create table public.trip_notes (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------- expenses
create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  amount integer not null check (amount between 1 and 10000000),
  category public.expense_category not null default 'other',
  label text check (char_length(label) <= 120),
  stop_id uuid references public.trip_stops (id) on delete set null,
  paid_by uuid not null,
  spent_on date,
  split_custom boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (trip_id, id),
  -- Deferred: a trip delete cascades members and spends in either order; removing a tripmate who still has
  -- spends or shares fails at commit.
  foreign key (trip_id, paid_by) references public.trip_members (trip_id, id) deferrable initially deferred
);
create index trip_expenses_trip_id_idx on public.trip_expenses (trip_id);

-- One row per tripmate in the split. Equal splits store the computed share (remainder rupees go to the first
-- tripmates), so balances only ever sum shares.
create table public.trip_expense_shares (
  expense_id uuid not null,
  trip_id uuid not null,
  member_id uuid not null,
  amount integer not null check (amount >= 0),
  primary key (expense_id, member_id),
  foreign key (trip_id, expense_id) references public.trip_expenses (trip_id, id) on delete cascade,
  foreign key (trip_id, member_id) references public.trip_members (trip_id, id) deferrable initially deferred
);
create index trip_expense_shares_trip_id_idx on public.trip_expense_shares (trip_id);

-- Shares must add up to the spend, checked at commit so a spend and its shares can be written in any order.
create function app.check_expense_shares() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  _id uuid;
begin
  if tg_table_name = 'trip_expenses' then
    _id := new.id;
  elsif tg_op = 'DELETE' then
    _id := old.expense_id;
  else
    _id := new.expense_id;
  end if;
  if exists (
    select 1 from public.trip_expenses e
    where e.id = _id
      and e.amount <> coalesce((select sum(s.amount) from public.trip_expense_shares s where s.expense_id = e.id), 0)
  ) then
    raise exception 'expense shares must add up to the amount' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger shares_sum after insert or update on public.trip_expenses
  deferrable initially deferred for each row execute function app.check_expense_shares();
create constraint trigger shares_sum after insert or update or delete on public.trip_expense_shares
  deferrable initially deferred for each row execute function app.check_expense_shares();

-- ---------------------------------------------------------------- roles
-- The owner is trips.owner_id; everyone else is a trip_members row with a role.
create function app.trip_role(_trip uuid) returns public.trip_role
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.trips where id = _trip and owner_id = auth.uid()) then 'owner'::public.trip_role
    else (select role from public.trip_members where trip_id = _trip and user_id = auth.uid())
  end;
$$;
create function app.is_trip_member(_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.trip_role(_trip) is not null;
$$;
create function app.can_edit_trip(_trip uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.trip_role(_trip) in ('owner', 'editor');
$$;

-- Owner's tripmate row (paid-by / split target), created with the trip; backfilled for existing trips.
create function app.trip_owner_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.trip_members (trip_id, user_id, display_name, role)
  select new.id, new.owner_id,
         left(coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1), 'Me'), 60), 'owner'
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = new.owner_id
  on conflict (trip_id, user_id) do nothing;
  return null;
end;
$$;
create trigger trip_owner_member after insert on public.trips
  for each row execute function app.trip_owner_member();

insert into public.trip_members (trip_id, user_id, display_name, role)
select t.id, t.owner_id, left(coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1), 'Me'), 60), 'owner'
from public.trips t join auth.users u on u.id = t.owner_id left join public.profiles p on p.id = u.id
on conflict (trip_id, user_id) do nothing;

-- At most 20 tripmates per trip, owner included (P11-3); the owner row can't be removed or demoted.
create function app.trip_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform 1 from public.trips where id = new.trip_id for update;
    if (select count(*) from public.trip_members where trip_id = new.trip_id) >= 20 then
      raise exception 'a trip has at most 20 tripmates' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role is distinct from 'owner' or new.user_id is distinct from old.user_id)
     and exists (select 1 from public.trips where id = old.trip_id) then
    raise exception 'the owner stays on the trip' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and old.role is distinct from 'owner' then
    raise exception 'only the trip creator is owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger trip_members_guard before insert or update or delete on public.trip_members
  for each row execute function app.trip_members_guard();

-- ---------------------------------------------------------------- invites
-- Signed-in visitor opens an edit/view link: join with that role, or keep the higher role if already in.
create function public.redeem_trip_invite(_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  _inv public.trip_invites;
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'sign in to join a trip' using errcode = '42501';
  end if;
  select * into _inv from public.trip_invites where token = _token and revoked_at is null;
  if _inv.id is null then
    raise exception 'invalid invite' using errcode = '42501';
  end if;
  insert into public.trip_members (trip_id, user_id, display_name, role)
  select _inv.trip_id, _uid, left(coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1), 'Tripmate'), 60), _inv.role
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = _uid
  on conflict (trip_id, user_id) do update
    set role = case when public.trip_members.role = 'viewer' then excluded.role else public.trip_members.role end;
  return _inv.trip_id;
end;
$$;
revoke execute on function public.redeem_trip_invite(text) from public, anon;
grant execute on function public.redeem_trip_invite(text) to authenticated;

-- Owner adds a tripmate by email (P11-1). Returns true when the address has an account (added straight away),
-- false when it doesn't (the page then opens the owner's mail app with an invite link). 30 lookups an hour per
-- owner, so it can't be used to probe which addresses have accounts.
create function public.add_trip_member_by_email(_trip uuid, _email text, _role public.trip_role) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  _uid uuid;
begin
  if app.trip_role(_trip) is distinct from 'owner' then
    raise exception 'only the owner invites by email' using errcode = '42501';
  end if;
  if _role not in ('editor', 'viewer') then
    raise exception 'bad role' using errcode = '22023';
  end if;
  if not public.rate_take(encode(extensions.digest('trip-email:' || auth.uid()::text, 'sha256'), 'hex'), 30, 3600) then
    raise exception 'too many invites, try again later' using errcode = '54000';
  end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email));
  if _uid is null then
    return false;
  end if;
  insert into public.trip_members (trip_id, user_id, display_name, role)
  select _trip, _uid, left(coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1), 'Tripmate'), 60), _role
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = _uid
  on conflict (trip_id, user_id) do update set role = excluded.role
    where public.trip_members.role <> 'owner';
  return true;
end;
$$;
revoke execute on function public.add_trip_member_by_email(uuid, text, public.trip_role) from public, anon;
grant execute on function public.add_trip_member_by_email(uuid, text, public.trip_role) to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.trip_lists enable row level security;
alter table public.trip_list_items enable row level security;
alter table public.trip_notes enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_expense_shares enable row level security;

-- Existing trip tables: tripmates read; editors also write stops and the budget (trip settings stay owner-only).
create policy "member read" on public.trips for select to authenticated using (app.is_trip_member(id));
create policy "member read" on public.trip_stops for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_stops for all to authenticated
  using (app.can_edit_trip(trip_id)) with check (app.can_edit_trip(trip_id));
create policy "member read" on public.trip_budget for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_budget for all to authenticated
  using (app.can_edit_trip(trip_id)) with check (app.can_edit_trip(trip_id));

-- Tripmates: everyone in the trip sees the list. The owner manages everyone; editors add, rename and remove
-- name-only tripmates; anyone but the owner can leave.
create policy "member read" on public.trip_members for select to authenticated using (app.is_trip_member(trip_id));
create policy "owner all" on public.trip_members for all to authenticated
  using (app.trip_role(trip_id) = 'owner') with check (app.trip_role(trip_id) = 'owner');
create policy "editor name-only" on public.trip_members for all to authenticated
  using (app.can_edit_trip(trip_id) and user_id is null)
  with check (app.can_edit_trip(trip_id) and user_id is null);
create policy "leave" on public.trip_members for delete to authenticated using (user_id = auth.uid());

create policy "owner all" on public.trip_invites for all to authenticated
  using (app.trip_role(trip_id) = 'owner') with check (app.trip_role(trip_id) = 'owner' and created_by = auth.uid());

create policy "member read" on public.trip_lists for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_lists for all to authenticated
  using (app.can_edit_trip(trip_id)) with check (app.can_edit_trip(trip_id));
create policy "member read" on public.trip_list_items for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_list_items for all to authenticated
  using (app.can_edit_trip(trip_id))
  with check (app.can_edit_trip(trip_id) and exists (select 1 from public.trip_lists l where l.id = list_id and l.trip_id = trip_list_items.trip_id));
create policy "member read" on public.trip_notes for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_notes for all to authenticated
  using (app.can_edit_trip(trip_id)) with check (app.can_edit_trip(trip_id));
create policy "member read" on public.trip_expenses for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_expenses for all to authenticated
  using (app.can_edit_trip(trip_id)) with check (app.can_edit_trip(trip_id));
create policy "member read" on public.trip_expense_shares for select to authenticated using (app.is_trip_member(trip_id));
create policy "editor write" on public.trip_expense_shares for all to authenticated
  using (app.can_edit_trip(trip_id)) with check (app.can_edit_trip(trip_id));

revoke all on public.trip_members, public.trip_invites, public.trip_lists, public.trip_list_items,
  public.trip_notes, public.trip_expenses, public.trip_expense_shares from anon;

create trigger set_updated_at before update on public.trip_members for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.trip_lists for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.trip_list_items for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.trip_notes for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.trip_expenses for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------- realtime
-- Postgres changes for the workspace (P11 §6); Realtime applies the RLS above per subscriber.
alter publication supabase_realtime add table
  public.trip_stops, public.trip_members, public.trip_lists, public.trip_list_items, public.trip_notes,
  public.trip_expenses, public.trip_expense_shares;
