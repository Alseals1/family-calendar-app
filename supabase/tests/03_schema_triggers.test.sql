-- T03: triggers (profile on signup, updated_at, immutable event owner) and
-- deny-all RLS: anon can read and write nothing, and authenticated can read
-- nothing in the four tables that have no policies yet. The events and
-- event_assignments policies are tested in 05_rls_events and
-- 06_privacy_scenarios. Made-up people only. Fixed UUIDs as in
-- 02_schema_constraints.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Profile on signup
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alex@example.test', '{"full_name":"Alex Example"}');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 'jordan@example.test');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'sam@example.test', '{"full_name":"   "}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a4', 'riley@example.test',
   jsonb_build_object('full_name', repeat('x', 150)));

select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  'Alex Example', 'signup: the profile takes full_name from the metadata');
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'jordan', 'signup: without metadata the profile uses the email''s local part');
select is(
  (select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'),
  'sam', 'signup: a blank full_name falls back to the email''s local part');
select is(
  (select char_length(full_name) from public.profiles where id = '00000000-0000-0000-0000-0000000000a4'),
  100, 'signup: a long full_name is cut to 100 characters');

-- Fixtures for the rest, as postgres
insert into public.families (id, name, created_by, updated_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'Example Family One',
   '00000000-0000-0000-0000-0000000000a1', '2000-01-01 00:00+00'),
  ('00000000-0000-0000-0000-0000000000f2', 'Example Family Two',
   '00000000-0000-0000-0000-0000000000a3', '2000-01-01 00:00+00');
insert into public.family_members (id, family_id, user_id, member_name, member_type, calendar_color, updated_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Alex', 'adult', '#1a2b3c', '2000-01-01 00:00+00'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a2', 'Sam', 'adult', '#2b3c4d', '2000-01-01 00:00+00'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1',
   null, 'Kid One', 'child', '#3c4d5e', '2000-01-01 00:00+00'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000a3', 'Jordan', 'adult', '#4d5e6f', '2000-01-01 00:00+00');
insert into public.events (id, family_id, created_by, title, start_time, end_time, visibility, calendar_type, updated_at) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Swim lesson',
   '2026-12-01 15:00+00', '2026-12-01 16:00+00', 'family', 'family', '2000-01-01 00:00+00');
insert into public.event_assignments (event_id, family_member_id, family_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-0000000000f1');
insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash) values
  ('00000000-0000-0000-0000-0000000000f1', 'casey@example.test',
   '00000000-0000-0000-0000-0000000000a1', repeat('a', 64));

-- updated_at is set on update
alter table public.profiles disable trigger profiles_set_updated_at;
update public.profiles set updated_at = '2000-01-01 00:00+00'
  where id = '00000000-0000-0000-0000-0000000000a1';
alter table public.profiles enable trigger profiles_set_updated_at;
update public.profiles set full_name = 'Alex Renamed' where id = '00000000-0000-0000-0000-0000000000a1';
select is(
  (select updated_at from public.profiles where id = '00000000-0000-0000-0000-0000000000a1'),
  now(), 'profiles: updated_at is set on update');

update public.families set name = 'Renamed Family' where id = '00000000-0000-0000-0000-0000000000f1';
select is(
  (select updated_at from public.families where id = '00000000-0000-0000-0000-0000000000f1'),
  now(), 'families: updated_at is set on update');

update public.family_members set member_name = 'Kiddo' where id = '00000000-0000-0000-0000-0000000000c1';
select is(
  (select updated_at from public.family_members where id = '00000000-0000-0000-0000-0000000000c1'),
  now(), 'family_members: updated_at is set on update');

update public.events set location = 'Pool' where id = '00000000-0000-0000-0000-0000000000e1';
select is(
  (select updated_at from public.events where id = '00000000-0000-0000-0000-0000000000e1'),
  now(), 'events: updated_at is set on update');

-- events.created_by and events.family_id cannot change
select throws_ok(
  $$update public.events set created_by = '00000000-0000-0000-0000-0000000000a2'
    where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'P0001', 'events.created_by and events.family_id cannot be changed',
  'events: created_by cannot be changed');
select throws_ok(
  $$update public.events set family_id = '00000000-0000-0000-0000-0000000000f2'
    where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'P0001', 'events.created_by and events.family_id cannot be changed',
  'events: family_id cannot be changed');
select lives_ok(
  $$update public.events set title = 'Swim lesson (moved)'
    where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'events: other columns can still be changed');

-- Rows exist in every table, so the zero counts below mean RLS hid them
select ok(
  (select count(*) from public.profiles) > 0
  and (select count(*) from public.families) > 0
  and (select count(*) from public.family_members) > 0
  and (select count(*) from public.family_invitations) > 0
  and (select count(*) from public.events) > 0
  and (select count(*) from public.event_assignments) > 0,
  'every table has rows before the RLS checks');

-- Deny-all on the tables without policies, as a signed-in adult who owns the rows
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select is((select count(*) from public.profiles), 0::bigint,
  'authenticated cannot read profiles (no policies yet)');
select is((select count(*) from public.families), 0::bigint,
  'authenticated cannot read families (no policies yet)');
select is((select count(*) from public.family_members), 0::bigint,
  'authenticated cannot read family_members (no policies yet)');
select is((select count(*) from public.family_invitations), 0::bigint,
  'authenticated cannot read family_invitations (no policies yet)');

-- Deny-all as a visitor who is not signed in
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*) from public.profiles), 0::bigint, 'anon cannot read profiles');
select is((select count(*) from public.families), 0::bigint, 'anon cannot read families');
select is((select count(*) from public.family_members), 0::bigint, 'anon cannot read family_members');
select is((select count(*) from public.family_invitations), 0::bigint,
  'anon cannot read family_invitations');
select is((select count(*) from public.events), 0::bigint, 'anon cannot read events');
select is((select count(*) from public.event_assignments), 0::bigint,
  'anon cannot read event_assignments');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Sneaky',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'private', 'personal')$$,
  '42501', null, 'anon cannot insert events');

reset role;

-- The row is still there: the denied writes changed nothing
select is(
  (select title from public.events where id = '00000000-0000-0000-0000-0000000000e1'),
  'Swim lesson (moved)', 'the denied writes left the event as it was');

select * from finish();
rollback;
