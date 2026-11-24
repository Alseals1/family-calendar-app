import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logIn } from "@/lib/auth/actions";
import { AUTH_COPY } from "@/lib/copy";
import { LoginForm } from "./login-form";

vi.mock("@/lib/auth/actions", () => ({
  logIn: vi.fn(async () => ({ status: "idle" })),
  register: vi.fn(),
  logOut: vi.fn(),
}));

beforeEach(() => vi.mocked(logIn).mockClear());

function submit() {
  fireEvent.submit(screen.getByRole("button", { name: AUTH_COPY.loginSubmit }).closest("form")!);
}

describe("LoginForm", () => {
  it("labels every field", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(AUTH_COPY.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(AUTH_COPY.passwordLabel)).toBeInTheDocument();
  });

  it("shows field errors for empty input and does not call the action", () => {
    render(<LoginForm />);
    submit();
    expect(screen.getByText(AUTH_COPY.emailInvalid)).toBeInTheDocument();
    expect(screen.getByText(AUTH_COPY.passwordRequired)).toBeInTheDocument();
    expect(logIn).not.toHaveBeenCalled();
  });

  it("calls the action when the input is valid", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(AUTH_COPY.emailLabel), { target: { value: "pat@example.test" } });
    fireEvent.change(screen.getByLabelText(AUTH_COPY.passwordLabel), { target: { value: "x" } });
    submit();
    await waitFor(() => expect(logIn).toHaveBeenCalledTimes(1));
  });
});
