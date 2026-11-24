"use client";

import { useActionState, useState, type FormEvent } from "react";
import type { z } from "zod";
import { fieldErrors } from "@/lib/auth/schemas";
import { IDLE_STATE, type AuthFormState } from "@/lib/auth/form-state";

type Action = (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
type Field = "fullName" | "email" | "password";

/**
 * Wires a server action to a form. The shared zod schema runs on submit: invalid
 * input shows its errors and never reaches the action, which validates again.
 */
export function useValidatedAction(action: Action, schema: z.ZodType) {
  const [state, formAction, pending] = useActionState(action, IDLE_STATE);
  const [clientErrors, setClientErrors] = useState<Partial<Record<Field, string>>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = schema.safeParse(values);
    if (result.success) {
      setClientErrors({});
      return;
    }
    event.preventDefault();
    // The schema is a generic ZodType here, so its field names are known only by convention.
    setClientErrors(fieldErrors(result as never));
  }

  const serverErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  return {
    state,
    formAction,
    pending,
    onSubmit,
    errors: { ...serverErrors, ...clientErrors } as Partial<Record<Field, string>>,
  };
}
