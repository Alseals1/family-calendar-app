import { redirect } from "next/navigation";
import { hasFamily } from "@/lib/auth/family";
import { LOGIN_PATH, postAuthPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

/** Renders nothing: it only picks the landing page for the signed-in user. */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // The proxy already sends signed-out visitors to /login; this is the backstop.
  if (!user) redirect(LOGIN_PATH);
  redirect(postAuthPath({ hasFamily: await hasFamily(supabase, user.id) }));
}
