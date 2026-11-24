-- T03: the Phase 1 schema exists as docs/plan.md section 4 describes it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- Tables
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'families', 'families exists');
select has_table('public', 'family_members', 'family_members exists');
select has_table('public', 'family_invitations', 'family_invitations exists');
select has_table('public', 'events', 'events exists');
select has_table('public', 'event_assignments', 'event_assignments exists');

-- Columns
select columns_are('public', 'profiles',
  array['id', 'full_name', 'avatar_url', 'created_at', 'updated_at'],
  'profiles has exactly its columns');
select columns_are('public', 'families',
  array['id', 'name', 'created_by', 'created_at', 'updated_at'],
  'families has exactly its columns');
select columns_are('public', 'family_members',
  array['id', 'family_id', 'user_id', 'member_name', 'member_type', 'calendar_color',
        'avatar_url', 'created_at', 'updated_at'],
  'family_members has exactly its columns');
select columns_are('public', 'family_invitations',
  array['id', 'family_id', 'invited_email', 'invited_by', 'invitation_token_hash', 'status',
        'expires_at', 'accepted_at', 'created_at'],
  'family_invitations has exactly its columns');
select columns_are('public', 'events',
  array['id', 'family_id', 'created_by', 'title', 'description', 'location', 'start_time',
        'end_time', 'is_all_day', 'visibility', 'calendar_type', 'created_at', 'updated_at'],
  'events has exactly its columns');
select columns_are('public', 'event_assignments',
  array['id', 'event_id', 'family_member_id', 'family_id'],
  'event_assignments has exactly its columns');

-- Column types
select col_type_is('public', 'events', 'start_time', 'timestamp with time zone',
  'events.start_time is timestamptz');
select col_type_is('public', 'events', 'end_time', 'timestamp with time zone',
  'events.end_time is timestamptz');
select col_type_is('public', 'family_invitations', 'invited_email', 'extensions', 'citext',
  'family_invitations.invited_email is citext');
select col_type_is('public', 'events', 'is_all_day', 'boolean', 'events.is_all_day is boolean');

-- Indexes
select has_index('public', 'families', 'families_created_by_idx', 'families_created_by_idx exists');
select has_index('public', 'family_members', 'family_members_one_family_per_user_idx',
  'family_members_one_family_per_user_idx exists (D-06)');
select has_index('public', 'family_invitations', 'family_invitations_one_pending_idx',
  'family_invitations_one_pending_idx exists');
select has_index('public', 'family_invitations', 'family_invitations_family_id_idx',
  'family_invitations_family_id_idx exists');
select has_index('public', 'events', 'events_family_start_idx', 'events_family_start_idx exists');
select has_index('public', 'events', 'events_family_end_idx', 'events_family_end_idx exists');
select has_index('public', 'events', 'events_created_by_idx', 'events_created_by_idx exists');
select has_index('public', 'event_assignments', 'event_assignments_member_idx',
  'event_assignments_member_idx exists');

-- Composite foreign keys keep assignments inside one family
select fk_ok('public', 'event_assignments', array['event_id', 'family_id'],
             'public', 'events', array['id', 'family_id'],
  'event_assignments (event_id, family_id) references events (id, family_id)');
select fk_ok('public', 'event_assignments', array['family_member_id', 'family_id'],
             'public', 'family_members', array['id', 'family_id'],
  'event_assignments (family_member_id, family_id) references family_members (id, family_id)');

-- RLS is on for every table, and no table has a policy yet (deny-all until T04)
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.families'::regclass),
  'RLS is enabled on families');
select ok((select relrowsecurity from pg_class where oid = 'public.family_members'::regclass),
  'RLS is enabled on family_members');
select ok((select relrowsecurity from pg_class where oid = 'public.family_invitations'::regclass),
  'RLS is enabled on family_invitations');
select ok((select relrowsecurity from pg_class where oid = 'public.events'::regclass),
  'RLS is enabled on events');
select ok((select relrowsecurity from pg_class where oid = 'public.event_assignments'::regclass),
  'RLS is enabled on event_assignments');
select policies_are('public', 'profiles', array[]::name[], 'profiles has no policies');
select policies_are('public', 'families', array[]::name[], 'families has no policies');
select policies_are('public', 'family_members', array[]::name[], 'family_members has no policies');
select policies_are('public', 'family_invitations', array[]::name[],
  'family_invitations has no policies');
select policies_are('public', 'events', array[]::name[], 'events has no policies');
select policies_are('public', 'event_assignments', array[]::name[],
  'event_assignments has no policies');

-- Triggers
select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users has the signup trigger');
select has_trigger('public', 'profiles', 'profiles_set_updated_at', 'profiles has updated_at trigger');
select has_trigger('public', 'families', 'families_set_updated_at', 'families has updated_at trigger');
select has_trigger('public', 'family_members', 'family_members_set_updated_at',
  'family_members has updated_at trigger');
select has_trigger('public', 'events', 'events_set_updated_at', 'events has updated_at trigger');
select has_trigger('public', 'events', 'events_immutable_owner',
  'events has the immutable owner trigger');

-- Extension and the private schema for trigger functions
select has_extension('extensions', 'citext', 'citext is installed in extensions');
select has_schema('private', 'private schema exists');
select ok(not has_schema_privilege('anon', 'private', 'usage'),
  'anon cannot use the private schema');
select ok(not has_schema_privilege('authenticated', 'private', 'usage'),
  'authenticated cannot use the private schema');

select * from finish();
rollback;
