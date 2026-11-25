import { describe, expect, it } from "vitest";
import { localDateTimeToUtc, utcToLocalDateTime } from "./zoned";

describe("localDateTimeToUtc", () => {
  it("converts Chicago wall time (CDT, UTC-5)", () => {
    expect(localDateTimeToUtc("2026-06-03", "09:30", "America/Chicago")).toBe("2026-06-03T14:30:00.000Z");
  });

  it("converts Chicago wall time in winter (CST, UTC-6)", () => {
    expect(localDateTimeToUtc("2026-12-03", "09:30", "America/Chicago")).toBe("2026-12-03T15:30:00.000Z");
  });

  it("converts Tokyo wall time (UTC+9)", () => {
    expect(localDateTimeToUtc("2026-06-03", "09:30", "Asia/Tokyo")).toBe("2026-06-03T00:30:00.000Z");
  });

  it("resolves a time inside the spring-forward gap to the hour after", () => {
    expect(localDateTimeToUtc("2026-03-08", "02:30", "America/Chicago")).toBe("2026-03-08T08:30:00.000Z");
  });

  it("throws for an invalid date, time or zone", () => {
    expect(() => localDateTimeToUtc("2026-02-30", "09:00", "America/Chicago")).toThrow();
    expect(() => localDateTimeToUtc("2026-06-03", "25:00", "America/Chicago")).toThrow();
    expect(() => localDateTimeToUtc("2026-06-03", "9:00", "America/Chicago")).toThrow();
    expect(() => localDateTimeToUtc("2026-06-03", "09:00", "Not/AZone")).toThrow();
  });
});

describe("utcToLocalDateTime", () => {
  it("converts to Chicago and Tokyo", () => {
    expect(utcToLocalDateTime("2026-06-03T14:30:00.000Z", "America/Chicago")).toEqual({
      date: "2026-06-03",
      time: "09:30",
    });
    expect(utcToLocalDateTime("2026-06-03T00:30:00.000Z", "Asia/Tokyo")).toEqual({
      date: "2026-06-03",
      time: "09:30",
    });
  });

  it("moves to the previous local day when UTC is early", () => {
    expect(utcToLocalDateTime("2026-06-03T02:00:00.000Z", "America/Chicago")).toEqual({
      date: "2026-06-02",
      time: "21:00",
    });
  });

  it("round-trips", () => {
    for (const zone of ["America/Chicago", "Asia/Tokyo", "Asia/Kathmandu"]) {
      const iso = localDateTimeToUtc("2026-11-01", "13:45", zone);
      expect(utcToLocalDateTime(iso, zone)).toEqual({ date: "2026-11-01", time: "13:45" });
    }
  });
});
