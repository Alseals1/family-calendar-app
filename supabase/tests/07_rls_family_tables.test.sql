-- T04: RLS and column grants on profiles, families, family_members and
-- family_invitations (docs/plan.md section 4). Proves who can and who cannot
-- read and write each table, and that update is limited to the safe columns.
--
-- People (all made up): A = alex (owner, adult of F1), B = sam (adult of F1),
-- C = jordan (owner, adult of F2), D = riley (no family).
-- Members: b1 A, b2 B, c1 K1 (child) in F1; b3 C, c2 K2 (child) in F2.
-- Invitations: i1 and i4 pending and i3 accepted in F1; i2 pending in F2.
begin;
create extension if not exists pgtap with schema extensions;
select plan(73);

-- ---------------------------------------------------------------------------
-- Fixtures, as postgres
-- ---------------------------------------------------------------------------

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
insert into public.family_invitations (id, family_id, invited_email, invited_by, invitation_token_hash, status) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000f1',
   'casey@example.test', '00000000-0000-0000-0000-0000000000a1', repeat('1', 64), 'pending'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000f1',
   'morgan@example.test', '00000000-0000-0000-0000-0000000000a1', repeat('3', 64), 'accepted'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000f1',
   'taylor@example.test', '00000000-0000-0000-0000-0000000000a2', repeat('4', 64), 'pending'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000f2',
   'quinn@example.test', '00000000-0000-0000-0000-0000000000a3', repeat('2', 64), 'pending');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- profiles: self, or someone who shares my family
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select set_eq('select id from public.profiles',
  array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2']::uuid[],
  'profiles: A sees A and B only');
select is_empty(
  $$select id from public.profiles where id in ('00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a4')$$,
  'profiles: A cannot see C (another family) or D (no family)');
select isnt_empty(
  $$update public.profiles set full_name = 'Alex Renamed', avatar_url = 'f1/alex.png'
    where id = '00000000-0000-0000-0000-0000000000a1' returning id$$,
  'profiles: A can update A''s own name and avatar');
select is_empty(
  $$update public.profiles set full_name = 'hacked' where id = '00000000-0000-0000-0000-0000000000a2' returning id$$,
  'profiles: A cannot update B''s profile');
select throws_ok(
  $$update public.profiles set id = id where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'profiles: A cannot update id (column privilege)');
select throws_ok(
  $$update public.profiles set created_at = now() where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'profiles: A cannot update created_at (column privilege)');
select throws_ok(
  $$insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-0000000000a1', 'dup')$$,
  '42501', null, 'profiles: no one can insert a profile through the API');
select is_empty(
  $$delete from public.profiles where id = '00000000-0000-0000-0000-0000000000a1' returning id$$,
  'profiles: no one can delete a profile through the API');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select set_eq('select id from public.profiles',
  array['00000000-0000-0000-0000-0000000000a3']::uuid[],
  'profiles: C sees only C (no one else in F2 has a login)');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select set_eq('select id from public.profiles',
  array['00000000-0000-0000-0000-0000000000a4']::uuid[],
  'profiles: D sees only D');

-- ---------------------------------------------------------------------------
-- families: adults see their family; only the owner renames or deletes it
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select set_eq('select id from public.families',
  array['00000000-0000-0000-0000-0000000000f1']::uuid[], 'families: A sees F1 only');
select isnt_empty(
  $$update public.families set name = 'Renamed by A' where id = '00000000-0000-0000-0000-0000000000f1' returning id$$,
  'families: the owner can rename F1');
select throws_ok(
  $$update public.families set created_by = '00000000-0000-0000-0000-0000000000a2'
    where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '42501', null, 'families: created_by cannot be updated (column privilege)');
select throws_ok(
  $$insert into public.families (name, created_by) values ('Second family', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'families: A cannot insert a family through the API');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select set_eq('select id from public.families',
  array['00000000-0000-0000-0000-0000000000f1']::uuid[], 'families: B sees F1 only');
select is_empty(
  $$update public.families set name = 'Renamed by B' where id = '00000000-0000-0000-0000-0000000000f1' returning id$$,
  'families: B (not the owner) cannot rename F1');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select set_eq('select id from public.families',
  array['00000000-0000-0000-0000-0000000000f2']::uuid[], 'families: C sees F2 only');
select is_empty(
  $$update public.families set name = 'Renamed by C' where id = '00000000-0000-0000-0000-0000000000f1' returning id$$,
  'families: C cannot rename F1');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select is_empty('select id from public.families', 'families: D sees none');
select throws_ok(
  $$insert into public.families (name, created_by) values ('Riley family', '00000000-0000-0000-0000-0000000000a4')$$,
  '42501', null, 'families: D cannot insert a family through the API');

-- ---------------------------------------------------------------------------
-- family_members: adults see their family; any adult manages children; an
-- adult edits only their own adult row; adult rows come and go by RPC only
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select set_eq('select id from public.family_members',
  array['00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2',
        '00000000-0000-0000-0000-0000000000c1']::uuid[],
  'family_members: A sees all three F1 members');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select set_eq('select id from public.family_members',
  array['00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c2']::uuid[],
  'family_members: C sees only F2 members');
select is_empty(
  $$update public.family_members set member_name = 'hacked' where id = '00000000-0000-0000-0000-0000000000c1' returning id$$,
  'family_members: C cannot update F1''s child');
select is_empty(
  $$delete from public.family_members where id = '00000000-0000-0000-0000-0000000000c1' returning id$$,
  'family_members: C cannot delete F1''s child');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', 'Sneaky kid', 'child', '#111111')$$,
  '42501', null, 'family_members: C cannot add a child to F1');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select is_empty('select id from public.family_members', 'family_members: D sees none');
select throws_ok(
  $$insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a4',
            'Riley', 'adult', '#222222')$$,
  '42501', null, 'family_members: D cannot add itself to F1 as an adult');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select lives_ok(
  $$insert into public.family_members (id, family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000f1',
            'Kid Three', 'child', '#333333')$$,
  'family_members: B (any adult) can add a child to F1');
select throws_ok(
  $$insert into public.family_members (family_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f2', 'Wrong family kid', 'child', '#444444')$$,
  '42501', null, 'family_members: B cannot add a child to F2');
select throws_ok(
  $$insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a4',
            'Riley', 'adult', '#555555')$$,
  '42501', null, 'family_members: B cannot add an adult (RPC only)');
select isnt_empty(
  $$update public.family_members set member_name = 'Kiddo', calendar_color = '#0a0b0c', avatar_url = 'f1/k1.png'
    where id = '00000000-0000-0000-0000-0000000000c1' returning id$$,
  'family_members: B can update a child of F1');
select isnt_empty(
  $$update public.family_members set calendar_color = '#abcdef'
    where id = '00000000-0000-0000-0000-0000000000b2' returning id$$,
  'family_members: B can update B''s own adult row');
select is_empty(
  $$update public.family_members set member_name = 'hacked'
    where id = '00000000-0000-0000-0000-0000000000b1' returning id$$,
  'family_members: B cannot update A''s adult row');
select throws_ok(
  $$update public.family_members set family_id = '00000000-0000-0000-0000-0000000000f2'
    where id = '00000000-0000-0000-0000-0000000000b2'$$,
  '42501', null, 'family_members: B cannot move B''s row to another family (column privilege)');
select throws_ok(
  $$update public.family_members set user_id = '00000000-0000-0000-0000-0000000000a4'
    where id = '00000000-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'family_members: B cannot set user_id on a child (column privilege)');
select throws_ok(
  $$update public.family_members set member_type = 'child'
    where id = '00000000-0000-0000-0000-0000000000b2'$$,
  '42501', null, 'family_members: B cannot change member_type (column privilege)');
select is_empty(
  $$delete from public.family_members where id = '00000000-0000-0000-0000-0000000000b2' returning id$$,
  'family_members: B cannot delete B''s own adult row (RPC only)');
select is_empty(
  $$delete from public.family_members where id = '00000000-0000-0000-0000-0000000000b1' returning id$$,
  'family_members: B cannot delete A''s adult row');
select isnt_empty(
  $$delete from public.family_members where id = '00000000-0000-0000-0000-0000000000c3' returning id$$,
  'family_members: B can delete a child of F1');

reset role;
select is((select member_name from public.family_members where id = '00000000-0000-0000-0000-0000000000b1'), 'Alex',
  'family_members: A''s row is unchanged after B''s attempts');
select is((select family_id from public.family_members where id = '00000000-0000-0000-0000-0000000000b2'),
  '00000000-0000-0000-0000-0000000000f1'::uuid, 'family_members: B is still in F1');
select is((select calendar_color from public.family_members where id = '00000000-0000-0000-0000-0000000000b2'),
  '#abcdef', 'family_members: B''s own color change was saved');
select is((select member_name from public.family_members where id = '00000000-0000-0000-0000-0000000000c1'), 'Kiddo',
  'family_members: B''s change to the child was saved, C''s was not');
select is((select count(*) from public.family_members where member_type = 'adult'), 3::bigint,
  'family_members: no adult row was added or removed');
select is((select name from public.families where id = '00000000-0000-0000-0000-0000000000f1'), 'Renamed by A',
  'families: only the owner''s rename was saved');
select is((select created_by from public.families where id = '00000000-0000-0000-0000-0000000000f1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'families: F1 is still owned by A');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-0000000000a2'), 'Sam Example',
  'profiles: B''s profile is unchanged after A''s attempt');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- family_invitations: adults see their family's; an adult may revoke a
-- pending one; everything else is RPC only
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select set_eq('select id from public.family_invitations',
  array['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3',
        '00000000-0000-0000-0000-0000000000d4']::uuid[],
  'family_invitations: A sees F1''s invitations');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select set_eq('select id from public.family_invitations',
  array['00000000-0000-0000-0000-0000000000d2']::uuid[],
  'family_invitations: C sees only F2''s invitation');
select is_empty(
  $$update public.family_invitations set status = 'revoked'
    where id = '00000000-0000-0000-0000-0000000000d4' returning id$$,
  'family_invitations: C cannot revoke an F1 invitation');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select is_empty('select id from public.family_invitations', 'family_invitations: D sees none');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select set_eq('select id from public.family_invitations',
  array['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3',
        '00000000-0000-0000-0000-0000000000d4']::uuid[],
  'family_invitations: B sees F1''s invitations');
select isnt_empty(
  $$update public.family_invitations set status = 'revoked'
    where id = '00000000-0000-0000-0000-0000000000d1' returning id$$,
  'family_invitations: B can revoke a pending F1 invitation');
select is_empty(
  $$update public.family_invitations set status = 'revoked'
    where id = '00000000-0000-0000-0000-0000000000d3' returning id$$,
  'family_invitations: an accepted invitation cannot be revoked');
select throws_ok(
  $$update public.family_invitations set status = 'accepted'
    where id = '00000000-0000-0000-0000-0000000000d4'$$,
  '42501', null, 'family_invitations: a pending invitation cannot be set to accepted');
select throws_ok(
  $$update public.family_invitations set status = 'expired'
    where id = '00000000-0000-0000-0000-0000000000d4'$$,
  '42501', null, 'family_invitations: a pending invitation cannot be set to expired');
select throws_ok(
  $$update public.family_invitations set invited_email = 'other@example.test'
    where id = '00000000-0000-0000-0000-0000000000d4'$$,
  '42501', null, 'family_invitations: invited_email cannot be updated (column privilege)');
select throws_ok(
  $$update public.family_invitations set expires_at = now() + interval '1 year'
    where id = '00000000-0000-0000-0000-0000000000d4'$$,
  '42501', null, 'family_invitations: expires_at cannot be updated (column privilege)');
select throws_ok(
  $$insert into public.family_invitations (family_id, invited_email, invited_by, invitation_token_hash)
    values ('00000000-0000-0000-0000-0000000000f1', 'new@example.test',
            '00000000-0000-0000-0000-0000000000a2', repeat('5', 64))$$,
  '42501', null, 'family_invitations: B cannot insert an invitation (RPC only)');
select is_empty(
  $$delete from public.family_invitations where id = '00000000-0000-0000-0000-0000000000d4' returning id$$,
  'family_invitations: B cannot delete an invitation');

reset role;
select results_eq(
  $$select id, status from public.family_invitations order by id$$,
  $$values ('00000000-0000-0000-0000-0000000000d1'::uuid, 'revoked'),
           ('00000000-0000-0000-0000-0000000000d2'::uuid, 'pending'),
           ('00000000-0000-0000-0000-0000000000d3'::uuid, 'accepted'),
           ('00000000-0000-0000-0000-0000000000d4'::uuid, 'pending')$$,
  'family_invitations: only B''s revoke of the pending invitation changed anything');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- anon: no update privilege at all on these tables
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$update public.profiles set full_name = 'anon'$$, '42501', null,
  'anon cannot update profiles');
select throws_ok($$update public.families set name = 'anon'$$, '42501', null,
  'anon cannot update families');
select throws_ok($$update public.family_members set member_name = 'anon'$$, '42501', null,
  'anon cannot update family_members');
select throws_ok($$update public.family_invitations set status = 'revoked'$$, '42501', null,
  'anon cannot update family_invitations');
select is_empty($$delete from public.families returning id$$, 'anon cannot delete families');

-- ---------------------------------------------------------------------------
-- Deleting a family: owner only (last, because it cascades)
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is_empty(
  $$delete from public.families where id = '00000000-0000-0000-0000-0000000000f1' returning id$$,
  'families: B (not the owner) cannot delete F1');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is_empty(
  $$delete from public.families where id = '00000000-0000-0000-0000-0000000000f1' returning id$$,
  'families: C cannot delete F1');

reset role;
select is((select count(*) from public.families where id = '00000000-0000-0000-0000-0000000000f1'), 1::bigint,
  'families: F1 survives B''s and C''s deletes');
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select isnt_empty(
  $$delete from public.families where id = '00000000-0000-0000-0000-0000000000f1' returning id$$,
  'families: the owner can delete F1');

reset role;
select is((select count(*) from public.families where id = '00000000-0000-0000-0000-0000000000f1'), 0::bigint,
  'families: F1 is gone after the owner''s delete');
select is((select count(*) from public.family_members where family_id = '00000000-0000-0000-0000-0000000000f1'),
  0::bigint, 'families: F1''s members went with it');
select is((select count(*) from public.families where id = '00000000-0000-0000-0000-0000000000f2'), 1::bigint,
  'families: F2 is untouched');

select * from finish();
rollback;
