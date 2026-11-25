import { describe, expect, it } from "vitest";
import { defaultVisibility } from "./defaults";

describe("defaultVisibility", () => {
  it("is family on the family calendar", () => {
    expect(defaultVisibility("family")).toBe("family");
  });
  it("is private on My calendar and on All", () => {
    expect(defaultVisibility("my")).toBe("private");
    expect(defaultVisibility("all")).toBe("private");
  });
});
