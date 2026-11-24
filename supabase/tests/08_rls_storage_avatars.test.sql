-- T04: the private `avatars` bucket and its storage policies (docs/plan.md
-- section 4, MEM-4). Objects live at `<family_id>/<file>`; only adults of
-- that family may read or write them.
--
-- People (all made up): A = alex and B = sam, adults of F1; C = jordan,
-- adult of F2; D = riley, no family.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- ---------------------------------------------------------------------------
-- The bucket and its policies
-- ---------------------------------------------------------------------------

select is((select public from storage.buckets where id = 'avatars'), false, 'avatars bucket exists and is private');
select is((select file_size_limit from storage.buckets where id = 'avatars'), 1048576::bigint,
  'avatars bucket limits files to 1 MiB');
select set_eq(
  $$select unnest(allowed_mime_types) from storage.buckets where id = 'avatars'$$,
  array['image/jpeg', 'image/png', 'image/webp'],
  'avatars bucket allows only jpeg, png and webp');
select policy_roles_are('storage', 'objects', 'avatars_select_family', array['authenticated'],
  'avatars_select_family exists, for authenticated only');
select policy_roles_are('storage', 'objects', 'avatars_insert_family', array['authenticated'],
  'avatars_insert_family exists, for authenticated only');
select policy_roles_are('storage', 'objects', 'avatars_update_family', array['authenticated'],
  'avatars_update_family exists, for authenticated only');
select policy_roles_are('storage', 'objects', 'avatars_delete_family', array['authenticated'],
  'avatars_delete_family exists, for authenticated only');

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
insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'Alex', 'adult', '#1a2b3c'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2', 'Sam', 'adult', '#2b3c4d'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a3', 'Jordan', 'adult', '#4d5e6f');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Writes: only under your own family's folder
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-0000-0000-0000000000f1/a.png', '00000000-0000-0000-0000-0000000000a1')$$,
  'A can upload under F1/');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', 'x.png', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'A cannot upload at the bucket root');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', 'not-a-uuid/x.png', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'A cannot upload under a folder that is not a family id');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-0000-0000-0000000000f2/a.png', '00000000-0000-0000-0000-0000000000a1')$$,
  '42501', null, 'A cannot upload under F2/');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-0000-0000-0000000000f1/x.png', '00000000-0000-0000-0000-0000000000a3')$$,
  '42501', null, 'C cannot upload under F1/');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-0000-0000-0000000000f2/c.png', '00000000-0000-0000-0000-0000000000a3')$$,
  'C can upload under F2/');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('avatars', '00000000-0000-0000-0000-0000000000f1/d.png', '00000000-0000-0000-0000-0000000000a4')$$,
  '42501', null, 'D (no family) cannot upload anywhere');

-- ---------------------------------------------------------------------------
-- Reads: family adults only
-- ---------------------------------------------------------------------------

select is_empty($$select id from storage.objects where bucket_id = 'avatars'$$, 'D sees no avatars');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select results_eq(
  $$select name from storage.objects where bucket_id = 'avatars'$$,
  array['00000000-0000-0000-0000-0000000000f1/a.png'],
  'B sees F1''s avatar and not F2''s');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select results_eq(
  $$select name from storage.objects where bucket_id = 'avatars'$$,
  array['00000000-0000-0000-0000-0000000000f2/c.png'],
  'C sees F2''s avatar and not F1''s');

-- ---------------------------------------------------------------------------
-- Update and delete
-- ---------------------------------------------------------------------------

select is_empty(
  $$update storage.objects set metadata = '{"by":"C"}'
    where name = '00000000-0000-0000-0000-0000000000f1/a.png' returning id$$,
  'C cannot update F1''s avatar');
select throws_ok(
  $$update storage.objects set name = '00000000-0000-0000-0000-0000000000f1/c.png'
    where name = '00000000-0000-0000-0000-0000000000f2/c.png'$$,
  '42501', null, 'C cannot move an F2 avatar into F1/');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select isnt_empty(
  $$update storage.objects set metadata = '{"by":"B"}'
    where name = '00000000-0000-0000-0000-0000000000f1/a.png' returning id$$,
  'B can update F1''s avatar');

-- The local stack refuses direct deletes from storage tables unless this is
-- set; the policies are what is being tested here.
set local storage.allow_delete_query = 'true';

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is_empty(
  $$delete from storage.objects where name = '00000000-0000-0000-0000-0000000000f1/a.png' returning id$$,
  'C cannot delete F1''s avatar');

reset role;
select is((select metadata ->> 'by' from storage.objects where name = '00000000-0000-0000-0000-0000000000f1/a.png'),
  'B', 'F1''s avatar is still there with B''s change, not C''s');
set local role authenticated;

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select isnt_empty(
  $$delete from storage.objects where name = '00000000-0000-0000-0000-0000000000f1/a.png' returning id$$,
  'B can delete F1''s avatar');

-- ---------------------------------------------------------------------------
-- anon: nothing
-- ---------------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is_empty($$select id from storage.objects where bucket_id = 'avatars'$$, 'anon sees no avatars');
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('avatars', '00000000-0000-0000-0000-0000000000f1/anon.png')$$,
  '42501', null, 'anon cannot upload an avatar');

select * from finish();
rollback;
