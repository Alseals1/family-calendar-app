-- T04: the docs/prd.md section 8 privacy scenarios, one block each, plus the
-- section 4 rule that a visibility change takes effect for every query at once.
--
-- People (all made up): A = alex and B = sam, adults of F1; C = jordan, adult
-- of F2. K1 is a child in F1.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'alex@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'sam@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'jordan@example.test');
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
   '00000000-0000-0000-0000-0000000000a3', 'Jordan', 'adult', '#4d5e6f');

set local role authenticated;

-- A creates one event of each visibility, and assigns K1 to the private one,
-- through the same policies the app uses
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into public.events (id, family_id, created_by, title, start_time, end_time, visibility, calendar_type) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Doctor visit', '2026-12-01 15:00+00', '2026-12-01 16:00+00', 'private', 'personal'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Work dinner', '2026-12-02 18:00+00', '2026-12-02 20:00+00', 'shared', 'personal'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000f1',
   '00000000-0000-0000-0000-0000000000a1', 'Swim lesson', '2026-12-03 15:00+00', '2026-12-03 16:00+00', 'family', 'family');
insert into public.event_assignments (id, event_id, family_member_id, family_id) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000f1');

-- ---------------------------------------------------------------------------
-- Scenario 1: A creates a private event; B (same family) cannot select it,
-- its assignments, or update or delete it, by any query.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';

select is_empty(
  $$select id from public.events where id = '00000000-0000-0000-0000-0000000000e1'$$,
  'scenario 1: B cannot select A''s private event by id');
select is_empty(
  $$select id from public.events where title = 'Doctor visit'
     or (start_time, end_time) overlaps ('2026-12-01 15:30+00'::timestamptz, '2026-12-01 15:45+00'::timestamptz)$$,
  'scenario 1: B cannot find A''s private event by title or time (no busy block)');
select is_empty(
  $$select id from public.event_assignments where event_id = '00000000-0000-0000-0000-0000000000e1'$$,
  'scenario 1: B cannot select the private event''s assignments');
select is_empty(
  $$update public.events set title = 'changed by B' where id = '00000000-0000-0000-0000-0000000000e1' returning id$$,
  'scenario 1: B cannot update A''s private event');
select is_empty(
  $$delete from public.events where id = '00000000-0000-0000-0000-0000000000e1' returning id$$,
  'scenario 1: B cannot delete A''s private event');
select is_empty(
  $$delete from public.event_assignments where event_id = '00000000-0000-0000-0000-0000000000e1' returning id$$,
  'scenario 1: B cannot delete the private event''s assignments');

reset role;
select is(
  (select title from public.events where id = '00000000-0000-0000-0000-0000000000e1'),
  'Doctor visit', 'scenario 1: A''s private event is unchanged and still exists');
select is(
  (select count(*) from public.event_assignments where event_id = '00000000-0000-0000-0000-0000000000e1'),
  1::bigint, 'scenario 1: the private event''s assignment is still there');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Scenario 2: A creates a shared event; B can view it.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select title from public.events where id = '00000000-0000-0000-0000-0000000000e2'$$,
  array['Work dinner'], 'scenario 2: B can view A''s shared event');

-- ---------------------------------------------------------------------------
-- Scenario 3: A creates a family event; A and B can both view it.
-- ---------------------------------------------------------------------------

select results_eq(
  $$select title from public.events where id = '00000000-0000-0000-0000-0000000000e3'$$,
  array['Swim lesson'], 'scenario 3: B can view A''s family event');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$select title from public.events where id = '00000000-0000-0000-0000-0000000000e3'$$,
  array['Swim lesson'], 'scenario 3: A can view A''s family event');

-- ---------------------------------------------------------------------------
-- Scenario 4: a user from another family sees none of A's events, of any
-- visibility.
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';

select is_empty(
  $$select id from public.events where created_by = '00000000-0000-0000-0000-0000000000a1'$$,
  'scenario 4: C sees none of A''s events');
select is_empty(
  $$select id from public.events where id in ('00000000-0000-0000-0000-0000000000e1',
    '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e3')$$,
  'scenario 4: C cannot select A''s private, shared or family event by id');
select is_empty(
  $$select id from public.event_assignments where family_id = '00000000-0000-0000-0000-0000000000f1'$$,
  'scenario 4: C sees none of F1''s assignments');

-- ---------------------------------------------------------------------------
-- A visibility change takes effect at once (docs/prd.md section 4)
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select isnt_empty(
  $$select id from public.events where id = '00000000-0000-0000-0000-0000000000e2'$$,
  'flip: B sees A''s shared event before the change');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select isnt_empty(
  $$update public.events set visibility = 'private'
    where id = '00000000-0000-0000-0000-0000000000e2' returning id$$,
  'flip: A changes the shared event to private');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is_empty(
  $$select id from public.events where id = '00000000-0000-0000-0000-0000000000e2'$$,
  'flip: B''s next select returns no row for it');

select * from finish();
rollback;
