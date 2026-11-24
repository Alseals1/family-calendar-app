import { describe, expect, it } from "vitest";
import { AUTH_COPY } from "@/lib/copy";
import {
  confirmErrorMessage,
  isGuestOnlyPath,
  isPublicPath,
  loginErrorMessage,
  postAuthPath,
  proxyRedirect,
} from "./redirects";

describe("proxyRedirect, signed out", () => {
  it.each(["/", "/calendar", "/onboarding", "/calendar/x", "/loginx", "/auth", "/registerx"])(
    "sends %s to /login",
    (pathname) => {
      expect(proxyRedirect({ pathname, isAuthenticated: false })).toBe("/login");
    },
  );

  it.each(["/login", "/register", "/auth/confirm", "/auth/anything/else"])(
    "lets %s through",
    (pathname) => {
      expect(proxyRedirect({ pathname, isAuthenticated: false })).toBeNull();
    },
  );
});

describe("proxyRedirect, signed in", () => {
  it.each(["/login", "/register"])("sends %s to /", (pathname) => {
    expect(proxyRedirect({ pathname, isAuthenticated: true })).toBe("/");
  });

  it.each(["/calendar", "/auth/confirm", "/", "/onboarding"])("lets %s through", (pathname) => {
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

  it("isGuestOnlyPath matches only /login and /register", () => {
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
