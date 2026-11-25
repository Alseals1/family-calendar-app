import { TZDate } from "@date-fns/tz";

const HOUR_MS = 3_600_000;
const HALF_HOUR = 30;

/**
 * Default times for a new event (EVT-7, D-09): the start is `now` rounded up to the next
 * :00 or :30 of local wall time in `timeZone` (a time already on a boundary is kept),
 * and the end is one hour later.
 */
export function defaultEventTimes(now: Date, timeZone: string): { start: Date; end: Date } {
  const local = new TZDate(now.getTime(), timeZone);
  // Local wall time, truncated to the minute.
  const wall = new TZDate(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    local.getHours(),
    local.getMinutes(),
    0,
    0,
    timeZone,
  );
  const onBoundary =
    local.getSeconds() === 0 && local.getMilliseconds() === 0 && local.getMinutes() % HALF_HOUR === 0;
  const add = onBoundary ? 0 : HALF_HOUR - (local.getMinutes() % HALF_HOUR);
  // Move on the wall clock, not by adding milliseconds, so zones with odd offsets stay on :00/:30.
  const startWall = new TZDate(
    wall.getFullYear(),
    wall.getMonth(),
    wall.getDate(),
    wall.getHours(),
    wall.getMinutes() + add,
    0,
    0,
    timeZone,
  );
  const start = new Date(startWall.getTime());
  return { start, end: new Date(start.getTime() + HOUR_MS) };
}
