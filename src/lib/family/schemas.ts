import { z } from "zod";
import { MEMBER_COLOR_HEXES } from "@/lib/colors/palette";
import { FAMILY_COPY } from "@/lib/copy";

// Limits match the database: families_name_length and family_members_member_name_length.
const NAME_MAX = 80;

export const createFamilySchema = z.object({
  familyName: z
    .string({ error: FAMILY_COPY.familyNameRequired })
    .trim()
    .min(1, FAMILY_COPY.familyNameRequired)
    .max(NAME_MAX, FAMILY_COPY.familyNameTooLong),
  displayName: z
    .string({ error: FAMILY_COPY.displayNameRequired })
    .trim()
    .min(1, FAMILY_COPY.displayNameRequired)
    .max(NAME_MAX, FAMILY_COPY.displayNameTooLong),
  color: z.enum(MEMBER_COLOR_HEXES, { error: FAMILY_COPY.colorRequired }),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
