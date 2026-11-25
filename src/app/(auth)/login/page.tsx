import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { confirmErrorMessage, REGISTER_PATH } from "@/lib/auth/redirects";
import { AUTH_COPY } from "@/lib/copy";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const confirmError = confirmErrorMessage(typeof error === "string" ? error : undefined);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{AUTH_COPY.loginTitle}</h1>
      {confirmError ? (
        <p role="alert" className="text-sm text-destructive">
          {confirmError}
        </p>
      ) : null}
      <LoginForm />
      <p className="text-center text-sm text-muted-foreground">
        {AUTH_COPY.noAccount}{" "}
        <Link href={REGISTER_PATH} className="font-medium text-foreground underline">
          {AUTH_COPY.registerTitle}
        </Link>
      </p>
    </div>
  );
}
