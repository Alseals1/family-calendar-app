import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EVENT_COPY } from "@/lib/copy";
import { toAllDayRange } from "@/lib/dates/all-day";
import { getEvent, listEventsInRange } from "@/lib/events/queries";
import { createEvent, deleteEvent, updateEvent } from "@/lib/events/mutations";
import type { EventInput } from "@/lib/events/schema";
import {
  cleanup,
  createFamilies,
  createUser,
  type Families,
  type TestUser,
} from "./helpers/fixtures";
import { runLocalSql } from "./helpers/local-sql";

// T11: the event mutations and queries as real signed-in local users.
// A and B share family F1 (child K1); C is in F2.

let a: TestUser;
let b: TestUser;
let c: TestUser;
let families: Families;
let memberA: string;
let memberC: string;

const RANGE = { start: new Date("2026-11-30T00:00:00Z"), end: new Date("2026-12-08T00:00:00Z") };

function input(over: Partial<EventInput> = {}): EventInput {
  return {
    title: "Swim lesson",
    description: null,
    location: null,
    isAllDay: false,
    startTime: "2026-12-01T15:00:00.000Z",
    endTime: "2026-12-01T16:00:00.000Z",
    visibility: "private",
    assignedMemberIds: [],
    ...over,
  };
}

async function ok(result: Promise<{ status: string; id?: string }>): Promise<string> {
  const r = await result;
  expect(r.status).toBe("ok");
  return r.id as string;
}

async function listedIds(user: TestUser): Promise<string[]> {
  return (await listEventsInRange(user.client, RANGE)).map((e) => e.id);
}

beforeAll(async () => {
  a = await createUser("alex");
  b = await createUser("sam");
  c = await createUser("jordan");
  families = createFamilies({ a: a.id, b: b.id, c: c.id });
  const mine = await a.client.from("family_members").select("id").eq("user_id", a.id).single();
  const theirs = await c.client.from("family_members").select("id").eq("user_id", c.id).single();
  if (mine.error) throw mine.error;
  if (theirs.error) throw theirs.error;
  memberA = mine.data.id;
  memberC = theirs.data.id;
});

afterAll(() => {
  const users = [a, b, c].filter(Boolean).map((user) => user.id);
  cleanup({ families: families ? [families.f1, families.f2] : [], users });
});

describe("create, read back, change visibility, delete", () => {
  it("runs the whole flow as real users", async () => {
    // A creates a private event assigned to child K1 and reads it back.
    const id = await ok(createEvent(a.client, input({ assignedMemberIds: [families.k1] })));
    const mine = await getEvent(a.client, id);
    expect(mine).toMatchObject({
      id,
      family_id: families.f1,
      created_by: a.id,
      title: "Swim lesson",
      visibility: "private",
      calendar_type: "personal",
      assignedMemberIds: [families.k1],
    });
    expect(await listedIds(a)).toContain(id);

    // B (same family) cannot see it or its assignments; C (other family) cannot either.
    expect(await getEvent(b.client, id)).toBeNull();
    expect(await listedIds(b)).not.toContain(id);
    const bAssignments = await b.client.from("event_assignments").select("*").eq("event_id", id);
    expect(bAssignments.data).toEqual([]);
    expect(await getEvent(c.client, id)).toBeNull();

    // A shares it: B now sees it.
    await ok(updateEvent(a.client, id, input({ visibility: "shared", assignedMemberIds: [families.k1] })));
    const seenByB = await getEvent(b.client, id);
    expect(seenByB).toMatchObject({ id, visibility: "shared", calendar_type: "personal" });
    expect(await listedIds(b)).toContain(id);
    expect(await getEvent(c.client, id)).toBeNull();

    // A makes it a family event and replaces the assignment set.
    await ok(updateEvent(a.client, id, input({ visibility: "family", assignedMemberIds: [memberA] })));
    const family = await getEvent(a.client, id);
    expect(family).toMatchObject({ visibility: "family", calendar_type: "family", assignedMemberIds: [memberA] });

    // B edits the title of the family event, but cannot make it private.
    await ok(updateEvent(b.client, id, input({ title: "Renamed by Sam", visibility: "family", assignedMemberIds: [memberA] })));
    expect((await getEvent(a.client, id))?.title).toBe("Renamed by Sam");

    const locked = await updateEvent(b.client, id, input({ title: "Sneaky", visibility: "private", assignedMemberIds: [memberA] }));
    expect(locked).toEqual({ status: "error", fieldErrors: { visibility: EVENT_COPY.visibilityLocked } });
    expect(await getEvent(a.client, id)).toMatchObject({ title: "Renamed by Sam", visibility: "family" });

    // C never sees it.
    expect(await getEvent(c.client, id)).toBeNull();
    expect(await listedIds(c)).not.toContain(id);

    // A deletes it: gone, and its assignments are gone.
    await ok(deleteEvent(a.client, id));
    expect(await getEvent(a.client, id)).toBeNull();
    expect(runLocalSql(`select count(*) from public.event_assignments where event_id = '${id}';`).trim()).toBe("0");
  });
});

describe("assignments", () => {
  it("replaces the set on update, keeping the ones that stay", async () => {
    const id = await ok(createEvent(a.client, input({ visibility: "family", assignedMemberIds: [families.k1, memberA] })));
    await ok(updateEvent(a.client, id, input({ visibility: "family", assignedMemberIds: [memberA] })));
    expect((await getEvent(a.client, id))?.assignedMemberIds).toEqual([memberA]);
    await ok(updateEvent(a.client, id, input({ visibility: "family", assignedMemberIds: [] })));
    expect((await getEvent(a.client, id))?.assignedMemberIds).toEqual([]);
    await ok(deleteEvent(a.client, id));
  });

  it("refuses a member of another family on create and leaves no event behind", async () => {
    const title = `Cross-family ${Date.now()}`;
    const r = await createEvent(a.client, input({ title, visibility: "family", assignedMemberIds: [memberC] }));
    expect(r).toEqual({ status: "error", fieldErrors: { assignedMemberIds: EVENT_COPY.invalidMember } });
    const { data } = await a.client.from("events").select("id").eq("title", title);
    expect(data).toEqual([]);
  });

  it("refuses a member of another family on update", async () => {
    const id = await ok(createEvent(a.client, input({ visibility: "family" })));
    const r = await updateEvent(a.client, id, input({ visibility: "family", assignedMemberIds: [memberC] }));
    expect(r).toEqual({ status: "error", fieldErrors: { assignedMemberIds: EVENT_COPY.invalidMember } });
    await ok(deleteEvent(a.client, id));
  });
});

describe("permissions", () => {
  it("B cannot edit or delete A's shared event, and gets clear messages", async () => {
    const id = await ok(createEvent(a.client, input({ visibility: "shared" })));
    expect(await updateEvent(b.client, id, input({ title: "Hijack", visibility: "shared" }))).toEqual({
      status: "error",
      formError: EVENT_COPY.forbidden,
    });
    expect((await getEvent(a.client, id))?.title).toBe("Swim lesson");
    expect(await deleteEvent(b.client, id)).toEqual({ status: "error", formError: EVENT_COPY.notFound });
    expect(await getEvent(a.client, id)).not.toBeNull();
    await ok(deleteEvent(a.client, id));
  });

  it("an event that is not visible looks like a missing one", async () => {
    const id = await ok(createEvent(a.client, input({ visibility: "private" })));
    expect(await updateEvent(b.client, id, input())).toEqual({ status: "error", formError: EVENT_COPY.notFound });
    expect(await deleteEvent(b.client, id)).toEqual({ status: "error", formError: EVENT_COPY.notFound });
    expect(await getEvent(a.client, id)).not.toBeNull();
    await ok(deleteEvent(a.client, id));
  });

  it("deleting an event that does not exist says so", async () => {
    expect(await deleteEvent(a.client, "99999999-9999-4999-8999-999999999999")).toEqual({
      status: "error",
      formError: EVENT_COPY.notFound,
    });
  });
});

describe("all-day events", () => {
  it("one built with toAllDayRange is accepted by the database and read back unchanged", async () => {
    const { startTime, endTime } = toAllDayRange("2026-12-02", "2026-12-04");
    const id = await ok(createEvent(a.client, input({ isAllDay: true, startTime, endTime, visibility: "shared" })));
    const back = await getEvent(a.client, id);
    expect(back?.is_all_day).toBe(true);
    expect(new Date(back?.start_time as string).toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(new Date(back?.end_time as string).toISOString()).toBe("2026-12-05T00:00:00.000Z");
    await ok(deleteEvent(a.client, id));
  });
});

describe("listEventsInRange", () => {
  it("returns only events overlapping the range, ordered by start time", async () => {
    const late = await ok(createEvent(a.client, input({ title: "Late", startTime: "2026-12-05T10:00:00.000Z", endTime: "2026-12-05T11:00:00.000Z" })));
    const early = await ok(createEvent(a.client, input({ title: "Early", startTime: "2026-12-01T10:00:00.000Z", endTime: "2026-12-01T11:00:00.000Z" })));
    const outside = await ok(createEvent(a.client, input({ title: "Outside", startTime: "2026-12-20T10:00:00.000Z", endTime: "2026-12-20T11:00:00.000Z" })));
    const ids = await listedIds(a);
    expect(ids).toContain(early);
    expect(ids).toContain(late);
    expect(ids).not.toContain(outside);
    expect(ids.indexOf(early)).toBeLessThan(ids.indexOf(late));
    for (const id of [late, early, outside]) await ok(deleteEvent(a.client, id));
  });
});
