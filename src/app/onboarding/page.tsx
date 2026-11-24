import { LogoutButton } from "@/components/auth/logout-button";
import { AUTH_COPY } from "@/lib/copy";

// Stub: T07 replaces this with the real onboarding.
export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{AUTH_COPY.onboardingHeading}</h1>
      <LogoutButton />
    </main>
  );
}
