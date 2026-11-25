import { describe, expect, it } from "vitest";
import { NEUTRAL_EVENT_COLOR } from "@/lib/colors/palette";
import { eventColor } from "./color";
import { MEMBERS, SPOUSE, makeEvent } from "./fixtures";

describe("eventColor", () => {
  it("uses the first assigned member in the order of the members list", () => {
    // The event lists kid2 first, but kid1 comes first in MEMBERS.
    const e = makeEvent({ id: "e", visibility: "family", calendar_type: "family", assignedMemberIds: ["m-kid2", "m-kid1"] });
    expect(eventColor(e, MEMBERS)).toBe("#3c4d5e");
  });

  it("follows the order of the members list it is given", () => {
    const e = makeEvent({ id: "e", visibility: "family", calendar_type: "family", assignedMemberIds: ["m-kid1", "m-kid2"] });
    expect(eventColor(e, [...MEMBERS].reverse())).toBe("#4d5e6f");
  });

  it("an unassigned family event is neutral gray", () => {
    const e = makeEvent({ id: "e", visibility: "family", calendar_type: "family" });
    expect(eventColor(e, MEMBERS)).toBe(NEUTRAL_EVENT_COLOR);
  });

  it("an unassigned personal event uses the creator's color", () => {
    const e = makeEvent({ id: "e", created_by: SPOUSE });
    expect(eventColor(e, MEMBERS)).toBe("#2b3c4d");
  });

  it("an unknown creator falls back to gray", () => {
    const e = makeEvent({ id: "e", created_by: "stranger" });
    expect(eventColor(e, MEMBERS)).toBe(NEUTRAL_EVENT_COLOR);
  });

  it("an assigned member that is not in the list falls back to the creator, then gray", () => {
    const personal = makeEvent({ id: "p", assignedMemberIds: ["ghost"] });
    expect(eventColor(personal, MEMBERS)).toBe("#1a2b3c");
    const family = makeEvent({ id: "f", visibility: "family", calendar_type: "family", assignedMemberIds: ["ghost"] });
    expect(eventColor(family, MEMBERS)).toBe(NEUTRAL_EVENT_COLOR);
  });
});
