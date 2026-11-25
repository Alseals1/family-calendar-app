export type CreateFamilyOutcome = "created" | "already" | "failed";

/** 23505: the caller already belongs to a family, so they go on to the calendar. */
const ALREADY_IN_FAMILY = "23505";

/** What the create-family action does for the RPC's error code (null when it worked). */
export function createFamilyOutcome(errorCode: string | null): CreateFamilyOutcome {
  if (errorCode === null) return "created";
  return errorCode === ALREADY_IN_FAMILY ? "already" : "failed";
}
