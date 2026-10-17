-- updated_at trigger on every public table that has the column
do $$
declare
  r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app.set_updated_at()',
      r.table_name
    );
  end loop;
end;
$$;

-- Config defaults (tunable; G8, G9, G10)
insert into public.correction_factors (type, multiplier, active_months, notes) values
  ('ghat', 1.40, null, 'G8 default'),
  ('coastal', 1.20, null, 'G8 default'),
  ('monsoon', 1.25, '{6,7,8,9}', 'G8 default; extra multiplier, 1 Jun - 30 Sep');

insert into public.alert_type_ttl (type, ttl_hours) values
  ('road_condition', 24),
  ('ghat', 24),
  ('landslide', 48),
  ('closure', 48);

insert into public.app_config (key, value, notes) values
  ('live_crowd_min_users', '5', 'G10: distinct users (scans/check-ins) for "Live"'),
  ('live_crowd_window_min', '60', 'G10: window in minutes'),
  ('rating_new_threshold', '10', 'Verdict gauge shows "New" below this many votes');
