import type { CalendarEvent } from "./schema";

// Made-up events and members shared by the unit tests (never real data).

export const ME = "user-me";
export const SPOUSE = "user-spouse";

export const MEMBERS = [
  { id: "m-me", user_id: ME, calendar_color: "#1a2b3c" },
  { id: "m-spouse", user_id: SPOUSE, calendar_color: "#2b3c4d" },
  { id: "m-kid1", user_id: null, calendar_color: "#3c4d5e" },
  { id: "m-kid2", user_id: null, calendar_color: "#4d5e6f" },
];

export function makeEvent(over: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    family_id: "family-1",
    created_by: ME,
    title: over.id,
    description: null,
    location: null,
    start_time: "2026-06-03T15:00:00.000Z",
    end_time: "2026-06-03T16:00:00.000Z",
    is_all_day: false,
    visibility: "shared",
    calendar_type: "personal",
    assignedMemberIds: [],
    ...over,
  };
}
