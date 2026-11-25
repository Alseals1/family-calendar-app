import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LOGIN_PATH, resetLinkErrorMessage } from "@/lib/auth/redirects";
import { AUTH_COPY } from "@/lib/copy";

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const { error } = await searchParams;
  const linkError = resetLinkErrorMessage(typeof error === "string" ? error : undefined);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{AUTH_COPY.forgotPasswordTitle}</h1>
      <p className="text-sm text-muted-foreground">{AUTH_COPY.forgotPasswordIntro}</p>
      {linkError ? (
        <p role="alert" className="text-sm text-destructive">
          {linkError}
        </p>
      ) : null}
      <ForgotPasswordForm />
      <p className="text-center text-sm">
        <Link href={LOGIN_PATH} className="font-medium text-foreground underline">
          {AUTH_COPY.backToLogin}
        </Link>
      </p>
    </div>
  );
}
