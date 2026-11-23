import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("getSupabaseEnv", () => {
  it("returns the url and anon key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(getSupabaseEnv()).toEqual({ url: "http://127.0.0.1:54321", anonKey: "anon-key" });
  });

  it("throws naming the url variable when it is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    expect(() => getSupabaseEnv()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("throws naming the anon key variable when it is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => getSupabaseEnv()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
