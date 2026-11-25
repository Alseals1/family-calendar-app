import { describe, expect, it } from "vitest";
import { createFamilyOutcome } from "./outcome";

describe("createFamilyOutcome", () => {
  it("is created when there was no error", () => {
    expect(createFamilyOutcome(null)).toBe("created");
  });

  it("treats 23505 as already in a family", () => {
    expect(createFamilyOutcome("23505")).toBe("already");
  });

  it.each(["23514", "42501", "PGRST301", ""])("fails on any other error (%j)", (code) => {
    expect(createFamilyOutcome(code)).toBe("failed");
  });
});
