import { z } from "zod";
import { EVENT_COPY } from "@/lib/copy";

// Limits match the database checks: events_title_length, events_description_length,
// events_location_length, events_end_after_start, events_all_day_midnight_utc.
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 5000;
export const LOCATION_MAX = 300;

export const VISIBILITIES = ["private", "shared", "family"] as const;
export const visibilitySchema = z.enum(VISIBILITIES, { error: EVENT_COPY.visibilityInvalid });
export type Visibility = z.infer<typeof visibilitySchema>;

export const CALENDAR_TYPES = ["personal", "family"] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];
const calendarTypeSchema = z.enum(CALENDAR_TYPES);

/** D-07: only family events are on the family calendar. */
export function calendarTypeFor(visibility: Visibility): CalendarType {
  return visibility === "family" ? "family" : "personal";
}

function isMidnightUtc(iso: string): boolean {
  const ms = Date.parse(iso);
  return !Number.isNaN(ms) && ms % 86_400_000 === 0;
}

const instant = z.iso.datetime({ offset: true, error: EVENT_COPY.timeInvalid });

/** Optional text: trimmed, and an empty value becomes null. */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .nullish()
    .transform((value) => (value ? value : null));
}

export const eventInputSchema = z
  .object({
    title: z
      .string({ error: EVENT_COPY.titleRequired })
      .trim()
      .min(1, EVENT_COPY.titleRequired)
      .max(TITLE_MAX, EVENT_COPY.titleTooLong),
    description: optionalText(DESCRIPTION_MAX, EVENT_COPY.descriptionTooLong),
    location: optionalText(LOCATION_MAX, EVENT_COPY.locationTooLong),
    isAllDay: z.boolean().default(false),
    startTime: instant,
    endTime: instant,
    visibility: visibilitySchema,
    assignedMemberIds: z
      .array(z.uuid({ error: EVENT_COPY.invalidMember }), { error: EVENT_COPY.invalidMember })
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  .superRefine((event, ctx) => {
    const start = Date.parse(event.startTime);
    const end = Date.parse(event.endTime);
    if (end <= start) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: EVENT_COPY.endBeforeStart });
    }
    if (event.isAllDay) {
      if (!isMidnightUtc(event.startTime)) {
        ctx.addIssue({ code: "custom", path: ["startTime"], message: EVENT_COPY.allDayInvalid });
      }
      if (!isMidnightUtc(event.endTime)) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: EVENT_COPY.allDayInvalid });
      }
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

export const eventIdSchema = z.uuid();

/** The event shape the calendar views use: a row plus the ids of the members it is assigned to. */
export type CalendarEvent = {
  id: string;
  family_id: string;
  created_by: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  visibility: Visibility;
  calendar_type: CalendarType;
  assignedMemberIds: string[];
};

/** Narrows the database's plain-string columns. A value outside the enums throws instead of being cast. */
export function parseVisibility(value: string): Visibility {
  return visibilitySchema.parse(value);
}

export function parseCalendarType(value: string): CalendarType {
  return calendarTypeSchema.parse(value);
}
