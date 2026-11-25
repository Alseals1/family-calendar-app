import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fromAllDayRange, toAllDayRange } from "./all-day";

describe.each(["America/Chicago", "Asia/Tokyo"])("all-day conversion with the process in %s", (zone) => {
  beforeEach(() => {
    vi.stubEnv("TZ", zone);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("really runs in that zone", () => {
    const offset = new Date(2026, 0, 1).getTimezoneOffset();
    expect(offset).toBe(zone === "Asia/Tokyo" ? -540 : 360);
  });

  it("stores an inclusive end date as an exclusive midnight", () => {
    expect(toAllDayRange("2026-06-03", "2026-06-05")).toEqual({
      startTime: "2026-06-03T00:00:00.000Z",
      endTime: "2026-06-06T00:00:00.000Z",
    });
  });

  it("stores a single day as d to d+1", () => {
    expect(toAllDayRange("2026-06-03", "2026-06-03")).toEqual({
      startTime: "2026-06-03T00:00:00.000Z",
      endTime: "2026-06-04T00:00:00.000Z",
    });
  });

  it("handles the end of a month and a year", () => {
    expect(toAllDayRange("2026-12-31", "2026-12-31").endTime).toBe("2027-01-01T00:00:00.000Z");
    expect(toAllDayRange("2026-01-30", "2026-01-31").endTime).toBe("2026-02-01T00:00:00.000Z");
  });

  it("handles a leap day", () => {
    expect(toAllDayRange("2028-02-28", "2028-02-28").endTime).toBe("2028-02-29T00:00:00.000Z");
    expect(toAllDayRange("2028-02-29", "2028-02-29").endTime).toBe("2028-03-01T00:00:00.000Z");
  });

  it("does not shift across a DST change", () => {
    expect(toAllDayRange("2026-03-08", "2026-03-08")).toEqual({
      startTime: "2026-03-08T00:00:00.000Z",
      endTime: "2026-03-09T00:00:00.000Z",
    });
  });

  it("fromAllDayRange is the exact inverse", () => {
    expect(
      fromAllDayRange("2026-06-03T00:00:00.000Z", "2026-06-06T00:00:00.000Z"),
    ).toEqual({ startDate: "2026-06-03", endDate: "2026-06-05" });
    for (const [s, e] of [
      ["2026-06-03", "2026-06-05"],
      ["2026-12-31", "2026-12-31"],
      ["2028-02-28", "2028-02-29"],
    ] as const) {
      const range = toAllDayRange(s, e);
      expect(fromAllDayRange(range.startTime, range.endTime)).toEqual({ startDate: s, endDate: e });
    }
  });
});

describe("toAllDayRange errors", () => {
  it.each(["", "2026-6-3", "2026-02-30", "2026-13-01", "not a date", "2026-06-03T00:00"])(
    "throws for the invalid date %j",
    (bad) => {
      expect(() => toAllDayRange(bad, "2026-06-05")).toThrow();
      expect(() => toAllDayRange("2026-06-01", bad)).toThrow();
    },
  );

  it("throws when the end date is before the start date", () => {
    expect(() => toAllDayRange("2026-06-05", "2026-06-04")).toThrow();
  });
});
