import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/copy";
import Home from "./page";

describe("Home page", () => {
  it("shows the app name as the h1", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: APP_NAME }),
    ).toBeInTheDocument();
  });
});
