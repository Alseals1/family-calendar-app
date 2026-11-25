import { z } from "zod";
import { AUTH_COPY } from "@/lib/copy";

// Limits match the database: profiles_full_name_length, and Supabase's password rules.
const FULL_NAME_MAX = 100;
const EMAIL_MAX = 254;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export const fullNameSchema = z
  .string({ error: AUTH_COPY.nameRequired })
  .trim()
  .min(1, AUTH_COPY.nameRequired)
  .max(FULL_NAME_MAX, AUTH_COPY.nameTooLong);

export const emailSchema = z
  .string({ error: AUTH_COPY.emailInvalid })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, AUTH_COPY.emailTooLong)
  .pipe(z.email(AUTH_COPY.emailInvalid));

/** The rule for choosing a password: sign-up, password reset and (later) Settings. */
export const passwordSchema = z
  .string({ error: AUTH_COPY.passwordTooShort })
  .min(PASSWORD_MIN, AUTH_COPY.passwordTooShort)
  .max(PASSWORD_MAX, AUTH_COPY.passwordTooLong);

export const registerSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z.object({ password: passwordSchema });

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: AUTH_COPY.passwordRequired })
    .min(1, AUTH_COPY.passwordRequired),
});

/** Query parameters of /auth/confirm: email confirmation links and password-reset links. */
export const confirmParamsSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(["email", "signup", "recovery"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;

/** First message per field, or an empty object when the parse succeeded. */
export function fieldErrors<T extends Record<string, unknown>>(
  result: z.ZodSafeParseResult<T>,
): Partial<Record<keyof T & string, string>> {
  const errors: Partial<Record<keyof T & string, string>> = {};
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    const field = issue.path[0] as (keyof T & string) | undefined;
    if (field !== undefined && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}
