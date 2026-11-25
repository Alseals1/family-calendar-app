import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { OnboardingForm } from "@/components/family/onboarding-form";
import { hasFamily } from "@/lib/auth/family";
import { CALENDAR_PATH, LOGIN_PATH } from "@/lib/auth/redirects";
import { AUTH_COPY, FAMILY_COPY } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);
  if (await hasFamily(supabase, user.id)) redirect(CALENDAR_PATH);

  // Prefill the name from the profile (RLS lets a user read their own row).
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{AUTH_COPY.onboardingHeading}</h1>
        <p className="text-sm text-muted-foreground">{FAMILY_COPY.onboardingIntro}</p>
      </div>
      <OnboardingForm defaultDisplayName={profile?.full_name ?? ""} />
      <div>
        <LogoutButton />
      </div>
    </main>
  );
}
