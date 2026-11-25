/** Result of the create-family server action. Types only, so client components can import it. */
export type FamilyFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors?: Partial<Record<"familyName" | "displayName" | "color", string>>;
      formError?: string;
      /** Echoed so the fields can be refilled. */
      familyName?: string;
      displayName?: string;
      color?: string;
    };

export const FAMILY_IDLE_STATE: FamilyFormState = { status: "idle" };
