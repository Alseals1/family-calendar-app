import { createBrowserClient } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "./client";

vi.mock("@supabase/ssr", () => ({ createBrowserClient: vi.fn(() => ({ marker: "browser" })) }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("browser createClient", () => {
  it("builds a browser client from the env url and key", () => {
    const client = createClient();
    expect(createBrowserClient).toHaveBeenCalledWith("http://127.0.0.1:54321", "anon-key");
    expect(client).toEqual({ marker: "browser" });
  });

  it("throws when the env is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => createClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});
