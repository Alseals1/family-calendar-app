import { describe, expect, it } from "vitest";
import { EVENT_COPY } from "@/lib/copy";
import { createEvent, deleteEvent, updateEvent } from "./mutations";
import type { EventInput } from "./schema";

// Unit tests for the error handling and the creator rules, with a scripted fake client.
// The full flow against row level security is tests/integration/events.test.ts.

type Result = { data?: unknown; error?: { code?: string; message?: string } | null };
type Call = { table: string; op: string };

const ME = "user-me";
const OTHER = "user-other";
const FAMILY = "family-1";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const KID = "22222222-2222-4222-8222-222222222222";
const RAW = "duplicate key value violates unique constraint secret_name";

function fakeClient(script: Record<string, Result[]>, user: { id: string } | null = { id: ME }) {
  const calls: Call[] = [];
  const queues = Object.fromEntries(Object.entries(script).map(([k, v]) => [k, [...v]]));
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table: string) {
      let op = "select";
      const builder = {
        insert: () => ((op = "insert"), builder),
        update: () => ((op = "update"), builder),
        delete: () => ((op = "delete"), builder),
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        limit: () => builder,
        single: () => builder,
        maybeSingle: () => builder,
        then(resolve: (value: Result) => unknown) {
          calls.push({ table, op });
          const next = queues[`${table}.${op}`]?.shift();
          if (!next) throw new Error(`Unscripted call: ${table}.${op}`);
          return resolve(next);
        },
      };
      return builder;
    },
  };
  return { client: client as never, calls };
}

function input(over: Partial<EventInput> = {}): EventInput {
  return {
    title: "Swim",
    description: null,
    location: null,
    isAllDay: false,
    startTime: "2026-12-01T15:00:00.000Z",
    endTime: "2026-12-01T16:00:00.000Z",
    visibility: "family",
    assignedMemberIds: [],
    ...over,
  };
}

const inFamily = { "family_members.select": [{ data: [{ family_id: FAMILY }], error: null }] };

function storedEvent(over: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    family_id: FAMILY,
    created_by: OTHER,
    title: "Swim",
    description: null,
    location: null,
    start_time: "2026-12-01T15:00:00+00:00",
    end_time: "2026-12-01T16:00:00+00:00",
    is_all_day: false,
    visibility: "family",
    calendar_type: "family",
    event_assignments: [],
    ...over,
  };
}

describe("every mutation", () => {
  it("asks the person to log in again when there is no user", async () => {
    const { client } = fakeClient({}, null);
    const expected = { status: "error", formError: EVENT_COPY.notSignedIn };
    expect(await createEvent(client, input())).toEqual(expected);
    expect(await updateEvent(client, EVENT_ID, input())).toEqual(expected);
    expect(await deleteEvent(client, EVENT_ID)).toEqual(expected);
  });

  it("asks the person to set up a family when they have none", async () => {
    const { client } = fakeClient({ "family_members.select": [{ data: [], error: null }] });
    expect(await createEvent(client, input())).toEqual({ status: "error", formError: EVENT_COPY.noFamily });
  });
});

describe("createEvent", () => {
  it("never returns the database's error text", async () => {
    const { client } = fakeClient({
      ...inFamily,
      "events.insert": [{ data: null, error: { code: "42501", message: RAW } }],
    });
    const result = await createEvent(client, input());
    expect(result).toEqual({ status: "error", formError: EVENT_COPY.saveFailed });
    expect(JSON.stringify(result)).not.toContain("secret_name");
  });

  it("deletes the event again when the assignments fail, and maps a foreign key error", async () => {
    const { client, calls } = fakeClient({
      ...inFamily,
      "events.insert": [{ data: { id: EVENT_ID }, error: null }],
      "event_assignments.insert": [{ data: null, error: { code: "23503", message: RAW } }],
      "events.delete": [{ data: null, error: null }],
    });
    const result = await createEvent(client, input({ assignedMemberIds: [KID] }));
    expect(result).toEqual({ status: "error", fieldErrors: { assignedMemberIds: EVENT_COPY.invalidMember } });
    expect(calls).toContainEqual({ table: "events", op: "delete" });
  });
});

describe("updateEvent", () => {
  it("says the event is gone when it cannot be read", async () => {
    const { client } = fakeClient({ ...inFamily, "events.select": [{ data: null, error: null }] });
    expect(await updateEvent(client, EVENT_ID, input())).toEqual({ status: "error", formError: EVENT_COPY.notFound });
  });

  it("refuses to edit another adult's shared event and writes nothing", async () => {
    const { client, calls } = fakeClient({
      ...inFamily,
      "events.select": [{ data: storedEvent({ visibility: "shared", calendar_type: "personal" }), error: null }],
    });
    expect(await updateEvent(client, EVENT_ID, input({ visibility: "shared" }))).toEqual({
      status: "error",
      formError: EVENT_COPY.forbidden,
    });
    expect(calls.map((c) => c.op)).not.toContain("update");
  });

  it("does not let a non-creator change the visibility of a family event, and writes nothing", async () => {
    const { client, calls } = fakeClient({
      ...inFamily,
      "events.select": [{ data: storedEvent(), error: null }],
    });
    expect(await updateEvent(client, EVENT_ID, input({ visibility: "private" }))).toEqual({
      status: "error",
      fieldErrors: { visibility: EVENT_COPY.visibilityLocked },
    });
    expect(calls.map((c) => c.op)).not.toContain("update");
  });

  it("lets the creator change the visibility", async () => {
    const { client } = fakeClient({
      ...inFamily,
      "events.select": [{ data: storedEvent({ created_by: ME }), error: null }],
      "events.update": [{ data: [{ id: EVENT_ID }], error: null }],
    });
    expect(await updateEvent(client, EVENT_ID, input({ visibility: "private" }))).toEqual({ status: "ok", id: EVENT_ID });
  });

  it("reports forbidden when the update changes no row", async () => {
    const { client } = fakeClient({
      ...inFamily,
      "events.select": [{ data: storedEvent({ created_by: ME }), error: null }],
      "events.update": [{ data: [], error: null }],
    });
    expect(await updateEvent(client, EVENT_ID, input())).toEqual({ status: "error", formError: EVENT_COPY.forbidden });
  });

  it("only inserts the added members and deletes the removed ones", async () => {
    const KEEP = "33333333-3333-4333-8333-333333333333";
    const { client, calls } = fakeClient({
      ...inFamily,
      "events.select": [
        {
          data: storedEvent({
            created_by: ME,
            event_assignments: [{ family_member_id: KEEP }, { family_member_id: "gone" }],
          }),
          error: null,
        },
      ],
      "events.update": [{ data: [{ id: EVENT_ID }], error: null }],
      "event_assignments.insert": [{ data: null, error: null }],
      "event_assignments.delete": [{ data: null, error: null }],
    });
    const result = await updateEvent(client, EVENT_ID, input({ assignedMemberIds: [KEEP, KID] }));
    expect(result).toEqual({ status: "ok", id: EVENT_ID });
    expect(calls.filter((c) => c.table === "event_assignments")).toEqual([
      { table: "event_assignments", op: "insert" },
      { table: "event_assignments", op: "delete" },
    ]);
  });

  it("reports a failed assignment write without the database's text", async () => {
    const { client } = fakeClient({
      ...inFamily,
      "events.select": [{ data: storedEvent({ created_by: ME }), error: null }],
      "events.update": [{ data: [{ id: EVENT_ID }], error: null }],
      "event_assignments.insert": [{ data: null, error: { code: "XX000", message: RAW } }],
    });
    const result = await updateEvent(client, EVENT_ID, input({ assignedMemberIds: [KID] }));
    expect(result).toEqual({ status: "error", formError: EVENT_COPY.assignmentsFailed });
  });
});

describe("deleteEvent", () => {
  it("deletes and returns the id", async () => {
    const { client } = fakeClient({ ...inFamily, "events.delete": [{ data: [{ id: EVENT_ID }], error: null }] });
    expect(await deleteEvent(client, EVENT_ID)).toEqual({ status: "ok", id: EVENT_ID });
  });

  it("says not found when no row was deleted", async () => {
    const { client } = fakeClient({ ...inFamily, "events.delete": [{ data: [], error: null }] });
    expect(await deleteEvent(client, EVENT_ID)).toEqual({ status: "error", formError: EVENT_COPY.notFound });
  });

  it("never returns the database's error text", async () => {
    const { client } = fakeClient({
      ...inFamily,
      "events.delete": [{ data: null, error: { code: "XX000", message: RAW } }],
    });
    expect(await deleteEvent(client, EVENT_ID)).toEqual({ status: "error", formError: EVENT_COPY.deleteFailed });
  });
});
