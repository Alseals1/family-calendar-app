"use client";

import { logIn } from "@/lib/auth/actions";
import { loginSchema } from "@/lib/auth/schemas";
import { AUTH_COPY } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { TextField } from "./text-field";
import { useValidatedAction } from "./use-validated-action";

export function LoginForm() {
  const { state, formAction, pending, onSubmit, errors } = useValidatedAction(logIn, loginSchema);
  const prefill = state.status === "error" ? state : undefined;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        name="email"
        label={AUTH_COPY.emailLabel}
        type="email"
        autoComplete="email"
        defaultValue={prefill?.email}
        error={errors.email}
      />
      <TextField
        name="password"
        label={AUTH_COPY.passwordLabel}
        type="password"
        autoComplete="current-password"
        error={errors.password}
      />
      {prefill?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {prefill.formError}
        </p>
      ) : null}
      <Button type="submit" width="full" disabled={pending}>
        {pending ? AUTH_COPY.loginPending : AUTH_COPY.loginSubmit}
      </Button>
    </form>
  );
}
