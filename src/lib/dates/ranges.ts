import { tz, TZDate } from "@date-fns/tz";
import { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay } from "date-fns";
import { fromAllDayRange, type DateKey } from "./all-day";

export type CalendarView = "month" | "week" | "agenda";
/** 0 is Sunday, 1 is Monday. */
export type WeekStartsOn = 0 | 1;
/** Half-open: `start` is included, `end` is not. */
export type DateRange = { start: Date; end: Date };

const AGENDA_DAYS = 30;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function key(d: TZDate): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The range a view shows, as instants at local midnight in `timeZone`. */
export function getVisibleRange(
  view: CalendarView,
  anchor: Date,
  weekStartsOn: WeekStartsOn,
  timeZone: string,
): DateRange {
  const local = new TZDate(anchor.getTime(), timeZone);
  const opts = { weekStartsOn, in: tz(timeZone) };
  let start: Date;
  let end: Date;
  if (view === "month") {
    start = startOfWeek(startOfMonth(local, opts), opts);
    end = addDays(startOfDay(endOfWeek(endOfMonth(local, opts), opts), opts), 1, opts);
  } else if (view === "week") {
    start = startOfWeek(local, opts);
    end = addDays(start, 7, opts);
  } else {
    start = startOfDay(local, opts);
    end = addDays(start, AGENDA_DAYS, opts);
  }
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

type TimedSpan = { start_time: string; end_time: string };

/** True when the event overlaps the half-open range. Touching at an edge is outside. */
export function overlapsRange(event: TimedSpan, range: DateRange): boolean {
  return Date.parse(event.start_time) < range.end.getTime() && Date.parse(event.end_time) > range.start.getTime();
}

/**
 * The local `yyyy-MM-dd` days an event covers. All-day events use their stored dates with no
 * time-zone shift; timed events cover each local day from the start to one millisecond before the end.
 */
export function eventDays(event: TimedSpan & { is_all_day: boolean }, timeZone: string): DateKey[] {
  const days: DateKey[] = [];
  if (event.is_all_day) {
    const { startDate, endDate } = fromAllDayRange(event.start_time, event.end_time);
    // Walk the stored dates in UTC, never in local time.
    for (let ms = Date.parse(`${startDate}T00:00:00.000Z`); ms <= Date.parse(`${endDate}T00:00:00.000Z`); ms += 86_400_000) {
      days.push(new Date(ms).toISOString().slice(0, 10));
    }
    return days;
  }
  const first = startOfDay(new TZDate(Date.parse(event.start_time), timeZone));
  const last = new TZDate(Date.parse(event.end_time) - 1, timeZone);
  for (let day = first; day.getTime() <= last.getTime(); day = addDays(day, 1)) {
    days.push(key(day as TZDate));
  }
  return days;
}
