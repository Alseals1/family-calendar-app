import type { Visibility } from "./schema";

export type CalendarScope = "my" | "family" | "all";

/** The visibility a new event starts with, from the calendar the person is looking at (D-03). */
export function defaultVisibility(scope: CalendarScope): Visibility {
  return scope === "family" ? "family" : "private";
}
