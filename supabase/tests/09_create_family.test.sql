-- T07: public.create_family(family_name, display_name, color) (PRD FAM-1, D-06).
-- Proves the function is security definer with a pinned search_path, who may call it
-- (authenticated only), what it creates, and who is refused: anon, a token with no
-- sub, and anyone who already belongs to a family. Bad input creates nothing.
--
-- People (made up): riley and jordan have no family; alex owns F1; sam is a
-- non-owner adult of F1.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alex@example.test', '{"full_name":"Alex Example"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'sam@example.test', '{"full_name":"Sam Example"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'jordan@example.test', '{"full_name":"Jordan Example"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'riley@example.test', '{"full_name":"Riley Example"}');
insert into public.families (id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000f1', 'Example Family One', '00000000-0000-0000-0000-0000000000a1');
insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Alex', 'adult', '#2563eb'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2', 'Sam', 'adult', '#16a34a');

-- ---------------------------------------------------------------------------
-- Shape and privileges
-- ---------------------------------------------------------------------------
select has_function('public', 'create_family', array['text', 'text', 'text'], 'create_family exists');
select function_returns('public', 'create_family', array['text', 'text', 'text'], 'uuid', 'it returns a uuid');
select is(
  (select prosecdef from pg_proc where oid = 'public.create_family(text,text,text)'::regprocedure),
  true, 'it is security definer');
select ok(
  (select proconfig from pg_proc where oid = 'public.create_family(text,text,text)'::regprocedure)
    @> array['search_path=""'],
  'its search_path is pinned to empty');
select is(has_function_privilege('authenticated', 'public.create_family(text,text,text)', 'execute'),
  true, 'authenticated can execute it');
select is(has_function_privilege('anon', 'public.create_family(text,text,text)', 'execute'),
  false, 'anon cannot execute it');
select is(
  (select exists (
     select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid = 'public.create_family(text,text,text)'::regprocedure and a.grantee = 0)),
  false, 'PUBLIC cannot execute it');

-- ---------------------------------------------------------------------------
-- riley creates a family
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';

select lives_ok(
  $$select public.create_family('  The Smiths ', ' Riley ', '#16a34a')$$,
  'riley creates a family');

reset role;
select is(
  (select count(*)::int from public.families where created_by = '00000000-0000-0000-0000-0000000000a4'),
  1, 'exactly one family was created by riley');
select is(
  (select name from public.families where created_by = '00000000-0000-0000-0000-0000000000a4'),
  'The Smiths', 'the family name is trimmed');
select is(
  (select count(*)::int from public.family_members where user_id = '00000000-0000-0000-0000-0000000000a4'),
  1, 'exactly one member row exists for riley');
select results_eq(
  $$select m.member_type, m.member_name, m.calendar_color,
           m.family_id = (select f.id from public.families f where f.created_by = m.user_id)
    from public.family_members m where m.user_id = '00000000-0000-0000-0000-0000000000a4'$$,
  $$values ('adult'::text, 'Riley'::text, '#16a34a'::text, true)$$,
  'riley is an adult of the new family with the chosen name and color');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select is(
  private.is_family_owner((select id from public.families where created_by = '00000000-0000-0000-0000-0000000000a4')),
  true, 'riley is the owner of the new family');
select is((select count(*)::int from public.families), 1, 'riley can read her family, and only hers');

-- A second call is refused and creates nothing.
select throws_ok(
  $$select public.create_family('Second Family', 'Riley', '#2563eb')$$,
  '23505', null, 'riley cannot create a second family');
reset role;
select is(
  (select count(*)::int from public.families where created_by = '00000000-0000-0000-0000-0000000000a4'),
  1, 'still exactly one family created by riley');

-- ---------------------------------------------------------------------------
-- Existing members are refused, owner or not
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select throws_ok(
  $$select public.create_family('Alex Again', 'Alex', '#2563eb')$$,
  '23505', null, 'alex, an owner, cannot create another family');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$select public.create_family('Sam Family', 'Sam', '#2563eb')$$,
  '23505', null, 'sam, a non-owner adult, cannot create a family');
reset role;
select is(
  (select count(*)::int from public.families
    where created_by in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')),
  1, 'no extra family was created by alex or sam');

-- ---------------------------------------------------------------------------
-- Callers without a user
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok(
  $$select public.create_family('Anon Family', 'Anon', '#2563eb')$$,
  '42501', null, 'anon cannot call it');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$select public.create_family('No Sub Family', 'Nobody', '#2563eb')$$,
  '42501', 'not authenticated', 'a token with no sub is refused');
reset role;

-- ---------------------------------------------------------------------------
-- Bad input: refused by the table checks, nothing is created
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$select public.create_family('   ', 'Jordan', '#2563eb')$$,
  '23514', null, 'a blank family name is refused');
select throws_ok(
  $$select public.create_family(repeat('x', 81), 'Jordan', '#2563eb')$$,
  '23514', null, 'an 81-character family name is refused');
select throws_ok(
  $$select public.create_family('Jordan Family', '   ', '#2563eb')$$,
  '23514', null, 'a blank display name is refused');
select throws_ok(
  $$select public.create_family('Jordan Family', repeat('y', 81), '#2563eb')$$,
  '23514', null, 'an 81-character display name is refused');
select throws_ok(
  $$select public.create_family('Jordan Family', 'Jordan', '#ZZZZZZ')$$,
  '23514', null, 'a color that is not hex is refused');
select throws_ok(
  $$select public.create_family('Jordan Family', 'Jordan', '#16A34A')$$,
  '23514', null, 'an uppercase hex color is refused');
reset role;
select is(
  (select count(*)::int from public.families where created_by = '00000000-0000-0000-0000-0000000000a3'),
  0, 'no family was created by jordan after the refused calls');
select is(
  (select count(*)::int from public.family_members where user_id = '00000000-0000-0000-0000-0000000000a3'),
  0, 'no member row was created for jordan');

-- ---------------------------------------------------------------------------
-- Clients still cannot insert families or adult members directly
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$insert into public.families (name, created_by) values ('Direct', '00000000-0000-0000-0000-0000000000a3')$$,
  '42501', null, 'a direct insert into families is still refused');
reset role;

select * from finish();
rollback;
