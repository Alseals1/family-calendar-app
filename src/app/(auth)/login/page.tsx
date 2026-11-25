import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import {
  confirmErrorMessage,
  FORGOT_PASSWORD_PATH,
  loginNoticeMessage,
  REGISTER_PATH,
} from "@/lib/auth/redirects";
import { AUTH_COPY } from "@/lib/copy";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, reset } = await searchParams;
  const confirmError = confirmErrorMessage(typeof error === "string" ? error : undefined);
  const notice = loginNoticeMessage(typeof reset === "string" ? reset : undefined);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{AUTH_COPY.loginTitle}</h1>
      {confirmError ? (
        <p role="alert" className="text-sm text-destructive">
          {confirmError}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      <LoginForm />
      <p className="text-center text-sm">
        <Link href={FORGOT_PASSWORD_PATH} className="font-medium text-foreground underline">
          {AUTH_COPY.forgotPasswordLink}
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        {AUTH_COPY.noAccount}{" "}
        <Link href={REGISTER_PATH} className="font-medium text-foreground underline">
          {AUTH_COPY.registerTitle}
        </Link>
      </p>
    </div>
  );
}
