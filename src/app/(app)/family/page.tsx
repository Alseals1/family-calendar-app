import { redirect } from "next/navigation";
import { MemberList } from "@/components/family/member-list";
import { LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/redirects";
import { FAMILY_COPY } from "@/lib/copy";
import { getMyFamily } from "@/lib/family/queries";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Minimal and read-only: T09 adds children, invites and removal.
export default async function FamilyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const family = await getMyFamily(supabase);
  if (!family) redirect(ONBOARDING_PATH);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{FAMILY_COPY.familyHeading}</h1>
        <p className="text-lg">{family.name}</p>
      </div>
      <section className="flex flex-col gap-2" aria-labelledby="adults-heading">
        <h2 id="adults-heading" className="text-sm font-medium text-muted-foreground">
          {FAMILY_COPY.adultsHeading}
        </h2>
        <MemberList members={family.members} />
      </section>
    </main>
  );
}
