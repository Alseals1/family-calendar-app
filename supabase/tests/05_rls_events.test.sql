-- T04: RLS on events and event_assignments (docs/plan.md section 4,
-- docs/prd.md section 4, D-03). Proves who can and who cannot read and
-- write each kind of event, and that assignments follow their event.
--
-- People (all made up): A = alex (owner, adult of F1), B = sam (adult of F1),
-- C = jordan (owner, adult of F2), D = riley (no family).
-- K1 = child in F1, K2 = child in F2.
--
-- Events: e1 A private, e2 A shared, e3 A family, e4 A family (for delete),
-- e5 B private (all F1); e6 C private, e7 C shared, e8 C family (all F2).
-- Assignments: d1..d4 = K1 on e1..e4, d8 = K2 on e8.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- ---------------------------------------------------------------------------
-- Fixtures, as postgres
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alex@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'sam@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'jordan@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'riley@example.test');
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
   '00000000-0000-0000-0000-0000000000a1', 'A private', '2026-12-01 15:00+00', '2026-12-01 16:00+00', 'private', 'personal'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'A shared', '2026-12-02 15:00+00', '2026-12-02 16:00+00', 'shared', 'personal'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'A family', '2026-12-03 15:00+00', '2026-12-03 16:00+00', 'family', 'family'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'A family two', '2026-12-04 15:00+00', '2026-12-04 16:00+00', 'family', 'family'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a2', 'B private', '2026-12-05 15:00+00', '2026-12-05 16:00+00', 'private', 'personal'),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000a3', 'C private', '2026-12-06 15:00+00', '2026-12-06 16:00+00', 'private', 'personal'),
  ('00000000-0000-0000-0000-0000000000e7', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000a3', 'C shared', '2026-12-07 15:00+00', '2026-12-07 16:00+00', 'shared', 'personal'),
  ('00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-0000000000f2',
   '00000000-0000-0000-0000-0000000000a3', 'C family', '2026-12-08 15:00+00', '2026-12-08 16:00+00', 'family', 'family');
insert into public.event_assignments (id, event_id, family_member_id, family_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e2',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e3',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000e4',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1'),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000e8',
   '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000f2');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- A: sees all of A's own events, never B's private one
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

select set_eq(
  'select id from public.events',
  array['00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2',
        '00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000e4']::uuid[],
  'A sees exactly A''s four events (not B''s private event, nothing from F2)');
select is_empty(
  $$select id from public.events where id = '00000000-0000-0000-0000-0000000000e5'$$,
  'A cannot select B''s private event');
select set_eq(
  'select id from public.event_assignments',
  array['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
        '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d4']::uuid[],
  'A sees the assignments of A''s own events');
select lives_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'A new',
            '2026-12-10 10:00+00', '2026-12-10 11:00+00', 'private', 'personal')$$,
  'A can insert an event of A''s own into F1');
select is_empty(
  $$update public.event_assignments set family_member_id = family_member_id returning id$$,
  'no one can update an assignment, not even the event''s creator');

-- ---------------------------------------------------------------------------
-- B: A's private event and its assignments are invisible and untouchable
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select is_empty(
  $$select id from public.events where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'B cannot select A''s private event by id');
select is_empty(
  $$select id from public.events
    where created_by = '00000000-0000-0000-0000-0000000000a1' and visibility = 'private'$$,
  'B cannot find A''s private event by filter');
select is((select count(*) from public.events where id = '00000000-0000-0000-0000-0000000000e1'), 0::bigint,
  'B cannot count A''s private event');
select is_empty(
  $$select id from public.event_assignments where event_id = '00000000-0000-0000-0000-0000000000e1'$$,
  'B cannot select the assignments of A''s private event');
select set_eq(
  'select id from public.events',
  array['00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3',
        '00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000e5']::uuid[],
  'B sees A''s shared and family events and B''s own private event, nothing else');
select set_eq(
  'select id from public.event_assignments',
  array['00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3',
        '00000000-0000-0000-0000-0000000000d4']::uuid[],
  'B sees the assignments of A''s shared and family events only');

select is_empty(
  $$update public.events set title = 'hacked' where id = '00000000-0000-0000-0000-0000000000e1' returning id$$,
  'B cannot update A''s private event');
select is_empty(
  $$delete from public.events where id = '00000000-0000-0000-0000-0000000000e1' returning id$$,
  'B cannot delete A''s private event');
select is_empty(
  $$update public.events set title = 'hacked' where id = '00000000-0000-0000-0000-0000000000e2' returning id$$,
  'B cannot update A''s shared event');
select is_empty(
  $$delete from public.events where id = '00000000-0000-0000-0000-0000000000e2' returning id$$,
  'B cannot delete A''s shared event');

-- D-03: any adult of the family may edit or delete a family event
select isnt_empty(
  $$update public.events set title = 'A family (edited by B)'
    where id = '00000000-0000-0000-0000-0000000000e3' returning id$$,
  'B can update A''s family event');
select throws_ok(
  $$update public.events set visibility = 'private', calendar_type = 'personal'
    where id = '00000000-0000-0000-0000-0000000000e3'$$,
  '42501', null, 'B cannot change A''s family event to private');
select throws_ok(
  $$update public.events set visibility = 'shared', calendar_type = 'personal'
    where id = '00000000-0000-0000-0000-0000000000e3'$$,
  '42501', null, 'B cannot change A''s family event to shared');
select isnt_empty(
  $$delete from public.events where id = '00000000-0000-0000-0000-0000000000e4' returning id$$,
  'B can delete A''s family event');

-- Insert rules
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Forged',
            '2026-12-11 10:00+00', '2026-12-11 11:00+00', 'shared', 'personal')$$,
  '42501', null, 'B cannot insert an event with A as created_by');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a2', 'Wrong family',
            '2026-12-11 10:00+00', '2026-12-11 11:00+00', 'private', 'personal')$$,
  '42501', null, 'B cannot insert an event into F2');
select lives_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2', 'B family',
            '2026-12-12 10:00+00', '2026-12-12 11:00+00', 'family', 'family')$$,
  'B can insert an event of B''s own into F1');

-- Assignments follow the event's edit rule
select lives_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000b2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  'B can assign a member to A''s family event');
select throws_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '42501', null, 'B cannot assign a member to A''s private event');
select throws_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b2',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '42501', null, 'B cannot assign a member to A''s shared event');
select is_empty(
  $$delete from public.event_assignments where id = '00000000-0000-0000-0000-0000000000d1' returning id$$,
  'B cannot delete an assignment of A''s private event');
select is_empty(
  $$delete from public.event_assignments where id = '00000000-0000-0000-0000-0000000000d2' returning id$$,
  'B cannot delete an assignment of A''s shared event');
select isnt_empty(
  $$delete from public.event_assignments where id = '00000000-0000-0000-0000-0000000000d3' returning id$$,
  'B can delete an assignment of A''s family event');
select is_empty(
  $$update public.event_assignments set family_member_id = family_member_id returning id$$,
  'B cannot update any assignment');

-- The denied writes changed nothing; the allowed ones did
reset role;
select is((select title from public.events where id = '00000000-0000-0000-0000-0000000000e1'), 'A private',
  'A''s private event is unchanged after B''s attempts');
select is((select title from public.events where id = '00000000-0000-0000-0000-0000000000e2'), 'A shared',
  'A''s shared event is unchanged after B''s attempts');
select is((select visibility from public.events where id = '00000000-0000-0000-0000-0000000000e3'), 'family',
  'A''s family event is still a family event');
select is((select title from public.events where id = '00000000-0000-0000-0000-0000000000e3'),
  'A family (edited by B)', 'B''s edit of A''s family event was saved');
select is((select count(*) from public.events where id = '00000000-0000-0000-0000-0000000000e4'), 0::bigint,
  'B''s delete of A''s family event removed it');
select is(
  (select count(*) from public.event_assignments
   where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')),
  2::bigint, 'the assignments of A''s private and shared events are still there');
select is((select count(*) from public.events where title = 'Forged'), 0::bigint,
  'no event was created with a forged created_by');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- C: another family sees nothing of F1 and can touch nothing in it
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';

select is_empty(
  $$select id from public.events where family_id = '00000000-0000-0000-0000-0000000000f1'$$,
  'C sees no F1 event of any visibility');
select set_eq(
  'select id from public.events',
  array['00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000e7',
        '00000000-0000-0000-0000-0000000000e8']::uuid[],
  'C sees exactly C''s own F2 events');
select set_eq(
  'select id from public.event_assignments',
  array['00000000-0000-0000-0000-0000000000d8']::uuid[],
  'C sees only the F2 assignment');
select is_empty(
  $$update public.events set title = 'hacked' where id = '00000000-0000-0000-0000-0000000000e3' returning id$$,
  'C cannot update F1''s family event');
select is_empty(
  $$delete from public.events where id = '00000000-0000-0000-0000-0000000000e3' returning id$$,
  'C cannot delete F1''s family event');
select throws_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e8', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000f2')$$,
  '23503', null, 'C cannot assign F1''s child to an F2 event (composite foreign key)');
select throws_ok(
  $$insert into public.event_assignments (event_id, family_member_id, family_id)
    values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000c1',
            '00000000-0000-0000-0000-0000000000f1')$$,
  '42501', null, 'C cannot add an assignment to an F1 event');

-- ---------------------------------------------------------------------------
-- D: no family, so no events and no assignments
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';

select is_empty('select id from public.events', 'D sees no events');
select is_empty('select id from public.event_assignments', 'D sees no assignments');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a4', 'Intruder',
            '2026-12-11 10:00+00', '2026-12-11 11:00+00', 'family', 'family')$$,
  '42501', null, 'D cannot insert an event into F1');

-- ---------------------------------------------------------------------------
-- anon: nothing at all
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is_empty('select id from public.events', 'anon sees no events');
select is_empty('select id from public.event_assignments', 'anon sees no assignments');
select throws_ok(
  $$insert into public.events (family_id, created_by, title, start_time, end_time, visibility, calendar_type)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Anon',
            '2026-12-11 10:00+00', '2026-12-11 11:00+00', 'family', 'family')$$,
  '42501', null, 'anon cannot insert events');
select is_empty(
  $$update public.events set title = 'anon' returning id$$,
  'anon cannot update events');
select is_empty(
  $$delete from public.events returning id$$,
  'anon cannot delete events');

reset role;
select is((select count(*) from public.events where family_id = '00000000-0000-0000-0000-0000000000f1'), 6::bigint,
  'F1 holds e1, e2, e3, e5 and the two new events: only the allowed delete removed a row');

select * from finish();
rollback;
