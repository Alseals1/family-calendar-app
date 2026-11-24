-- T04: the RLS helper functions (docs/plan.md section 4, "Helper functions").
-- They live in `private`, run as security definer with an empty search_path,
-- are stable, and only `authenticated` may execute them.
--
-- People (all made up): A = alex (owner, adult of F1), B = sam (adult of F1),
-- C = jordan (owner, adult of F2), D = riley (no family). K1 is a child in F1.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select has_function('private', 'is_family_adult', array['uuid'], 'private.is_family_adult(uuid) exists');
select has_function('private', 'is_family_owner', array['uuid'], 'private.is_family_owner(uuid) exists');
select has_function('private', 'my_family_id', array[]::name[], 'private.my_family_id() exists');

select is_definer('private', 'is_family_adult', array['uuid'], 'is_family_adult is security definer');
select is_definer('private', 'is_family_owner', array['uuid'], 'is_family_owner is security definer');
select is_definer('private', 'my_family_id', array[]::name[], 'my_family_id is security definer');

select volatility_is('private', 'is_family_adult', array['uuid'], 'stable', 'is_family_adult is stable');
select volatility_is('private', 'is_family_owner', array['uuid'], 'stable', 'is_family_owner is stable');
select volatility_is('private', 'my_family_id', array[]::name[], 'stable', 'my_family_id is stable');

select ok(
  (select 'search_path=""' = any(proconfig) from pg_proc where oid = 'private.is_family_adult(uuid)'::regprocedure),
  'is_family_adult sets an empty search_path');
select ok(
  (select 'search_path=""' = any(proconfig) from pg_proc where oid = 'private.is_family_owner(uuid)'::regprocedure),
  'is_family_owner sets an empty search_path');
select ok(
  (select 'search_path=""' = any(proconfig) from pg_proc where oid = 'private.my_family_id()'::regprocedure),
  'my_family_id sets an empty search_path');

-- ---------------------------------------------------------------------------
-- Privileges: authenticated may run the three helpers and nothing else in
-- private; anon and public may run none of them
-- ---------------------------------------------------------------------------

select ok(has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated can use the private schema');
select ok(not has_schema_privilege('anon', 'private', 'usage'),
  'anon cannot use the private schema');

select ok(has_function_privilege('authenticated', 'private.is_family_adult(uuid)', 'execute'),
  'authenticated can execute is_family_adult');
select ok(has_function_privilege('authenticated', 'private.is_family_owner(uuid)', 'execute'),
  'authenticated can execute is_family_owner');
select ok(has_function_privilege('authenticated', 'private.my_family_id()', 'execute'),
  'authenticated can execute my_family_id');

select ok(
  not has_function_privilege('anon', 'private.is_family_adult(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.is_family_owner(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.my_family_id()', 'execute'),
  'anon cannot execute any helper');
select ok(
  not has_function_privilege('public', 'private.is_family_adult(uuid)', 'execute')
  and not has_function_privilege('public', 'private.is_family_owner(uuid)', 'execute')
  and not has_function_privilege('public', 'private.my_family_id()', 'execute'),
  'public cannot execute any helper');

select ok(not has_function_privilege('authenticated', 'private.set_updated_at()', 'execute'),
  'authenticated cannot execute private.set_updated_at');
select ok(not has_function_privilege('authenticated', 'private.handle_new_user()', 'execute'),
  'authenticated cannot execute private.handle_new_user');
select ok(not has_function_privilege('authenticated', 'private.prevent_event_owner_change()', 'execute'),
  'authenticated cannot execute private.prevent_event_owner_change');

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
   '00000000-0000-0000-0000-0000000000a3', 'Jordan', 'adult', '#4d5e6f');

-- ---------------------------------------------------------------------------
-- Behaviour, as each person
-- ---------------------------------------------------------------------------

set local role authenticated;

-- A: owner and adult of F1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select ok(private.is_family_adult('00000000-0000-0000-0000-0000000000f1'), 'A is an adult of F1');
select ok(not private.is_family_adult('00000000-0000-0000-0000-0000000000f2'), 'A is not an adult of F2');
select ok(private.is_family_owner('00000000-0000-0000-0000-0000000000f1'), 'A owns F1');
select ok(not private.is_family_owner('00000000-0000-0000-0000-0000000000f2'), 'A does not own F2');
select is(private.my_family_id(), '00000000-0000-0000-0000-0000000000f1'::uuid, 'my_family_id is F1 for A');

-- B: adult of F1, not the owner
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select ok(private.is_family_adult('00000000-0000-0000-0000-0000000000f1'), 'B is an adult of F1');
select ok(not private.is_family_owner('00000000-0000-0000-0000-0000000000f1'), 'B does not own F1');
select is(private.my_family_id(), '00000000-0000-0000-0000-0000000000f1'::uuid, 'my_family_id is F1 for B');

-- C: adult and owner of F2 only
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select ok(not private.is_family_adult('00000000-0000-0000-0000-0000000000f1'), 'C is not an adult of F1');
select ok(not private.is_family_owner('00000000-0000-0000-0000-0000000000f1'), 'C does not own F1');
select is(private.my_family_id(), '00000000-0000-0000-0000-0000000000f2'::uuid, 'my_family_id is F2 for C');

-- D: no family
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select ok(not private.is_family_adult('00000000-0000-0000-0000-0000000000f1'), 'D is not an adult of F1');
select ok(not private.is_family_owner('00000000-0000-0000-0000-0000000000f1'), 'D does not own F1');
select is(private.my_family_id(), null::uuid, 'my_family_id is null for D');

-- anon cannot call the helpers at all
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$select private.is_family_adult('00000000-0000-0000-0000-0000000000f1')$$,
  '42501', null, 'anon cannot call is_family_adult');

select * from finish();
rollback;
