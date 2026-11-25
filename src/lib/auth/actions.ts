"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AUTH_COPY } from "@/lib/copy";
import { hasFamily } from "./family";
import type { AuthFormState } from "./form-state";
import { LOGIN_PATH, loginErrorMessage, postAuthPath } from "./redirects";
import { fieldErrors, loginSchema, registerSchema } from "./schemas";

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
