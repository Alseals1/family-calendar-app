-- T03: checks, unique keys and foreign keys on the Phase 1 schema.
-- Made-up people only. Fixed UUIDs:
--   users   a1 Alex, a2 Sam (family F1), a3 Jordan (family F2), a4 Riley (no family)
--   members b1 Alex, b2 Sam, c1 child (F1); b3 Jordan, c2 child (F2)
--   events  e1 (F1), e2 (F2), e3 (F1, deleted in a test)
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- Fixtures, as postgres (the table owner, so RLS does not apply)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alex@example.test', '{"full_name":"Alex Example"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'sam@example.test', '{"full_name":"Sam Example"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'jordan@example.test', '{"full_name":"Jordan Example"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'riley@example.test', '{"full_name":"Riley Example"}');

insert into public.families (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', 'Example Family One', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f2', 'Example Family Two', '00000000-0000-0000-0000-0000000000a3');

insert into public.family_members (id, family_id, user_id, member_name, member_type, calendar_color) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Alex', 'adult', '#1a2b3c'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a2', 'Sam', 'adult', '#2b3c4d'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1',
   null, 'Kid One', 'child', '#3c4d5e'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000a3', 'Jordan', 'adult', '#4d5e6f'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f2',
   null, 'Kid Two', 'child', '#5e6f70');

insert into public.events (id, family_id, created_by, title, start_time, end_time, visibility, calendar_type) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Swim lesson',
   '2026-12-01 15:00+00', '2026-12-01 16:00+00', 'family', 'family'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000a3', 'Dentist',
   '2026-12-02 15:00+00', '2026-12-02 16:00+00', 'private', 'personal'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Piano',
   '2026-12-03 15:00+00', '2026-12-03 16:00+00', 'family', 'family');

insert into public.family_invitations (id, family_id, invited_email, invited_by, invitation_token_hash) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1',
   'casey@example.test', '00000000-0000-0000-0000-0000000000a1', repeat('a', 64)),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000f2',
   'morgan@example.test', '00000000-0000-0000-0000-0000000000a3', repeat('b', 64));

-- profiles
select throws_ok(
  $$update public.profiles set full_name = '   ' where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'profiles: blank full_name is rejected');
select throws_ok(
  $$update public.profiles set full_name = repeat('x', 101) where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '23514', null, 'profiles: a 101-character full_name is rejected');

-- families
select throws_ok(
  $$insert into public.families (name, created_by) values ('', '00000000-0000-0000-0000-0000000000a4')$$,
  '23514', null, 'families: blank name is rejected');
select throws_ok(
  $$insert into public.families (name, created_by) values (repeat('x', 81), '00000000-0000-0000-0000-0000000000a4')$$,
  '23514', null, 'families: an 81-character name is rejected');

-- family_members
select throws_ok(
  $$insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a4', 'Riley', 'child', '#123456')$$,
  '23514', null, 'family_members: a child with a user_id is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', null, 'Riley', 'adult', '#123456')$$,
  '23514', null, 'family_members: an adult without a user_id is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', 'Kid', 'child', 'red')$$,
  '23514', null, 'family_members: colour "red" is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', 'Kid', 'child', '#fff')$$,
  '23514', null, 'family_members: short colour "#fff" is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', 'Kid', 'child', '#ABCDEF')$$,
  '23514', null, 'family_members: upper-case colour is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', 'Kid', 'child', '#12345g')$$,
  '23514', null, 'family_members: non-hex colour is rejected');
select lives_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', 'Kid', 'child', '#1a2b3c')$$,
  'family_members: colour "#1a2b3c" is accepted');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', 'Rex', 'pet', '#1a2b3c')$$,
  '23514', null, 'family_members: member_type "pet" is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', '  ', 'child', '#1a2b3c')$$,
  '23514', null, 'family_members: blank member_name is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', repeat('x', 81), 'child', '#1a2b3c')$$,
  '23514', null, 'family_members: an 81-character member_name is rejected');
select throws_ok(
  $$insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a2', 'Sam', 'adult', '#1a2b3c')$$,
  '23505', null, 'family_members: a user cannot join a second family (D-06)');

-- family_invitations
select throws_ok(
  $$insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash)
    values ('00000000-0000-0000-0000-0000000000f1', 'Casey@Example.TEST',
            '00000000-0000-0000-0000-0000000000a1', repeat('c', 64))$$,
  '23505', null, 'family_invitations: a second pending invite for the same email (any case) is rejected');
update public.family_invitations set status = 'revoked' where id = '00000000-0000-0000-0000-0000000000d1';
select lives_ok(
  $$insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash)
    values ('00000000-0000-0000-0000-0000000000f1', 'casey@example.test',
            '00000000-0000-0000-0000-0000000000a1', repeat('d', 64))$$,
  'family_invitations: a new pending invite is accepted once the old one is revoked');
select throws_ok(
  $$insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash, status)
    values ('00000000-0000-0000-0000-0000000000f1', 'taylor@example.test',
            '00000000-0000-0000-0000-0000000000a1', repeat('e', 64), 'sent')$$,
  '23514', null, 'family_invitations: status "sent" is rejected');
select throws_ok(
  $$insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash)
    values ('00000000-0000-0000-0000-0000000000f1', 'taylor@example.test',
            '00000000-0000-0000-0000-0000000000a1', repeat('b', 64))$$,
  '23505', null, 'family_invitations: a duplicate token hash is rejected');
select throws_ok(
  $$insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash)
    values ('00000000-0000-0000-0000-0000000000f1', 'taylor@example.test',
            '00000000-0000-0000-0000-0000000000a1', 'abc')$$,
  '23514', null, 'family_invitations: a short token hash is rejected');
select throws_ok(
  $$insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash)
    values ('00000000-0000-0000-0000-0000000000f1', 'taylor@example.test',
            '00000000-0000-0000-0000-0000000000a1', repeat('A', 64))$$,
  '23514', null, 'family_invitations: an upper-case hex token hash is rejected');
select is(
  (select expires_at from public.family_invitations where id = '00000000-0000-0000-0000-0000000000d2'),
  now() + interval '7 days',
  'family_invitations: expires_at defaults to 7 days ahead');
select is(
  (select status from public.family_invitations where id = '00000000-0000-0000-0000-0000000000d2'),
  'pending',
  'family_invitations: status defaults to pending');

-- events
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Same',
            '2026-12-05 10:00+00', '2026-12-05 10:00+00', 'shared', 'personal')$$,
  '23514', null, 'events: end_time equal to start_time is rejected');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Backwards',
            '2026-12-05 10:00+00', '2026-12-05 09:00+00', 'shared', 'personal')$$,
  '23514', null, 'events: end_time before start_time is rejected');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Mismatch',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'family', 'personal')$$,
  '23514', null, 'events: family visibility on the personal calendar is rejected (D-07)');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Mismatch',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'private', 'family')$$,
  '23514', null, 'events: private visibility on the family calendar is rejected (D-07)');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Mismatch',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'shared', 'family')$$,
  '23514', null, 'events: shared visibility on the family calendar is rejected (D-07)');
select lives_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Shared',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'shared', 'personal')$$,
  'events: shared personal event is accepted');
select lives_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Family',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'family', 'family')$$,
  'events: family event on the family calendar is accepted');
select lives_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, is_all_day, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Holiday',
            '2026-12-24 00:00+00', '2026-12-27 00:00+00', true, 'family', 'family')$$,
  'events: a multi-day all-day event at 00:00 UTC is accepted (D-08)');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, is_all_day, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Holiday',
            '2026-12-24 05:00+00', '2026-12-25 00:00+00', true, 'family', 'family')$$,
  '23514', null, 'events: an all-day event starting off 00:00 UTC is rejected (D-08)');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, is_all_day, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Holiday',
            '2026-12-24 00:00+00', '2026-12-24 12:00+00', true, 'family', 'family')$$,
  '23514', null, 'events: an all-day event ending off 00:00 UTC is rejected (D-08)');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '   ',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'shared', 'personal')$$,
  '23514', null, 'events: blank title is rejected');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', repeat('x', 201),
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'shared', 'personal')$$,
  '23514', null, 'events: a 201-character title is rejected');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, description, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Long',
            repeat('x', 5001), '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'shared', 'personal')$$,
  '23514', null, 'events: a 5001-character description is rejected');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, location, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Far',
            repeat('x', 301), '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'shared', 'personal')$$,
  '23514', null, 'events: a 301-character location is rejected');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Public',
            '2026-12-05 10:00+00', '2026-12-05 11:00+00', 'public', 'personal')$$,
  '23514', null, 'events: visibility "public" is rejected');

-- event_assignments: only members of the event's own family
select lives_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000f1')$$,
  'event_assignments: a member of the event''s family can be assigned');
select throws_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '23503', null, 'event_assignments: another family''s member is rejected (row carries the event''s family)');
select throws_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c2',
            '00000000-0000-0000-0000-0000000000f2')$$,
  '23503', null, 'event_assignments: another family''s member is rejected (row carries the member''s family)');
select throws_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '23505', null, 'event_assignments: the same member twice on one event is rejected');

insert into public.event_assignments (event_id, family_member_id, family_id) values
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-0000000000f1');
delete from public.events where id = '00000000-0000-0000-0000-0000000000e3';
select is(
  (select count(*) from public.event_assignments where event_id = '00000000-0000-0000-0000-0000000000e3'),
  0::bigint, 'event_assignments: deleting the event deletes its assignments');

delete from public.family_members where id = '00000000-0000-0000-0000-0000000000c1';
select is(
  (select count(*) from public.event_assignments where family_member_id = '00000000-0000-0000-0000-0000000000c1'),
  0::bigint, 'event_assignments: deleting the member deletes their assignments');

-- Deleting a family deletes what belongs to it
insert into public.event_assignments (event_id, family_member_id, family_id) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000c2',
   '00000000-0000-0000-0000-0000000000f2');
delete from public.families where id = '00000000-0000-0000-0000-0000000000f2';
select is(
  (select count(*) from public.family_members where family_id = '00000000-0000-0000-0000-0000000000f2'),
  0::bigint, 'families: deleting a family deletes its members');
select is(
  (select count(*) from public.events where family_id = '00000000-0000-0000-0000-0000000000f2'),
  0::bigint, 'families: deleting a family deletes its events');
select is(
  (select count(*) from public.family_invitations where family_id = '00000000-0000-0000-0000-0000000000f2'),
  0::bigint, 'families: deleting a family deletes its invitations');
select is(
  (select count(*) from public.event_assignments where family_id = '00000000-0000-0000-0000-0000000000f2'),
  0::bigint, 'families: deleting a family deletes its event assignments');

select * from finish();
rollback;
