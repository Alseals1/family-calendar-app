"use client";

import { useActionState, useState, type FormEvent } from "react";
import type { z } from "zod";
import { fieldErrors } from "@/lib/auth/schemas";
import { IDLE_STATE, type AuthFormState } from "@/lib/auth/form-state";

export type Action<S = AuthFormState> = (prev: S, formData: FormData) => Promise<S>;
type AuthField = "fullName" | "email" | "password";
type FormState<F extends string> = { status: string; fieldErrors?: Partial<Record<F, string>> };

/**
 * Wires a server action to a form. The shared zod schema runs on submit: invalid
 * input shows its errors and never reaches the action, which validates again.
 * The auth forms use the default state; other forms pass their own idle state.
 */
export function useValidatedAction(
  action: Action,
  schema: z.ZodType,
): ValidatedAction<AuthFormState, AuthField>;
export function useValidatedAction<S extends FormState<F>, F extends string>(
  action: Action<S>,
  schema: z.ZodType,
  idleState: S,
): ValidatedAction<S, F>;
export function useValidatedAction<S extends FormState<F>, F extends string>(
  action: Action<S>,
  schema: z.ZodType,
  // The overload without an idle state is only declared for the auth forms.
  idleState: S = IDLE_STATE as unknown as S,
): ValidatedAction<S, F> {
  // S is a plain object type, so Awaited<S> is S; TypeScript cannot see that for a generic S.
  const [state, formAction, pending] = useActionState(
    action as unknown as Action<Awaited<S>>,
    idleState as unknown as Awaited<S>,
  );
  const [clientErrors, setClientErrors] = useState<Partial<Record<F, string>>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = schema.safeParse(values);
    if (result.success) {
      setClientErrors({});
      return;
    }
    event.preventDefault();
    // The schema is a generic ZodType here, so its field names are known only by convention.
    setClientErrors(fieldErrors(result as never) as Partial<Record<F, string>>);
  }

  const serverErrors: Partial<Record<F, string>> =
    state.status === "error" ? (state.fieldErrors ?? {}) : {};
  return { state, formAction, pending, onSubmit, errors: { ...serverErrors, ...clientErrors } };
}

export type ValidatedAction<S, F extends string> = {
  state: S;
  formAction: (formData: FormData) => void;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  errors: Partial<Record<F, string>>;
};
