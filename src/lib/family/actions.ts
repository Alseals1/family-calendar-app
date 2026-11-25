"use server";

import { redirect } from "next/navigation";
import { CALENDAR_PATH } from "@/lib/auth/redirects";
import { fieldErrors } from "@/lib/auth/schemas";
import { FAMILY_COPY } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import type { FamilyFormState } from "./form-state";
import { createFamilyOutcome } from "./outcome";
import { createFamilySchema } from "./schemas";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createFamily(
  _prev: FamilyFormState,
  formData: FormData,
): Promise<FamilyFormState> {
  const values = {
    familyName: text(formData, "familyName"),
    displayName: text(formData, "displayName"),
    color: text(formData, "color"),
  };
  const parsed = createFamilySchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed), ...values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_family", {
    family_name: parsed.data.familyName,
    display_name: parsed.data.displayName,
    color: parsed.data.color,
  });

  // 23505 means the user already has a family, so they go on to the calendar. Supabase's
  // error text is never shown.
  if (createFamilyOutcome(error?.code ?? null) === "failed") {
    return { status: "error", formError: FAMILY_COPY.createFailed, ...values };
  }
  redirect(CALENDAR_PATH);
}
