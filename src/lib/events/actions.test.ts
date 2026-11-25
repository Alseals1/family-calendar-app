import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENT_COPY } from "@/lib/copy";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./mutations", () => ({
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createEventAction, deleteEventAction, updateEventAction } from "./actions";
import { createEvent, deleteEvent, updateEvent } from "./mutations";

const ID = "11111111-1111-4111-8111-111111111111";
const fakeClient = { fake: true };

function input(over: Record<string, unknown> = {}) {
  return {
    title: " Dentist ",
    description: "",
    location: "",
    isAllDay: false,
    startTime: "2026-06-03T22:00:00Z",
    endTime: "2026-06-03T23:00:00Z",
    visibility: "private",
    assignedMemberIds: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue(fakeClient as never);
});

describe("createEventAction", () => {
  it("returns field errors for invalid input and calls nothing", async () => {
    const result = await createEventAction(input({ title: "", endTime: "2026-06-03T21:00:00Z" }));
    expect(result).toEqual({
      status: "error",
      fieldErrors: { title: EVENT_COPY.titleRequired, endTime: EVENT_COPY.endBeforeStart },
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(createEvent).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects input that is not an object", async () => {
    const result = await createEventAction("nonsense");
    expect(result.status).toBe("error");
    expect(createEvent).not.toHaveBeenCalled();
  });

  it("passes the parsed input to the mutation and revalidates on success", async () => {
    vi.mocked(createEvent).mockResolvedValue({ status: "ok", id: ID });
    const result = await createEventAction(input());
    expect(result).toEqual({ status: "ok", id: ID });
    expect(createEvent).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({ title: "Dentist", description: null, location: null }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("does not revalidate when the mutation fails", async () => {
    vi.mocked(createEvent).mockResolvedValue({ status: "error", formError: EVENT_COPY.saveFailed });
    const result = await createEventAction(input());
    expect(result).toEqual({ status: "error", formError: EVENT_COPY.saveFailed });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateEventAction", () => {
  it("rejects a bad id before anything else", async () => {
    const result = await updateEventAction("not-a-uuid", input());
    expect(result).toEqual({ status: "error", formError: EVENT_COPY.notFound });
    expect(createClient).not.toHaveBeenCalled();
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input and calls nothing", async () => {
    const result = await updateEventAction(ID, input({ visibility: "public" }));
    expect(result).toEqual({ status: "error", fieldErrors: { visibility: EVENT_COPY.visibilityInvalid } });
    expect(createClient).not.toHaveBeenCalled();
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it("calls the mutation with the id and revalidates on success", async () => {
    vi.mocked(updateEvent).mockResolvedValue({ status: "ok", id: ID });
    const result = await updateEventAction(ID, input());
    expect(result).toEqual({ status: "ok", id: ID });
    expect(updateEvent).toHaveBeenCalledWith(fakeClient, ID, expect.objectContaining({ title: "Dentist" }));
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });
});

describe("deleteEventAction", () => {
  it("rejects a bad id", async () => {
    const result = await deleteEventAction("nope");
    expect(result).toEqual({ status: "error", formError: EVENT_COPY.notFound });
    expect(createClient).not.toHaveBeenCalled();
    expect(deleteEvent).not.toHaveBeenCalled();
  });

  it("calls the mutation and revalidates on success", async () => {
    vi.mocked(deleteEvent).mockResolvedValue({ status: "ok", id: ID });
    expect(await deleteEventAction(ID)).toEqual({ status: "ok", id: ID });
    expect(deleteEvent).toHaveBeenCalledWith(fakeClient, ID);
    expect(revalidatePath).toHaveBeenCalledWith("/calendar");
  });

  it("does not revalidate when the mutation fails", async () => {
    vi.mocked(deleteEvent).mockResolvedValue({ status: "error", formError: EVENT_COPY.notFound });
    await deleteEventAction(ID);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
