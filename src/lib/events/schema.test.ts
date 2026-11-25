import { describe, expect, it } from "vitest";
import { EVENT_COPY } from "@/lib/copy";
import { calendarTypeFor, eventIdSchema, eventInputSchema } from "./schema";

const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";

function valid(over: Record<string, unknown> = {}) {
  return {
    title: "Soccer practice",
    description: "",
    location: "",
    isAllDay: false,
    startTime: "2026-06-03T22:00:00Z",
    endTime: "2026-06-03T23:00:00Z",
    visibility: "shared",
    assignedMemberIds: [],
    ...over,
  };
}

function messageFor(input: unknown, path: string): string | undefined {
  const r = eventInputSchema.safeParse(input);
  if (r.success) return undefined;
  return r.error.issues.find((i) => i.path[0] === path)?.message;
}

describe("eventInputSchema", () => {
  it("accepts a valid event and turns empty optional text into null", () => {
    const r = eventInputSchema.safeParse(valid());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.description).toBeNull();
      expect(r.data.location).toBeNull();
      expect(r.data.assignedMemberIds).toEqual([]);
    }
  });

  it("trims the title, description and location", () => {
    const r = eventInputSchema.parse(valid({ title: "  Dentist  ", description: " a ", location: " b " }));
    expect(r.title).toBe("Dentist");
    expect(r.description).toBe("a");
    expect(r.location).toBe("b");
  });

  it("treats whitespace-only description and location as null", () => {
    const r = eventInputSchema.parse(valid({ description: "   ", location: "  " }));
    expect(r.description).toBeNull();
    expect(r.location).toBeNull();
  });

  it("defaults assignedMemberIds to []", () => {
    const withoutIds: Record<string, unknown> = valid();
    delete withoutIds.assignedMemberIds;
    const r = eventInputSchema.parse(withoutIds);
    expect(r.assignedMemberIds).toEqual([]);
  });

  describe("title", () => {
    it("rejects empty and spaces-only", () => {
      expect(messageFor(valid({ title: "" }), "title")).toBe(EVENT_COPY.titleRequired);
      expect(messageFor(valid({ title: "   " }), "title")).toBe(EVENT_COPY.titleRequired);
    });
    it("rejects a missing title", () => {
      const withoutTitle: Record<string, unknown> = valid();
      delete withoutTitle.title;
      expect(messageFor(withoutTitle, "title")).toBe(EVENT_COPY.titleRequired);
    });
    it("accepts 200 and rejects 201 characters", () => {
      expect(eventInputSchema.safeParse(valid({ title: "a".repeat(200) })).success).toBe(true);
      expect(messageFor(valid({ title: "a".repeat(201) }), "title")).toBe(EVENT_COPY.titleTooLong);
    });
  });

  it("limits the description to 5000 characters", () => {
    expect(eventInputSchema.safeParse(valid({ description: "a".repeat(5000) })).success).toBe(true);
    expect(messageFor(valid({ description: "a".repeat(5001) }), "description")).toBe(EVENT_COPY.descriptionTooLong);
  });

  it("limits the location to 300 characters", () => {
    expect(eventInputSchema.safeParse(valid({ location: "a".repeat(300) })).success).toBe(true);
    expect(messageFor(valid({ location: "a".repeat(301) }), "location")).toBe(EVENT_COPY.locationTooLong);
  });

  describe("times", () => {
    it("rejects an end before the start, on the endTime path", () => {
      expect(
        messageFor(valid({ startTime: "2026-06-03T23:00:00Z", endTime: "2026-06-03T22:00:00Z" }), "endTime"),
      ).toBe(EVENT_COPY.endBeforeStart);
    });

    it("rejects an end equal to the start", () => {
      expect(
        messageFor(valid({ startTime: "2026-06-03T22:00:00Z", endTime: "2026-06-03T22:00:00Z" }), "endTime"),
      ).toBe(EVENT_COPY.endBeforeStart);
    });

    it("compares instants, so an offset counts", () => {
      // 22:00-05:00 is 03:00Z the next day, which is after 02:00Z.
      expect(
        messageFor(valid({ startTime: "2026-06-03T22:00:00-05:00", endTime: "2026-06-04T02:00:00Z" }), "endTime"),
      ).toBe(EVENT_COPY.endBeforeStart);
    });

    it("rejects text that is not a date-time", () => {
      expect(messageFor(valid({ startTime: "tomorrow" }), "startTime")).toBe(EVENT_COPY.timeInvalid);
      expect(messageFor(valid({ endTime: "" }), "endTime")).toBe(EVENT_COPY.timeInvalid);
      expect(messageFor(valid({ startTime: 5 }), "startTime")).toBe(EVENT_COPY.timeInvalid);
    });
  });

  describe("all-day", () => {
    const allDay = { isAllDay: true, startTime: "2026-06-03T00:00:00.000Z", endTime: "2026-06-04T00:00:00.000Z" };

    it("accepts times at exactly midnight UTC", () => {
      expect(eventInputSchema.safeParse(valid(allDay)).success).toBe(true);
    });

    it("rejects a start that is not midnight UTC", () => {
      expect(messageFor(valid({ ...allDay, startTime: "2026-06-03T00:00:01.000Z" }), "startTime")).toBe(
        EVENT_COPY.allDayInvalid,
      );
    });

    it("rejects an end that is not midnight UTC", () => {
      expect(messageFor(valid({ ...allDay, endTime: "2026-06-04T00:00:00.001Z" }), "endTime")).toBe(
        EVENT_COPY.allDayInvalid,
      );
      expect(messageFor(valid({ ...allDay, endTime: "2026-06-04T05:00:00.000Z" }), "endTime")).toBe(
        EVENT_COPY.allDayInvalid,
      );
    });

    it("does not apply the midnight rule to timed events", () => {
      expect(eventInputSchema.safeParse(valid({ startTime: "2026-06-03T13:07:00Z" })).success).toBe(true);
    });
  });

  it.each(["private", "shared", "family"])("accepts visibility %s", (visibility) => {
    expect(eventInputSchema.safeParse(valid({ visibility })).success).toBe(true);
  });

  it("rejects an unknown or missing visibility", () => {
    expect(messageFor(valid({ visibility: "public" }), "visibility")).toBe(EVENT_COPY.visibilityInvalid);
    expect(messageFor(valid({ visibility: undefined }), "visibility")).toBe(EVENT_COPY.visibilityInvalid);
  });

  describe("assignedMemberIds", () => {
    it("rejects a value that is not a uuid", () => {
      expect(messageFor(valid({ assignedMemberIds: ["nope"] }), "assignedMemberIds")).toBe(EVENT_COPY.invalidMember);
    });

    it("removes duplicates and keeps the order", () => {
      const r = eventInputSchema.parse(valid({ assignedMemberIds: [M2, M1, M2, M1] }));
      expect(r.assignedMemberIds).toEqual([M2, M1]);
    });
  });
});

describe("calendarTypeFor", () => {
  it("is family only for family visibility (D-07)", () => {
    expect(calendarTypeFor("family")).toBe("family");
    expect(calendarTypeFor("shared")).toBe("personal");
    expect(calendarTypeFor("private")).toBe("personal");
  });
});

describe("eventIdSchema", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(eventIdSchema.safeParse(M1).success).toBe(true);
    expect(eventIdSchema.safeParse("abc").success).toBe(false);
    expect(eventIdSchema.safeParse(undefined).success).toBe(false);
  });
});
