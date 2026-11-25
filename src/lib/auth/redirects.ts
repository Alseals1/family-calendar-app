import { AUTH_COPY } from "@/lib/copy";

export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const HOME_PATH = "/";
export const ONBOARDING_PATH = "/onboarding";
export const CALENDAR_PATH = "/calendar";
export const CONFIRM_ERROR_PATH = "/login?error=confirm";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const RESET_LINK_ERROR_PATH = "/forgot-password?error=link";
export const RESET_DONE_PATH = "/login?reset=done";

const AUTH_PREFIX = "/auth/";

/** Paths a signed-out visitor may open. Default-deny: everything else needs a session. */
export function isPublicPath(pathname: string): boolean {
  return isGuestOnlyPath(pathname) || pathname.startsWith(AUTH_PREFIX);
}

/**
 * Paths that make no sense once signed in. /reset-password is deliberately not here or in
 * the public list: it needs the session the recovery link creates.
 */
export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === REGISTER_PATH || pathname === FORGOT_PASSWORD_PATH;
}

/** Where the proxy sends a request, or null to let it through. */
export function proxyRedirect(input: { pathname: string; isAuthenticated: boolean }): string | null {
  const { pathname, isAuthenticated } = input;
  if (!isAuthenticated) return isPublicPath(pathname) ? null : LOGIN_PATH;
  return isGuestOnlyPath(pathname) ? HOME_PATH : null;
}

/** The landing page for a signed-in user. */
export function postAuthPath(input: { hasFamily: boolean }): typeof CALENDAR_PATH | typeof ONBOARDING_PATH {
  return input.hasFamily ? CALENDAR_PATH : ONBOARDING_PATH;
}

/** Where /auth/confirm sends a verified link. A reset link always goes to the reset form. */
export function confirmSuccessPath(input: { type: string; hasFamily: boolean }): string {
  return input.type === "recovery" ? RESET_PASSWORD_PATH : postAuthPath({ hasFamily: input.hasFamily });
}

/** Where /auth/confirm sends a link that did not verify, by the raw `type` query value. */
export function confirmFailurePath(type: string | null): string {
  return type === "recovery" ? RESET_LINK_ERROR_PATH : CONFIRM_ERROR_PATH;
}

export function loginErrorMessage(code: string | undefined): string {
  if (code === "invalid_credentials") return AUTH_COPY.invalidCredentials;
  if (code === "email_not_confirmed") return AUTH_COPY.emailNotConfirmed;
  return AUTH_COPY.loginFailed;
}

/** Maps the `?error=` value on /login to a message, or null. */
export function confirmErrorMessage(param: string | undefined): string | null {
  return param === "confirm" ? AUTH_COPY.confirmInvalid : null;
}

/** Maps the `?error=` value on /forgot-password to a message, or null. */
export function resetLinkErrorMessage(param: string | undefined): string | null {
  return param === "link" ? AUTH_COPY.resetLinkInvalid : null;
}

/** Maps the `?reset=` value on /login to a notice, or null. */
export function loginNoticeMessage(param: string | undefined): string | null {
  return param === "done" ? AUTH_COPY.passwordResetDone : null;
}

/**
 * A reset request that Supabase rate-limits (429) only happens for an address that has an
 * account, so it is shown like a success. Any other error is a real failure.
 */
export function isNeutralResetRequestError(error: { status?: number } | null): boolean {
  return error?.status === 429;
}

/** Maps a Supabase `updateUser` error code to a field or form message. Never Supabase's text. */
export function updatePasswordError(code: string | undefined): { field: string } | { form: string } {
  if (code === "same_password") return { field: AUTH_COPY.samePassword };
  return { form: AUTH_COPY.resetFailed };
}
