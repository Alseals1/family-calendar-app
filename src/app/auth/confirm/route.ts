import { NextResponse, type NextRequest } from "next/server";
import { hasFamily } from "@/lib/auth/family";
import { confirmFailurePath, confirmSuccessPath } from "@/lib/auth/redirects";
import { confirmParamsSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

/**
 * Target of the emailed links: sign-up confirmation and password reset. The email templates
 * build the URL (supabase/templates). A good link starts a session; a reset link then goes
 * to /reset-password, any other to the user's landing page.
 */
export async function GET(request: NextRequest) {
  const fail = () =>
    NextResponse.redirect(
      new URL(confirmFailurePath(request.nextUrl.searchParams.get("type")), request.url),
    );

  const params = confirmParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!params.success) return fail();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp(params.data);
  if (error || !data.user) return fail();

  // A reset link goes straight to the reset form, so the family lookup is not needed.
  const path = confirmSuccessPath({
    type: params.data.type,
    hasFamily: params.data.type === "recovery" ? false : await hasFamily(supabase, data.user.id),
  });
  return NextResponse.redirect(new URL(path, request.url));
}
