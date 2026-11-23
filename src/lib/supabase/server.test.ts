// @vitest-environment node
import { createServerClient } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "./server";

const store = { getAll: vi.fn(), set: vi.fn() };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => store) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ marker: "server" })) }));

type Adapter = {
  getAll: () => unknown;
  setAll: (cookies: { name: string; value: string; options?: object }[]) => void;
};

function adapter(): Adapter {
  const call = vi.mocked(createServerClient).mock.calls[0];
  return (call[2] as { cookies: Adapter }).cookies;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("server createClient", () => {
  it("passes the env url and key", async () => {
    await createClient();
    const call = vi.mocked(createServerClient).mock.calls[0];
    expect(call[0]).toBe("http://127.0.0.1:54321");
    expect(call[1]).toBe("anon-key");
  });

  it("getAll returns the cookie store contents", async () => {
    store.getAll.mockReturnValue([{ name: "a", value: "1" }]);
    await createClient();
    expect(adapter().getAll()).toEqual([{ name: "a", value: "1" }]);
  });

  it("setAll writes each cookie to the store", async () => {
    await createClient();
    adapter().setAll([
      { name: "a", value: "1", options: { path: "/" } },
      { name: "b", value: "2" },
    ]);
    expect(store.set).toHaveBeenCalledTimes(2);
    expect(store.set).toHaveBeenCalledWith("a", "1", { path: "/" });
  });

  it("setAll does not throw when the store is read-only", async () => {
    store.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });
    await createClient();
    expect(() => adapter().setAll([{ name: "a", value: "1" }])).not.toThrow();
  });
});
