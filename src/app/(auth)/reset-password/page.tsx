import { PasswordForm } from "@/components/auth/password-form";
import { resetPassword } from "@/lib/auth/actions";
import { AUTH_COPY } from "@/lib/copy";

// Needs a session (the proxy sends a signed-out visit to /login): the recovery link creates it.
export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{AUTH_COPY.resetPasswordTitle}</h1>
      <PasswordForm
        action={resetPassword}
        submitLabel={AUTH_COPY.resetPasswordSubmit}
        pendingLabel={AUTH_COPY.resetPasswordPending}
      />
    </div>
  );
}
