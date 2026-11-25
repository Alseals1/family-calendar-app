import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  cleanup,
  createFamilies,
  createUser,
  type Families,
  type TestUser,
} from "./helpers/fixtures";

// docs/prd.md section 8 privacy scenarios through the REST API, with real
// JWTs from three made-up local users: A and B share family F1, C is in F2.

type Visibility = "private" | "shared" | "family";

let a: TestUser;
let b: TestUser;
let c: TestUser;
let families: Families;
const ids: Record<Visibility, string> = { private: "", shared: "", family: "" };

async function insertEvent(user: TestUser, visibility: Visibility, title: string): Promise<string> {
  const { data, error } = await user.client
    .from("events")
    .insert({
      family_id: families.f1,
      created_by: user.id,
      title,
      start_time: "2026-12-01T15:00:00Z",
      end_time: "2026-12-01T16:00:00Z",
      visibility,
      calendar_type: visibility === "family" ? "family" : "personal",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function titleSeenByA(id: string): Promise<string | undefined> {
  const { data, error } = await a.client.from("events").select("title").eq("id", id);
  expect(error).toBeNull();
  return data?.[0]?.title;
}

beforeAll(async () => {
  a = await createUser("alex");
  b = await createUser("sam");
  c = await createUser("jordan");
  families = createFamilies({ a: a.id, b: b.id, c: c.id });

  // A writes through the API, which also exercises the insert policies.
  ids.private = await insertEvent(a, "private", "Doctor visit");
  ids.shared = await insertEvent(a, "shared", "Work dinner");
  ids.family = await insertEvent(a, "family", "Swim lesson");
  const { error } = await a.client
    .from("event_assignments")
    .insert({ event_id: ids.private, family_member_id: families.k1, family_id: families.f1 });
  if (error) throw error;
});

afterAll(() => {
  const users = [a, b, c].filter(Boolean).map((user) => user.id);
  cleanup({ families: families ? [families.f1, families.f2] : [], users });
});

describe("A's private event, seen by B in the same family", () => {
  it("returns no row when B selects it by id", async () => {
    const { data, error } = await b.client.from("events").select("*").eq("id", ids.private);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("returns none of its assignments", async () => {
    const { data, error } = await b.client
      .from("event_assignments")
      .select("*")
      .eq("event_id", ids.private);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("is not changed by B's update", async () => {
    const { count, error } = await b.client
      .from("events")
      .update({ title: "changed by B" }, { count: "exact" })
      .eq("id", ids.private);
    expect(error).toBeNull();
    expect(count).toBe(0);
    expect(await titleSeenByA(ids.private)).toBe("Doctor visit");
  });

  it("is not removed by B's delete", async () => {
    const { count, error } = await b.client
      .from("events")
      .delete({ count: "exact" })
      .eq("id", ids.private);
    expect(error).toBeNull();
    expect(count).toBe(0);
    expect(await titleSeenByA(ids.private)).toBe("Doctor visit");
  });
});

describe("A's shared and family events, seen by B", () => {
  it("lets B see both, and nothing private", async () => {
    const { data, error } = await b.client.from("events").select("id, visibility");
    expect(error).toBeNull();
    expect(data?.map((row) => row.id).sort()).toEqual([ids.shared, ids.family].sort());
  });

  it("does not let B update A's shared event", async () => {
    const { count, error } = await b.client
      .from("events")
      .update({ title: "changed by B" }, { count: "exact" })
      .eq("id", ids.shared);
    expect(error).toBeNull();
    expect(count).toBe(0);
    expect(await titleSeenByA(ids.shared)).toBe("Work dinner");
  });

  it("lets B update A's family event (D-03)", async () => {
    const { count, error } = await b.client
      .from("events")
      .update({ title: "Swim lesson (edited by B)" }, { count: "exact" })
      .eq("id", ids.family);
    expect(error).toBeNull();
    expect(count).toBe(1);
    expect(await titleSeenByA(ids.family)).toBe("Swim lesson (edited by B)");
  });
});

describe("writes B is not allowed", () => {
  it("rejects an event inserted with A as created_by", async () => {
    const { error } = await b.client.from("events").insert({
      family_id: families.f1,
      created_by: a.id,
      title: "Forged",
      start_time: "2026-12-02T15:00:00Z",
      end_time: "2026-12-02T16:00:00Z",
      visibility: "shared",
      calendar_type: "personal",
    });
    expect(error?.code).toBe("42501");
  });
});

describe("a user in another family", () => {
  it("sees no F1 event", async () => {
    const { data, error } = await c.client.from("events").select("id").eq("family_id", families.f1);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("gets no row for any of A's events by id", async () => {
    for (const id of Object.values(ids)) {
      const { data, error } = await c.client.from("events").select("id").eq("id", id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });
});

describe("a visitor who is not signed in", () => {
  it("sees no events", async () => {
    const { data, error } = await anonClient().from("events").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("a visibility change", () => {
  it("hides the event from B at once when A makes it private", async () => {
    const before = await b.client.from("events").select("id").eq("id", ids.shared);
    expect(before.data).toHaveLength(1);

    const { count, error } = await a.client
      .from("events")
      .update({ visibility: "private" }, { count: "exact" })
      .eq("id", ids.shared);
    expect(error).toBeNull();
    expect(count).toBe(1);

    const after = await b.client.from("events").select("id").eq("id", ids.shared);
    expect(after.error).toBeNull();
    expect(after.data).toEqual([]);
  });
});
