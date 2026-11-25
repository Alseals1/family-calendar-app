// All-day events (D-08) are stored as midnight UTC to midnight UTC, with an exclusive end,
// and shown by their stored dates with no time-zone shift. This file uses only yyyy-MM-dd
// strings and UTC fields, never the process time zone.

/** A calendar date as `yyyy-MM-dd`. */
export type DateKey = string;

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function parseDateKey(value: string): number {
  const match = DATE_KEY.exec(value);
  if (!match) throw new Error(`Not a yyyy-MM-dd date: ${value}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new Error(`Not a real date: ${value}`);
  }
  return ms;
}

function formatDateKey(ms: number): DateKey {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `endDate` is inclusive (what the user picks); the stored end is the next midnight. */
export function toAllDayRange(
  startDate: DateKey,
  endDate: DateKey,
): { startTime: string; endTime: string } {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (end < start) throw new Error("The end date is before the start date");
  return { startTime: new Date(start).toISOString(), endTime: new Date(end + DAY_MS).toISOString() };
}

/** The inverse of `toAllDayRange`: stored times back to the dates the user picked. */
export function fromAllDayRange(
  startTime: string,
  endTime: string,
): { startDate: DateKey; endDate: DateKey } {
  return {
    startDate: formatDateKey(Date.parse(startTime)),
    endDate: formatDateKey(Date.parse(endTime) - DAY_MS),
  };
}
