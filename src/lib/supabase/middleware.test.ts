// @vitest-environment node
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateSession } from "./middleware";

const getUser = vi.fn(async (): Promise<{ data: { user: object | null }; error: null }> => ({
  data: { user: null },
  error: null,
}));
const signedIn = { data: { user: { id: "user-1" } }, error: null };

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser } })),
}));

type Adapter = {
  getAll: () => unknown;
  setAll: (
    cookies: { name: string; value: string; options?: object }[],
    headers: Record<string, string>,
  ) => void;
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("updateSession", () => {
  it("calls auth.getUser once and does not redirect on a public path", async () => {
    const response = await updateSession(new NextRequest("http://localhost:3100/login"));
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("copies refreshed cookies onto the request and the response", async () => {
    const request = new NextRequest("http://localhost:3100/login");
    vi.mocked(getUser).mockImplementationOnce(async () => {
      const call = vi.mocked(createServerClient).mock.calls[0];
      (call[2] as { cookies: Adapter }).cookies.setAll([{ name: "sb-token", value: "fresh" }], {});
      return { data: { user: null }, error: null };
    });
    const response = await updateSession(request);
    expect(response.cookies.get("sb-token")?.value).toBe("fresh");
    expect(request.cookies.get("sb-token")?.value).toBe("fresh");
  });

  it("sets the no-store headers that @supabase/ssr passes with refreshed cookies", async () => {
    const headers = {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    };
    vi.mocked(getUser).mockImplementationOnce(async () => {
      const call = vi.mocked(createServerClient).mock.calls[0];
      (call[2] as { cookies: Adapter }).cookies.setAll(
        [{ name: "sb-token", value: "fresh" }],
        headers,
      );
      return { data: { user: null }, error: null };
    });
    const response = await updateSession(new NextRequest("http://localhost:3100/login"));
    expect(response.headers.get("cache-control")).toBe(headers["Cache-Control"]);
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("redirects a signed-out visit to a protected path to /login", async () => {
    const response = await updateSession(new NextRequest("http://localhost:3100/calendar"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3100/login");
  });

  it("lets a signed-out visit to /forgot-password through", async () => {
    const response = await updateSession(new NextRequest("http://localhost:3100/forgot-password"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects a signed-out visit to /reset-password to /login", async () => {
    const response = await updateSession(new NextRequest("http://localhost:3100/reset-password"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3100/login");
  });

  it("redirects a signed-in visit to /login on to /", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(signedIn);
    const response = await updateSession(new NextRequest("http://localhost:3100/login"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3100/");
  });

  it("lets a signed-in visit to /calendar through", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(signedIn);
    const response = await updateSession(new NextRequest("http://localhost:3100/calendar"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps refreshed cookies and no-store headers on a redirect", async () => {
    const headers = {
      "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
      Expires: "0",
      Pragma: "no-cache",
    };
    vi.mocked(getUser).mockImplementationOnce(async () => {
      const call = vi.mocked(createServerClient).mock.calls[0];
      (call[2] as { cookies: Adapter }).cookies.setAll(
        [{ name: "sb-token", value: "fresh" }],
        headers,
      );
      return { data: { user: null }, error: null };
    });
    const response = await updateSession(new NextRequest("http://localhost:3100/calendar"));
    expect(response.status).toBe(307);
    expect(response.cookies.get("sb-token")?.value).toBe("fresh");
    expect(response.headers.get("cache-control")).toBe(headers["Cache-Control"]);
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
});
