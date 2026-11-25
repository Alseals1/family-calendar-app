"use client";

import { createFamily } from "@/lib/family/actions";
import { FAMILY_IDLE_STATE, type FamilyFormState } from "@/lib/family/form-state";
import { createFamilySchema } from "@/lib/family/schemas";
import { DEFAULT_MEMBER_COLOR } from "@/lib/colors/palette";
import { FAMILY_COPY } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/auth/text-field";
import { useValidatedAction } from "@/components/auth/use-validated-action";
import { ColorPicker } from "./color-picker";

type FamilyField = "familyName" | "displayName" | "color";

export function OnboardingForm({ defaultDisplayName }: { defaultDisplayName: string }) {
  const { state, formAction, pending, onSubmit, errors } = useValidatedAction<
    FamilyFormState,
    FamilyField
  >(createFamily, createFamilySchema, FAMILY_IDLE_STATE);

  const prefill = state.status === "error" ? state : undefined;
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        name="familyName"
        label={FAMILY_COPY.familyNameLabel}
        autoComplete="off"
        defaultValue={prefill?.familyName}
        error={errors.familyName}
      />
      <TextField
        name="displayName"
        label={FAMILY_COPY.displayNameLabel}
        autoComplete="name"
        defaultValue={prefill?.displayName ?? defaultDisplayName}
        error={errors.displayName}
      />
      <ColorPicker defaultValue={prefill?.color ?? DEFAULT_MEMBER_COLOR} error={errors.color} />
      {prefill?.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {prefill.formError}
        </p>
      ) : null}
      <Button type="submit" width="full" disabled={pending}>
        {pending ? FAMILY_COPY.pending : FAMILY_COPY.submit}
      </Button>
    </form>
  );
}
