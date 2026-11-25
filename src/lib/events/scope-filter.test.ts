import { describe, expect, it } from "vitest";
import { MEMBERS, ME, SPOUSE, makeEvent } from "./fixtures";
import { applyMemberFilter, applyScope } from "./scope-filter";

const myPrivate = makeEvent({ id: "my-private", visibility: "private", calendar_type: "personal" });
const myShared = makeEvent({ id: "my-shared", visibility: "shared", calendar_type: "personal" });
const myFamily = makeEvent({ id: "my-family", visibility: "family", calendar_type: "family" });
const spouseShared = makeEvent({ id: "spouse-shared", created_by: SPOUSE, visibility: "shared", calendar_type: "personal" });
const spouseFamily = makeEvent({ id: "spouse-family", created_by: SPOUSE, visibility: "family", calendar_type: "family" });
// A row RLS should never return to me. If it ever leaks, the scope filter still drops it.
const leaked = makeEvent({ id: "spouse-private-leak", created_by: SPOUSE, visibility: "private", calendar_type: "personal" });

const all = [myPrivate, myShared, myFamily, spouseShared, spouseFamily, leaked];
const ids = (events: { id: string }[]) => events.map((e) => e.id);

describe("applyScope", () => {
  it("my: my own private and shared events, no family events, not even mine", () => {
    expect(ids(applyScope(all, "my", ME))).toEqual(["my-private", "my-shared"]);
  });

  it("family: every family event", () => {
    expect(ids(applyScope(all, "family", ME))).toEqual(["my-family", "spouse-family"]);
  });

  it("all: everything except another adult's private event", () => {
    expect(ids(applyScope(all, "all", ME))).toEqual(["my-private", "my-shared", "my-family", "spouse-shared", "spouse-family"]);
  });

  it("never returns another adult's private event, in any scope", () => {
    for (const scope of ["my", "family", "all"] as const) {
      expect(ids(applyScope(all, scope, ME))).not.toContain("spouse-private-leak");
    }
  });

  it("returns a new array and keeps the order", () => {
    const input = [spouseShared, myShared];
    const out = applyScope(input, "all", ME);
    expect(out).not.toBe(input);
    expect(ids(out)).toEqual(["spouse-shared", "my-shared"]);
  });

  it("returns an empty list for no events", () => {
    expect(applyScope([], "all", ME)).toEqual([]);
  });
});

describe("applyMemberFilter", () => {
  const swim = makeEvent({ id: "swim", visibility: "family", calendar_type: "family", assignedMemberIds: ["m-kid1"] });
  const piano = makeEvent({ id: "piano", visibility: "family", calendar_type: "family", assignedMemberIds: ["m-kid2"] });
  const both = makeEvent({ id: "both", visibility: "family", calendar_type: "family", assignedMemberIds: ["m-kid1", "m-kid2"] });
  const chores = makeEvent({ id: "chores", visibility: "family", calendar_type: "family", assignedMemberIds: [] });
  const myMeeting = myShared;
  const spouseMeeting = spouseShared;
  const events = [swim, piano, both, chores, myMeeting, spouseMeeting, spouseFamily];

  it("an empty selection returns the events unchanged", () => {
    expect(applyMemberFilter(events, [], MEMBERS)).toEqual(events);
  });

  it("a child keeps only the events assigned to that child", () => {
    expect(ids(applyMemberFilter(events, ["m-kid1"], MEMBERS))).toEqual(["swim", "both"]);
  });

  it("two members keep events assigned to either", () => {
    expect(ids(applyMemberFilter(events, ["m-kid1", "m-kid2"], MEMBERS))).toEqual(["swim", "piano", "both"]);
  });

  it("an adult keeps the personal events they created", () => {
    expect(ids(applyMemberFilter(events, ["m-me"], MEMBERS))).toEqual(["my-shared"]);
    expect(ids(applyMemberFilter(events, ["m-spouse"], MEMBERS))).toEqual(["spouse-shared"]);
  });

  it("an unassigned family event does not belong to an adult just because they created it", () => {
    const mine = makeEvent({ id: "mine", visibility: "family", calendar_type: "family", created_by: ME });
    expect(ids(applyMemberFilter([mine], ["m-me"], MEMBERS))).toEqual([]);
  });

  it("an adult keeps events they are assigned to", () => {
    const assigned = makeEvent({ id: "assigned", created_by: SPOUSE, visibility: "family", calendar_type: "family", assignedMemberIds: ["m-me"] });
    expect(ids(applyMemberFilter([assigned, chores], ["m-me"], MEMBERS))).toEqual(["assigned"]);
  });

  it("an adult and a child together keep both kinds", () => {
    expect(ids(applyMemberFilter(events, ["m-me", "m-kid2"], MEMBERS))).toEqual(["piano", "both", "my-shared"]);
  });

  it("ignores a selected id that is not a member", () => {
    expect(ids(applyMemberFilter(events, ["nobody"], MEMBERS))).toEqual([]);
  });
});
