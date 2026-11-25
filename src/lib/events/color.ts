import { NEUTRAL_EVENT_COLOR } from "@/lib/colors/palette";
import type { FilterMember } from "./scope-filter";
import type { CalendarEvent } from "./schema";

/**
 * The color an event is drawn in (CAL-6): the first member of `members` (in the order the caller
 * passes) the event is assigned to; otherwise the creator's color for a personal event; otherwise gray.
 */
export function eventColor(event: CalendarEvent, members: FilterMember[]): string {
  const assigned = new Set(event.assignedMemberIds);
  const first = members.find((m) => assigned.has(m.id));
  if (first) return first.calendar_color;
  if (event.calendar_type === "personal") {
    const creator = members.find((m) => m.user_id === event.created_by);
    if (creator) return creator.calendar_color;
  }
  return NEUTRAL_EVENT_COLOR;
}
