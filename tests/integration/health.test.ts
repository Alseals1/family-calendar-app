import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

describe("local Supabase stack", () => {
  it("answers the auth health check with a valid key", async () => {
    const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { version?: unknown };
    expect(typeof body.version).toBe("string");
  });

  it("reaches PostgREST through supabase-js", async () => {
    const supabase = createClient(url, anonKey);
    const { error } = await supabase.from("__health_check_missing").select("*");
    expect(error?.code).toBe("PGRST205");
  });

  it("rejects a bad token", async () => {
    // The auth health endpoint is public, so check PostgREST, which verifies the JWT.
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: "not-a-key", Authorization: "Bearer not-a-key" },
    });
    expect(response.status).toBe(401);
  });
});
