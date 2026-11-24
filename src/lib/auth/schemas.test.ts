import { describe, expect, it } from "vitest";
import { AUTH_COPY } from "@/lib/copy";
import {
  confirmParamsSchema,
  emailSchema,
  fieldErrors,
  fullNameSchema,
  loginSchema,
  registerSchema,
} from "./schemas";

const valid = { fullName: "Pat Example", email: "pat@example.test", password: "correct-horse" };

describe("registerSchema", () => {
  it("accepts valid input", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name and trims and lower-cases the email", () => {
    const result = registerSchema.parse({
      ...valid,
      fullName: "  Pat Example  ",
      email: "  Pat@Example.TEST ",
    });
    expect(result.fullName).toBe("Pat Example");
    expect(result.email).toBe("pat@example.test");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(fullNameSchema.safeParse("").success).toBe(false);
    expect(fullNameSchema.safeParse("   ").success).toBe(false);
  });

  it("rejects a 101-character name and accepts 100", () => {
    expect(fullNameSchema.safeParse("a".repeat(101)).success).toBe(false);
    expect(fullNameSchema.safeParse("a".repeat(100)).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("rejects a 255-character email and accepts 254", () => {
    const local = (n: number) => `${"a".repeat(n - "@example.test".length)}@example.test`;
    expect(emailSchema.safeParse(local(255)).success).toBe(false);
    expect(emailSchema.safeParse(local(254)).success).toBe(true);
  });

  it("rejects a 7-character password and accepts 8", () => {
    expect(registerSchema.safeParse({ ...valid, password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "12345678" }).success).toBe(true);
  });

  it("rejects a 73-character password and accepts 72", () => {
    expect(registerSchema.safeParse({ ...valid, password: "a".repeat(73) }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password, even a short one", () => {
    expect(loginSchema.safeParse({ email: "pat@example.test", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "pat@example.test", password: "" }).success).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("confirmParamsSchema", () => {
  it("accepts the email and signup types", () => {
    expect(confirmParamsSchema.safeParse({ token_hash: "abc", type: "email" }).success).toBe(true);
    expect(confirmParamsSchema.safeParse({ token_hash: "abc", type: "signup" }).success).toBe(true);
  });

  it("rejects recovery and magiclink", () => {
    expect(confirmParamsSchema.safeParse({ token_hash: "abc", type: "recovery" }).success).toBe(false);
    expect(confirmParamsSchema.safeParse({ token_hash: "abc", type: "magiclink" }).success).toBe(false);
  });

  it("rejects a missing or empty token_hash", () => {
    expect(confirmParamsSchema.safeParse({ type: "email" }).success).toBe(false);
    expect(confirmParamsSchema.safeParse({ token_hash: "", type: "email" }).success).toBe(false);
  });
});

describe("fieldErrors", () => {
  it("returns an empty object for a successful parse", () => {
    expect(fieldErrors(registerSchema.safeParse(valid))).toEqual({});
  });

  it("returns the first copy message for each failing field", () => {
    const errors = fieldErrors(
      registerSchema.safeParse({ fullName: "", email: "bad", password: "x" }),
    );
    expect(errors).toEqual({
      fullName: AUTH_COPY.nameRequired,
      email: AUTH_COPY.emailInvalid,
      password: AUTH_COPY.passwordTooShort,
    });
  });

  it("uses the login password message", () => {
    const errors = fieldErrors(loginSchema.safeParse({ email: "pat@example.test", password: "" }));
    expect(errors).toEqual({ password: AUTH_COPY.passwordRequired });
  });
});
