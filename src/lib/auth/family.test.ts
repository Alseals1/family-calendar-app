import { describe, expect, it, vi } from "vitest";
import { hasFamily, myFamilyId } from "./family";

type Result = { data: { id: string }[] | null; error: { message: string } | null };

function fakeClient(result: Result) {
  const calls: { table?: string; select?: string; eq: [string, string][]; limit?: number } = {
    eq: [],
  };
  const builder = {
    select: vi.fn((columns: string) => {
      calls.select = columns;
      return builder;
    }),
    eq: vi.fn((column: string, value: string) => {
      calls.eq.push([column, value]);
      return builder;
    }),
    limit: vi.fn(async (n: number) => {
      calls.limit = n;
      return result;
    }),
  };
  const client = {
    from: vi.fn((table: string) => {
      calls.table = table;
      return builder;
    }),
  };
  return { client, calls };
}

describe("hasFamily", () => {
  it("is true when a row comes back", async () => {
    const { client } = fakeClient({ data: [{ id: "m1" }], error: null });
    // The fake only implements the calls hasFamily makes.
    await expect(hasFamily(client as never, "user-1")).resolves.toBe(true);
  });

  it("is false when no rows come back", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(hasFamily(client as never, "user-1")).resolves.toBe(false);
  });

  it("throws when the query fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    await expect(hasFamily(client as never, "user-1")).rejects.toThrow("boom");
  });

  it("filters family_members on the user and the adult member type", async () => {
    const { client, calls } = fakeClient({ data: [], error: null });
    await hasFamily(client as never, "user-1");
    expect(calls.table).toBe("family_members");
    expect(calls.eq).toEqual([
      ["user_id", "user-1"],
      ["member_type", "adult"],
    ]);
    expect(calls.limit).toBe(1);
  });
});

describe("myFamilyId", () => {
  it("returns the family id of the user's adult membership", async () => {
    const { client, calls } = fakeClient({ data: [{ family_id: "fam-1" }] as never, error: null });
    await expect(myFamilyId(client as never, "user-1")).resolves.toBe("fam-1");
    expect(calls.select).toBe("family_id");
    expect(calls.eq).toEqual([
      ["user_id", "user-1"],
      ["member_type", "adult"],
    ]);
  });

  it("is null when the user has no family", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(myFamilyId(client as never, "user-1")).resolves.toBeNull();
  });

  it("throws when the query fails", async () => {
    const { client } = fakeClient({ data: null, error: { message: "boom" } });
    await expect(myFamilyId(client as never, "user-1")).rejects.toThrow("boom");
  });
});
