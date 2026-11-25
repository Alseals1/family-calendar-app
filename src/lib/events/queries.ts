import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DateRange } from "@/lib/dates/ranges";
import { parseCalendarType, parseVisibility, type CalendarEvent } from "./schema";

// Reads go through row level security: a private event of another adult never comes back.

const EVENT_COLUMNS =
  "id, family_id, created_by, title, description, location, start_time, end_time, is_all_day, visibility, calendar_type, event_assignments(family_member_id)";

type EventRow = Omit<CalendarEvent, "assignedMemberIds" | "visibility" | "calendar_type"> & {
  visibility: string;
  calendar_type: string;
  event_assignments: { family_member_id: string }[];
};

function toCalendarEvent(row: EventRow): CalendarEvent {
  const { event_assignments, visibility, calendar_type, ...rest } = row;
  return {
    ...rest,
    visibility: parseVisibility(visibility),
    calendar_type: parseCalendarType(calendar_type),
    assignedMemberIds: event_assignments.map((a) => a.family_member_id),
  };
}

/** Events overlapping the half-open range, earliest first. */
export async function listEventsInRange(
  supabase: SupabaseClient<Database>,
  range: DateRange,
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_COLUMNS)
    .lt("start_time", range.end.toISOString())
    .gt("end_time", range.start.toISOString())
    .order("start_time");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toCalendarEvent(row as EventRow));
}

/** One event the viewer may see, or null when it does not exist or is not visible to them. */
export async function getEvent(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<CalendarEvent | null> {
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCalendarEvent(data as EventRow) : null;
}
