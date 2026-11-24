-- T03 · Phase 1 schema (docs/plan.md section 4).
--
-- Six tables with their checks, composite foreign keys, indexes and triggers.
-- RLS is enabled on every table with no policies, so anon and authenticated
-- can read and write nothing until T04 adds the policies.
--
-- Trigger functions live in the `private` schema, which the API does not
-- expose, so they never become RPCs or appear in the generated types.

create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep updated_at current
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one per auth user, created by the signup trigger below
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null
    constraint profiles_full_name_length
    check (char_length(btrim(full_name)) >= 1 and char_length(full_name) <= 100),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- families
-- ---------------------------------------------------------------------------

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint families_name_length
    check (char_length(btrim(name)) >= 1 and char_length(name) <= 80),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index families_created_by_idx on public.families (created_by);

-- ---------------------------------------------------------------------------
-- family_members: adults (with a login) and children (profiles without one)
-- ---------------------------------------------------------------------------

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  member_name text not null
    constraint family_members_member_name_length
    check (char_length(btrim(member_name)) >= 1 and char_length(member_name) <= 80),
  member_type text not null
    constraint family_members_member_type_check
    check (member_type in ('adult', 'child')),
  calendar_color text not null
    constraint family_members_calendar_color_check
    check (calendar_color ~ '^#[0-9a-f]{6}$'),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_members_adult_has_user
    check ((member_type = 'adult') = (user_id is not null)),
  constraint family_members_family_user_key unique (family_id, user_id),
  -- Target of the composite foreign key on event_assignments.
  constraint family_members_id_family_key unique (id, family_id)
);

-- D-06: one family per user.
create unique index family_members_one_family_per_user_idx
  on public.family_members (user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------------
-- family_invitations: copyable invite links (the raw token is only in the
-- link; the database keeps its lowercase hex SHA-256)
-- ---------------------------------------------------------------------------

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  invited_email extensions.citext not null,
  invited_by uuid not null references public.profiles (id),
  invitation_token_hash text not null
    constraint family_invitations_token_hash_key unique
    constraint family_invitations_token_hash_format
    check (invitation_token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    constraint family_invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index family_invitations_one_pending_idx
  on public.family_invitations (family_id, invited_email)
  where status = 'pending';

create index family_invitations_family_id_idx on public.family_invitations (family_id);

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  created_by uuid not null references public.profiles (id),
  title text not null
    constraint events_title_length
    check (char_length(btrim(title)) >= 1 and char_length(title) <= 200),
  description text
    constraint events_description_length
    check (char_length(description) <= 5000),
  location text
    constraint events_location_length
    check (char_length(location) <= 300),
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_all_day boolean not null default false,
  visibility text not null
    constraint events_visibility_check
    check (visibility in ('private', 'shared', 'family')),
  calendar_type text not null
    constraint events_calendar_type_check
    check (calendar_type in ('personal', 'family')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (end_time > start_time),
  -- D-07: family visibility if and only if the family calendar.
  constraint events_calendar_type_matches_visibility
    check ((visibility = 'family') = (calendar_type = 'family')),
  -- D-08: all-day events start and end at 00:00 UTC so they never shift a day.
  constraint events_all_day_midnight_utc
    check (
      not is_all_day
      or (
        (start_time at time zone 'UTC')::time = time '00:00'
        and (end_time at time zone 'UTC')::time = time '00:00'
      )
    ),
  -- Target of the composite foreign key on event_assignments.
  constraint events_id_family_key unique (id, family_id)
);

create index events_family_start_idx on public.events (family_id, start_time);
create index events_family_end_idx on public.events (family_id, end_time);
create index events_created_by_idx on public.events (created_by);

-- ---------------------------------------------------------------------------
-- event_assignments: the composite foreign keys mean an event can only be
-- assigned to members of its own family
-- ---------------------------------------------------------------------------

create table public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  family_member_id uuid not null,
  family_id uuid not null,
  constraint event_assignments_event_fk
    foreign key (event_id, family_id)
    references public.events (id, family_id) on delete cascade,
  constraint event_assignments_member_fk
    foreign key (family_member_id, family_id)
    references public.family_members (id, family_id) on delete cascade,
  constraint event_assignments_event_member_key unique (event_id, family_member_id)
);

create index event_assignments_member_idx on public.event_assignments (family_member_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create trigger families_set_updated_at
  before update on public.families
  for each row execute function private.set_updated_at();

create trigger family_members_set_updated_at
  before update on public.family_members
  for each row execute function private.set_updated_at();

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- events.created_by and events.family_id never change after insert
-- ---------------------------------------------------------------------------

create function private.prevent_event_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by
     or new.family_id is distinct from old.family_id then
    raise exception 'events.created_by and events.family_id cannot be changed';
  end if;
  return new;
end;
$$;

create trigger events_immutable_owner
  before update on public.events
  for each row execute function private.prevent_event_owner_change();

-- ---------------------------------------------------------------------------
-- Profile on signup. The name falls back to the email's local part, then to
-- 'New user', so a signup never fails on the full_name check.
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'New user'
      ),
      100
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

revoke all on all functions in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security. Policies come in T04; until then every table is
-- deny-all for anon and authenticated.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invitations enable row level security;
alter table public.events enable row level security;
alter table public.event_assignments enable row level security;
