import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { LOGIN_PATH } from "@/lib/auth/redirects";
import { AUTH_COPY } from "@/lib/copy";

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">{AUTH_COPY.registerTitle}</h1>
      <RegisterForm />
      <p className="text-center text-sm text-muted-foreground">
        {AUTH_COPY.haveAccount}{" "}
        <Link href={LOGIN_PATH} className="font-medium text-foreground underline">
          {AUTH_COPY.loginTitle}
        </Link>
      </p>
    </div>
  );
}
