import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type FamilyView = {
  id: string;
  name: string;
  members: { id: string; name: string; color: string; isOwner: boolean }[];
};

/**
 * The caller's family and its adults, or null when they have none. Reads through RLS, so
 * only the caller's own family is ever returned. The owner is `families.created_by`.
 */
export async function getMyFamily(supabase: SupabaseClient<Database>): Promise<FamilyView | null> {
  const { data: family, error } = await supabase
    .from("families")
    .select("id, name, created_by")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!family) return null;

  const { data: members, error: membersError } = await supabase
    .from("family_members")
    .select("id, member_name, calendar_color, user_id")
    .eq("family_id", family.id)
    .eq("member_type", "adult")
    .order("created_at");
  if (membersError) throw new Error(membersError.message);

  return {
    id: family.id,
    name: family.name,
    members: (members ?? []).map((m) => ({
      id: m.id,
      name: m.member_name,
      color: m.calendar_color,
      isOwner: m.user_id === family.created_by,
    })),
  };
}
