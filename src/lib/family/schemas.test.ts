import { describe, expect, it } from "vitest";
import { FAMILY_COPY } from "@/lib/copy";
import { fieldErrors } from "@/lib/auth/schemas";
import { createFamilySchema } from "./schemas";

const valid = { familyName: "The Smiths", displayName: "Riley", color: "#16a34a" };

describe("createFamilySchema", () => {
  it("accepts valid input and trims both names", () => {
    const result = createFamilySchema.safeParse({
      ...valid,
      familyName: "  The Smiths ",
      displayName: " Riley  ",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual(valid);
  });

  it("accepts names of exactly 80 characters", () => {
    const name = "x".repeat(80);
    expect(createFamilySchema.safeParse({ ...valid, familyName: name, displayName: name }).success).toBe(true);
  });

  it.each(["", "   "])("refuses a blank family name (%j)", (familyName) => {
    const result = createFamilySchema.safeParse({ ...valid, familyName });
    expect(fieldErrors(result).familyName).toBe(FAMILY_COPY.familyNameRequired);
  });

  it("refuses a family name over 80 characters", () => {
    const result = createFamilySchema.safeParse({ ...valid, familyName: "x".repeat(81) });
    expect(fieldErrors(result).familyName).toBe(FAMILY_COPY.familyNameTooLong);
  });

  it.each(["", "   "])("refuses a blank display name (%j)", (displayName) => {
    const result = createFamilySchema.safeParse({ ...valid, displayName });
    expect(fieldErrors(result).displayName).toBe(FAMILY_COPY.displayNameRequired);
  });

  it("refuses a display name over 80 characters", () => {
    const result = createFamilySchema.safeParse({ ...valid, displayName: "y".repeat(81) });
    expect(fieldErrors(result).displayName).toBe(FAMILY_COPY.displayNameTooLong);
  });

  it.each(["#123456", "#16A34A", "green", ""])("refuses a color outside the palette (%j)", (color) => {
    const result = createFamilySchema.safeParse({ ...valid, color });
    expect(fieldErrors(result).color).toBe(FAMILY_COPY.colorRequired);
  });

  it("refuses a missing color", () => {
    const result = createFamilySchema.safeParse({ familyName: "A", displayName: "B" });
    expect(fieldErrors(result).color).toBe(FAMILY_COPY.colorRequired);
  });
});
