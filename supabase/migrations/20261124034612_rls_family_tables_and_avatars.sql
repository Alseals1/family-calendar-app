-- T04 part 2 · RLS on profiles, families, family_members and
-- family_invitations, column-limited update grants, and the private avatars
-- bucket with its storage policies (docs/plan.md section 4, MEM-4).
--
-- Rows that only the RPCs may create or remove (families, adult members,
-- invitations) get no insert or delete policy here: the RPCs in T07–T09 are
-- security definer and do not need one.
--
-- Update is granted per column. Without that, "an adult updates their own
-- row" would let an adult set their own family_id to another family, and the
-- owner could hand created_by to someone else. Note: column grants break
-- supabase-js `upsert` on these four tables; use `update` with explicit
-- columns instead.

-- ---------------------------------------------------------------------------
-- profiles: read yourself and the people in your family; update yourself.
-- Insert is the signup trigger's job; delete cascades from auth.users.
-- ---------------------------------------------------------------------------

create policy profiles_select_self_or_family on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.family_members m
      where m.user_id = profiles.id
        and m.family_id = (select private.my_family_id())
    )
  );

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- families: adults read; the owner renames or deletes. Insert comes with the
-- create_family RPC (T07).
-- ---------------------------------------------------------------------------

create policy families_select_adult on public.families
  for select to authenticated
  using (private.is_family_adult(id));

-- WITH CHECK reads created_by directly: a stable helper would see the
-- statement's starting snapshot, not the new row.
create policy families_update_owner on public.families
  for update to authenticated
  using (private.is_family_owner(id))
  with check (created_by = (select auth.uid()));

create policy families_delete_owner on public.families
  for delete to authenticated
  using (private.is_family_owner(id));

revoke update on public.families from anon, authenticated;
grant update (name) on public.families to authenticated;

-- ---------------------------------------------------------------------------
-- family_members: adults read their family; any adult manages children; an
-- adult edits only their own adult row. Adult rows are added and removed by
-- the RPCs only (T08, T09).
-- ---------------------------------------------------------------------------

create policy family_members_select_adult on public.family_members
  for select to authenticated
  using (private.is_family_adult(family_id));

create policy family_members_insert_child on public.family_members
  for insert to authenticated
  with check (
    member_type = 'child'
    and user_id is null
    and private.is_family_adult(family_id)
  );

create policy family_members_update_child_or_self on public.family_members
  for update to authenticated
  using (
    private.is_family_adult(family_id)
    and (member_type = 'child' or user_id = (select auth.uid()))
  )
  with check (
    private.is_family_adult(family_id)
    and (member_type = 'child' or user_id = (select auth.uid()))
  );

create policy family_members_delete_child on public.family_members
  for delete to authenticated
  using (
    member_type = 'child'
    and private.is_family_adult(family_id)
  );

revoke update on public.family_members from anon, authenticated;
grant update (member_name, calendar_color, avatar_url) on public.family_members to authenticated;

-- ---------------------------------------------------------------------------
-- family_invitations: adults read their family's; an adult may revoke a
-- pending one. Create and accept are RPCs (T08); there is no delete.
-- ---------------------------------------------------------------------------

create policy family_invitations_select_adult on public.family_invitations
  for select to authenticated
  using (private.is_family_adult(family_id));

create policy family_invitations_update_revoke on public.family_invitations
  for update to authenticated
  using (status = 'pending' and private.is_family_adult(family_id))
  with check (status = 'revoked' and private.is_family_adult(family_id));

revoke update on public.family_invitations from anon, authenticated;
grant update (status) on public.family_invitations to authenticated;

-- ---------------------------------------------------------------------------
-- avatars: a private bucket, 1 MiB per file (MEM-4), jpeg / png / webp only.
-- Objects live at `<family_id>/<file>`, and only that family's adults may
-- read or write them. The folder is compared as text, so a folder that is
-- not a uuid is simply refused instead of raising a cast error.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy avatars_select_family on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.my_family_id())::text
  );

create policy avatars_insert_family on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.my_family_id())::text
  );

create policy avatars_update_family on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.my_family_id())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.my_family_id())::text
  );

create policy avatars_delete_family on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select private.my_family_id())::text
  );
