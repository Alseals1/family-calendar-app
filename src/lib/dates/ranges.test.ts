import { describe, expect, it } from "vitest";
import { eventDays, getVisibleRange, overlapsRange } from "./ranges";
import { toAllDayRange } from "./all-day";
import { utcToLocalDateTime } from "./zoned";

const CHI = "America/Chicago";
const TOKYO = "Asia/Tokyo";
const iso = (d: Date) => d.toISOString();
const days = (r: { start: Date; end: Date }) => Math.round((r.end.getTime() - r.start.getTime()) / 86_400_000);

describe("getVisibleRange: month", () => {
  const anchor = new Date("2026-06-03T12:00:00Z");

  it("starts on the week start holding the 1st and ends the day after the week holding the last day (Sunday start)", () => {
    const r = getVisibleRange("month", anchor, 0, CHI);
    // June 2026: Mon the 1st .. Tue the 30th. Rows run Sun May 31 .. Sat Jul 4.
    expect(iso(r.start)).toBe("2026-05-31T05:00:00.000Z");
    expect(iso(r.end)).toBe("2026-07-05T05:00:00.000Z");
    expect(days(r)).toBe(35);
  });

  it("supports a Monday week start", () => {
    const r = getVisibleRange("month", anchor, 1, CHI);
    expect(iso(r.start)).toBe("2026-06-01T05:00:00.000Z");
    expect(iso(r.end)).toBe("2026-07-06T05:00:00.000Z");
  });

  it("uses 4 rows for a 28-day February that starts on the week start", () => {
    const r = getVisibleRange("month", new Date("2026-02-14T12:00:00Z"), 0, CHI);
    expect(days(r)).toBe(28);
  });

  it("uses 6 rows when the month needs them", () => {
    const r = getVisibleRange("month", new Date("2026-08-15T12:00:00Z"), 0, CHI);
    expect(days(r)).toBe(42);
  });

  it("still starts and ends at local midnight across a DST change", () => {
    const r = getVisibleRange("month", new Date("2026-03-15T12:00:00Z"), 0, CHI);
    expect(utcToLocalDateTime(iso(r.start), CHI)).toEqual({ date: "2026-03-01", time: "00:00" });
    expect(utcToLocalDateTime(iso(r.end), CHI)).toEqual({ date: "2026-04-05", time: "00:00" });
  });

  it("uses the time zone to find the anchor's month", () => {
    // 2026-07-01T02:00Z is still June 30 in Chicago but already July 1 in Tokyo.
    const instant = new Date("2026-07-01T02:00:00Z");
    expect(utcToLocalDateTime(iso(getVisibleRange("month", instant, 0, CHI).start), CHI).date).toBe("2026-05-31");
    expect(utcToLocalDateTime(iso(getVisibleRange("month", instant, 0, TOKYO).start), TOKYO).date).toBe("2026-06-28");
  });
});

describe("getVisibleRange: week", () => {
  const anchor = new Date("2026-06-03T12:00:00Z"); // Wednesday

  it("is the 7 days holding the anchor, Sunday start", () => {
    const r = getVisibleRange("week", anchor, 0, CHI);
    expect(iso(r.start)).toBe("2026-05-31T05:00:00.000Z");
    expect(days(r)).toBe(7);
  });

  it("is the 7 days holding the anchor, Monday start", () => {
    const r = getVisibleRange("week", anchor, 1, CHI);
    expect(iso(r.start)).toBe("2026-06-01T05:00:00.000Z");
    expect(iso(r.end)).toBe("2026-06-08T05:00:00.000Z");
  });

  it("when the anchor is the week start itself, starts that day", () => {
    const r = getVisibleRange("week", new Date("2026-06-01T12:00:00Z"), 1, CHI);
    expect(iso(r.start)).toBe("2026-06-01T05:00:00.000Z");
  });
});

describe("getVisibleRange: agenda", () => {
  it("is the local start of the anchor's day to 30 days later", () => {
    const r = getVisibleRange("agenda", new Date("2026-06-03T20:15:00Z"), 0, CHI);
    expect(iso(r.start)).toBe("2026-06-03T05:00:00.000Z");
    expect(iso(r.end)).toBe("2026-07-03T05:00:00.000Z");
  });

  it("keeps local midnight when the 30 days cross a DST change", () => {
    const r = getVisibleRange("agenda", new Date("2026-03-01T18:00:00Z"), 0, CHI);
    expect(utcToLocalDateTime(iso(r.end), CHI)).toEqual({ date: "2026-03-31", time: "00:00" });
  });
});

describe("overlapsRange", () => {
  const range = { start: new Date("2026-06-10T00:00:00Z"), end: new Date("2026-06-17T00:00:00Z") };
  const ev = (s: string, e: string) => ({ start_time: s, end_time: e });

  it("is true for an event inside, and for one straddling either edge", () => {
    expect(overlapsRange(ev("2026-06-11T10:00:00Z", "2026-06-11T11:00:00Z"), range)).toBe(true);
    expect(overlapsRange(ev("2026-06-09T23:00:00Z", "2026-06-10T01:00:00Z"), range)).toBe(true);
    expect(overlapsRange(ev("2026-06-16T23:00:00Z", "2026-06-17T01:00:00Z"), range)).toBe(true);
  });

  it("is false for an event ending exactly at the range start", () => {
    expect(overlapsRange(ev("2026-06-09T23:00:00Z", "2026-06-10T00:00:00Z"), range)).toBe(false);
  });

  it("is false for an event starting exactly at the range end", () => {
    expect(overlapsRange(ev("2026-06-17T00:00:00Z", "2026-06-17T01:00:00Z"), range)).toBe(false);
  });

  it("is false for events entirely before or after", () => {
    expect(overlapsRange(ev("2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z"), range)).toBe(false);
    expect(overlapsRange(ev("2026-07-01T00:00:00Z", "2026-07-02T00:00:00Z"), range)).toBe(false);
  });

  describe.each([CHI, TOKYO])("all-day events in %s", (zone) => {
    // A Sunday-start June month: first visible day 2026-05-31, last visible day 2026-07-04.
    const month = getVisibleRange("month", new Date("2026-06-03T12:00:00Z"), 0, zone);

    it("is inside the range on the first visible day", () => {
      const { startTime, endTime } = toAllDayRange("2026-05-31", "2026-05-31");
      expect(overlapsRange(ev(startTime, endTime), month)).toBe(true);
    });

    it("is inside the range on the last visible day", () => {
      const { startTime, endTime } = toAllDayRange("2026-07-04", "2026-07-04");
      expect(overlapsRange(ev(startTime, endTime), month)).toBe(true);
    });
  });
});

describe("eventDays", () => {
  const timed = (s: string, e: string) => ({ start_time: s, end_time: e, is_all_day: false });

  it("returns one key for an event inside a day", () => {
    expect(eventDays(timed("2026-06-03T15:00:00Z", "2026-06-03T16:00:00Z"), CHI)).toEqual(["2026-06-03"]);
  });

  it("covers every local day of a multi-day timed event", () => {
    expect(eventDays(timed("2026-06-03T15:00:00Z", "2026-06-05T16:00:00Z"), CHI)).toEqual([
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });

  it("covers two days for an overnight event (22:00 to 02:00 local)", () => {
    // 22:00 Chicago on 06-03 = 03:00Z on 06-04; 02:00 on 06-04 = 07:00Z.
    expect(eventDays(timed("2026-06-04T03:00:00Z", "2026-06-04T07:00:00Z"), CHI)).toEqual(["2026-06-03", "2026-06-04"]);
  });

  it("covers one day for an event that ends exactly at local midnight", () => {
    // 09:00 to 00:00 next day, Chicago: 14:00Z to 05:00Z.
    expect(eventDays(timed("2026-06-03T14:00:00Z", "2026-06-04T05:00:00Z"), CHI)).toEqual(["2026-06-03"]);
  });

  it("uses the viewer's zone for timed events", () => {
    const e = timed("2026-06-03T20:00:00Z", "2026-06-03T21:00:00Z");
    expect(eventDays(e, CHI)).toEqual(["2026-06-03"]);
    expect(eventDays(e, TOKYO)).toEqual(["2026-06-04"]);
  });

  it.each([CHI, TOKYO])("gives the same 3 keys for a 3-day all-day event in %s", (zone) => {
    const { startTime, endTime } = toAllDayRange("2026-06-03", "2026-06-05");
    expect(eventDays({ start_time: startTime, end_time: endTime, is_all_day: true }, zone)).toEqual([
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });

  it("gives one key for a single-day all-day event", () => {
    const { startTime, endTime } = toAllDayRange("2026-12-31", "2026-12-31");
    expect(eventDays({ start_time: startTime, end_time: endTime, is_all_day: true }, TOKYO)).toEqual(["2026-12-31"]);
  });
});
