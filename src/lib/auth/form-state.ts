/** Result of an auth server action. Types only, so client components can import it. */
export type AuthFormState =
  | { status: "idle" }
  | {
      status: "error";
      fieldErrors?: Partial<Record<"fullName" | "email" | "password", string>>;
      formError?: string;
      /** Echoed so the field can be refilled. Never the password. */
      email?: string;
      fullName?: string;
    }
  | { status: "sent"; email: string };

export const IDLE_STATE: AuthFormState = { status: "idle" };
