-- T04 part 1 · RLS helpers and the events / event_assignments policies
-- (docs/plan.md section 4, docs/prd.md section 4, D-03).
--
-- The helpers live in `private`, which the API does not expose, so they never
-- become RPCs. `authenticated` may use the schema and execute these three
-- helpers only; anon gets nothing. They are security definer so policies on
-- family_members can call them without recursing into family_members' own RLS.
--
-- Every policy is `to authenticated`, so anon stays deny-all. Update policies
-- use the same expression for USING and WITH CHECK: the rule a row must meet
-- before an update is also the rule it must meet after.

grant usage on schema private to authenticated;

-- Any function added to `private` later is not executable by public unless
-- a migration grants it explicitly.
alter default privileges in schema private revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------

-- The caller is an adult member of family `fid`.
create function private.is_family_adult(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members m
    where m.family_id = fid
      and m.user_id = (select auth.uid())
      and m.member_type = 'adult'
  );
$$;

-- The caller created family `fid` and is still one of its adults.
create function private.is_family_owner(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.families f
    where f.id = fid
      and f.created_by = (select auth.uid())
  )
  and private.is_family_adult(fid);
$$;

-- The caller's family (D-06: at most one), or null.
create function private.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.family_id
  from public.family_members m
  where m.user_id = (select auth.uid())
    and m.member_type = 'adult'
  limit 1;
$$;

revoke all on function
  private.is_family_adult(uuid),
  private.is_family_owner(uuid),
  private.my_family_id()
from public, anon;

grant execute on function
  private.is_family_adult(uuid),
  private.is_family_owner(uuid),
  private.my_family_id()
to authenticated;

-- ---------------------------------------------------------------------------
-- events: private is creator-only; shared and family are visible to every
-- adult of the family; family events may be edited by any adult (D-03)
-- ---------------------------------------------------------------------------

create policy events_select_visible on public.events
  for select to authenticated
  using (
    private.is_family_adult(family_id)
    and (created_by = (select auth.uid()) or visibility <> 'private')
  );

create policy events_insert_own on public.events
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_family_adult(family_id)
  );

create policy events_update_creator_or_family on public.events
  for update to authenticated
  using (
    private.is_family_adult(family_id)
    and (created_by = (select auth.uid()) or visibility = 'family')
  )
  with check (
    private.is_family_adult(family_id)
    and (created_by = (select auth.uid()) or visibility = 'family')
  );

create policy events_delete_creator_or_family on public.events
  for delete to authenticated
  using (
    private.is_family_adult(family_id)
    and (created_by = (select auth.uid()) or visibility = 'family')
  );

-- ---------------------------------------------------------------------------
-- event_assignments: visible only when the event is (the subquery runs under
-- the events select policy), and writable only by someone who may edit the
-- event. There is no update policy: change an assignment by delete + insert.
-- ---------------------------------------------------------------------------

create policy event_assignments_select_visible_event on public.event_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_assignments.event_id
    )
  );

create policy event_assignments_insert_editor on public.event_assignments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_assignments.event_id
        and e.family_id = event_assignments.family_id
        and private.is_family_adult(e.family_id)
        and (e.created_by = (select auth.uid()) or e.visibility = 'family')
    )
  );

create policy event_assignments_delete_editor on public.event_assignments
  for delete to authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_assignments.event_id
        and e.family_id = event_assignments.family_id
        and private.is_family_adult(e.family_id)
        and (e.created_by = (select auth.uid()) or e.visibility = 'family')
    )
  );
