import type { Tables } from "@/types/database";
import type { CalendarScope } from "./defaults";
import type { CalendarEvent } from "./schema";

export type FilterMember = Pick<Tables<"family_members">, "id" | "user_id" | "calendar_color">;

/**
 * Which events a scope shows (CAL-4). Another adult's private event is dropped in every scope:
 * row level security already withholds it, this is a second line of defense.
 */
export function applyScope(events: CalendarEvent[], scope: CalendarScope, me: string): CalendarEvent[] {
  return events.filter((event) => {
    if (event.visibility === "private" && event.created_by !== me) return false;
    if (scope === "my") return event.created_by === me && event.calendar_type === "personal";
    if (scope === "family") return event.visibility === "family";
    return true;
  });
}

/**
 * Keeps events that involve any selected member (CAL-5): assigned to them, or a personal event
 * created by a selected adult. An empty selection keeps everything.
 */
export function applyMemberFilter(
  events: CalendarEvent[],
  selectedMemberIds: string[],
  members: FilterMember[],
): CalendarEvent[] {
  if (selectedMemberIds.length === 0) return events;
  const selected = new Set(selectedMemberIds);
  const selectedAdults = new Set(
    members.filter((m) => selected.has(m.id) && m.user_id !== null).map((m) => m.user_id),
  );
  return events.filter(
    (event) =>
      event.assignedMemberIds.some((id) => selected.has(id)) ||
      (event.calendar_type === "personal" && selectedAdults.has(event.created_by)),
  );
}
