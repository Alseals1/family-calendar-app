import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAMILY_COPY } from "@/lib/copy";
import { MemberList } from "./member-list";

const members = [
  { id: "1", name: "Alex", color: "#2563eb", isOwner: true },
  { id: "2", name: "Sam", color: "#16a34a", isOwner: false },
];

describe("MemberList", () => {
  it("lists every adult", () => {
    render(<MemberList members={members} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("labels only the owner", () => {
    render(<MemberList members={members} />);
    const [alex, sam] = screen.getAllByRole("listitem");
    expect(within(alex).getByText(FAMILY_COPY.ownerLabel)).toBeInTheDocument();
    expect(within(sam).queryByText(FAMILY_COPY.ownerLabel)).not.toBeInTheDocument();
  });
});
