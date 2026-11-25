import type { EventInput } from "./schema";

export type EventField = keyof EventInput;

/** What the event server actions return. Types only, so client code can import it. */
export type EventActionResult =
  | { status: "ok"; id: string }
  | {
      status: "error";
      fieldErrors?: Partial<Record<EventField, string>>;
      formError?: string;
    };
