"use server";

import { revalidatePath } from "next/cache";
import { fieldErrors } from "@/lib/auth/schemas";
import { EVENT_COPY } from "@/lib/copy";
import { createClient } from "@/lib/supabase/server";
import type { EventActionResult } from "./form-state";
import { createEvent, deleteEvent, updateEvent } from "./mutations";
import { eventIdSchema, eventInputSchema } from "./schema";

// Thin layer: validate with the shared zod schema first, then call the mutation with the
// request's Supabase client. Row level security and the database checks are the other lines.

const CALENDAR_PATH = "/calendar";

const notFound: EventActionResult = { status: "error", formError: EVENT_COPY.notFound };

function done(result: EventActionResult): EventActionResult {
  if (result.status === "ok") revalidatePath(CALENDAR_PATH);
  return result;
}

export async function createEventAction(input: unknown): Promise<EventActionResult> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed) };
  return done(await createEvent(await createClient(), parsed.data));
}

export async function updateEventAction(id: unknown, input: unknown): Promise<EventActionResult> {
  const parsedId = eventIdSchema.safeParse(id);
  if (!parsedId.success) return notFound;
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed) };
  return done(await updateEvent(await createClient(), parsedId.data, parsed.data));
}

export async function deleteEventAction(id: unknown): Promise<EventActionResult> {
  const parsedId = eventIdSchema.safeParse(id);
  if (!parsedId.success) return notFound;
  return done(await deleteEvent(await createClient(), parsedId.data));
}
