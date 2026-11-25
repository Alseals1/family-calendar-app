import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFamily } from "@/lib/family/actions";
import { COLOR_NAMES, FAMILY_COPY } from "@/lib/copy";
import { MEMBER_COLORS } from "@/lib/colors/palette";
import { OnboardingForm } from "./onboarding-form";

vi.mock("@/lib/family/actions", () => ({
  createFamily: vi.fn(async () => ({ status: "idle" })),
}));

beforeEach(() => vi.mocked(createFamily).mockClear());

describe("OnboardingForm", () => {
  it("labels the family name and display name fields, and prefills the name", () => {
    render(<OnboardingForm defaultDisplayName="Pat Example" />);
    expect(screen.getByLabelText(FAMILY_COPY.familyNameLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(FAMILY_COPY.displayNameLabel)).toHaveValue("Pat Example");
  });

  it("offers the eight colors as a radio group with Blue checked", () => {
    render(<OnboardingForm defaultDisplayName="" />);
    expect(screen.getByRole("radiogroup", { name: FAMILY_COPY.colorLabel })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(MEMBER_COLORS.length);
    for (const { id, hex } of MEMBER_COLORS) {
      const radio = screen.getByRole("radio", { name: COLOR_NAMES[id] });
      expect(radio).toHaveAttribute("value", hex);
    }
    expect(screen.getByRole("radio", { name: COLOR_NAMES.blue })).toBeChecked();
  });

  it("shows the error for an empty family name and does not call the action", () => {
    render(<OnboardingForm defaultDisplayName="Pat Example" />);
    fireEvent.submit(screen.getByRole("button", { name: FAMILY_COPY.submit }).closest("form")!);
    expect(screen.getByText(FAMILY_COPY.familyNameRequired)).toBeInTheDocument();
    expect(createFamily).not.toHaveBeenCalled();
  });

  it("shows the error for an empty display name", () => {
    render(<OnboardingForm defaultDisplayName="" />);
    fireEvent.change(screen.getByLabelText(FAMILY_COPY.familyNameLabel), { target: { value: "The Smiths" } });
    fireEvent.submit(screen.getByRole("button", { name: FAMILY_COPY.submit }).closest("form")!);
    expect(screen.getByText(FAMILY_COPY.displayNameRequired)).toBeInTheDocument();
    expect(createFamily).not.toHaveBeenCalled();
  });
});
