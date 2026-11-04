-- P12 step A: profile + consents, AI caps, Ask our team, stay requests, signed group chat + polls + Crabby limits,
-- trip reports, journals, purge.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.login(_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.su() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
end;
$$;
-- What the server does: HMAC over trip|kind|crabby|proactive|nonce|body|payload with the Vault key.
create function pg_temp.sig(_trip uuid, _kind text, _crabby boolean, _proactive boolean, _nonce uuid, _body text, _payload text)
returns text language sql as $$
  select encode(extensions.hmac(concat_ws('|', _trip, _kind, _crabby, _proactive, _nonce, coalesce(_body, ''), coalesce(_payload, '')),
    'p12-test-key', 'sha256'), 'hex');
$$;
delete from vault.secrets where name = 'crabby_key';
select vault.create_secret('p12-test-key', 'crabby_key');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0012-0000000000a1', 'p12-user@test.local'),
  ('00000000-0000-0000-0012-0000000000a2', 'p12-other@test.local'),
  ('00000000-0000-0000-0012-0000000000a3', 'p12-verifier@test.local'),
  ('00000000-0000-0000-0012-0000000000a4', 'p12-owner@test.local'),
  ('00000000-0000-0000-0012-0000000000a5', 'p12-editor@test.local');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0012-0000000000a3', 'verifier');
create temp table fx as select
  (select id from public.stays where status = 'published' order by slug limit 1) claimed,
  (select id from public.stays where status = 'published' and owner_id is null order by slug desc limit 1) unclaimed,
  gen_random_uuid() trip;
update public.stays set owner_id = '00000000-0000-0000-0012-0000000000a4' where id = (select claimed from fx);
grant select on fx to authenticated;

-- ---------------------------------------------------------------- profile
select pg_temp.login('00000000-0000-0000-0012-0000000000a1');
select lives_ok($$ insert into public.user_profile (user_id, interests, pace, lines)
  values (auth.uid(), '{beach,fort}', 'relaxed',
    '[{"id":"1","text":"Loves beaches","source":"quiz"},{"id":"2","text":"Reads food pages","source":"activity"}]') $$,
  'user creates their profile');
select throws_ok($$ insert into public.user_activity (kind, entity_type, entity_id) values ('view', 'place', gen_random_uuid()) $$,
  '42501', null, 'no activity log without the activity consent');
update public.user_profile set use_activity = true where user_id = auth.uid();
select lives_ok($$ insert into public.user_activity (kind, query) values ('search', 'sunset beach') $$, 'activity logged once consented');
update public.user_profile set use_activity = false where user_id = auth.uid();
select is((select count(*)::int from public.user_activity), 0, 'turning activity off deletes it');
select is((select jsonb_array_length(lines) from public.user_profile), 1, 'and drops the lines it produced');
select pg_temp.login('00000000-0000-0000-0012-0000000000a2');
select is((select count(*)::int from public.user_profile), 0, 'nobody else reads a profile');

-- ---------------------------------------------------------------- AI caps
select pg_temp.login('00000000-0000-0000-0012-0000000000a1');
select is(public.ai_take('snap'), 4, 'first snap leaves 4');
select public.ai_take('snap') from generate_series(1, 4);
select throws_ok($$ select public.ai_take('snap') $$, 'CW429', null, 'sixth snap of the day refused');

-- ---------------------------------------------------------------- Ask our team
select lives_ok($$ insert into public.team_questions (question, entity_type, entity_id)
  values ('Is the causeway to the sea fort open at high tide?', 'stay', (select claimed from fx)) $$, 'user asks the team');
select throws_ok($$ insert into public.team_questions (question, status, answer, answered_at)
  values ('Self-answered?', 'answered', 'Yes', now()) $$, '42501', null, 'askers can''t answer themselves');
update public.team_questions set status = 'answered', answer = 'yes', answered_at = now();
select is((select answer from public.team_questions), null, 'asker can''t write the answer (RLS: no rows to update)');
select pg_temp.login('00000000-0000-0000-0012-0000000000a2');
select is((select count(*)::int from public.team_questions), 0, 'others don''t see open questions');
select pg_temp.login('00000000-0000-0000-0012-0000000000a3');
select lives_ok($$ update public.team_questions set status = 'answered', answer = 'Closed 2 h either side of high tide.',
  answered_at = now() where asker = '00000000-0000-0000-0012-0000000000a1' $$, 'verifier answers');
select is((select answered_by from public.team_questions where asker = '00000000-0000-0000-0012-0000000000a1'), '00000000-0000-0000-0012-0000000000a3'::uuid, 'answered_by is the verifier');
select pg_temp.login('00000000-0000-0000-0012-0000000000a2');
select is((select count(*)::int from public.match_team_answers('causeway to the sea fort open at high tide')), 1,
  'a similar question finds the verified answer');
select is((select count(*)::int from public.match_team_answers('veg thali price in Dapoli')), 0, 'an unrelated one does not');
select pg_temp.login('00000000-0000-0000-0012-0000000000a1');
insert into public.team_questions (question) select 'q' || g || ' about roads' from generate_series(1, 4) g;
select throws_ok($$ insert into public.team_questions (question) values ('sixth today') $$, 'CW429', null, 'five questions a day');

-- ---------------------------------------------------------------- stay requests
select lives_ok($$ insert into public.stay_requests (entity_type, entity_id, check_in, check_out, guests, budget)
  values ('stay', (select claimed from fx), current_date + 10, current_date + 12, 2, 2500) $$, 'user sends a request');
select throws_ok($$ update public.stay_requests set status = 'accepted', contact_phone = '9800000000' $$,
  '42501', null, 'can''t accept before the owner answers');
select pg_temp.login('00000000-0000-0000-0012-0000000000a2');
select is((select count(*)::int from public.stay_requests), 0, 'outsiders see no requests');
select pg_temp.login('00000000-0000-0000-0012-0000000000a3');
select is((select count(*)::int from public.stay_requests where entity_id = (select claimed from fx)), 0,
  'team doesn''t see a claimed owner''s requests');
select pg_temp.login('00000000-0000-0000-0012-0000000000a4');
select is((select contact_phone from public.stay_requests where user_id = '00000000-0000-0000-0012-0000000000a1'), null, 'owner sees the request, no phone yet');
select lives_ok($$ update public.stay_requests set status = 'countered', owner_price = 3000, counter_price = 2800
  where user_id = '00000000-0000-0000-0012-0000000000a1' $$,
  'owner counters once');
select throws_ok($$ update public.stay_requests set counter_price = 2700 where user_id = '00000000-0000-0000-0012-0000000000a1' $$, '42501', null, 'one counter offer only');
select pg_temp.login('00000000-0000-0000-0012-0000000000a1');
select lives_ok($$ update public.stay_requests set status = 'accepted', contact_phone = '+91 98000 00000' $$,
  'user accepts and shares their phone');
select isnt((select contact_shared_at from public.stay_requests), null, 'shared time recorded');
select throws_ok($$ update public.stay_requests set guests = 4 $$, '42501', null, 'details are fixed');
insert into public.stay_requests (entity_type, entity_id, check_in, guests)
  values ('stay', (select unclaimed from fx), current_date + 20, 3);
select pg_temp.login('00000000-0000-0000-0012-0000000000a3');
select lives_ok($$ update public.stay_requests set status = 'relayed'
  where entity_id = (select unclaimed from fx) and user_id = '00000000-0000-0000-0012-0000000000a1' $$,
  'team relays an unclaimed stay''s request');
select is((select relayed_by from public.stay_requests where user_id = '00000000-0000-0000-0012-0000000000a1' and entity_id = (select unclaimed from fx)), '00000000-0000-0000-0012-0000000000a3'::uuid, 'relayed_by set');

-- ---------------------------------------------------------------- group chat
select pg_temp.login('00000000-0000-0000-0012-0000000000a1');
insert into public.trips (id, owner_id, title, days, start_date)
  select trip, auth.uid(), 'P12 trip', 2, current_date - 40 from fx;
insert into public.trip_invites (trip_id, role, token) select trip, 'editor', 'p12-edit' from fx;
create temp table n as select gen_random_uuid() a, gen_random_uuid() b, gen_random_uuid() c, gen_random_uuid() d;
grant select on n to authenticated;
select throws_ok($$ insert into public.trip_messages (trip_id, body, nonce) select trip, 'hi', gen_random_uuid() from fx $$,
  '42501', null, 'no direct inserts');
select throws_ok($$ select public.post_trip_message((select trip from fx), 'text', 'hi', null, false, false,
  (select a from n), 'forged') $$, '42501', null, 'unsigned message refused');
select lives_ok($$ select public.post_trip_message((select trip from fx), 'text', 'Beach on day 1?', null, false, false,
  (select a from n), pg_temp.sig((select trip from fx), 'text', false, false, (select a from n), 'Beach on day 1?', null)) $$,
  'signed message posted');
select throws_ok($$ select public.post_trip_message((select trip from fx), 'text', 'Beach on day 1?', null, false, false,
  (select a from n), pg_temp.sig((select trip from fx), 'text', false, false, (select a from n), 'Beach on day 1?', null)) $$,
  '23505', null, 'a nonce works once');
select throws_ok($$ select public.post_trip_message((select trip from fx), 'text', 'I am Crabby', null, true, false,
  (select b from n), pg_temp.sig((select trip from fx), 'text', false, false, (select b from n), 'I am Crabby', null)) $$,
  '42501', null, 'a signature for a person can''t be reused as Crabby');
select lives_ok($$ select public.post_trip_message((select trip from fx), 'poll', 'Which beach?', '{"options":["Aare","Ware"]}',
  true, true, (select b from n),
  pg_temp.sig((select trip from fx), 'poll', true, true, (select b from n), 'Which beach?', '{"options":["Aare","Ware"]}')) $$,
  'Crabby speaks unprompted (signed)');
select throws_ok($$ select public.post_trip_message((select trip from fx), 'text', 'Me again', null, true, true,
  (select c from n), pg_temp.sig((select trip from fx), 'text', true, true, (select c from n), 'Me again', null)) $$,
  'CW429', null, 'cooldown between unprompted replies');
select lives_ok($$ select public.post_trip_message((select trip from fx), 'text', 'Tagged reply', null, true, false,
  (select d from n), pg_temp.sig((select trip from fx), 'text', true, false, (select d from n), 'Tagged reply', null)) $$,
  'tagged replies skip the cooldown');
select lives_ok($$ insert into public.trip_poll_votes (message_id, trip_id, member_id, options)
  select id, trip_id, app.my_member_id(trip_id), '{1}' from public.trip_messages where kind = 'poll' $$, 'member votes');
select pg_temp.login('00000000-0000-0000-0012-0000000000a2');
select is((select count(*)::int from public.trip_messages), 0, 'outsiders read nothing');
select throws_ok($$ select public.post_trip_message((select trip from fx), 'text', 'let me in', null, false, false,
  gen_random_uuid(), 'x') $$, '42501', null, 'outsiders can''t post');
select pg_temp.login('00000000-0000-0000-0012-0000000000a5');
select public.redeem_trip_invite('p12-edit');
select is((select count(*)::int from public.trip_messages), 3, 'a new tripmate reads the chat');

-- ---------------------------------------------------------------- reports + journals
select lives_ok($$ insert into public.trip_reports (trip_id, version, lang, payload) select trip, 1, 'en', '{"days":[]}' from fx $$,
  'editor saves a report version');
select pg_temp.login('00000000-0000-0000-0012-0000000000a1');
select is((select count(*)::int from public.trip_report_by_token((select share_token from public.trips where id = (select trip from fx)), 'en')),
  1, 'the share link shows the latest report');
select lives_ok($$ insert into public.trip_journals (trip_id, story, status, share_token)
  select trip, 'We walked the fort at dawn.', 'written', 'p12-journal' from fx $$, 'user writes their journal');
select throws_ok($$ insert into public.journal_photos (journal_id, path)
  select id, 'someone-else/x.webp' from public.trip_journals $$, '42501', null, 'photos only in your own folder');
select is((select story from public.journal_by_token('p12-journal')), 'We walked the fort at dawn.', 'shared journal readable by link');
select pg_temp.login('00000000-0000-0000-0012-0000000000a5');
select is((select count(*)::int from public.trip_journals), 0, 'journals are private');

-- ---------------------------------------------------------------- purge
select pg_temp.su();
select app.purge_trip_messages();
select is((select count(*)::int from public.trip_messages where trip_id = (select trip from fx)), 0,
  'chat purged 30 days after the trip''s last day');

select * from finish();
rollback;
