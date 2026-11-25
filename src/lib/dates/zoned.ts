import { TZDate } from "@date-fns/tz";

// Local wall time <-> UTC for an explicit IANA time zone, so results never depend on the
// machine's own zone (the server runs in UTC).

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The UTC instant (ISO string) for a local `yyyy-MM-dd` date and `HH:mm` time in `timeZone`.
 * A time that does not exist (inside a spring-forward gap) resolves to the hour after.
 */
export function localDateTimeToUtc(date: string, time: string, timeZone: string): string {
  const d = DATE.exec(date);
  const t = TIME.exec(time);
  if (!d || !t) throw new Error(`Invalid local date or time: ${date} ${time}`);
  const [year, month, day, hour, minute] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new Error(`Not a real date: ${date}`);
  }
  if (hour > 23 || minute > 59) throw new Error(`Not a real time: ${time}`);
  const zoned = new TZDate(year, month - 1, day, hour, minute, 0, 0, timeZone);
  if (Number.isNaN(zoned.getTime())) throw new Error(`Invalid time zone: ${timeZone}`);
  return new Date(zoned.getTime()).toISOString();
}

/** The local `yyyy-MM-dd` date and `HH:mm` time of a UTC instant in `timeZone`. */
export function utcToLocalDateTime(iso: string, timeZone: string): { date: string; time: string } {
  const instant = Date.parse(iso);
  if (Number.isNaN(instant)) throw new Error(`Invalid date-time: ${iso}`);
  const zoned = new TZDate(instant, timeZone);
  if (Number.isNaN(zoned.getTime())) throw new Error(`Invalid time zone: ${timeZone}`);
  return {
    date: `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`,
    time: `${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`,
  };
}
