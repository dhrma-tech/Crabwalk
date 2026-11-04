-- P11 step E: log a spend and its shares in one transaction (the shares-sum check runs at commit, and PostgREST
-- writes one table per request). Security invoker: RLS decides (owner and editors write spends).
create function public.log_trip_expense(
  _trip uuid,
  _amount integer,
  _category public.expense_category,
  _label text,
  _paid_by uuid,
  _spent_on date,
  _stop_id uuid,
  _split_custom boolean,
  _shares jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  _id uuid;
begin
  insert into public.trip_expenses (trip_id, amount, category, label, paid_by, spent_on, stop_id, split_custom)
  values (_trip, _amount, _category, nullif(trim(_label), ''), _paid_by, _spent_on, _stop_id, _split_custom)
  returning id into _id;
  insert into public.trip_expense_shares (expense_id, trip_id, member_id, amount)
  select _id, _trip, (s ->> 'member_id')::uuid, (s ->> 'amount')::integer
  from jsonb_array_elements(_shares) s;
  return _id;
end;
$$;
revoke execute on function public.log_trip_expense(uuid, integer, public.expense_category, text, uuid, date, uuid, boolean, jsonb) from public, anon;
grant execute on function public.log_trip_expense(uuid, integer, public.expense_category, text, uuid, date, uuid, boolean, jsonb) to authenticated;
