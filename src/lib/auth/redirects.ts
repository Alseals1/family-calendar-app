import { AUTH_COPY } from "@/lib/copy";

export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const HOME_PATH = "/";
export const ONBOARDING_PATH = "/onboarding";
export const CALENDAR_PATH = "/calendar";
export const CONFIRM_ERROR_PATH = "/login?error=confirm";

const AUTH_PREFIX = "/auth/";

/** Paths a signed-out visitor may open. Default-deny: everything else needs a session. */
export function isPublicPath(pathname: string): boolean {
  return isGuestOnlyPath(pathname) || pathname.startsWith(AUTH_PREFIX);
}

/** Paths that make no sense once signed in. */
export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === REGISTER_PATH;
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

export function loginErrorMessage(code: string | undefined): string {
  if (code === "invalid_credentials") return AUTH_COPY.invalidCredentials;
  if (code === "email_not_confirmed") return AUTH_COPY.emailNotConfirmed;
  return AUTH_COPY.loginFailed;
}

/** Maps the `?error=` value on /login to a message, or null. */
export function confirmErrorMessage(param: string | undefined): string | null {
  return param === "confirm" ? AUTH_COPY.confirmInvalid : null;
}
