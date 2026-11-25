import { NextResponse, type NextRequest } from "next/server";
import { hasFamily } from "@/lib/auth/family";
import { CONFIRM_ERROR_PATH, postAuthPath } from "@/lib/auth/redirects";
import { confirmParamsSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

/** Email confirmation link target. The email template builds the URL (supabase/templates). */
export async function GET(request: NextRequest) {
  const fail = () => NextResponse.redirect(new URL(CONFIRM_ERROR_PATH, request.url));

  const params = confirmParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!params.success) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp(params.data);
  if (error || !data.user) return fail();

  const path = postAuthPath({ hasFamily: await hasFamily(supabase, data.user.id) });
  return NextResponse.redirect(new URL(path, request.url));
}
