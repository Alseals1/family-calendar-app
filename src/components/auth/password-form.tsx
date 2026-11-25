"use client";

import { newPasswordSchema } from "@/lib/auth/schemas";
import { AUTH_COPY } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { TextField } from "./text-field";
import { useValidatedAction, type Action } from "./use-validated-action";

type Props = {
  action: Action;
  submitLabel: string;
  pendingLabel: string;
};

/**
 * One "new password" field with the shared password rule. The server action is a prop:
 * T17 reuses this form in Settings with a change-password action.
 */
export function PasswordForm({ action, submitLabel, pendingLabel }: Props) {
  const { state, formAction, pending, onSubmit, errors } = useValidatedAction(
    action,
    newPasswordSchema,
  );
  const formError = state.status === "error" ? state.formError : undefined;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        name="password"
        label={AUTH_COPY.newPasswordLabel}
        type="password"
        autoComplete="new-password"
        error={errors.password}
      />
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" width="full" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
