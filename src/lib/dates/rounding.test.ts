import { describe, expect, it } from "vitest";
import { defaultEventTimes } from "./rounding";
import { utcToLocalDateTime } from "./zoned";

const MIN = 60_000;

describe.each(["America/Chicago", "Asia/Tokyo", "Asia/Kathmandu"])("defaultEventTimes in %s", (zone) => {
  // Builds a UTC instant from a local wall time in `zone` by searching, so the cases read as local time.
  function at(date: string, time: string, seconds = 0, ms = 0): Date {
    const [h, m] = time.split(":").map(Number);
    const base = Date.parse(`${date}T00:00:00.000Z`);
    for (let offsetMin = -14 * 60; offsetMin <= 14 * 60; offsetMin += 15) {
      const candidate = new Date(base + (h * 60 + m) * MIN - offsetMin * MIN);
      const local = utcToLocalDateTime(candidate.toISOString(), zone);
      if (local.date === date && local.time === time) {
        return new Date(candidate.getTime() + seconds * 1000 + ms);
      }
    }
    throw new Error("no instant found");
  }

  function local(d: Date) {
    return utcToLocalDateTime(d.toISOString(), zone);
  }

  it("keeps a time exactly on :00", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "10:00"), zone).start)).toEqual({ date: "2026-06-03", time: "10:00" });
  });

  it("rounds 10:00:01 up to 10:30", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "10:00", 1), zone).start).time).toBe("10:30");
  });

  it("rounds 10:00:00.001 up to 10:30", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "10:00", 0, 1), zone).start).time).toBe("10:30");
  });

  it("rounds 10:29 up to 10:30", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "10:29", 30), zone).start).time).toBe("10:30");
  });

  it("keeps a time exactly on :30", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "10:30"), zone).start).time).toBe("10:30");
  });

  it("rounds 10:30:01 up to 11:00", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "10:30", 1), zone).start).time).toBe("11:00");
  });

  it("rounds 10:59 up to 11:00", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "10:59", 59, 999), zone).start).time).toBe("11:00");
  });

  it("rolls 23:59 over to 00:00 on the next day", () => {
    expect(local(defaultEventTimes(at("2026-06-03", "23:59"), zone).start)).toEqual({ date: "2026-06-04", time: "00:00" });
  });

  it("ends one hour after the start, with no seconds", () => {
    const { start, end } = defaultEventTimes(at("2026-06-03", "10:29", 30), zone);
    expect(end.getTime() - start.getTime()).toBe(60 * MIN);
    expect(start.getTime() % MIN).toBe(0);
  });
});

describe("defaultEventTimes in a half-hour offset zone", () => {
  it("rounds to local :00/:30, not UTC :00/:30 (Kathmandu is UTC+5:45)", () => {
    // 04:10Z is 09:55 in Kathmandu, so the next boundary is 10:00 local = 04:15Z.
    const { start } = defaultEventTimes(new Date("2026-06-03T04:10:00.000Z"), "Asia/Kathmandu");
    expect(start.toISOString()).toBe("2026-06-03T04:15:00.000Z");
  });
});
