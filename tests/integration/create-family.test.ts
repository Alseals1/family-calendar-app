import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, cleanup, createUser, type TestUser } from "./helpers/fixtures";

// create_family through PostgREST with real JWTs. Made-up users only.

let riley: TestUser;
let jordan: TestUser;
const familyIds: string[] = [];

beforeAll(async () => {
  riley = await createUser("riley");
  jordan = await createUser("jordan");
});

afterAll(() => {
  const users = [riley, jordan].filter(Boolean).map((user) => user.id);
  cleanup({ families: familyIds, users });
});

describe("create_family", () => {
  it("creates a family and makes the caller its owner and first adult", async () => {
    const { data, error } = await riley.client.rpc("create_family", {
      family_name: "The Smiths",
      display_name: "Riley",
      color: "#16a34a",
    });
    expect(error).toBeNull();
    expect(data).toMatch(/^[0-9a-f-]{36}$/);
    familyIds.push(data as string);

    const family = await riley.client.from("families").select("id, name, created_by").single();
    expect(family.error).toBeNull();
    expect(family.data).toEqual({ id: data, name: "The Smiths", created_by: riley.id });

    const member = await riley.client
      .from("family_members")
      .select("family_id, member_name, member_type, calendar_color")
      .eq("user_id", riley.id)
      .single();
    expect(member.error).toBeNull();
    expect(member.data).toEqual({
      family_id: data,
      member_name: "Riley",
      member_type: "adult",
      calendar_color: "#16a34a",
    });
  });

  it("answers 23505 to a second call and creates nothing more", async () => {
    const { data, error } = await riley.client.rpc("create_family", {
      family_name: "Second",
      display_name: "Riley",
      color: "#2563eb",
    });
    expect(data).toBeNull();
    expect(error?.code).toBe("23505");
    const families = await riley.client.from("families").select("id");
    expect(families.data).toHaveLength(1);
  });

  it("refuses a call with no session", async () => {
    const { data, error } = await anonClient().rpc("create_family", {
      family_name: "Anon Family",
      display_name: "Anon",
      color: "#2563eb",
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("refuses bad input and creates nothing", async () => {
    const { error } = await jordan.client.rpc("create_family", {
      family_name: "   ",
      display_name: "Jordan",
      color: "#2563eb",
    });
    expect(error?.code).toBe("23514");
    const families = await jordan.client.from("families").select("id");
    expect(families.data).toEqual([]);
  });

  it("still refuses a direct insert into families", async () => {
    const { error } = await jordan.client
      .from("families")
      .insert({ name: "Direct", created_by: jordan.id });
    expect(error).not.toBeNull();
  });
});
