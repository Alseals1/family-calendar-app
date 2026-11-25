"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_COPY } from "@/lib/copy";
import { hasFamily } from "./family";
import type { AuthFormState } from "./form-state";
import {
  isNeutralResetRequestError,
  LOGIN_PATH,
  loginErrorMessage,
  postAuthPath,
  RESET_DONE_PATH,
  updatePasswordError,
} from "./redirects";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  registerSchema,
} from "./schemas";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function register(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = text(formData, "fullName");
  const email = text(formData, "email");
  const parsed = registerSchema.safeParse({ fullName, email, password: text(formData, "password") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrors(parsed), fullName, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  // Supabase answers the same way for an address that already has an account, so the
  // form never reveals which emails are registered. Its error text is never shown.
  if (error) {
    return { status: "error", formError: AUTH_COPY.registerFailed, fullName, email };
  }
  return { status: "sent", email: parsed.data.email };
}

export async function logIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email");
  const parsed = loginSchema.safeParse({ email, password: text(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed), email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { status: "error", formError: loginErrorMessage(error?.code), email: parsed.data.email };
  }
  redirect(postAuthPath({ hasFamily: await hasFamily(supabase, data.user.id) }));
}

export async function logOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email");
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed), email };

  const supabase = await createClient();
  // No redirectTo: the recovery email template builds the link from the Site URL.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  // Supabase answers the same way for an unknown address, so the form never reveals which
  // emails have an account. Its 429 only happens for a real account, so it looks like a
  // success too; a real failure (an outage) must not look like one.
  if (error && !isNeutralResetRequestError(error)) {
    return { status: "error", formError: AUTH_COPY.resetRequestFailed, email };
  }
  return { status: "sent", email: parsed.data.email };
}

export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({ password: text(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const mapped = updatePasswordError(error.code);
    return "field" in mapped
      ? { status: "error", fieldErrors: { password: mapped.field } }
      : { status: "error", formError: mapped.form };
  }
  // Ends every session of the user, this one included, so any session that held the old
  // password is gone and the new password is used straight away.
  await supabase.auth.signOut();
  redirect(RESET_DONE_PATH);
}
