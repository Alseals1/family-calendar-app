-- T07: public.create_family(family_name, display_name, color) returns uuid.
-- PRD FAM-1 (create a family) and D-06 (one family per user). docs/plan.md section 4 "RPCs".
--
-- Why security definer: the T04 policies give clients no insert on `families` and no
-- insert of adult `family_members` rows, so a new user could not become the first
-- member of a family any other way. The function does exactly one thing: it creates a
-- family for the caller and makes the caller its owner and first adult, in one
-- transaction. It takes the user from the JWT (auth.uid()), never from an argument.
--
-- Hardening: search_path is pinned to empty and every name is schema-qualified;
-- execute is revoked from public and anon and granted to authenticated only.
--
-- Why no insert policies: they would open direct client inserts that T08/T09 rely on
-- being RPC-only, and two client inserts would not be atomic.
--
-- Bad input (blank or over-long names, a color that is not lowercase hex) is refused by
-- the existing table checks (SQLSTATE 23514) and rolls the whole call back. The unique
-- index family_members_one_family_per_user_idx is the backstop for a double submit: its
-- violation is re-raised as 23505 and the family row rolls back with it.

create function public.create_family(family_name text, display_name text, color text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  fid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.family_members m where m.user_id = uid) then
    raise exception 'already in a family' using errcode = '23505';
  end if;

  begin
    insert into public.families (name, created_by)
    values (btrim(family_name), uid)
    returning id into fid;

    insert into public.family_members (family_id, user_id, member_name, member_type, calendar_color)
    values (fid, uid, btrim(display_name), 'adult', color);
  exception when unique_violation then
    raise exception 'already in a family' using errcode = '23505';
  end;

  return fid;
end;
$$;

revoke execute on function public.create_family(text, text, text) from public, anon;
grant execute on function public.create_family(text, text, text) to authenticated;
