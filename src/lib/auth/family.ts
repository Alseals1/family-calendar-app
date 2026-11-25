import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * True when the user is an adult member of a family. Reads through RLS, so it only
 * sees the caller's own membership.
 */
export async function hasFamily(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("family_members")
    .select("id")
    .eq("user_id", userId)
    .eq("member_type", "adult")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
