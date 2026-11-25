import { describe, expect, it } from "vitest";
import { AUTH_COPY } from "@/lib/copy";
import {
  confirmErrorMessage,
  confirmFailurePath,
  confirmSuccessPath,
  isGuestOnlyPath,
  isNeutralResetRequestError,
  isPublicPath,
  loginErrorMessage,
  loginNoticeMessage,
  postAuthPath,
  proxyRedirect,
  resetLinkErrorMessage,
  updatePasswordError,
} from "./redirects";

describe("proxyRedirect, signed out", () => {
  it.each(["/", "/calendar", "/onboarding", "/calendar/x", "/loginx", "/auth", "/registerx", "/reset-password", "/forgot-passwordx", "/reset-password/x"])(
    "sends %s to /login",
    (pathname) => {
      expect(proxyRedirect({ pathname, isAuthenticated: false })).toBe("/login");
    },
  );

  it.each(["/login", "/register", "/forgot-password", "/auth/confirm", "/auth/anything/else"])(
    "lets %s through",
    (pathname) => {
      expect(proxyRedirect({ pathname, isAuthenticated: false })).toBeNull();
    },
  );
});

describe("proxyRedirect, signed in", () => {
  it.each(["/login", "/register", "/forgot-password"])("sends %s to /", (pathname) => {
    expect(proxyRedirect({ pathname, isAuthenticated: true })).toBe("/");
  });

  it.each(["/calendar", "/auth/confirm", "/", "/onboarding", "/reset-password"])("lets %s through", (pathname) => {
    expect(proxyRedirect({ pathname, isAuthenticated: true })).toBeNull();
  });
});

describe("path helpers", () => {
  it("isPublicPath is exact for /login and /register and prefix-based for /auth/", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/auth/confirm")).toBe(true);
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/auth")).toBe(false);
    expect(isPublicPath("/calendar")).toBe(false);
  });

  it("treats /forgot-password as public and guest-only, exactly", () => {
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isGuestOnlyPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/forgot-passwordx")).toBe(false);
    expect(isGuestOnlyPath("/forgot-password/x")).toBe(false);
  });

  it("keeps /reset-password session-only: neither public nor guest-only", () => {
    expect(isPublicPath("/reset-password")).toBe(false);
    expect(isGuestOnlyPath("/reset-password")).toBe(false);
    expect(isPublicPath("/reset-password/x")).toBe(false);
  });

  it("isGuestOnlyPath matches only /login, /register and /forgot-password", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/register")).toBe(true);
    expect(isGuestOnlyPath("/auth/confirm")).toBe(false);
    expect(isGuestOnlyPath("/")).toBe(false);
  });
});

describe("postAuthPath", () => {
  it("goes to /calendar for a user with a family", () => {
    expect(postAuthPath({ hasFamily: true })).toBe("/calendar");
  });

  it("goes to /onboarding for a user without a family", () => {
    expect(postAuthPath({ hasFamily: false })).toBe("/onboarding");
  });
});

describe("loginErrorMessage", () => {
  it("maps invalid_credentials", () => {
    expect(loginErrorMessage("invalid_credentials")).toBe(AUTH_COPY.invalidCredentials);
  });

  it("maps email_not_confirmed", () => {
    expect(loginErrorMessage("email_not_confirmed")).toBe(AUTH_COPY.emailNotConfirmed);
  });

  it("falls back to a generic message for anything else", () => {
    expect(loginErrorMessage("over_request_rate_limit")).toBe(AUTH_COPY.loginFailed);
    expect(loginErrorMessage(undefined)).toBe(AUTH_COPY.loginFailed);
  });
});

describe("confirmErrorMessage", () => {
  it("maps ?error=confirm", () => {
    expect(confirmErrorMessage("confirm")).toBe(AUTH_COPY.confirmInvalid);
  });

  it("returns null for unknown or missing values", () => {
    expect(confirmErrorMessage("other")).toBeNull();
    expect(confirmErrorMessage(undefined)).toBeNull();
  });
});

describe("confirmSuccessPath", () => {
  it("sends a recovery link to /reset-password for either family state", () => {
    expect(confirmSuccessPath({ type: "recovery", hasFamily: true })).toBe("/reset-password");
    expect(confirmSuccessPath({ type: "recovery", hasFamily: false })).toBe("/reset-password");
  });

  it("sends email and signup links to the post-auth path", () => {
    expect(confirmSuccessPath({ type: "email", hasFamily: true })).toBe("/calendar");
    expect(confirmSuccessPath({ type: "signup", hasFamily: false })).toBe("/onboarding");
  });
});

describe("confirmFailurePath", () => {
  it("sends a failed recovery link to /forgot-password?error=link", () => {
    expect(confirmFailurePath("recovery")).toBe("/forgot-password?error=link");
  });

  it.each(["email", "signup", "junk", "", null])("sends %s to /login?error=confirm", (type) => {
    expect(confirmFailurePath(type)).toBe("/login?error=confirm");
  });
});

describe("resetLinkErrorMessage", () => {
  it("maps ?error=link", () => {
    expect(resetLinkErrorMessage("link")).toBe(AUTH_COPY.resetLinkInvalid);
  });

  it("returns null for unknown or missing values", () => {
    expect(resetLinkErrorMessage("other")).toBeNull();
    expect(resetLinkErrorMessage(undefined)).toBeNull();
  });
});

describe("loginNoticeMessage", () => {
  it("maps ?reset=done", () => {
    expect(loginNoticeMessage("done")).toBe(AUTH_COPY.passwordResetDone);
  });

  it("returns null for unknown or missing values", () => {
    expect(loginNoticeMessage("other")).toBeNull();
    expect(loginNoticeMessage(undefined)).toBeNull();
  });
});

describe("isNeutralResetRequestError", () => {
  it("is true only for a 429", () => {
    expect(isNeutralResetRequestError({ status: 429 })).toBe(true);
  });

  it.each([{ status: 400 }, { status: 500 }, {}, null])("is false for %j", (error) => {
    expect(isNeutralResetRequestError(error)).toBe(false);
  });
});

describe("updatePasswordError", () => {
  it("maps same_password to a field error", () => {
    expect(updatePasswordError("same_password")).toEqual({ field: AUTH_COPY.samePassword });
  });

  it.each(["weak_password", "session_not_found", undefined])("maps %s to a form error", (code) => {
    expect(updatePasswordError(code)).toEqual({ form: AUTH_COPY.resetFailed });
  });
});
