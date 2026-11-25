"use client";

import { requestPasswordReset } from "@/lib/auth/actions";
import { forgotPasswordSchema } from "@/lib/auth/schemas";
import { AUTH_COPY } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { TextField } from "./text-field";
import { useValidatedAction } from "./use-validated-action";

export function ForgotPasswordForm() {
  const { state, formAction, pending, onSubmit, errors } = useValidatedAction(
    requestPasswordReset,
    forgotPasswordSchema,
  );

  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-2" role="status">
        <h2 className="text-lg font-semibold">{AUTH_COPY.checkEmailTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {AUTH_COPY.resetEmailSentBody} <strong className="text-foreground">{state.email}</strong>.
        </p>
      </div>
    );
  }

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
      {prefill?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {prefill.formError}
        </p>
      ) : null}
      <Button type="submit" width="full" disabled={pending}>
        {pending ? AUTH_COPY.forgotPasswordPending : AUTH_COPY.forgotPasswordSubmit}
      </Button>
    </form>
  );
}
