import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { myFamilyId } from "@/lib/auth/family";
import { EVENT_COPY } from "@/lib/copy";
import { getEvent } from "./queries";
import { calendarTypeFor, type EventInput } from "./schema";
import type { EventActionResult } from "./form-state";

// Writes for events and their assignments. They take the Supabase client as an argument, so the
// server actions pass the request's client and the integration test passes a signed-in local user.
// Row level security is the permission guard; the checks here only give clear messages.

type Client = SupabaseClient<Database>;
type DbError = { code?: string; message?: string } | null;

const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";

const failure = (formError: string): EventActionResult => ({ status: "error", formError });

/** Never returns the database's own error text. */
function writeError(error: NonNullable<DbError>, fallback: string): EventActionResult {
  if (error.code === FOREIGN_KEY_VIOLATION || error.code === UNIQUE_VIOLATION) {
    return { status: "error", fieldErrors: { assignedMemberIds: EVENT_COPY.invalidMember } };
  }
  return failure(fallback);
}

async function signedIn(supabase: Client): Promise<{ userId: string; familyId: string } | EventActionResult> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return failure(EVENT_COPY.notSignedIn);
  const familyId = await myFamilyId(supabase, data.user.id);
  if (!familyId) return failure(EVENT_COPY.noFamily);
  return { userId: data.user.id, familyId };
}

function isFailure(value: { userId: string; familyId: string } | EventActionResult): value is EventActionResult {
  return "status" in value;
}

function eventColumns(input: EventInput) {
  return {
    title: input.title,
    description: input.description,
    location: input.location,
    start_time: input.startTime,
    end_time: input.endTime,
    is_all_day: input.isAllDay,
    visibility: input.visibility,
    calendar_type: calendarTypeFor(input.visibility),
  };
}

export async function createEvent(supabase: Client, input: EventInput): Promise<EventActionResult> {
  const who = await signedIn(supabase);
  if (isFailure(who)) return who;

  const { data, error } = await supabase
    .from("events")
    .insert({ family_id: who.familyId, created_by: who.userId, ...eventColumns(input) })
    .select("id")
    .single();
  if (error || !data) return failure(EVENT_COPY.saveFailed);

  if (input.assignedMemberIds.length > 0) {
    const { error: assignError } = await supabase.from("event_assignments").insert(
      input.assignedMemberIds.map((memberId) => ({
        event_id: data.id,
        family_member_id: memberId,
        family_id: who.familyId,
      })),
    );
    if (assignError) {
      // Do not leave an event behind without the members the person chose.
      await supabase.from("events").delete().eq("id", data.id);
      return writeError(assignError, EVENT_COPY.saveFailed);
    }
  }
  return { status: "ok", id: data.id };
}

export async function updateEvent(
  supabase: Client,
  id: string,
  input: EventInput,
): Promise<EventActionResult> {
  const who = await signedIn(supabase);
  if (isFailure(who)) return who;

  const existing = await getEvent(supabase, id);
  if (!existing) return failure(EVENT_COPY.notFound);

  if (existing.created_by !== who.userId) {
    // Another adult may edit only family events, and may not change who sees them.
    if (existing.visibility !== "family") return failure(EVENT_COPY.forbidden);
    if (input.visibility !== "family") {
      return { status: "error", fieldErrors: { visibility: EVENT_COPY.visibilityLocked } };
    }
  }

  const { data, error } = await supabase
    .from("events")
    .update(eventColumns(input))
    .eq("id", id)
    .select("id");
  if (error) return writeError(error, EVENT_COPY.saveFailed);
  if (!data || data.length === 0) return failure(EVENT_COPY.forbidden);

  const wanted = new Set(input.assignedMemberIds);
  const current = new Set(existing.assignedMemberIds);
  const removed = [...current].filter((memberId) => !wanted.has(memberId));
  const added = [...wanted].filter((memberId) => !current.has(memberId));

  // Add first, so a failed insert never loses assignments that were already there.
  if (added.length > 0) {
    const { error: addError } = await supabase.from("event_assignments").insert(
      added.map((memberId) => ({ event_id: id, family_member_id: memberId, family_id: who.familyId })),
    );
    if (addError) return writeError(addError, EVENT_COPY.assignmentsFailed);
  }
  if (removed.length > 0) {
    const { error: removeError } = await supabase
      .from("event_assignments")
      .delete()
      .eq("event_id", id)
      .in("family_member_id", removed);
    if (removeError) return failure(EVENT_COPY.assignmentsFailed);
  }
  return { status: "ok", id };
}

export async function deleteEvent(supabase: Client, id: string): Promise<EventActionResult> {
  const who = await signedIn(supabase);
  if (isFailure(who)) return who;

  const { data, error } = await supabase.from("events").delete().eq("id", id).select("id");
  if (error) return failure(EVENT_COPY.deleteFailed);
  // RLS hides events the person may not see or delete, so both look the same.
  if (!data || data.length === 0) return failure(EVENT_COPY.notFound);
  return { status: "ok", id };
}
